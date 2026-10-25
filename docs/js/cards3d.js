// The robot cards: each card shows one of the film's own 3D robots, alive in its own way. The robot arm reaches
// for the mouse while its base stays put, the humanoid turns its upper body through a full circle, the robot hand
// waves hello, and the delivery robot turns on the spot. One shared WebGL renderer draws all four into their own
// canvases, and a card only draws while it is on screen.
import { THREE, loadModel } from "./kit.js?v=13";
import { RoomEnvironment } from "../vendor/three/examples/jsm/environments/RoomEnvironment.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

// ---------- the mouse (or a finger), anywhere on the page
const pointer = { x: 0, y: 0, at: -1e9, mouse: false, inside: false };
addEventListener("pointermove", (e) => {
  Object.assign(pointer, { x: e.clientX, y: e.clientY, at: performance.now(), mouse: e.pointerType === "mouse", inside: true });
}, { passive: true });
addEventListener("mouseout", (e) => { if (!e.relatedTarget) pointer.inside = false; });
// a mouse is followed while it is in the window; a finger for a moment after it last moved
const following = (now) => (pointer.mouse ? pointer.inside : now - pointer.at < 2500);

// ---------- each robot: how it is set up, framed and moved
const shadow = (w, d) => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,.3)");
  r.addColorStop(0.55, "rgba(0,0,0,.1)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
};

const ROBOTS = {
  // the arm reaches for the pointer: a ray from the camera through the pointer meets a plane just in front of the
  // base, and the same arm maths as the film turns that point into joint angles (the gripper points down)
  arm: { file: "models/cobot.glb", setup(model, card) {
    const J = (n) => model.getObjectByName(n);
    const turret = J("arm_turret"), shoulder = J("arm_shoulder"), elbow = J("arm_elbow"), wrist = J("arm_wrist");
    J("arm_finger_n").position.x = -0.034;
    J("arm_finger_p").position.x = 0.034;
    const L1 = 0.55, L2 = 0.5, LW = 0.17, SH = 0.46, PLANE = 0.12;
    function reach(tx, ty, tz) {
      const r = Math.max(0.05, Math.hypot(tx, tz)), dy = ty + LW - SH;
      const d = Math.min(Math.hypot(r, dy), L1 + L2 - 1e-3), phi = Math.atan2(r, dy);
      const a1 = phi - Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
      turret.rotation.y = Math.atan2(-tz, tx);
      shoulder.rotation.z = -a1;
      elbow.rotation.z = -bend;
      wrist.rotation.z = -(Math.PI - a1 - bend);
    }
    const goal = V(0.62, 0.62, PLANE), cur = goal.clone();
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(V(0, 0, 1), -PLANE), hit = V(), ndc = new THREE.Vector2();
    // keep the goal where the arm can reach it, and never over its own base
    const tidy = () => {
      const r = Math.hypot(goal.x, goal.z), k = clamp(r, 0.36, 0.8) / Math.max(r, 1e-6);
      goal.x *= k;
      goal.z *= k;
      goal.y = clamp(goal.y, 0.1, 1.05);
    };
    tidy();
    reach(cur.x, cur.y, cur.z);
    return {
      shadow: shadow(0.62, 0.62),
      box: new THREE.Box3(V(-0.86, 0, -0.22), V(0.86, 1.36, 0.5)),
      dir: V(0.2, 0.3, 1).normalize(),
      update(t, dt, now) {
        if (following(now)) {
          const b = card.canvas.getBoundingClientRect();
          ndc.set(((pointer.x - b.left) / b.width) * 2 - 1, -(((pointer.y - b.top) / b.height) * 2 - 1));
          ray.setFromCamera(ndc, card.camera);
          if (ray.ray.intersectPlane(plane, hit)) goal.set(hit.x, hit.y, PLANE);
        } else {
          goal.set(0.62 * Math.cos(t * 0.55), 0.62 + 0.28 * Math.sin(t * 1.1), PLANE);
        }
        tidy();
        cur.lerp(goal, 1 - Math.exp(-dt * 7));
        reach(cur.x, cur.y, cur.z);
      },
    };
  } },

  // the humanoid's legs stay planted while its upper body turns a full circle on the waist joint, then pauses
  humanoid: { file: "models/humanoid.glb", setup(model) {
    const waist = model.getObjectByName("hum_waist");
    return {
      shadow: shadow(0.75, 0.5),
      box: new THREE.Box3(V(-0.34, 0, -0.34), V(0.34, 1.77, 0.34)),
      dir: V(0.5, 0.26, 1).normalize(),
      update(t) {
        const u = (t % 4.6) / 4.6;
        if (waist) waist.rotation.y = Math.PI * 2 * smooth(clamp(u / 0.74, 0, 1));
      },
    };
  } },

  // the robot hand, lifted off the lab robot: fingers up, palm to the viewer, waving hello from the wrist
  hand: { file: "models/lab-robot.glb", setup(model) {
    const wrist = model.getObjectByName("R_wrist");
    for (let f = 1; f <= 4; f++) for (let j = 1; j <= 3; j++) {
      const o = wrist.getObjectByName(`R_f${f}_${j}`);
      if (o) o.rotation.z = [0.06, 0.08, 0.06][j - 1];
    }
    for (const n of ["R_t_2", "R_t_3"]) { const o = wrist.getObjectByName(n); if (o) o.rotation.z = 0.08; }
    model.updateMatrixWorld(true);
    const pivot = new THREE.Group();
    model.add(pivot);
    wrist.getWorldPosition(pivot.position);
    pivot.updateMatrixWorld(true);
    pivot.attach(wrist);
    model.remove(pivot);
    pivot.position.set(0, 0, 0);
    // on the robot the hand hangs fingers-down with its palm inward; turn it fingers-up, palm to the viewer
    const orient = new THREE.Group();
    orient.rotation.set(0, Math.PI / 2, Math.PI, "YXZ");
    orient.add(pivot);
    const wave = new THREE.Group();
    wave.add(orient);
    wave.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(wave).expandByVector(V(0.085, 0.012, 0.01));
    let waveAt = -10;
    return {
      root: wave,
      box,
      dir: V(0.3, 0.12, 1).normalize(),
      hello(t) { if (t - waveAt > 2) waveAt = t; },
      update(t) {
        if (t - waveAt > 6.4) waveAt = t;
        const w = t - waveAt, amp = w < 1.9 ? Math.sin(Math.PI * clamp(w / 1.9, 0, 1)) : 0;
        wave.rotation.z = 0.36 * amp * Math.sin(w * Math.PI * 2 * 2.1);
      },
    };
  } },

  // the delivery robot turns on the spot
  mobile: { file: "models/amr.glb", setup(model) {
    model.rotation.y = -0.6;
    return {
      shadow: shadow(1.3, 1.3),
      box: new THREE.Box3(V(-0.56, 0, -0.56), V(0.56, 0.95, 0.56)),
      dir: V(0.62, 0.42, 1).normalize(),
      update(t) { model.rotation.y = -0.6 + t * 0.45; },
    };
  } },
};

