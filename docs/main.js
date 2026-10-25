(() => {
  "use strict";

  // the scroll story lives in js/story.js (3D, needs module scripts); this file runs the rest of the page
  const NS = "http://www.w3.org/2000/svg";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const f2 = (n) => Math.round(n * 100) / 100;

  if (!("noModule" in HTMLScriptElement.prototype)) root.classList.add("no-3d");
  // for testing only: index.html#static hides the story so the sections below it can be checked
  if (location.hash === "#static") root.classList.add("test-static");

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---------- footer: the NITH letters, drawn like a construction drawing
  function buildWordmark(svg) {
    const sw = 12, gap = 30, hw = (sw * 1.12) / Math.sin(Math.atan2(100, 128));
    const polys = [];
    let x = 0;
    polys.push([[x, 0], [x + sw, 0], [x + sw, 100], [x, 100]], [[x + 116, 0], [x + 128, 0], [x + 128, 100], [x + 116, 100]],
      [[x, 0], [x + hw, 0], [x + 128, 100], [x + 128 - hw, 100]]);
    x += 128 + gap;
    polys.push([[x, 0], [x + sw, 0], [x + sw, 100], [x, 100]]);
    x += sw + gap;
    polys.push([[x, 0], [x + 112, 0], [x + 112, sw], [x, sw]], [[x + 50, 0], [x + 62, 0], [x + 62, 100], [x + 50, 100]]);
    x += 112 + gap;
    polys.push([[x, 0], [x + sw, 0], [x + sw, 100], [x, 100]], [[x + 116, 0], [x + 128, 0], [x + 128, 100], [x + 116, 100]],
      [[x, 44], [x + 128, 44], [x + 128, 56], [x, 56]]);
    const k = 1296 / 470, seen = new Set();
    let ticks = "";
    for (const pl of polys) {
      const pts = pl.map(([a, b]) => [f2(a * k), f2(b * k)]);
      el("path", { d: "M" + pts.map((p) => p.join(" ")).join("L") + "Z", pathLength: 1, class: "wm" }, svg);
      for (const [a, b] of pts) {
        const key = a + "," + b;
        if (!seen.has(key)) {
          seen.add(key);
          ticks += `M${f2(a - 5)} ${b}h10M${a} ${f2(b - 5)}v10`;
        }
      }
    }
    el("path", { d: ticks, class: "wm-tick" }, svg);
    el("path", { d: `M-40 0H1336M-40 ${f2(100 * k)}H1336`, class: "wm-guide" }, svg);
  }

  const wm = document.querySelector("#wordmark");
  if (!wm) return;
  buildWordmark(wm);
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { wm.classList.add("on"); io.disconnect(); }
      });
    }, { threshold: 0.3 });
    io.observe(wm);
  } else wm.classList.add("on");
})();
