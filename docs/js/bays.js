// The four test bays. Each one is a different job on a different kind of robot,
// and each has a scripted failure that plays as the visitor scrolls through its shot.
import { THREE, M, at, pbox, pcyl, joint, lineObj, skin, loadModel, canvasPlane, inked, FONT, MONO, clamp, seg, lerp, smooth } from "./kit.js?v=13";
import { makeArm, makeHumanoid, makePerson, makeRover } from "./models.js?v=16";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HALF = 6, HALF_PI = Math.PI / 2;
// the robots are 3D models made in Blender (loadModel); until a file arrives its robot shows as a line drawing

export const BAYS = [
  { key: "packing", c: [-17, 0], n: "01", job: "GROCERY PACKING", robot: "ROBOT ARM", stats: ["RUN 0423", "PASS 397", "FAIL 26"] },
  { key: "humanoid", c: [-17, -20], n: "02", job: "CARRYING PARTS", robot: "HUMANOID", stats: ["RUN 0118", "PASS 109", "STEP-INS 9"] },
  { key: "hand", c: [17, -20], n: "03", job: "PICKING A TOOL", robot: "ROBOT HAND", stats: ["RUN 0981", "PASS 902", "FAIL 79"] },
  { key: "rover", c: [17, 0], n: "04", job: "HOSPITAL DELIVERY", robot: "DELIVERY ROBOT", stats: ["RUN 0207", "PASS 199", "NEAR MISS 8"] },
];

// keyframes: [time, x, y, z, extra]; smooth steps between them
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], s = smooth((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, k) => lerp(v, b[k + 1], s));
    }
  }
  return keys[keys.length - 1].slice(1);
}

// ---------- the holographic coffee bag that the robot arm fumbles in bay 01
// Its picture wraps round the bag (front 0-0.31, right side, back 0.5-0.81, left side): drifting rainbow foil,
// light creases, and a black label on the front and back.
function foilTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  const base = g.createLinearGradient(0, 0, 1024, 512);
  ["#8fa6ff", "#ff92d4", "#78efdc", "#ffe98a", "#ff9ad8", "#92a6ff", "#86f0de", "#8fa6ff"].forEach((col, i, a) => base.addColorStop(i / (a.length - 1), col));
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 512);
  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hues = ["#ff74c8", "#5fe6ff", "#9f7dff", "#ffe27a", "#7dffc0", "#6f92ff", "#ff8fb0"];
  for (let i = 0; i < 30; i++) {
    const x = rnd() * 1024, y = rnd() * 512, r = 120 + rnd() * 180, col = hues[i % hues.length];
    for (const dx of [-1024, 0, 1024]) {
      const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      gr.addColorStop(0, col + "dc");
      gr.addColorStop(1, col + "00");
      g.fillStyle = gr;
      g.fillRect(x + dx - r, y - r, 2 * r, 2 * r);
    }
  }
  // a few broad creases in the foil catch the light
  for (let i = 0; i < 13; i++) {
    const x = rnd() * 1024, w = 25 + rnd() * 45, gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, "#ffffff00");
    gr.addColorStop(0.5, i % 3 ? "#ffffff5c" : "#2d5f8a2e");
    gr.addColorStop(1, "#ffffff00");
    g.fillStyle = gr;
    g.fillRect(x - w, 0, 2 * w, 512);
  }
  for (const u of [0.153, 0.653]) {
    const cx = u * 1024, cy = 512 * 0.7;
    g.fillStyle = "#151515";
    g.fillRect(cx - 86, cy - 46, 172, 92);
    g.fillStyle = "#F2F2F2";
    g.font = FONT(800, 31);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("COFFEE", cx, cy + 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.anisotropy = 4;
  return t;
}
export function foilMaterial() {
  return new THREE.MeshPhysicalMaterial({ map: foilTexture(), metalness: 0.62, roughness: 0.16, iridescence: 0.85, iridescenceIOR: 1.45,
    iridescenceThicknessRange: [150, 650], clearcoat: 0.7, clearcoatRoughness: 0.1, envMapIntensity: 1.25 });
}

// ---------- what every bay has: a taped floor outline, a painted number, two cameras and a scoreboard.
// (The tape was once hatched; from low camera angles the hatch strokes floated on their own, so it is plain.)
function tripod(b, x, z, ax, az) {
  const h = 1.45, ry = Math.atan2(ax - x, az - z);
  const L = [];
  for (const a of [0, 2.094, 4.189]) L.push(x, h, z, x + Math.sin(a + ry) * 0.45, 0, z + Math.cos(a + ry) * 0.45);
  b.lines(L);
  b.box(0.2, 0.16, 0.32, at(x, h + 0.1, z, ry));
  b.cyl(0.06, 0.07, 0.14, 12, at(x + Math.sin(ry) * 0.22, h + 0.1, z + Math.cos(ry) * 0.22, ry, Math.PI / 2));
}

function board(ctx, w, h, bay) {
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#E85002";
  ctx.fillRect(0, 0, w, h * 0.035);
  ctx.fillStyle = "#9A9A9A";
  ctx.font = MONO(700, h * 0.1);
  ctx.fillText(`BAY ${bay.n} · ${bay.job}`, w * 0.05, h * 0.2);
  ctx.fillStyle = "#F2F2F2";
  ctx.fontStretch = "semi-expanded";
  ctx.font = FONT(800, h * 0.36);
  ctx.fillText(bay.stats[0], w * 0.05, h * 0.62);
  ctx.font = MONO(700, h * 0.11);
  ctx.fillText(bay.stats[1], w * 0.05, h * 0.86);
  ctx.fillStyle = "#E85002";
  ctx.fillText(bay.stats[2], w * 0.42, h * 0.86);
}

function bayFrame(b, scene, bay, aim, decalBack = false) {
  const [cx, cz] = bay.c, s = 0.3, y = 0.004;
  const L = [];
  for (const r of [HALF, HALF - s]) {
    L.push(cx - r, y, cz - r, cx + r, y, cz - r, cx + r, y, cz - r, cx + r, y, cz + r);
    L.push(cx + r, y, cz + r, cx - r, y, cz + r, cx - r, y, cz + r, cx - r, y, cz - r);
  }
  b.lines(L, "mid");

  const decal = canvasPlane(3.6, 1.2, 720, (ctx, w, h) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fontStretch = "semi-expanded";
    ctx.font = FONT(800, h * 0.8);
    ctx.fillText(bay.n, 0, h * 0.8);
    const nw = ctx.measureText(bay.n).width + h * 0.14;
    ctx.font = MONO(700, h * 0.15);
    ctx.fillText(`BAY ${bay.n}`, nw, h * 0.34);
    ctx.font = MONO(500, h * 0.15);
    ctx.fillText(bay.job, nw, h * 0.56);
    ctx.fillText(bay.robot, nw, h * 0.78);
  }, scene, { mat: inked(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.8 })) });
  decal.mesh.rotation.x = -Math.PI / 2;
  decal.mesh.position.set(cx - HALF + 2.5, 0.006, decalBack ? cz - HALF + 1.6 : cz + HALF - 1.1);

  const bz = cz - HALF + 0.4;
  b.box(0.12, 4.6, 0.12, at(cx - 2.1, 2.3, bz)).box(0.12, 4.6, 0.12, at(cx + 2.1, 2.3, bz)).box(4.5, 0.14, 0.14, at(cx, 4.6, bz));
  const sc = canvasPlane(3.8, 1.25, 760, (ctx, w, h) => board(ctx, w, h, bay), scene);
  sc.mesh.position.set(cx, 3.85, bz + 0.08);

  tripod(b, cx - 4.8, cz + 4.8, aim[0], aim[1]);
  tripod(b, cx + 4.8, cz + 4.8, aim[0], aim[1]);
}

