// 타구 결과 분포 점검:  node simtest.js [EASY|HARD] [타이밍오차ms]
// 스윙 판정(app.js pe)과 같은 식으로 q·방향을 만든 뒤 sim.js로 결과를 집계합니다.
const { BB_SIM } = require(`./sim.js`);
const SPEED = 1.8, // app.js의 재생 배속과 같게
  diff = process.argv[2] || `EASY`,
  sd = +(process.argv[3] || 45),
  win = diff === `HARD` ? 85 : 115,
  N = 20000,
  gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
let tally = {},
  inPlay = 0,
  fouls = 0,
  misses = 0,
  hits = 0,
  hr = 0,
  bases = 0,
  runs = 0,
  maxDur = 0,
  longPlays = 0;
const add = (k) => (tally[k] = (tally[k] || 0) + 1);
for (let i = 0; i < N; i++) {
  let dt = gauss() * sd,
    adt = Math.abs(dt),
    off = Math.random() * 1.0; // 존 안 공만 친다고 가정
  if (adt > win) {
    misses++;
    continue;
  }
  let q = 1 - (adt / win) ** 1.3;
  ((q *= 1 - 0.15 * Math.max(0, Math.min(1, off) - 0.5)), (q = Math.max(0, Math.min(1, q + (Math.random() - 0.5) * 0.16))));
  let lat = (-dt / win) * 22 + (Math.random() - 0.5) * 8,
    foul = q < 0.12 || Math.abs(lat) > 16,
    bb = BB_SIM.batted(q, (lat * 45) / 16, foul),
    st = { bases: [Math.random() < 0.3, Math.random() < 0.2, Math.random() < 0.15], outs: Math.floor(Math.random() * 3), diff },
    P = BB_SIM.start(bb, st).runToEnd(),
    r = P.result();
  maxDur = Math.max(maxDur, P.t);
  P.t / SPEED > 5 && longPlays++;
  if (r.foul && !r.foulOut) {
    fouls++;
    continue;
  }
  inPlay++;
  runs += r.runs;
  let key = r.homeRun ? `홈런` : r.outsAdded ? r.label.replace(/^.* → /, `송구아웃: `).replace(/\(.*\)/, ``).replace(/^(1루수|2루수|유격수|3루수|좌익수|중견수|우익수|포수) /, ``) : r.label.replace(/^\d타점 /, ``);
  add(key.trim());
  if (r.batterBase > 0 && !/실책|야수선택/.test(r.label)) (hits++, (bases += r.batterBase));
  r.homeRun && hr++;
}
const pct = (x) => ((100 * x) / inPlay).toFixed(1) + `%`;
console.log(`${diff}, 타이밍 오차 σ=${sd}ms — 스윙 ${N}회: 헛스윙 ${misses}, 파울 ${fouls}, 인플레이 ${inPlay}`);
console.log(`인플레이 타율 ${(hits / inPlay).toFixed(3)}, 장타율 ${(bases / inPlay).toFixed(3)}, 홈런 ${pct(hr)}, 인플레이당 득점 ${(runs / inPlay).toFixed(3)}`);
console.log(`가장 긴 플레이 ${maxDur.toFixed(1)}s(게임시간), ${SPEED}배속 재생 시 5초 초과 ${longPlays}건`);
Object.entries(tally)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${pct(v)}`));
