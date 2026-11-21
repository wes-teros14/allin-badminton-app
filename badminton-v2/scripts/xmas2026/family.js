
/* ---------- family magnets (owner chose "split columns", 2026-11-21) ----------
   One magnet for two people: both names in the header, each person's top 3 placings as rows side by
   side, and a "together" line at the foot. A losing record together is never printed on a gift:
   it shows the number of games played together instead. Each person keeps their own card too. */
const FAMILIES = [["Steph", "Bogs"], ["Sim", "Aian"], ["Len", "Caitlin"]];
const FAM = { nameFs: 26, rowFs: 23, rowH: 46, nameH: 40, footH: 62, footFs: 27 };

function togetherLine(a, b) {
  const r = PAIR_RECORDS.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)) || { w: 0, l: 0 };
  const g = r.w + r.l;
  if (!g) return { big: "New duo", small: "first season together" };
  return r.w > r.l
    ? { big: `${r.w}–${r.l}`, small: `won together · ${Math.round((100 * r.w) / g)}%` }
    : { big: `${g}`, small: "games played together" };
}

function familySVG(fam) {
  const [A, B] = fam.members;
  const HH = 80, cw = 540, x0 = 30, colW = cw / 2, { rowH, nameH, footH } = FAM;
  const ph = HH + nameH + 3 * rowH + footH, y0 = H - 30 - ph;
  const medal = (r) => (r === 1 ? "#b8862b" : r === 2 ? "#7d8591" : r === 3 ? "#a8643a" : null);
  const fit = (txt, size, max, bold) => (String(txt).length * size * (bold ? 0.6 : 0.53) > max ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : "");
  const badge = (x, y, rank) => {
    const fs = 15.5, w = fs * 2.8, h = fs * 1.48, m = medal(rank);
    return m
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${m}"/><text x="${x + w / 2}" y="${y + h * 0.74}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff">${ord(rank)}</text>`
      : `<text x="${x + w / 2}" y="${y + h * 0.74}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#6b6577">${ord(rank)}</text>`;
  };
  const t = togetherLine(A.name, B.name), title = `${A.name} & ${B.name}`;
  let s = `<defs><clipPath id="cardclip"><rect x="${x0}" y="${y0}" width="${cw}" height="${ph}" rx="16"/></clipPath>
    <pattern id="stripe" width="48" height="6" patternUnits="userSpaceOnUse"><rect width="12" height="6" fill="#b3262e"/><rect x="12" width="12" height="6" fill="#fff"/><rect x="24" width="12" height="6" fill="#2e7d4f"/><rect x="36" width="12" height="6" fill="#fff"/></pattern></defs>
    <rect x="${x0}" y="${y0 + 3}" width="${cw}" height="${ph}" rx="16" fill="#000" opacity=".18"/>
    <g clip-path="url(#cardclip)">
      <rect x="${x0}" y="${y0}" width="${cw}" height="${ph}" fill="#fffdfb"/>
      <rect x="${x0}" y="${y0}" width="${cw}" height="${HH}" fill="#6f3e87"/>
      <rect x="${x0}" y="${y0 + HH - 6}" width="${cw}" height="6" fill="url(#stripe)"/>
      <text x="${x0 + BUN.nameX}" y="${y0 + 44}" font-size="36" font-weight="700" fill="#fff"${fit(title, 36, cw - BUN.nameX - 20, true)}>${esc(title)}</text>
      <text x="${x0 + BUN.nameX + 1}" y="${y0 + 64}" font-size="13.5" letter-spacing="1" fill="#fff" opacity=".88">BADMINTON TAYO!</text>
      <path d="M${x0 + colW} ${y0 + HH} v${nameH + 3 * rowH}" stroke="#ece6f0" stroke-width="1.5"/>`;
  [A, B].forEach((p, i) => {
    const cx = x0 + i * colW, rows = p.welcome ? [] : tilesFor(p).slice(0, 3);
    s += `<text x="${cx + colW / 2}" y="${y0 + HH + 30}" text-anchor="middle" font-size="${FAM.nameFs}" font-weight="700" fill="#6f3e87">${esc(p.name)}</text>`;
    rows.forEach((b, r) => {
      const ry = y0 + HH + nameH + r * rowH, fs = FAM.rowFs;
      if (b.rank === 1) s += `<rect x="${cx}" y="${ry}" width="${colW}" height="${rowH}" fill="#fbf3e2"/>`;
      s += `<path d="M${cx + 8} ${ry} h${colW - 16}" stroke="#ece6f0" stroke-width="1.2"/>` + badge(cx + 8, ry + (rowH - 23) / 2, b.rank) +
        `<text x="${cx + 58}" y="${ry + rowH / 2 + 8}" font-size="${fs}" fill="#1b1220"${fit(b.label, fs, colW - 58 - 70)}>${esc(b.label)}</text>
         <text x="${cx + colW - 10}" y="${ry + rowH / 2 + 8}" text-anchor="end" font-size="${fs}" font-weight="700" fill="#6f3e87">${esc(b.big)}</text>`;
    });
    if (!rows.length) s += `<text x="${cx + colW / 2}" y="${y0 + HH + nameH + rowH * 1.6}" text-anchor="middle" font-size="${FAM.rowFs}" fill="#1b1220">Merry Christmas!</text>`;
  });
  const fy = y0 + HH + nameH + 3 * rowH;
  s += `<rect x="${x0}" y="${fy}" width="${cw}" height="${footH}" fill="#6f3e87" opacity=".1"/>
    <text x="${x0 + cw / 2}" y="${fy + footH / 2 + 10}" text-anchor="middle" font-size="${FAM.footFs}" fill="#1b1220"><tspan font-weight="700" fill="#6f3e87">${esc(t.big)}</tspan>  ${esc(t.small)}</text>`;
  return s + "</g>" + `<svg id="bun" x="${x0 + BUN.x}" y="${y0 + BUN.y}" width="${(BUN.h * 119 / 165).toFixed(1)}" height="${BUN.h}" viewBox="49 49 119 165"><image href="${LOGO}" width="193" height="237"/></svg>`;
}

// family cards join the list after everyone else; the single-person card function routes them here
for (const [a, b] of FAMILIES) {
  const find = (n) => PLAYERS.find((p) => p.name === n) || { name: n, welcome: true, items: [] };
  PLAYERS.push({ name: `${a} & ${b}`, family: true, members: [find(a), find(b)], items: [], places: 0, top3: 0, first: 0 });
}
const singleCardSVG = cardSVG;
cardSVG = (p) => (p.family ? familySVG(p) : singleCardSVG(p));
document.getElementById("all").textContent = `Download all PNGs (${PLAYERS.length})`;
{ const bp = document.querySelector(".bar p"); if (bp) bp.textContent = bp.textContent.replace(" welcome cards", ` welcome cards + ${FAMILIES.length} family cards`); }
