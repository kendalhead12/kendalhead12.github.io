// Procedural humanoid models. Every bone's rest orientation is identity, so the
// same segment table drives both the animated model and the ragdoll bodies.
import * as THREE from 'three';
import { mat } from '../render.js';

const geoCache = {};
function cached(key, make) { return geoCache[key] || (geoCache[key] = make()); }
const capsuleGeo = (r, len) => cached(`c${r.toFixed(3)}_${len.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 10));
const boxGeo = (x, y, z) => cached(`b${x.toFixed(3)}_${y.toFixed(3)}_${z.toFixed(3)}`, () => new THREE.BoxGeometry(x, y, z));
const sphereGeo = (r, ws = 16) => cached(`s${r.toFixed(3)}_${ws}`, () => new THREE.SphereGeometry(r, ws, Math.max(8, ws * 0.75)));

// ---- Face textures (shared by all humanoids) ----
const faces = {};
export function faceTexture(kind) {
  if (faces[kind]) return faces[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.lineCap = 'round'; x.lineJoin = 'round';
  const eye = (cx, cy, r, col = '#1a1a1a') => { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx, cy, r * 1.25, r, 0, 0, 6.3); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r * 0.62, 0, 6.3); x.fill(); };
  const line = (pts, w = 5, col = '#3a2018') => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke(); };
  const curve = (x0, y0, cx, cy, x1, y1, w = 5, col = '#5a2a20') => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(cx, cy, x1, y1); x.stroke(); };
  switch (kind) {
    case 'neutral':
      eye(42, 54, 9); eye(86, 54, 9); line([30, 38, 52, 38], 5); line([76, 38, 98, 38], 5); curve(48, 92, 64, 98, 80, 92); break;
    case 'happy':
      eye(42, 54, 9); eye(86, 54, 9); curve(30, 38, 42, 32, 54, 38); curve(74, 38, 86, 32, 98, 38); curve(42, 88, 64, 108, 86, 88, 6); break;
    case 'angry':
      eye(42, 58, 8, '#300'); eye(86, 58, 8, '#300'); line([28, 36, 56, 48], 7, '#2a1510'); line([100, 36, 72, 48], 7, '#2a1510');
      x.fillStyle = '#4a1010'; x.beginPath(); x.ellipse(64, 96, 16, 7, 0, 0, 6.3); x.fill(); line([50, 93, 78, 93], 3, '#fff'); break;
    case 'scared':
      eye(42, 52, 11); eye(86, 52, 11); curve(28, 34, 40, 24, 54, 32, 5); curve(74, 32, 88, 24, 100, 34, 5);
      x.fillStyle = '#3a0d0d'; x.beginPath(); x.ellipse(64, 98, 12, 15, 0, 0, 6.3); x.fill(); break;
    case 'pain':
      line([32, 48, 52, 58, 32, 64], 6, '#1a1a1a'); line([96, 48, 76, 58, 96, 64], 6, '#1a1a1a');
      x.fillStyle = '#3a0d0d'; x.beginPath(); x.ellipse(64, 96, 14, 10, 0, 0, 6.3); x.fill(); break;
    case 'dead':
      line([32, 44, 52, 64], 6, '#1a1a1a'); line([52, 44, 32, 64], 6, '#1a1a1a'); line([76, 44, 96, 64], 6, '#1a1a1a'); line([96, 44, 76, 64], 6, '#1a1a1a');
      line([50, 96, 78, 92], 5); break;
    case 'zombie':
      x.fillStyle = '#e8f0c8'; x.beginPath(); x.arc(42, 54, 10, 0, 6.3); x.arc(86, 54, 9, 0, 6.3); x.fill();
      x.fillStyle = '#9a1010'; x.beginPath(); x.arc(42, 54, 2.5, 0, 6.3); x.arc(86, 54, 2.5, 0, 6.3); x.fill();
      line([28, 40, 54, 44], 5, '#2a3018'); line([100, 38, 74, 44], 5, '#2a3018');
      x.fillStyle = '#2a0a08'; x.beginPath(); x.moveTo(44, 90); x.lineTo(86, 88); x.lineTo(80, 106); x.lineTo(50, 108); x.closePath(); x.fill();
      x.fillStyle = '#d8d0a0'; for (let i = 0; i < 5; i++) x.fillRect(48 + i * 7, 89, 4, 6); break;
    case 'dummy':
      x.strokeStyle = 'rgba(60,40,20,0.5)'; x.lineWidth = 4; x.beginPath(); x.arc(42, 54, 8, 0, 6.3); x.stroke(); x.beginPath(); x.arc(86, 54, 8, 0, 6.3); x.stroke(); line([50, 94, 78, 94], 4, 'rgba(60,40,20,0.5)'); break;
    case 'skull':
      x.fillStyle = '#111'; x.beginPath(); x.ellipse(42, 56, 13, 15, 0, 0, 6.3); x.ellipse(86, 56, 13, 15, 0, 0, 6.3); x.fill();
      x.fillStyle = '#ff5522'; x.beginPath(); x.arc(42, 58, 3.5, 0, 6.3); x.arc(86, 58, 3.5, 0, 6.3); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.moveTo(64, 70); x.lineTo(58, 82); x.lineTo(70, 82); x.closePath(); x.fill();
      for (let i = 0; i < 6; i++) { x.fillRect(44 + i * 7, 94, 3, 12); } line([42, 94, 86, 94], 3, '#111'); line([42, 106, 86, 106], 3, '#111'); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  faces[kind] = t;
  return t;
}
const faceMats = {};
export function faceMaterial(kind) {
  return faceMats[kind] || (faceMats[kind] = new THREE.MeshStandardMaterial({ map: faceTexture(kind), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// ---- Humanoid builder ----
const DEF = {
  scale: 1, hipH: 0.92, thigh: 0.44, shin: 0.43, waist: 0.14, torso: 0.48, neck: 0.05, headR: 0.115,
  uArm: 0.29, lArm: 0.27, shoulderW: 0.21, hipW: 0.095, torsoW: 0.36, torsoD: 0.2,
  thighR: 0.075, shinR: 0.06, uArmR: 0.052, lArmR: 0.045, mass: 70,
  skin: 0xe0ac85, shirt: 0x3b6fb0, pants: 0x2f3542, shoes: 0x222222, hair: 0x3a2a1a,
  sleeves: 'short', hairStyle: 'short', face: 'neutral', belly: 0,
};

export function buildHumanoid(specIn) {
  const s = { ...DEF, ...specIn };
  const k = s.scale;
  const L = (v) => v * k;
  const root = new THREE.Group();
  const bones = {};
  const segments = [];
  const meshes = [];
  const M = (c, extra) => mat(c, extra);

  const addMesh = (bone, geo, material, pos, rot, castShadow = true) => {
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = castShadow; m.receiveShadow = false;
    bone.add(m); meshes.push(m);
    return m;
  };
  const bone = (name, parent, x, y, z) => {
    const b = new THREE.Group(); b.name = name;
    b.position.set(x, y, z);
    (parent || root).add(b);
    b.userData.rest = b.position.clone();
    bones[name] = b;
    return b;
  };
  // shape: {type:'box', hx,hy,hz} | {type:'capsule', r, len} | {type:'ball', r}
  const seg = (name, parent, center, shape, massFrac, kind) => {
    segments.push({ name, parent, center: new THREE.Vector3(...center), shape, massFrac, kind: kind || 'spherical' });
  };

  const hipH = L(s.hipH), thigh = L(s.thigh), shin = L(s.shin), waist = L(s.waist), torso = L(s.torso);
  const headR = L(s.headR), uArm = L(s.uArm), lArm = L(s.lArm), sw = L(s.shoulderW), hw = L(s.hipW);
  const tw = L(s.torsoW), td = L(s.torsoD) * (1 + s.belly);
  const skin = M(s.skin), shirt = M(s.shirt), pants = M(s.pants), shoes = M(s.shoes, { roughness: 0.5 });

  // Pelvis
  const pelvis = bone('pelvis', root, 0, hipH, 0);
  addMesh(pelvis, boxGeo(tw * 0.92, waist + L(0.06), td * 0.95), pants, [0, waist / 2 - L(0.02), 0]);
  seg('pelvis', null, [0, waist / 2 - L(0.02), 0], { type: 'box', hx: tw * 0.45, hy: (waist + L(0.06)) / 2, hz: td * 0.47 }, 0.15);

  // Chest
  const chest = bone('chest', pelvis, 0, waist, 0);
  const torsoMesh = addMesh(chest, boxGeo(tw, torso, td), shirt, [0, torso / 2, 0]);
  if (s.belly > 0) addMesh(chest, sphereGeo(td * 0.55), shirt, [0, torso * 0.3, td * 0.15]);
  seg('chest', 'pelvis', [0, torso / 2, 0], { type: 'box', hx: tw / 2, hy: torso / 2, hz: td / 2 }, 0.3, 'spine');

  // Head
  const head = bone('head', chest, 0, torso + L(s.neck), 0);
  addMesh(head, capsuleGeo(headR * 0.42, L(s.neck) + headR * 0.6), skin, [0, -L(s.neck) * 0.2, 0], null, false);
  const skull = addMesh(head, sphereGeo(headR, 18), skin, [0, headR, 0]);
  skull.scale.set(0.92, 1.08, 0.98);
  const face = new THREE.Mesh(cached('faceplane', () => new THREE.PlaneGeometry(1, 1)), faceMaterial(s.face));
  face.scale.setScalar(headR * 1.55);
  face.position.set(0, headR * 0.98, headR * 0.93);
  head.add(face);
  if (s.nose !== false) addMesh(head, boxGeo(headR * 0.22, headR * 0.3, headR * 0.25), skin, [0, headR * 0.9, headR * 0.98], null, false);
  if (s.hairStyle !== 'none') {
    const hair = M(s.hair, { roughness: 0.95 });
    const cap = addMesh(head, cached(`hair${headR.toFixed(3)}`, () => new THREE.SphereGeometry(headR * 1.06, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)), hair, [0, headR * 1.08, -headR * 0.06], [-0.25, 0, 0], false);
    if (s.hairStyle === 'long') addMesh(head, boxGeo(headR * 1.9, headR * 1.3, headR * 0.5), hair, [0, headR * 0.55, -headR * 0.75], null, false);
    if (s.hairStyle === 'cap') { cap.material = M(s.capColor || 0xaa2222); addMesh(head, boxGeo(headR * 1.5, headR * 0.12, headR * 0.9), cap.material, [0, headR * 1.38, headR * 0.75]); }
    if (s.hairStyle === 'helmet') { cap.material = M(s.capColor || 0xf2c200, { roughness: 0.4 }); cap.scale.setScalar(1.12); }
  }
  seg('head', 'chest', [0, headR, 0], { type: 'ball', r: headR * 1.05 }, 0.08, 'neck');

  // Arms
  for (const side of [1, -1]) {
    const n = side > 0 ? 'L' : 'R';
    const ua = bone('uArm' + n, chest, side * sw, torso - L(0.05), 0);
    const r1 = L(s.uArmR), r2 = L(s.lArmR);
    addMesh(ua, capsuleGeo(r1 * 1.15, L(0.12)), shirt, [0, -L(0.02), 0], null, false); // shoulder
    addMesh(ua, capsuleGeo(r1, uArm), s.sleeves === 'none' ? skin : shirt, [0, -uArm / 2, 0]);
    seg('uArm' + n, 'chest', [0, -uArm / 2, 0], { type: 'capsule', r: r1, len: uArm }, 0.03, 'shoulder');
    const la = bone('lArm' + n, ua, 0, -uArm, 0);
    addMesh(la, capsuleGeo(r2, lArm), s.sleeves === 'long' ? shirt : skin, [0, -lArm / 2, 0]);
    const hand = addMesh(la, boxGeo(r2 * 1.7, L(0.09), r2 * 1.1), skin, [0, -lArm - L(0.035), 0], null, false);
    hand.name = 'hand';
    seg('lArm' + n, 'uArm' + n, [0, -lArm / 2 - L(0.02), 0], { type: 'capsule', r: r2, len: lArm + L(0.05) }, 0.025, 'elbow');
    bones['hand' + n] = la;
  }

  // Legs
  for (const side of [1, -1]) {
    const n = side > 0 ? 'L' : 'R';
    const th = bone('thigh' + n, pelvis, side * hw, 0, 0);
    const r1 = L(s.thighR), r2 = L(s.shinR);
    addMesh(th, capsuleGeo(r1, thigh + r1), pants, [0, -thigh / 2, 0]);
    seg('thigh' + n, 'pelvis', [0, -thigh / 2, 0], { type: 'capsule', r: r1, len: thigh }, 0.1, 'hip');
    const sh = bone('shin' + n, th, 0, -thigh, 0);
    addMesh(sh, capsuleGeo(r2, shin), pants, [0, -shin / 2, 0]);
    addMesh(sh, boxGeo(r2 * 1.9, L(0.07), L(0.24)), shoes, [0, -shin - L(0.005), L(0.05)], null, false);
    seg('shin' + n, 'thigh' + n, [0, -shin / 2 - L(0.01), 0], { type: 'capsule', r: r2, len: shin + L(0.04) }, 0.055, 'knee');
  }

  root.userData.isRig = true;
  const rig = {
    root, bones, segments, meshes, face, spec: s, scale: k,
    height: hipH + waist + torso + L(s.neck) + headR * 2,
    headR, mass: s.mass, torsoMesh,
    setFace(kind) { if (this.faceKind !== kind) { this.faceKind = kind; face.material = faceMaterial(kind); } },
    reset() {
      for (const n in bones) { const b = bones[n]; b.rotation.set(0, 0, 0); if (b.userData.rest) b.position.copy(b.userData.rest); }
    },
  };
  rig.faceKind = s.face;
  if (s.extras) s.extras(rig, { addMesh, M, L, boxGeo, capsuleGeo, sphereGeo });
  return rig;
}

export { boxGeo, capsuleGeo, sphereGeo };
