import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ================================================================
   Three.js 3D Scene — Death Stranding read (restraint, not “symbols”)
   Empty beach void, horizon cord, soft fog, rising mist layer, dust, bloom
   ================================================================ */

/* Ultra-subtle dust — no icons, no geometric silhouettes */
const PARTICLE_COUNT = window.innerWidth < 600 ? 36 : 96;
const isMobile = !window.matchMedia('(pointer:fine)').matches;

const container = document.getElementById('heroWebGL');
if (!container) throw new Error('No #heroWebGL element');

const scene    = new THREE.Scene();
/* Cold blue-black horizon haze (Death Stranding beach / BT zone read) */
scene.fog      = new THREE.FogExp2(0x0a121c, 0.072);
scene.background = new THREE.Color(0x04060c);

/* ---------- deep chiral field (animated void behind fog) ---------- */
const shellSegX = isMobile ? 28 : 56;
const shellSegY = isMobile ? 16 : 32;
const shellGeo = new THREE.PlaneGeometry(130, 75, shellSegX, shellSegY);
const shellMat = new THREE.ShaderMaterial({
  depthWrite: true,
  side: THREE.FrontSide,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float t = uTime;
      float roll = sin(pos.x * 0.06 + t * 0.22) * cos(pos.y * 0.07 - t * 0.18);
      pos.z += roll * 0.35;
      pos.xy += vec2(cos(t * 0.14 + pos.y * 0.04), sin(t * 0.12 + pos.x * 0.04)) * 0.05;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.02;
        a *= 0.52;
      }
      return v;
    }

    void main() {
      float t = uTime;
      vec2 uv = vUv * vec2(2.6, 1.55);
      vec2 warp = vec2(
        fbm(uv * 1.4 + t * 0.035),
        fbm(uv * 1.4 - t * 0.03 + 5.2)
      ) - 0.5;
      vec2 q = uv + warp * 0.22 + vec2(t * 0.018, t * 0.011);

      float n = fbm(q * 1.25 + vec2(sin(t * 0.08), 0.0));
      vec2 rq = q * 0.9 - vec2(sin(t * 0.1), cos(t * 0.08)) * 0.06;
      float ir = sin(rq.x * 7.0 + t * 0.22) * sin(rq.y * 5.5 - t * 0.2)
               * cos(length(rq) * 4.0 - t * 0.28);
      float pools = smoothstep(0.4, 0.88, fbm(q * 1.6 + t * 0.02));

      /* DS title-screen void: heavy below, lighter toward horizon */
      float sky = smoothstep(0.05, 0.62, vUv.y);
      vec3 deep = vec3(0.012, 0.016, 0.028);
      vec3 band = vec3(0.04, 0.055, 0.09);
      vec3 col = mix(deep, band, sky * 0.55 + n * 0.18);
      col = mix(col, vec3(0.07, 0.09, 0.14), (1.0 - sky) * 0.35);
      /* whisper of chiral oil — not loud pattern */
      col += vec3(0.06, 0.08, 0.11) * pow(max(0.0, ir), 2.0) * 0.18;
      col += vec3(0.14, 0.1, 0.07) * pow(max(0.0, -ir), 3.0) * (0.12 + 0.1 * pools);
      /* faint “bridge cord” at horizon (UI amber, game menu language) */
      float hz = abs(vUv.y - 0.465);
      float cord = exp(-hz * hz * 520.0) * 0.22;
      col += vec3(0.48, 0.36, 0.24) * cord * (0.55 + 0.45 * n);
      float vign = smoothstep(0.9, 0.18, length(vUv - 0.5) * 1.12);
      col *= 0.88 + 0.12 * vign;
      gl_FragColor = vec4(col, 1.0);
    }
  `
});
const shellPlane = new THREE.Mesh(shellGeo, shellMat);
shellPlane.position.set(0, 0, -29);
scene.add(shellPlane);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.15, 5.4);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
container.appendChild(renderer.domElement);

/* ---------- post-processing ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

if (!isMobile) {
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.36,
    0.42,
    0.55
  );
  composer.addPass(bloom);
}

/* ---------- fog plane (distant atmospheric haze) ---------- */
const fogGeo = new THREE.PlaneGeometry(80, 40, 32, 16);
const fogMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(0x05080f) },
    uColor2: { value: new THREE.Color(0x152232) },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vFogWave;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float w = sin(pos.x * 0.12 + uTime * 0.32) * cos(pos.y * 0.14 + uTime * 0.24) * 0.18;
      pos.z += w;
      vFogWave = w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying vec2 vUv;
    varying float vFogWave;

    /* simplex-ish noise */
    vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187,0.366025403784439,
                         -0.577350269189626,0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec2 flow = vec2(uTime * 0.045, uTime * 0.028);
      float n = snoise(vUv * 3.2 + flow);
      float n2 = snoise(vUv * 7.0 - flow.yx * 1.3 + vec2(0.0, uTime * 0.05));
      float n3 = snoise(vUv * 14.0 + vec2(uTime * 0.08, -uTime * 0.06));
      float blend = smoothstep(-0.35, 0.65, n * 0.45 + n2 * 0.35 + n3 * 0.12);
      vec3 col = mix(uColor1, uColor2, blend);
      float horizon = smoothstep(0.22, 0.75, vUv.y);
      col = mix(col, vec3(0.42, 0.52, 0.64), horizon * 0.14);
      float shelf = sin(vUv.x * 6.0 + uTime * 0.08 + n * 1.5)
                  * sin(vUv.x * 2.5 - uTime * 0.05 + n2);
      col += vec3(0.32, 0.38, 0.46) * shelf * 0.018 * horizon;
      float rim = pow(max(0.0, 1.0 - abs(vUv.y - 0.5) * 2.4), 4.0);
      col += vec3(0.42, 0.32, 0.22) * rim * 0.065 * (0.5 + 0.5 * n2);
      col += vec3(0.03, 0.04, 0.06) * vFogWave;
      float alpha = 0.36 * smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
      alpha *= (0.55 + 0.35 * blend);
      gl_FragColor = vec4(col, alpha);
    }
  `
});
const fogPlane = new THREE.Mesh(fogGeo, fogMat);
fogPlane.position.set(0, 0, -20);
scene.add(fogPlane);

