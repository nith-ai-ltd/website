// The machines and people in the lab. Each returns its parts so the story can move them.
import { THREE, M, pbox, pcyl, part, joint, skin, loadModel, inked, clamp, lerp } from "./kit.js?v=13";
import { mergeVertices } from "../vendor/three/examples/jsm/utils/BufferGeometryUtils.js";

const HALF_PI = Math.PI / 2;

// ---------- a six-axis robot arm with a two-finger gripper (about 1 m reach)
const L1 = 0.55, L2 = 0.5, LW = 0.17, SH = 0.46;
export function makeArm(parent, x, y, z, ry = 0) {
  const root = joint(parent, x, y, z);
  root.rotation.y = ry;
  pcyl(0.17, 0.19, 0.16, 14, root, { y: 0.08 });
  const turret = joint(root, 0, 0.16, 0);
  pcyl(0.13, 0.15, 0.2, 12, turret, { y: 0.1 });
  const shoulder = joint(turret, 0, 0.3, 0);
  pcyl(0.085, 0.085, 0.16, 12, shoulder, { rx: HALF_PI });
  pbox(0.11, L1, 0.12, shoulder, { y: L1 / 2 });
  const elbow = joint(shoulder, 0, L1, 0);
  pcyl(0.07, 0.07, 0.14, 12, elbow, { rx: HALF_PI });
  pbox(0.085, L2, 0.095, elbow, { y: L2 / 2 });
  const wrist = joint(elbow, 0, L2, 0);
  pcyl(0.045, 0.045, 0.1, 10, wrist, { rx: HALF_PI });
  pcyl(0.04, 0.04, 0.07, 10, wrist, { y: 0.05 });
  pbox(0.13, 0.03, 0.06, wrist, { y: 0.095 });
  const fl = joint(wrist, -0.04, 0.145, 0), fr = joint(wrist, 0.04, 0.145, 0);
  pbox(0.018, 0.07, 0.045, fl);
  pbox(0.018, 0.07, 0.045, fr);
  const tip = joint(wrist, 0, LW, 0);

  // point the gripper straight down at a spot given in the arm's own coordinates
  function reach(tx, ty, tz) {
    const r = Math.max(0.05, Math.hypot(tx, tz));
    const dy = ty + LW - SH;
    const d = Math.min(Math.hypot(r, dy), L1 + L2 - 1e-3);
    const phi = Math.atan2(r, dy);
    const a1 = phi - Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    turret.rotation.y = Math.atan2(-tz, tx);
    shoulder.rotation.z = -a1;
    elbow.rotation.z = -bend;
    wrist.rotation.z = -(Math.PI - a1 - bend);
  }
  // 0 = closed, 1 = open
  function grip(open) {
    const g = 0.014 + 0.03 * open;
    fl.position.x = -g;
    fr.position.x = g;
  }
  grip(1);
  reach(0.6, 0.3, 0);
  return { root, turret, shoulder, elbow, wrist, fl, fr, tip, reach, grip };
}