// an open box: a floor and four walls
function tote(b, x, y, z, w, h, d, t = 0.012) {
  b.box(w, t, d, at(x, y + t / 2, z));
  b.box(w, h, t, at(x, y + h / 2, z - d / 2)).box(w, h, t, at(x, y + h / 2, z + d / 2));
  b.box(t, h, d, at(x - w / 2, y + h / 2, z)).box(t, h, d, at(x + w / 2, y + h / 2, z));
}

function table(b, x, z, w, d, h) {
  b.box(w, 0.05, d, at(x, h - 0.025, z));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.05, h - 0.05, 0.05, at(x + sx * (w / 2 - 0.06), (h - 0.05) / 2, z + sz * (d / 2 - 0.06)));
}

// ---------- bay 01: a robot arm packs groceries; a shiny packet slips out of the gripper
function buildPacking(scene, b, bay) {
  bayFrame(b, scene, bay, [-15.5, 0.5]);
  const X0 = -22.6, X1 = -15.7, TOP = 0.86, mx = (X0 + X1) / 2, len = X1 - X0;
  b.box(len, 0.03, 0.6, at(mx, TOP - 0.015, 0));
  b.box(len, 0.1, 0.05, at(mx, TOP - 0.05, -0.325)).box(len, 0.1, 0.05, at(mx, TOP - 0.05, 0.325));
  for (let x = X0 + 0.3; x < X1; x += 1.7) b.box(0.05, TOP - 0.1, 0.05, at(x, (TOP - 0.1) / 2, -0.3)).box(0.05, TOP - 0.1, 0.05, at(x, (TOP - 0.1) / 2, 0.3));
  const rl = [];
  for (let x = X0 + 0.15; x < X1; x += 0.3) rl.push(x, TOP + 0.001, -0.3, x, TOP + 0.001, 0.3);
  b.lines(rl, "faint");
  // groceries waiting on the stopped belt
  const kinds = [[0.2, 0.3, 0.07], [0.045, 0.11], [0.3, 0.07, 0.12], [0.035, 0.22], [0.18, 0.12, 0.14], [0.045, 0.11]];
  kinds.forEach((k, i) => {
    const x = -16.6 - i * 0.85;
    if (k.length === 3) b.box(k[0], k[1], k[2], at(x, TOP + k[1] / 2, (i % 2) * 0.12 - 0.06, i * 0.4));
    else b.cyl(k[0], k[0], k[1], 10, at(x, TOP + k[1] / 2, 0.05));
  });
  b.box(0.5, 0.6, 0.5, at(-15.3, 0.3, 0.55));
  b.box(0.7, 0.62, 0.55, at(-14.75, 0.31, 1.15));
  tote(b, -14.75, 0.62, 1.15, 0.56, 0.2, 0.42);

  const arm = makeArm(scene, -15.3, 0.6, 0.55);
  loadModel("models/cobot.glb").then((m) => skin(m, { arm_root: arm.root, arm_turret: arm.turret, arm_shoulder: arm.shoulder,
    arm_elbow: arm.elbow, arm_wrist: arm.wrist, arm_finger_n: arm.fl, arm_finger_p: arm.fr }));
  // the packet is a holographic stand-up coffee bag (models/packet.glb): the shine is what fools the camera.
  // Its origin is the middle of its top seal, which is where the gripper pinches it.
  const packet = joint(scene);
  pbox(0.11, 0.2, 0.07, packet, { y: -0.1 });
  loadModel("models/packet.glb").then((m) => {
    const foil = foilMaterial();
    m.traverse((o) => { if (o.isMesh) o.material = foil; });
    skin(m, { packet });
  });
  const PH = 0.2;
  const REST = V(-15.9, TOP + PH, 0);

  // the arm's path, swinging around its base: [time, angle, distance from base, height, gripper open].
  // It picks from the belt and swings past the camera to the tote; the packet slips halfway.
  const HOME = [-2.0, 0.6, 0.65], ABOVE_P = [-2.4, 0.814, 0.6], PICK = [-2.4, 0.814, 0.445];
  const ABOVE_D = [-5.454, 0.814, 0.55], PLACE = [-5.454, 0.814, 0.217];
  // the bag turns with the gripper, whose fingers close across its seal
  const PICK_YAW = -PICK[0] + Math.PI / 2, PLACE_YAW = -PLACE[0] + Math.PI / 2;
  const KEYS = [[0, ...HOME, 1], [0.22, ...ABOVE_P, 1], [0.32, ...PICK, 1], [0.38, ...PICK, 0], [0.5, ...ABOVE_P, 0],
    [0.78, ...ABOVE_D, 0], [0.9, ...PLACE, 0], [0.96, ...PLACE, 1], [1, ...ABOVE_D, 1], [1.25, ...HOME, 1]];
  // the slip: as the arm swings toward the crate, the shiny bag's seal slides down out of its fingers, the bag swings
  // out at an angle and comes free at SLIP_B, then drops to the floor at normal speed
  const SLIP_A = 0.58, SLIP_B = 0.64, LAND = 0.69;
  const tipW = V();
  let rel = null;

  // slow motion on the slip itself: take time stretches around it (SLOW = 0.15 of normal speed), with smooth ramps
  // in and out, and the take still ends at q = 0.82, leaving time to read what it means. QT holds the shot progress
  // q reached at each step of take time; take(q) turns it back into take time.
  const SLOW = 0.15, STRETCH = [0.545, 0.575, 0.645, 0.665], Q_END = 0.82, N = 800;
  const stretch = (t) => (t < STRETCH[0] || t > STRETCH[3] ? 1 : t < STRETCH[1] ? lerp(1, 1 / SLOW, smooth((t - STRETCH[0]) / (STRETCH[1] - STRETCH[0])))
    : t <= STRETCH[2] ? 1 / SLOW : lerp(1 / SLOW, 1, smooth((t - STRETCH[2]) / (STRETCH[3] - STRETCH[2]))));
  const QT = [0];
  for (let i = 1; i <= N; i++) QT.push(QT[i - 1] + stretch((i - 0.5) / N));
  for (let i = 1; i <= N; i++) QT[i] *= Q_END / QT[N];
  const take = (q) => {
    if (q >= Q_END) return 1;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (QT[m] <= q) lo = m; else hi = m; }
    return (lo + (q - QT[lo]) / (QT[hi] - QT[lo])) / N;
  };
  const SLOW_Q = [QT[Math.round(0.57 * N)], QT[Math.round(0.65 * N)]];

  // the fingers close on the bag's seal, 6.4 mm thick (SEAL is that gap); once it has slipped out they snap shut on
  // nothing, and stay shut until the arm opens them over the empty crate
  const SEAL = 0.107;
  const sealGap = (t, scripted) => SEAL * smooth(seg(t, 0.32, 0.38)) * (1 - smooth(scripted ? seg(t, SLIP_B - 0.002, SLIP_B + 0.006) : seg(t, 0.9, 0.96)));
  // while it slips, the seal slides the 2.5 cm the fingers held down through them, and the swing throws the bag out
  // about their lower edge, more and more as less of the seal is held; it trails behind the movement
  const TILT = [-0.5, 0.12, -0.28];
  const slipTilt = (u) => [TILT[0] * u * u, TILT[1] * u, TILT[2] * u * u];
  const mid = V(), half = V();
  function fallPose(t) {
    const s = seg(t, SLIP_B, LAND);
    packet.rotation.set(lerp(TILT[0], -Math.PI / 2, s), rel.yaw + TILT[1] + 0.4 * s, lerp(TILT[2], 0, s), "YXZ");
    // its middle falls from where it came free, drifting the way the swing threw it, and it lands on its back
    mid.set(rel.mid.x + 0.12 * s, lerp(rel.mid.y, 0.036, s * s), rel.mid.z + 0.1 * s);
    packet.position.copy(mid).sub(half.set(0, -PH / 2, 0).applyEuler(packet.rotation));
  }

  function setArm(t, scripted = false) {
    const [a, r, y, g] = track(KEYS, t);
    arm.reach(r * Math.cos(a), y, r * Math.sin(a));
    arm.grip(g + sealGap(t, scripted));
    arm.root.updateMatrixWorld(true);
    return arm.tip.getWorldPosition(tipW);
  }

  // q: progress through the shot (null when the camera is elsewhere), time in seconds
  function update(q, time) {
    if (!rel) {
      // where the bag comes free, worked out once from the arm's path
      const tip = setArm(SLIP_B).clone(), yaw = arm.turret.rotation.y + Math.PI / 2, [x, dy, z] = slipTilt(1);
      const e = new THREE.Euler(x, yaw + dy, z, "YXZ"), origin = V(tip.x, tip.y - 0.01, tip.z);
      rel = { yaw, mid: origin.clone().add(V(0, -PH / 2, 0).applyEuler(e)) };
    }
    const scripted = q !== null;
    const t = scripted ? take(q) : ((time / 6.25) % 1) * 1.25;
    const tip = setArm(t, scripted), yaw = arm.turret.rotation.y + Math.PI / 2;
    if (t < 0.38) {
      packet.position.copy(REST);
      packet.rotation.set(0, PICK_YAW, 0, "YXZ");
    } else if (!scripted || t < SLIP_A) {
      if (t < 0.96) {
        packet.position.set(tip.x, tip.y + 0.015, tip.z);
        packet.rotation.set(0, yaw, 0, "YXZ");
      } else {
        packet.position.set(-14.75, 0.632 + PH, 1.15);
        packet.rotation.set(0, PLACE_YAW, 0, "YXZ");
      }
    } else if (t < SLIP_B) {
      // the bag pivots about the fingers' lower edge, 1 cm below the tip, as its seal slides out between them
      const u = smooth(seg(t, SLIP_A, SLIP_B)), [x, dy, z] = slipTilt(u);
      packet.rotation.set(x, yaw + dy, z, "YXZ");
      packet.position.set(tip.x, tip.y - 0.01, tip.z).add(half.set(0, 0.025 * (1 - u), 0).applyEuler(packet.rotation));
    } else {
      fallPose(t);
    }
  }
  const anchor = () => (rel ? V(rel.mid.x + 0.12, 0.2, rel.mid.z + 0.1) : REST);
  // the story shows a slow-motion badge while the slip plays
  const slow = (q) => q > SLOW_Q[0] && q < SLOW_Q[1];
  return { update, anchor, slow };
}

