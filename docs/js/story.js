// The scroll story: one camera flies through the 3D test lab in twelve shots.
// Scrolling moves the camera along a path; each bay plays its failure while the camera is there.
import { THREE, M, PAL, setLights, inked, CANVASES, clamp, seg, lerp, ease } from "./kit.js?v=13";
import { buildLab } from "./lab.js?v=24";
import { RoomEnvironment } from "../vendor/three/examples/jsm/environments/RoomEnvironment.js";

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const story = $("#story"), frame = $("#frame"), canvas = $("#world"), nav = $("#nav");

// ---------- the twelve shots: where the camera arrives (A) and where it drifts to (B)
// [position], [looks at], field of view; fog [near, far]; shift = how far right the subject sits
const SHOTS = [
  // the first screen: the maker's spotlit demo, to the right of the words (close fog hides the far bays)
  { name: "Cold open", s: 0, e: 0.05, fly: 0, A: [[1.55, 2.5, 15.2], [-0.3, 1, 6.3], 30], B: [[1.45, 2.45, 14.9], [-0.3, 1, 6.3], 30], fog: [8, 15], shift: 0.32 },
  { name: "The demo", s: 0.05, e: 0.12, fly: 0.25, A: [[1.4, 2.4, 14.6], [-0.3, 1, 6.3], 30], B: [[0.5, 1.75, 10.6], [-0.3, 1.05, 6.3], 30], fog: [8, 19], shift: 0.06 },
  { name: "Lights on", s: 0.12, e: 0.2, fly: 0.3, A: [[7, 9, 31], [0, 1.5, -6], 42], B: [[-5, 13.5, 34], [0, 0, -8], 44], fog: [40, 135], shift: 0 },
  { name: "Bay 01 · Grocery packing", bay: "packing", s: 0.2, e: 0.3, fly: 0.25, via: [[-23.0, 2.2, 3.0], [-17.0, 0.9, 0.2]],
    // swoop down to the end of the conveyor and dolly along it; close on the shiny packet as it's pinched; then, in
    // slow motion, ride along with the gripper (0.83 m out and ahead of it) as the bag slips through its fingers; let it
    // drop out of frame as the empty gripper swings on; find it on the floor; crane up as the arm packs an empty crate
    A: [[-21.5, 1.15, 0.9], [-16.0, 0.95, 0.2], 36],
    mid: [[0.18, [-17.0, 1.32, 1.1], [-15.95, 1.0, 0.05], 30],
      [0.37, [-16.828, 1.08, 0.848], [-16.107, 1.14, 0.441], 36], [0.441, [-16.683, 1.075, 1.265], [-16.105, 1.135, 0.672], 36],
      [0.512, [-16.397, 1.07, 1.654], [-16.029, 1.13, 0.913], 36], [0.583, [-15.987, 1.065, 1.946], [-15.875, 1.125, 1.126], 36],
      [0.632, [-15.93, 1.06, 2.03], [-15.8, 1.08, 1.2], 37], [0.665, [-16.1, 0.72, 2.12], [-15.8, 0.12, 1.27], 38],
      [0.73, [-16.35, 0.32, 1.95], [-15.77, 0.08, 1.27], 36], [0.8, [-16.6, 0.5, 2.65], [-15.8, 0.22, 1.1], 42]],
    B: [[-18.2, 2.5, 3.6], [-15.3, 0.55, 0.75], 36], fog: [16, 70], shift: 0.12 },
  { name: "Bay 02 · Carrying parts", bay: "humanoid", s: 0.3, e: 0.4, fly: 0.25, via: [[-15.65, 1.1, -17.3], [-17.0, 1.2, -21.0]],
    // round the table into a low shot up the aisle as the robot walks at us; from its side as its tote meets the stray
    // box; hold on it, tote and box together, as it looks along the shelves; pull back as a person pulls the box out;
    // crane up
    A: [[-17.4, 0.62, -17.0], [-16.5, 1.25, -22.0], 42],
    mid: [[0.4, [-16.75, 1.55, -18.2], [-15.45, 1.3, -20.65], 42], [0.56, [-17.1, 1.8, -18.75], [-15.6, 1.55, -20.65], 40],
      [0.72, [-17.9, 1.65, -17.8], [-15.5, 1.3, -20.3], 40]],
    B: [[-18.5, 3.0, -16.9], [-15.4, 0.9, -20.4], 38], fog: [14, 66], shift: 0.12 },
  { name: "Bay 03 · Picking a tool", bay: "hand", s: 0.4, e: 0.49, fly: 0.25, via: [[0, 7, -11], [12, 1, -20]],
    // wide on the robot, an arc round and down as it reaches, table height for the pinch, then rising as it lifts
    A: [[18.05, 1.65, -18.67], [17.05, 1.2, -20.42], 40],
    mid: [[0.22, [17.55, 1.28, -19.07], [17.0, 1.04, -20.27], 36], [0.45, [16.65, 1.0, -19.34], [16.9, 0.94, -20.22], 33]],
    B: [[17.48, 1.38, -19.2], [17.02, 1.12, -20.24], 37], fog: [5, 38], shift: 0.12 },
  { name: "Bay 04 · Hospital delivery", bay: "rover", s: 0.49, e: 0.58, fly: 0.25, via: [[15.6, 7, -4.5], [17, 0.6, -11.5]],
    // wide behind the robot, a low chase, up over the door, then waiting on the far side of the glass for the crash
    A: [[16.0, 4.6, 9.6], [16.85, 0.35, 1.8], 40],
    mid: [[0.14, [18.2, 1.15, 6.3], [16.65, 0.5, 1.4], 36], [0.28, [18.3, 3.1, -0.6], [16.7, 0.4, 2.0], 34],
      [0.4, [17.75, 0.8, -2.9], [16.65, 0.55, 0.5], 32], [0.62, [17.6, 0.75, -2.6], [16.65, 0.6, -0.2], 30]],
    B: [[19.0, 4.2, -5.4], [16.8, 0.4, -0.3], 38], fog: [18, 70], shift: 0.12 },
  { name: "1,000 runs", s: 0.58, e: 0.67, fly: 0.3, A: [[40, 75, 70], [0, 0, -10], 42], B: [[-60, 140, 110], [0, 0, -10], 42], fog: [120, 520], shift: 0.04 },
  { name: "The evidence", s: 0.67, e: 0.75, fly: 0.3, A: [[0, 3.4, -13.5], [0, 3.1, -24], 40], B: [[0, 3.2, -17.2], [0, 3, -24], 40], fog: [30, 110], shift: 0 },
  { name: "The score", s: 0.75, e: 0.83, fly: 0.3, A: [[16, 7, 24], [0, 1.5, -6], 40], B: [[6, 7.5, 27], [0, 1.5, -6], 40], fog: [40, 140], shift: 0.22 },
  { name: "Retest", s: 0.83, e: 0.9, fly: 0.3, A: [[-4, 8, 27.5], [0, 1.5, -6], 40], B: [[-14, 9, 24], [0, 1.5, -6], 40], fog: [40, 140], shift: 0.22 },
  { name: "NITH", s: 0.9, e: 1, fly: 0.4, A: [[0, 46, 44], [0, 11, -9], 40], B: [[0, 60, 50], [0, 11, -9], 38], fog: [60, 230], shift: 0 },
];
SHOTS.forEach((s) => { s.h = s.s + s.fly * (s.e - s.s); });
const KF = [], PTS = [], TGT = [];
SHOTS.forEach((s, k) => {
  const v = (a) => new THREE.Vector3(...a);
  if (s.via) { PTS.push(v(s.via[0])); TGT.push(v(s.via[1])); }
  KF.push({ p: s.h, si: PTS.length, fov: s.A[2], fog: s.fog, shift: s.shift, k });
  PTS.push(v(s.A[0])); TGT.push(v(s.A[1]));
  // extra camera stops inside a shot, for moves that arc instead of going straight
  for (const [t, pos, tgt, fov] of s.mid || []) {
    KF.push({ p: s.h + t * (s.e - s.h), si: PTS.length, fov, fog: s.fog, shift: s.shift, k });
    PTS.push(v(pos)); TGT.push(v(tgt));
  }
  KF.push({ p: s.e, si: PTS.length, fov: s.B[2], fog: s.fog, shift: s.shift, k });
  PTS.push(v(s.B[0])); TGT.push(v(s.B[1]));
});
const posCurve = new THREE.CatmullRomCurve3(PTS, false, "centripetal");
const tgtCurve = new THREE.CatmullRomCurve3(TGT, false, "centripetal");

