// Renderer, cameras, lighting, sky and graphics settings.
import * as THREE from 'three';
import { G } from './state.js';
import { settings, onSettingsChange } from './config.js';

let sun, hemi, sky, skyMat;

export function initRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * settings.resScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = settings.shadows !== 'off';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);
  G.renderer = renderer;

  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, settings.drawDistance * 1.5);
  G.camera.rotation.order = 'YXZ';
  G.scene.add(G.camera);

  G.vmScene = new THREE.Scene();
  G.vmCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.01, 10);
  G.vmScene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const vmLight = new THREE.DirectionalLight(0xffffff, 1.6);
  vmLight.position.set(0.5, 1, 0.6);
  G.vmScene.add(vmLight);
  G.vmLight = vmLight;

  window.addEventListener('resize', onResize);
  onSettingsChange(applyGraphics);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  G.renderer.setSize(w, h);
  G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
  G.vmCamera.aspect = w / h; G.vmCamera.updateProjectionMatrix();
}

function applyGraphics(key) {
  const r = G.renderer;
  if (key === 'resScale') r.setPixelRatio(Math.min(window.devicePixelRatio, 2) * settings.resScale);
  if (key === 'fov') { G.baseFov = settings.fov; }
  if (key === 'drawDistance') {
    G.camera.far = settings.drawDistance * 1.5; G.camera.updateProjectionMatrix();
    if (G.scene.fog && G.map) setFog(G.map.fogColor, G.map.fogDensityScale);
  }
  if (key === 'shadows') {
    r.shadowMap.enabled = settings.shadows !== 'off';
    if (sun) {
      const size = settings.shadows === 'high' ? 4096 : 1024;
      sun.castShadow = settings.shadows !== 'off';
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      sun.shadow.mapSize.set(size, size);
    }
    G.scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); } });
  }
}

export function setFog(color, scale = 1) {
  const far = settings.drawDistance * scale;
  G.scene.fog = new THREE.Fog(color, far * 0.25, far);
}

// Lighting + sky for a map. opts: {skyTop, skyBottom, sunColor, sunIntensity, sunDir, hemiSky, hemiGround, hemiIntensity, fog}
export function setupEnvironment(opts) {
  if (sun) { G.scene.remove(sun); G.scene.remove(sun.target); }
  if (hemi) G.scene.remove(hemi);
  if (sky) G.scene.remove(sky);

  hemi = new THREE.HemisphereLight(opts.hemiSky ?? 0xbfd9ff, opts.hemiGround ?? 0x8a8070, opts.hemiIntensity ?? 1.2);
  G.scene.add(hemi);

  sun = new THREE.DirectionalLight(opts.sunColor ?? 0xfff3e0, opts.sunIntensity ?? 2.6);
  G.sunDir = new THREE.Vector3(...(opts.sunDir || [0.45, 1, 0.3])).normalize();
  sun.castShadow = settings.shadows !== 'off';
  const size = settings.shadows === 'high' ? 4096 : 1024;
  sun.shadow.mapSize.set(size, size);
  const ext = 45;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 400 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  G.scene.add(sun); G.scene.add(sun.target);
  G.sun = sun;

  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(opts.skyTop ?? 0x2f7de1) },
      bottom: { value: new THREE.Color(opts.skyBottom ?? 0xbfe0ff) },
      sunDir: { value: G.sunDir },
      sunGlow: { value: opts.sunGlow ?? 1 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float sunGlow; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y*1.4+0.1,0.0,1.0); vec3 c = mix(bottom, top, pow(h,0.7));
      float s = max(dot(normalize(vDir), sunDir),0.0); c += vec3(1.0,0.95,0.8)*(pow(s,600.0)*2.0 + pow(s,12.0)*0.25)*sunGlow;
      gl_FragColor = vec4(c,1.0); }`,
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  G.scene.add(sky);
  G.sky = sky;
  G.scene.background = new THREE.Color(opts.skyBottom ?? 0xbfe0ff);
  G.map && (G.map.fogColor = opts.fog ?? opts.skyBottom);
  if (opts.fog !== null) setFog(opts.fog ?? opts.skyBottom ?? 0xbfe0ff, opts.fogScale ?? 1);
  else G.scene.fog = null;
}

// Keep the sun's shadow frustum centred on the camera.
export function updateEnvironment() {
  const cam = G.camera.getWorldPosition(new THREE.Vector3());
  if (sky) sky.position.copy(cam);
  if (sun) {
    const snap = 2;
    const cx = Math.round(cam.x / snap) * snap, cz = Math.round(cam.z / snap) * snap;
    sun.target.position.set(cx, 0, cz);
    sun.position.set(cx + G.sunDir.x * 150, G.sunDir.y * 150, cz + G.sunDir.z * 150);
  }
}

export function render() {
  const r = G.renderer;
  r.clear();
  r.render(G.scene, G.camera);
  if (G.showViewmodel) {
    r.clearDepth();
    r.render(G.vmScene, G.vmCamera);
  }
}

// ---- Shared materials / textures ----
const texCache = {};
export function canvasTexture(key, w, h, draw, repeat) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat, repeat);
  t.anisotropy = G.renderer ? G.renderer.capabilities.getMaxAnisotropy() : 4;
  texCache[key] = t;
  return t;
}

const matCache = {};
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (matCache[key]) return matCache[key];
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
  matCache[key] = m;
  return m;
}

// Noise helper for textures
export function noiseFill(ctx, w, h, base, amount, count = 4000, size = 2) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = (Math.random() - 0.5) * amount;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}