// ---------- bay 02: a humanoid carries a tote to its shelf slot, finds a stray box in the way, and freezes
function rack(b, x, z0, z1, depth = 0.7, H = 2.4, skip = null) {
  for (let z = z0; z <= z1 + 1e-6; z += 2) for (const s of [-1, 1]) b.box(0.06, H, 0.06, at(x + s * depth / 2, H / 2, z));
  for (const y of [0.15, 0.75, 1.35, 1.95]) {
    b.box(depth, 0.03, z1 - z0, at(x, y, (z0 + z1) / 2));
    for (let z = z0 + 0.5; z < z1 - 0.3; z += 0.95) {
      if (skip && skip(y, z)) continue;
      const w = 0.3 + (Math.abs(z * 7 + y * 13) % 0.25), h = 0.2 + (Math.abs(z * 3 + y * 5) % 0.2);
      b.box(depth * 0.7, h, w, at(x, y + 0.015 + h / 2, z));
    }
  }
}

// a bump that rises over [a, b], holds, and falls over [c, d]
const bump = (t, a, b, c, d) => smooth(seg(t, a, b)) * (1 - smooth(seg(t, c, d)));

function buildHumanoid(scene, b, bay) {
  bayFrame(b, scene, bay, [-17, -19.5]);
  // the robot's slot is on the right-hand rack, second shelf; its usual box is left out (the stray box sits there)
  const SLOT_Z = -20.65, SHELF = 0.765;
  rack(b, -19.3, -24, -18);
  rack(b, -14.7, -24, -18, 0.7, 2.4, (y, z) => y === 0.75 && Math.abs(z - SLOT_Z) < 0.01);
  table(b, -17, -16.3, 1.4, 0.7, 0.85);
  const bot = makeHumanoid(scene);
  loadModel("models/humanoid.glb").then((m) => skin(m, { hum_body: bot.body, hum_head: bot.head,
    hum_sh_n: bot.arms[0].sh, hum_el_n: bot.arms[0].el, hum_sh_p: bot.arms[1].sh, hum_el_p: bot.arms[1].el,
    hum_hip_n: bot.legs[0].hip, hum_knee_n: bot.legs[0].knee, hum_hip_p: bot.legs[1].hip, hum_knee_p: bot.legs[1].knee }));
  // the stray box: crooked, sticking out of the robot's slot. Its outline turns orange when the robot is blocked.
  const stray = joint(scene);
  const strayBox = pbox(0.4, 0.3, 0.34, stray);
  const strayLines = strayBox.children.find((c) => c.isLineSegments);
  const SHELF_POSE = { p: V(-14.92, SHELF + 0.15, SLOT_Z), ry: HALF_PI + 0.35 };
  // the tote once the robot has put it on the shelf
  const placed = joint(scene);
  pbox(0.4, 0.24, 0.32, placed);
  pbox(0.34, 0.002, 0.26, placed, { y: 0.121, face: null, line: M.mid });
  placed.position.set(-14.98, SHELF + 0.12, SLOT_Z);
  placed.rotation.y = HALF_PI;
  // the operator who steps in: she walks round the end of the rack, pulls the stray box out and steps back with it
  const person = makePerson(scene, "operator-f", [-0.3, -0.1, -1.3]);
  const PATH = [V(-13.6, 0, -15.2), V(-15.6, 0, -17.4), V(-15.45, 0, -19.85)], P2 = V(-15.65, 0, -19.35);
  const LEN = [PATH[0].distanceTo(PATH[1]), PATH[1].distanceTo(PATH[2])];
  const FACE_BOX = Math.atan2(SHELF_POSE.p.x - PATH[2].x, SHELF_POSE.p.z - PATH[2].z);
  const tmp = V(), held = V(), turnTo = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a));
  function walkAt(u) {
    const d = u * (LEN[0] + LEN[1]), k = d < LEN[0] ? 0 : 1, f = k ? (d - LEN[0]) / LEN[1] : d / LEN[0];
    const a = PATH[k], c = PATH[k + 1];
    return { pos: tmp.lerpVectors(a, c, clamp(f)), dir: Math.atan2(c.x - a.x, c.z - a.z) };
  }
  // hold the tote at (y, z) in the robot's own frame, with the arms solved so the hands stay on its sides
  const L1 = 0.28, L2 = 0.3;
  function holdTote(y, z) {
    bot.tote.position.set(0, y, z);
    const ty = y + 0.075 - 1.4, tz = z - 0.05, D = Math.min(Math.hypot(ty, tz), L1 + L2 - 0.004);
    const g = Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    const al = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1)), phi = Math.atan2(tz, -ty);
    for (const { sh, el } of bot.arms) { sh.rotation.x = -(phi - al); el.rotation.x = -(Math.PI - g); }
  }
  // a slight crouch, added on top of whatever the legs are doing (so it can step and crouch at once)
  function crouch(c) {
    for (const { hip, knee } of bot.legs) { hip.rotation.x += -0.39 * c; knee.rotation.x += 0.78 * c; }
    bot.body.position.y += -0.06 * c;
  }
  // where the robot is at take time t: down the aisle (z), toward the slot and back (x), turning to the shelf
  const reachAt = (t) => Math.max(bump(t, 0.42, 0.48, 0.52, 0.58), 0.6 * bump(t, 0.66, 0.7, 0.72, 0.76));
  const xAt = (t) => -16.1 + 0.175 * reachAt(t) + 0.65 * smooth(seg(t, 0.9, 0.96)) - 0.3 * smooth(seg(t, 0.975, 1));
  const zAt = (t) => lerp(-23.3, SLOT_Z, seg(t, 0, 0.34));
  const turnAt = (t) => smooth(seg(t, 0.34, 0.42));

  function update(q, time) {
    if (q !== null) {
      const t = clamp(q / 0.8);
      // walk down the aisle, then turn to face the shelf
      const z = zAt(t), x = xAt(t), turn = turnAt(t);
      // two tries at the slot, each blocked by the stray box; then, once the box is gone, the real thing
      const reach = reachAt(t), fin = smooth(seg(t, 0.9, 0.96)), rest = smooth(seg(t, 0.975, 1));
      const isPlaced = t >= 0.97;
      bot.root.position.set(x, 0, z);
      bot.root.rotation.y = turn * HALF_PI;
      // the legs step whenever it moves: the stride follows the distance covered (backwards steps when it backs
      // off), and it takes small steps on the spot while it turns
      const e = 0.004, speed = (Math.abs(xAt(t + e) - xAt(t - e)) + Math.abs(zAt(t + e) - zAt(t - e))) / (2 * e)
        + 0.6 * Math.abs(turnAt(t + e) - turnAt(t - e)) / (2 * e);
      bot.pose(6.5 * (z + 23.3) + 11.7 * (x + 16.1) + 5 * turn, clamp(speed / 4), isPlaced ? 1 - rest : 1);
      bot.tote.visible = !isPlaced;
      placed.visible = isPlaced;
      if (!isPlaced) holdTote(lerp(lerp(1.08, 1.0, reach), 0.945, fin), lerp(lerp(0.5, 0.56, reach), 0.47, fin));
      crouch(fin * (1 - rest));
      // between tries it looks along the shelves, up and down, unsure where the tote should go
      const scan = bump(t, 0.52, 0.56, 0.64, 0.66) + bump(t, 0.76, 0.78, 0.86, 0.9);
      bot.head.rotation.set(0.22 * (1 - scan) + scan * (0.05 + 0.2 * Math.sin(time * 1.7)), Math.sin(time * 2.4) * 0.55 * scan, 0);
      strayLines.material = t >= 0.47 ? M.orangeLine : M.line;
      // the operator walks over, pulls the stray box out of the slot, and steps back with it
      const pw = seg(t, 0.6, 0.8), w = walkAt(pw), back = smooth(seg(t, 0.88, 0.93));
      person.root.position.copy(w.pos).lerp(P2, back);
      person.root.rotation.y = lerp(w.dir, turnTo(w.dir, FACE_BOX), smooth(seg(t, 0.8, 0.83)));
      person.pose(pw * 26, pw > 0 && pw < 1 ? 1 : back > 0 && back < 1 ? 0.5 : 0, t < 0.84 ? smooth(seg(t, 0.8, 0.84)) : 1);
      person.root.updateMatrixWorld(true);
      person.root.localToWorld(held.set(0, 1.08, 0.4));
      const slide = smooth(seg(t, 0.84, 0.88));
      stray.position.lerpVectors(SHELF_POSE.p, held, slide);
      stray.rotation.y = lerp(SHELF_POSE.ry, turnTo(SHELF_POSE.ry, person.root.rotation.y), slide);
    } else {
      // when the camera is elsewhere: the robot walks the aisle; the stray box waits in its slot
      const u = (time / 14) % 1, back = u > 0.5, s = back ? (u - 0.5) * 2 : u * 2;
      const z = back ? lerp(-17.3, -23.0, s) : lerp(-23.0, -17.3, s);
      bot.root.position.set(-16.1, 0, z);
      bot.root.rotation.y = back ? Math.PI : 0;
      bot.pose(z * 6.5, 1);
      bot.tote.visible = true;
      bot.head.rotation.set(0, 0, 0);
      placed.visible = false;
      stray.position.copy(SHELF_POSE.p);
      stray.rotation.y = SHELF_POSE.ry;
      strayLines.material = M.line;
      person.root.position.copy(PATH[0]);
      person.root.rotation.y = -2.3;
      person.pose(0, 0);
    }
  }
  return { update, anchor: () => V(-15.9, 2.05, SLOT_Z) };
}