// a smooth curve through points (x rising) that never overshoots between them (monotone cubic, Fritsch-Carlson).
// The camera's timing runs through every stop on one of these, so it never halts and lurches on arriving at a bay
// or leaving it; the same goes for the hands-free play's pace from shot to shot.
// rest: start and end at a standstill (for the hands-free play, which eases in and out)
function smoothThrough(xs, ys, rest = false) {
  const n = xs.length, h = [], d = [], m = [];
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = rest ? 0 : d[0];
  m[n - 1] = rest ? 0 : d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return (x) => {
    x = clamp(x, xs[0], xs[n - 1]);
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (3 * t2 - 2 * t3) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
const kp = KF.map((k) => k.p);
// the camera's timing runs on distance along each path (not on the spacing of its points), so its speed stays smooth
// past the points that shape a flight as well as at every stop
posCurve.arcLengthDivisions = tgtCurve.arcLengthDivisions = 6000;
const along = (curve) => {
  const L = curve.getLengths(), D = L.length - 1, n = PTS.length - 1;
  return KF.map((k) => { const x = (k.si / n) * D, i = Math.min(D - 1, Math.floor(x)); return lerp(L[i], L[i + 1], x - i) / L[D]; });
};
const camAt = smoothThrough(kp, along(posCurve)), tgtAt = smoothThrough(kp, along(tgtCurve)), camFov = smoothThrough(kp, KF.map((k) => k.fov));
const camNear = smoothThrough(kp, KF.map((k) => k.fog[0])), camFar = smoothThrough(kp, KF.map((k) => k.fog[1]));
const camShift = smoothThrough(kp, KF.map((k) => k.shift));

// where the camera is at story progress p (0 to 1)
function cameraAt(p) {
  return { pos: posCurve.getPointAt(clamp(camAt(p))), tgt: tgtCurve.getPointAt(clamp(tgtAt(p))), fov: camFov(p), near: camNear(p), far: camFar(p), shift: camShift(p) };
}
const shotAt = (p) => { let k = 0; while (k < SHOTS.length - 1 && p >= SHOTS[k + 1].s) k++; return k; };

// lights: off for the maker's demo, on for the lab, off again for the night-time ending
function lightsAt(p) { return clamp((p - 0.125) / 0.01) * (1 - clamp((p - 0.912) / 0.01)); }

// ---------- build the world
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (err) {
  root.classList.add("no-3d");
}

const scene = new THREE.Scene();
scene.background = PAL.dark.bg.clone();
scene.fog = new THREE.Fog(scene.background.clone(), 0.1, 0.2);
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 2500);
// soft studio reflections for the 3D models (so steel looks like steel); the line-drawn world ignores them
if (renderer) {
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
}
const lab = renderer ? buildLab(scene) : null;
// warm-up: prepare every surface's shader and upload every picture before the camera first meets them, so a bay
// never stutters as it comes into view; repeated while the 3D models arrive
function warm() {
  renderer.compileAsync(scene, camera).catch(() => {});
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) for (const k of ["map", "alphaMap", "emissiveMap"]) if (m[k]) renderer.initTexture(m[k]);
  });
}
if (renderer) [600, 2000, 4500, 8000, 14000].forEach((ms) => setTimeout(warm, ms));
const copyMat = inked(M.mid.clone());
if (lab) lab.copies.lines.material = copyMat;

