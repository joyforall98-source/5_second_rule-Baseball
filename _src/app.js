// 필드 화면 위치(px)는 sim.js의 실제 치수(m)에서 계산: v = 베이스(0 홈 ~ 4 홈), y = 수비 위치
var v = Object.fromEntries(BB_BASES.map((b, i) => [i, bbPx(b)])),
  y = Object.fromEntries(Object.entries(BB_FIELD_M).map(([k, m]) => [k, bbPx(m)]));
// 위에서 본 경기장 (필드 850×580px, 1m = BB_K px). 펜스·파울폴·내야를 실제 비율로 그림
var BB_FIELD_SVG = (() => {
  let P = (m) => [425 + m.x * BB_K, 560 - m.y * BB_K],
    at = (phi, s) => ({ x: Math.sin((phi * Math.PI) / 180) * s, y: Math.cos((phi * Math.PI) / 180) * s }),
    arc = (off) => {
      let pts = [];
      for (let a = -45; a <= 45; a += 1.5) pts.push(P(at(a, bbFence(a) + off)).join(`,`));
      return pts.join(` `);
    },
    home = P({ x: 0, y: 0 }),
    poleL = P(at(-45, 98)),
    poleR = P(at(45, 98)),
    mound = P(BB_MOUND),
    sq = (m, s) => {
      let [x, yy] = P(m);
      return `<rect x="${x - s / 2}" y="${yy - s / 2}" width="${s}" height="${s}" transform="rotate(45 ${x} ${yy})" fill="#fff"/>`;
    },
    label = (phi, txt) => {
      let [x, yy] = P(at(phi, bbFence(phi) - 9));
      return `<text x="${x}" y="${yy}" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" opacity=".9">${txt}</text>`;
    },
    diamond = [{ x: 0, y: 3.2 }, { x: 16.4, y: 19.4 }, { x: 0, y: 35.6 }, { x: -16.4, y: 19.4 }].map((m) => P(m).join(`,`)).join(` `);
  return `<svg class="bb-field-svg" viewBox="0 0 850 580" width="850" height="580" aria-hidden="true">
<defs>
<pattern id="bbMow" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="34" height="34" fill="#3b9846"/><rect width="17" height="34" fill="#44a651"/></pattern>
<pattern id="bbCrowd" width="7" height="6" patternUnits="userSpaceOnUse"><rect width="7" height="6" fill="#2a3140"/><circle cx="2" cy="2" r="1.3" fill="#c9b49c"/><circle cx="5.2" cy="4.4" r="1.3" fill="#5b7fae"/></pattern>
</defs>
<rect width="850" height="580" fill="#2f7a3a"/>
<polyline points="${arc(13)}" fill="none" stroke="url(#bbCrowd)" stroke-width="80"/>
<polygon points="${home.join(`,`)} ${arc(0)}" fill="url(#bbMow)"/>
<polyline points="${arc(-2.3)}" fill="none" stroke="#b5845a" stroke-width="${4.5 * BB_K}"/>
<polyline points="${arc(0.6)}" fill="none" stroke="#1d4d2b" stroke-width="6" stroke-linejoin="round"/>
<polyline points="${arc(1.6)}" fill="none" stroke="#f1c40f" stroke-width="1.6"/>
<g stroke="#f1c40f" stroke-width="3"><line x1="${poleL[0]}" y1="${poleL[1]}" x2="${poleL[0] - 3}" y2="${poleL[1] - 14}"/><line x1="${poleR[0]}" y1="${poleR[1]}" x2="${poleR[0] + 3}" y2="${poleR[1] - 14}"/></g>
${label(-41, `98m`)}${label(41, `98m`)}${label(-22.5, `114m`)}${label(22.5, `114m`)}${label(0, `120m`)}
<circle cx="${mound[0]}" cy="${mound[1]}" r="${29 * BB_K}" fill="#b9875a"/>
<polygon points="${diamond}" fill="#3f9e4b"/>
<circle cx="${mound[0]}" cy="${mound[1]}" r="${2.8 * BB_K}" fill="#c08e5f"/>
<rect x="${mound[0] - 3}" y="${mound[1] - 1}" width="6" height="2" fill="#fff"/>
<circle cx="${home[0]}" cy="${home[1]}" r="${4 * BB_K}" fill="#c08e5f"/>
<g stroke="#fff" stroke-width="1.6" opacity=".9"><line x1="${home[0]}" y1="${home[1]}" x2="${poleL[0]}" y2="${poleL[1]}"/><line x1="${home[0]}" y1="${home[1]}" x2="${poleR[0]}" y2="${poleR[1]}"/></g>
${sq(BB_BASES[1], 6)}${sq(BB_BASES[2], 6)}${sq(BB_BASES[3], 6)}
<polygon points="${home[0] - 3.5},${home[1] - 2} ${home[0] + 3.5},${home[1] - 2} ${home[0] + 3.5},${home[1] + 1} ${home[0]},${home[1] + 4} ${home[0] - 3.5},${home[1] + 1}" fill="#fff"/>
</svg>`;
})();
// ── 포수 뒤 타격 시점 좌표계 (bb-container 850×580 기준 px) ──
// 스트라이크존 중심/크기, 투수 릴리스 지점. 존 좌표 zx,zy는 -1~1이 존 안.
var BB_Z = { cx: 425, cy: 338, w: 96, h: 116 },
  BB_REL = { x: 432, y: 226 },
  bbPlateX = (zx) => BB_Z.cx + (zx * BB_Z.w) / 2,
  bbPlateY = (zy) => BB_Z.cy - (zy * BB_Z.h) / 2,
  bbPersp = (p) => (1 / (1 - 0.75 * p) - 1) / 3, // 원근: 가까워질수록 빨리 커짐 (p=1에서 1)
  bbSwingWindow = (diff) => (diff === `HARD` ? 85 : 115), // 정타 기준 ± 허용 ms
  // (BB_POS, bbOut 은 sim.js에 있음)
  // 1~9번 타순, 타순별 좌/우타는 경기마다 랜덤
  bbLineup = () => Array.from({ length: 9 }, () => (Math.random() < 0.5 ? `L` : `R`)),
  bbRand = (a, b) => a + Math.random() * (b - a);
