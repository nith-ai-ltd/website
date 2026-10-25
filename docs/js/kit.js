// Shared pieces for the 3D test lab: colours, materials and shape helpers.
// Everything is drawn as a technical line drawing: solid faces in the paper colour, edges in ink.
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";

export { THREE };

export const PAL = {
  dark: { bg: new THREE.Color("#111111"), line: new THREE.Color("#E2E2E2"), face: new THREE.Color("#151515") },
  light: { bg: new THREE.Color("#ECECE9"), line: new THREE.Color("#1A1A1A"), face: new THREE.Color("#F8F8F6") },
};
export const ORANGE = new THREE.Color("#E85002");

const lineCol = PAL.dark.line.clone();
export const M = {
  face: new THREE.MeshBasicMaterial({ color: PAL.dark.face.clone(), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  line: new THREE.LineBasicMaterial({ color: lineCol.clone() }),
  faint: new THREE.LineBasicMaterial({ color: lineCol.clone(), transparent: true, opacity: 0.16, depthWrite: false }),
  mid: new THREE.LineBasicMaterial({ color: lineCol.clone(), transparent: true, opacity: 0.42, depthWrite: false }),
  hall: new THREE.LineBasicMaterial({ color: lineCol.clone(), transparent: true, opacity: 0.5, depthWrite: false }),
  ink: new THREE.MeshBasicMaterial({ color: lineCol.clone() }),
  decal: new THREE.MeshBasicMaterial({ color: lineCol.clone(), transparent: true, opacity: 0.55, depthWrite: false }),
  orange: new THREE.MeshBasicMaterial({ color: ORANGE, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  orangeLine: new THREE.LineBasicMaterial({ color: ORANGE }),
  dash: new THREE.LineDashedMaterial({ color: ORANGE, dashSize: 0.22, gapSize: 0.16 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
};
const INKED = [M.line, M.faint, M.mid, M.hall, M.ink, M.decal];
// extra materials that should follow the ink colour when the lights change
export function inked(mat) { INKED.push(mat); return mat; }

// 0 = lights off (the maker's dark demo), 1 = lights on (the bright lab)
export function setLights(scene, t) {
  scene.background.lerpColors(PAL.dark.bg, PAL.light.bg, t);
  scene.fog.color.copy(scene.background);
  M.face.color.lerpColors(PAL.dark.face, PAL.light.face, t);
  lineCol.lerpColors(PAL.dark.line, PAL.light.line, t);
  for (const m of INKED) m.color.copy(lineCol);
  M.glow.opacity = 0.07 * (1 - t);
}

// position, rotation (radians) and scale, as one matrix
export function at(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")),
    new THREE.Vector3(s, s, s),
  );
}

// ---------- static scenery is merged into a few big meshes, so the lab draws fast
export class Batch {
  constructor() { this.faces = []; this.edges = {}; this.marks = []; }
  // a solid: faces in the paper colour plus its edges in the given line material
  add(geo, m, { mat = "line", thr = 24, faces = true } = {}) {
    geo.applyMatrix4(m);
    if (faces) this.faces.push(geo.index ? geo.toNonIndexed() : geo);
    this.lines(Array.from(new THREE.EdgesGeometry(geo, thr).attributes.position.array), mat);
    return this;
  }
  box(w, h, d, m, o) { return this.add(new THREE.BoxGeometry(w, h, d), m, o); }
  cyl(rt, rb, h, seg, m, o) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, o); }
  // loose line segments, as a flat list of x, y, z pairs
  lines(arr, mat = "line") { (this.edges[mat] ||= []).push(...arr); return this; }
  // orange faces, for things that matter
  mark(geo, m) { geo.applyMatrix4(m); this.marks.push(geo.index ? geo.toNonIndexed() : geo); return this; }
  build(parent) {
    const out = {};
    const merge = (list) => {
      let n = 0;
      for (const g of list) n += g.attributes.position.array.length;
      const a = new Float32Array(n);
      let o = 0;
      for (const g of list) { a.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(a, 3));
      return geo;
    };
    if (this.faces.length) parent.add((out.faces = new THREE.Mesh(merge(this.faces), M.face)));
    if (this.marks.length) parent.add((out.marks = new THREE.Mesh(merge(this.marks), M.orange)));
    for (const k in this.edges) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.edges[k]), 3));
      parent.add((out[k] = new THREE.LineSegments(geo, M[k])));
    }
    return out;
  }
}

// ---------- moving parts stay separate: one mesh plus its edges
export function part(geo, parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, face = M.face, line = M.line, thr = 24 } = {}) {
  const g = new THREE.Group();
  g.userData.part = true;
  if (face) g.add(new THREE.Mesh(geo, face));
  if (line) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, thr), line));
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  parent.add(g);
  return g;
}
export const pbox = (w, h, d, parent, o) => part(new THREE.BoxGeometry(w, h, d), parent, o);
export const pcyl = (rt, rb, h, seg, parent, o) => part(new THREE.CylinderGeometry(rt, rb, h, seg), parent, o);

// a joint: an empty group that children hang from
export function joint(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// swap a line-drawn model for a 3D one made in Blender: each named piece of the loaded file goes onto its
// joint and that joint's line-drawn parts are removed. Child joints stay, so the motion code is unchanged.
// With pivots, each joint also moves to where that piece's joint is in the file (people come in different sizes).
export function skin(model, map, pivots = false) {
  const pieces = Object.keys(map).map((name) => [map[name], model.getObjectByName(name)]);
  for (const [j, piece] of pieces) {
    if (!j || !piece) continue;
    for (const c of [...j.children]) if (c.userData.part) j.remove(c);
    if (pivots) j.position.copy(piece.position);
    j.add(piece);
    piece.position.set(0, 0, 0);
    piece.quaternion.identity();
  }
}

// load a 3D model file once; every caller gets its own copy of it
const modelFiles = new Map(), gltf = new GLTFLoader();
export function loadModel(url) {
  if (!modelFiles.has(url)) modelFiles.set(url, gltf.loadAsync(url));
  return modelFiles.get(url).then((g) => g.scene.clone(true));
}

export function lineObj(points, parent, mat = M.line) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const l = new THREE.Line(geo, mat);
  if (mat.isLineDashedMaterial) l.computeLineDistances();
  parent.add(l);
  return l;
}

// ---------- flat things with words or drawings on them, made from a 2D canvas
// (all of them redraw once the web font has loaded)
export const CANVASES = [];
export function canvasPlane(w, h, px, draw, parent, { transparent = false, mat = null } = {}) {
  const c = document.createElement("canvas");
  c.width = px;
  c.height = Math.round((px * h) / w);
  const ctx = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const material = mat || new THREE.MeshBasicMaterial({ map: tex, transparent, depthWrite: !transparent });
  if (mat) material.map = tex;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  parent.add(mesh);
  const redraw = (...args) => { ctx.clearRect(0, 0, c.width, c.height); draw(ctx, c.width, c.height, ...args); tex.needsUpdate = true; };
  redraw();
  CANVASES.push(redraw);
  return { mesh, redraw };
}

export const FONT = (w, px) => `${w} ${px}px Archivo, system-ui, sans-serif`;
export const MONO = (w, px) => `${w} ${px}px ui-monospace, "SF Mono", Menlo, monospace`;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