// ---------- the words and panels on top of the 3D
const caps = Array.from(document.querySelectorAll(".cap"));
caps.forEach((c) => {
  const p = c.querySelector("p.h") || c.querySelector("p");
  p.innerHTML = p.textContent.trim().split(/\s+/).map((w, k) => `<span class="w" style="--k:${k}">${w}</span>`).join(" ");
  c._w = Array.from(p.querySelectorAll(".w"));
  c._s = +c.dataset.s;
  c._beats = Array.from(c.querySelectorAll(".beats > div"));
});
// each problem scene tells its story in three beats, timed to the action: the job, what went wrong, what we measure
const BEATS = { 3: [0, 0.37, 0.66], 4: [0, 0.4, 0.7], 5: [0, 0.48, 0.64], 6: [0, 0.46, 0.62] };
const marks = Array.from(document.querySelectorAll(".mk3d")).map((el) => ({ el, key: el.dataset.m }));
const MARK_AT = { packing: [3, 0.69], humanoid: [4, 0.42], hand: [5, 0.53], rover: [6, 0.5] };
const stuckEl = $("#mk-stuck");
const cold = $("#cold"), kicker = $("#kicker"), tele = $("#tele"), tRun = $("#t-run"), tFail = $("#t-fail");
const flash = $("#flash"), cue = $("#scroll-cue"), scN = $("#sc-n"), scName = $("#sc-name"), tc = $("#tc"), bar = $("#bar");
const findings = $("#findings"), claim = $("#claim"), measured = $("#measured"), measuredN = $("#measured-n");
const rows = Array.from(document.querySelectorAll("#measured .rows > div"));
const score = $("#score"), sheet = $("#sheet"), ver = $("#ver"), scoreN = $("#score-n"), stamp = $("#stamp");
const rRange = $("#r-range"), rStep = $("#r-step"), rSpeed = $("#r-speed"), rChange = $("#r-change");