// 구종 [이름, 비중, 구속범위, 좌우 변화, 낙차(+는 떨어짐)]
function bbGenPitch(hard) {
  let list = hard
      ? [
          [`직구`, 0.42, [145, 156], 0, -0.1],
          [`슬라이더`, 0.24, [132, 141], -0.9, 0.25],
          [`커브`, 0.16, [112, 124], -0.35, 1.1],
          [`체인지업`, 0.18, [124, 134], 0.35, 0.6],
        ]
      : [
          [`직구`, 0.6, [132, 142], 0, -0.1],
          [`체인지업`, 0.25, [118, 128], 0.3, 0.5],
          [`커브`, 0.15, [108, 118], -0.3, 0.9],
        ],
    r = Math.random(),
    pick = list[list.length - 1];
  for (let it of list) {
    if (r < it[1]) {
      pick = it;
      break;
    }
    r -= it[1];
  }
  let kmh = Math.round(bbRand(pick[2][0], pick[2][1])),
    // 18.44m 투구 거리 기준 실제 비행시간, EASY는 30% 느리게
    dur = (18440 / (kmh / 3.6)) * (hard ? 1 : 1.18),
    zx,
    zy,
    sign = () => (Math.random() < 0.5 ? -1 : 1);
  Math.random() < (hard ? 0.55 : 0.6)
    ? ((zx = bbRand(-0.9, 0.9)), (zy = bbRand(-0.9, 0.9)))
    : Math.random() < 0.6
      ? ((zx = sign() * bbRand(1.15, 1.85)), (zy = bbRand(-1, 1)))
      : ((zy = sign() * bbRand(1.15, 1.75)), (zx = bbRand(-1, 1)));
  return {
    name: pick[0],
    kmh,
    dur,
    zx,
    zy,
    bx: pick[3],
    by: pick[4],
    isStrike: Math.abs(zx) <= 1 && Math.abs(zy) <= 1,
    elapsed: 0,
  };
}
// 2P: 수비 플레이어가 고른 구종(1 직구 2 슬라이더 3 커브 4 체인지업)과 코스(3×3, Shift면 존 밖으로)
// 제구 오차가 있어서 노린 곳에서 조금 벗어날 수 있음
var BB_PITCHES = [
  [`직구`, [143, 154], 0, -0.1],
  [`슬라이더`, [130, 139], -0.9, 0.25],
  [`커브`, [110, 122], -0.35, 1.1],
  [`체인지업`, [122, 132], 0.35, 0.6],
];
function bbMakePitch(hard, sel) {
  let [name, spd, bx, by] = BB_PITCHES[sel.type - 1],
    kmh = Math.round(bbRand(spd[0], spd[1])),
    [cx, cy] = sel.zone,
    tx = cx * 0.62,
    ty = cy * 0.62,
    g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()),
    spread = hard ? 0.2 : 0.28;
  sel.out && (cx || cy ? ((tx = cx * 1.45), (ty = cy * 1.45)) : (ty = 1.45)); // 가운데에서 빼면 높은 볼
  let zx = tx + g() * spread,
    zy = ty + g() * spread;
  return {
    name,
    kmh,
    dur: (18440 / (kmh / 3.6)) * (hard ? 1 : 1.18),
    zx,
    zy,
    bx,
    by,
    isStrike: Math.abs(zx) <= 1 && Math.abs(zy) <= 1,
    elapsed: 0,
  };
}
// p: 0(릴리스) → 1(홈플레이트 통과) → 그 뒤는 포수 미트
function bbDrawBall(el, P, p) {
  if (!el) return;
  let x, yy, sz, op = 1;
  if (p <= 1) {
    let X = (P.zx - P.bx) * p + P.bx * p ** 3,
      Y = (P.zy + P.by) * p - P.by * p ** 3,
      f = bbPersp(p);
    ((x = BB_REL.x + (bbPlateX(X) - BB_REL.x) * f),
      (yy = BB_REL.y + (bbPlateY(Y) - BB_REL.y) * f),
      (sz = 3 + 19 * f));
  } else {
    let k = Math.min(1, ((p - 1) * P.dur) / 120);
    ((x = bbPlateX(P.zx)), (yy = bbPlateY(P.zy) + 10 * k), (sz = 22 - 4 * k), (op = 1 - 0.5 * k));
  }
  ((el.style.left = x + `px`),
    (el.style.top = yy + `px`),
    (el.style.width = el.style.height = sz + `px`),
    (el.style.opacity = op));
}
function b() {
  let e = (0, _.useRef)(null),
    t = (0, _.useRef)(null),
    n = (0, _.useRef)(null),
    r = (0, _.useRef)(null),
    i = (0, _.useRef)({}),
    a = (0, _.useRef)({}),
    // 포수 뒤 타격 시점(BatView)의 DOM 요소들: ball, marker, batter, pitcher, spark
    bvRef = (0, _.useRef)({}),
    o = (0, _.useRef)({
      strikes: 0,
      balls: 0,
      outs: 0,
      totalScore: 0,
      baseStatus: [!1, !1, !1],
      ballPosition: 150,
      ballSize: 8,
      ballX: 50,
      isPitched: !1,
      isSwung: !1,
      pitchType: `strike`,
      pendingOutcome: null,
      activeRunnersArray: [],
      statusText: `플레이볼을 선언해 주세요`,
      distanceText: `-`,
      result: { text: ``, color: ``, visible: !1 },
      gameOver: !1,
      swingDisabled: !0,
      playballDisabled: !1,
      fieldView: `top-down-view`,
      stealWindow: !1,
      paused: !1,
      batterNumber: 1,
      lineup: bbLineup(), // lineup[타순-1] = `L`(좌타) | `R`(우타)
      hitLog: [],
      difficulty: null,
      sacFlyThrowerPos: null,
      pitchTarget: null,
      pitch: null, // { name, kmh, dur, zx, zy, bx, by, isStrike, elapsed }
      pitchInfo: ``, // 직전 투구 표시 (예: "직구 147km/h · 스트라이크")
      swingFeedback: null, // { text, color }
      swingMiss: !1,
      mode: `1P`, // 1P(컴퓨터 투구) | 2P(투수 vs 타자)
      innings: 1,
      inning: 1,
      half: `top`, // top(초) | bottom(말)
      bat: 0, // 공격 팀 (2P: 0 = P1 선공, 1 = P2 후공)
      teams: [], // { name, lineup, batter, runs, line[] } — 타순·좌우타는 경기 시작 때 확정
      halfStartScore: 0,
      halfBreak: null, // 공수 교대 안내
      endInfo: null, // 2P 경기 결과 { winner, reason, score }
      play: null, // 진행 중인 타구 플레이 (주루 지시용)
      awaitPitch: !1, // 2P: 수비 플레이어의 구종·코스 선택 대기
      pitchSel: { type: null, zone: null, out: !1 },
      tbRunner: null, // 승부치기 2루 주자 타순
    }),
    s = () =>
      o.current.difficulty === `HARD`
        ? {
            throwLerp: 0.34,
            runnerSpeed: 0.075,
            steal: { 1: 0.28, 2: 0.18, 3: 0.1 },
            errorProb: 0.04,
            flyChase: 9.5,
          }
        : {
            throwLerp: 0.2,
            runnerSpeed: 0.11,
            steal: { 1: 0.55, 2: 0.45, 3: 0.3 },
            errorProb: 0.12,
            flyChase: 6.5,
          },
    c = (e) => {
      if (!e) return Math.floor(Math.random() * 40 + 15);
      let t = Math.random(),
        n = o.current.difficulty === `HARD` ? 2.6 : 1.7;
      return Math.floor(40 + 95 * t ** +n);
    },
    l = () => {
      let e = o.current;
      e.batterNumber = e.batterNumber >= 9 ? 1 : e.batterNumber + 1;
    },
    u = (0, _.useRef)(null),
    d = (0, _.useRef)(null),
    f = (0, _.useRef)(null),
    p = (0, _.useRef)(null),
    m = (0, _.useRef)(null),
    h = (0, _.useRef)(null),
    g = (0, _.useRef)(0),
    b = (0, _.useRef)(null),
    x = (0, _.useRef)(new Set()),
    S = (0, _.useCallback)((e, t) => {
      let n = { id: 0 },
        r = t,
        i = () => {
          if ((x.current.delete(n.id), o.current.paused || (r -= 50), r <= 0)) {
            e();
            return;
          }
          ((n.id = setTimeout(i, 50)), x.current.add(n.id));
        };
      return (
        (n.cancel = () => {
          (clearTimeout(n.id), x.current.delete(n.id));
        }),
        (n.id = setTimeout(i, Math.min(50, Math.max(t, 0)))),
        x.current.add(n.id),
        n
      );
    }, []),
    C = (0, _.useCallback)(() => {
      ((u.current &&= (clearInterval(u.current), null)),
        (d.current &&= (clearInterval(d.current), null)),
        (f.current &&= (clearInterval(f.current), null)),
        (p.current &&= (clearInterval(p.current), null)),
        (m.current &&= (clearTimeout(m.current), null)),
        (b.current &&= (clearTimeout(b.current), null)),
        x.current.forEach((e) => clearTimeout(e)),
        x.current.clear());
    }, []),
    [, w] = (0, _.useState)(0),
    T = (0, _.useCallback)(() => w((e) => (e + 1) & 65535), []),
    E = (0, _.useCallback)(
      (e, t) => {
        let n = o.current;
        ((n.result = { text: e, color: t, visible: !0 }),
          T(),
          b.current && clearTimeout(b.current),
          (b.current = setTimeout(() => {
            ((n.result = { ...n.result, visible: !1 }), T());
          }, 1500)));
      },
      [T],
    ),
    ee = () => T(),
    D = () => T(),
    te = () => {
      Object.keys(y).forEach((e) => {
        let t = i.current[e];
        t &&
          ((t.style.bottom = y[e].bottom + `px`),
          (t.style.left = y[e].left + `%`));
      });
    },
    ne = () => {
      let e = o.current;
      ((e.ballPosition = 150),
        (e.ballSize = 8),
        (e.ballX = 50),
        (e.isPitched = !1),
        (e.isSwung = !1));
      let r = t.current;
      (r &&
        ((r.style.display = `none`),
        (r.style.transform = `translateX(-50%) translateZ(45px) rotateX(-90deg)`),
        (r.style.width = `8px`),
        (r.style.height = `8px`),
        (r.style.bottom = `150px`),
        (r.style.left = `50%`)),
        n.current?.classList.remove(`windup`));
      let bv = bvRef.current;
      (bv.ball && (bv.ball.style.display = `none`),
        bv.marker && (bv.marker.style.display = `none`),
        bv.spark && bv.spark.classList.remove(`on`),
        bv.rig?.batter(`idle`),
        bv.rig?.pitcher(`idle`),
        (e.pitch = null),
        (e.swingMiss = !1));
    },
    re = () => {
      ([`runner-t`, `runner-1`, `runner-2`, `runner-3`].forEach((e) => {
        let t = a.current[e];
        t && (t.style.display = `none`);
      }),
        i.current.__shadow && (i.current.__shadow.style.display = `none`),
        te());
    },
    ie = () => {
      let e = o.current;
      ([`runner-t`, `runner-1`, `runner-2`, `runner-3`].forEach((e) => {
        let t = a.current[e];
        t && (t.style.display = `none`);
      }),
        e.baseStatus.forEach((e, t) => {
          if (!e) return;
          let n = `runner-${t + 1}`,
            r = a.current[n];
          r &&
            ((r.style.display = `flex`),
            (r.style.bottom = v[t + 1].bottom + `px`),
            (r.style.left = v[t + 1].left + `%`));
        }));
    },
    ae = (0, _.useCallback)(() => {
      ne();
      let e = o.current;
      ((e.fieldView = `catcher-view`),
        (e.playballDisabled = e.mode === `2P`),
        (e.swingDisabled = !0),
        (e.awaitPitch = e.mode === `2P` && !e.gameOver),
        (e.pitchSel = { type: null, zone: null, out: !1 }),
        (e.statusText =
          e.mode === `2P`
            ? `${e.teams[1 - e.bat]?.name}(수비): 구종 1~4 · 코스 Q W E / A S D / Z X C (Shift = 볼로 빼기)`
            : `플레이볼 버튼을 눌러 다음 투구를 지시하세요.`),
        ie(),
        T());
    }, [T]),
    // ── 2인 모드: 점수·이닝 관리 ──
    // [P1(선공), P2(후공)] 현재 점수. 공격 중인 팀은 e.totalScore가 최신
    sc = () => {
      let e = o.current;
      if (e.mode !== `2P`) return [e.totalScore, 0];
      let s2 = e.teams.map((tm) => tm.runs);
      return ((s2[e.bat] = e.totalScore), s2);
    },
    saveHalf = () => {
      let e = o.current,
        tm = e.teams[e.bat];
      tm && ((tm.batter = e.batterNumber), (tm.runs = e.totalScore), (tm.line[e.inning - 1] = e.totalScore - e.halfStartScore));
    },
    loadTeam = () => {
      let e = o.current,
        tm = e.teams[e.bat];
      ((e.batterNumber = tm.batter), (e.lineup = tm.lineup), (e.totalScore = tm.runs), (e.halfStartScore = tm.runs));
    },
    // 콜드게임(대차 조기 종료): 5·9이닝 경기에서 5회 이상 15점 차, 7회 이상 10점 차
    mercy = (inn, gap) => {
      let e = o.current;
      return (e.innings === 5 || e.innings === 9) && ((inn >= 5 && gap >= 15) || (inn >= 7 && gap >= 10));
    },
    endGame2P = (reason) => {
      let e = o.current;
      saveHalf();
      let [aw, hm] = e.teams.map((tm) => tm.runs);
      return (
        C(),
        (e.gameOver = !0),
        (e.endInfo = { winner: aw === hm ? null : aw > hm ? 0 : 1, reason, score: [aw, hm] }),
        (e.fieldView = `top-down-view`),
        (e.statusText = `경기 종료`),
        (e.play = null),
        T(),
        !0
      );
    },
    // 3아웃: 경기가 끝났는지 판단하고, 아니면 공수 교대 안내
    halfOver = () => {
      let e = o.current,
        [aw, hm] = sc(),
        inn = e.inning,
        ext = inn > e.innings ? `연장 ${inn}회` : `정규 ${e.innings}이닝`;
      if (e.half === `top`) {
        if (inn >= e.innings && hm > aw) return endGame2P(ext); // 후공이 앞서면 말 공격 없이 종료
        if (mercy(inn, hm - aw)) return endGame2P(`콜드게임 (${inn}회초 종료)`);
      } else {
        if (inn >= e.innings && aw !== hm) return endGame2P(ext);
        if (mercy(inn, Math.abs(aw - hm))) return endGame2P(`콜드게임 (${inn}회말 종료)`);
      }
      saveHalf();
      let nInn = e.half === `top` ? inn : inn + 1,
        nHalf = e.half === `top` ? `bottom` : `top`,
        nBat = nHalf === `top` ? 0 : 1;
      return (
        (e.halfBreak = {
          title: `3아웃! 공수 교대`,
          sub: `${nInn}회${nHalf === `top` ? `초` : `말`} · ${e.teams[nBat].name} 공격 / ${e.teams[1 - nBat].name} 수비`,
          extra: nInn > e.innings ? `연장 승부치기: 무사 2루에서 시작합니다` : null,
        }),
        (e.statusText = `공수 교대`),
        (e.fieldView = `top-down-view`),
        (e.play = null),
        T(),
        !0
      );
    },
    nextHalf = () => {
      let e = o.current;
      if (!e.halfBreak) return;
      ((e.halfBreak = null), e.half === `top` ? (e.half = `bottom`) : ((e.half = `top`), e.inning++), (e.bat = e.half === `top` ? 0 : 1), loadTeam());
      ((e.outs = 0), (e.strikes = 0), (e.balls = 0), (e.baseStatus = [!1, !1, !1]), (e.tbRunner = null));
      // 승부치기: 직전 타순의 타자를 2루 주자로 두고 무사 2루에서 시작
      e.inning > e.innings && ((e.baseStatus = [!1, !0, !1]), (e.tbRunner = e.batterNumber === 1 ? 9 : e.batterNumber - 1));
      (re(), ae());
    },
    // 후공 팀이 마지막 이닝(연장 포함) 말에 앞서거나 콜드 점수 차가 되면 즉시 종료
    walkOff = () => {
      let e = o.current;
      if (e.mode !== `2P` || e.half !== `bottom` || e.gameOver) return !1;
      let [aw, hm] = sc();
      if (e.inning >= e.innings && hm > aw) return endGame2P(e.inning > e.innings ? `연장 ${e.inning}회 끝내기` : `${e.inning}회말 끝내기`);
      if (mercy(e.inning, hm - aw)) return endGame2P(`콜드게임 (${e.inning}회말)`);
      return !1;
    },
    oe = (0, _.useCallback)(() => {
      let e = o.current;
      let kWhy = e.swingMiss ? `헛스윙 삼진` : `루킹 삼진`;
      if (e.strikes >= 3)
        (e.outs++,
          (e.strikes = 0),
          (e.balls = 0),
          (e.statusText = `${kWhy} 아웃!`),
          E(bbOut(kWhy), `#c0392b`),
          e.hitLog.push({
            batter: e.batterNumber,
            team: e.bat,
            hitType: kWhy,
            rbis: 0,
            scoreAfter: e.totalScore,
            time: Date.now(),
          }),
          l());
      else if (e.balls >= 4) {
        let t = e.baseStatus,
          n = t[0] && t[1] && t[2],
          r = +!!n;
        ((e.baseStatus = [!0, t[0] || t[1], (t[0] && t[1]) || t[2]]),
          (e.totalScore += r),
          (e.strikes = 0),
          (e.balls = 0),
          (e.statusText = n ? `밀어내기 볼넷!` : `볼넷 출루!`),
          E(n ? `밀어내기 볼넷` : `볼넷`, n ? `#f1c40f` : `#2ecc71`),
          e.hitLog.push({
            batter: e.batterNumber,
            team: e.bat,
            hitType: n ? `밀어내기 볼넷` : `볼넷`,
            rbis: r,
            scoreAfter: e.totalScore,
            time: Date.now(),
          }),
          l());
      }
      if ((ee(), e.outs >= 3)) {
        if (e.mode === `2P`) return halfOver();
        return (C(), (e.statusText = `3아웃 경기 종료`), (e.gameOver = !0), (e.fieldView = `top-down-view`), T(), !0);
      }
      return walkOff() || (T(), !1);
    }, [C, T, E]),
    // 5초 절대판정: 플레이가 5초를 넘으면 미리 계산된 결과로 즉시 확정
    k = (0, _.useCallback)(() => {
      ((u.current &&= (clearInterval(u.current), null)),
        (d.current &&= (clearInterval(d.current), null)),
        (f.current &&= (clearInterval(f.current), null)),
        (p.current &&= (clearInterval(p.current), null)),
        (m.current = null));
      let e = o.current;
      (e.pendingOutcome &&
        !e.pendingOutcome.processed &&
        ((e.pendingOutcome.processed = !0),
        e.pendingOutcome.resolve(!0),
        (e.statusText = `5초 룰 확정: ${e.statusText}`)),
        re(),
        (e.fieldView = `top-down-view`),
        ee(),
        oe() || ae());
    }, [ae, oe, E]),
    // 타구 진행: sim.js의 플레이를 2배속으로 실시간 진행. 그동안 주자에게 진루/귀루 지시 가능.
    // 5초가 지나면(5초 절대판정) 나머지는 즉시 계산해 결과 확정
    pb = (bb) => {
      let e = o.current,
        P = BB_SIM.start(bb, { bases: [...e.baseStatus], outs: e.outs, diff: e.difficulty }),
        ball = t.current,
        shadow = i.current.__shadow,
        SPEED = 2,
        last = performance.now(),
        lastHud = 0,
        place = (el, x, yy) => {
          if (!el) return;
          let q = bbPx({ x, y: yy });
          ((el.style.bottom = q.bottom + `px`), (el.style.left = q.left + `%`));
        },
        draw = () => {
          let vw = P.view(),
            b = vw.ball;
          (place(ball, b.x, b.y),
            place(shadow, b.x, b.y),
            ball && (ball.style.transform = `translateX(-50%) translateZ(${b.h * BB_K}px) rotateX(-90deg)`),
            !P.foul &&
              bb.kind !== `ground` &&
              P.distance != null &&
              !P.possessed &&
              (e.distanceText = `${Math.round(Math.min(P.distance, Math.hypot(b.x, b.y)))} m`));
          for (let key in vw.fielders) place(i.current[key], vw.fielders[key].x, vw.fielders[key].y);
          for (let rr of vw.runners) {
            let el = a.current[rr.id];
            el && ((el.style.display = rr.visible ? `flex` : `none`), el.classList.toggle(`manual`, !!rr.manual), place(el, rr.x, rr.y));
          }
        },
        next = (ms) =>
          S(() => {
            (re(), (e.fieldView = `top-down-view`), T(), oe() || S(ae, 400));
          }, ms),
        finish = (fromRule) => {
          ((d.current &&= (clearInterval(d.current), null)), fromRule && P.runToEnd(), draw());
          let sim = P.result();
          e.play = null;
          for (let id of [`runner-t`, `runner-1`, `runner-2`, `runner-3`]) a.current[id]?.classList.remove(`manual`);
          if (sim.foul && !sim.foulOut) {
            (e.strikes < 2 && e.strikes++, E(`FOUL`, `#e67e22`), (e.statusText = `파울!`), T());
            fromRule || next(700);
            return;
          }
          ((e.outs += sim.outsAdded),
            (e.totalScore += sim.runs),
            (e.baseStatus = e.outs >= 3 ? [!1, !1, !1] : sim.newBases),
            (e.strikes = 0),
            (e.balls = 0),
            E(sim.display, sim.color || `#c0392b`),
            (e.statusText = sim.status),
            sim.distance != null && (e.distanceText = `${sim.distance} m`),
            e.hitLog.push({
              batter: e.batterNumber,
              team: e.bat,
              hitType: sim.label,
              rbis: sim.runs,
              scoreAfter: e.totalScore,
              time: Date.now(),
            }),
            l(),
            T());
          fromRule || next(1500);
        };
      ((e.stealWindow = !1),
        (e.fieldView = `top-down-view`),
        (e.statusText = bb.foul
          ? `파울 타구`
          : P.homeRun
            ? `큰 타구! 넘어가나…`
            : `${{ ground: `땅볼 타구!`, line: `라인드라이브!`, fly: `큰 타구!`, pop: `높이 뜬 타구` }[bb.kind]} → 진루 / ← 귀루`),
        (e.distanceText = `-`),
        te(),
        ball && ((ball.style.display = `block`), (ball.style.width = ball.style.height = `8px`)),
        shadow && (shadow.style.display = `block`),
        draw(),
        (e.play = bb.foul || P.homeRun ? null : P),
        (e.pendingOutcome = { processed: !1, resolve: finish }),
        (g.current = Date.now()),
        (m.current = setTimeout(() => {
          e.pendingOutcome && !e.pendingOutcome.processed && k();
        }, 5e3)),
        T(),
        (d.current = setInterval(() => {
          let now = performance.now();
          if (e.paused) {
            last = now;
            return;
          }
          (P.step(((now - last) / 1e3) * SPEED), (last = now), draw());
          now - lastHud > 120 && ((lastHud = now), T());
          P.done &&
            ((m.current &&= (clearTimeout(m.current), null)),
            e.pendingOutcome.processed || ((e.pendingOutcome.processed = !0), finish(!1)));
        }, 16)));
    },
    // 투구가 포수 미트에 들어간 뒤의 판정 (지켜봄 또는 헛스윙)
    fe = () => {
      let e = o.current,
        P = e.pitch;
      (e.swingMiss || bvRef.current.rig?.batter(`take`),
        (e.stealWindow = !1),
        (e.isSwung = !0),
        (e.swingDisabled = !0),
        (e.pitchTarget = null),
        e.swingMiss
          ? (e.strikes++, (e.statusText = `헛스윙 스트라이크!`))
          : e.pitchType === `strike`
            ? (e.strikes++,
              (e.statusText = `루킹 스트라이크!`),
              (e.swingFeedback = { text: `STRIKE`, color: `#f1c40f` }))
            : (e.balls++,
              (e.statusText = `볼 판정!`),
              (e.swingFeedback = { text: `BALL`, color: `#2ecc71` })),
        P &&
          (e.pitchInfo = `${P.name} ${P.kmh}km/h · ${P.isStrike ? `스트라이크존` : `볼`}`),
        (e.fieldView = `catcher-view`),
        T(),
        oe() || S(ae, 1200));
    },
    A = (0, _.useCallback)(() => {
      let e = o.current;
      if (e.isPitched || e.gameOver) return;
      (ne(),
        (e.isPitched = !0),
        (e.playballDisabled = !0),
        (e.swingDisabled = !0),
        (e.stealWindow = !0),
        (e.sacFlyThrowerPos = null),
        (e.fieldView = `catcher-view`),
        (e.statusText = `투수 와인드업...`),
        (e.swingFeedback = null),
        (e.pitchInfo = ``),
        (e.distanceText = `-`));
      let P =
        e.mode === `2P` && e.pitchSel.type
          ? bbMakePitch(e.difficulty === `HARD`, e.pitchSel)
          : bbGenPitch(e.difficulty === `HARD`);
      ((e.awaitPitch = !1), (e.pitchSel = { type: null, zone: null, out: !1 }), bvRef.current.rig?.pitcher(`windup`));
      ((e.pitch = P),
        (e.pitchType = P.isStrike ? `strike` : `ball`),
        T(),
        n.current?.classList.add(`windup`),
        (e.windupTimer = S(() => {
          ((e.windupTimer = null), (e.swingDisabled = !1));
          let bv = bvRef.current,
            last = performance.now(),
            // 스윙 가능한 마지막 시점이 지나면 판정
            endAt = P.dur + bbSwingWindow(e.difficulty) + 40;
          (bv.ball && (bv.ball.style.display = `block`),
            bv.rig?.pitcher(`release`),
            bv.rig?.batter(`load`),
            bv.marker &&
              e.difficulty === `EASY` &&
              e.mode !== `2P` &&
              ((bv.marker.style.display = `block`),
              (bv.marker.style.left = bbPlateX(P.zx) + `px`),
              (bv.marker.style.top = bbPlateY(P.zy) + `px`)),
            bbDrawBall(bv.ball, P, 0),
            (e.statusText = `투구!`),
            T(),
            (u.current = setInterval(() => {
              let now = performance.now();
              if (e.paused) {
                last = now;
                return;
              }
              ((P.elapsed += now - last),
                (last = now),
                bbDrawBall(bv.ball, P, P.elapsed / P.dur),
                P.elapsed >= endAt &&
                  ((u.current &&= (clearInterval(u.current), null)),
                  bv.ball && (bv.ball.style.display = `none`),
                  bv.marker && (bv.marker.style.display = `none`),
                  fe()));
            }, 16)));
        }, 1200)));
    }, [S, T]),
    pe = (0, _.useCallback)(() => {
      let e = o.current,
        P = e.pitch;
      if (!e.isPitched || e.isSwung || e.swingDisabled || e.gameOver || !P) return;
      ((e.isSwung = !0), (e.swingDisabled = !0), (e.stealWindow = !1));
      let bv = bvRef.current;
      (bv.rig?.batter(`swing`),
        r.current?.classList.add(`swing`),
        S(() => r.current?.classList.remove(`swing`), 150));
      let win = bbSwingWindow(e.difficulty),
        dt = P.elapsed - P.dur, // 음수 = 빠름, 양수 = 늦음 (ms)
        adt = Math.abs(dt),
        off = Math.max(Math.abs(P.zx), Math.abs(P.zy)); // 1 초과면 존 밖
      // 헛스윙: 타이밍이 창 밖, 많이 빠진 볼, 아슬아슬한 볼의 일부
      if (
        adt > win ||
        off > 1.4 ||
        (off > 1 && Math.random() < (e.difficulty === `HARD` ? 0.55 : 0.45))
      ) {
        ((e.swingMiss = !0),
          (e.swingFeedback =
            adt > win
              ? { text: dt < 0 ? `너무 빠름` : `너무 늦음`, color: `#e74c3c` }
              : { text: `볼에 헛스윙`, color: `#e74c3c` }),
          (e.statusText = `헛스윙!`),
          T());
        return;
      }
      u.current &&= (clearInterval(u.current), null);
      // q: 타구 질 0~1. 타이밍 오차가 클수록, 존 구석/밖일수록 낮아짐
      let q = 1 - (adt / win) ** 1.3;
      ((q *= 1 - 0.15 * Math.max(0, Math.min(1, off) - 0.5)),
        off > 1 && (q *= 0.5),
        (q = Math.max(0, Math.min(1, q + (Math.random() - 0.5) * 0.16))));
      // 빠르면 당겨침: 좌타자는 우측(+), 우타자는 좌측(-)
      let pull = e.lineup[e.batterNumber - 1] === `R` ? -1 : 1,
        lat = pull * (-dt / win) * 22 + (Math.random() - 0.5) * 8;
      ((e.swingFeedback =
        adt <= win * 0.18
          ? { text: `PERFECT!`, color: `#f1c40f` }
          : {
              text: `${adt <= win * 0.5 ? `조금 ` : ``}${dt < 0 ? `빠름` : `늦음`} ${dt > 0 ? `+` : ``}${Math.round(dt)}ms`,
              color: adt <= win * 0.5 ? `#2ecc71` : `#e67e22`,
            }),
        off > 1 && (e.swingFeedback.text += ` · 볼을 건드림`),
        (e.pitchInfo = `${P.name} ${P.kmh}km/h`),
        (e.statusText = `타격!`),
        bv.spark &&
          ((bv.spark.style.left = bv.ball.style.left),
          (bv.spark.style.top = bv.ball.style.top),
          bv.spark.classList.remove(`on`),
          void bv.spark.offsetWidth,
          bv.spark.classList.add(`on`)),
        T(),
        S(() => {
          (bv.ball && (bv.ball.style.display = `none`),
            bv.marker && (bv.marker.style.display = `none`));
          // 방향: lat ±16 → 파울라인 ±45°. 타구 종류·비거리·수비 결과는 sim.js가 결정
          pb(BB_SIM.batted(q, (lat * 45) / 16, q < 0.12 || Math.abs(lat) > 16));
        }, 450));
    }, [S, T]),
    me = (0, _.useCallback)(() => {
      C();
      let e = o.current;
      ((e.strikes = 0),
        (e.balls = 0),
        (e.outs = 0),
        (e.totalScore = 0),
        (e.baseStatus = [!1, !1, !1]),
        (e.distanceText = `-`),
        (e.gameOver = !1),
        (e.pendingOutcome = null),
        (e.activeRunnersArray = []),
        (e.result = { text: ``, color: ``, visible: !1 }),
        (e.stealWindow = !1),
        (e.sacFlyThrowerPos = null),
        (e.paused = !1),
        (e.hitLog = []),
        (e.batterNumber = 1),
        (e.lineup = bbLineup()),
        (e.pitch = null),
        (e.pitchInfo = ``),
        (e.swingFeedback = null),
        (e.swingMiss = !1),
        (e.windupTimer = null),
        (e.sacFlyCatch = null),
        (e.mode = `1P`),
        (e.innings = 1),
        (e.inning = 1),
        (e.half = `top`),
        (e.bat = 0),
        (e.teams = []),
        (e.halfStartScore = 0),
        (e.halfBreak = null),
        (e.endInfo = null),
        (e.play = null),
        (e.awaitPitch = !1),
        (e.pitchSel = { type: null, zone: null, out: !1 }),
        (e.tbRunner = null),
        (e.difficulty = null),
        (e.statusText = `난이도를 선택하고 플레이볼을 눌러주세요`),
        D(),
        ee(),
        re(),
        ne(),
        ae(),
        (e.fieldView = `top-down-view`),
        T());
    }, [ae, C, T]),
    he = (0, _.useCallback)(() => {
      let e = o.current;
      return !e.gameOver && e.stealWindow && !e.paused;
    }, []),
    ge = (0, _.useCallback)(
      (e) => {
        let n = o.current;
        if (!he()) return;
        let r = e - 1;
        if (!n.baseStatus[r] || (e < 3 && n.baseStatus[e])) return;
        ((n.stealWindow = !1),
          (n.playballDisabled = !0),
          (n.swingDisabled = !0),
          (n.isSwung = !0),
          (u.current &&= (clearInterval(u.current), null)));
        let i = s().steal[e] ?? 0.4,
          // 태그업은 잡은 위치에서의 송구 거리로, 도루는 난이도별 확률로 판정
          c = n.sacFlyThrowerPos
            ? BB_SIM.tagUp(n.sacFlyCatch, e, n.difficulty)
            : Math.random() < i;
        n.windupTimer && (n.windupTimer.cancel(), (n.windupTimer = null));
        ((n.fieldView = `top-down-view`),
          (n.statusText = n.sacFlyThrowerPos ? `${e}루 주자 태그업!` : `${e}루 주자 도루 시도!`));
        ie(); // 누상의 다른 주자도 필드에 표시
        let l = `runner-${e}`,
          f = a.current[l];
        f &&
          ((f.style.display = `flex`),
          (f.style.bottom = v[e].bottom + `px`),
          (f.style.left = v[e].left + `%`));
        let p = t.current,
          m = n.sacFlyThrowerPos,
          h = m
            ? { ...m }
            : e === 3
              ? bbPx(BB_MOUND) // 홈스틸: 투수가 홈으로
              : bbPx(BB_FIELD_M.catcher), // 도루: 포수가 송구 (y는 아래 지역변수와 이름이 겹쳐 쓰면 안 됨)
          g = e + 1,
          _ = { ...v[g] };
        n.sacFlyThrowerPos = null;
        p &&
          ((p.style.display = `block`),
          (p.style.width = `8px`),
          (p.style.height = `8px`),
          (p.style.bottom = h.bottom + `px`),
          (p.style.left = h.left + `%`),
          (p.style.transform = `translateX(-50%) translateZ(0px) rotateX(-90deg)`));
        let ballLerp = c ? 0.05 : 0.25, // 실패로 판정되면 공이 주자보다 먼저 도착하도록
          b = { ...h },
          x = 0;
        (T(),
          (d.current = setInterval(() => {
            if (n.paused) return;
            x += 0.06;
            let t = Math.min(1, x),
              i = v[e],
              a = v[g];
            (f &&
              ((f.style.bottom = i.bottom + (a.bottom - i.bottom) * t + `px`),
              (f.style.left = i.left + (a.left - i.left) * t + `%`)),
              (b.bottom += (_.bottom - b.bottom) * ballLerp),
              (b.left += (_.left - b.left) * ballLerp),
              p &&
                ((p.style.bottom = b.bottom + `px`),
                (p.style.left = b.left + `%`)));
            let o =
                Math.hypot((b.left - _.left) * 8.5, b.bottom - _.bottom) < 8,
              s = x >= 1;
            if (o || s) {
              d.current &&= (clearInterval(d.current), null);
              let t = o && !s && !c,
                i = [...n.baseStatus];
              (t
                ? ((i[r] = !1),
                  (n.baseStatus = i),
                  n.outs++,
                  E(
                    bbOut(m ? `태그업 실패` : g === 4 ? `홈스틸 실패` : `도루 실패`),
                    `#c0392b`,
                  ),
                  (n.statusText = m
                    ? `${e}루 주자 태그업 실패, ${g === 4 ? `홈` : g + `루`}에서 송구 아웃`
                    : g === 4
                      ? `홈스틸 실패! 홈에서 태그 아웃`
                      : `${e}루 → ${g}루 도루 실패, 송구 아웃`),
                  n.hitLog.push({
                    batter: n.batterNumber,
                    team: n.bat,
                    hitType: m
                      ? `${e}루 주자 태그업 실패`
                      : g === 4
                        ? `홈스틸 실패 (홈 태그 아웃)`
                        : `${e}루 도루 실패 (${g}루 송구 아웃)`,
                    rbis: 0,
                    scoreAfter: n.totalScore,
                    time: Date.now(),
                  }))
                : g === 4
                  ? ((i[2] = !1),
                    (n.totalScore += 1),
                    (n.baseStatus = i),
                    E(m ? `희생플라이 득점!` : `홈스틸 성공!`, `#f1c40f`),
                    (n.statusText = m ? `3루 주자 태그업, 홈인 (득점)` : `3루 주자 홈스틸 성공 (득점)`),
                    n.hitLog.push({
                      batter: n.batterNumber,
                      team: n.bat,
                      hitType: m ? `태그업 득점 (희생플라이)` : `홈스틸 성공`,
                      rbis: 1,
                      scoreAfter: n.totalScore,
                      time: Date.now(),
                    }))
                  : ((i[r] = !1),
                    (i[e] = !0),
                    (n.baseStatus = i),
                    E(`SAFE!`, `#2ecc71`),
                    (n.statusText = `${e}루 주자 → ${g}루 ${m ? `태그업 진루` : `도루 성공`}`),
                    n.hitLog.push({
                      batter: n.batterNumber,
                      team: n.bat,
                      hitType: `${e}루 → ${g}루 ${m ? `태그업 진루` : `도루 성공`}`,
                      rbis: 0,
                      scoreAfter: n.totalScore,
                      time: Date.now(),
                    })),
                S(() => {
                  (re(),
                    (n.fieldView = `top-down-view`),
                    (n.sacFlyThrowerPos = null),
                    oe() || S(ae, 400));
                }, 1200));
            }
          }, 45)),
          T());
      },
      [he, S, T, E, oe, ae],
    ),
    _e = (0, _.useCallback)(() => {
      let e = o.current;
      if (!(e.gameOver || e.paused)) {
        if ((bvRef.current.rig?.pause(!0), (e.paused = !0), m.current)) {
          let e = Date.now() - g.current;
          ((h.current = Math.max(0, 5e3 - e)),
            clearTimeout(m.current),
            (m.current = null));
        }
        T();
      }
    }, [T]),
    ve = (0, _.useCallback)(() => {
      let e = o.current;
      if (e.paused) {
        if (
          (bvRef.current.rig?.pause(!1),
          (e.paused = !1),
          h.current !== null && e.pendingOutcome && !e.pendingOutcome.processed)
        ) {
          g.current = Date.now();
          let t = h.current;
          m.current = setTimeout(() => {
            e.pendingOutcome && !e.pendingOutcome.processed && k();
          }, t);
        }
        ((h.current = null), T());
      }
    }, [T, k]);
  (0, _.useEffect)(() => {
    let PITCH_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4 },
      ZONE_KEYS = { KeyQ: [-1, 1], KeyW: [0, 1], KeyE: [1, 1], KeyA: [-1, 0], KeyS: [0, 0], KeyD: [1, 0], KeyZ: [-1, -1], KeyX: [0, -1], KeyC: [1, -1] };
    let e = (e) => {
      let s = o.current;
      if (s.halfBreak && e.code === `Enter`) return (e.preventDefault(), nextHalf());
      // 2P 수비: 구종·코스 선택 (무엇을 골랐는지는 화면에 보이지 않음)
      if (s.mode === `2P` && s.awaitPitch && !s.paused && !s.halfBreak && !s.gameOver && (e.code in PITCH_KEYS || e.code in ZONE_KEYS)) {
        (e.preventDefault(),
          e.code in PITCH_KEYS
            ? (s.pitchSel.type = PITCH_KEYS[e.code])
            : ((s.pitchSel.zone = ZONE_KEYS[e.code]), (s.pitchSel.out = e.shiftKey)));
        s.pitchSel.type && s.pitchSel.zone && ((s.awaitPitch = !1), (s.statusText = `투구 준비 완료!`), S(A, 600));
        T();
        return;
      }
      // 주루 지시: → 전원 진루, ← 전원 귀루
      if (s.play && !s.paused && (e.code === `ArrowRight` || e.code === `ArrowLeft`)) {
        (e.preventDefault(), s.play.commandAll(e.code === `ArrowRight` ? `advance` : `return`), T());
        return;
      }
      (e.code === `Space` &&
        !s.swingDisabled &&
        !s.paused &&
        (e.preventDefault(), pe()),
        e.code === `Enter` &&
          s.difficulty &&
          !s.playballDisabled &&
          !s.paused &&
          !s.gameOver &&
          (e.preventDefault(), A()),
        // Esc: 일시정지 / 재개
        e.code === `Escape` && s.difficulty && !s.gameOver && (s.paused ? ve() : _e()));
    };
    return (
      window.addEventListener(`keydown`, e),
      () => window.removeEventListener(`keydown`, e)
    );
  }, [pe, A, _e, ve, S, T]);
  // 경기 시작: { mode: 1P|2P, diff: EASY|HARD, innings }. 타순별 좌/우타는 여기서 확정되어 경기 내내 유지
  let ye = (0, _.useCallback)(
    (cfg) => {
      let t = o.current,
        team = (name) => ({ name, lineup: bbLineup(), batter: 1, runs: 0, line: [] });
      ((t.mode = cfg.mode),
        (t.difficulty = cfg.diff),
        (t.innings = cfg.mode === `2P` ? cfg.innings : 1),
        (t.inning = 1),
        (t.half = `top`),
        (t.bat = 0),
        (t.endInfo = null),
        (t.halfBreak = null),
        (t.hitLog = []),
        (t.teams = cfg.mode === `2P` ? [team(`P1`), team(`P2`)] : [team(`나`)]),
        loadTeam(),
        (t.statusText = `${cfg.diff} 모드 · 플레이볼 버튼을 눌러주세요`),
        cfg.mode === `2P` && ae(),
        T());
    },
    [T],
  );
  (0, _.useEffect)(() => () => C(), [C]);
  let j = o.current;
  return {
    refs: {
      fieldRef: e,
      ballRef: t,
      pitcherRef: n,
      batterRef: r,
      fieldersRef: i,
      runnersRef: a,
      batViewRef: bvRef,
    },
    state: {
      pitchInfo: j.pitchInfo,
      swingFeedback: j.swingFeedback,
      strikes: j.strikes,
      balls: j.balls,
      outs: j.outs,
      totalScore: j.totalScore,
      baseStatus: j.baseStatus,
      statusText: j.statusText,
      distanceText: j.distanceText,
      result: j.result,
      gameOver: j.gameOver,
      swingDisabled: j.swingDisabled || j.paused || !j.difficulty,
      playballDisabled: j.playballDisabled || j.paused || !j.difficulty,
      fieldView: j.fieldView,
      canManualRunner: !j.gameOver && j.stealWindow && !j.paused,
      paused: j.paused,
      hitLog: j.hitLog,
      batterNumber: j.batterNumber,
      batterHand: j.lineup[j.batterNumber - 1],
      difficulty: j.difficulty,
      pitchTarget: j.pitchTarget,
      mode: j.mode,
      inning: j.inning,
      half: j.half,
      innings: j.innings,
      bat: j.bat,
      teams: j.teams.map((tm, k) => ({ ...tm, runs: sc()[k] ?? tm.runs, line: [...tm.line] })),
      lineup: j.lineup,
      halfBreak: j.halfBreak,
      halfRuns: j.totalScore - j.halfStartScore,
      endInfo: j.endInfo,
      awaitPitch: j.awaitPitch,
      pitchSel: { type: !!j.pitchSel.type, zone: !!j.pitchSel.zone },
      tbRunner: j.tbRunner,
      // 주루 지시 패널: 살아있는 주자별 가능 여부
      runCtl:
        j.play && !j.play.done
          ? j.play.r
              .filter((r) => j.play.live(r.id))
              .map((r) => ({
                id: r.id,
                name: r.id === `runner-t` ? `타자주자` : `${r.from}루 주자`,
                where: r.target >= 4 ? `홈` : r.target > 0 ? `${r.target}루` : `-`,
                canA: j.play.can(r.id, `advance`),
                canR: j.play.can(r.id, `return`),
                manual: r.manual,
              }))
          : null,
    },
    actions: {
      playball: A,
      swing: pe,
      restartGame: me,
      advanceRunner: ge,
      pauseGame: _e,
      resumeGame: ve,
      setDifficulty: ye,
      nextHalf,
      runCmd: (id, cmd) => {
        let P = o.current.play;
        (P && (id === `all` ? P.commandAll(cmd) : P.command(id, cmd)), T());
      },
    },
  };
}
var x = o((e) => {
    var t = Symbol.for(`react.transitional.element`),
      n = Symbol.for(`react.fragment`);
    function r(e, n, r) {
      var i = null;
      if (
        (r !== void 0 && (i = `` + r),
        n.key !== void 0 && (i = `` + n.key),
        `key` in n)
      )
        for (var a in ((r = {}), n)) a !== `key` && (r[a] = n[a]);
      else r = n;
      return (
        (n = r.ref),
        { $$typeof: t, type: e, key: i, ref: n === void 0 ? null : n, props: r }
      );
    }
    ((e.Fragment = n), (e.jsx = r), (e.jsxs = r));
  }),
  S = o((e, t) => {
    t.exports = x();
  })(),
  C = [
    `pitcher`,
    `inf-1b`,
    `inf-2b`,
    `inf-ss`,
    `inf-3b`,
    `out-lf`,
    `out-cf`,
    `out-rf`,
    `catcher`,
  ],
  w = {
    pitcher: `P`,
    "inf-1b": `1B`,
    "inf-2b": `2B`,
    "inf-ss": `SS`,
    "inf-3b": `3B`,
    "out-lf": `LF`,
    "out-cf": `CF`,
    "out-rf": `RF`,
    catcher: `C`,
  };
