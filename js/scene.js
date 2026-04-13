import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ================================================================
   Three.js 3D Scene — Death Stranding atmosphere
   Volumetric fog, 3D particle field, bloom, mouse-look camera
   ================================================================ */

const PARTICLE_COUNT = window.innerWidth < 600 ? 68 : 168;
const isMobile = !window.matchMedia('(pointer:fine)').matches;

const container = document.getElementById('heroWebGL');
if (!container) throw new Error('No #heroWebGL element');

const scene    = new THREE.Scene();
scene.fog      = new THREE.FogExp2(0x06070c, 0.055);
scene.background = new THREE.Color(0x06070c);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
container.appendChild(renderer.domElement);

/* ---------- post-processing ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

if (!isMobile) {
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.58,  // strength — soft halo on particles, still below original wash
    0.34,  // radius — tighter bloom = less full-screen bleed
    0.54   // threshold — only brighter cores bloom
  );
  composer.addPass(bloom);
}

/* ---------- fog plane (distant atmospheric haze) ---------- */
const fogGeo = new THREE.PlaneGeometry(80, 40, 1, 1);
const fogMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(0x0a0c14) },
    uColor2: { value: new THREE.Color(0x1a1510) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    varying vec2 vUv;

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
      float n = snoise(vUv * 3.0 + vec2(uTime * 0.02, uTime * 0.01));
      float n2 = snoise(vUv * 6.0 - vec2(uTime * 0.015, 0.0));
      float blend = smoothstep(-0.3, 0.6, n * 0.5 + n2 * 0.3);
      vec3 col = mix(uColor1, uColor2, blend);
      float alpha = 0.32 * smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
      alpha *= (0.55 + 0.35 * blend);
      gl_FragColor = vec4(col, alpha);
    }
  `
});
const fogPlane = new THREE.Mesh(fogGeo, fogMat);
fogPlane.position.set(0, 0, -18);
scene.add(fogPlane);

/* ---------- ambient light layers ---------- */
const ambLight = new THREE.AmbientLight(0x1a1520, 0.22);
scene.add(ambLight);
const dirLight = new THREE.DirectionalLight(0xc89b7b, 0.09);
dirLight.position.set(2, 5, 3);
scene.add(dirLight);

/* ---------- 3D particle system ---------- */
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pSizes     = new Float32Array(PARTICLE_COUNT);
const pAlphas    = new Float32Array(PARTICLE_COUNT);
const pSpeeds    = new Float32Array(PARTICLE_COUNT);
const pPhases    = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPositions[i * 3]     = (Math.random() - 0.5) * 18;
  pPositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
  pPositions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 5;
  pSizes[i]   = Math.random() * 2.05 + 0.42;
  pAlphas[i]  = Math.random() * 0.32 + 0.07;
  pSpeeds[i]  = Math.random() * 0.3 + 0.05;
  pPhases[i]  = Math.random() * Math.PI * 2;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeo.setAttribute('aSize',    new THREE.BufferAttribute(pSizes, 1));
pGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(pAlphas, 1));
pGeo.setAttribute('aSpeed',   new THREE.BufferAttribute(pSpeeds, 1));
pGeo.setAttribute('aPhase',   new THREE.BufferAttribute(pPhases, 1));

const pMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime:  { value: 0 },
    uScale: { value: window.innerHeight * renderer.getPixelRatio() * 0.33 },
  },
  vertexShader: `
    attribute float aSize;
    attribute float aAlpha;
    attribute float aSpeed;
    attribute float aPhase;
    uniform float uTime;
    uniform float uScale;
    varying float vAlpha;

    void main() {
      vec3 pos = position;
      pos.y += mod(uTime * aSpeed + aPhase, 14.0) - 7.0;
      pos.x += sin(uTime * 0.3 + aPhase) * 0.15;

      vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPos;
      gl_PointSize = aSize * uScale / -mvPos.z;

      float flicker = 0.55 + 0.45 * sin(uTime * 1.2 + aPhase * 3.0);
      vAlpha = aAlpha * (0.55 + 0.45 * flicker) * 0.72;
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float core = smoothstep(1.0, 0.32, d);
      float glow = smoothstep(1.0, 0.0, d) * 0.18;
      float a = (core + glow) * vAlpha;
      vec3 col = mix(vec3(0.55, 0.42, 0.32), vec3(0.78, 0.62, 0.48), core);
      gl_FragColor = vec4(col, a);
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

  const posArr = pGeo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const yi = i * 3 + 1;
    if (posArr[yi] > 7) {
      posArr[yi] = -7;
      posArr[i * 3]     = (Math.random() - 0.5) * 18;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 12 - 5;
    }
  }
  pGeo.attributes.position.needsUpdate = true;

  composer.render();
}

animate();

export { scene, camera, renderer };
