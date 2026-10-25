// The whole test lab: the hall, the maker's demo stage, the four bays, the screen wall,
// a thousand copies of the lab for the "1,000 runs" shot, and the roof with the NITH logo.
import { THREE, M, Batch, at, joint, skin, loadModel, canvasPlane, inked, FONT, MONO, clamp } from "./kit.js?v=13";
import { makeArm, makePerson } from "./models.js?v=16";
import { buildBays } from "./bays.js?v=22";

export const HALL = { x0: -32, x1: 32, z0: -34, z1: 14, h: 11 };
export const STAGE = new THREE.Vector3(0, 0, 6);
export const WALL = new THREE.Vector3(0, 0, -24);

// ---------- the hall: a floor grid, columns, roof trusses and light rows
function buildHall(b) {
  const { x0, x1, z0, z1, h } = HALL;
  const minor = [], major = [];
  for (let x = x0; x <= x1; x++) (x % 4 ? minor : major).push(x, 0, z0, x, 0, z1);
  for (let z = z0; z <= z1; z++) ((z - z0) % 4 ? minor : major).push(x0, 0, z, x1, 0, z);
  b.lines(minor, "faint").lines(major, "mid");
  for (let z = z0; z <= z1; z += 8) for (const x of [x0, x1]) b.box(0.5, h, 0.5, at(x, h / 2, z), { mat: "hall", faces: false });
  for (let x = x0 + 8; x < x1; x += 8) b.box(0.5, h, 0.5, at(x, h / 2, z0), { mat: "hall", faces: false });
  const T = [];
  for (let z = z0; z <= z1; z += 8) {
    T.push(x0, h, z, x1, h, z, x0, h - 0.9, z, x1, h - 0.9, z);
    for (let x = x0; x < x1; x += 2) T.push(x, h - 0.9, z, x + 1, h, z, x + 1, h, z, x + 2, h - 0.9, z);
    for (const lx of z + 4.2 < z1 ? [-22, -6, 10] : []) {
      const y = h - 1.6;
      T.push(lx, y, z + 3.8, lx + 6, y, z + 3.8, lx + 6, y, z + 3.8, lx + 6, y, z + 4.2, lx + 6, y, z + 4.2, lx, y, z + 4.2, lx, y, z + 4.2, lx, y, z + 3.8);
    }
  }
  for (const x of [x0, x1]) T.push(x, h, z0, x, h, z1, x, 0.6, z0, x, 0.6, z1);
  for (const z of [z0, z1]) T.push(x0, 0.6, z, x1, 0.6, z);
  b.lines(T, "hall");
}