// the cold open types its question once the page has loaded
const typeEl = $("#type"), question = typeEl.textContent;
function typeQuestion() {
  if (reduce) { root.classList.add("typed"); return; }
  typeEl.textContent = "";
  let n = 0;
  const tick = () => {
    typeEl.textContent = question.slice(0, ++n);
    if (n < question.length) setTimeout(tick, 75);
    else root.classList.add("typed");
  };
  setTimeout(tick, 900);
}

// ---------- the frame: size, and keep the subject clear of the captions
let W = 1, H = 1;
function resize() {
  W = frame.clientWidth;
  H = frame.clientHeight;
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.6 : 2));
  renderer.setSize(W, H, false);
}

const tmp = new THREE.Vector3();
function placeCamera(c) {
  const aspect = W / H;
  let fov = c.fov;
  // on tall phone screens, widen the view so the robots still fit side to side
  if (aspect < 1.25) fov = Math.min(78, (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * Math.pow(1.25 / aspect, 0.72)) * 180) / Math.PI);
  camera.fov = fov;
  camera.aspect = aspect;
  camera.position.copy(c.pos);
  camera.lookAt(c.tgt);
  const dist = c.pos.distanceTo(c.tgt);
  camera.near = clamp(dist * 0.03, 0.02, 3);
  camera.far = 2500;
  const portrait = aspect < 0.9;
  camera.setViewOffset(W, H, portrait ? 0 : -c.shift * W, portrait ? H * (0.08 + (c.py || 0)) : 0, W, H);
  camera.updateProjectionMatrix();
  scene.fog.near = c.near;
  scene.fog.far = c.far;
}

// ---------- one frame of the story
let pTarget = 0, pNow = 0, forcedP = null, last = performance.now(), clock = 0, lastClip = -1, snap = false;
const f2 = (n) => Math.round(n * 100) / 100;

function progress() {
  const total = story.offsetHeight - innerHeight;
  return clamp(-story.getBoundingClientRect().top / total);
}