// ---------- bay 03: a robot is told "pick up the screwdriver", and picks up the pliers.
// The robot and the tools are 3D models made in Blender (models/lab-robot.glb, models/tools.glb).
// The arm poses were solved in Blender to move like a real robot arm picking something up: palm down, wrist
// within 15 degrees of straight, elbow kept by the side, and the thumb and index finger closing on the pliers'
// handles. Values are joint rotations in three.js axes [x, y, z, w].
const POSES = {
  ready: { R_shoulder: [0.1084, 0.00351, -0.08684, 0.9903], R_elbow: [-0.86117, 0, 0, 0.50832], R_wrist_roll: [0, 0.63802, 0, 0.77002], R_wrist: [0, 0, 0.13167, 0.99129] },
  above: { R_shoulder: [0.03902, -0.03383, 0.00709, 0.99864], R_elbow: [-0.79747, 0, 0, 0.60335], R_wrist_roll: [0, 0.71094, 0, 0.70325], R_wrist: [0, 0, 0.01175, 0.99993] },
  grasp: { R_shoulder: [-0.09996, -0.01375, -0.00951, 0.99485], R_elbow: [-0.64422, 0, 0, 0.76484], R_wrist_roll: [0, 0.70675, 0, 0.70746], R_wrist: [0, 0, 0.07791, 0.99696] },
  squeeze: { R_shoulder: [-0.10107, -0.03301, 0.0144, 0.99423], R_elbow: [-0.64094, 0, 0, 0.76759], R_wrist_roll: [0, 0.72636, 0, 0.68732], R_wrist: [0, 0, 0.0718, 0.99742] },
  lift: { R_shoulder: [-0.04393, -0.01313, -0.03296, 0.9984], R_elbow: [-0.83947, 0, 0, 0.5434], R_wrist_roll: [0, 0.68035, 0, 0.73289], R_wrist: [0, 0, 0.03961, 0.99922] },
};
// finger curl for each pose: [index finger, the other three, thumb], added to the relaxed curl
const CURLS = { ready: [0.1, 0.3, 0.05], above: [0.3, 0.5, 0.1], grasp: [0.78, 1.0, 0.47], squeeze: [0.85, 1.05, 0.5], lift: [0.85, 1.05, 0.5] };
// the scripted take, as a share of the shot: [time, from pose, to pose]. The arm starts already raised
// ("ready"), and every frame was checked in Blender: the arm never enters the bench, the tools or the robot's
// own body, and the pliers it carries clear the mat.
const TAKE = [[0, "ready", "ready"], [0.3, "ready", "above"], [0.48, "above", "grasp"], [0.58, "grasp", "squeeze"], [0.85, "squeeze", "lift"]];
const PICK_AT = 0.58;
const ROBOT_AT = V(17.15, 0, -20.68);
const TOOL_Y = 0.904;
// the pliers are 1.3x the size in the tools file (about 24 cm, like large pliers) so their handles fill this
// robot's big hand, and they lie turned so the handles sit square across the pinch
const PLIERS_TURN = 0.3957, PLIERS_SIZE = 1.3;