// ---------- a humanoid robot, about 1.7 m tall, that can walk and carry a tote
export function makeHumanoid(parent) {
  const root = joint(parent);
  const body = joint(root);
  pbox(0.3, 0.12, 0.18, body, { y: 0.95 });
  pbox(0.36, 0.42, 0.22, body, { y: 1.22 });
  pbox(0.26, 0.3, 0.06, body, { y: 1.24, z: -0.14 });
  pbox(0.2, 0.05, 0.005, body, { y: 1.33, z: 0.112, face: null, line: M.mid });
  pcyl(0.04, 0.045, 0.07, 10, body, { y: 1.47 });
  const head = joint(body, 0, 1.5, 0);
  pbox(0.2, 0.22, 0.21, head, { y: 0.11 });
  pbox(0.16, 0.06, 0.02, head, { y: 0.13, z: 0.105, face: M.ink });
  const arms = [-1, 1].map((s) => {
    const sh = joint(body, 0.235 * s, 1.4, 0);
    pcyl(0.055, 0.055, 0.1, 10, sh, { rz: HALF_PI });
    pbox(0.08, 0.28, 0.08, sh, { y: -0.14 });
    const el = joint(sh, 0, -0.28, 0);
    pbox(0.07, 0.26, 0.07, el, { y: -0.13 });
    pbox(0.035, 0.09, 0.07, el, { y: -0.3 });
    return { sh, el };
  });
  const legs = [-1, 1].map((s) => {
    const hip = joint(body, 0.1 * s, 0.9, 0);
    pbox(0.11, 0.4, 0.12, hip, { y: -0.2 });
    const knee = joint(hip, 0, -0.4, 0);
    pcyl(0.055, 0.055, 0.12, 10, knee, { rz: HALF_PI });
    pbox(0.095, 0.4, 0.1, knee, { y: -0.2 });
    pbox(0.1, 0.05, 0.22, knee, { y: -0.425, z: 0.04 });
    return { hip, knee };
  });
  // the tote sits between the robot's hands, held near its far end so a person can take the front
  const tote = joint(body, 0, 1.08, 0.5);
  pbox(0.4, 0.24, 0.32, tote);
  pbox(0.34, 0.002, 0.26, tote, { y: 0.121, face: null, line: M.mid });

  function pose(phase, walk, carry = 1) {
    legs.forEach(({ hip, knee }, k) => {
      const s = k ? -1 : 1;
      hip.rotation.x = Math.sin(phase) * 0.42 * walk * s;
      knee.rotation.x = Math.max(0, Math.sin(phase + (k ? Math.PI : 0) + HALF_PI)) * 0.55 * walk;
    });
    arms.forEach(({ sh, el }) => {
      sh.rotation.x = -0.55 * carry;
      el.rotation.x = -1.0 * carry;
    });
    body.position.y = Math.abs(Math.sin(phase)) * 0.018 * walk - 0.01 * walk;
    tote.visible = carry > 0.5;
  }
  pose(0, 0);
  return { root, body, head, arms, legs, pose, tote };
}

// ---------- a person: one of the lab's workers, drawn as a solid dark silhouette so people never look like robots.
// Each worker's body shape was built in Blender from their character sheet (models/person-<who>.glb); until the
// file arrives they show as a simpler silhouette with the same joints. A thin outline in the ink colour rims them
// in light when the lab is dark (like everything else in the line drawing) and disappears into them when it's lit.
const PERSON = new THREE.MeshBasicMaterial({ color: 0x161616 });
const RIM = inked(new THREE.MeshBasicMaterial({ color: 0xe2e2e2, side: THREE.BackSide }));
function rim(mesh, w = 0.006) {
  const g = mergeVertices(mesh.geometry.clone());
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  mesh.add(new THREE.Mesh(g, RIM));
}
// carryPose is [shoulder forward, shoulder out, elbow] for holding a 0.4 m box 0.4 m in front; it was fitted in
// Blender so the forearms run along the box sides without passing through it.
export function makePerson(parent, who = null, carryPose = [-0.35, 0.1, -1.2]) {
  const root = joint(parent);
  const body = joint(root);
  const mat = { face: PERSON, line: null };
  const capsule = (r, len, p, o) => part(new THREE.CapsuleGeometry(r, len, 3, 10), p, { ...mat, ...o });
  capsule(0.15, 0.32, body, { y: 1.22 });
  part(new THREE.SphereGeometry(0.11, 14, 10), body, { ...mat, y: 1.63 });
  const arms = [-1, 1].map((s) => {
    const sh = joint(body, 0.2 * s, 1.42, 0);
    capsule(0.045, 0.22, sh, { y: -0.15 });
    const el = joint(sh, 0, -0.3, 0);
    capsule(0.04, 0.2, el, { y: -0.14 });
    return { sh, el, s };
  });
  const legs = [-1, 1].map((s) => {
    const hip = joint(body, 0.085 * s, 0.9, 0);
    capsule(0.065, 0.34, hip, { y: -0.22 });
    const knee = joint(hip, 0, -0.43, 0);
    capsule(0.058, 0.34, knee, { y: -0.24 });
    return { hip, knee };
  });
  if (who) {
    loadModel(`models/person-${who}.glb`).then((m) => {
      const meshes = [];
      m.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const o of meshes) { o.material = PERSON; rim(o); }
      skin(m, {
        per_body: body, per_apron: body, per_sh_n: arms[0].sh, per_el_n: arms[0].el, per_sh_p: arms[1].sh, per_el_p: arms[1].el,
        per_hip_n: legs[0].hip, per_knee_n: legs[0].knee, per_hip_p: legs[1].hip, per_knee_p: legs[1].knee,
      }, true);
    });
  }
  // walk swings the arms and legs and bends the knees; carry (0 to 1) brings the arms round a box
  function pose(phase, walk, carry = 0) {
    legs.forEach(({ hip, knee }, k) => {
      hip.rotation.x = Math.sin(phase) * 0.45 * walk * (k ? -1 : 1);
      knee.rotation.x = Math.max(0, Math.sin(phase + (k ? Math.PI : 0) + HALF_PI)) * 0.5 * walk;
    });
    arms.forEach(({ sh, el, s }, k) => {
      sh.rotation.x = lerp(-Math.sin(phase) * 0.35 * walk * (k ? -1 : 1), carryPose[0], carry);
      sh.rotation.z = carryPose[1] * s * carry;
      el.rotation.x = lerp(-0.2 * walk, carryPose[2], carry);
    });
  }
  pose(0, 0);
  return { root, pose };
}