// ---------- the maker's demo stage: a spotlit platform, a perfect robot, and a film camera
function buildStage(scene, b) {
  const { x, z } = STAGE;
  b.cyl(3, 3, 0.4, 48, at(x, 0.2, z), { thr: 30 });
  const ring = [];
  for (let i = 0; i < 64; i++) {
    const a0 = (i / 64) * Math.PI * 2, a1 = ((i + 1) / 64) * Math.PI * 2;
    ring.push(x + Math.cos(a0) * 2.6, 0.402, z + Math.sin(a0) * 2.6, x + Math.cos(a1) * 2.6, 0.402, z + Math.sin(a1) * 2.6);
  }
  b.lines(ring, "mid");
  b.box(0.26, 0.01, 0.26, at(x - 0.5, 0.405, z + 0.45)).box(0.26, 0.01, 0.26, at(x + 0.5, 0.405, z + 0.45));
  // the spotlight and its beam
  const LY = 8.6;
  b.cyl(0.22, 0.3, 0.45, 16, at(x, LY, z)).lines([x, LY + 0.22, z, x, HALL.h - 0.9, z]);
  const cone = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    cone.push(x + Math.cos(a) * 0.3, LY - 0.22, z + Math.sin(a) * 0.3, x + Math.cos(a) * 2.6, 0.41, z + Math.sin(a) * 2.6);
  }
  b.lines(cone, "faint");
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 2.6, LY - 0.63, 40, 1, true), M.glow);
  beam.position.set(x, 0.41 + (LY - 0.63) / 2, z);
  scene.add(beam);
  // the maker's film camera on a dolly track, pointing at the stage
  const cx = 2.4, cz = z + 5.2;
  const rails = [];
  for (const dz of [-0.3, 0.3]) rails.push(cx - 2.6, 0.03, cz + dz, cx + 2.6, 0.03, cz + dz);
  for (let s = cx - 2.5; s <= cx + 2.5; s += 0.5) rails.push(s, 0.02, cz - 0.42, s, 0.02, cz + 0.42);
  b.lines(rails, "mid");
  const ry = Math.atan2(x - cx, z - cz);
  b.box(0.7, 0.18, 0.7, at(cx, 0.15, cz, ry)).cyl(0.06, 0.06, 1.1, 10, at(cx, 0.8, cz));
  b.box(0.28, 0.26, 0.5, at(cx, 1.48, cz, ry));
  b.cyl(0.08, 0.1, 0.22, 14, at(cx + Math.sin(ry) * 0.36, 1.48, cz + Math.cos(ry) * 0.36, ry, Math.PI / 2));
  b.box(0.3, 0.24, 0.04, at(cx + Math.sin(ry) * 0.5, 1.48, cz + Math.cos(ry) * 0.5, ry));
  // the slate: the maker's demo, take 47
  b.box(0.04, 1.3, 0.04, at(x - 1.55, 0.4 + 0.65, z + 1.65));
  const slate = canvasPlane(0.9, 0.62, 640, (ctx, w, h) => {
    ctx.fillStyle = "#F4F4F2";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#171717";
    ctx.fillRect(0, 0, w, h * 0.2);
    ctx.fillStyle = "#F4F4F2";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      const x0 = i * w * 0.16;
      ctx.moveTo(x0, 0); ctx.lineTo(x0 + w * 0.08, 0); ctx.lineTo(x0 + w * 0.04, h * 0.2); ctx.lineTo(x0 - w * 0.04, h * 0.2);
      ctx.fill();
    }
    ctx.fillStyle = "#171717";
    ctx.font = MONO(700, h * 0.075);
    ctx.fillText("MAKER'S DEMO", w * 0.06, h * 0.33);
    ctx.fillText("SCENE 1 · TAKE 47", w * 0.06, h * 0.45);
    ctx.fontStretch = "semi-expanded";
    ctx.font = FONT(800, h * 0.3);
    ctx.fillText("99%", w * 0.05, h * 0.82);
    ctx.font = MONO(500, h * 0.07);
    ctx.fillText("SUCCESS", w * 0.62, h * 0.82);
  }, scene);
  slate.mesh.position.set(x - 1.55, 0.4 + 1.38, z + 1.68);
  slate.mesh.rotation.y = 0.28;

  // the demo robot: a perfect pick, every time
  const arm = makeArm(scene, x, 0.4, z);
  // the same white robot arm that is tested later in bay 01
  loadModel("models/cobot.glb").then((m) => skin(m, { arm_root: arm.root, arm_turret: arm.turret, arm_shoulder: arm.shoulder,
    arm_elbow: arm.elbow, arm_wrist: arm.wrist, arm_finger_n: arm.fl, arm_finger_p: arm.fr }));
  const cube = joint(scene);
  const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  cube.add(new THREE.Mesh(geo, M.face), new THREE.LineSegments(new THREE.EdgesGeometry(geo), M.line));
  const A = [-0.5, 0.075, 0.45], B = [0.5, 0.075, 0.45];
  const keys = [[0, -0.5, 0.35, 0.45, 1], [0.15, ...A, 1], [0.25, ...A, 0], [0.4, -0.5, 0.35, 0.45, 0], [0.55, 0.5, 0.35, 0.45, 0],
    [0.65, ...B, 0], [0.72, ...B, 1], [0.85, 0.5, 0.35, 0.45, 1], [1, -0.5, 0.35, 0.45, 1]];
  const tip = new THREE.Vector3();
  function update(time) {
    const u = (time / 4.2) % 1;
    let k = 1;
    while (k < keys.length - 1 && u > keys[k][0]) k++;
    const a = keys[k - 1], c = keys[k], s = clamp((u - a[0]) / (c[0] - a[0]));
    const e = s * s * (3 - 2 * s);
    const v = a.slice(1).map((n, i) => n + (c[i + 1] - n) * e);
    arm.reach(v[0], v[1], v[2]);
    arm.grip(v[3]);
    arm.root.updateMatrixWorld(true);
    arm.tip.getWorldPosition(tip);
    if (u >= 0.25 && u < 0.72) cube.position.set(tip.x, tip.y - 0.055, tip.z);
    else cube.position.set(x + (u >= 0.72 ? 0.5 : -0.5), 0.4 + 0.065, z + 0.45);
  }
  return { update, beam };
}

