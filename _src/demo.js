// ── DEMO MODE: 체육 수업용 전략 상황 카드 ──
// 카드마다 상황(주자·아웃·수비 위치·타자)과 선택지. 선택지마다 정해진 타구(bb)와 주자 지시(orders)가 있어
// 좋은 선택은 늘 좋은 결과, 아쉬운 선택은 늘 아쉬운 결과가 나옴 (sim.js의 demo 옵션: 실책·무작위 없음).
// variants가 있으면 시작할 때마다 그중 하나 (예: 발 빠른 타자 / 힘 센 타자)
// 좌표는 m: x는 오른쪽(1루 쪽)이 +, y는 홈에서 중견수 쪽. phi는 타구 방향(도), 음수가 왼쪽(3루 쪽)
// expect는 demotest.js가 확인하는 결과 (득점 runs, 늘어난 아웃 outs, 끝난 뒤 주자 bases)
// 선택지의 fielders(있으면 카드의 수비 위치 대신), sim(miss·backup·firstThrow 등)은 sim.js 옵션
var BB_DEMO = [
  // ── 기초 규칙 (side: basic). rule은 질문 위에 보이는 규칙 설명 ──
  {
    side: `basic`,
    title: `뜬공 잡히면 귀루`,
    bases: [!0, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    rule: `📏 규칙: 뜬공이 땅에 닿기 전에 잡히면 타자는 아웃! 주자는 원래 있던 베이스를 다시 밟아야 해요. 돌아오기 전에 공이 그 베이스에 먼저 오면 주자도 아웃이에요.`,
    ask: `타자가 높은 뜬공을 쳤어요! 1루 주자는 어떻게 할까요?`,
    options: [
      {
        label: `공이 잡히는지 보면서 1루 가까이에서 기다리기`,
        good: !0,
        bb: { kind: `fly`, phi: 25, D: 70, T: 3.5 },
        expect: { outs: 1, bases: [!0, !1, !1] },
        explain: `뜬공이 잡혀 타자만 아웃! 기다린 주자는 바로 1루로 돌아와 살았어요. 뜬공이 뜨면 먼저 잡히는지 봐요.`,
      },
      {
        label: `치자마자 2루로 힘껏 달리기`,
        good: !1,
        bb: { kind: `fly`, phi: 25, D: 70, T: 3.5 },
        orders: [{ t: 0.2, id: `runner-1`, base: 2 }],
        expect: { outs: 2, bases: [!1, !1, !1] },
        explain: `공이 잡히면 1루로 돌아가 베이스를 다시 밟아야 해요. 너무 멀리 달려서 돌아오기 전에 공이 1루에 먼저 와 주자까지 아웃! (한 번에 아웃 2개)`,
      },
    ],
  },
  {
    side: `basic`,
    title: `땅볼엔 꼭 뛰기`,
    bases: [!0, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    rule: `📏 규칙: 타자가 치면 1루로 뛰어요. 1루 주자는 자리를 비켜 줘야 하므로 땅볼이면 꼭 2루로 뛰어야 해요. 이때 수비는 공을 들고 2루를 밟기만 해도 아웃시킬 수 있어요(포스 아웃).`,
    ask: `타자가 3루 쪽으로 느린 땅볼을 쳤어요! 1루 주자는?`,
    options: [
      {
        label: `치자마자 2루로 달리기`,
        good: !0,
        bb: { kind: `ground`, phi: -20, v0: 16 },
        orders: [{ t: 0.05, id: `runner-1`, base: 2 }],
        expect: { outs: 1, bases: [!1, !0, !1] },
        explain: `빨리 출발해 2루에서 살았어요! 수비는 타자만 1루에서 잡았어요. 땅볼이면 1루 주자는 망설이지 말고 뛰어요.`,
      },
      {
        label: `잡히는지 보고 천천히 출발하기`,
        good: !1,
        bb: { kind: `ground`, phi: -20, v0: 16 },
        orders: [
          { t: 0.05, id: `runner-1`, base: 1 },
          { t: 1.6, id: `runner-1`, base: 2 },
        ],
        expect: { outs: 1, bases: [!0, !1, !1] },
        explain: `늦게 출발해 2루에서 포스 아웃! 땅볼일 때 1루 주자는 꼭 바로 뛰어야 해요.`,
      },
    ],
  },
  {
    side: `basic`,
    title: `2아웃엔 바로 뛰기`,
    bases: [!1, !0, !1],
    outs: 2,
    batter: `우타 · 보통 주력`,
    rule: `📏 규칙: 3아웃이 되면 공수 교대예요. 2아웃이면 공이 잡혀도 어차피 공격이 끝나니, 주자는 치자마자 뛰어요.`,
    ask: `타자가 공을 쳤어요! 2루 주자는?`,
    options: [
      {
        label: `치자마자 홈까지 달리기`,
        good: !0,
        bb: { kind: `line`, phi: 5, D: 62, T: 1.63 },
        orders: [{ t: 0.05, id: `runner-2`, base: 4 }],
        expect: { runs: 1 },
        explain: `바로 출발해 홈까지 들어왔어요! 2아웃에서는 기다릴 필요가 없어요.`,
      },
      {
        label: `공이 떨어지는지 보고 출발하기`,
        good: !1,
        bb: { kind: `line`, phi: 5, D: 62, T: 1.63 },
        orders: [
          { t: 0.05, id: `runner-2`, base: 2 },
          { t: 1.9, id: `runner-2`, base: 3 },
        ],
        expect: { runs: 0, bases: [!0, !1, !0] },
        explain: `기다리다 늦게 출발해 3루에서 멈췄어요. 2아웃이면 바로 뛰어야 점수를 낼 수 있어요.`,
      },
    ],
  },
  {
    side: `basic`,
    title: `1루는 달려 통과`,
    bases: [!1, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    rule: `📏 규칙: 1루는 밟고 지나쳐 달려도 아웃이 아니에요. (2루·3루는 지나치면 태그 아웃될 수 있어요.)`,
    ask: `유격수 쪽으로 깊은 땅볼을 쳤어요! 1루까지 어떻게 달릴까요?`,
    options: [
      {
        label: `1루를 지나치듯 끝까지 전력 질주`,
        good: !0,
        batRun: 7.6,
        bb: { kind: `ground`, phi: -17, v0: 20 },
        expect: { outs: 0, bases: [!0, !1, !1] },
        explain: `속도를 줄이지 않고 달려 1루에서 살았어요(내야안타)! 1루는 지나쳐 달려도 돼요.`,
      },
      {
        label: `1루에 멈추려고 앞에서 속도 줄이기`,
        good: !1,
        batRun: 6.6,
        bb: { kind: `ground`, phi: -17, v0: 20 },
        expect: { outs: 1 },
        explain: `멈추려고 속도를 줄인 사이 공이 먼저 1루에 왔어요. 1루는 끝까지 달려 지나가요.`,
      },
    ],
  },
  {
    side: `basic`,
    title: `태그업`,
    bases: [!1, !1, !0],
    outs: 1,
    batter: `우타 · 보통 주력`,
    rule: `📏 규칙: 뜬공이 잡힌 뒤에도 주자는 원래 베이스를 다시 밟고 출발하면 다음 루로 갈 수 있어요(태그업). 잡히기 전에 출발하면 다시 돌아와 밟아야 해요.`,
    ask: `외야로 높은 뜬공! 3루 주자는?`,
    options: [
      {
        label: `3루를 밟고 있다가, 잡히는 순간 출발`,
        good: !0,
        bb: { kind: `fly`, phi: 8, D: 84, T: 4 },
        expect: { runs: 1, outs: 1 },
        explain: `잡힌 순간 출발해 홈인! 태그업으로 1점을 냈어요.`,
      },
      {
        label: `치자마자 홈으로 달리기`,
        good: !1,
        bb: { kind: `fly`, phi: 8, D: 84, T: 4 },
        orders: [{ t: 0.2, id: `runner-3`, base: 4 }],
        expect: { runs: 0, outs: 2 },
        explain: `잡히기 전에 출발해 3루를 다시 밟지 않았으니 득점 취소, 주자도 아웃이에요.`,
      },
    ],
  },
  {
    side: `basic`,
    defense: !0,
    title: `파울 뜬공도 아웃`,
    bases: [!1, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    rule: `📏 규칙: 파울 지역에 뜬 공이라도 땅에 닿기 전에 잡으면 타자는 아웃이에요.`,
    ask: `1루 쪽 파울 지역으로 뜬공이 날아가요! 1루수는?`,
    options: [
      {
        label: `끝까지 쫓아가 잡기`,
        good: !0,
        bb: { kind: `fly`, foul: !0, phi: 52, D: 30, T: 3.2 },
        expect: { outs: 1 },
        explain: `파울 뜬공을 잡아 타자 아웃! 파울이라도 끝까지 쫓아가요.`,
      },
      {
        label: `파울이니까 그냥 두기`,
        good: !1,
        sim: { noChase: !0 },
        bb: { kind: `fly`, foul: !0, phi: 52, D: 30, T: 3.2 },
        expect: { outs: 0 },
        explain: `잡을 수 있었는데 포기해서 타자에게 다시 칠 기회를 줬어요.`,
      },
    ],
  },
  {
    side: `basic`,
    title: `앞 주자 추월 금지`,
    bases: [!0, !1, !0],
    outs: 1,
    batter: `우타 · 보통 주력`,
    rule: `📏 규칙: 뒤에 있는 주자가 앞 주자를 앞질러 가면 앞지른 주자가 아웃이에요. 달릴 때는 앞 주자를 보며 달려요.`,
    ask: `안타! 그런데 3루 주자가 홈으로 갈지 망설이며 3루에 멈췄어요. 1루 주자는?`,
    options: [
      {
        label: `앞 주자를 보며 2루까지만 가기`,
        good: !0,
        bb: { kind: `line`, phi: -15, D: 58, T: 1.54 },
        orders: [{ t: 1.64, id: `runner-3`, base: 3 }],
        expect: { outs: 0, bases: [!0, !0, !0] },
        explain: `앞 주자를 보고 2루에서 멈춰 1사 만루로 기회를 이어 갔어요!`,
      },
      {
        label: `앞만 보고 홈까지 달리기`,
        good: !1,
        bb: { kind: `line`, phi: -15, D: 58, T: 1.54 },
        orders: [
          { t: 0.15, id: `runner-1`, base: 4 },
          { t: 1.64, id: `runner-3`, base: 3 },
        ],
        expect: { outs: 1, runs: 0 },
        explain: `3루에 멈춘 앞 주자를 앞질러 아웃! 달릴 때는 앞 주자가 어디 있는지 꼭 봐요.`,
      },
    ],
  },
  {
    title: `빈 곳으로`,
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
    title: `안전한 진루`,
    bases: [!1, !0, !1],
    outs: 1,
    batter: `우타 · 보통 주력`,
    fielders: { "out-lf": { x: -34, y: 54 } }, // 좌익수가 앞쪽에 있음
    ask: `타자가 왼쪽으로 짧은 안타를 쳤어요. 좌익수가 앞에 있어요. 2루 주자는?`,
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
    title: `능력에 맞게`,
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
    ask: `주자를 다음 베이스로 보내려면 어떻게 칠까요?`,
    options: [
      {
        label: `짧게 잡고 정확하게 맞히기`,
        good: !0,
        bb: { kind: `line`, phi: 14, D: 52, T: 1.4 },
        expect: { outs: 0 },
        explain: `정확히 맞혀 주자를 한 베이스 더 보냈어요! 아웃 카운트에 연연하기보다 정확히 맞혀 베이스에 많이 나가는 게 중요해요.`,
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
    title: `희생플라이`,
    bases: [!1, !1, !0],
    outs: 1,
    batter: `우타 · 보통 주력`,
    ask: `아웃이 되더라도 점수를 내려면 어떻게 칠까요?`,
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
    title: `타자 맞춤 위치`,
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
    title: `간격 맞추기`,
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
    title: `앞선 주자 잡기`,
    bases: [!0, !1, !1],
    outs: 0,
    batter: `우타 · 보통 주력`,
    ask: `유격수 앞 땅볼! 공을 잡은 유격수는?`,
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
        label: `타자만 잡으려고 1루로 던지기`,
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
  return { demo: !0, fielders: op.fielders ?? c.fielders, batRun: op.batRun ?? c.batRun, orders: op.orders, ...op.sim };
}
// 목록·안내판의 이름: 기초 1, 공격 1~5, 수비 1~4 (side 없으면 공격)
var BB_DEMO_SIDES = { basic: `기초`, atk: `공격`, def: `수비` };
function bbDemoName(ci) {
  let side = BB_DEMO[ci].side || `atk`;
  return `${BB_DEMO_SIDES[side]} ${BB_DEMO.slice(0, ci + 1).filter((x) => (x.side || `atk`) === side).length}`;
}
typeof module !== `undefined` && (module.exports = { BB_DEMO, bbDemoCase, bbDemoSim });
