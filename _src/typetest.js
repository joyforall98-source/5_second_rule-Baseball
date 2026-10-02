// 타구 종류별 안타율 점검: node typetest.js [EASY|HARD]
// (실제 야구 참고: 라이너 ~.680, 땅볼 ~.240, 뜬공 ~.130(홈런 제외), 팝업 ~.020)
const { BB_SIM } = require(`./sim.js`);
const diff = process.argv[2] || `EASY`, by = {};
for (let i = 0; i < 60000; i++) {
  let q = Math.min(1, Math.max(0, 1 - Math.abs(Math.random() * 0.5) ** 1.3 + (Math.random() - 0.5) * 0.16)),
    bb = BB_SIM.batted(q, (Math.random() * 2 - 1) * 42, false),
    r = BB_SIM.play(bb, { bases: [Math.random() < 0.3, Math.random() < 0.2, Math.random() < 0.15], outs: Math.floor(Math.random() * 3), diff }),
    t = (by[bb.kind] ||= { n: 0, hit: 0, hr: 0, xbh: 0, tri: 0 });
  t.n++;
  if (r.homeRun) { t.hr++; continue; }
  if (r.batterBase > 0 && !/실책|야수선택/.test(r.label)) (t.hit++, r.batterBase >= 2 && t.xbh++, r.batterBase === 3 && t.tri++);
}
for (let [k, t] of Object.entries(by))
  console.log(`${k.padEnd(7)} 비중 ${((100 * t.n) / 60000).toFixed(1)}%  안타율(홈런 제외) ${(t.hit / (t.n - t.hr)).toFixed(3)}  장타 ${((100 * t.xbh) / t.n).toFixed(1)}%  3루타 ${((100 * t.tri) / t.n).toFixed(2)}%  홈런 ${((100 * t.hr) / t.n).toFixed(1)}%`);
