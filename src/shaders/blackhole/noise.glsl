// 2D simplex-ish noise + fbm (compact)
vec2 bh_hash2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float bh_noise(vec2 p){
  const float K1 = 0.366025404; // (sqrt(3)-1)/2
  const float K2 = 0.211324865; // (3-sqrt(3))/6
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  vec3 n = h*h*h*h * vec3(
    dot(a, bh_hash2(i + 0.0)),
    dot(b, bh_hash2(i + o)),
    dot(c, bh_hash2(i + 1.0))
  );
  return dot(n, vec3(70.0));
}
float bh_fbm(vec2 p){
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ f += a * bh_noise(p); p *= 2.02; a *= 0.5; }
  return f;
}
