const d = require('./boards.json'), P = {};
const add = (id, it) => (P[id] ??= []).push(it);
for (const a of d.awards) for (const r of a.rows) add(r.playerId, { tab:'award', board:a.label, rank:r.rank, value:r.shown, unit:r.unit, detail:r.detail });
for (const e of d.individual) add(e.playerId, { tab:'ind', board:'Win Rate', rank:e.rank, value:e.winRate+'%', w:e.wins, l:e.losses });
for (const p of d.pairs) for (const [i,pl] of p.players.entries()) add(pl.id, { tab:'pair', rank:p.rank, partner:p.players[1-i].displayName, w:p.wins, l:p.losses });
for (const c of d.cheers) for (const r of c.rows) add(r.playerId, { tab:'cheer', board:c.name, rank:r.rank, value:r.sharePct+'%', cnt:r.categoryCount, tot:r.totalReceived });
const out = Object.entries(P).map(([id, items]) => ({ id, name: d.names[id], items,
  places: items.length, top3: items.filter(i=>i.rank<=3).length, first: items.filter(i=>i.rank===1).length }))
  .sort((a,b)=>b.places-a.places||b.top3-a.top3||a.name.localeCompare(b.name));
require('fs').writeFileSync('players.json', JSON.stringify({ asOf:d.lastSessionDate, players:out }, null, 1));
for (const p of out) console.log(p.name.padEnd(12), p.places, p.top3, p.first, '|', p.items.map(i=>`${i.tab}:${i.board??i.partner}#${i.rank}`).join(' '));
console.log('eligible without placings:', d.eligible.filter(id=>!P[id]).map(id=>d.names[id]).join(', ')||'none');