function buildHand(scene, b, bay) {
  bayFrame(b, scene, bay, [17, -20]);
  table(b, 17, -20, 2.0, 1.0, 0.9);
  b.box(0.56, 0.004, 0.3, at(16.97, 0.902, -20.15));
  b.box(0.02, 0.08, 0.02, at(17.18, 0.94, -20.42));
  // the instruction, on a small screen beside the tools
  let shown = null;
  const task = canvasPlane(0.2, 0.125, 520, (ctx, w, h, picked = false) => {
    shown = picked;
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#9A9A9A";
    ctx.font = MONO(700, h * 0.12);
    ctx.fillText("INSTRUCTION", w * 0.07, h * 0.24);
    ctx.fillStyle = "#F2F2F2";
    ctx.fontStretch = "semi-expanded";
    ctx.font = FONT(800, h * 0.17);
    ctx.fillText("Pick up the", w * 0.07, h * 0.47);
    ctx.fillText("screwdriver.", w * 0.07, h * 0.66);
    if (picked) {
      ctx.fillStyle = "#E85002";
      ctx.font = MONO(700, h * 0.11);
      ctx.fillText("PICKED UP: PLIERS ×", w * 0.07, h * 0.87);
    }
  }, scene);
  task.mesh.position.set(17.18, 0.985, -20.4);
  task.mesh.rotation.set(-0.45, -0.3, 0, "YXZ");

  const Q = {};
  for (const p in POSES) { Q[p] = {}; for (const n in POSES[p]) Q[p][n] = new THREE.Quaternion(...POSES[p][n]); }
  const REST = { tool_screwdriver: V(16.77, TOOL_Y, -20.16), tool_pliers: V(16.995, 0.9066, -20.128), tool_wrench: V(17.15, TOOL_Y, -20.16) };
  const PLIERS_REST = new THREE.Matrix4().compose(REST.tool_pliers, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), PLIERS_TURN), V(PLIERS_SIZE, PLIERS_SIZE, PLIERS_SIZE));
  let robot = null, pliers = null, pliersGrip = null;
  const J = {}, fingers = [], thumb = [];
  const loader = new GLTFLoader();
  // the robot and the tools arrive when their files have loaded
  loader.load("models/lab-robot.glb", (gltf) => {
    robot = gltf.scene;
    robot.position.copy(ROBOT_AT);
    for (const n of ["R_shoulder", "R_elbow", "R_wrist_roll", "R_wrist", "head"]) J[n] = robot.getObjectByName(n);
    for (let f = 1; f <= 4; f++) for (let j = 1; j <= 3; j++) {
      const o = robot.getObjectByName(`R_f${f}_${j}`);
      fingers.push({ o, z0: o.rotation.z, index: f === 1 });
    }
    for (const n of ["R_t_2", "R_t_3"]) { const o = robot.getObjectByName(n); thumb.push({ o, z0: o.rotation.z }); }
    scene.add(robot);
    // how the hand holds the pliers, measured once at the exact moment of the pinch
    applyTake(PICK_AT);
    robot.updateMatrixWorld(true);
    held.copy(J.R_wrist.matrixWorld).invert().multiply(PLIERS_REST);
  });
  loader.load("models/tools.glb", (gltf) => {
    for (const n in REST) {
      const t = gltf.scene.getObjectByName(n);
      t.position.copy(REST[n]);
      scene.add(t);
    }
    pliers = scene.getObjectByName("tool_pliers");
    PLIERS_REST.decompose(pliers.position, pliers.quaternion, pliers.scale);
    // the pliers' grips get their own material, so only they turn orange when picked by mistake
    const m = pliers.getObjectByName("pliers_grip_L").material.clone();
    pliers.traverse((o) => { if (o.isMesh && o.name.startsWith("pliers_grip")) o.material = m; });
    pliersGrip = m;
  });

  const curl = (k) => {
    fingers.forEach(({ o, z0, index }) => { o.rotation.z = z0 + (index ? k[0] : k[1]); });
    thumb.forEach(({ o, z0 }) => { o.rotation.z = z0 + k[2]; });
  };
  const mixCurl = (a, c, s) => CURLS[a].map((v, i) => lerp(v, CURLS[c][i], s));
  // put the arm in the pose for take time t (0 to 1)
  const applyTake = (t) => {
    let i = 1;
    while (i < TAKE.length - 1 && t > TAKE[i][0]) i++;
    const [t0] = TAKE[i - 1], [t1, from, to] = TAKE[i];
    const s = smooth(clamp((t - t0) / (t1 - t0)));
    for (const n in Q.ready) J[n].quaternion.slerpQuaternions(Q[from][n], Q[to][n], s);
    curl(mixCurl(from, to, s));
  };
  const held = new THREE.Matrix4(), carry = new THREE.Matrix4();
  let orange = null;
  const GRIP_DARK = new THREE.Color("#333333"), GRIP_ORANGE = new THREE.Color("#E85002");

  function update(q, time) {
    let picked = false;
    if (robot) {
      if (q !== null) {
        const t = clamp(q / 0.8);
        applyTake(t);
        J.head.rotation.x = 0.3 * smooth(clamp(t / 0.3));
        picked = t >= PICK_AT;
      } else {
        for (const n in Q.ready) J[n].quaternion.copy(Q.ready[n]);
        curl(CURLS.ready);
        J.head.rotation.x = 0.12 + Math.sin(time * 0.6) * 0.05;
      }
      robot.updateMatrixWorld(true);
    }
    if (pliers) {
      // once pinched, the pliers move with the hand, held exactly as they were at the pinch
      if (picked) carry.multiplyMatrices(J.R_wrist.matrixWorld, held).decompose(pliers.position, pliers.quaternion, pliers.scale);
      else PLIERS_REST.decompose(pliers.position, pliers.quaternion, pliers.scale);
      if (picked !== orange) { orange = picked; pliersGrip.color.copy(picked ? GRIP_ORANGE : GRIP_DARK); }
    }
    if (picked !== shown) task.redraw(picked);
  }
  // the failure label sits just left of the lifted hand, clear of the instruction screen on its right
  return { update, anchor: () => V(16.82, 1.14, -20.26) };
}

