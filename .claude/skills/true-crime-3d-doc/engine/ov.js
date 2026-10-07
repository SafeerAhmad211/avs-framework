// Overlay graphics on one deterministic GSAP timeline (registered as window.__timelines.main)
const root = () => document.getElementById("root");
function el(cls, html, style) { const d = document.createElement("div"); d.className = "ov " + cls; d.innerHTML = html; if (style) Object.assign(d.style, style); root().appendChild(d); return d; }
export function createOverlay(dur) {
  const tl = gsap.timeline({ paused: true });
  tl.to({}, { duration: dur }, 0);
  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  const fadeIO = (d, t0, t1, fi = 0.8, fo = 0.8, y = 0) => { tl.fromTo(d, { opacity: 0, y }, { opacity: 1, y: 0, duration: fi, ease: "power2.out" }, t0); tl.to(d, { opacity: 0, duration: fo, ease: "power2.in" }, t1 - fo); };
  return {
    tl,
    chapter(num, title, t0, t1) {
      const d = el("chap", `<div class="num">${num}</div><div class="tt">${title}</div><div class="rule"></div>`);
      fadeIO(d, t0, t1, 1.0, 1.0);
      tl.fromTo(d.querySelector(".tt"), { letterSpacing: "0.18em" }, { letterSpacing: "0.03em", duration: t1 - t0, ease: "power1.out" }, t0);
      tl.fromTo(d.querySelector(".rule"), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power3.inOut" }, t0 + 0.5);
    },
    lower(name, desc, t0, t1) { const d = el("lt", `<span class="n">${name}</span><span class="d">${desc}</span>`); tl.fromTo(d, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.8, ease: "power2.out" }, t0); tl.to(d, { opacity: 0, duration: 0.6 }, t1 - 0.6); },
    stamp(text, t0, t1, style) {
      const d = el("stamp", "", style); tl.set(d, { opacity: 1 }, t0); tl.set(d, { textContent: "" }, 0);
      for (let i = 1; i <= text.length; i++) tl.set(d, { textContent: text.slice(0, i) }, t0 + i * 0.05);
      tl.to(d, { opacity: 0, duration: 0.6 }, t1 - 0.6);
    },
    quote(q, s, t0, t1) { const d = el("quote", `<div class="q">${q}</div>${s ? `<div class="s">${s}</div>` : ""}`); fadeIO(d, t0, t1, 1.2, 0.8, 14); },
    tag(text, t0, t1) { const d = el("tag", text); fadeIO(d, t0, t1, 0.8, 0.8); },
    src(text, t0, t1) { const d = el("src", text); fadeIO(d, t0, t1, 0.8, 0.8); },
    label(text, t0, t1, x, y) { const d = el("label3", text, { left: x + "px", top: y + "px" }); fadeIO(d, t0, t1, 0.6, 0.6, 10); return d; },
    stats(rows, t0, t1) {
      const d = el("stat", rows.map((r) => `<div class="row"><div class="lab">${r[0]}</div><div class="bar"></div><div class="val">0%</div></div>`).join(""));
      fadeIO(d, t0, t1, 0.6, 0.8);
      d.querySelectorAll(".row").forEach((row, i) => {
        const bar = row.querySelector(".bar"), val = row.querySelector(".val"), target = rows[i][1], ts = t0 + 0.6 + i * 1.6;
        tl.fromTo(bar, { width: 0 }, { width: target * 8 + "px", duration: 1.4, ease: "power2.out" }, ts);
        const o = { v: 0 }; tl.fromTo(o, { v: 0 }, { v: target, duration: 1.4, ease: "power2.out", onUpdate: () => (val.textContent = Math.round(o.v) + "%") }, ts);
      });
    },
    end(a, b, c, t0, t1) { const d = el("end", `<div class="a">${a}</div><div class="b">${b}</div><div class="c">${c}</div>`); fadeIO(d, t0, t1, 1.6, 1.2); tl.fromTo(d.querySelector(".c"), { opacity: 0 }, { opacity: 1, duration: 1.5 }, t0 + 3.5); },
  };
}
