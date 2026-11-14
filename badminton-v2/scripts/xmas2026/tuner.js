
/* ---------- tuner mode (temporary_files/bunny-position-tuner.html) ---------- */
if (window.TUNE) {
  document.querySelector(".bar").innerHTML = `<h1>Magnet tuner</h1>
    <p>Drag the bunny or the racket to move them · yellow corner resizes the bunny · blue dashed line moves the name · sliders set card text, tile height and racket size/angle</p>`;
  const grid = document.getElementById("grid");
  grid.style.display = "block";
  const slider = (id, label, min, max, step) =>
    `<label style="display:grid;grid-template-columns:118px 1fr 44px;gap:8px;align-items:center;font-size:13px">${label}
       <input type="range" id="${id}" min="${min}" max="${max}" step="${step}"><output id="${id}-o" style="font-variant-numeric:tabular-nums;text-align:right"></output></label>`;
  grid.innerHTML = `<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">
    <div id="stage" style="flex:1 1 360px;max-width:900px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;touch-action:none"></div>
    <div style="flex:0 0 330px;display:flex;flex-direction:column;gap:9px">
      <label>Player <select id="who"></select></label>
      <label>Frame <select id="frm"><option value="1" selected>D · Snow Ticket</option><option value="0">A · Candy Cane</option></select></label>
      <label>Card <select id="md"><option value="hl">Highlights</option><option value="full">Full list</option></select></label>
      <label>View <select id="vw"><option value="all">Whole magnet</option><option value="card">Zoom on card</option></select></label>
      <label><input type="checkbox" id="real"> Also show at ≈ print size</label>
      <b style="font-size:13px;margin-top:4px">Highlights card</b>
      ${slider("tileH", "Tile height", 70, 160, 1)}
      ${slider("bigFs", "Big number", 24, 70, 1)}
      ${slider("labelFs", "Label text", 12, 34, 0.5)}
      ${slider("badgeFs", "Rank badge", 10, 24, 0.5)}
      ${slider("totLabelFs", "PLACES/TOP 3 text", 10, 22, 0.5)}
      <b style="font-size:13px;margin-top:4px">Headline ribbon</b>
      <label style="font-size:13px">Text <input id="ttxt" style="width:100%;padding:5px 8px;border:1px solid var(--line);border-radius:7px;font:inherit"></label>
      ${slider("tfs", "Text size", 14, 40, 0.5)}
      ${slider("ty", "Top edge", 40, 400, 1)}
      <b style="font-size:13px;margin-top:4px">Print fit</b>
      ${slider("fitx", "Width", 0.85, 1, 0.005)}
      ${slider("fity", "Height", 0.85, 1, 0.005)}
      <p id="fitinfo" style="margin:0;font-size:12px;color:var(--mut)"></p>
      <b style="font-size:13px;margin-top:4px">Racket (this frame)</b>
      ${slider("rs", "Size", 0.4, 2, 0.05)}
      ${slider("rr", "Angle", -180, 180, 1)}
      <b style="font-size:13px;margin-top:4px">Shuttles (this frame) · click one to select, drag to move</b>
      <div id="shlist" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      ${slider("shs", "Size", 0.2, 1.8, 0.05)}
      ${slider("shr", "Angle", -180, 180, 1)}
      <div style="display:flex;gap:8px">
        <button id="shhide" style="flex:1;border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px;font:inherit;font-size:13px;cursor:pointer">Hide selected</button>
        <button id="shadd" style="flex:1;border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px;font:inherit;font-size:13px;cursor:pointer">+ Add shuttle</button>
      </div>
      <p id="pts" style="margin:0;font-size:12px;color:var(--mut)"></p>
      <pre id="out" style="margin:0;padding:10px;background:#1b1220;color:#f3cf7a;border-radius:8px;font-size:12px;white-space:pre-wrap"></pre>
      <button id="cp" style="border:0;background:var(--pur);color:#fff;border-radius:7px;padding:8px;font:inherit;cursor:pointer">Copy values</button>
      <button id="reset" style="border:1px solid var(--line);background:#fff;border-radius:7px;padding:8px;font:inherit;cursor:pointer">Reset</button>
      <p style="margin:0;font-size:12px;color:var(--mut)">Units are magnet pixels (600 × 900 = 2 × 3 in at 300 dpi; 1 px prints as 0.24 pt). Bunny and name are measured from the card's top-left, so they fit every player. Paste the copied block back to Claude.</p>
    </div></div>
    <div id="realbox" style="display:none;margin-top:18px"><p style="margin:0 0 6px;font-size:12px;color:var(--mut)">≈ print size (2 × 3 in at 96 CSS px per inch; real screens vary)</p><div id="real-svg" style="width:192px"></div></div>`;
  const START = JSON.stringify({ BUN, CARD, RKT, TITLE, SHUT, FIT });
  let SEL = 0;   // selected shuttle index in the current frame
  const who = document.getElementById("who");
  who.innerHTML = PLAYERS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
  ["who", "frm", "md", "vw", "real"].forEach(id => document.getElementById(id).addEventListener("change", draw));
  const frameKey = () => FRAMES[document.getElementById("frm").value].id;
  const SL = { tileH: [CARD, "tileH"], bigFs: [CARD, "bigFs"], labelFs: [CARD, "labelFs"], badgeFs: [CARD, "badgeFs"], totLabelFs: [CARD, "totLabelFs"], tfs: [TITLE, "fs"], ty: [TITLE, "y"], fitx: [FIT, "sx"], fity: [FIT, "sy"] };
  document.getElementById("ttxt").value = TITLE.text;
  document.getElementById("ttxt").addEventListener("input", e => { TITLE.text = e.target.value; draw(); });
  for (const id of Object.keys(SL)) document.getElementById(id).addEventListener("input", e => { SL[id][0][SL[id][1]] = +e.target.value; draw(); });
  document.getElementById("rs").addEventListener("input", e => { RKT[frameKey()].s = +e.target.value; draw(); });
  document.getElementById("rr").addEventListener("input", e => { RKT[frameKey()].rot = +e.target.value; draw(); });
  const curShut = () => SHUT[frameKey()][SEL];
  document.getElementById("frm").addEventListener("change", () => { SEL = 0; draw(); });
  document.getElementById("shs").addEventListener("input", e => { if (curShut()) { curShut().s = +e.target.value; draw(); } });
  document.getElementById("shr").addEventListener("input", e => { if (curShut()) { curShut().rot = +e.target.value; draw(); } });
  document.getElementById("shhide").addEventListener("click", () => { const q = curShut(); if (q) { q.on = q.on === false; draw(); } });
  document.getElementById("shadd").addEventListener("click", () => { const arr = SHUT[frameKey()]; arr.push({ x: 300, y: 300, rot: 30, s: .8, c: frameKey() === "snow" ? "#b8862b" : "#c62828" }); SEL = arr.length - 1; draw(); });
  document.getElementById("shlist").addEventListener("click", e => { const b = e.target.closest("[data-pick]"); if (b) { SEL = +b.dataset.pick; draw(); } });
  let drag = null;
  const cardBox = () => { const r = document.querySelector('#stage rect[fill="#fffdfb"]'); return { x: +r.getAttribute("x"), y: +r.getAttribute("y"), h: +r.getAttribute("height") }; };
  const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
  function syncSliders() {
    for (const id of Object.keys(SL)) { const v = SL[id][0][SL[id][1]]; document.getElementById(id).value = v; document.getElementById(id + "-o").textContent = v; }
    const k = RKT[frameKey()];
    document.getElementById("rs").value = k.s; document.getElementById("rs-o").textContent = k.s;
    document.getElementById("rr").value = k.rot; document.getElementById("rr-o").textContent = k.rot + "°";
    const arr = SHUT[frameKey()], q = arr[SEL];
    document.getElementById("shlist").innerHTML = arr.map((s, i) =>
      `<button data-pick="${i}" style="border:1px solid ${i === SEL ? "var(--pur)" : "var(--line)"};background:${i === SEL ? "var(--pur)" : "#fff"};color:${i === SEL ? "#fff" : "inherit"};border-radius:7px;padding:3px 9px;font:inherit;font-size:12px;cursor:pointer;${s.on === false ? "opacity:.5;text-decoration:line-through" : ""}">#${i + 1}</button>`).join("");
    if (q) {
      document.getElementById("shs").value = q.s; document.getElementById("shs-o").textContent = q.s;
      document.getElementById("shr").value = q.rot; document.getElementById("shr-o").textContent = q.rot + "°";
      document.getElementById("shhide").textContent = q.on === false ? "Show selected" : "Hide selected";
    }
  }
  function draw() {
    MODE = document.getElementById("md").value;
    const p = PLAYERS[who.value], t = FRAMES[document.getElementById("frm").value];
    document.getElementById("stage").innerHTML = magnetSVG(t, p, false);
    const svg = document.querySelector("#stage > svg"), c = cardBox();
    const fy = (v) => H * (1 - FIT.sy) / 2 + v * FIT.sy;
    if (document.getElementById("vw").value === "card") svg.setAttribute("viewBox", `0 ${fy(c.y) - 60} ${W} ${c.h * FIT.sy + 90}`);
    const fitG = svg.querySelector("g[data-fit]");
    svg.style.cssText = "width:auto;max-width:100%;height:auto;max-height:calc(100vh - 140px);display:block;margin:0 auto;user-select:none";
    const bw = BUN.h * 119 / 165, bx = c.x + BUN.x, by = c.y + BUN.y;
    fitG.insertAdjacentHTML("beforeend", `
      <rect x="${bx}" y="${by}" width="${bw}" height="${BUN.h}" fill="none" stroke="#f3cf7a" stroke-width="1.2" stroke-dasharray="4 3" pointer-events="none"/>
      <path d="M${c.x + BUN.nameX} ${c.y + 10} V${c.y + 72}" stroke="#7fe3ff" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>
      <path data-nm="1" d="M${c.x + BUN.nameX} ${c.y + 10} V${c.y + 72}" stroke="rgba(0,0,0,0)" stroke-width="16" style="cursor:ew-resize"/>
      <rect id="hdl" x="${bx + bw - 7}" y="${by + BUN.h - 7}" width="14" height="14" rx="3" fill="#f3cf7a" stroke="#1b1220" stroke-width="1.5" style="cursor:nwse-resize"/>`);
    document.getElementById("bun").style.cursor = "move";
    const rk = document.getElementById("rkt"); if (rk) rk.style.cursor = "move";
    document.querySelectorAll("#stage [data-sh]").forEach(g => { g.style.cursor = "move"; });
    const selG = document.querySelector(`#stage [data-sh="${SEL}"]`);
    if (selG) { const b = selG.getBBox(); fitG.insertAdjacentHTML("beforeend", `<rect x="${b.x - 4}" y="${b.y - 4}" width="${b.width + 8}" height="${b.height + 8}" rx="6" fill="none" stroke="#e0457b" stroke-width="2" stroke-dasharray="5 3" pointer-events="none"/>`); }
    const realBox = document.getElementById("realbox");
    realBox.style.display = document.getElementById("real").checked ? "block" : "none";
    if (document.getElementById("real").checked) document.getElementById("real-svg").innerHTML = magnetSVG(t, p, false).replace("<svg ", '<svg style="width:192px;height:288px;display:block" ').replace(/id="/g, 'id="r-').replace(/url\(#/g, "url(#r-");
    const paperW = W * (5 / 2.54) / 2, px0 = (W - paperW) / 2;
    svg.insertAdjacentHTML("beforeend", `<g pointer-events="none"><rect x="${px0}" y="0" width="${paperW}" height="${H}" fill="none" stroke="#e0457b" stroke-width="2" stroke-dasharray="10 6"/>
      <text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="14" font-weight="700" fill="#e0457b">5 cm paper edge</text></g>`);
    const dw = W * FIT.sx / 300 * 2.54, dh = H * FIT.sy / 300 * 2.54, margin = (5 - dw) / 2 * 10, vmargin = (7.62 - dh) / 2 * 10, stretch = (FIT.sy / FIT.sx - 1) * 100;
    document.getElementById("fitinfo").textContent = `Design ${dw.toFixed(2)} × ${dh.toFixed(2)} cm · ${margin >= 0 ? margin.toFixed(1) + " mm spare each side of 5 cm" : "WIDER than 5 cm by " + (-margin * 2).toFixed(1) + " mm"} · ${vmargin.toFixed(1)} mm top/bottom of 3 in${Math.abs(stretch) >= 0.5 ? ` · shapes ${stretch.toFixed(1)}% taller than wide` : ""}`;
    syncSliders();
    const pt = (px) => round(px * 0.24, 1);
    document.getElementById("pts").textContent = `At print size: headline ${pt(TITLE.fs)} pt · big number ${pt(CARD.bigFs)} pt · label ${pt(CARD.labelFs)} pt · badge ${pt(CARD.badgeFs)} pt (comfortable reading ≈ 6 pt+)`;
    const r2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? round(v) : r2(v)]));
    document.getElementById("out").textContent =
      `BUN  = ${JSON.stringify(r2(BUN))}\nCARD = ${JSON.stringify(r2(CARD))}\nRKT  = ${JSON.stringify(r2(RKT))}\nTITLE = ${JSON.stringify({ ...TITLE, fs: round(TITLE.fs), y: round(TITLE.y) })}\nFIT  = ${JSON.stringify(FIT)}\nSHUT = ${JSON.stringify(Object.fromEntries(Object.entries(SHUT).map(([k, a]) => [k, a.map(q => ({ ...q, x: round(q.x), y: round(q.y), s: round(q.s, 2) }))])))}`;
  }
  const pt = (e) => { const svg = document.querySelector("#stage > svg"), g = svg.querySelector("g[data-fit]"); const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; return q.matrixTransform(g.getScreenCTM().inverse()); };
  const stage = document.getElementById("stage");
  stage.addEventListener("pointerdown", e => {
    const tgt = e.target.closest("#hdl, #bun, [data-nm], #rkt, [data-sh]"); if (!tgt) return;
    const kind = tgt.id === "hdl" ? "size" : tgt.id === "bun" ? "move" : tgt.id === "rkt" ? "racket" : tgt.dataset.sh != null ? "shuttle" : "name";
    if (kind === "shuttle") SEL = +tgt.dataset.sh;
    drag = { kind, p0: pt(e), b0: { ...BUN }, r0: { ...RKT[frameKey()] }, s0: { ...(SHUT[frameKey()][SEL] || {}) } };
    try { stage.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  stage.addEventListener("pointermove", e => {
    if (!drag) return; const q = pt(e), dx = q.x - drag.p0.x, dy = q.y - drag.p0.y;
    if (drag.kind === "move") { BUN.x = Math.round(drag.b0.x + dx); BUN.y = Math.round(drag.b0.y + dy); }
    else if (drag.kind === "size") { BUN.h = Math.max(30, Math.round(drag.b0.h + Math.max(dy, dx * 165 / 119))); }
    else if (drag.kind === "racket") { const k = RKT[frameKey()]; k.x = round(drag.r0.x + dx); k.y = round(drag.r0.y + dy); }
    else if (drag.kind === "shuttle") { const q = curShut(); q.x = round(drag.s0.x + dx); q.y = round(drag.s0.y + dy); }
    else { BUN.nameX = Math.round(drag.b0.nameX + dx); }
    draw();
  });
  stage.addEventListener("pointerup", () => { drag = null; });
  document.addEventListener("keydown", e => {
    if (["SELECT", "INPUT"].includes(e.target.tagName)) return;
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return;
    const m = e.shiftKey ? 5 : 1; BUN.x += k[0] * m; BUN.y += k[1] * m; draw(); e.preventDefault();
  });
  document.getElementById("cp").addEventListener("click", async () => {
    const b = document.getElementById("cp"), txt = document.getElementById("out").textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = "Copied ✓"; } catch { b.textContent = "Copy the text above"; }
    setTimeout(() => (b.textContent = "Copy values"), 1500);
  });
  document.getElementById("reset").addEventListener("click", () => { const s = JSON.parse(START);
    // refill the existing objects: the sliders hold references to them, so replacing them would leave every slider dead
    for (const [o, v] of [[BUN, s.BUN], [CARD, s.CARD], [RKT, s.RKT], [TITLE, s.TITLE], [SHUT, s.SHUT], [FIT, s.FIT]]) { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, v); }
    SEL = 0; document.getElementById("ttxt").value = TITLE.text; draw(); });
  draw();
}