// ---------- bay 04: a delivery robot carries medicine down a mock hospital corridor,
// and drives into a glass door it didn't see
function buildRover(scene, b, bay) {
  bayFrame(b, scene, bay, [17, 0.5], true);
  const H = 2.6, t = 0.12;
  b.box(t, H, 10.4, at(14.6, H / 2, 0));
  b.box(t, H, 5.2, at(19.4, H / 2, -2.6)).box(t, H, 4.0, at(19.4, H / 2, 3.2)).box(t, 0.5, 1.2, at(19.4, 2.35, 0.6));
  const dx = 14.665;
  b.lines([dx, 0, -3, dx, 2.05, -3, dx, 2.05, -3, dx, 2.05, -2, dx, 2.05, -2, dx, 0, -2], "mid");
  b.box(0.04, 0.04, 10.2, at(14.7, 0.9, 0));
  b.box(0.04, 0.04, 5.0, at(19.3, 0.9, -2.6)).box(0.04, 0.04, 3.8, at(19.3, 0.9, 3.2));
  b.lines([17, 0.004, -5, 17, 0.004, 5], "faint");
  const sign = canvasPlane(2.2, 0.6, 520, (ctx, w, h) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = FONT(800, h * 0.62);
    ctx.fillText("WARD 4", w * 0.02, h * 0.74);
  }, scene, { mat: inked(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.6 })) });
  sign.mesh.rotation.x = -Math.PI / 2;
  sign.mesh.position.set(18.1, 0.006, 4.2);

  // the glass door: a frame, see-through panes and a few reflection lines
  const GZ = -1.0, gx0 = 14.66, gx1 = 19.34;
  b.box(0.06, 2.25, 0.06, at(gx0 + 0.03, 1.125, GZ)).box(0.06, 2.25, 0.06, at(gx1 - 0.03, 1.125, GZ)).box(gx1 - gx0, 0.08, 0.06, at(17, 2.25, GZ));
  b.box(0.04, 2.2, 0.05, at(17, 1.1, GZ));
  b.box(0.03, 0.3, 0.05, at(16.9, 1.05, GZ + 0.03)).box(0.03, 0.3, 0.05, at(17.1, 1.05, GZ + 0.03));
  const G = [];
  for (const [x0, x1] of [[gx0 + 0.06, 16.98], [17.02, gx1 - 0.06]]) {
    G.push(x0, 0.03, GZ, x1, 0.03, GZ);
    for (const a of [0.3, 0.62]) { const xa = lerp(x0, x1, a); G.push(xa, 1.45, GZ, xa + 0.38, 1.85, GZ, xa + 0.12, 1.4, GZ, xa + 0.3, 1.58, GZ); }
  }
  b.lines(G, "mid");
  // a pale tint so the panes read as glass
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xcfe0e6, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  for (const [x0, x1] of [[gx0 + 0.06, 16.98], [17.02, gx1 - 0.06]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2.17), glassMat);
    pane.position.set((x0 + x1) / 2, 1.115, GZ);
    scene.add(pane);
  }
  // the crack where it hits, in orange
  const CP = V(16.6, 0.42, GZ + 0.012), cr = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3, r = 0.2 + (i % 3) * 0.12;
    cr.push(CP.x, CP.y, CP.z, CP.x + Math.cos(a) * r, CP.y + Math.sin(a) * r, CP.z);
  }
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
    cr.push(CP.x + Math.cos(a0) * 0.11, CP.y + Math.sin(a0) * 0.11, CP.z, CP.x + Math.cos(a1) * 0.11, CP.y + Math.sin(a1) * 0.11, CP.z);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cr), 3));
  const crack = new THREE.LineSegments(cg, M.orangeLine);
  crack.visible = false;
  scene.add(crack);
  // the route it planned, straight through the door (shown only while its own scene plays: from the other bays and
  // the wide shots it read as a stray orange streak on the floor)
  const route = lineObj([[16.6, 0.01, 4.8], [16.6, 0.01, -4.8]], scene, M.dash);

  const bot = makeRover(scene);
  loadModel("models/amr.glb").then((m) => skin(m, { amr_body: bot.root }));
  // where it stops against the glass: its nose is 0.44 m in front of its centre, plus a hair's gap
  const HIT = GZ + 0.47;

  function update(q, time) {
    if (q !== null) {
      const tq = clamp(q / 0.8);
      const bump = Math.sin(seg(tq, 0.58, 0.66) * Math.PI) * 0.08;
      bot.root.position.set(16.6, 0, lerp(4.8, HIT, seg(tq, 0, 0.58)) + bump);
      bot.root.rotation.y = Math.PI;
      crack.visible = tq >= 0.58;
      route.visible = true;
    } else {
      const u = (time / 14) % 1, back = u > 0.5, s = smooth(back ? (u - 0.5) * 2 : u * 2);
      bot.root.position.set(16.6, 0, back ? lerp(0.2, 4.6, s) : lerp(4.6, 0.2, s));
      bot.root.rotation.y = back ? 0 : Math.PI;
      crack.visible = false;
      route.visible = false;
    }
  }
  return { update, anchor: () => CP.clone() };
}

export function buildBays(scene, b) {
  const build = { packing: buildPacking, humanoid: buildHumanoid, hand: buildHand, rover: buildRover };
  const out = {};
  for (const bay of BAYS) out[bay.key] = build[bay.key](scene, b, bay);
  return out;
}