// ---------- a robot hand with four fingers and a thumb, hanging from a gantry rod
export function makeHand(parent) {
  const root = joint(parent);
  pbox(0.03, 0.62, 0.03, root, { y: 0.34 });
  pcyl(0.03, 0.03, 0.05, 12, root, { y: 0.015 });
  pbox(0.085, 0.095, 0.03, root, { y: -0.06 });
  const fingers = [-0.03, -0.01, 0.01, 0.03].map((fx) => {
    const segs = [];
    let p = joint(root, fx, -0.108, 0);
    for (const [len, w] of [[0.04, 0.017], [0.03, 0.016], [0.022, 0.015]]) {
      segs.push(p);
      pbox(w, len, 0.017, p, { y: -len / 2 });
      p = joint(p, 0, -len, 0);
    }
    return segs;
  });
  const thumb = [];
  let t = joint(root, 0.048, -0.05, 0.012);
  t.rotation.z = 0.7;
  for (const len of [0.035, 0.028]) {
    thumb.push(t);
    pbox(0.018, len, 0.018, t, { y: -len / 2 });
    t = joint(t, 0, -len, 0);
  }
  // where a held item sits, between the thumb and the fingertips
  const grip = joint(root, 0.012, -0.2, 0.018);

  // 0 = open hand, 1 = pinching
  function curl(c) {
    fingers.forEach((segs, k) => segs.forEach((s, j) => { s.rotation.x = -(0.25 + 0.35 * c) * (j ? 1 : 0.7) - (k === 3 ? 0.2 * c : 0); }));
    thumb.forEach((s, j) => { s.rotation.x = -0.4 * c; s.rotation.z = j ? 0.5 * c : 0.7 - 0.4 * c; });
  }
  curl(1);
  return { root, grip, curl };
}

// ---------- a hospital delivery robot: a box on wheels with a sensor on a mast
export function makeRover(parent) {
  const root = joint(parent);
  pbox(0.6, 0.78, 0.72, root, { y: 0.5 });
  pbox(0.56, 0.05, 0.68, root, { y: 0.915 });
  pbox(0.36, 0.15, 0.012, root, { y: 0.72, z: 0.366, face: M.ink });
  pbox(0.62, 0.08, 0.06, root, { y: 0.16, z: 0.37 });
  for (const [wx, wz] of [[-0.3, 0.24], [0.3, 0.24], [-0.3, -0.24], [0.3, -0.24]]) pcyl(0.09, 0.09, 0.06, 12, root, { x: wx, y: 0.09, z: wz, rz: HALF_PI });
  pbox(0.03, 0.3, 0.03, root, { y: 1.08, z: -0.28 });
  pcyl(0.06, 0.06, 0.05, 14, root, { y: 1.255, z: -0.28 });
  return { root };
}
