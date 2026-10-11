// DEMO 상황 카드 점검:  node demotest.js
// 선택지마다 sim.js로 플레이를 끝까지 돌려, 결과가 카드의 expect(좋은 선택 → 좋은 결과)와 맞는지 확인
const { BB_SIM } = require(`./sim.js`);
const { BB_DEMO, bbDemoCase, bbDemoSim } = require(`./demo.js`);
let bad = 0;
BB_DEMO.forEach((card, ci) => {
  for (let vi = 0; vi < (card.variants || [0]).length; vi++) {
    const c = bbDemoCase(card, vi);
    for (const op of c.options) {
      for (const diff of [`EASY`]) { // DEMO는 EASY로 고정
        const r = BB_SIM.start({ ...op.bb }, { bases: [...c.bases], outs: c.outs, diff, ...bbDemoSim(c, op) }).runToEnd().result(),
          got = { runs: r.runs, outs: r.outsAdded, bases: r.outsAdded + c.outs >= 3 ? [!1, !1, !1] : r.newBases },
          ok = Object.entries(op.expect).every(([k, v]) => JSON.stringify(got[k]) === JSON.stringify(v));
        ok || bad++;
        console.log(`${ok ? `OK ` : `XX `} ${ci + 1}${card.variants ? `-${vi + 1}` : ``} ${diff} ${op.good ? `좋음` : `아쉬움`} ${op.label} → ${r.label} (득점 ${r.runs}, 아웃 +${r.outsAdded}, 주자 ${got.bases.map((b, i) => (b ? i + 1 : ``)).join(``) || `-`})`);
      }
    }
  }
});
console.log(bad ? `\n${bad}개 불일치` : `\n모두 일치`);
process.exitCode = bad ? 1 : 0;