// ---------- the screen wall, where every failure is replayed, and the control desk
function buildWall(scene, b) {
  const { x, z } = WALL;
  b.box(0.22, 6.2, 0.22, at(x - 4.7, 3.1, z)).box(0.22, 6.2, 0.22, at(x + 4.7, 3.1, z)).box(9.6, 0.26, 0.26, at(x, 6.1, z));
  b.box(8.3, 2.7, 0.1, at(x, 3.6, z - 0.06));
  b.box(3.2, 0.75, 0.8, at(x, 0.375, z + 3.4));
  for (const dx of [-0.7, 0.7]) b.box(0.62, 0.38, 0.04, at(x + dx, 1.05, z + 3.2, dx * -0.25)).box(0.04, 0.2, 0.04, at(x + dx, 0.85, z + 3.22));
  const screen = canvasPlane(8, 2.5, 1600, drawClip, scene);
  screen.mesh.position.set(x, 3.6, z + 0.01);
  return { screen };
}

// the failure clip, as a film strip; the playhead runs from 0 to 1
function drawClip(ctx, w, h, play = 0.62) {
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#E85002";
  ctx.beginPath();
  ctx.arc(w * 0.035, h * 0.1, h * 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#D8D8D8";
  ctx.font = MONO(700, h * 0.05);
  ctx.fillText("REPLAY · BAY 01 · RUN 0423-117 · 00:12:04", w * 0.05, h * 0.115);
  ctx.fillStyle = "#8F8F8F";
  ctx.fillText("FRAME BY FRAME", w * 0.8, h * 0.115);
  const fy = h * 0.2, fh = h * 0.6, n = 5, gap = w * 0.012, fw = (w * 0.9 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const fx = w * 0.05 + i * (fw + gap);
    const bad = i >= 3;
    ctx.fillStyle = "#1E1E1E";
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = bad ? "#E85002" : "#5A5A5A";
    ctx.lineWidth = h * 0.006;
    ctx.strokeRect(fx, fy, fw, fh);
    // the gripper and the packet in each frame: it starts to slip in frame 4
    const gx = fx + fw / 2, gy = fy + fh * 0.22;
    ctx.strokeStyle = "#E6E6E6";
    ctx.lineWidth = h * 0.007;
    ctx.strokeRect(gx - fw * 0.12, gy - fh * 0.08, fw * 0.24, fh * 0.07);
    ctx.strokeRect(gx - fw * 0.1, gy, fw * 0.035, fh * 0.2);
    ctx.strokeRect(gx + fw * 0.065, gy, fw * 0.035, fh * 0.2);
    const drop = i < 3 ? 0 : (i - 2) * fh * 0.14, rot = i < 3 ? 0 : (i - 2) * 0.25;
    ctx.save();
    ctx.translate(gx, gy + fh * 0.17 + drop);
    ctx.rotate(rot);
    ctx.strokeStyle = bad ? "#E85002" : "#E6E6E6";
    ctx.strokeRect(-fw * 0.06, -fh * 0.06, fw * 0.12, fh * 0.12);
    ctx.restore();
    ctx.fillStyle = "#8F8F8F";
    ctx.font = MONO(500, h * 0.04);
    ctx.fillText(`F${String(i * 12 + 1).padStart(3, "0")}`, fx + fw * 0.05, fy + fh - h * 0.03);
  }
  const px = w * 0.05 + play * w * 0.9;
  ctx.fillStyle = "#E85002";
  ctx.fillRect(px - h * 0.004, fy - h * 0.04, h * 0.008, fh + h * 0.08);
  ctx.fillRect(w * 0.05, h * 0.89, w * 0.9 * play, h * 0.012);
  ctx.fillStyle = "#3A3A3A";
  ctx.fillRect(w * 0.05 + w * 0.9 * play, h * 0.89, w * 0.9 * (1 - play), h * 0.012);
}

// ---------- a thousand simplified copies of the lab, spreading out to the horizon
function buildCopies(scene) {
  const SP = 16, cells = [];
  for (let i = -18; i <= 18; i++) for (let j = -18; j <= 18; j++) {
    const x = i * SP, z = -10 + j * SP;
    if (Math.abs(x) < 40 && z > -42 && z < 22) continue;
    cells.push([x, z, Math.hypot(x, z + 10)]);
  }
  cells.sort((a, b) => a[2] - b[2]);
  const use = cells.slice(0, 1000);
  const L = [], F = [], failCount = [];
  let fails = 0;
  use.forEach(([x, z], k) => {
    const r = 6;
    L.push(x - r, 0, z - r, x + r, 0, z - r, x + r, 0, z - r, x + r, 0, z + r, x + r, 0, z + r, x - r, 0, z + r, x - r, 0, z + r, x - r, 0, z - r);
    L.push(x - 2.2, 0.9, z, x + 1.8, 0.9, z, x - 0.6, 0, z + 1.2, x - 0.6, 1.4, z + 1.2, x - 0.6, 1.4, z + 1.2, x + 0.6, 1.0, z + 0.4);
    const bad = ((k * 2654435761) >>> 0) % 100 < 6;
    if (bad) {
      fails++;
      const s = 1.6;
      F.push(x - s, 0.03, z - s, x + s, 0.03, z - s, x + s, 0.03, z + s, x - s, 0.03, z - s, x + s, 0.03, z + s, x - s, 0.03, z + s);
    }
    failCount.push(fails);
  });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(L), 3));
  const lines = new THREE.LineSegments(lg, M.mid);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(F), 3));
  const marks = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: M.orange.color, side: THREE.DoubleSide }));
  const group = new THREE.Group();
  group.add(lines, marks);
  scene.add(group);
  const VPC = 14; // line vertices per copy
  // show the first n copies (0 to 1000)
  function show(n) {
    n = Math.round(clamp(n, 0, use.length));
    group.visible = n > 0;
    lines.geometry.setDrawRange(0, n * VPC);
    marks.geometry.setDrawRange(0, (n ? failCount[n - 1] : 0) * 6);
  }
  show(0);
  return { show, total: use.length, failCount, lines };
}

