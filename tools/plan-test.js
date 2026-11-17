// Base Master Plan logic tests. Usage: node tools/plan-test.js [--search]
// --search also runs an annealing search for the most partner links reachable at a few land sizes.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.html'), 'utf8');
const coreFile = path.join(__dirname, '.core-test.js');
fs.writeFileSync(coreFile, html.match(/<script id="core">([\s\S]*?)<\/script>/)[1]);
const C = require(coreFile);
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

let s = C.newState();
assert(!C.planOn(s), 'locked at start');
assert(!C.derive(s).plan, 'no plan effects when locked');
s.allEarned = 2e10; s.runEarned = 2e10;
C.FAC.forEach(f => s.fac[f.id] = 80); s.house = 14;
assert(C.planPieces(s).length === 10 + 10 + 4, 'pieces: 10 facilities + 10 annexes + 4 housing blocks');
C.planAutoPlace(s);
let g = C.planGrid(s);
assert(g.placed.length === 20 && g.loose.length === 4, '6x4 grid holds 20 pieces, the rest wait in the tray');
console.log('     links after greedy auto-place:', C.planEffects(s).links);

const a = g.placed[0], b = g.placed[1];
C.planMove(s, a.id, b.x, b.y);
g = C.planGrid(s);
assert(g.cells[b.x + ',' + b.y].id === a.id && g.cells[a.x + ',' + a.y].id === b.id, 'move swaps two placed pieces');
assert(!C.planMove(s, a.id, g.g.x, g.g.y), 'cannot move onto the parade ground');

const loose = g.loose[0];
C.planMove(s, loose.id, b.x, b.y);
g = C.planGrid(s);
assert(g.cells[b.x + ',' + b.y].id === loose.id && s.plan.tray[a.id], 'placing from the tray bumps the occupant into the tray');
C.planAutoPlace(s);
assert(!C.planGrid(s).placed.some(p => p.id === a.id), 'auto-place leaves a deliberately stored piece alone');

s.money = 1e12;
const before = JSON.stringify(C.planGrid(s).placed.map(p => p.id).sort());
assert(C.buyLand(s), 'buy land');
const g2 = C.planGrid(s);
assert(g2.c === 7 && JSON.stringify(g2.placed.map(p => p.id).sort()) === before, 'buying land keeps every piece placed');

s.money = 1e20; s.runEarned = 1e20;
C.SUPP.forEach(bb => C.buySupp(s, bb));
assert(C.suppOwned(s, C.SUPP_BY_ID.park) === 1, 'one Green Space per purchase');
const dA = C.derive(s);
assert(isFinite(dA.training) && dA.training > 0 && dA.pay > 0 && dA.houseMult > 0, 'derive stays finite with every structure');

s.allEarned = 1e14;
const at = JSON.stringify(s.plan.at);
C.prestige(s);
assert(JSON.stringify(s.plan.at) === at && Object.keys(s.supp).length === 0 && Object.keys(s.plan.tray).length === 0, 'hand-over keeps positions, clears structures and tray');
s.fac.drill = 1; C.planAutoPlace(s);
assert(C.planGrid(s).placed.some(p => p.id === 'f:drill'), 'a rebuilt Drill Hall returns to the map');

if (process.argv.includes('--search')) {
  const maxLinks = (landLvl, owned, iters) => {
    const st = C.newState(); st.allEarned = 1e30; st.plan.land = landLvl;
    C.FAC.forEach(f => st.fac[f.id] = owned); st.house = 1;
    C.planAutoPlace(st);
    let best = C.planEffects(st).links, cur = best, T = 2;
    const ids = C.planPieces(st).map(p => p.id), L = C.landSize(st);
    for (let i = 0; i < iters; i++) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      const save = JSON.stringify(st.plan);
      if (!C.planMove(st, id, Math.floor(Math.random() * L.c), Math.floor(Math.random() * L.r))) continue;
      st.plan.tray = {}; C.planAutoPlace(st);
      const v = C.planEffects(st).links;
      if (v >= cur || Math.random() < Math.exp((v - cur) / T)) { cur = v; best = Math.max(best, v); } else st.plan = JSON.parse(save);
      T = Math.max(0.05, T * 0.9995);
    }
    return best;
  };
  console.log('     max links, no annexes, 6x4:', maxLinks(0, 10, 6000));
  console.log('     max links, 1 annex each, 6x4:', maxLinks(0, 80, 8000));
  console.log('     max links, 2 annexes each, 8x5:', maxLinks(3, 200, 8000));
}
fs.unlinkSync(coreFile);
