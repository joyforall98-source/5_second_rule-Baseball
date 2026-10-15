// 공격·수비 규칙 점검: node audittest.js [플레이 수]
// 무작위 타구·번트·도루·견제 런다운을 끝까지 돌려 규칙 위반을 모음. 하나라도 있으면 종료 코드 1
const { BB_SIM } = require(`./sim.js`);
const N = +(process.argv[2] || 20000);
let bad = {}, ex = {}, plays = 0;
const flag = (k, info) => ((bad[k] = (bad[k] || 0) + 1), (ex[k] = ex[k] || []).length < 2 && ex[k].push(info));
for (let i = 0; i < N; i++) {
  let bases = [Math.random() < 0.45, Math.random() < 0.35, Math.random() < 0.25].map((x) => (x ? 1 : 0)),
    outs = Math.floor(Math.random() * 3),
    u = Math.random(),
    bb = u < 0.1 ? BB_SIM.bunt(!1, Math.random() * 60 - 30, Math.random() < 0.2) : u < 0.15 ? { steal: !0 } : u < 0.18 ? { pick: 1 + Math.floor(Math.random() * 2) } : BB_SIM.batted(Math.random(), Math.random() * 90 - 45, Math.random() < 0.1),
    steal = null;
  if (bb.pick && (!bases[bb.pick - 1] || bases[bb.pick])) continue;
  if (bb.steal) {
    let b = [1, 2, 3].filter((x) => bases[x - 1] && (x === 3 || !bases[x]));
    if (!b.length) continue;
    steal = { [b[0]]: Math.random() * 0.8 };
  }
  let info = { bb, bases: bases.join(``), outs, steal },
    P = BB_SIM.start({ ...bb }, { bases: [...bases], outs, diff: Math.random() < 0.5 ? `EASY` : `HARD`, leads: [0, 0, 0].map(() => Math.floor(Math.random() * 3) - 1), steal });
  plays++;
  while (!P.done) {
    let before = Object.values(P.f).map((f) => [f.x, f.y]);
    P.step(0.02);
    Object.values(P.f).some((f, j) => Math.hypot(f.x - before[j][0], f.y - before[j][1]) > 3) && flag(`수비수 순간이동`, info);
  }
  let r = P.result(),
    total = outs + r.outsAdded,
    live = P.r.filter((x) => x.state !== `out` && x.state !== `scored`);
  P.t > 29 && flag(`30초 넘은 플레이`, info);
  total > 3 && flag(`아웃 3개 초과`, { ...info, label: r.label });
  if (total < 3 && !P.foul && !P.homeRun) {
    for (let x of live) Number.isInteger(x.s) && x.s >= 1 && x.s <= 3 || flag(`베이스 사이에 멈춘 주자`, { ...info, id: x.id, s: x.s, label: r.label });
    // 주자 수 보존: 시작 주자(+타자) = 아웃 + 득점 + 누상
    bases.filter(Boolean).length + (P.runnerOnly ? 0 : 1) !== r.outsAdded + P.runs.length + r.newBases.filter(Boolean).length && flag(`주자 수 보존 깨짐`, { ...info, label: r.label });
  }
  total >= 3 && r.runs > 0 && P.outs[2 - outs]?.force && flag(`포스 3아웃인데 득점 인정`, { ...info, label: r.label });
  r.batterBase >= 1 && P.outs.some((o) => o.id === `runner-t`) && flag(`타자 아웃인데 출루로 기록`, { ...info, label: r.label });
}
console.log(`${plays}개 플레이`, Object.keys(bad).length ? bad : `이상 없음`);
for (let k in ex) ex[k].forEach((e) => console.log(k, JSON.stringify(e)));
process.exit(Object.keys(bad).length ? 1 : 0);
