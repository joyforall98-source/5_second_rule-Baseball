// ── DEMO MODE: 체육 수업용 전략 상황 카드 ──
// 카드마다 상황(주자·아웃·수비 위치·타자)과 선택지. 선택지마다 정해진 타구(bb)와 주자 지시(orders)가 있어
// 좋은 선택은 늘 좋은 결과, 아쉬운 선택은 늘 아쉬운 결과가 나옴 (sim.js의 demo 옵션: 실책·무작위 없음).
// variants가 있으면 시작할 때마다 그중 하나 (예: 발 빠른 타자 / 힘 센 타자)
// 좌표는 m: x는 오른쪽(1루 쪽)이 +, y는 홈에서 중견수 쪽. phi는 타구 방향(도), 음수가 왼쪽(3루 쪽)
// expect는 demotest.js가 확인하는 결과 (득점 runs, 늘어난 아웃 outs, 끝난 뒤 주자 bases)
// 선택지의 fielders(있으면 카드의 수비 위치 대신), sim(miss·backup·firstThrow 등)은 sim.js 옵션
var BB_DEMO = [
  {
    title: `빈 곳으로 보내기`,
    bases: [!1, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    // 수비가 왼쪽(3루 쪽)으로 몰림
    fielders: {
      "inf-1b": { x: 15, y: 27 },
      "inf-2b": { x: -2, y: 40 },
      "inf-ss": { x: -15, y: 38 },
      "inf-3b": { x: -24, y: 26 },
      "out-lf": { x: -52, y: 70 },
      "out-cf": { x: -16, y: 86 },
      "out-rf": { x: 22, y: 78 },
    },
    ask: `수비수들이 왼쪽(3루 쪽)에 몰려 있어요. 어디로 칠까요?`,
    options: [
      {
        label: `오른쪽 빈 곳으로 가볍게 밀어치기`,
        good: !0,
        bb: { kind: `ground`, phi: 13, v0: 32 },
        expect: { outs: 0, bases: [!0, !1, !1] },
        explain: `수비가 몰린 반대쪽 빈 곳으로 보내 안타! 힘보다 방향이 중요해요.`,
      },
      {
        label: `정면으로 강하게 치기`,
        good: !1,
        bb: { kind: `line`, phi: -4, D: 44, T: 1.2 },
        expect: { outs: 1 },
        explain: `강하게 쳐도 수비수 정면이면 아웃이에요. 빈 곳을 먼저 살펴요.`,
      },
      {
        label: `왼쪽으로 세게 당겨치기`,
        good: !1,
        bb: { kind: `ground`, phi: -24, v0: 30 },
        expect: { outs: 1 },
        explain: `수비수가 몰린 쪽으로 보내면 쉽게 잡혀요.`,
      },
    ],
  },
  {
    title: `안전하게 진루하기`,
    bases: [!1, !0, !1],
    outs: 1,
    batter: `우타 · 보통 주력`,
    fielders: { "out-lf": { x: -34, y: 54 } }, // 좌익수가 앞쪽에 있음
    ask: `1사 2루, 타자가 왼쪽으로 짧은 안타를 쳤어요. 좌익수가 앞에 있어요. 2루 주자는?`,
    options: [
      {
        label: `3루에서 멈추기`,
        good: !0,
        bb: { kind: `ground`, phi: -24, v0: 36 },
        orders: [{ t: 0.4, id: `runner-2`, base: 3 }],
        expect: { outs: 0, runs: 0, bases: [!0, !1, !0] },
        explain: `1사 1·3루로 기회를 이어 갔어요! 다음 타자의 안타나 뜬공 때 안전하게 들어올 수 있어요.`,
      },
      {
        label: `홈까지 끝까지 달리기`,
        good: !1,
        bb: { kind: `ground`, phi: -24, v0: 36 },
        orders: [{ t: 0.4, id: `runner-2`, base: 4 }],
        expect: { outs: 1, runs: 0 },
        explain: `공이 먼저 홈에 도착해 아웃! 무리한 질주는 기회를 날려요.`,
      },
    ],
  },
  {
    title: `능력에 맞게 치기`,
    bases: [!1, !1, !1],
    outs: 0,
    variants: [
      {
        batter: `우타 · 발이 아주 빠름`,
        batRun: 8.6,
        ask: `발이 아주 빠른 타자예요. 어떻게 칠까요?`,
        options: [
          {
            label: `땅볼로 내야 깊숙이 굴리기`,
            good: !0,
            bb: { kind: `ground`, phi: -17, v0: 20 },
            expect: { outs: 0, bases: [!0, !1, !1] },
            explain: `빠른 발로 송구보다 먼저 1루에! 발 빠른 타자는 땅볼로 내야안타를 노려요.`,
          },
          {
            label: `외야로 크게 띄우기`,
            good: !1,
            bb: { kind: `fly`, phi: 6, D: 72, T: 3.6 },
            expect: { outs: 1 },
            explain: `멀리 보내는 힘이 부족하면 외야 뜬공으로 잡혀요. 장점(빠른 발)을 살려요.`,
          },
        ],
      },
      {
        batter: `우타 · 힘이 셈, 발은 느림`,
        batRun: 6.4,
        ask: `힘이 센 타자예요(발은 느림). 어떻게 칠까요?`,
        options: [
          {
            label: `외야로 크게 띄우기`,
            good: !0,
            bb: { kind: `fly`, phi: -32, D: 110, T: 4.3 },
            expect: { outs: 0, bases: [!1, !0, !1] },
            explain: `힘을 살려 외야 깊숙이 2루타! 힘 센 타자는 외야로 크게 보내 장타를 노려요.`,
          },
          {
            label: `땅볼로 내야 깊숙이 굴리기`,
            good: !1,
            bb: { kind: `ground`, phi: -17, v0: 20 },
            expect: { outs: 1 },
            explain: `발이 느리면 내야 땅볼은 1루에서 아웃돼요. 장점(힘)을 살려요.`,
          },
        ],
      },
    ],
  },
  {
    title: `연결 야구`,
    bases: [!0, !1, !1],
    outs: 0,
    batter: `좌타 · 보통 주력`,
    ask: `무사 1루예요. 어떻게 칠까요?`,
    options: [
      {
        label: `짧게 잡고 정확하게 맞히기`,
        good: !0,
        bb: { kind: `line`, phi: 14, D: 52, T: 1.4 },
        expect: { outs: 0 },
        explain: `정확히 맞혀 주자를 한 베이스 더 보냈어요! 아웃보다 출루를 이어 가는 게 중요해요.`,
      },
      {
        label: `홈런을 노리고 크게 휘두르기`,
        good: !1,
        bb: { kind: `pop`, phi: 4, D: 20, T: 4.2 },
        expect: { outs: 1, bases: [!0, !1, !1] },
        explain: `크게 휘두르다 빗맞아 내야 뜬공 아웃. 주자도 그대로예요.`,
      },
    ],
  },
  {
    title: `희생타로 득점하기`,
    bases: [!1, !1, !0],
    outs: 1,
    batter: `우타 · 보통 주력`,
    ask: `1사 3루예요. 아웃이 되더라도 점수를 내려면?`,
    options: [
      {
        label: `외야로 멀리 띄우기`,
        good: !0,
        bb: { kind: `fly`, phi: 8, D: 84, T: 4 },
        expect: { outs: 1, runs: 1 },
        explain: `외야 뜬공이 잡힌 뒤 3루 주자가 다시 베이스를 밟고 출발해 득점! 희생플라이예요.`,
      },
      {
        label: `내야로 높이 띄우기`,
        good: !1,
        bb: { kind: `pop`, phi: -8, D: 22, T: 4.2 },
        expect: { outs: 1, runs: 0, bases: [!1, !1, !0] },
        explain: `내야 뜬공은 너무 가까워 3루 주자가 뛸 수 없어요. 점수 없이 아웃.`,
      },
      {
        label: `3루 쪽으로 강한 땅볼`,
        good: !1,
        bb: { kind: `ground`, phi: -38, v0: 26 },
        expect: { outs: 1, runs: 0 },
        explain: `3루수 앞 땅볼이면 주자가 홈으로 못 뛰어요. 외야로 띄워야 해요.`,
      },
    ],
  },
  // ── 수비 전략 (side: def). 선택지의 fielders는 그 선택으로 바뀐 수비 위치({}는 기본 위치) ──
  {
    side: `def`,
    title: `타자에 맞춰 수비 위치 잡기`,
    bases: [!1, !1, !1],
    outs: 0,
    batter: `좌타 · 힘이 셈 (오른쪽으로 멀리 당겨치는 편)`,
    ask: `상대는 힘이 센 왼쪽 타자예요. 수비 위치를 어떻게 할까요?`,
    options: [
      {
        label: `오른쪽·뒤로 옮기기`,
        good: !0,
        fielders: {
          "inf-1b": { x: 22, y: 26 },
          "inf-2b": { x: 16, y: 40 },
          "inf-ss": { x: 2, y: 42 },
          "inf-3b": { x: -12, y: 28 },
          "out-lf": { x: -30, y: 80 },
          "out-cf": { x: 14, y: 94 },
          "out-rf": { x: 36, y: 86 },
        },
        bb: { kind: `line`, phi: 20, D: 88, T: 2.2 },
        expect: { outs: 1 },
        explain: `타자의 성향을 읽고 오른쪽 뒤에서 기다려 잡아냈어요!`,
      },
      {
        label: `그대로 두기`,
        good: !1,
        bb: { kind: `line`, phi: 20, D: 88, T: 2.2 },
        expect: { outs: 0 },
        explain: `타구가 수비 사이로 빠져 장타가 됐어요. 타자를 보고 위치를 바꿔요.`,
      },
      {
        label: `왼쪽·앞으로 당기기`,
        good: !1,
        fielders: {
          "inf-1b": { x: 18, y: 26 },
          "inf-2b": { x: 4, y: 40 },
          "inf-ss": { x: -14, y: 40 },
          "inf-3b": { x: -22, y: 26 },
          "out-lf": { x: -50, y: 70 },
          "out-cf": { x: -10, y: 82 },
          "out-rf": { x: 36, y: 66 },
        },
        bb: { kind: `line`, phi: 20, D: 88, T: 2.2 },
        expect: { outs: 0 },
        explain: `타자 성향과 반대로 움직이면 큰 타구를 막을 수 없어요.`,
      },
    ],
  },
  {
    side: `def`,
    title: `빈 곳 없이 간격 맞추기`,
    bases: [!1, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    // 수비수가 왼쪽에 몰려 1·2루 사이가 비어 있음
    fielders: {
      "inf-1b": { x: 22, y: 24 },
      "inf-2b": { x: -3, y: 42 },
      "inf-ss": { x: -12, y: 40 },
      "inf-3b": { x: -21, y: 27 },
      "out-lf": { x: -44, y: 72 },
      "out-cf": { x: -14, y: 88 },
      "out-rf": { x: 30, y: 76 },
    },
    ask: `수비수들이 왼쪽에 몰려 1·2루 사이가 비었어요. 어떻게 할까요?`,
    options: [
      {
        label: `간격을 고르게 벌리기`,
        good: !0,
        fielders: {},
        bb: { kind: `ground`, phi: 12, v0: 28 },
        expect: { outs: 1 },
        explain: `간격을 맞춰 빈 곳을 없애니 1·2루 사이 땅볼도 잡아냈어요!`,
      },
      {
        label: `그대로 두기`,
        good: !1,
        bb: { kind: `ground`, phi: 12, v0: 28 },
        expect: { outs: 0, bases: [!0, !1, !1] },
        explain: `한쪽에 몰려 생긴 빈 곳으로 공이 빠져나갔어요.`,
      },
    ],
  },
  {
    side: `def`,
    title: `백업 플레이`,
    bases: [!0, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    ask: `좌익수 쪽으로 뜬공! 혹시 좌익수가 공을 놓친다면? 중견수는 어떻게 할까요?`,
    options: [
      {
        label: `좌익수 뒤쪽으로 백업 가기`,
        good: !0,
        sim: { miss: !0, backup: !0 },
        bb: { kind: `fly`, phi: -18, D: 78, T: 3.8 },
        expect: { runs: 0, bases: [!0, !0, !1] },
        explain: `좌익수가 공을 빠뜨렸지만 중견수가 뒤에서 받아 실점을 막았어요!`,
      },
      {
        label: `제자리에서 지켜보기`,
        good: !1,
        sim: { miss: !0 },
        bb: { kind: `fly`, phi: -18, D: 78, T: 3.8 },
        expect: { runs: 2 },
        explain: `아무도 뒤를 받치지 않아 공이 끝까지 굴러가 2점을 내줬어요.`,
      },
    ],
  },
  {
    side: `def`,
    title: `빠른 송구로 앞선 주자 잡기`,
    bases: [!0, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    ask: `무사 1루, 유격수 앞 땅볼! 공을 잡은 유격수는?`,
    options: [
      {
        label: `가까운 2루로 빠르게 던지기`,
        good: !0,
        sim: { firstThrow: { base: 2 } },
        bb: { kind: `ground`, phi: -12, v0: 28 },
        expect: { outs: 1, bases: [!0, !1, !1] },
        explain: `가까운 2루로 빠르게 던져 앞선 주자를 잡았어요!`,
      },
      {
        label: `공을 들고 2루까지 뛰어가기`,
        good: !1,
        sim: { firstThrow: { base: 2, carry: !0 } },
        bb: { kind: `ground`, phi: -12, v0: 28 },
        expect: { outs: 0, bases: [!0, !0, !1] },
        explain: `직접 뛰면 느려서 모두 살았어요. 공은 던지는 게 훨씬 빨라요.`,
      },
      {
        label: `멀리 1루로 던지기`,
        good: !1,
        sim: { firstThrow: { base: 1 } },
        bb: { kind: `ground`, phi: -12, v0: 28 },
        expect: { outs: 1, bases: [!1, !0, !1] },
        explain: `타자는 잡았지만 앞선 주자가 2루까지 갔어요. 앞선 주자를 먼저 잡아요.`,
      },
    ],
  },
];
// 카드(와 variant)를 하나의 상황으로 펼침
function bbDemoCase(card, vi = 0) {
  let v = card.variants ? card.variants[vi % card.variants.length] : {};
  return { ...card, ...v, variants: void 0 };
}
// 선택지까지 반영한 sim.js 옵션
function bbDemoSim(c, op) {
  return { demo: !0, fielders: op.fielders ?? c.fielders, batRun: c.batRun, orders: op.orders, ...op.sim };
}
// 목록·안내판의 이름: 공격 1~5, 수비 1~4
function bbDemoName(ci) {
  let def = BB_DEMO[ci].side === `def`;
  return `${def ? `수비` : `공격`} ${BB_DEMO.slice(0, ci + 1).filter((x) => (x.side === `def`) === def).length}`;
}
typeof module !== `undefined` && (module.exports = { BB_DEMO, bbDemoCase, bbDemoSim });