function T({ refs: e, fieldView: t, pitchTarget: n, children: r }) {
  let {
    fieldRef: i,
    ballRef: a,
    pitcherRef: o,
    batterRef: s,
    fieldersRef: c,
    runnersRef: l,
  } = e;
  return (0, S.jsxs)(`div`, {
    ref: i,
    className: `bb-field ${t}`.trim(),
    children: [
      // 경기장 바닥 (실제 규격 펜스·내야) + 공 그림자
      (0, S.jsx)(`div`, { dangerouslySetInnerHTML: { __html: BB_FIELD_SVG } }),
      (0, S.jsx)(`div`, {
        ref: (t) => {
          c.current.__shadow = t;
        },
        className: `bb-ball-shadow`,
      }),
      (0, S.jsx)(`div`, { className: `bb-strike-zone` }),
      n != null &&
        (0, S.jsx)(`div`, {
          className: `bb-pitch-target`,
          style: { left: `${n}%` },
        }),
      C.map((e) =>
        (0, S.jsx)(
          `div`,
          {
            ref: (t) => {
              c.current[e] = t;
            },
            className: `bb-player bb-defense bb-${e}`,
            style: { bottom: y[e].bottom + `px`, left: y[e].left + `%` },
            children: w[e],
          },
          e,
        ),
      ),
      [
        { id: `runner-t`, label: `H` },
        { id: `runner-1`, label: `1` },
        { id: `runner-2`, label: `2` },
        { id: `runner-3`, label: `3` },
      ].map((e) =>
        (0, S.jsx)(
          `div`,
          {
            ref: (t) => {
              l.current[e.id] = t;
            },
            className: `bb-player bb-runner`,
            children: e.label,
          },
          e.id,
        ),
      ),
      (0, S.jsx)(`div`, { ref: a, className: `bb-ball` }),
      r,
    ],
  });
}
function E({ label: e, count: t, max: n, color: r }) {
  return (0, S.jsxs)(`div`, {
    className: `bb-count-row`,
    children: [
      (0, S.jsx)(`span`, { className: `bb-count-label`, children: e }),
      (0, S.jsx)(`div`, {
        className: `bb-count-lamps`,
        children: Array.from({ length: n }).map((e, n) =>
          (0, S.jsx)(
            `span`,
            {
              className: `bb-count-lamp${n < t ? ` on` : ``}`,
              style:
                n < t ? { background: r, boxShadow: `0 0 6px ${r}` } : void 0,
            },
            n,
          ),
        ),
      }),
    ],
  });
}
function ee({
  statusText: e,
  distanceText: t,
  baseStatus: n,
  totalScore: r,
  strikes: i,
  balls: a,
  outs: o,
  batterNumber: s,
  batterHand: bh,
  mode,
  teams,
  inning,
  half,
  bat,
  tbRunner,
}) {
  let two = mode === `2P`;
  return (0, S.jsxs)(S.Fragment, {
    children: [
      two
        ? (0, S.jsxs)(`div`, {
            className: `bb-score-topright bb-sb2`,
            "aria-label": `점수판`,
            children: [
              (0, S.jsx)(`div`, { className: `bb-score-label`, children: `${inning}회${half === `top` ? `초 ▲` : `말 ▼`}` }),
              ...teams.map((tm, k) =>
                (0, S.jsxs)(
                  `div`,
                  {
                    className: `bb-sb2-row${k === bat ? ` batting` : ``}`,
                    children: [
                      (0, S.jsx)(`span`, { children: (k === bat ? `▶ ` : ``) + tm.name }),
                      (0, S.jsx)(`b`, { children: tm.runs }),
                    ],
                  },
                  k,
                ),
              ),
            ],
          })
        : (0, S.jsxs)(`div`, {
            className: `bb-score-topright`,
            "aria-label": `현재 득점`,
            children: [
              (0, S.jsx)(`div`, { className: `bb-score-label`, children: `SCORE` }),
              (0, S.jsxs)(`div`, {
                className: `bb-score-value`,
                children: [
                  r,
                  (0, S.jsx)(`span`, { className: `bb-score-unit`, children: `R` }),
                ],
              }),
            ],
          }),
      (0, S.jsxs)(`div`, {
        className: `bb-hud`,
        children: [
          (0, S.jsxs)(`div`, {
            children: [`상황: `, (0, S.jsx)(`span`, { children: e })],
          }),
          (0, S.jsxs)(`div`, {
            children: [`비거리: `, (0, S.jsx)(`span`, { children: t })],
          }),
          (0, S.jsxs)(`div`, {
            children: [
              `타석: `,
              (0, S.jsxs)(`span`, {
                className: `bb-batter-num`,
                children: [two ? `${teams[bat]?.name} · ` : ``, s, `번 타자 (${bh === `R` ? `우타` : `좌타`})`, tbRunner ? ` · 승부치기 2루 주자 ${tbRunner}번` : ``],
              }),
            ],
          }),
          (0, S.jsxs)(`div`, {
            className: `bb-tv-diamond`,
            children: [
              (0, S.jsx)(`div`, {
                className: `bb-tv-base bb-tv-2b${n[1] ? ` active` : ``}`,
              }),
              (0, S.jsx)(`div`, {
                className: `bb-tv-base bb-tv-1b${n[0] ? ` active` : ``}`,
              }),
              (0, S.jsx)(`div`, {
                className: `bb-tv-base bb-tv-3b${n[2] ? ` active` : ``}`,
              }),
            ],
          }),
          (0, S.jsxs)(`div`, {
            className: `bb-count-panel`,
            "aria-label": `볼카운트 상황판`,
            children: [
              (0, S.jsx)(E, { label: `B`, count: a, max: 3, color: `#2ecc71` }),
              (0, S.jsx)(E, { label: `S`, count: i, max: 2, color: `#f1c40f` }),
              (0, S.jsx)(E, { label: `O`, count: o, max: 2, color: `#e74c3c` }),
            ],
          }),
        ],
      }),
    ],
  });
}
function D({
  playballDisabled: e,
  swingDisabled: t,
  paused: n,
  gameOver: r,
  onPlayball: i,
  onSwing: a,
  onPause: o,
}) {
  return (0, S.jsxs)(`div`, {
    className: `bb-controls`,
    children: [
      (0, S.jsx)(`button`, {
        className: `bb-btn bb-btn-playball`,
        onClick: i,
        disabled: e,
        children: `플레이볼`,
      }),
      (0, S.jsx)(`button`, {
        className: `bb-btn bb-btn-swing`,
        onClick: a,
        disabled: t,
        children: `타격 (Space)`,
      }),
      (0, S.jsx)(`button`, {
        className: `bb-btn bb-btn-pause`,
        onClick: o,
        disabled: r || n,
        title: `일시정지 및 요약 보기`,
        children: `⏸ 일시정지`,
      }),
    ],
  });
}
function te({ text: e, color: t, visible: n }) {
  return n
    ? (0, S.jsx)(`div`, {
        className: `bb-result-display`,
        style: { color: t },
        dangerouslySetInnerHTML: { __html: e },
      })
    : null;
}
function ne({ visible: e, finalScore: t, onRestart: n, mode, endInfo, teams, innings, inning, half }) {
  if (e && mode === `2P` && endInfo)
    return (0, S.jsxs)(`div`, {
      className: `bb-game-over`,
      children: [
        (0, S.jsx)(`h2`, { children: endInfo.winner == null ? `무승부` : `${teams[endInfo.winner].name} 승리!` }),
        (0, S.jsx)(`p`, { className: `bb-end-score`, children: `${teams[0].name} ${endInfo.score[0]} : ${endInfo.score[1]} ${teams[1].name} · ${endInfo.reason}` }),
        (0, S.jsx)(LineScore, { teams, innings, inning, half, final: !0 }),
        (0, S.jsx)(`button`, { className: `bb-btn bb-btn-restart`, onClick: n, children: `메인 화면으로` }),
      ],
    });
  return e
    ? (0, S.jsxs)(`div`, {
        className: `bb-game-over`,
        children: [
          (0, S.jsx)(`h2`, { children: `GAME OVER` }),
          (0, S.jsxs)(`p`, {
            children: [
              `최종 점수: `,
              (0, S.jsx)(`span`, { children: t }),
              ` R`,
            ],
          }),
          (0, S.jsx)(`button`, {
            className: `bb-btn bb-btn-restart`,
            onClick: n,
            children: `다시 도전하겠습니까?`,
          }),
        ],
      })
    : null;
}
// 이닝별 점수표
function LineScore({ teams, innings, inning, half, halfRuns, bat, final: fin }) {
  let n = Math.max(innings, inning),
    cols = Array.from({ length: n }, (_x, k) => k + 1);
  return (0, S.jsxs)(`table`, {
    className: `bb-linescore`,
    children: [
      (0, S.jsx)(`thead`, {
        children: (0, S.jsxs)(`tr`, {
          children: [(0, S.jsx)(`th`, {}), ...cols.map((c) => (0, S.jsx)(`th`, { className: c > innings ? `ext` : ``, children: c }, c)), (0, S.jsx)(`th`, { children: `R` })],
        }),
      }),
      (0, S.jsx)(`tbody`, {
        children: teams.map((tm, k) =>
          (0, S.jsxs)(
            `tr`,
            {
              children: [
                (0, S.jsx)(`td`, { className: `name`, children: tm.name }),
                ...cols.map((c) => {
                  let v = tm.line[c - 1];
                  // 진행 중인 이닝(공격 중)은 지금까지의 점수
                  !fin && v == null && c === inning && k === bat && halfRuns != null && (v = halfRuns);
                  return (0, S.jsx)(`td`, { children: v ?? `` }, c);
                }),
                (0, S.jsx)(`td`, { className: `runs`, children: tm.runs }),
              ],
            },
            k,
          ),
        ),
      }),
    ],
  });
}
// 타순표: 1~9번 좌/우타 (경기 시작 때 확정)
function LineupCard({ team, current }) {
  return (0, S.jsxs)(`div`, {
    className: `bb-lineup`,
    children: [
      (0, S.jsx)(`span`, { className: `bb-lineup-name`, children: team.name }),
      ...team.lineup.map((h, k) =>
        (0, S.jsxs)(`span`, { className: `bb-lineup-chip${k + 1 === current ? ` now` : ``} ${h}`, children: [k + 1, h === `R` ? `우` : `좌`] }, k),
      ),
    ],
  });
}
// 2P 공수 교대 안내
function HalfBreak({ info, teams, innings, inning, half, onNext }) {
  return info
    ? (0, S.jsxs)(`div`, {
        className: `bb-game-over bb-halfbreak`,
        children: [
          (0, S.jsx)(`h2`, { children: info.title }),
          (0, S.jsx)(`p`, { children: info.sub }),
          info.extra && (0, S.jsx)(`p`, { className: `bb-halfbreak-extra`, children: info.extra }),
          (0, S.jsx)(LineScore, { teams, innings, inning, half, final: !0 }),
          (0, S.jsx)(`p`, { className: `bb-halfbreak-tip`, children: `수비 플레이어는 키보드 왼쪽(1~4, Q~C)을, 공격 플레이어는 Space와 ← → 키를 씁니다.` }),
          (0, S.jsx)(`button`, { className: `bb-btn bb-btn-restart`, onClick: onNext, children: `다음 이닝 시작 ▶ (Enter)` }),
        ],
      })
    : null;
}
// 타구 진행 중 주루 지시
function RunCtl({ ctl, onCmd }) {
  return ctl && ctl.length
    ? (0, S.jsxs)(`div`, {
        className: `bb-runctl`,
        children: [
          (0, S.jsxs)(`div`, {
            className: `bb-runctl-head`,
            children: [
              (0, S.jsx)(`span`, { children: `주루 지시` }),
              (0, S.jsx)(`button`, { onClick: () => onCmd(`all`, `return`), children: `◀ 전원 귀루` }),
              (0, S.jsx)(`button`, { onClick: () => onCmd(`all`, `advance`), children: `전원 진루 ▶` }),
            ],
          }),
          ...ctl.map((r) =>
            (0, S.jsxs)(
              `div`,
              {
                className: `bb-runctl-row${r.manual ? ` manual` : ``}`,
                children: [
                  (0, S.jsx)(`span`, { className: `bb-runctl-name`, children: `${r.name} → ${r.where}` }),
                  (0, S.jsx)(`button`, { disabled: !r.canR, onClick: () => onCmd(r.id, `return`), title: `마지막으로 밟은 베이스로 귀루`, children: `◀ 귀루` }),
                  (0, S.jsx)(`button`, { disabled: !r.canA, onClick: () => onCmd(r.id, `advance`), title: `한 베이스 더 진루`, children: `진루 ▶` }),
                ],
              },
              r.id,
            ),
          ),
        ],
      })
    : null;
}
// 2P: 수비 플레이어의 구종·코스 선택 안내 (고른 내용은 보이지 않음)
function PitchPrompt({ show, sel, defName, batName }) {
  return show
    ? (0, S.jsxs)(`div`, {
        className: `bb-pitchprompt`,
        children: [
          (0, S.jsx)(`div`, { className: `bb-pitchprompt-title`, children: `${defName} 수비 차례 — ${batName}은(는) 화면만 보세요` }),
          (0, S.jsx)(`div`, { children: `구종  1 직구 · 2 슬라이더 · 3 커브 · 4 체인지업` }),
          (0, S.jsx)(`div`, { children: `코스  Q W E / A S D / Z X C  (Shift를 누른 채: 존 밖으로 빼기)` }),
          (0, S.jsxs)(`div`, {
            className: `bb-pitchprompt-state`,
            children: [
              (0, S.jsx)(`span`, { className: sel.type ? `ok` : ``, children: sel.type ? `구종 ✓` : `구종 …` }),
              (0, S.jsx)(`span`, { className: sel.zone ? `ok` : ``, children: sel.zone ? `코스 ✓` : `코스 …` }),
            ],
          }),
        ],
      })
    : null;
}
var re = {
  1: { bottom: 135, left: `calc(67% + 30px)`, label: `1루→2루` },
  2: { bottom: 260, left: `50%`, label: `2루→3루` },
  3: { bottom: 135, left: `calc(33% - 110px)`, label: `3루→홈` },
};
function ie({ baseStatus: e, canManualRunner: t, onAdvance: n, batView: bvw }) {
  return (0, S.jsx)(S.Fragment, {
    children: [1, 2, 3].map((r) => {
      let i = e[r - 1],
        a = r < 3 ? e[r] : !1,
        o = t && i && (r === 3 || !a),
        // 타격 시점에서는 좌·우 타석을 피해 오른쪽 위(점수판 아래)에 모아서 표시
        s = bvw ? { bottom: 440 - (r - 1) * 40, left: `770px`, label: re[r].label } : re[r];
      return (0, S.jsxs)(
        `button`,
        {
          type: `button`,
          className: `bb-field-steal-btn`,
          style: { bottom: s.bottom + `px`, left: s.left },
          disabled: !o,
          onClick: () => n(r),
          "aria-label": `${r}루 도루 시도`,
          title: r === 3 ? `홈스틸` : `${r}루→${r + 1}루 도루`,
          children: [`🏃 `, s.label],
        },
        r,
      );
    }),
  });
}
function ae({
  visible: e,
  totalScore: t,
  balls: n,
  strikes: r,
  outs: i,
  baseStatus: a,
  hitLog: o,
  onResume: s,
  onQuit: quit,
  mode,
  teams,
  innings,
  inning,
  half,
  bat,
  halfRuns,
  batterNumber,
}) {
  // 메인 화면으로 가기 전 한 번 더 확인 (실수로 눌러 경기가 사라지지 않도록)
  let [confirm, setConfirm] = (0, _.useState)(!1);
  if (((0, _.useEffect)(() => {
    e || setConfirm(!1);
  }, [e]),
  !e))
    return null;
  if (confirm)
    return (0, S.jsx)(`div`, {
      className: `bb-pause-overlay`,
      role: `dialog`,
      "aria-modal": `true`,
      "aria-label": `경기 중단 확인`,
      children: (0, S.jsxs)(`div`, {
        className: `bb-pause-card`,
        children: [
          (0, S.jsx)(`h3`, { className: `bb-pause-title`, children: `🏠 메인 화면으로` }),
          (0, S.jsx)(`p`, {
            className: `bb-quit-text`,
            children: `경기를 그만두고 메인 화면으로 갈까요? 이번 경기 기록(${t}점)은 저장되지 않습니다.`,
          }),
          (0, S.jsxs)(`div`, {
            className: `bb-quit-actions`,
            children: [
              (0, S.jsx)(`button`, {
                className: `bb-btn bb-btn-quit`,
                onClick: quit,
                children: `그만두기`,
              }),
              (0, S.jsx)(`button`, {
                className: `bb-btn bb-btn-playball`,
                onClick: () => setConfirm(!1),
                children: `돌아가기`,
              }),
            ],
          }),
        ],
      }),
    });
  let c =
    a
      .map((e, t) => (e ? `${t + 1}루` : null))
      .filter(Boolean)
      .join(`, `) || `주자 없음`;
  return (0, S.jsx)(`div`, {
    className: `bb-pause-overlay`,
    role: `dialog`,
    "aria-modal": `true`,
    "aria-label": `일시정지 요약`,
    children: (0, S.jsxs)(`div`, {
      className: `bb-pause-card`,
      children: [
        (0, S.jsx)(`h3`, {
          className: `bb-pause-title`,
          children: `⏸ 일시정지`,
        }),
        (0, S.jsxs)(`div`, {
          className: `bb-pause-row`,
          children: [
            (0, S.jsx)(`span`, {
              className: `bb-pause-label`,
              children: `현재 점수`,
            }),
            (0, S.jsxs)(`span`, {
              className: `bb-pause-value bb-pause-score`,
              children: [t, ` R`],
            }),
          ],
        }),
        (0, S.jsxs)(`div`, {
          className: `bb-pause-row`,
          children: [
            (0, S.jsx)(`span`, {
              className: `bb-pause-label`,
              children: `카운트`,
            }),
            (0, S.jsxs)(`span`, {
              className: `bb-pause-value`,
              children: [`B `, n, ` · S `, r, ` · O `, i],
            }),
          ],
        }),
        (0, S.jsxs)(`div`, {
          className: `bb-pause-row`,
          children: [
            (0, S.jsx)(`span`, {
              className: `bb-pause-label`,
              children: `누상 주자`,
            }),
            (0, S.jsx)(`span`, { className: `bb-pause-value`, children: c }),
          ],
        }),
        mode === `2P` && (0, S.jsx)(LineScore, { teams, innings, inning, half, halfRuns, bat }),
        (0, S.jsx)(`div`, { className: `bb-pause-hitlog-title`, children: `타순 (경기 내내 고정)` }),
        ...(teams || []).map((tm, k) => (0, S.jsx)(LineupCard, { team: tm, current: k === bat ? batterNumber : null }, k)),
        (0, S.jsx)(`div`, {
          className: `bb-pause-hitlog-title`,
          children: `타자 기록`,
        }),
        o.length === 0
          ? (0, S.jsx)(`div`, {
              className: `bb-pause-hitlog-empty`,
              children: `아직 기록 없음`,
            })
          : (0, S.jsx)(`ul`, {
              className: `bb-pause-hitlog`,
              children: [...o]
                .slice(-8)
                .reverse()
                .map((e, t) =>
                  (0, S.jsxs)(
                    `li`,
                    {
                      className: `bb-pause-hitlog-item`,
                      children: [
                        (0, S.jsxs)(`span`, {
                          className: `bb-pause-hitlog-batter`,
                          children: [mode === `2P` && teams[e.team] ? `${teams[e.team].name} ` : ``, e.batter, `번`],
                        }),
                        (0, S.jsx)(`span`, {
                          className: `bb-pause-hitlog-type`,
                          children: e.hitType,
                        }),
                        (0, S.jsx)(`span`, {
                          className: `bb-pause-hitlog-rbi`,
                          children: e.rbis > 0 ? `+${e.rbis}점` : `-`,
                        }),
                        (0, S.jsxs)(`span`, {
                          className: `bb-pause-hitlog-total`,
                          children: [`누계 `, e.scoreAfter, ` R`],
                        }),
                      ],
                    },
                    t,
                  ),
                ),
            }),
        (0, S.jsx)(`button`, {
          className: `bb-btn bb-btn-playball bb-pause-resume`,
          onClick: s,
          children: `▶ 경기 재개`,
        }),
        (0, S.jsx)(`button`, {
          className: `bb-btn bb-btn-home bb-pause-resume`,
          onClick: () => setConfirm(!0),
          children: `🏠 메인 화면으로`,
        }),
      ],
    }),
  });
}
function oe({ visible: e, onSelect: t }) {
  let [step, setStep] = (0, _.useState)(`mode`),
    [cfg, setCfg] = (0, _.useState)({});
  (0, _.useEffect)(() => {
    e && (setStep(`mode`), setCfg({}));
  }, [e]);
  if (!e) return null;
  let big = { padding: `12px 16px`, fontSize: 15, textAlign: `left` },
    pick = (k, v) => {
      let c2 = { ...cfg, [k]: v };
      setCfg(c2);
      k === `mode` ? setStep(`diff`) : k === `diff` ? (c2.mode === `2P` ? setStep(`innings`) : t(c2)) : t(c2);
    },
    back = (to) => (0, S.jsx)(`button`, { className: `bb-btn bb-btn-home`, style: { padding: `8px 12px`, fontSize: 13 }, onClick: () => setStep(to), children: `◀ 뒤로` }),
    body =
      step === `mode`
        ? [
            (0, S.jsx)(`h3`, { className: `bb-pause-title`, children: `게임 모드` }, `h`),
            (0, S.jsx)(`button`, { className: `bb-btn bb-btn-playball`, style: big, onClick: () => pick(`mode`, `1P`), children: `👤 1인 플레이 — 컴퓨터가 던지는 공을 칩니다 (3아웃 단판)` }, `a`),
            (0, S.jsx)(`button`, { className: `bb-btn bb-btn-swing`, style: big, onClick: () => pick(`mode`, `2P`), children: `👥 2인 대결 — 한 명은 투수, 한 명은 타자 (이닝마다 공수 교대)` }, `b`),
          ]
        : step === `diff`
          ? [
              (0, S.jsx)(`h3`, { className: `bb-pause-title`, children: `난이도` }, `h`),
              (0, S.jsx)(`p`, { style: { fontSize: 13, color: `#bbb`, margin: `0 0 6px` }, children: `타격 타이밍 범위, 구속, 수비·송구 속도, 도루 성공률, 실책 확률이 달라집니다.` }, `p`),
              (0, S.jsx)(`button`, { className: `bb-btn bb-btn-playball`, style: big, onClick: () => pick(`diff`, `EASY`), children: `🟢 EASY` }, `a`),
              (0, S.jsx)(`button`, { className: `bb-btn`, style: { ...big, background: `#c0392b`, color: `#fff` }, onClick: () => pick(`diff`, `HARD`), children: `🔴 HARD` }, `b`),
              back(`mode`),
            ]
          : [
              (0, S.jsx)(`h3`, { className: `bb-pause-title`, children: `경기 이닝` }, `h`),
              (0, S.jsx)(`p`, { style: { fontSize: 13, color: `#bbb`, margin: `0 0 6px`, lineHeight: 1.6 }, children: `동점이면 연장 승부치기(직전 타순 타자가 2루 주자, 무사 2루). 5·9이닝은 콜드게임 적용: 5회 이후 15점 차, 7회 이후 10점 차.` }, `p`),
              (0, S.jsx)(`div`, {
                className: `bb-innings-pick`,
                children: [1, 3, 5, 9].map((n) => (0, S.jsx)(`button`, { className: `bb-btn bb-btn-playball`, onClick: () => pick(`innings`, n), children: `${n}이닝` }, n)),
              }, `g`),
              back(`diff`),
            ];
  return (0, S.jsx)(`div`, {
    className: `bb-pause-overlay`,
    role: `dialog`,
    "aria-modal": `true`,
    "aria-label": `메인 화면`,
    children: (0, S.jsxs)(`div`, {
      className: `bb-pause-card`,
      children: [
        (0, S.jsx)(`div`, { className: `bb-main-title`, children: `⚾ 5초 절대판정 베이스볼` }),
        (0, S.jsx)(`div`, { style: { display: `flex`, flexDirection: `column`, gap: 10 }, children: body }),
      ],
    }),
  });
}
// ── 포수 뒤 타격 시점 (구장 배경은 정적 SVG, 공·마커·타자는 훅에서 직접 DOM 갱신) ──
var BB_SCENE = (() => {
  let fan = ``;
  for (let i = -9; i <= 9; i += 2)
    fan += `<polygon points="425,120 ${425 + i * 95},620 ${425 + (i + 1) * 95},620" fill="#46a24f"/>`;
  return `<svg class="bv-scene" viewBox="0 0 850 580" width="850" height="580" aria-hidden="true">
<defs>
<linearGradient id="bvSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f5f9e"/><stop offset="1" stop-color="#8fb9e6"/></linearGradient>
<pattern id="bvCrowd" width="9" height="8" patternUnits="userSpaceOnUse"><rect width="9" height="8" fill="#273041"/><circle cx="2" cy="2" r="1.6" fill="#c8b39c"/><circle cx="6.5" cy="5.6" r="1.6" fill="#5b7fae"/><circle cx="7" cy="1.6" r="1.1" fill="#ececec" opacity=".55"/><circle cx="2.6" cy="6.4" r="1.3" fill="#b33939" opacity=".7"/></pattern>
<linearGradient id="bvStandShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".05"/></linearGradient>
<radialGradient id="bvDirt" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#c7915e"/><stop offset="1" stop-color="#a8774a"/></radialGradient>
<radialGradient id="bvVig" cx=".5" cy=".55" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
<clipPath id="bvGrassClip"><rect x="0" y="196" width="850" height="384"/></clipPath>
</defs>
<rect width="850" height="110" fill="url(#bvSky)"/>
<rect x="0" y="38" width="850" height="80" fill="url(#bvCrowd)"/>
<rect x="0" y="38" width="850" height="80" fill="url(#bvStandShade)"/>
<rect x="0" y="116" width="850" height="7" fill="#1b2944"/>
<rect x="0" y="123" width="850" height="57" fill="url(#bvCrowd)"/>
<rect x="0" y="123" width="850" height="57" fill="url(#bvStandShade)" opacity=".6"/>
<g fill="#cfd8e3"><rect x="58" y="0" width="5" height="60"/><rect x="787" y="0" width="5" height="60"/></g>
<g fill="#fffbe6"><rect x="40" y="2" width="42" height="16" rx="2"/><rect x="768" y="2" width="42" height="16" rx="2"/></g>
<rect x="362" y="96" width="126" height="102" fill="#16261b"/>
<rect x="0" y="178" width="850" height="20" fill="#1f5130"/>
<rect x="0" y="177" width="850" height="2.5" fill="#f1c40f"/>
<g font-family="Malgun Gothic,sans-serif" font-weight="900" font-size="11" text-anchor="middle">
<rect x="120" y="182" width="120" height="13" fill="#c0392b"/><text x="180" y="192.5" fill="#fff">5초 절대판정</text>
<rect x="610" y="182" width="120" height="13" fill="#2980b9"/><text x="670" y="192.5" fill="#fff">BASEBALL</text></g>
<rect x="0" y="196" width="850" height="384" fill="#3c8e45"/>
<g clip-path="url(#bvGrassClip)">${fan}</g>
<ellipse cx="425" cy="560" rx="600" ry="352" fill="url(#bvDirt)"/>
<g clip-path="url(#bvGrassClip)"><ellipse cx="425" cy="578" rx="470" ry="346" fill="#3f9447"/></g>
<ellipse cx="425" cy="262" rx="58" ry="11" fill="url(#bvDirt)"/>
<rect x="418" y="257" width="14" height="2.5" fill="#fff"/>
<g fill="#fff"><polygon points="425,217 433,221 425,225 417,221"/><polygon points="80,298 92,303 80,308 68,303"/><polygon points="770,298 782,303 770,308 758,303"/></g>
<ellipse cx="425" cy="590" rx="310" ry="100" fill="url(#bvDirt)"/>
<g stroke="#fff" stroke-width="2.5" opacity=".9"><line x1="425" y1="548" x2="0" y2="243"/><line x1="425" y1="548" x2="850" y2="243"/></g>
<g fill="none" stroke="#fff" stroke-width="2" opacity=".85"><polygon points="300,518 382,518 374,580 282,580"/><polygon points="468,518 550,518 568,580 476,580"/></g>
<polygon points="395,540 455,540 458,549 425,560 392,549" fill="#f4f4f4"/>
<rect width="850" height="580" fill="url(#bvVig)"/>
</svg>`;
})(),
  BB_PITCHER = `<svg viewBox="0 0 36 64" width="36" height="64" aria-hidden="true">
<ellipse cx="18" cy="62" rx="12" ry="2.5" fill="#000" opacity=".3"/>
<rect x="12" y="38" width="5" height="23" rx="2" fill="#d7d9de"/><rect x="19" y="38" width="5" height="23" rx="2" fill="#d7d9de"/>
<rect x="9" y="18" width="18" height="22" rx="4" fill="#eceef2"/>
<rect x="7" y="20" width="4" height="13" rx="2" fill="#1b2944"/>
<circle cx="18" cy="12" r="5.5" fill="#e0b48a"/><path d="M12 10 Q18 3 24 10 L26 11 L12 11Z" fill="#1b2944"/>
<g class="bv-parm"><rect x="25" y="20" width="4" height="14" rx="2" fill="#e0b48a"/></g>
</svg>`,
  BB_BATTER = `<svg viewBox="0 0 220 370" width="220" height="370" aria-hidden="true" overflow="visible">
<ellipse cx="110" cy="360" rx="86" ry="9" fill="#000" opacity=".3"/>
<path d="M78 214 L58 352 L80 354 L102 222Z" fill="#e9ebf0"/><path d="M118 220 L150 350 L172 346 L146 212Z" fill="#e9ebf0"/>
<path d="M52 348 h32 v12 h-36z M146 344 h30 l4 12 h-34z" fill="#111"/>
<path d="M62 108 Q110 92 162 106 L156 220 Q112 230 72 222Z" fill="#f6f7fa"/>
<g stroke="#1b2944" stroke-width="1.2" opacity=".35"><line x1="80" y1="102" x2="78" y2="224"/><line x1="98" y1="98" x2="97" y2="227"/><line x1="116" y1="97" x2="116" y2="228"/><line x1="134" y1="99" x2="136" y2="226"/><line x1="150" y1="102" x2="152" y2="222"/></g>
<rect x="70" y="214" width="88" height="9" fill="#1b2944"/>
<path d="M66 112 Q100 140 146 104" stroke="#f6f7fa" stroke-width="20" fill="none" stroke-linecap="round"/>
<path d="M160 112 L152 100" stroke="#f6f7fa" stroke-width="18" fill="none" stroke-linecap="round"/>
<circle cx="150" cy="100" r="9" fill="#1b2944"/>
<ellipse cx="108" cy="70" rx="31" ry="33" fill="#13284b"/><path d="M128 62 Q150 70 140 98 L124 92Z" fill="#13284b"/><ellipse cx="100" cy="58" rx="12" ry="7" fill="#fff" opacity=".18"/>
</svg>`;
function BatView({
  bvRef: e,
  visible: t,
  pitchInfo: n,
  feedback: r,
  onSwing: i,
  batterNumber: num,
  batterHand: hand,
  mode,
}) {
  let reg = (k) => (el) => {
      e.current[k] = el;
    },
    cvP = (0, _.useRef)(null),
    cvB = (0, _.useRef)(null);
  // 타자·투수 동작(rig.js): 캔버스 두 장 — 투수는 존·공보다 뒤, 타자는 앞
  (0, _.useEffect)(() => {
    let rig = BB_RIG.create(cvP.current, cvB.current),
      rp = rig.releasePoint();
    ((BB_REL.x = rp.x), (BB_REL.y = rp.y), (e.current.rig = rig));
    return () => (rig.destroy(), e.current.rig === rig && (e.current.rig = null));
  }, []);
  (0, _.useEffect)(() => {
    let rig = e.current.rig;
    rig && (rig.setHand(hand === `R` ? `R` : `L`), rig.setNumber(num));
  }, [hand, num]);
  (0, _.useEffect)(() => {
    e.current.rig?.setVisible(t);
  }, [t]);
  return (0, S.jsxs)(`div`, {
    className: `bv${t ? ` on` : ``}`,
    onPointerDown: (ev) => {
      ev.target.closest(`button`) || i();
    },
    children: [
      (0, S.jsx)(`div`, { dangerouslySetInnerHTML: { __html: BB_SCENE } }),
      (0, S.jsx)(`canvas`, { ref: cvP, className: `bv-canvas bv-canvas-p` }),
      (0, S.jsx)(`div`, { className: `bv-zone` }),
      (0, S.jsx)(`div`, { ref: reg(`marker`), className: `bv-marker` }),
      (0, S.jsx)(`div`, { ref: reg(`ball`), className: `bv-ball` }),
      (0, S.jsx)(`div`, { ref: reg(`spark`), className: `bv-spark` }),
      // 좌타는 1루 쪽(오른쪽), 우타는 3루 쪽(왼쪽)에 섬 — rig.js가 그림
      (0, S.jsx)(`canvas`, { ref: cvB, className: `bv-canvas bv-canvas-b` }),
      r &&
        (0, S.jsx)(
          `div`,
          { className: `bv-feedback`, style: { color: r.color }, children: r.text },
          r.text,
        ),
      n && (0, S.jsx)(`div`, { className: `bv-pitchinfo`, children: n }),
      (0, S.jsx)(`div`, {
        className: `bv-hint`,
        children: mode === `2P` ? `타자: Space / 화면 터치 스윙 · 타구 후 ← 귀루 → 진루` : `Enter 플레이볼 · Space / 화면 터치 스윙 · 타구 후 ← 귀루 → 진루`,
      }),
    ],
  });
}
var se = 850,
  O = 580,
  k = 90;
