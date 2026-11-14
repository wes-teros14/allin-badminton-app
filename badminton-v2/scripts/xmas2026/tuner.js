
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
      <b style="font-size:13px;margin-top:4px">Racket (this frame)</b>
      ${slider("rs", "Size", 0.4, 2, 0.05)}
      ${slider("rr", "Angle", -180, 180, 1)}
      <p id="pts" style="margin:0;font-size:12px;color:var(--mut)"></p>
      <pre id="out" style="margin:0;padding:10px;background:#1b1220;color:#f3cf7a;border-radius:8px;font-size:12px;white-space:pre-wrap"></pre>
      <button id="cp" style="border:0;background:var(--pur);color:#fff;border-radius:7px;padding:8px;font:inherit;cursor:pointer">Copy values</button>
      <button id="reset" style="border:1px solid var(--line);background:#fff;border-radius:7px;padding:8px;font:inherit;cursor:pointer">Reset</button>
      <p style="margin:0;font-size:12px;color:var(--mut)">Units are magnet pixels (600 × 900 = 2 × 3 in at 300 dpi; 1 px prints as 0.24 pt). Bunny and name are measured from the card's top-left, so they fit every player. Paste the copied block back to Claude.</p>
    </div></div>
    <div id="realbox" style="display:none;margin-top:18px"><p style="margin:0 0 6px;font-size:12px;color:var(--mut)">≈ print size (2 × 3 in at 96 CSS px per inch; real screens vary)</p><div id="real-svg" style="width:192px"></div></div>`;
  const START = JSON.stringify({ BUN, CARD, RKT });
  const who = document.getElementById("who");
  who.innerHTML = PLAYERS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
  ["who", "frm", "md", "vw", "real"].forEach(id => document.getElementById(id).addEventListener("change", draw));
  const frameKey = () => FRAMES[document.getElementById("frm").value].id;
  const SL = { tileH: [CARD, "tileH"], bigFs: [CARD, "bigFs"], labelFs: [CARD, "labelFs"], badgeFs: [CARD, "badgeFs"] };
  for (const id of Object.keys(SL)) document.getElementById(id).addEventListener("input", e => { SL[id][0][SL[id][1]] = +e.target.value; draw(); });
  document.getElementById("rs").addEventListener("input", e => { RKT[frameKey()].s = +e.target.value; draw(); });
  document.getElementById("rr").addEventListener("input", e => { RKT[frameKey()].rot = +e.target.value; draw(); });
  let drag = null;
  const cardBox = () => { const r = document.querySelector('#stage rect[fill="#fffdfb"]'); return { x: +r.getAttribute("x"), y: +r.getAttribute("y"), h: +r.getAttribute("height") }; };
  const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
  function syncSliders() {
    for (const id of Object.keys(SL)) { const v = SL[id][0][SL[id][1]]; document.getElementById(id).value = v; document.getElementById(id + "-o").textContent = v; }
    const k = RKT[frameKey()];
    document.getElementById("rs").value = k.s; document.getElementById("rs-o").textContent = k.s;
    document.getElementById("rr").value = k.rot; document.getElementById("rr-o").textContent = k.rot + "°";
  }
  function draw() {
    MODE = document.getElementById("md").value;
    const p = PLAYERS[who.value], t = FRAMES[document.getElementById("frm").value];
    document.getElementById("stage").innerHTML = magnetSVG(t, p, false);
    const svg = document.querySelector("#stage > svg"), c = cardBox();
    if (document.getElementById("vw").value === "card") svg.setAttribute("viewBox", `0 ${c.y - 60} ${W} ${c.h + 90}`);
    svg.style.cssText = "width:auto;max-width:100%;height:auto;max-height:calc(100vh - 140px);display:block;margin:0 auto;user-select:none";
    const bw = BUN.h * 119 / 165, bx = c.x + BUN.x, by = c.y + BUN.y;
    svg.insertAdjacentHTML("beforeend", `
      <rect x="${bx}" y="${by}" width="${bw}" height="${BUN.h}" fill="none" stroke="#f3cf7a" stroke-width="1.2" stroke-dasharray="4 3" pointer-events="none"/>
      <path d="M${c.x + BUN.nameX} ${c.y + 10} V${c.y + 72}" stroke="#7fe3ff" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>
      <path data-nm="1" d="M${c.x + BUN.nameX} ${c.y + 10} V${c.y + 72}" stroke="rgba(0,0,0,0)" stroke-width="16" style="cursor:ew-resize"/>
      <rect id="hdl" x="${bx + bw - 7}" y="${by + BUN.h - 7}" width="14" height="14" rx="3" fill="#f3cf7a" stroke="#1b1220" stroke-width="1.5" style="cursor:nwse-resize"/>`);
    document.getElementById("bun").style.cursor = "move";
    const rk = document.getElementById("rkt"); if (rk) rk.style.cursor = "move";
    const realBox = document.getElementById("realbox");
    realBox.style.display = document.getElementById("real").checked ? "block" : "none";
    if (document.getElementById("real").checked) document.getElementById("real-svg").innerHTML = magnetSVG(t, p, false).replace("<svg ", '<svg style="width:192px;height:288px;display:block" ').replace(/id="/g, 'id="r-').replace(/url\(#/g, "url(#r-");
    syncSliders();
    const pt = (px) => round(px * 0.24, 1);
    document.getElementById("pts").textContent = `At print size: big number ${pt(CARD.bigFs)} pt · label ${pt(CARD.labelFs)} pt · badge ${pt(CARD.badgeFs)} pt (comfortable reading ≈ 6 pt+)`;
    const r2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? round(v) : r2(v)]));
    document.getElementById("out").textContent =
      `BUN  = ${JSON.stringify(r2(BUN))}\nCARD = ${JSON.stringify(r2(CARD))}\nRKT  = ${JSON.stringify(r2(RKT))}`;
  }
  const pt = (e) => { const svg = document.querySelector("#stage > svg"); const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; return q.matrixTransform(svg.getScreenCTM().inverse()); };
  const stage = document.getElementById("stage");
  stage.addEventListener("pointerdown", e => {
    const tgt = e.target.closest("#hdl, #bun, [data-nm], #rkt"); if (!tgt) return;
    const kind = tgt.id === "hdl" ? "size" : tgt.id === "bun" ? "move" : tgt.id === "rkt" ? "racket" : "name";
    drag = { kind, p0: pt(e), b0: { ...BUN }, r0: { ...RKT[frameKey()] } };
    try { stage.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  stage.addEventListener("pointermove", e => {
    if (!drag) return; const q = pt(e), dx = q.x - drag.p0.x, dy = q.y - drag.p0.y;
    if (drag.kind === "move") { BUN.x = Math.round(drag.b0.x + dx); BUN.y = Math.round(drag.b0.y + dy); }
    else if (drag.kind === "size") { BUN.h = Math.max(30, Math.round(drag.b0.h + Math.max(dy, dx * 165 / 119))); }
    else if (drag.kind === "racket") { const k = RKT[frameKey()]; k.x = round(drag.r0.x + dx); k.y = round(drag.r0.y + dy); }
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
  document.getElementById("reset").addEventListener("click", () => { const s = JSON.parse(START); BUN = s.BUN; CARD = s.CARD; RKT = s.RKT; draw(); });
  draw();
}