/* ---------- rising mist (always-on vertical drift, in front of fog plane) ---------- */
const mistSegX = isMobile ? 18 : 36;
const mistSegY = isMobile ? 12 : 24;
const mistGeo = new THREE.PlaneGeometry(98, 54, mistSegX, mistSegY);
const mistMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vSw;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float t = uTime;
      float sw = sin(pos.x * 0.1 + t * 0.48) * sin(pos.y * 0.085 + t * 0.36) * 0.12;
      pos.z += sw;
      vSw = sw;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vSw;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.04;
        a *= 0.51;
      }
      return v;
    }

    void main() {
      float t = uTime;
      float rise = t * 0.13;
      vec2 uv = vUv;
      vec2 q = vec2(uv.x * 3.4 + sin(uv.y * 5.0 + t * 0.35) * 0.06, uv.y * 4.2 - rise);
      float m1 = fbm(q);
      float m2 = fbm(q * 2.15 + vec2(17.0, -rise * 1.8));
      float m3 = fbm(vec2(uv.x * 5.0 - t * 0.04, uv.y * 3.5 - rise * 0.9));
      float wisps = pow(max(0.0, m1 * 0.5 + m2 * 0.32 + m3 * 0.22), 1.25);

      float fromGround = smoothstep(0.0, 0.42, uv.y) * smoothstep(1.0, 0.58, uv.y);
      float column = smoothstep(0.15, 0.55, uv.y) * (1.0 - smoothstep(0.82, 1.0, uv.y));
      float mask = fromGround * 0.5 + column * 0.95;
      float drift = 0.18 + 0.14 * fbm(vec2(uv.x * 2.2, uv.y * 1.8 + t * 0.05));

      float a = wisps * mask * drift + abs(vSw) * 0.06;
      a = clamp(a, 0.0, 0.48);

      vec3 hi = vec3(0.52, 0.58, 0.68);
      vec3 lo = vec3(0.22, 0.28, 0.38);
      vec3 col = mix(lo, hi, wisps * 0.75 + 0.15);

      gl_FragColor = vec4(col, a);
    }
  `
});
const mistPlane = new THREE.Mesh(mistGeo, mistMat);
mistPlane.position.set(0, -0.55, -19.05);
scene.add(mistPlane);

/* ---------- ambient light layers (cold moon / wet sand) ---------- */
const hemi = new THREE.HemisphereLight(0x3a4a62, 0x050608, 0.14);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const ambLight = new THREE.AmbientLight(0x5c6a7c, 0.11);
scene.add(ambLight);
const dirLight = new THREE.DirectionalLight(0xb8c4d8, 0.055);
dirLight.position.set(-3, 6, 4);
scene.add(dirLight);
const rimWarm = new THREE.DirectionalLight(0xc89b6b, 0.028);
rimWarm.position.set(5, 2, -2);
scene.add(rimWarm);

/* ---------- beach-air dust (soft bokeh only — reads as scale, not symbols) ---------- */
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pSizes     = new Float32Array(PARTICLE_COUNT);
const pAlphas    = new Float32Array(PARTICLE_COUNT);
const pSpeeds    = new Float32Array(PARTICLE_COUNT);
const pPhases    = new Float32Array(PARTICLE_COUNT);
const pTilts     = new Float32Array(PARTICLE_COUNT);
const pThick     = new Float32Array(PARTICLE_COUNT);
const pSeeds     = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPositions[i * 3]     = (Math.random() - 0.5) * 22;
  pPositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
  pPositions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 5;
  pSizes[i]   = Math.random() * 1.6 + 0.55;
  pAlphas[i]  = Math.random() * 0.055 + 0.028;
  pSpeeds[i]  = Math.random() * 0.22 + 0.08;
  pPhases[i]  = Math.random() * Math.PI * 2;
  pTilts[i]   = Math.random() * Math.PI;
  pThick[i]   = Math.random() * 0.55 + 0.35;
  pSeeds[i]   = Math.random() * 1000;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeo.setAttribute('aSize',    new THREE.BufferAttribute(pSizes, 1));
pGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(pAlphas, 1));
pGeo.setAttribute('aSpeed',   new THREE.BufferAttribute(pSpeeds, 1));
pGeo.setAttribute('aPhase',   new THREE.BufferAttribute(pPhases, 1));
pGeo.setAttribute('aTilt',    new THREE.BufferAttribute(pTilts, 1));
pGeo.setAttribute('aThick',   new THREE.BufferAttribute(pThick, 1));
pGeo.setAttribute('aSeed',    new THREE.BufferAttribute(pSeeds, 1));

const pMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime:  { value: 0 },
    uScale: { value: window.innerHeight * renderer.getPixelRatio() * 0.33 },
    uWind:  { value: new THREE.Vector2(0, 0) },
  },
  vertexShader: `
    attribute float aSize;
    attribute float aAlpha;
    attribute float aSpeed;
    attribute float aPhase;
    attribute float aTilt;
    attribute float aThick;
    attribute float aSeed;
    uniform float uTime;
    uniform float uScale;
    uniform vec2 uWind;
    varying float vAlpha;
    varying float vTilt;
    varying float vThick;

    void main() {
      float t = uTime;
      vec3 base = position;
      float sd = aSeed * 0.001;

      vec3 drift = vec3(
        sin(t * 0.18 + sd * 6.28318 + aPhase) * 1.8,
        cos(t * 0.15 + sd * 4.71 + aPhase * 1.2) * 1.2,
        sin(t * 0.17 + aPhase * 1.8) * 1.6
      );
      vec3 pos = base + drift * (0.28 + aSpeed * 0.9);

      float ang = t * (0.06 + aSpeed * 0.12) + aPhase;
      float rad = 0.22 + aThick * 0.28;
      pos.x += cos(ang) * rad;
      pos.z += sin(ang) * rad;
      pos.y += sin(t * 0.28 + aPhase * 2.2 + sd) * 0.35;

      pos.x += uWind.x * 0.35;
      pos.z += uWind.y * 0.28;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPos;

      float breathe = 0.92 + 0.08 * sin(t * 0.65 + aSeed * 0.03);
      gl_PointSize = aSize * uScale * breathe / max(0.08, -mvPos.z);

      float flicker = 0.72 + 0.28 * sin(t * 0.9 + aPhase * 2.0 + sd * 80.0);
      vAlpha = aAlpha * flicker;
      vTilt = aTilt;
      vThick = aThick;
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    varying float vTilt;
    varying float vThick;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float cr = cos(vTilt), sr = sin(vTilt);
      vec2 u = vec2(cr * uv.x - sr * uv.y, sr * uv.x + cr * uv.y);
      float rx = 0.42 + vThick * 0.28;
      float ry = 0.28 + vThick * 0.18;
      vec2 sc = vec2(u.x / rx, u.y / ry);
      float d = length(sc);
      float m = exp(-d * d * 5.5);
      float a = m * vAlpha;
      vec3 slate = vec3(0.32, 0.38, 0.46);
      vec3 warm  = vec3(0.42, 0.36, 0.3);
      vec3 col = mix(slate, warm, exp(-d * d * 14.0) * 0.35);
      if (a < 0.008) discard;
      gl_FragColor = vec4(col * a, a);
    }
  `
});

const particlePoints = new THREE.Points(pGeo, pMat);
scene.add(particlePoints);

/* ---------- mouse state ---------- */
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;

if (!isMobile) {
  document.addEventListener('mousemove', (e) => {
    targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });
}

/* ---------- resize ---------- */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  pMat.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.33;
}
window.addEventListener('resize', onResize);

/* ---------- visibility ---------- */
let visible = true;
const obs = new IntersectionObserver(
  (entries) => { visible = entries[0].isIntersecting; },
  { threshold: 0 }
);
obs.observe(container);

/* ---------- animation loop ---------- */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  if (!visible) return;

  const t = clock.getElapsedTime();

  mouseX += (targetX - mouseX) * 0.04;
  mouseY += (targetY - mouseY) * 0.04;
  camera.rotation.y = -mouseX * 0.04;
  camera.rotation.x = -mouseY * 0.03;

  pMat.uniforms.uTime.value = t;
  fogMat.uniforms.uTime.value = t;
  shellMat.uniforms.uTime.value = t;
  mistMat.uniforms.uTime.value = t;
  if (isMobile) {
    pMat.uniforms.uWind.value.set(Math.sin(t * 0.37) * 0.22, Math.cos(t * 0.31) * 0.16);
  } else {
    pMat.uniforms.uWind.value.set(mouseX * 0.42, -mouseY * 0.28);
  }

  composer.render();
}

animate();

export { scene, camera, renderer };
