
/* ---------- tuner mode (bunny-position-tuner.html) ---------- */
if (window.TUNE) {
  document.querySelector(".bar").innerHTML = `<h1>Bunny position tuner</h1>
    <p>Drag the bunny to move · drag the yellow corner to resize · arrow keys nudge 1 px (Shift = 5) · drag the blue dashed line to move the name</p>`;
  const grid = document.getElementById("grid");
  grid.style.display = "block";
  grid.innerHTML = `<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">
    <div id="stage" style="flex:1 1 560px;max-width:900px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;touch-action:none"></div>
    <div style="flex:0 0 280px;display:flex;flex-direction:column;gap:10px">
      <label>Player <select id="who"></select></label>
      <label>Frame <select id="frm"><option value="0">A · Candy Cane</option><option value="1">D · Snow Ticket</option></select></label>
      <label>Card <select id="md"><option value="hl">Highlights</option><option value="full">Full list</option></select></label>
      <label>View <select id="vw"><option value="card">Zoom on card</option><option value="all">Whole magnet</option></select></label>
      <pre id="out" style="margin:0;padding:10px;background:#1b1220;color:#f3cf7a;border-radius:8px;font-size:13px;white-space:pre-wrap"></pre>
      <button id="cp" style="border:0;background:var(--pur);color:#fff;border-radius:7px;padding:8px;font:inherit;cursor:pointer">Copy values</button>
      <button id="rs" style="border:1px solid var(--line);background:#fff;border-radius:7px;padding:8px;font:inherit;cursor:pointer">Reset</button>
      <p style="margin:0;font-size:12px;color:var(--mut)">Units are magnet pixels (600 × 900 = 2 × 3 in), measured from the card's top-left corner, so the same values fit every player's card height. Paste the copied line back to Claude.</p>
    </div></div>`;
  const START = { ...BUN };
  const who = document.getElementById("who");
  who.innerHTML = PLAYERS.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
  ["who", "frm", "md", "vw"].forEach(id => document.getElementById(id).addEventListener("change", draw));
  let drag = null;
  const cardBox = () => { const r = document.querySelector('#stage rect[fill="#fffdfb"]'); return { x: +r.getAttribute("x"), y: +r.getAttribute("y"), h: +r.getAttribute("height") }; };
  function draw() {
    MODE = document.getElementById("md").value;
    const p = PLAYERS[who.value], t = FRAMES[document.getElementById("frm").value];
    document.getElementById("stage").innerHTML = magnetSVG(t, p, false);
    const svg = document.querySelector("#stage > svg"), c = cardBox();
    if (document.getElementById("vw").value === "card") svg.setAttribute("viewBox", `0 ${c.y - 60} ${W} ${c.h + 90}`);
    svg.style.cssText = "width:100%;height:auto;display:block;user-select:none";
    const bw = BUN.h * 119 / 165, bx = c.x + BUN.x, by = c.y + BUN.y;
    svg.insertAdjacentHTML("beforeend", `
      <rect x="${bx}" y="${by}" width="${bw}" height="${BUN.h}" fill="none" stroke="#f3cf7a" stroke-width="1.2" stroke-dasharray="4 3" pointer-events="none"/>
      <path d="M${c.x + BUN.nameX} ${c.y + 10} V${c.y + 72}" stroke="#7fe3ff" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>
      <path data-nm="1" d="M${c.x + BUN.nameX} ${c.y + 10} V${c.y + 72}" stroke="rgba(0,0,0,0)" stroke-width="16" style="cursor:ew-resize"/>
      <rect id="hdl" x="${bx + bw - 7}" y="${by + BUN.h - 7}" width="14" height="14" rx="3" fill="#f3cf7a" stroke="#1b1220" stroke-width="1.5" style="cursor:nwse-resize"/>`);
    document.getElementById("bun").style.cursor = "move";
    document.getElementById("out").textContent =
      `bunny  x ${BUN.x}  y ${BUN.y}  w ${bw.toFixed(1)}  h ${BUN.h}\nname   x ${BUN.nameX}\n\nBUN = {x:${BUN.x}, y:${BUN.y}, h:${BUN.h}, nameX:${BUN.nameX}}`;
  }
  const pt = (e) => { const svg = document.querySelector("#stage > svg"); const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; return q.matrixTransform(svg.getScreenCTM().inverse()); };
  const stage = document.getElementById("stage");
  stage.addEventListener("pointerdown", e => {
    const tgt = e.target.closest("#hdl, #bun, [data-nm]"); if (!tgt) return;
    const kind = tgt.id === "hdl" ? "size" : tgt.id === "bun" ? "move" : "name";
    drag = { kind, p0: pt(e), b0: { ...BUN } }; stage.setPointerCapture(e.pointerId); e.preventDefault();
  });
  stage.addEventListener("pointermove", e => {
    if (!drag) return; const q = pt(e), dx = q.x - drag.p0.x, dy = q.y - drag.p0.y;
    if (drag.kind === "move") { BUN.x = Math.round(drag.b0.x + dx); BUN.y = Math.round(drag.b0.y + dy); }
    else if (drag.kind === "size") { BUN.h = Math.max(30, Math.round(drag.b0.h + Math.max(dy, dx * 165 / 119))); }
    else { BUN.nameX = Math.round(drag.b0.nameX + dx); }
    draw();
  });
  stage.addEventListener("pointerup", () => { drag = null; });
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "SELECT") return;
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return;
    const m = e.shiftKey ? 5 : 1; BUN.x += k[0] * m; BUN.y += k[1] * m; draw(); e.preventDefault();
  });
  document.getElementById("cp").addEventListener("click", async () => {
    const b = document.getElementById("cp"), txt = `BUN = {x:${BUN.x}, y:${BUN.y}, h:${BUN.h}, nameX:${BUN.nameX}}`;
    try { await navigator.clipboard.writeText(txt); b.textContent = "Copied ✓"; } catch { b.textContent = "Copy the last line above"; }
    setTimeout(() => (b.textContent = "Copy values"), 1500);
  });
  document.getElementById("rs").addEventListener("click", () => { BUN = { ...START }; draw(); });
  draw();
}
