// Projects shown as hologram portals on the Mars surface (home page).
// `image` is a 4:5 thumbnail (the list icon, and the hologram on smaller screens);
// `screen` is a 16:9 capture for the wide hologram on large desktops.
export type Project = {
  key: string;
  title: string;
  blurb: string;
  href: string;
  image: string;
  screen: string;
};

export const PROJECTS: Project[] = [
  {
    key: "kiosk",
    title: "Interactive Kiosk",
    blurb: "Multi-platform kiosk for demos and conferences",
    href: "/case-studies/kiosk/",
    image: "/portals/kiosk.jpg",
    screen: "/portals/wide/kiosk.jpg",
  },
  {
    key: "automation",
    title: "Article Automation",
    blurb: "Automating Google Docs to Umbraco",
    href: "/case-studies/automation/",
    image: "/portals/automation.jpg",
    screen: "/portals/wide/automation.jpg",
  },
  {
    key: "product-tour",
    title: "Product Tour",
    blurb: "An animated introduction to Sitebulb",
    href: "/case-studies/product-tour/",
    image: "/portals/product-tour.jpg",
    screen: "/portals/wide/product-tour.jpg",
  },
  {
    key: "demos",
    title: "GSAP Demos",
    blurb: "2D motion experiments with GSAP",
    href: "/demos/",
    image: "/portals/demos.jpg",
    screen: "/portals/wide/demos.jpg",
  },
  {
    key: "snatcher",
    title: "Snatcher",
    blurb: "Save tracks from the radio to Spotify",
    href: "https://snatcher.ultr.dev/",
    image: "/portals/snatcher.jpg",
    screen: "/portals/wide/snatcher.jpg",
  },
  {
    key: "sitebulb",
    title: "Sitebulb",
    blurb: "Web crawler: frontend and site design",
    href: "https://sitebulb.com/",
    image: "/portals/sitebulb.jpg",
    screen: "/portals/wide/sitebulb.jpg",
  },
];
