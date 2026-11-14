// Balance simulator. Usage: node tools/sim.js <hours> <tapsPerSec>
// Copies the pure Core logic out of src/game.html into tools/.core.js, requires it, and plays greedily.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.html'), 'utf8');
const coreFile = path.join(__dirname, '.core.js');
fs.writeFileSync(coreFile, html.match(/<script id="core">([\s\S]*?)<\/script>/)[1]);
const C = require(coreFile);

const HOURS = +process.argv[2] || 4, TAPS = +(process.argv[3] ?? 1);
const s = C.newState(); let d = C.derive(s);
const milestones = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12]; let mi = 0, capped = 0;
const mps = dd => C.baseThroughput(dd) * dd.pay;
const value = (st, dd) => mps(dd) + C.tapGrads(st, dd) * dd.pay * TAPS;
const clone = st => ({ ...st, fac: { ...st.fac }, ups: { ...st.ups }, ach: { ...st.ach }, staff: { ...(st.staff || {}) }, boosts: [] });

for (let t = 0; t < HOURS * 3600; t++) {
  for (let k = 0; k < TAPS; k++) C.tap(s, d);
  C.tick(s, d, 1);
  if (d.training > d.capacity) capped++;
  for (let guard = 0; guard < 40; guard++) {
    const base = value(s, d); let best = null;
    const opts = C.FAC.map(f => ({ cost: C.facCost(f, s.fac[f.id] || 0, 1, d.costMult), apply: st => { st.fac[f.id] = (st.fac[f.id] || 0) + 1; } }));
    if (C.STAFF) C.STAFF.forEach(st => {
      const lv = (s.staff || {})[st.id] || 0;
      if (lv < C.MAX_STAFF && C.staffVisible(s, st)) opts.push({ cost: C.staffCost(st, lv), apply: x => { x.staff = { ...(x.staff || {}) }; x.staff[st.id] = lv + 1; } });
    });
    opts.push({ cost: C.houseCost(s), apply: st => { st.house++; } });
    C.UP.forEach(u => { if (C.upVisible(s, u)) opts.push({ cost: u.cost, apply: st => { st.ups[u.id] = 1; } }); });
    for (const o of opts) {
      const c = clone(s); o.apply(c); const cd = C.derive(c);
      let gain = value(c, cd) - base;
      if (gain <= 0) gain = (cd.training - d.training) * d.pay * 0.05;
      if (gain <= 0) continue;
      const score = o.cost / gain + Math.max(0, o.cost - s.money) / Math.max(base, 1e-9);
      if (!best || score < best.score) best = { ...o, score };
    }
    if (!best || best.cost > s.money) break;
    s.money -= best.cost; best.apply(s); C.checkAch(s); d = C.derive(s);
  }
  while (mi < milestones.length && s.runEarned >= milestones[mi]) {
    console.log(`$${milestones[mi].toExponential(0)} at ${(t / 60).toFixed(1)} min | $/s=${mps(d).toExponential(2)} house=${s.house} fac=${JSON.stringify(s.fac)}`);
    mi++;
  }
}
console.log('final', { earned: s.runEarned.toExponential(2), house: s.house, ups: Object.keys(s.ups).length, starsPending: C.starsPending(s), cappedPct: (100 * capped / (HOURS * 3600)).toFixed(0) + '%' });
