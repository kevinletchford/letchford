// src/space/assets.ts
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { DeviceTier } from "./device";

// Raw responses (images, OBJ text, GLB buffers) are cached, so revisiting a page
// doesn't refetch. Parsed objects are NOT cached: pages mutate and dispose them.
THREE.Cache.enabled = true;

export type Priority = "critical" | "deferred";

export type LoadProgress = { loaded: number; total: number };

/** Loader helpers handed to page loaders, bound to one navigation + priority. */
export type Assets = {
  texture(url: string): Promise<THREE.Texture>;
  obj(url: string): Promise<THREE.Group>;
  gltf(url: string): Promise<GLTF>;
};

export class AbortError extends Error {
  constructor() { super("Aborted"); this.name = "AbortError"; }
}

export const isAbortError = (e: unknown) => e instanceof Error && e.name === "AbortError";

type Job = { priority: Priority; run: () => void };

/**
 * Concurrency-limited, priority-aware queue for three.js asset requests.
 * Critical requests jump ahead of deferred ones and count towards progress.
 */
export class AssetLoader {
  private readonly concurrency: number;
  private readonly manager = new THREE.LoadingManager();
  private readonly textureLoader = new THREE.TextureLoader(this.manager);
  private readonly objLoader = new OBJLoader(this.manager);
  private readonly gltfLoader = new GLTFLoader(this.manager);

  private pending: Job[] = [];
  private active = 0;
  private progress: LoadProgress = { loaded: 0, total: 0 };

  constructor(tier: DeviceTier) {
    this.concurrency = tier === "high" ? 6 : 2;
  }

  /** Helpers bound to an AbortSignal and priority. */
  bind(signal: AbortSignal, priority: Priority = "critical"): Assets {
    return {
      texture: (url) => this.enqueue(() => this.textureLoader.loadAsync(url), priority, signal),
      obj: (url) => this.enqueue(() => this.objLoader.loadAsync(url), priority, signal),
      gltf: (url) => this.enqueue(() => this.gltfLoader.loadAsync(url), priority, signal),
    };
  }

  /** Count arbitrary critical work (e.g. GPU uploads) towards progress. */
  track<T>(work: Promise<T>): Promise<T> {
    this.progress.total++;
    this.emit();
    return work.finally(() => {
      this.progress.loaded++;
      this.emit();
    });
  }

  private enqueue<T>(task: () => Promise<T>, priority: Priority, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(new AbortError());

    const result = new Promise<T>((resolve, reject) => {
      const job: Job = {
        priority,
        run: () => {
          // Navigated away while queued: don't start the request at all.
          if (signal.aborted) return reject(new AbortError());
          this.active++;
          task()
            .then((v) => (signal.aborted ? reject(new AbortError()) : resolve(v)), reject)
            .finally(() => {
              this.active--;
              this.pump();
            });
        },
      };

      if (priority === "critical") {
        const firstDeferred = this.pending.findIndex((j) => j.priority === "deferred");
        if (firstDeferred === -1) this.pending.push(job);
        else this.pending.splice(firstDeferred, 0, job);
      } else {
        this.pending.push(job);
      }
      this.pump();
    });

    return priority === "critical" ? this.track(result) : result;
  }

  private pump() {
    while (this.active < this.concurrency && this.pending.length) {
      this.pending.shift()!.run();
    }
  }

  private emit() {
    window.dispatchEvent(new CustomEvent<LoadProgress>("space:load-progress", { detail: { ...this.progress } }));
  }
}