function render(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  pTarget = forcedP ?? progress();
  // jumping straight to a scene (play mode) cuts there instead of flying through everything before it
  pNow = forcedP !== null || reduce || snap ? pTarget : pNow + (pTarget - pNow) * (1 - Math.exp(-dt * 5));
  snap = false;
  if (Math.abs(pTarget - pNow) < 1e-5) pNow = pTarget;
  const p = pNow;
  const k = shotAt(p), shot = SHOTS[k];

  // reduced motion: hold each shot still and cut between them
  const camP = reduce ? lerp(shot.h, shot.e, 0.5) : p;
  const time = reduce || forcedP !== null ? 2.1 : clock;

  if (renderer) {
    const c = cameraAt(camP);
    // on tall screens the first screen lifts the demo into the top half, so the words below stay clear
    c.py = 0.2 * (1 - seg(camP, 0.03, 0.06));
    placeCamera(c);
    const light = lightsAt(reduce ? (k >= 2 && k < 11 ? 0.5 : 0) : p);
    setLights(scene, light);

    // the copies spread out for "1,000 runs"; the hall and floor fade back so they read
    const runs = reduce ? (k === 7 ? 1 : 0) : ease(seg(p, 0.6, 0.66)) * (1 - seg(p, 0.67, 0.69));
    lab.copies.show(1000 * runs);
    const away = seg(p, 0.585, 0.61) * (1 - seg(p, 0.665, 0.69));
    M.hall.opacity = 0.5 - 0.38 * away;
    M.faint.opacity = 0.16 * (1 - 0.7 * away);
    copyMat.opacity = 0.42;
    copyMat.transparent = true;
    lab.roof.group.visible = camera.position.y > 13 && p > 0.88;

    // each bay plays its failure while the camera is there, and loops quietly otherwise
    let slowmo = false;
    SHOTS.forEach((s) => {
      if (!s.bay) return;
      const inShot = p >= s.s && p <= s.e + 0.03;
      const q = reduce ? (inShot ? 1 : null) : inShot ? seg(p, s.h, s.e) : null;
      lab.bays[s.bay].update(q, time);
      if (s.bay === "packing") slowmo = !reduce && !!(q !== null && lab.bays.packing.slow?.(q));
    });
    // the packet's fall plays in slow motion: a badge in the corner and a deeper vignette say so
    root.classList.toggle("slowmo", slowmo);
    lab.stage.update(time);

    // the replay on the screen wall scrubs as you scroll
    if (k >= 8 && k <= 9) {
      const play = reduce ? 0.7 : 0.1 + 0.8 * seg(p, SHOTS[8].h, SHOTS[8].e);
      if (Math.abs(play - lastClip) > 0.002) { lab.wall.screen.redraw(play); lastClip = play; }
    }
    renderer.render(scene, camera);

    // failure markers float next to the thing that failed
    marks.forEach(({ el, key }) => {
      const [sk, at] = MARK_AT[key], s = SHOTS[sk];
      const on = reduce ? k === sk : p >= s.h + at * (s.e - s.h) && p <= s.e + 0.006;
      tmp.copy(lab.bays[key].anchor()).project(camera);
      const vis = on && tmp.z < 1;
      el.classList.toggle("on", vis);
      // the humanoid's marker is a timer: how long it has been stuck, until a person steps in
      if (key === "humanoid" && vis) {
        const q = seg(p, s.h, s.e);
        const txt = reduce || q >= 0.69 ? "A person stepped in" : `Stuck · 00:${String(Math.floor(seg(q, 0.4, 0.69) * 12)).padStart(2, "0")}`;
        if (stuckEl.textContent !== txt) stuckEl.textContent = txt;
      }
      if (vis) {
        // labels on the right half of the screen open to the left, so they never run off the edge;
        // data-side="left" opens a label to the left whenever it fits, to keep it off something behind it
        const x = (tmp.x * 0.5 + 0.5) * W, w = el.offsetWidth;
        const flip = (el.dataset.side === "left" && x - w > 12) || x + w > W - 12;
        el.classList.toggle("flip", flip);
        // placed on whole screen pixels, so no edge ever sits on half a pixel
        const dp = devicePixelRatio || 1, snapPx = (v) => f2(Math.round(v * dp) / dp);
        el.style.transform = `translate(${snapPx(x + (flip ? 24 - w : 0))}px, ${snapPx((-tmp.y * 0.5 + 0.5) * H)}px)`;
      }
    });
  }

  // captions: each fades in once the camera has arrived, words rising one by one
  caps.forEach((c) => {
    const s = SHOTS[c._s], on = k === c._s, len = s.e - s.s;
    let o = 0;
    if (on) {
      const a = c._s === 11 ? s.s + 0.55 * len : s.h - 0.1 * len;
      const out = c._beats.length ? 0.04 : 0.1;
      o = c._s === 11 ? seg(p, a, a + 0.15 * len) : seg(p, a, a + 0.12 * len) * (1 - seg(p, s.e - out * len, s.e));
    }
    if (reduce) o = on ? 1 : 0;
    c.style.opacity = f2(o);
    c.classList.toggle("live", on && o > 0.5);
    c.classList.toggle("subin", on && o > 0.7);
    let frac = clamp(o * 1.6);
    if (c._beats.length) {
      // beats appear as the action happens; the headline lands with the failure
      const q = seg(p, s.h, s.e), B = BEATS[c._s];
      const n = reduce ? 3 : B.filter((t) => q >= t).length;
      c._beats.forEach((b, i) => { b.classList.toggle("in", on && i < n); b.classList.toggle("cur", i === n - 1); });
      frac = seg(q, B[1], B[1] + 0.08);
    }
    const shown = reduce ? c._w.length : Math.ceil(c._w.length * frac);
    c._w.forEach((w, n) => w.classList.toggle("in", on && n < shown));
  });

  cold.style.opacity = reduce ? (k === 0 ? 1 : 0) : f2(1 - seg(p, 0.035, 0.05));
  // once faded out, the first screen's buttons must not catch clicks
  cold.style.visibility = +cold.style.opacity > 0.01 ? "" : "hidden";
  kicker.style.opacity = k <= 1 ? 1 : 0;
  flash.style.opacity = reduce ? 0 : f2(0.85 * Math.max(0, 1 - Math.abs(p - 0.13) / 0.007));
  cue.style.opacity = p < 0.012 ? 1 : 0;

  // the run and failure counters, from the first bay to the thousand copies
  const fails = [3, 5, 6].filter((sk) => p > SHOTS[sk].h + 0.6 * (SHOTS[sk].e - SHOTS[sk].h)).length;
  const runs = reduce ? (k === 7 ? 1 : 0) : ease(seg(p, 0.6, 0.66));
  const shownCopies = Math.round(lab ? 1000 * runs : 0);
  tRun.textContent = String(Math.max(1, shownCopies || [0, 0, 0, 423, 118, 981, 207][k] || 1)).padStart(4, "0");
  tFail.textContent = String(fails + (lab && shownCopies ? lab.copies.failCount[shownCopies - 1] : 0)).padStart(2, "0");
  tele.style.opacity = k >= 3 && k <= 7 ? 1 : 0;
  tele.classList.toggle("big", k === 7);

  // claim against measured, then the scorecard and its retest
  const sF = SHOTS[9], sS = SHOTS[10];
  const fq = seg(p, sF.s + 0.2 * (sF.e - sF.s), sF.e);
  const fOn = k === 9 || (k === 10 && p < sS.s + 0.15 * (sS.e - sS.s));
  findings.style.opacity = reduce ? (k === 9 ? 1 : 0) : f2(fOn ? clamp(fq / 0.15) * (k === 10 ? 1 - seg(p, sS.s, sS.s + 0.15 * (sS.e - sS.s)) : 1) : 0);
  findings.style.visibility = findings.style.opacity > 0 ? "visible" : "hidden";
  claim.style.opacity = reduce ? 1 : f2(clamp(fq / 0.15));
  measured.style.opacity = reduce ? 1 : f2(clamp((fq - 0.12) / 0.12));
  measuredN.textContent = `${Math.round(94 * (reduce ? 1 : ease(seg(fq, 0.22, 0.62))))} / 100`;
  rows.forEach((r, n) => { r.style.opacity = reduce ? 1 : f2(seg(fq, 0.62 + n * 0.07, 0.68 + n * 0.07)); });

  const sq = seg(p, sS.s + 0.1 * (sS.e - sS.s), sS.e);
  const sOn = k === 10;
  score.style.opacity = reduce ? (sOn ? 1 : 0) : f2(sOn ? clamp(sq / 0.15) * (1 - seg(p, sS.e - 0.08 * (sS.e - sS.s), sS.e)) : 0);
  score.style.visibility = score.style.opacity > 0 ? "visible" : "hidden";
  const fixed = reduce ? true : sq > 0.5;
  ver.textContent = fixed ? "v1.1" : "v1.0";
  scoreN.textContent = fixed ? "97" : "94";
  rRange.textContent = fixed ? "96–98 out of 100" : "92–95 out of 100";
  rStep.textContent = fixed ? "Once an hour" : "4 times an hour";
  rSpeed.textContent = fixed ? "8 s · a person: 6 s" : "9 s · a person: 6 s";
  rChange.textContent = fixed ? "88 out of 100" : "71 out of 100";
  stamp.classList.toggle("on", fixed);
  sheet.classList.toggle("flip", fixed && !reduce && sq < 0.62);

  // the film bar: scene, running clock, progress
  scN.textContent = String(k + 1).padStart(2, "0");
  if (scName.textContent !== shot.name) scName.textContent = shot.name;
  const secs = p * 180, fr = Math.floor((secs % 1) * 24);
  tc.textContent = [0, Math.floor(secs / 60), Math.floor(secs % 60), fr].map((n) => String(n).padStart(2, "0")).join(":");
  bar.style.width = f2(p * 100) + "%";

  root.classList.toggle("lit", light01(p, k) > 0.5);
  navSync();
}