// ---------- the roof, seen only at the very end, with the NITH logo painted on it
function buildRoof(scene) {
  const { x0, x1, z0, z1, h } = HALL;
  const group = new THREE.Group();
  const b = new Batch();
  const w = x1 - x0 + 1, d = z1 - z0 + 1, cz = (z0 + z1) / 2;
  b.box(w, 0.5, d, at(0, h + 0.25, cz));
  b.box(w, 0.6, 0.3, at(0, h + 0.8, z0 - 0.35)).box(w, 0.6, 0.3, at(0, h + 0.8, z1 + 0.35));
  b.box(0.3, 0.6, d, at(x0 - 0.35, h + 0.8, cz)).box(0.3, 0.6, d, at(x1 + 0.35, h + 0.8, cz));
  for (const [ux, uz] of [[-24, -28], [-20, -28], [24, 8]]) b.box(2.6, 1.4, 2, at(ux, h + 1.2, uz));
  b.build(group);
  const logo = canvasPlane(26, 26 * 151.277 / 161, 1400, (ctx, cw, ch) => {
    const svg = document.querySelector(".foot-logo svg");
    if (!svg) return;
    const k = cw / 161;
    ctx.fillStyle = "#FFFFFF";
    ctx.save();
    ctx.scale(k, k);
    for (const el of svg.children) {
      const p = new Path2D();
      if (el.tagName === "rect") p.rect(+el.getAttribute("x") || 0, +el.getAttribute("y") || 0, +el.getAttribute("width"), +el.getAttribute("height"));
      else if (el.tagName === "path") p.addPath(new Path2D(el.getAttribute("d")));
      else if (el.tagName === "polygon") {
        const pts = el.getAttribute("points").trim().split(/\s+/).map((s) => s.split(",").map(Number));
        pts.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py)));
        p.closePath();
      }
      ctx.fill(p);
    }
    ctx.restore();
  }, group, { transparent: true });
  logo.mesh.rotation.x = -Math.PI / 2;
  logo.mesh.position.set(0, h + 0.52, cz + 1);
  group.visible = false;
  scene.add(group);
  return { group };
}

// ---------- put it all together
export function buildLab(scene) {
  // soft light for the 3D robot models made in Blender; the line-drawn world itself ignores light
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfcfcf, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-6, 14, 10);
  scene.add(sun);
  const b = new Batch();
  buildHall(b);
  const stage = buildStage(scene, b);
  const wall = buildWall(scene, b);
  const bays = buildBays(scene, b);
  const hallLines = b.build(scene);
  // the lab's workers: one technician at the control desk and one beside it, and an operator to the right of bay 01's
  // crate watching the arm (kept out from behind the arm, which the camera looks along) (the maker's demo has no one watching: Dee's call)
  for (const [px, pz, ry, who] of [[0, -21.35, Math.PI, "tech-senior"], [2.9, -20.8, Math.PI + 0.35, "tech-young"],
    [-13.2, 1.9, -2.14, "operator-m"]]) {
    const p = makePerson(scene, who);
    p.root.position.set(px, 0, pz);
    p.root.rotation.y = ry;
  }
  const copies = buildCopies(scene);
  const roof = buildRoof(scene);
  return { stage, wall, bays, copies, roof, hallLines, drawClip };
}
