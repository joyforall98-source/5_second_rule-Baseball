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
  BB_HINT_WIN = 0.5, // TGA EASY 타이밍 원이 초록인 구간 (허용 창의 비율)
  BB_HINT_BONUS = 0.14, // 초록 구간에서 친 타구의 질 보정. 초록 구간 인플레이 타율 약 .50 (밖은 약 .30)
  // (BB_POS, bbOut 은 sim.js에 있음)
  // 1~9번 타순, 타순별 좌/우타는 경기마다 랜덤
  bbLineup = () => Array.from({ length: 9 }, () => (Math.random() < 0.5 ? `L` : `R`)),
  bbRand = (a, b) => a + Math.random() * (b - a);
// 구종 [이름, 비중, 구속범위, 좌우 변화, 낙차(+는 떨어짐)]
// Turn The Game Around 난이도별: 시작 점수 차, 컴퓨터 투수 스트라이크 비율(null = 기본 55%), 내 타구 질 보정
// 보정에 따른 인플레이 타율(시뮬레이션): EASY 약 .42 · SOSO 약 .36 · HARD 약 .33
var BB_TGA = { EASY: { gap: 2, strike: 0.5, boost: 0.08 }, SOSO: { gap: 4, strike: 0.55, boost: 0.03 }, HARD: { gap: 5, strike: null, boost: 0 } };
function bbGenPitch(hard, strikeP) {
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
  Math.random() < (strikeP ?? (hard ? 0.55 : 0.6))
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
// 사람이 던질 때: 고른 구종과 마우스로 찍은 도달 지점(존 좌표, ±1이 존 경계).
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
    [tx, ty] = sel.zone,
    g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()),
    spread = hard ? 0.15 : 0.22,
    zx = tx + g() * spread,
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
      isPitched: !1,
      isSwung: !1,
      pitchType: `strike`,
      pendingOutcome: null,
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
      pitch: null, // { name, kmh, dur, zx, zy, bx, by, isStrike, elapsed }
      pitchInfo: ``, // 직전 투구 표시 (예: "직구 147km/h · 스트라이크")
      swingFeedback: null, // { text, color }
      swingMiss: !1,
      mode: `1P`, // TGA(9회말 역전 미션) | 1P(컴퓨터와 대결) | 2P(둘이 대결)
      cpu: null, // 컴퓨터 팀 번호 (2P는 null)
      innings: 1,
      inning: 1,
      half: `top`, // top(초) | bottom(말)
      bat: 0, // 공격 팀 (0 = 선공, 1 = 후공)
      teams: [], // { name, lineup, batter, runs, line[] } — 타순·좌우타는 경기 시작 때 확정
      halfStartScore: 0,
      halfBreak: null, // 공수 교대 안내
      endInfo: null, // 경기 결과 { winner, reason, score }
      play: null, // 진행 중인 타구 플레이 (주루 지시용)
      awaitPitch: !1, // 사람이 수비일 때 구종·코스 선택 대기
      pitchSel: { type: null, zone: null, out: !1 },
      tbRunner: null, // 승부치기 2루 주자 타순
    }),
    // 주자의 리드 폭 (-1 짧게 · 0 보통 · 1 넓게). 넓으면 도루 성공↑ 견제 위험↑
    lead = (b) => (o.current.leads || [])[b - 1] || 0,
    // 사람이 수비(투구)하는 차례인가: 2인 대결은 항상, 컴퓨터 대결은 컴퓨터가 공격할 때
    humanDef = () => o.current.mode === `2P` || o.current.bat === o.current.cpu,
    l = () => {
      let e = o.current;
      ((e.batterNumber = e.batterNumber >= 9 ? 1 : e.batterNumber + 1), (e.batPlan = null));
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
      ((e.isPitched = !1),
        (e.isSwung = !1),
        (e.squeeze = !1),
        (e.steal = null)); // 도루 스타트한 주자 { 루: 스타트 시각(투구 경과 ms, 와인드업 중이면 -300) }
      let r = t.current;
      (r &&
        ((r.style.display = `none`),
        (r.style.transform = `translateX(-50%) translateZ(45px) rotateX(-90deg)`),
        (r.style.width = `8px`),
        (r.style.height = `8px`),
        (r.style.bottom = `150px`),
        (r.style.left = `50%`)));
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
      let e = o.current,
        key = e.baseStatus.join();
      e.leadKey !== key && ((e.leads = [0, 0, 0]), (e.leadKey = key));
      ((e.fieldView = `catcher-view`),
        (e.playballDisabled = humanDef()),
        (e.swingDisabled = !0),
        (e.awaitPitch = humanDef() && !e.gameOver),
        (e.pitchSel = { type: null, zone: null, out: !1 }),
        (e.statusText = humanDef() ? `${e.teams[1 - e.bat]?.name} 투구 선택` : e.autoPlay ? `다음 투구 준비…` : `Enter · 플레이볼`),
        ie(),
        T());
      // 플레이볼을 한 번 누르면 이후 컴퓨터 투구는 자동 (일시정지 중엔 멈추고, 메인 화면으로 나가면 해제)
      e.autoPlay &&
        !humanDef() &&
        !e.gameOver &&
        S(() => {
          let s = o.current;
          s.autoPlay && !humanDef() && !s.isPitched && !s.gameOver && !s.halfBreak && !s.paused && A();
        }, 1600);
    }, [T]),
    // ── 2인 모드: 점수·이닝 관리 ──
    // [P1(선공), P2(후공)] 현재 점수. 공격 중인 팀은 e.totalScore가 최신
    sc = () => {
      let e = o.current;
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
      ((e.outs = 0), (e.strikes = 0), (e.balls = 0), (e.baseStatus = [!1, !1, !1]), (e.tbRunner = null), (e.batPlan = null), (e.align = null));
      // 승부치기: 직전 타순의 타자를 2루 주자로 두고 무사 2루에서 시작
      e.inning > e.innings && ((e.baseStatus = [!1, !0, !1]), (e.tbRunner = e.batterNumber === 1 ? 9 : e.batterNumber - 1));
      (re(), ae());
    },
    // 후공 팀이 마지막 이닝(연장 포함) 말에 앞서거나 콜드 점수 차가 되면 즉시 종료
    walkOff = () => {
      let e = o.current;
      if (e.half !== `bottom` || e.gameOver) return !1;
      let [aw, hm] = sc();
      if (e.inning >= e.innings && hm > aw) return endGame2P(e.inning > e.innings ? `연장 ${e.inning}회 끝내기` : `${e.inning}회말 끝내기`);
      if (mercy(e.inning, hm - aw)) return endGame2P(`콜드게임 (${e.inning}회말)`);
      return !1;
    },
    oe = (0, _.useCallback)(() => {
      let e = o.current;
      let kWhy = e.buntK ? `스리번트 파울 삼진` : e.swingMiss ? `헛스윙 삼진` : `루킹 삼진`;
      e.buntK = !1;
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
          e.teams[e.bat].b++);
        let why = e.hbp ? `몸에 맞는 공` : `볼넷`;
        ((e.hbp = !1),
          (e.statusText = n ? `밀어내기 ${why}!` : `${why} 출루!`),
          E(n ? `밀어내기 ${why}` : why, n ? `#f1c40f` : `#2ecc71`),
          e.hitLog.push({
            batter: e.batterNumber,
            team: e.bat,
            hitType: n ? `밀어내기 ${why}` : why,
            rbis: r,
            scoreAfter: e.totalScore,
            time: Date.now(),
          }),
          l());
      }
      if ((ee(), e.outs >= 3)) return halfOver();
      return walkOff() || (T(), !1);
    }, [C, T, E]),
    // 5초 절대판정: 타구 5초 뒤 주루 지시를 마감해 판정을 확정 (이후는 AI 주루라 결과가 정해짐).
    // 남은 플레이는 생략하지 않고 끝까지 보여줌
    k = (0, _.useCallback)(() => {
      let e = o.current;
      ((m.current = null), e.pendingOutcome && !e.pendingOutcome.processed && e.play && ((e.play = null), (e.statusText = `5초 룰: 판정 확정`), T()));
    }, [T]),
    // 타구 진행: sim.js의 플레이를 2배속으로 실시간 진행. 5초 동안 주자에게 진루/귀루 지시 가능.
    // 플레이는 홈런 주자 홈인·중계 플레이까지 끝까지 보여준 뒤 다음 투구로
    // bb.steal: 도루(포수가 공을 받은 뒤부터) · bb.pick = 루: 견제에 걸린 주자의 런다운. after: 끝난 뒤 다음 할 일 (기본은 다음 투구)
    pb = (bb, after) => {
      let e = o.current,
        // 도루 스타트한 주자가 뛴 시간(초): 도루는 포수가 받은 순간까지, 타격(히트 앤드 런)은 맞힌 순간까지
        run = e.steal && e.pitch && !bb.foul && !bb.pick && e.mode !== `DEMO` ? Object.fromEntries(Object.entries(e.steal).map(([b, at]) => [b, ((bb.steal ? e.pitch.dur : e.pitch.elapsed) - at) / 1e3])) : null,
        P = BB_SIM.start(bb, { bases: [...e.baseStatus], outs: e.outs, diff: e.difficulty, leads: e.mode === `DEMO` ? null : e.leads, steal: run, ...(e.mode === `DEMO` ? e.demoSim : e.align ? { fielders: bbAlign(e.align) } : null) }),
        ball = t.current,
        shadow = i.current.__shadow,
        SPEED = 2,
        last = performance.now(),
        lastHud = 0,
        hrShown = !1,
        errShown = !1,
        rdErrShown = !1,
        acc = 0, // 아직 진행하지 않은 시뮬레이션 시간(초)
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
          // 공을 놓치거나 더듬은 순간, 그 수비수 머리 위에 느낌표 (뜬공은 떨어뜨린 순간, 땅볼은 잡으려던 순간)
          if (!errShown && P.ev?.error && P.t >= Math.min(P.ev.t, P.landT)) {
            errShown = !0;
            let errEl = i.current[P.ev.key];
            errEl && (errEl.classList.add(`err`), setTimeout(() => errEl.classList.remove(`err`), 1800));
          }
          // 협살 중 송구 실책: 던진 선수 머리 위에 느낌표
          if (!rdErrShown && P.rdErr) {
            rdErrShown = !0;
            let errEl = i.current[P.rdErr];
            errEl && (errEl.classList.add(`err`), setTimeout(() => errEl.classList.remove(`err`), 1800));
          }
          // 홈런: 담장을 넘는 순간 알리고, 주자들이 홈에 들어오는 장면은 계속 보여줌
          P.homeRun && !hrShown && P.t >= bb.T && ((hrShown = !0), E(`HOME RUN!`, `#f1c40f`), (e.statusText = `홈런! 주자들이 홈으로`));
          for (let rr of vw.runners) {
            let el = a.current[rr.id];
            el && ((el.style.display = rr.visible ? `flex` : `none`), el.classList.toggle(`manual`, !!rr.manual), place(el, rr.x, rr.y));
          }
        },
        next = (ms) =>
          S(() => {
            (re(), (e.fieldView = `top-down-view`), T(), oe() || (after ? after() : S(ae, 400)));
          }, ms),
        finish = () => {
          ((d.current &&= (clearInterval(d.current), null)), draw());
          let sim = P.result();
          e.play = null;
          for (let id of [`runner-t`, `runner-1`, `runner-2`, `runner-3`]) a.current[id]?.classList.remove(`manual`);
          if (sim.foul && !sim.foulOut) {
            (bb.bunt && e.strikes === 2 && ((e.strikes = 3), (e.buntK = !0)),
              e.strikes < 2 && e.strikes++,
              e.squeeze ? E(`파울 · 스퀴즈 실패`, `#e67e22`) : E(`FOUL`, `#e67e22`),
              (e.statusText = e.squeeze ? `번트 파울 · 스퀴즈 실패` : `파울!`),
              T());
            if (e.mode === `DEMO`) return void S(() => ((e.demo.phase = `result`), T()), 1200);
            next(700);
            return;
          }
          // 끝내기: 홈런(그라운드 홈런 포함)은 모든 득점, 그 밖에는 결승점까지만 인정
          let need = e.teams[0].runs + 1 - e.totalScore;
          if (e.mode !== `DEMO` && e.half === `bottom` && e.inning >= e.innings && !sim.homeRun && sim.batterBase !== 4 && need > 0 && sim.runs > need) {
            let fix = (s) => s.replace(`${sim.runs}타점`, `${need}타점`).replace(`${sim.runs}점 득점`, `${need}점 득점`);
            sim = { ...sim, runs: need, label: fix(sim.label), display: fix(sim.display), status: fix(sim.status) };
          }
          // 스퀴즈: 결과만 표시. 타구 판단(희생번트·내야안타·병살 등, 못 댔으면 번트 헛스윙·번트 안 댐) + 스퀴즈 성공!/실패
          if (e.squeeze) {
            let ok = sim.runs > 0,
              base = sim.runnerOnly ? (e.swingMiss ? `번트 헛스윙` : `번트 안 댐`) : sim.label,
              tag = ok ? `스퀴즈 성공!` : `스퀴즈 실패`,
              text = `${base} · ${tag}`;
            sim = { ...sim, label: text, status: text, display: `${tag}<br><span class="bb-out-reason">(${base})</span>`, color: ok ? `#f1c40f` : `#c0392b` };
          }
          // 점수판 H·E: 안타(홈런 포함, 실책·야수선택 출루 제외)는 공격 팀, 실책은 수비 팀
          (sim.homeRun || (sim.batterBase >= 1 && !sim.caught && !sim.error && !/야수선택/.test(sim.label))) && e.teams[e.bat].h++;
          sim.error && e.teams[1 - e.bat].e++;
          sim.rdErr && e.teams[1 - e.bat].e++; // 협살 중 송구 실책
          ((e.outs += sim.outsAdded),
            (e.totalScore += sim.runs),
            (e.baseStatus = e.outs >= 3 ? [!1, !1, !1] : sim.newBases),
            sim.runnerOnly || ((e.strikes = 0), (e.balls = 0)), // 도루·런다운은 볼카운트·타자 그대로
            E(sim.display, sim.color || `#c0392b`),
            (e.statusText = sim.status),
            sim.distance != null && (e.distanceText = `${sim.distance} m`),
            e.hitLog.push({
              batter: e.batterNumber,
              team: e.bat,
              hitType: sim.label,
              rbis: sim.runnerOnly ? 0 : sim.runs,
              scoreAfter: e.totalScore,
              time: Date.now(),
            }),
            sim.runnerOnly || l(),
            T());
          // DEMO: 다음 투구 대신 결과·해설
          if (e.mode === `DEMO`) return void S(() => ((e.demo.phase = `result`), T()), 1200);
          next(1500);
        };
      ((e.stealWindow = !1),
        (e.fieldView = `top-down-view`),
        (e.statusText = bb.steal
          ? `${e.squeeze ? `번트 실패!` : `도루! 포수 송구`}${e.bat !== e.cpu ? ` · → 진루 / ← 귀루` : ``}`
          : bb.pick
            ? `런다운!${e.bat !== e.cpu ? ` → 진루 / ← 귀루` : ``}`
            : bb.foul
          ? `파울 타구`
          : P.homeRun
            ? `큰 타구! 넘어가나…`
            : `${bb.bunt ? `번트` : { ground: `땅볼`, line: `직선타`, fly: `뜬공`, pop: `뜬공` }[bb.kind]}!${e.mode === `DEMO` ? `` : ` → 진루 / ← 귀루`}`),
        (e.distanceText = `-`),
        te(),
        ball && ((ball.style.display = `block`), (ball.style.width = ball.style.height = `8px`)),
        shadow && (shadow.style.display = `block`),
        draw(),
        (e.play = bb.foul || P.homeRun || e.mode === `DEMO` ? null : P),
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
          // 시뮬레이션은 0.02초씩 일정하게 진행 (화면 프레임 간격과 상관없이 결과가 같도록. DEMO 결과 = demotest.js)
          for (acc += ((now - last) / 1e3) * (P.homeRun && P.t > bb.T ? 3 : SPEED); acc >= 0.02 && !P.done; acc -= 0.02) P.step(0.02);
          ((last = now), draw());
          now - lastHud > 120 && ((lastHud = now), T());
          P.done &&
            ((m.current &&= (clearTimeout(m.current), null)),
            e.pendingOutcome.processed || ((e.pendingOutcome.processed = !0), finish(!1)));
        }, 16)));
    },
    // 투구가 포수 미트에 들어간 뒤의 판정 (지켜봄 또는 헛스윙)
    // 폭투·포일: 포수가 공을 놓쳐 뒤로 빠지면 누상 주자가 한 베이스씩 진루 (3루 주자는 득점)
    wildPitch = (kind, done) => {
      let e = o.current,
        ball = t.current,
        cat = i.current.catcher,
        from = bbPx(BB_FIELD_M.catcher),
        to = bbPx({ x: bbRand(-10, 10), y: -12 }),
        occ = [3, 2, 1].filter((b) => e.baseStatus[b - 1]),
        mix = (p, q, k) => ({ bottom: p.bottom + (q.bottom - p.bottom) * k, left: p.left + (q.left - p.left) * k }),
        put = (el, q) => el && ((el.style.bottom = q.bottom + `px`), (el.style.left = q.left + `%`)),
        f = 0;
      ((e.fieldView = `top-down-view`),
        (e.statusText = kind === `폭투` ? `폭투! 공이 뒤로 빠졌다` : `포일! 포수가 공을 놓쳤다`),
        E(kind, `#e67e22`),
        ie(),
        ball && ((ball.style.display = `block`), (ball.style.transform = `translateX(-50%) translateZ(4px) rotateX(-90deg)`)),
        T());
      d.current = setInterval(() => {
        if (e.paused) return;
        f = Math.min(1, f + 0.03);
        (put(ball, mix(from, to, Math.min(1, f * 1.6))), put(cat, mix(from, to, Math.max(0, f - 0.25)))); // 공이 굴러가고 포수가 쫓아감
        for (let b of occ) put(a.current[`runner-${b}`], mix(v[b], v[b + 1], f));
        if (f < 1) return;
        d.current &&= (clearInterval(d.current), null);
        let bs = e.baseStatus,
          runs = +!!bs[2];
        ((e.baseStatus = [!1, bs[0], bs[1]]),
          (e.totalScore += runs),
          (e.statusText = `${kind}로 주자 진루${runs ? ` · 1점 득점` : ``}`),
          e.hitLog.push({ batter: e.batterNumber, team: e.bat, hitType: `${kind}로 주자 진루`, rbis: 0, scoreAfter: e.totalScore, time: Date.now() }),
          T());
        S(() => (re(), done()), 900);
      }, 30);
    },
    // 낫아웃: 3스트라이크를 포수가 놓치면 타자가 1루로 뜀. 포수가 공을 주워 1루로 던지기 전에 닿으면 세이프.
    // 누상 주자는 그 틈에 한 베이스씩 진루
    dropped3 = (kind, done) => {
      let e = o.current,
        ball = t.current,
        cat = i.current.catcher,
        bat = a.current[`runner-t`],
        from = bbPx(BB_FIELD_M.catcher),
        roll = bbRand(5, 16), // 공이 굴러간 거리(m)
        spot = { x: bbRand(-8, 8), y: -1.2 - roll },
        sp = bbPx(spot),
        first = v[1],
        pickT = 0.4 + roll / 6, // 포수가 공에 닿는 시각(초)
        throwT = Math.hypot(spot.x - BB_BASES[1].x, spot.y - BB_BASES[1].y) / 21,
        catT = pickT + 0.5 + throwT, // 공이 1루에 닿는 시각
        batT = 0.6 + 27.43 / 7.3, // 타자가 1루에 닿는 시각
        safe = batT < catT,
        end = Math.min(catT, batT) + 0.3,
        occ = [3, 2, 1].filter((b) => e.baseStatus[b - 1]),
        mix = (p, q, k) => ({ bottom: p.bottom + (q.bottom - p.bottom) * k, left: p.left + (q.left - p.left) * k }),
        put = (el, q) => el && ((el.style.bottom = q.bottom + `px`), (el.style.left = q.left + `%`)),
        tt = 0;
      ((e.fieldView = `top-down-view`),
        (e.statusText = `낫아웃! 포수가 공을 놓쳤다 · 타자 1루로!`),
        E(`낫아웃!`, `#e67e22`),
        ie(),
        bat && ((bat.style.display = `flex`), put(bat, v[0])),
        ball && ((ball.style.display = `block`), (ball.style.transform = `translateX(-50%) translateZ(4px) rotateX(-90deg)`)),
        T());
      d.current = setInterval(() => {
        if (e.paused) return;
        tt += 0.03 * 1.6; // 1.6배속
        let k = Math.min(1, tt / end);
        // 공: 뒤로 굴러감 → 포수가 주워 1루로 송구
        put(ball, tt < pickT + 0.5 ? mix(from, sp, Math.min(1, tt / 0.7)) : mix(sp, first, Math.min(1, (tt - pickT - 0.5) / throwT)));
        put(cat, mix(from, sp, Math.min(1, tt / pickT)));
        put(bat, mix(v[0], first, Math.min(1, Math.max(0, tt - 0.6) / (batT - 0.6))));
        for (let b of occ) put(a.current[`runner-${b}`], mix(v[b], v[b + 1], k));
        if (tt < end) return;
        d.current &&= (clearInterval(d.current), null);
        let bs = e.baseStatus,
          runs = +!!bs[2];
        ((e.baseStatus = [safe, bs[0], bs[1]]),
          (e.totalScore += runs),
          (e.strikes = 0),
          (e.balls = 0),
          safe || e.outs++,
          E(safe ? `낫아웃 출루!` : bbOut(`낫아웃 송구 아웃`), safe ? `#2ecc71` : `#c0392b`),
          (e.statusText = safe ? `낫아웃으로 1루 세이프${runs ? ` · 1점 득점` : ``}` : `삼진 · 포수가 1루로 던져 아웃`),
          e.hitLog.push({ batter: e.batterNumber, team: e.bat, hitType: safe ? `삼진 (낫아웃 출루)` : `삼진 (낫아웃 송구 아웃)`, rbis: 0, scoreAfter: e.totalScore, time: Date.now() }),
          l(),
          T());
        S(() => (re(), done()), 1000);
      }, 30);
    },
    fe = () => {
      let e = o.current,
        P = e.pitch,
        // 몸에 맞는 공: 타자 쪽(우타는 -x)으로 크게 빠진 공을 치지 않으면 가끔
        hbp = !e.swingMiss && P && P.zx * (e.lineup[e.batterNumber - 1] === `R` ? -1 : 1) > 1.55 && P.zy > -1.3 && Math.random() < 0.08,
        // 포수가 공을 놓침: 땅에 박히는 낮은 공은 폭투, 그 밖에 드물게 포일
        wild = !hbp && P ? (P.zy < -1.4 ? Math.random() < 0.15 && `폭투` : Math.random() < 0.004 && `포일`) : !1;
      (e.swingMiss || bvRef.current.rig?.batter(`take`),
        (e.stealWindow = !1),
        (e.isSwung = !0),
        (e.swingDisabled = !0),
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
        hbp && ((e.hbp = !0), (e.balls = 4), (e.swingFeedback = { text: `몸에 맞는 공`, color: `#e67e22` })),
        (e.fieldView = `catcher-view`),
        T());
      // 도루 스타트한 주자가 있으면 포수가 받아 송구 (볼넷·폭투면 그대로 진루 처리. 삼진이어도 2아웃까지는 도루 플레이)
      let stl = e.steal && e.balls < 4 && !wild,
        go = () => oe() || (stl ? S(() => pb({ steal: !0 }), 250) : S(ae, 1200));
      // 3스트라이크를 놓치면 낫아웃(1루가 비었거나 2아웃일 때만 타자가 뜀), 그 밖에는 주자가 있을 때 폭투·포일
      wild && e.strikes >= 3 && (!e.baseStatus[0] || e.outs === 2)
        ? dropped3(wild, go)
        : wild && e.balls < 4 && e.strikes < 3 && e.baseStatus.some(Boolean)
          ? wildPitch(wild, go)
          : go();
    },
    pe = (0, _.useCallback)((cpu) => {
      let e = o.current,
        P = e.pitch;
      // cpu === true: 컴퓨터 타자의 스윙. 그 밖(키·버튼·화면 클릭)은 사람 타자만
      if (!e.isPitched || e.isSwung || (e.swingDisabled && cpu !== !0) || e.gameOver || !P) return;
      ((e.isSwung = !0), (e.swingDisabled = !0), (e.stealWindow = !1));
      let bv = bvRef.current;
      bv.rig?.batter(cpu !== !0 && e.batPlan === `bunt` ? `buntHit` : `swing`); // 번트는 휘두르지 않고 갖다 댐
      let plan = e.bat !== e.cpu ? e.batPlan : null, // 사람 타자의 타격 작전
        pl = BB_PLAN[plan] || { win: 1, q: 0, lat: 0 },
        win = bbSwingWindow(e.difficulty) * pl.win,
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
        e.mode === `TGA` && e.bat !== e.cpu && (q += BB_TGA[e.difficulty].boost), // TGA: 내 타구 질 보정
        e.mode === `TGA` && e.difficulty === `EASY` && e.bat !== e.cpu && adt <= win * BB_HINT_WIN && (q += BB_HINT_BONUS),
        (q += pl.q),
        (q = Math.max(0, Math.min(1, q + (Math.random() - 0.5) * 0.16))));
      // 빠르면 당겨침: 좌타자는 우측(+), 우타자는 좌측(-)
      let pull = e.lineup[e.batterNumber - 1] === `R` ? -1 : 1,
        lat = pull * (-dt / win) * 22 + (Math.random() - 0.5) * 8 + pull * pl.lat;
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
          // 번트도 타이밍으로 방향(일찍 → 당기는 쪽), 높은 공·볼에 대면 가끔 뜸 (DEMO는 그대로)
          pb(
            plan === `bunt`
              ? e.mode === `DEMO`
                ? BB_SIM.bunt(off > 1 || Math.random() < 0.25)
                : BB_SIM.bunt(off > 1 || Math.random() < 0.25, Math.max(-38, Math.min(38, (lat * 45) / 16)), P.zy > 0.55 || off > 1)
              : BB_SIM.batted(q, (lat * 45) / 16, q < 0.12 || Math.abs(lat) > 16, plan),
          );
        }, 450));
    }, [S, T]),
    // 견제: b루로 던져 견제사 또는 세이프. 끝나면 done(out)
    pickoff = (b, done, pOut) => {
      let e = o.current,
          out = Math.random() < (pOut ?? (e.difficulty === `HARD` ? 0.12 : 0.06)),
          ball = t.current,
          from = bbPx(BB_MOUND),
          to = v[b],
          f = 0;
        ((e.isPitched = !0),
          (e.playballDisabled = !0),
          (e.swingDisabled = !0),
          (e.stealWindow = !1),
          (e.awaitPitch = !1),
          (e.fieldView = `top-down-view`),
          (e.statusText = `${b}루 견제!`),
          ie(),
          ball && ((ball.style.display = `block`), (ball.style.transform = `translateX(-50%) translateZ(6px) rotateX(-90deg)`)),
          T());
        d.current = setInterval(() => {
          if (e.paused) return;
          f = Math.min(1, f + 0.07);
          ball && ((ball.style.bottom = from.bottom + (to.bottom - from.bottom) * f + `px`), (ball.style.left = from.left + (to.left - from.left) * f + `%`));
          if (f < 1) return;
          d.current &&= (clearInterval(d.current), null);
          if (out) {
            let bs = [...e.baseStatus];
            ((bs[b - 1] = !1), (e.baseStatus = bs), e.outs++, E(bbOut(`${b}루 견제사`), `#c0392b`), (e.statusText = `${b}루 주자 견제사!`));
            e.hitLog.push({ batter: e.batterNumber, team: e.bat, hitType: `${b}루 주자 견제사`, rbis: 0, scoreAfter: e.totalScore, time: Date.now() });
          } else ((e.statusText = `${b}루 주자 귀루, 세이프`), E(`SAFE!`, `#2ecc71`));
          T();
          S(() => {
            ((e.isPitched = !1), re(), done(out));
          }, 1100);
        }, 30);
    },
    // 컴퓨터 투수의 견제 동작: 반응 시간 안에 ←(귀루)하면 세이프, →(스타트)면 런다운,
    // 가만히 있으면 리드가 커서 가끔 견제사
    pickWarn = (b, done) => {
      let e = o.current;
      ((e.isPitched = !0),
        (e.playballDisabled = !0),
        (e.swingDisabled = !0),
        (e.stealWindow = !1),
        (e.awaitPitch = !1),
        (e.fieldView = `top-down-view`),
        ie(),
        (e.pickWarn = { b, go: null }),
        (e.statusText = `투수 견제 동작! ← 로 ${b}루 귀루`),
        T());
      S(
        () => {
          let go = e.pickWarn?.go;
          ((e.pickWarn = null), (e.isPitched = !1));
          go === `advance` ? pb({ pick: b }, done) : pickoff(b, done, go === `return` ? 0 : (e.difficulty === `HARD` ? 0.3 : 0.15) + 0.12 * lead(b));
        },
        (e.difficulty === `HARD` ? 500 : 800) - 150 * lead(b), // 리드가 넓으면 돌아갈 시간이 짧음
      );
    },
    A = (0, _.useCallback)(() => {
      let e = o.current;
      if (e.isPitched || e.gameOver) return;
      humanDef() || (e.autoPlay = !0); // 컴퓨터 투구를 한 번 시작하면 자동 진행
      // 컴퓨터 수비: 주자가 있으면 가끔 견제. 끝나면 원래 투구를 그대로 던짐 (견제사로 3아웃이면 공수 교대)
      let occ = [1, 2, 3].filter((b) => e.baseStatus[b - 1]),
        wide = occ.filter((b) => lead(b) > 0),
        big = Math.max(-1, ...occ.map(lead));
      if (!e.noPick && !humanDef() && occ.length && Math.random() < 0.18 * (1 + 0.6 * big)) {
        // 리드를 넓게 잡은 주자에게 먼저, 아니면 대부분 1루
        let b = wide.length ? wide[0] : occ[0] === 1 && Math.random() < 0.75 ? 1 : occ[Math.floor(Math.random() * occ.length)];
        return pickWarn(b, () => oe() || ((e.noPick = !0), A()));
      }
      e.noPick = !1;
      (ne(),
        (e.isPitched = !0),
        (e.playballDisabled = !0),
        (e.swingDisabled = !0),
        (e.stealWindow = !0),
        (e.fieldView = `catcher-view`),
        (e.statusText = `투수 와인드업...`),
        (e.swingFeedback = null),
        (e.pitchInfo = ``),
        (e.distanceText = `-`));
      let P =
        e.pitchSel.type
          ? bbMakePitch(e.difficulty === `HARD`, e.pitchSel)
          : bbGenPitch(e.difficulty === `HARD`, e.mode === `TGA` ? BB_TGA[e.difficulty].strike : null);
      ((e.awaitPitch = !1), (e.pitchSel = { type: null, zone: null, out: !1 }), bvRef.current.rig?.pitcher(`windup`));
      ((e.pitch = P),
        (e.pitchType = P.isStrike ? `strike` : `ball`),
        T(),
        (e.windupTimer = S(() => {
          ((e.windupTimer = null), (e.swingDisabled = e.bat === e.cpu)); // 컴퓨터가 타자면 사람 스윙 막음
          let bv = bvRef.current,
            last = performance.now(),
            // 스윙 가능한 마지막 시점이 지나면 판정
            endAt = P.dur + bbSwingWindow(e.difficulty) + 40,
            // TGA EASY 타이밍 원: 공이 오면서 줄어들어 포구 위치 원과 겹칠 때가 정타. 안타가 잘 나오는 구간에서 초록
            hint = e.mode === `TGA` && e.difficulty === `EASY` && !humanDef(),
            goWin = bbSwingWindow(e.difficulty) * BB_HINT_WIN;
          (bv.ball && (bv.ball.style.display = `block`),
            bv.rig?.pitcher(`release`),
            bv.rig?.batter(e.bat !== e.cpu && e.batPlan === `bunt` ? `bunt` : `load`),
            // 컴퓨터 타자: 스트라이크는 대부분, 볼은 가끔 휘두름 (타이밍 오차는 난이도별). 투구 루프에서 실행
            (P.cpuSwing =
              e.bat === e.cpu && Math.random() < (P.isStrike ? 0.8 : 0.25)
                ? P.dur + (Math.random() + Math.random() - 1) * (e.difficulty === `HARD` ? 60 : 90)
                : null),
            bv.marker &&
              (e.mode === `TGA` || e.difficulty === `EASY`) &&
              !humanDef() &&
              (bv.marker.classList.toggle(`hint`, hint),
              bv.marker.classList.toggle(`go`, !1),
              bv.marker.classList.toggle(`bad`, hint && Math.max(Math.abs(P.zx), Math.abs(P.zy)) > 1), // 볼: 회색 (치지 말 것)
              (bv.marker.style.display = `block`),
              (bv.marker.style.left = bbPlateX(P.zx) + `px`),
              (bv.marker.style.top = bbPlateY(P.zy) + `px`)),
            bbDrawBall(bv.ball, P, 0),
            (e.statusText = `투구!`),
            // 스퀴즈: 사람 타자가 번트 작전이고 3루 주자가 있으면 투구와 함께 홈으로 스타트
            e.bat !== e.cpu &&
              e.mode !== `DEMO` &&
              e.batPlan === `bunt` &&
              e.baseStatus[2] &&
              ((e.steal = { ...e.steal, 3: 0 }), (e.squeeze = !0)), // 알림 없이 결과만 표시
            // 컴퓨터 공격: 가끔 도루 (1루 → 2루 7%, 2루 → 3루 3%, 다음 루가 비었을 때). 리드가 넓을수록 견제가 유리
            e.bat === e.cpu &&
              e.mode !== `DEMO` &&
              [2, 1].forEach(
                (b) =>
                  e.baseStatus[b - 1] &&
                  !e.baseStatus[b] &&
                  Math.random() < (b === 1 ? 0.07 : 0.03) &&
                  ((e.steal = { ...e.steal, [b]: Math.random() * 120 }), (e.statusText = `${b}루 주자 도루 스타트!`)),
              ),
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
                hint &&
                  bv.marker &&
                  (bv.marker.style.setProperty(`--k`, 1 + 2 * Math.max(0, 1 - P.elapsed / P.dur)),
                  bv.marker.classList.toggle(`go`, Math.abs(P.elapsed - P.dur) <= goWin)),
                P.cpuSwing != null && P.elapsed >= P.cpuSwing && ((P.cpuSwing = null), pe(!0)),
                u.current &&
                  P.elapsed >= endAt &&
                  ((u.current &&= (clearInterval(u.current), null)),
                  bv.ball && (bv.ball.style.display = `none`),
                  bv.marker && (bv.marker.style.display = `none`),
                  fe()));
            }, 16)));
        }, 1200)));
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
        (e.result = { text: ``, color: ``, visible: !1 }),
        (e.stealWindow = !1),
        (e.paused = !1),
        (e.hitLog = []),
        (e.batterNumber = 1),
        (e.lineup = bbLineup()),
        (e.pitch = null),
        (e.pitchInfo = ``),
        (e.swingFeedback = null),
        (e.swingMiss = !1),
        (e.windupTimer = null),
        (e.mode = `1P`),
        (e.cpu = null),
        (e.innings = 1),
        (e.inning = 1),
        (e.half = `top`),
        (e.bat = 0),
        (e.teams = []),
        (e.halfStartScore = 0),
        (e.halfBreak = null),
        (e.endInfo = null),
        (e.pickWarn = null),
        (e.rundown = null),
        (e.play = null),
        (e.awaitPitch = !1),
        (e.pitchSel = { type: null, zone: null, out: !1 }),
        (e.tbRunner = null),
        (e.difficulty = null),
        (e.autoPlay = !1),
        (e.demo = null),
        (e.demoSim = null),
        (e.batPlan = null),
        (e.align = null),
        (e.menuStep = null),
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
      (b) => {
        let n = o.current,
          st = n.steal || {};
        if (!he() || !n.pitch || !n.baseStatus[b - 1] || st[b] != null) return;
        // 다음 루에 주자가 있으면 그 주자도 뛰어야 함 (더블스틸)
        if (b < 3 && n.baseStatus[b] && st[b + 1] == null) return;
        let early = !!n.windupTimer;
        // 와인드업 중에 너무 일찍 뛰면 투수가 알아채고 견제 → 런다운
        if (early && Math.random() < (n.difficulty === `HARD` ? 0.45 : 0.3)) {
          (n.windupTimer.cancel(), (n.windupTimer = null), (n.stealWindow = !1), (n.swingDisabled = !0), (n.isSwung = !0), (n.statusText = `투수가 스타트를 알아챘다!`), T());
          return void S(() => pb({ pick: b }), 400);
        }
        ((st[b] = early ? -300 : n.pitch.elapsed), (n.steal = st), (n.statusText = `${b === 3 ? `3루 주자 홈스틸` : `${b}루 주자 도루`} 스타트!`), T());
      },
      [he, S, T],
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
  // 수비 투구 선택: { type } 또는 { zone: [zx, zy] }. 둘 다 고르면 잠시 뒤 투구
  let pickPitch = (0, _.useCallback)(
    (part) => {
      let s = o.current;
      if (!s.awaitPitch || s.paused || s.halfBreak || s.gameOver) return;
      (Object.assign(s.pitchSel, part),
        s.pitchSel.type && s.pitchSel.zone && ((s.awaitPitch = !1), (s.statusText = `투구 준비 완료!`), S(A, 600)),
        T());
    },
    [S, T, A],
  );
  // 타격 작전 고르기 (사람이 공격할 때, 스윙 전까지). 같은 것을 다시 고르면 해제
  let setPlan = (k) => {
    let s = o.current;
    if (!s.difficulty || s.mode === `DEMO` || s.bat === s.cpu || s.isSwung || s.paused || s.gameOver) return;
    ((s.batPlan = s.batPlan === k ? null : k), T());
  };
  // 주자 리드 폭 조절 (사람이 공격할 때, 스윙 전까지)
  let setLead = (b, d) => {
    let s = o.current;
    if (s.bat === s.cpu || !s.baseStatus[b - 1] || s.isSwung || s.paused || s.gameOver) return;
    let l = [...(s.leads || [0, 0, 0])];
    ((l[b - 1] = Math.max(-1, Math.min(1, l[b - 1] + d))), (s.leads = l), T());
  };
  // 2인 대결 수비 위치
  let setAlign = (k) => {
    let s = o.current;
    s.awaitPitch && ((s.align = k === `기본` ? null : k), T());
  };
  // 견제 동작·런다운 중 주자 선택. 다음 루에 주자가 있으면 진루 불가, 견제 동작 땐 첫 선택만
  let runnerGo = (go) => {
    let s = o.current,
      rr = s.pickWarn || s.rundown;
    if (!rr || s.paused || (s.pickWarn && rr.go) || (go === `advance` && rr.b < 3 && s.baseStatus[rr.b])) return;
    ((rr.go = go), T());
  };
  // 사람 수비의 직접 견제. 끝나면 다시 투구 선택
  let pickBase = (0, _.useCallback)(
    (b) => {
      let s = o.current;
      if (!s.awaitPitch || s.paused || s.halfBreak || s.gameOver || !s.baseStatus[b - 1]) return;
      ((s.awaitPitch = !1), pickoff(b, () => oe() || ae()));
    },
    [oe, ae],
  );
  (0, _.useEffect)(() => {
    let PITCH_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4 },
      // 키보드 조준(2인 대결에서 상대가 못 보게): 존 3×3 칸, Shift를 누르면 존 밖으로 (가운데는 높은 볼)
      ZONE_KEYS = { KeyQ: [-1, 1], KeyW: [0, 1], KeyE: [1, 1], KeyA: [-1, 0], KeyS: [0, 0], KeyD: [1, 0], KeyZ: [-1, -1], KeyX: [0, -1], KeyC: [1, -1] };
    let e = (e) => {
      let s = o.current;
      if (s.halfBreak && e.code === `Enter`) return (e.preventDefault(), nextHalf());
      if (e.shiftKey && e.code in PITCH_KEYS && PITCH_KEYS[e.code] < 4 && s.awaitPitch) return (e.preventDefault(), pickBase(PITCH_KEYS[e.code]));
      if (e.code in PITCH_KEYS && s.awaitPitch) return (e.preventDefault(), pickPitch({ type: PITCH_KEYS[e.code] }));
      if (e.code in ZONE_KEYS && s.awaitPitch) {
        let [cx, cy] = ZONE_KEYS[e.code],
          k = e.shiftKey ? 1.45 : 0.62;
        return (e.preventDefault(), pickPitch({ zone: e.shiftKey && !cx && !cy ? [0, 1.45] : [cx * k, cy * k] }));
      }
      let pk = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 }[e.code];
      if (pk != null && !s.awaitPitch) return (e.preventDefault(), setPlan(BB_PLAN_KEYS[pk]));
      if ((s.pickWarn || s.rundown) && (e.code === `ArrowRight` || e.code === `ArrowLeft`))
        return (e.preventDefault(), runnerGo(e.code === `ArrowRight` ? `advance` : `return`));
      // 주루 지시: → 전원 진루, ← 전원 귀루
      if (s.play && !s.paused && s.bat !== s.cpu && (e.code === `ArrowRight` || e.code === `ArrowLeft`)) {
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
  }, [pe, A, _e, ve, S, T, pickPitch]);
  // 경기 시작: { mode: TGA|1P|2P, diff: EASY|SOSO(TGA 전용)|HARD, innings }. 타순별 좌/우타는 여기서 확정되어 경기 내내 유지
  // 컴퓨터 대결은 컴퓨터가 선공(초), 플레이어가 후공(말). TGA는 9회말 n : n+차이에서 시작하는 역전 미션
  // 수비수를 지정한 위치로 (없는 수비수는 기본 위치)
  let placeFielders = (map) => {
    for (let k in BB_FIELD_M) {
      let el = i.current[k],
        q = bbPx((map && map[k]) || BB_FIELD_M[k]);
      el && ((el.style.bottom = q.bottom + `px`), (el.style.left = q.left + `%`));
    }
  };
  // DEMO MODE: 상황 카드 시작. vi는 카드의 타자 유형(variant), 없으면 무작위
  let startDemo = (0, _.useCallback)(
    (ci, vi) => {
      me();
      let t = o.current,
        card = BB_DEMO[ci];
      vi ??= Math.floor(Math.random() * (card.variants ? card.variants.length : 1));
      let c = bbDemoCase(card, vi);
      ((t.mode = `DEMO`),
        (t.difficulty = `EASY`),
        (t.cpu = 0),
        (t.half = `bottom`),
        (t.bat = 1),
        (t.teams = [`수비`, `우리 팀`].map((name) => ({ name, lineup: bbLineup(), batter: 1, runs: 0, line: [], h: 0, e: 0, b: 0 }))),
        loadTeam(),
        (t.outs = c.outs),
        (t.baseStatus = [...c.bases]),
        (t.demo = { ci, vi, c, phase: `ask`, pick: null }),
        (t.demoSim = bbDemoSim(c, {})),
        (t.playballDisabled = !0),
        (t.swingDisabled = !0),
        (t.awaitPitch = !1),
        (t.fieldView = `top-down-view`),
        (t.statusText = `${c.title}: 전략을 골라 보세요`),
        ie());
      placeFielders(c.fielders);
      T();
    },
    [T],
  );
  let demoPick = (0, _.useCallback)(
    (oi) => {
      let t = o.current,
        dm = t.demo;
      if (!dm || dm.phase !== `ask`) return;
      let op = dm.c.options[oi],
        move = op.fielders !== void 0; // 수비 위치를 바꾸는 선택이면 먼저 옮겨 보여줌
      ((dm.phase = `play`), (dm.pick = oi), (t.demoSim = bbDemoSim(dm.c, op)), (t.isPitched = !0), (t.statusText = `${op.label}!`), T());
      move && placeFielders(op.fielders);
      S(() => pb({ ...op.bb }), move ? 900 : 0);
    },
    [S, T],
  );
  let demoList = (0, _.useCallback)(() => (me(), (o.current.menuStep = `demo`), T()), [T]);
  let ye = (0, _.useCallback)(
    (cfg) => {
      if (cfg.mode === `DEMO`) return startDemo(cfg.card);
      let t = o.current,
        tga = cfg.mode === `TGA`,
        team = (name, line = []) => ({ name, lineup: bbLineup(), batter: 1, runs: 0, line, h: 0, e: 0, b: 0 }),
        rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
        // TGA: n : n+차이 (BB_TGA). 이닝별 점수는 합계에 맞게 무작위 배분
        n = Math.floor(Math.random() * 7),
        gap = tga ? BB_TGA[cfg.diff].gap : 0,
        spread = (total, len) => {
          let a = Array(len).fill(0);
          for (let k = 0; k < total; k++) a[Math.floor(Math.random() * len)]++;
          return a;
        };
      ((t.mode = cfg.mode),
        (t.difficulty = cfg.diff),
        (t.cpu = cfg.mode === `2P` ? null : 0),
        (t.innings = tga ? 9 : cfg.innings),
        (t.inning = tga ? 9 : 1),
        (t.half = tga ? `bottom` : `top`),
        (t.bat = tga ? 1 : 0),
        (t.endInfo = null),
        (t.halfBreak = null),
        (t.hitLog = []),
        (t.teams =
          cfg.mode === `2P`
            ? [team(`P1`), team(`P2`)]
            : tga
              ? [team(`CPU`, spread(n + gap, 9)), team(`나`, spread(n, 8))]
              : [team(`CPU`), team(`나`)]),
        // TGA는 8회까지의 기록도 점수에 어울리게 채움
        tga &&
          t.teams.forEach((tm, k) =>
            Object.assign(tm, { runs: k ? n : n + gap, h: (k ? n : n + gap) + rint(2, 5), e: rint(0, 1), b: rint(0, 3) }),
          ),
        loadTeam(),
        ae(),
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
      canManualRunner: !j.gameOver && j.stealWindow && !j.paused && j.bat !== j.cpu,
      steal: j.steal ? { ...j.steal } : null,
      paused: j.paused,
      hitLog: j.hitLog,
      batterNumber: j.batterNumber,
      batterHand: j.lineup[j.batterNumber - 1],
      difficulty: j.difficulty,
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
      pitchSel: { type: j.pitchSel.type, zone: !!j.pitchSel.zone },
      batPlan: j.batPlan,
      leads: j.leads || [0, 0, 0],
      align: j.align,
      humanBat: j.bat !== j.cpu,
      autoPlay: j.autoPlay,
      tip:
        j.difficulty === `EASY` && j.mode !== `DEMO` && !j.isPitched && !j.gameOver && !j.halfBreak && !j.paused
          ? bbTip(j.outs, j.baseStatus, j.bat !== j.cpu)
          : null,
      demo: j.demo,
      menuStep: j.menuStep,
      runAlert: j.pickWarn ? { kind: `warn`, ...j.pickWarn } : j.rundown ? { kind: `rd`, ...j.rundown } : null,
      tbRunner: j.tbRunner,
      // 주루 지시 패널: 살아있는 주자별 가능 여부
      runCtl:
        j.play && !j.play.done && j.bat !== j.cpu
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
      pickPitch,
      pickBase,
      runnerGo,
      setPlan,
      setAlign,
      setLead,
      startDemo,
      demoPick,
      demoList,
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
function T({ refs: e, fieldView: t, children: r }) {
  let {
    fieldRef: i,
    ballRef: a,
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
  let need = mode === `TGA` && teams.length ? teams[0].runs - teams[1].runs + 1 : 0;
  return (0, S.jsxs)(S.Fragment, {
    children: [
      (0, S.jsxs)(`div`, {
        className: `bb-score-topright bb-sb2`,
        "aria-label": `점수판`,
        children: [
          (0, S.jsx)(`div`, { className: `bb-score-label`, children: `${inning}회${half === `top` ? `초 ▲` : `말 ▼`}${need > 0 ? ` · 역전 ${need}점` : ``}` }),
          ...teams.map((tm, k) =>
            (0, S.jsxs)(
              `div`,
              {
                className: `bb-sb2-row${k === bat ? ` batting` : ``}`,
                children: [(0, S.jsx)(`span`, { children: (k === bat ? `▶ ` : ``) + tm.name }), (0, S.jsx)(`b`, { children: tm.runs })],
              },
              k,
            ),
          ),
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
                children: [`${teams[bat]?.name ?? ``} ${s}번 (${bh === `R` ? `우` : `좌`})`, tbRunner ? ` · 2루 ${tbRunner}번` : ``],
              }),
            ],
          }),
          // 공격 팀 타순 (경기 내내 고정)
          teams[bat] && (0, S.jsx)(LineupCard, { team: teams[bat], current: s }),
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
// 경기 화면 안 버튼: 오른쪽 위 플레이볼/일시정지(하나로), 오른쪽 아래 타격 작전 + 타격
function GameButtons({ canPlay, paused, gameOver, swingDisabled, showPlan, plan, onPlan, onPlayball, onPause, onSwing }) {
  return (0, S.jsxs)(S.Fragment, {
    children: [
      (0, S.jsx)(`button`, {
        className: `bb-gbtn-main ${canPlay ? `play` : `pause`}`,
        onClick: canPlay ? onPlayball : onPause,
        disabled: !canPlay && (paused || gameOver),
        children: canPlay ? `▶ 플레이볼 (Enter)` : `⏸ 일시정지 (Esc)`,
      }),
      (0, S.jsxs)(`div`, {
        className: `bb-gbtn-br`,
        children: [
          showPlan &&
            (0, S.jsxs)(`div`, {
              className: `bb-plan`,
              children: [
                (0, S.jsx)(`b`, { children: `타격 작전` }),
                ...BB_PLAN_KEYS.map((k, i) =>
                  (0, S.jsx)(`button`, { className: plan === k ? `on` : ``, onClick: () => onPlan(k), children: `${i + 1} ${BB_PLAN[k].name}` }, k),
                ),
              ],
            }),
          (0, S.jsx)(`button`, { className: `bb-gbtn-swing`, onClick: onSwing, disabled: swingDisabled, children: [`타격`, (0, S.jsx)(`small`, { children: `Space` }, `k`)] }),
        ],
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
function ne({ visible: e, onRestart: n, mode, endInfo, teams, innings, inning, half }) {
  if (!e || !endInfo) return null;
  let w = endInfo.winner,
    title = mode === `2P` ? (w == null ? `무승부` : `${teams[w].name} 승리!`) : w === 1 ? (mode === `TGA` ? `미션 성공!` : `승리!`) : mode === `TGA` ? `미션 실패` : `패배`;
  return (0, S.jsxs)(`div`, {
    className: `bb-game-over`,
    children: [
      (0, S.jsx)(`h2`, { children: title }),
      (0, S.jsx)(`p`, { className: `bb-end-score`, children: `${teams[0].name} ${endInfo.score[0]} : ${endInfo.score[1]} ${teams[1].name} · ${endInfo.reason}` }),
      (0, S.jsx)(LineScore, { teams, innings, inning, half, final: !0 }),
      (0, S.jsx)(`button`, { className: `bb-btn bb-btn-restart`, onClick: n, children: `메인 화면으로` }),
    ],
  });
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
          children: [(0, S.jsx)(`th`, {}), ...cols.map((c) => (0, S.jsx)(`th`, { className: c > innings ? `ext` : ``, children: c }, c)), ...[`R`, `H`, `E`, `B`].map((h) => (0, S.jsx)(`th`, { className: `tot`, children: h }, h))],
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
                (0, S.jsx)(`td`, { className: `runs tot`, children: tm.runs }),
                // 안타 · 실책(수비) · 사사구
                ...[`h`, `e`, `b`].map((f) => (0, S.jsx)(`td`, { className: `heb`, children: tm[f] }, f)),
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
// DEMO MODE 안내판: 상황·질문·선택지 → (플레이 재생) → 결과와 한 줄 해설
function DemoPanel({ demo, onPick, onRetry, onNext, onList }) {
  let ref = (0, _.useRef)(null),
    phase = demo?.phase;
  // 좁은 화면(안내판이 경기장 아래)일 때: 질문·결과는 안내판으로, 플레이 재생은 경기장으로 스크롤
  (0, _.useEffect)(() => {
    let el = ref.current;
    if (!el || getComputedStyle(el).position === `fixed`) return;
    phase === `play` ? window.scrollTo({ top: 0, behavior: `smooth` }) : el.scrollIntoView({ behavior: `smooth`, block: `nearest` });
  }, [phase, demo?.ci]);
  if (!demo) return null;
  let c = demo.c,
    occ = [1, 2, 3].filter((b) => c.bases[b - 1]),
    // 기초 카드는 상황만 (타자 정보는 규칙과 상관없음)
    sit = `${c.outs ? `${c.outs}사` : `무사`} ${occ.length ? `${occ.join('·')}루` : `주자 없음`}${c.side === `basic` ? `` : ` · ${c.side === `def` ? `상대 타자` : `타자`}: ${c.batter}`}`,
    op = demo.pick != null ? c.options[demo.pick] : null,
    head = (0, S.jsxs)(`div`, {
      className: `top`,
      children: [(0, S.jsx)(`h3`, { children: `${bbDemoName(demo.ci)} · ${c.title}` }), (0, S.jsx)(`button`, { className: `list`, onClick: onList, children: `☰ 목록` })],
    });
  // 플레이 재생 중: 고른 작전만 크게
  if (demo.phase === `play`)
    return (0, S.jsxs)(`div`, {
      ref,
      className: `bb-demo`,
      children: [head, (0, S.jsx)(`div`, { className: `ask`, children: `▶ ${op.label}` }), (0, S.jsx)(`div`, { className: `sit`, children: `경기장에서 결과를 지켜보세요…` })],
    });
  return demo.phase === `ask`
    ? (0, S.jsxs)(`div`, {
        ref,
        className: `bb-demo`,
        children: [
          head,
          (0, S.jsx)(`div`, { className: `sit`, children: sit }),
          c.rule && (0, S.jsx)(`div`, { className: `rule`, children: c.rule }),
          (0, S.jsx)(`div`, { className: `ask`, children: c.ask }),
          (0, S.jsx)(`div`, { className: `opts`, children: c.options.map((o, k) => (0, S.jsx)(`button`, { onClick: () => onPick(k), children: `${k + 1}. ${o.label}` }, k)) }),
          (0, S.jsx)(`div`, { className: `note`, children: `※ 발야구라면 '치기'는 '차기'로, 우타·좌타는 오른발·왼발잡이로 생각하세요.` }),
        ],
      })
    : (0, S.jsxs)(`div`, {
        ref,
        className: `bb-demo`,
        children: [
          head,
          (0, S.jsx)(`div`, { className: `verdict ${op.good ? `good` : `bad`}`, children: op.good ? `👍 좋은 선택!` : `🤔 아쉬운 선택` }),
          (0, S.jsx)(`div`, { className: `explain`, children: op.explain }),
          (0, S.jsxs)(`div`, {
            className: `row`,
            children: [
              (0, S.jsx)(`button`, { onClick: onRetry, children: `↺ 다시 해보기` }),
              (0, S.jsx)(`button`, { onClick: onNext, children: `다음 상황 ▶` }),
            ],
          }),
        ],
      });
}
// 견제 동작·런다운 때 주자 안내: ← 귀루 / → 스타트·진루
function RunnerAlert({ alert, onGo }) {
  if (!alert) return null;
  let next = alert.b === 3 ? `홈` : `${alert.b + 1}루`;
  return (0, S.jsxs)(`div`, {
    className: `bb-pitchprompt bb-runalert`,
    children: [
      (0, S.jsx)(`div`, {
        className: `bb-pitchprompt-title`,
        children: alert.kind === `warn` ? `견제 동작! ${alert.b}루 주자 ← 빨리 귀루` : `런다운! ${alert.b}루 ↔ ${next} · 슬라이딩할 쪽 선택`,
      }),
      (0, S.jsxs)(`div`, {
        className: `bb-pitchprompt-types`,
        children: [
          (0, S.jsx)(`button`, { className: alert.go === `return` ? `on` : ``, onClick: () => onGo(`return`), children: `← ${alert.b}루 귀루` }),
          (0, S.jsx)(`button`, { className: alert.go === `advance` ? `on` : ``, onClick: () => onGo(`advance`), children: alert.kind === `warn` ? `→ 스타트` : `→ ${next}` }),
        ],
      }),
    ],
  });
}
// 수비 투구 선택: 구종 버튼 + 존 주변 클릭으로 도달 지점
function PitchPrompt({ show, sel, defName, onPick, bases, onPickoff, align, onAlign }) {
  return show
    ? (0, S.jsxs)(`div`, {
        className: `bb-pitchprompt`,
        children: [
          (0, S.jsx)(`div`, { className: `bb-pitchprompt-title`, children: `${defName} 투구 · 존 클릭 또는 QWE/ASD/ZXC${sel.zone ? ` ✓` : ``}` }),
          (0, S.jsx)(`div`, {
            className: `bb-pitchprompt-types`,
            children: BB_PITCHES.map(([name], i) =>
              (0, S.jsx)(`button`, { className: sel.type === i + 1 ? `on` : ``, onClick: () => onPick({ type: i + 1 }), children: `${i + 1} ${name}` }, i),
            ),
          }),
          // 2인 대결: 수비 위치
          align &&
            (0, S.jsx)(`div`, {
              className: `bb-pitchprompt-types align`,
              children: Object.keys(BB_ALIGN).map((k) => (0, S.jsx)(`button`, { className: align === k ? `on` : ``, onClick: () => onAlign(k), children: `수비 ${k}` }, k)),
            }),
          bases.some(Boolean) &&
            (0, S.jsx)(`div`, {
              className: `bb-pitchprompt-types pick`,
              children: [1, 2, 3].map((b) => bases[b - 1] && (0, S.jsx)(`button`, { onClick: () => onPickoff(b), children: `⇧${b} ${b}루 견제` }, b)),
            }),
        ],
      })
    : null;
}
// How To Play: 조작·규칙을 한 표로 (게임 화면에는 설명 글을 두지 않음)
var HOWTO = [
  [`타격`, `Space · 화면 터치`],
  [`투구 시작`, `Enter 한 번 → 이후 자동 (일시정지 Esc)`],
  [`타격 작전`, `1 밀어치기 · 2 당겨치기 · 3 번트 · 4 다운스윙 · 5 어퍼스윙`],
  [`투구 구종`, `1 직구 · 2 슬라이더 · 3 커브 · 4 체인지업`],
  [`투구 코스`, `존 클릭 · 또는 QWE/ASD/ZXC (⇧ 볼)`],
  [`주루`, `→ 진루 · ← 귀루 · 주자를 눌러 도루·리드 폭`],
  [`견제 동작`, `← 빨리 귀루하면 세이프 · 스타트하면 런다운`],
  [`견제`, `수비 때 견제 버튼 · ⇧1–3`],
  [`일시정지`, `Esc`],
  [`5초 룰`, `타구 5초 뒤 주루 지시 마감, 판정 확정`],
  [`연장`, `동점이면 무사 2루 승부치기`],
  [`콜드`, `5회 15점 · 7회 10점 차 (5·9이닝)`],
  [`TGA`, `9회말 2·4·5점 차(EASY·SOSO·HARD) — 역전`],
  [`DEMO`, `상황 카드로 기초 규칙·공격·수비 전략 배우기`],
  [`사사구`, `볼넷·몸에 맞는 공 → 타자 1루`],
  [`폭투·포일`, `공이 뒤로 빠지면 주자 한 베이스씩`],
  [`낫아웃`, `3스트라이크를 포수가 놓치면 타자가 1루로 (1루가 비었거나 2아웃)`],
];
function HowTo() {
  return (0, S.jsx)(`div`, {
    className: `bb-howto`,
    children: HOWTO.map(([k, v]) => (0, S.jsxs)(`div`, { children: [(0, S.jsx)(`b`, { children: k }), (0, S.jsx)(`span`, { children: v })] }, k)),
  });
}
var re = {
  1: { bottom: 135, left: `calc(67% + 30px)`, label: `1루→2루` },
  2: { bottom: 260, left: `50%`, label: `2루→3루` },
  3: { bottom: 135, left: `calc(33% - 110px)`, label: `3루→홈` },
};
// 주자 다이아몬드 (타격 화면 왼쪽): 베이스 위 주자를 누르면 도루 · 리드 넓게 · 리드 짧게
var BB_LEAD_TXT = { "-1": `짧게`, 0: `보통`, 1: `넓게` };
function RunnerDiamond({ show, bases, leads, canSteal, onSteal, onLead, stealing }) {
  let [open, setOpen] = (0, _.useState)(0);
  if (!show) return null;
  let st = stealing || {},
    sel = open && bases[open - 1] ? open : 0,
    // 다음 루에 주자가 있어도 그 주자가 이미 뛰었으면 더블스틸 가능
    can = (b) => canSteal && bases[b - 1] && st[b] == null && (b === 3 || !bases[b] || st[b + 1] != null);
  return (0, S.jsxs)(`div`, {
    className: `bb-rd`,
    children: [
      (0, S.jsx)(`div`, { className: `bb-rd-title`, children: `주자를 눌러 작전` }),
      (0, S.jsxs)(`div`, {
        className: `bb-rd-field`,
        children: [
          (0, S.jsx)(`i`, { className: `home` }),
          ...[1, 2, 3].map((b) =>
            (0, S.jsx)(
              `button`,
              {
                className: `base b${b}${bases[b - 1] ? ` on` : ``}${sel === b ? ` sel` : ``}${can(b) ? ` go` : ``}`,
                disabled: !bases[b - 1],
                onClick: () => setOpen(sel === b ? 0 : b),
                "aria-label": `${b}루 주자`,
                children: bases[b - 1] ? `🏃${leads[b - 1] > 0 ? `»` : leads[b - 1] < 0 ? `«` : ``}` : ``,
              },
              b,
            ),
          ),
        ],
      }),
      sel
        ? (0, S.jsxs)(`div`, {
            className: `bb-rd-menu`,
            children: [
              (0, S.jsx)(`b`, { children: `${sel}루 주자 · 리드 ${BB_LEAD_TXT[leads[sel - 1]]}` }),
              (0, S.jsx)(`button`, { className: `steal`, disabled: !can(sel), onClick: () => (onSteal(sel), setOpen(0)), children: sel === 3 ? `🏃 홈스틸` : `🏃 도루 (${sel + 1}루)` }),
              (0, S.jsx)(`button`, { disabled: leads[sel - 1] >= 1, onClick: () => onLead(sel, 1), children: `리드 넓게 (도루↑ 견제 위험↑)` }),
              (0, S.jsx)(`button`, { disabled: leads[sel - 1] <= -1, onClick: () => onLead(sel, -1), children: `리드 짧게 (안전)` }),
            ],
          })
        : null,
    ],
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
}) {
  // 메인 화면으로 가기 전 한 번 더 확인 (실수로 눌러 경기가 사라지지 않도록)
  let [confirm, setConfirm] = (0, _.useState)(!1),
    [help, setHelp] = (0, _.useState)(!1);
  if (((0, _.useEffect)(() => {
    e || (setConfirm(!1), setHelp(!1));
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
        help && (0, S.jsx)(HowTo, {}),
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
        (0, S.jsx)(LineScore, { teams, innings, inning, half, halfRuns, bat }),
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
                          children: [teams[e.team] ? `${teams[e.team].name} ` : ``, e.batter, `번`],
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
        (0, S.jsx)(`button`, { className: `bb-btn bb-btn-home bb-pause-resume`, onClick: () => setHelp(!help), children: `❓ How To Play` }),
      ],
    }),
  });
}
// 타격 작전 (사람 타자): win 타이밍 허용 배율, q 타구 질 보정, lat 방향(+는 당겨치는 쪽)
// 시뮬레이션(타이밍 오차 45ms) 인플레이 타율: 없음 .325 · 밀어 .307(밀어친 방향 60%) · 당겨 .334(홈런 5.8%)
// · 번트 1루 주자 진루 93% · 다운 .298(땅볼 58%, 홈런 거의 없음) · 어퍼 .306(뜬공 58%, 홈런 5.4%, 헛스윙↑)
var BB_PLAN = {
    push: { name: `밀어치기`, win: 0.95, q: -0.03, lat: -7 },
    pull: { name: `당겨치기`, win: 0.95, q: -0.01, lat: 7 },
    bunt: { name: `번트`, win: 1.8, q: 0, lat: 0 },
    down: { name: `다운스윙`, win: 1, q: -0.08, lat: 0 },
    up: { name: `어퍼스윙`, win: 0.8, q: -0.02, lat: 0 },
  },
  BB_PLAN_KEYS = [`push`, `pull`, `bunt`, `down`, `up`],
  // 수비 위치 (2인 대결의 수비 플레이어): [내야 x, 내야 y, 외야 x, 외야 y] 이동(m). x는 1루 쪽이 +
  BB_ALIGN = { 기본: [0, 0, 0, 0], 왼쪽: [-6, 0, -10, 0], 오른쪽: [6, 0, 10, 0], 전진: [0, -5, 0, -12], 후진: [0, 4, 0, 10] };
function bbAlign(name) {
  let [ix, iy, ox, oy] = BB_ALIGN[name] || BB_ALIGN.기본,
    f = {};
  for (let k in BB_FIELD_M) {
    let m = BB_FIELD_M[k],
      inf = k.startsWith(`inf`);
    (inf || k.startsWith(`out`)) && (f[k] = { x: m.x + (inf ? ix : ox), y: m.y + (inf ? iy : oy) });
  }
  return f;
}
// 상황 코칭 한 줄 (EASY): 공격할 때 지금 상황에서 기억할 기본 전략
function bbTip(outs, bases, humanBat) {
  let [b1, b2, b3] = bases;
  if (!humanBat) return b1 || b2 || b3 ? `주자가 있어요: 견제(⇧1~3)로 리드를 줄여 보세요` : `구종과 코스를 섞어 타자의 타이밍을 흔들어요`;
  if (outs === 2) return b1 || b2 || b3 ? `2아웃! 치면 주자는 바로 뛰어요` : `2아웃: 정확히 맞혀 출루부터 해요`;
  if (b3) return `3루 주자: 외야로 멀리 띄우면 희생플라이 (어퍼스윙)`;
  if (b1 && !b2) return `1루 주자: 땅볼이면 꼭 2루로! 번트로 진루시킬 수도 있어요`;
  if (b2) return `2루 주자: 짧은 안타엔 3루에서 멈추는 것도 좋아요`;
  return `수비가 몰린 반대쪽 빈 곳으로 보내 봐요 (밀어치기·당겨치기)`;
}
// TGA 난이도 설명 (경기 시작 전 화면). 규칙 두 줄과 맺음말은 모든 난이도 공통
var TGA_INFO = {
  EASY: [
    `9회말, 2점 뒤진 채로 시작합니다.`,
    `볼 비율이 높아 볼넷을 얻기 쉽습니다.`,
    `공이 들어올 위치와 타격 타이밍을 나타내는 원이 보입니다. 원이 초록일 때 치면 안타가 잘 나옵니다.`,
  ],
  SOSO: [
    `9회말, 4점 뒤진 채로 시작합니다.`,
    `타구가 잘 뻗는 편이며 공이 들어올 위치가 보입니다. 타이밍 원은 없습니다.`,
  ],
  HARD: [
    `9회말, 5점 뒤진 채로 시작합니다.`,
    `공이 빠르고 여러 변화구가 섞여 있어 타격 타이밍을 잡기 더 어렵습니다.`,
    `수비 송구가 빨라 도루가 어렵습니다.`,
  ],
},
  TGA_RULES = [
    `3아웃 전에 역전하면 성공하며, 동점이 되면 연장(승부치기 규정 적용)으로 갑니다.`,
    `점수가 뒤진 채 경기가 끝나면 미션 실패입니다.`,
  ],
  TGA_OUTRO = `경기를 뒤집어, 오늘 경기의 주인공이 되어볼까요?`;
function oe({ visible: e, onSelect: t, initStep }) {
  let [step, setStep] = (0, _.useState)(`mode`),
    [cfg, setCfg] = (0, _.useState)({});
  (0, _.useEffect)(() => {
    e && (setStep(initStep || `mode`), setCfg({}));
  }, [e, initStep]);
  if (!e) return null;
  let btn = (label, onClick, cls = `bb-btn-playball`) => (0, S.jsx)(`button`, { className: `bb-btn ${cls}`, onClick, children: label }, label),
    pick = (k, v) => {
      let c2 = { ...cfg, [k]: v };
      (setCfg(c2), k === `mode` ? setStep(`diff`) : k === `diff` ? setStep(c2.mode === `TGA` ? `tga` : `innings`) : t(c2));
    },
    back = (to) => btn(`◀`, () => setStep(to), `bb-btn-home`),
    body = {
      mode: [
        btn(`⚾ REAL MODE · 실전 경기`, () => setStep(`real`), `bb-btn-swing`),
        btn(`📘 DEMO MODE · 전략 배우기`, () => setStep(`demo`)),
        btn(`❓ How To Play`, () => setStep(`help`), `bb-btn-home`),
      ],
      real: [
        btn(`🔥 Turn The Game Around`, () => pick(`mode`, `TGA`), `bb-btn-swing`),
        btn(`👤 Single Player`, () => pick(`mode`, `1P`)),
        btn(`👥 Double Player`, () => pick(`mode`, `2P`)),
        back(`mode`),
      ],
      // 상황 카드 목록 (수비 전략은 다음에 추가)
      demo: [
        (0, S.jsx)(`div`, { className: `bb-demo-head`, children: `상황을 보고 가장 좋은 작전을 골라 보세요` }, `h`),
        (0, S.jsx)(
          `div`,
          {
            className: `bb-demo-list`,
            children: [`basic`, `atk`, `def`].map((side) =>
              (0, S.jsxs)(
                `div`,
                {
                  className: side === `basic` ? `wide` : ``,
                  children: [
                    (0, S.jsx)(`b`, { children: { basic: `🌱 기초 규칙`, atk: `🏏 공격 전략`, def: `🛡️ 수비 전략` }[side] }),
                    ...BB_DEMO.map((c, i) => ((c.side || `atk`) === side ? btn(`${bbDemoName(i).split(` `)[1]}. ${c.title}`, () => t({ mode: `DEMO`, card: i })) : null)),
                  ],
                },
                side,
              ),
            ),
          },
          `l`,
        ),
        back(`mode`),
      ],
      diff: [
        btn(`🟢 EASY`, () => pick(`diff`, `EASY`)),
        ...(cfg.mode === `TGA` ? [btn(`🟡 SOSO`, () => pick(`diff`, `SOSO`), `bb-btn-swing`)] : []),
        btn(`🔴 HARD`, () => pick(`diff`, `HARD`), `bb-btn-quit`),
        back(`real`),
      ],
      innings: [
        (0, S.jsx)(`div`, { className: `bb-innings-pick`, children: [1, 3, 5, 9].map((n) => btn(`${n}이닝`, () => pick(`innings`, n))) }, `g`),
        back(`diff`),
      ],
      help: [(0, S.jsx)(HowTo, {}, `h`), back(`mode`)],
      tga: [
        (0, S.jsxs)(
          `div`,
          {
            className: `bb-tga-intro`,
            children: [
              (0, S.jsx)(`div`, { className: `bb-tga-intro-title`, children: `🔥 Turn The Game Around · ${cfg.diff}` }),
              (0, S.jsx)(`ul`, { children: [...(TGA_INFO[cfg.diff] || []), ...TGA_RULES].map((li) => (0, S.jsx)(`li`, { children: li }, li)) }),
              (0, S.jsx)(`p`, { className: `bb-tga-intro-outro`, children: TGA_OUTRO }),
            ],
          },
          `i`,
        ),
        btn(`▶ 경기 시작`, () => t(cfg)),
        back(`diff`),
      ],
    }[step];
  return (0, S.jsx)(`div`, {
    className: `bb-pause-overlay`,
    role: `dialog`,
    "aria-modal": `true`,
    "aria-label": `메인 화면`,
    children: (0, S.jsxs)(`div`, {
      className: `bb-pause-card bb-menu`,
      children: [(0, S.jsx)(`div`, { className: `bb-main-title`, children: `⚾ 베이스볼 전략 교실` }), ...body],
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
<rect x="120" y="182" width="120" height="13" fill="#c0392b"/><text x="180" y="192.5" fill="#fff">전략 교실</text>
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
})();
function BatView({
  bvRef: e,
  visible: t,
  pitchInfo: n,
  feedback: r,
  onSwing: i,
  batterNumber: num,
  batterHand: hand,
  aim,
  onAim,
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
    className: `bv${t ? ` on` : ``}${aim ? ` aim` : ``}`,
    onPointerDown: (ev) => {
      if (ev.target.closest(`button`)) return;
      if (!aim) return i();
      let r = ev.currentTarget.getBoundingClientRect(),
        k = r.width / 850,
        x = (ev.clientX - r.left) / k,
        yy = (ev.clientY - r.top) / k,
        c = (v) => Math.max(-2, Math.min(2, v));
      onAim({ zone: [c((x - BB_Z.cx) / (BB_Z.w / 2)), c((BB_Z.cy - yy) / (BB_Z.h / 2))] });
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
              }),
              (0, S.jsx)(BatView, {
                bvRef: e.batViewRef,
                visible: t.fieldView === `catcher-view`,
                pitchInfo: t.pitchInfo,
                batterNumber: t.batterNumber,
                batterHand: t.batterHand,
                feedback: t.swingFeedback,
                onSwing: n.swing,
                aim: t.awaitPitch && !t.paused,
                onAim: n.pickPitch,
              }),
              (0, S.jsx)(RunnerAlert, { alert: t.paused ? null : t.runAlert, onGo: n.runnerGo }),
              t.tip && (0, S.jsx)(`div`, { className: `bb-tip`, children: `💡 ${t.tip}` }),
              !t.demo &&
                t.difficulty &&
                (0, S.jsx)(GameButtons, {
                  canPlay: !t.autoPlay && !t.playballDisabled && !t.gameOver && !t.paused,
                  paused: t.paused,
                  gameOver: t.gameOver,
                  swingDisabled: t.swingDisabled || t.gameOver,
                  showPlan: t.humanBat && !t.gameOver, // 2인 대결: 상대가 투구를 고르는 동안에도 마우스로 (숫자 키는 투수 몫)
                  plan: t.batPlan,
                  onPlan: n.setPlan,
                  onPlayball: n.playball,
                  onPause: n.pauseGame,
                  onSwing: n.swing,
                }),
              (0, S.jsx)(PitchPrompt, {
                show: t.awaitPitch && !t.paused && !t.gameOver,
                sel: t.pitchSel,
                defName: t.teams[1 - t.bat]?.name,
                onPick: n.pickPitch,
                bases: t.baseStatus,
                onPickoff: n.pickBase,
                align: t.mode === `2P` ? t.align || `기본` : null,
                onAlign: n.setAlign,
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
              (0, S.jsx)(RunnerDiamond, {
                show: t.fieldView === `catcher-view` && t.humanBat && !t.paused && !t.gameOver && !t.demo && t.baseStatus.some(Boolean),
                bases: t.baseStatus,
                leads: t.leads,
                canSteal: t.canManualRunner && !t.gameOver,
                onSteal: n.advanceRunner,
                onLead: n.setLead,
                stealing: t.steal,
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
      t.demo
        ? (0, S.jsx)(DemoPanel, {
            demo: t.demo,
            onPick: n.demoPick,
            onRetry: () => n.startDemo(t.demo.ci, t.demo.vi),
            onNext: () => n.startDemo((t.demo.ci + 1) % BB_DEMO.length),
            onList: n.demoList,
          })
        : null,
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
      }),
      (0, S.jsx)(oe, {
        visible: !t.difficulty && !t.gameOver,
        onSelect: n.setDifficulty,
        initStep: t.menuStep,
      }),
    ],
  });
}
(0, g.createRoot)(document.getElementById(`root`)).render(
  (0, S.jsx)(_.StrictMode, { children: (0, S.jsx)(ce, {}) }),
);