// the nav sits on the top film bar while the story plays, and turns light for the page below
function navSync() { nav.classList.toggle("is-dark", story.getBoundingClientRect().bottom > 60); }
addEventListener("scroll", navSync, { passive: true });
const light01 = (p, k) => (reduce ? (k >= 2 && k < 11 ? 1 : 0) : lightsAt(p));

// ---------- run: draw while the story is on screen, rest when it isn't
let running = false, raf = 0;
function loop(now) { render(now); raf = running ? requestAnimationFrame(loop) : 0; }
function setRunning(on) {
  if (on === running) return;
  running = on;
  if (on) { last = performance.now(); raf = requestAnimationFrame(loop); }
  else cancelAnimationFrame(raf);
}

resize();
addEventListener("resize", () => { resize(); if (!running) render(performance.now()); });
new IntersectionObserver((e) => setRunning(e[0].isIntersecting)).observe(story);

// for testing only: index.html#p=0.5 shows the story halfway through without scrolling
const jump = location.hash.match(/^#p=([\d.]+)/);
if (jump) forcedP = parseFloat(jump[1]);

// for showing the film hands-free: index.html#play scrolls through the story by itself, about 2 minutes;
// #play=6 starts at shot 6. Any scroll, tap or key press hands control back
const SECS = [4, 8, 9, 16, 13, 13, 13, 9, 9, 10, 9, 7];
// lead: how long to wait before moving (a link gives the first screen time to be read; the button starts at once);
// cold: how many seconds the first screen takes on the way out
function autoplay(from = 0, { lead = from ? 600 : 2600, cold = SECS[0] } = {}) {
  let start = null, stop = false, first = from > 0;
  const secs = [cold, ...SECS.slice(1)];
  const skip = secs.slice(0, from).reduce((a, b) => a + b, 0);
  const T = [0], P = [SHOTS[0].s];
  secs.forEach((d, k) => { T.push(T[k] + d); P.push(SHOTS[k].e); });
  const pAt = smoothThrough(T, P, true);
  const cancel = () => { stop = true; root.style.scrollBehavior = ""; };
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((e) => addEventListener(e, cancel, { passive: true, once: true }));
  root.style.scrollBehavior = "auto";
  scrollTo(0, 0);
  const tick = (now) => {
    if (stop) return;
    if (start === null) start = now + lead;
    const t = Math.max(0, now - start) / 1000 + skip, p = Math.min(1, pAt(t));
    scrollTo(0, story.offsetTop + p * (story.offsetHeight - innerHeight));
    if (first) { snap = true; first = false; }
    if (p < 1) requestAnimationFrame(tick);
    else cancel();
  };
  requestAnimationFrame(tick);
}
// the first screen's "watch the story" button plays the film hands-free
document.querySelectorAll("[data-play]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); autoplay(0, { lead: 100, cold: 1.4 }); }));
const playAt = location.hash.match(/^#play(?:=(\d+))?$/);
if (playAt) autoplay(Math.max(0, (+playAt[1] || 1) - 1));

document.fonts.ready.then(() => {
  CANVASES.forEach((r) => r());
  lastClip = -1;
  typeQuestion();
  render(performance.now());
});
render(performance.now());
root.classList.add("ready");