function ce() {
  let { refs: e, state: t, actions: n } = b(),
    r = (0, _.useRef)(null),
    [i, a] = (0, _.useState)(1);
  ((0, _.useLayoutEffect)(() => {
    let e = r.current;
    if (!e) return;
    let t = () => {
      let t = e.clientWidth,
        n = Math.max(window.innerHeight - k - 40, 300),
        r = Math.min(t / se, n / O, 1.2);
      a(Math.max(0.35, r));
    };
    t();
    let n = new ResizeObserver(t);
    return (
      n.observe(e),
      window.addEventListener(`resize`, t),
      () => {
        (n.disconnect(), window.removeEventListener(`resize`, t));
      }
    );
  }, []),
    (0, _.useEffect)(() => {
      let e = document.body.style.overflow;
      return (
        (document.body.style.overflow = `hidden`),
        () => {
          document.body.style.overflow = e;
        }
      );
    }, []));
  let o = O * i;
  return (0, S.jsxs)(`div`, {
    className: `bb-root`,
    style: {
      minHeight: `100vh`,
      background: `#111`,
      color: `#fff`,
      display: `flex`,
      flexDirection: `column`,
      alignItems: `center`,
      justifyContent: `center`,
      padding: `12px`,
      overflow: `hidden`,
    },
    children: [
      (0, S.jsx)(`div`, {
        ref: r,
        style: {
          width: `100%`,
          maxWidth: se,
          display: `flex`,
          justifyContent: `center`,
        },
        children: (0, S.jsx)(`div`, {
          className: `bb-scale-wrap`,
          style: {
            width: se,
            height: O,
            transform: `scale(${i})`,
            marginBottom: o - O,
          },
          children: (0, S.jsxs)(`div`, {
            className: `bb-container`,
            children: [
              (0, S.jsx)(T, {
                refs: e,
                fieldView: t.fieldView,
                pitchTarget: t.pitchTarget,
              }),
              (0, S.jsx)(BatView, {
                bvRef: e.batViewRef,
                visible: t.fieldView === `catcher-view`,
                pitchInfo: t.pitchInfo,
                batterNumber: t.batterNumber,
                batterHand: t.batterHand,
                mode: t.mode,
                feedback: t.swingFeedback,
                onSwing: n.swing,
              }),
              (0, S.jsx)(PitchPrompt, {
                show: t.mode === `2P` && t.awaitPitch && !t.paused && !t.gameOver,
                sel: t.pitchSel,
                defName: t.teams[1 - t.bat]?.name,
                batName: t.teams[t.bat]?.name,
              }),
              (0, S.jsx)(ee, {
                statusText: t.statusText,
                distanceText: t.distanceText,
                baseStatus: t.baseStatus,
                totalScore: t.totalScore,
                strikes: t.strikes,
                balls: t.balls,
                outs: t.outs,
                batterNumber: t.batterNumber,
                batterHand: t.batterHand,
                mode: t.mode,
                teams: t.teams,
                inning: t.inning,
                half: t.half,
                bat: t.bat,
                tbRunner: t.tbRunner,
              }),
              (0, S.jsx)(RunCtl, { ctl: t.paused ? null : t.runCtl, onCmd: n.runCmd }),
              (0, S.jsx)(ie, {
                baseStatus: t.baseStatus,
                canManualRunner: t.canManualRunner && !t.gameOver,
                onAdvance: n.advanceRunner,
                batView: t.fieldView === `catcher-view`,
              }),
              (0, S.jsx)(te, {
                text: t.result.text,
                color: t.result.color,
                visible: t.result.visible,
              }),
              (0, S.jsx)(HalfBreak, {
                info: t.halfBreak,
                teams: t.teams,
                innings: t.innings,
                inning: t.inning,
                half: t.half,
                onNext: n.nextHalf,
              }),
              (0, S.jsx)(ne, {
                visible: t.gameOver,
                finalScore: t.totalScore,
                onRestart: n.restartGame,
                mode: t.mode,
                endInfo: t.endInfo,
                teams: t.teams,
                innings: t.innings,
                inning: t.inning,
                half: t.half,
              }),
            ],
          }),
        }),
      }),
      (0, S.jsx)(D, {
        playballDisabled: t.playballDisabled || t.gameOver,
        swingDisabled: t.swingDisabled || t.gameOver,
        paused: t.paused,
        gameOver: t.gameOver,
        onPlayball: n.playball,
        onSwing: n.swing,
        onPause: n.pauseGame,
      }),
      (0, S.jsx)(ae, {
        visible: t.paused,
        totalScore: t.totalScore,
        balls: t.balls,
        strikes: t.strikes,
        outs: t.outs,
        baseStatus: t.baseStatus,
        hitLog: t.hitLog,
        onResume: n.resumeGame,
        onQuit: n.restartGame,
        mode: t.mode,
        teams: t.teams,
        innings: t.innings,
        inning: t.inning,
        half: t.half,
        bat: t.bat,
        halfRuns: t.halfRuns,
        batterNumber: t.batterNumber,
      }),
      (0, S.jsx)(oe, {
        visible: !t.difficulty && !t.gameOver,
        onSelect: n.setDifficulty,
      }),
    ],
  });
}
(0, g.createRoot)(document.getElementById(`root`)).render(
  (0, S.jsx)(_.StrictMode, { children: (0, S.jsx)(ce, {}) }),
);