// ---------- one shared renderer, drawn into each card's canvas
let gl = null, env = null, glW = 0, glH = 0;
function renderer() {
  if (!gl) {
    gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    gl.setClearColor(0x000000, 0);
    env = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
  }
  return gl;
}

// fit the camera so the whole of a box (everywhere the robot can move) stays inside the frame, centred
const corners = (b) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => V(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
function frame(camera, box, dir, pad = 0.88) {
  const pts = corners(box), target = box.getCenter(V()), v = V(), right = V(), up = V();
  const place = (d) => { camera.position.copy(target).addScaledVector(dir, d); camera.lookAt(target); camera.updateMatrixWorld(); };
  for (let pass = 0; pass < 3; pass++) {
    let lo = 0.05, hi = 80;
    for (let i = 0; i < 40; i++) {
      const d = (lo + hi) / 2;
      place(d);
      const ok = pts.every((p) => { v.copy(p).project(camera); return v.z < 1 && Math.abs(v.x) <= pad && Math.abs(v.y) <= pad; });
      if (ok) hi = d; else lo = d;
    }
    place(hi);
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of pts) { v.copy(p).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const hh = Math.tan((camera.fov * Math.PI) / 360) * hi;
    target.addScaledVector(right, ((x0 + x1) / 2) * hh * camera.aspect).addScaledVector(up, ((y0 + y1) / 2) * hh);
  }
}

class Card {
  constructor(el, key) {
    this.el = el;
    this.key = key;
    this.canvas = document.createElement("canvas");
    el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.scene = new THREE.Scene();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.6;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xbdbdbd, 1.4));
    const key1 = new THREE.DirectionalLight(0xffffff, 1.6);
    key1.position.set(-2, 4, 3);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(3, 2, -3);
    this.scene.add(key1, rim);
    this.camera = new THREE.PerspectiveCamera(24, 1.2, 0.01, 80);
    this.bot = null;
    this.visible = false;
    this.dirty = true;
    this.t0 = 0;
    loadModel(ROBOTS[key].file).then((model) => {
      this.bot = ROBOTS[key].setup(model, this);
      this.scene.add(this.bot.root || model);
      if (this.bot.shadow) this.scene.add(this.bot.shadow);
      this.resize();
      this.t0 = clock();                       // each robot starts its motion from the pose in its still picture
      el.classList.add("live");
    });
    const host = el.closest(".card") || el;
    host.addEventListener("pointerenter", () => this.bot?.hello?.(this.time()));
    new ResizeObserver(() => this.resize()).observe(el);
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !this.visible) this.bot?.hello?.(this.time());
      this.visible = e.isIntersecting;
    }).observe(el);
  }
  time() { return clock() - this.t0; }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(this.el.clientWidth * dpr), h = Math.round(this.el.clientHeight * dpr);
    if (!w || !h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.bot) frame(this.camera, this.bot.box, this.bot.dir);
    this.dirty = true;
  }
  draw() {
    const r = renderer(), w = this.canvas.width, h = this.canvas.height;
    if (w !== glW || h !== glH) { r.setSize(w, h, false); glW = w; glH = h; }
    r.render(this.scene, this.camera);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(r.domElement, 0, 0);
    this.dirty = false;
  }
}

const start = performance.now();
const clock = () => (performance.now() - start) / 1000;
let cards = [];
try {
  renderer();
  cards = [...document.querySelectorAll("[data-robot]")].map((el) => new Card(el, el.dataset.robot));
} catch (err) {
  // no WebGL: the still pictures stay in place
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const c of cards) {
    if (!c.bot || !c.visible) continue;
    if (!reduce) c.bot.update(c.time(), dt, now);
    else if (!c.dirty) continue;
    c.draw();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
