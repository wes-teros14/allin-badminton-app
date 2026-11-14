// Builds docs/xmas2026/ref-magnets-all.html: frames A + D for every placed player, prod data baked in.
const fs = require('fs')
const S = __dirname
const ROOT = 'D:/ZZWES/wApps/Badminton_v2_app/badminton-v2'
const tpl = fs.readFileSync(`${S}/magnet.tpl.html`, 'utf8')
const art = tpl.slice(tpl.indexOf('/* ---------- tiny seeded random'), tpl.indexOf('/* ---------- stats card'))
const data = JSON.parse(fs.readFileSync(`${S}/players.json`, 'utf8'))
const logo = fs.readFileSync(`${ROOT}/docs/xmas2026/bunny-racket.png`).toString('base64')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Xmas Ref Magnets</title>
<style>
  :root{--bg:#f4f1f6;--ink:#1b1220;--mut:#6b6577;--line:#ddd5e3;--pur:#6f3e87}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 "Segoe UI",system-ui,sans-serif}
  .bar{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line);padding:10px 16px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
  .bar h1{font-size:15px;margin:0}
  .bar p{margin:0;font-size:12px;color:var(--mut)}
  .bar button,.p button{border:1px solid var(--line);background:#fff;border-radius:7px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}
  .bar button.pri{background:var(--pur);color:#fff;border-color:var(--pur)}
  .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  .bar .seg button{border:0;border-radius:0;padding:5px 11px}
  .bar .seg button+button{border-left:1px solid var(--line)}
  .bar .seg button[aria-pressed=true]{background:var(--pur);color:#fff}
  main{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:22px;padding:18px 16px 40px}
  .p{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px}
  .p h2{margin:0 0 8px;font-size:15px;display:flex;gap:8px;align-items:baseline}
  .p h2 span{font-size:12px;color:var(--mut);font-weight:400}
  .two{display:flex;gap:10px}
  .two figure{margin:0;flex:1;text-align:center}
  .two svg{width:100%;height:auto;display:block;border-radius:4px;box-shadow:0 1px 6px rgba(0,0,0,.18)}
  .two figcaption{font-size:12px;color:var(--mut);margin-top:6px}
</style>
</head>
<body>
<div class="bar">
  <h1>Xmas ref magnets · 2 × 3 in</h1>
  <p>${data.players.length} players · prod data through the ${data.asOf} session · PNG = 600 × 900 px (300 dpi), photo window transparent</p>
  <span class="seg" id="mode"><button data-v="hl" aria-pressed="true">Highlights</button><button data-v="full" aria-pressed="false">Full list</button></span>
  <button class="pri" id="all">Download all PNGs (${data.players.length * 2})</button>
</div>
<main id="grid"></main>
<script>
const LOGO = "data:image/png;base64,${logo}";
const PLAYERS = ${JSON.stringify(data.players)};
const W = 600, H = 900;
const PHOTO = {x:40, y:78, w:520, h:762, r:18};
let HOLE = false;
let BUN = {x:20, y:1, h:74, nameX:86};   // bunny box + name start, relative to the card's top-left
// Highlights tiles: height, big value, label, rank badge (all magnet px; 600 px = 2 in, so pt = px * 0.24)
let CARD = {tileH:120, bigFs:46, labelFs:27, badgeFs:18.5, bigGap:6, labelGap:11, totLabelFs:17};
// Loose shuttles drawn over the photo edge, per frame: position, angle, scale, band colour; on:false hides one
let SHUT = {
  candy:[{x:206,y:66,rot:120,s:.7,c:"#c62828"},{x:536,y:142,rot:38,s:1,c:"#6f3e87"},{x:470,y:84,rot:-20,s:.7,c:"#2e7d4f"},{x:566,y:470,rot:-125,s:.8,c:"#c62828"}],
  snow:[{x:238.3,y:78.4,rot:120,s:.7,c:"#b8862b"},{x:66,y:207.5,rot:-38,s:1,c:"#6f3e87"},{x:36,y:470,rot:125,s:.8,c:"#b8862b"}],
};
const shuttles = (key) => SHUT[key].map((q, i) => q.on === false ? "" : \`<g data-sh="\${i}">\${svgShuttle(q.x, q.y, q.rot, q.s, "#fff", q.c)}</g>\`).join("");
// Whole-design scale inside the 2 x 3 in canvas (0.95 = 1.9 in wide, fits 5 cm paper with ~1 mm each side)
let FIT = {s:0.95};
// Headline ribbon: text, font size, top edge (magnet px)
let TITLE = {text:"2026 Year-End Highlights", fs:26, y:86};
// Corner racket per frame: position of the racket's throat, angle, scale
let RKT = {candy:{x:29.4, y:75.2, rot:170, s:.9}, snow:{x:535.9, y:380.4, rot:17, s:.8}};
${art}
/* ---------- stats card, drawn in SVG so it exports with the frame ---------- */
const SHORT = {"Most Sessions Joined":"Most Sessions","Attendance Streak":"Attendance Streak","Registration Early Bird":"Early Bird","Win Streak":"Win Streak","Against the Odds":"Against the Odds"};
const ord = n => n + (n%100>=11&&n%100<=13 ? "th" : ({1:"st",2:"nd",3:"rd"}[n%10] || "th"));
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const PRIO = {award:0, ind:1, cheer:2, pair:3};
function tilesFor(p){
  const sorted = [...p.items].sort((a,b)=>a.rank-b.rank || PRIO[a.tab]-PRIO[b.tab]);
  const out = []; let pairs = 0;
  for (const i of sorted){
    if (out.length === 6) break;
    if (i.tab === "pair"){ if (pairs === 2) continue; pairs++; out.push({rank:i.rank, big:i.w+"–"+i.l, label:"with "+i.partner}); }
    else if (i.tab === "ind") out.push({rank:i.rank, big:i.value, label:"Win Rate"});
    else if (i.tab === "cheer") out.push({rank:i.rank, big:i.value, label:i.board});
    else out.push({rank:i.rank, big:i.value, label:SHORT[i.board] || i.board});
  }
  return out;
}
let MODE = "hl";   // "hl" = 6 highlight tiles, "full" = every placing as a list
function rowsFor(p){
  return [...p.items].sort((a,b)=>a.rank-b.rank || PRIO[a.tab]-PRIO[b.tab]).map(i =>
    i.tab === "pair" ? {rank:i.rank, label:"with "+i.partner, val:i.w+"–"+i.l}
    : i.tab === "ind" ? {rank:i.rank, label:"Win Rate", val:i.value}
    : i.tab === "cheer" ? {rank:i.rank, label:i.board, val:i.value}
    : {rank:i.rank, label:SHORT[i.board] || i.board, val:i.value});
}
function cardSVG(p){
  const t = tilesFor(p), HH = 80, TH = CARD.tileH, RH = 31;
  const list = MODE === "full" ? rowsFor(p) : null;
  const split = ({1:[1],2:[2],3:[3],4:[2,2],5:[3,2],6:[3,3]})[t.length] || [];
  const listRows = list ? Math.ceil(list.length / (list.length > 1 ? 2 : 1)) : 0;
  const bodyH = list ? listRows*RH + 6 : split.length*TH;
  const ph = HH + bodyH, x0 = 30, y0 = H - 30 - ph, cw = 540;
  const pos = []; split.forEach((n, r) => { for (let c = 0; c < n; c++) pos.push({ r, c, w: cw / n }); });
  const medal = r => r===1 ? "#b8862b" : r===2 ? "#7d8591" : r===3 ? "#a8643a" : null;
  let s = \`<defs><clipPath id="cardclip"><rect x="\${x0}" y="\${y0}" width="\${cw}" height="\${ph}" rx="16"/></clipPath>
    <pattern id="stripe" width="48" height="6" patternUnits="userSpaceOnUse"><rect width="12" height="6" fill="#b3262e"/><rect x="12" width="12" height="6" fill="#fff"/><rect x="24" width="12" height="6" fill="#2e7d4f"/><rect x="36" width="12" height="6" fill="#fff"/></pattern></defs>
    <rect x="\${x0}" y="\${y0+3}" width="\${cw}" height="\${ph}" rx="16" fill="#000" opacity=".18"/>
    <g clip-path="url(#cardclip)">
      <rect x="\${x0}" y="\${y0}" width="\${cw}" height="\${ph}" fill="#fffdfb"/>
      <rect x="\${x0}" y="\${y0}" width="\${cw}" height="\${HH}" fill="#6f3e87"/>
      <rect x="\${x0}" y="\${y0+HH-6}" width="\${cw}" height="6" fill="url(#stripe)"/>
      <text x="\${x0+BUN.nameX}" y="\${y0+44}" font-size="\${p.name.length>9?30:36}" font-weight="700" fill="#fff">\${esc(p.name)}</text>
      <text x="\${x0+BUN.nameX+1}" y="\${y0+64}" font-size="13.5" letter-spacing="1" fill="#fff" opacity=".88">BADMINTON TAYO!</text>\`;
  [[p.places,"PLACES","#fff"],[p.top3,"TOP 3","#fff"],[p.first,"1ST","#f3cf7a"]].forEach(([n,l,c],k)=>{
    // column width grows with the label size so PLACES never runs into TOP 3
    const colW = Math.max(56, CARD.totLabelFs * 4), cx = x0 + cw - 18 - colW/2 - (2 - k)*colW;
    s += \`<text x="\${cx}" y="\${y0+38}" text-anchor="middle" font-size="30" font-weight="700" fill="\${c}">\${n}</text>
           <text x="\${cx}" y="\${y0+40+CARD.totLabelFs*1.15}" text-anchor="middle" font-size="\${CARD.totLabelFs}" font-weight="600" letter-spacing=".3" fill="#fff">\${l}</text>\`;
  });
  if (list) {
    const cols = list.length > 1 ? 2 : 1, colW = cw / cols;
    list.forEach((row, i) => {
      const c = Math.floor(i / listRows), r = i % listRows, rx = x0 + c*colW, ry = y0 + HH + 3 + r*RH, m = medal(row.rank);
      if (row.rank === 1) s += \`<rect x="\${rx}" y="\${ry}" width="\${colW}" height="\${RH}" fill="#fbf3e2"/>\`;
      if (r) s += \`<path d="M\${rx+8} \${ry} h\${colW-16}" stroke="#ece6f0" stroke-width="1.2"/>\`;
      s += m ? \`<rect x="\${rx+8}" y="\${ry+6}" width="38" height="19" rx="9.5" fill="\${m}"/><text x="\${rx+27}" y="\${ry+20.5}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">\${ord(row.rank)}</text>\`
             : \`<text x="\${rx+27}" y="\${ry+20.5}" text-anchor="middle" font-size="13" font-weight="700" fill="#6b6577">\${ord(row.rank)}</text>\`;
      s += \`<text x="\${rx+54}" y="\${ry+21}" font-size="16" fill="#1b1220">\${esc(row.label)}</text>
             <text x="\${rx+colW-10}" y="\${ry+21}" text-anchor="end" font-size="16" font-weight="700" fill="#6f3e87">\${esc(row.val)}</text>\`;
    });
    if (cols === 2) s += \`<path d="M\${x0+colW} \${y0+HH} v\${bodyH}" stroke="#ece6f0" stroke-width="1.5"/>\`;
    return s + "</g>" + \`<svg id="bun" x="\${x0+BUN.x}" y="\${y0+BUN.y}" width="\${(BUN.h*119/165).toFixed(1)}" height="\${BUN.h}" viewBox="49 49 119 165"><image href="\${LOGO}" width="193" height="237"/></svg>\`;
  }
  t.forEach((tile,i)=>{
    const { r, c, w: tw } = pos[i], tx = x0 + c*tw, ty = y0 + HH + r*TH, m = medal(tile.rank);
    if (tile.rank===1) s += \`<rect x="\${tx}" y="\${ty}" width="\${tw}" height="\${TH}" fill="#fbf3e2"/>\`;
    if (c) s += \`<path d="M\${tx} \${ty} v\${TH}" stroke="#ece6f0" stroke-width="1.5"/>\`;
    if (r) s += \`<path d="M\${tx} \${ty} h\${tw}" stroke="#ece6f0" stroke-width="1.5"/>\`;
    const bf = CARD.badgeFs, bw = bf*2.8, bh = bf*1.48;
    s += m ? \`<rect x="\${tx+8}" y="\${ty+8}" width="\${bw}" height="\${bh}" rx="\${bh/2}" fill="\${m}"/><text x="\${tx+8+bw/2}" y="\${ty+8+bh*.74}" text-anchor="middle" font-size="\${bf}" font-weight="700" fill="#fff">\${ord(tile.rank)}</text>\`
           : \`<text x="\${tx+8+bw/2}" y="\${ty+8+bh*.74}" text-anchor="middle" font-size="\${bf}" font-weight="700" fill="#6b6577">\${ord(tile.rank)}</text>\`;
    // label sits on the tile floor, the big value just above it; both shrink to fit the tile width
    const lab = tile.label, fs = lab.length > 17 ? CARD.labelFs - 3 : CARD.labelFs;
    const bigFs = tile.big.length > 5 ? CARD.bigFs - 6 : CARD.bigFs;
    const labY = ty + TH - CARD.labelGap, bigY = labY - fs - CARD.bigGap;
    const fit = (txt, size, bold) => { const est = txt.length * size * (bold ? .6 : .53), max = tw - 14; return est > max ? \` textLength="\${max}" lengthAdjust="spacingAndGlyphs"\` : ""; };
    s += \`<text x="\${tx+tw/2}" y="\${bigY}" text-anchor="middle" font-size="\${bigFs}" font-weight="700" fill="#6f3e87"\${fit(tile.big, bigFs, true)}>\${esc(tile.big)}</text>
           <text x="\${tx+tw/2}" y="\${labY}" text-anchor="middle" font-size="\${fs}" fill="#1b1220"\${fit(lab, fs, false)}>\${esc(lab)}</text>\`;
  });
  return s + "</g>" + \`<svg id="bun" x="\${x0+BUN.x}" y="\${y0+BUN.y}" width="\${(BUN.h*119/165).toFixed(1)}" height="\${BUN.h}" viewBox="49 49 119 165"><image href="\${LOGO}" width="193" height="237"/></svg>\`;
}
/* headline ribbon across the top of the photo (owner chose "option 2" from the title mock) */
function titleSVG(){
  const txt = TITLE.text.trim(); if (!txt) return "";
  const fs = TITLE.fs, h = Math.round(fs * 1.7), y = TITLE.y, cx = 300;
  const w = Math.min(520, Math.max(240, txt.length * fs * 0.6 + 60));
  return \`<g>
    <path d="M\${cx - w/2 - 34} \${y + h*.28} h44 v\${h} h-44 l14 -\${h/2}z" fill="#4f2a63" stroke="#1b1220" stroke-width="2"/>
    <path d="M\${cx + w/2 + 34} \${y + h*.28} h-44 v\${h} h44 l-14 -\${h/2}z" fill="#4f2a63" stroke="#1b1220" stroke-width="2"/>
    <rect x="\${cx - w/2}" y="\${y}" width="\${w}" height="\${h}" rx="4" fill="#6f3e87" stroke="#1b1220" stroke-width="2"/>
    <rect x="\${cx - w/2 + 5}" y="\${y + 5}" width="\${w - 10}" height="\${h - 10}" rx="2" fill="none" stroke="#f3cf7a" stroke-width="1.5"/>
    <text x="\${cx}" y="\${y + h/2 + fs*.36}" text-anchor="middle" font-size="\${fs}" font-weight="700" fill="#f3cf7a" letter-spacing=".5"\${txt.length*fs*.6 > w - 24 ? \` textLength="\${w - 24}" lengthAdjust="spacingAndGlyphs"\` : ""}>\${esc(txt)}</text></g>\`;
}
// The canvas stays 600 x 900 (2 x 3 in); the whole design is shrunk and centred inside it so it
// survives printing on paper that is really 5 cm (1.97 in) wide.
// The margin the shrink leaves is filled with the frame's own background (bleed allowance), never white.
// Drawn inside the scaled group in design units so the Candy Cane stripes line up with the frame's.
const BLEED = { candy: "url(#cc)", snow: "#fbf6ee" };
const fitOpen = (theme) => {
  const s = FIT.s, tx = W*(1-s)/2, ty = H*(1-s)/2, ox = -tx/s, oy = -ty/s, ow = W/s, oh = H/s;
  const ring = \`<path fill-rule="evenodd" fill="\${BLEED[theme.id] || "#fff"}" d="M\${ox} \${oy}h\${ow}v\${oh}h-\${ow}z M1 1v\${H-2}h\${W-2}v-\${H-2}z"/>\`;
  return \`<g data-fit="1" transform="translate(\${tx.toFixed(2)} \${ty.toFixed(2)}) scale(\${s})">\${ring}\`;
};
function magnetSVG(theme, p, forExport){
  const font = 'font-family="Segoe UI, system-ui, sans-serif"';
  // anything after <!--TOP--> in a frame (Snow Ticket's ornaments and bow) is drawn above the headline ribbon
  if (!forExport) { const [main, top = ""] = theme.art().split("<!--TOP-->");
    return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${W} \${H}" \${font}>\${fitOpen(theme)}\${main}\${cardSVG(p)}\${titleSVG()}\${top}</g></svg>\`; }
  HOLE = true; const [under, rest = ""] = theme.art().split("<!--OVER-->"); HOLE = false; const q = PHOTO;
  const [over, top = ""] = rest.split("<!--TOP-->");
  return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${W} \${H}" width="\${W}" height="\${H}" \${font}>\${fitOpen(theme)}
    <mask id="hole"><rect width="\${W}" height="\${H}" fill="#fff"/><rect x="\${q.x}" y="\${q.y}" width="\${q.w}" height="\${q.h}" rx="\${q.r}" fill="#000"/></mask>
    <g mask="url(#hole)">\${under}</g>\${over}\${cardSVG(p)}\${titleSVG()}\${top}</g></svg>\`;
}
const FRAMES = THEMES.filter(t => t.id === "candy" || t.id === "snow");
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-");
function png(theme, p){
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(img,0,0);
      const a = document.createElement("a"); a.download = \`magnet-\${slug(p.name)}-\${theme.id === "candy" ? "A" : "D"}.png\`; a.href = c.toDataURL("image/png"); a.click(); ok(); };
    img.onerror = bad;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(magnetSVG(theme, p, true));
  });
}
// ids inside each inline SVG must be unique on the page
const uniq = (svg, k) => svg.replace(/id="([\\w-]+)"/g, \`id="$1-\${k}"\`).replace(/url\\(#([\\w-]+)\\)/g, \`url(#$1-\${k})\`);
function render(){ document.getElementById("grid").innerHTML = PLAYERS.map((p, i) => \`
  <section class="p"><h2>\${esc(p.name)} <span>\${p.places} places · \${p.top3} top 3 · \${p.first} first</span></h2>
  <div class="two">\${FRAMES.map((t, j) => \`<figure>\${uniq(magnetSVG(t, p, false), i + "-" + j)}
    <figcaption>\${t.id === "candy" ? "A · Candy Cane" : "D · Snow Ticket"}<br><button data-p="\${i}" data-t="\${j}">PNG</button></figcaption></figure>\`).join("")}</div></section>\`).join(""); }
if (!window.TUNE) render();
document.getElementById("mode").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  MODE = b.dataset.v;
  for (const x of e.currentTarget.querySelectorAll("button")) x.setAttribute("aria-pressed", x === b);
  render();
});
document.getElementById("grid").addEventListener("click", e => {
  const b = e.target.closest("button[data-p]"); if (b) png(FRAMES[b.dataset.t], PLAYERS[b.dataset.p]);
});
document.getElementById("all").addEventListener("click", async () => {
  for (const p of PLAYERS) for (const t of FRAMES) { await png(t, p); await new Promise(r => setTimeout(r, 250)); }
});
${fs.readFileSync(`${S}/tuner.js`, 'utf8')}
</script>
</body>
</html>
`
fs.mkdirSync(`${ROOT}/docs/xmas2026`, { recursive: true })
fs.writeFileSync(`${ROOT}/docs/xmas2026/ref-magnets-all.html`, html)
fs.writeFileSync('D:/ZZWES/wApps/Badminton_v2_app/temporary_files/bunny-position-tuner.html', html.replace('<title>Xmas Ref Magnets</title>', '<title>Bunny Position Tuner</title>').replace('<script>\nconst LOGO', '<script>window.TUNE = true</script>\n<script>\nconst LOGO'))
console.log('written', (html.length / 1024).toFixed(0), 'KB')
