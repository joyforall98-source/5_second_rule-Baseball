// ── 타구·수비·주루 시뮬레이션 (화면과 무관한 순수 계산) ──
// 좌표는 미터. 홈플레이트 (0,0), +y = 중견수 방향, +x = 1루(우측) 방향.
// 타구 각도 phi: 0 = 중앙, +45 = 우측 파울라인, -45 = 좌측 파울라인 (|phi| > 45 는 파울).
//
// 플레이는 "실시간"으로 진행됩니다: BB_SIM.start()가 만든 플레이 객체를 step(dt)으로 조금씩
// 진행하고, 그사이 command()로 주자에게 진루/귀루를 지시할 수 있습니다.
// 수비는 매 순간 공을 가진 선수가 가장 잡기 좋은 주자에게 송구합니다.
var BB_K = 4.4, // 필드 화면 1m = 4.4px (중앙 펜스 120m가 필드 위쪽 끝에 맞도록)
  BB_LEG = 27.43, // 베이스 간 거리 (90ft)
  BB_BASES = [
    { x: 0, y: 0 },
    { x: 19.4, y: 19.4 },
    { x: 0, y: 38.8 },
    { x: -19.4, y: 19.4 },
    { x: 0, y: 0 },
  ],
  BB_FIELD_M = {
    pitcher: { x: 0, y: 18.4 },
    "inf-1b": { x: 20, y: 28 },
    "inf-2b": { x: 10, y: 42 },
    "inf-ss": { x: -10, y: 42 },
    "inf-3b": { x: -20, y: 27 },
    "out-lf": { x: -46, y: 76 },
    "out-cf": { x: 0, y: 90 },
    "out-rf": { x: 46, y: 76 },
    catcher: { x: 0, y: -1.2 },
  },
  BB_MOUND = { x: 0, y: 18.4 },
  BB_POS = {
    pitcher: `투수`,
    "inf-1b": `1루수`,
    "inf-2b": `2루수`,
    "inf-ss": `유격수`,
    "inf-3b": `3루수`,
    "out-lf": `좌익수`,
    "out-cf": `중견수`,
    "out-rf": `우익수`,
    catcher: `포수`,
  },
  bbOut = (why) => `OUT!<br><span class="bb-out-reason">(${why})</span>`,
  // 미터 → 필드 화면 위치 (bottom px, left %)
  bbPx = (m) => ({ bottom: 20 + m.y * BB_K, left: 50 + (m.x * BB_K) / 8.5 }),
  bbFromPx = (p) => ({ x: ((p.left - 50) * 8.5) / BB_K, y: (p.bottom - 20) / BB_K }),
  // 펜스 거리: 파울폴 98m, 좌·우중간 약 114m, 중앙 120m
  bbFence = (phi) => 98 + 22 * Math.cos((Math.min(45, Math.abs(phi)) * Math.PI) / 90),
  BB_WALL_H = 3.6, // 펜스 높이(m). 이 높이 이상으로 넘어가야 홈런
  BB_RELAY_MARGIN = 0.35; // 외야 → 홈·3루 직접 송구에 필요한 여유(초). 이보다 빠듯하면 내야로 중계

var BB_SIM = (() => {
  let R = Math.random,
    rnd = (a, b) => a + R() * (b - a),
    clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }),
    at = (phi, s) => ({
      x: Math.sin((phi * Math.PI) / 180) * s,
      y: Math.cos((phi * Math.PI) / 180) * s,
    }),
    IF = [`inf-1b`, `inf-2b`, `inf-ss`, `inf-3b`, `pitcher`], // 투수도 내야수처럼 수비
    OF = [`out-lf`, `out-cf`, `out-rf`],
    HIT = [``, `안타`, `2루타`, `3루타`, `그라운드 홈런`],
    HR = [``, `솔로 홈런`, `투런 홈런`, `스리런 홈런`, `만루 홈런`],
    KIND_OUT = { fly: `뜬공`, line: `직선타`, pop: `뜬공`, ground: `땅볼` },
    // 난이도별 수비 능력. EASY는 송구가 느리고(21m/s) 수비 반응이 늦음. 주자 속도(run)는 같음
    cfg = (diff) =>
      diff === `HARD`
        ? { thr: 29, ofSpd: 8.0, ifSpd: 6.4, react: 0.3, run: 7.3, flyErr: 0.015, gbErr: 0.02, transfer: 0.5, pop: 0.75 }
        : { thr: 21, ofSpd: 7.4, ifSpd: 6.0, react: 0.4, run: 7.3, flyErr: 0.03, gbErr: 0.04, transfer: 0.65, pop: 0.45 }, // pop: 도루 때 포수 송구 준비(+0~0.6초)
    // 베이스 경로 위치 s(0=홈, 1=1루 … 4=홈) → 좌표
    basePos = (s) => {
      s = clamp(s, 0, 4);
      let i = Math.min(3, Math.floor(s));
      return lerp(BB_BASES[i], BB_BASES[i + 1], s - i);
    };

  // 번트: 내야 앞에 느리게 굴러가는 땅볼 (foul이면 파울 지역으로)
  // phi: 방향(없으면 무작위), high: 높은 공·볼에 댔는지 (주면 가끔 뜨는 번트: 높으면 30%, 아니면 6%)
  function bunt(foul, phi, high) {
    if (high != null && !foul && R() < (high ? 0.3 : 0.06)) return { kind: `pop`, bunt: !0, phi: phi ?? rnd(-30, 30), D: rnd(4, 14), T: rnd(1.4, 2.2) };
    if (phi != null && !foul) return { kind: `ground`, bunt: !0, phi, v0: rnd(9, 13) };
    return foul ? { kind: `ground`, foul: !0, bunt: !0, phi: (R() < 0.5 ? -1 : 1) * rnd(48, 70), v0: rnd(8, 14) } : { kind: `ground`, bunt: !0, phi: rnd(-38, 38), v0: rnd(9, 13) };
  }
  // 스윙 결과(q: 타구 질 0~1, phi: 방향, foul, plan: 작전) → 타구
  // plan: down(다운스윙) 땅볼↑ 뜬공↓ / up(어퍼스윙) 뜬공·장타↑ 땅볼↓ 내야 뜬공↑
  function batted(q, phi, foul, plan) {
    if (foul) {
      let p = (phi < 0 ? -1 : 1) * rnd(48, 78);
      if (q < 0.45) return { kind: `ground`, foul: !0, phi: p, v0: rnd(15, 30) };
      let D = rnd(15, 70);
      return { kind: `fly`, foul: !0, phi: p, D, T: 1.6 + D / 26 + rnd(0, 1) };
    }
    // 발사각(타구 종류)은 실제 비율에 가깝게: 땅볼 40% · 직선타 22% · 뜬공 30% · 높이 뜬 내야 뜬공(pop) 8%
    // 타이밍(q)은 타구 속도/비거리를 정함. 빗맞으면 땅볼·내야 뜬공 비중이 커짐
    let up = plan === `up`,
      down = plan === `down`,
      wFly = up ? 0.45 : down ? 0.18 : 0.3,
      wPop = (0.06 + 0.12 * (1 - q)) * (up ? 1.6 : down ? 0.85 : 1),
      wGround = (0.4 + 0.15 * (1 - q)) * (up ? 0.5 : down ? 1.5 : 1),
      r = R() * (wGround + 0.22 + wFly + wPop);
    if ((r -= wGround) < 0) return { kind: `ground`, phi, v0: 18 + 26 * q + rnd(-3, 3) };
    if ((r -= 0.22) < 0) {
      let D = Math.max(25, 30 + 70 * q + rnd(-10, 10));
      return { kind: `line`, phi, D, T: 0.25 + D / 45 };
    }
    if ((r -= wFly) < 0) {
      let D = Math.max(35, 43 + 84 * q ** 1.4 + rnd(-16, 8) + (up ? 4 : 0));
      return { kind: `fly`, phi, D, T: 0.9 + D / 27 };
    }
    return { kind: `pop`, phi, D: rnd(8, 45), T: rnd(3.6, 4.6) };
  }

  // 트랙 [[t, x, y, h], ...] 의 시각 t 위치 (선형 보간)
  function sample(tr, t) {
    if (!tr || !tr.length) return null;
    if (t <= tr[0][0]) return tr[0];
    for (let i = 1; i < tr.length; i++)
      if (t <= tr[i][0]) {
        let a = tr[i - 1],
          b = tr[i],
          f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return [t, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * f];
      }
    return tr[tr.length - 1];
  }

  // ────────────────────────────────────────────────────────────────
  // 플레이 시작. st = { bases:[1루,2루,3루], outs, diff }
  // DEMO 상황용(없으면 기존과 같음): fielders 수비 위치 덮어쓰기, demo 실책·무작위 없음,
  // batRun 타자 주력(m/s), orders [{ t, id, base }] 정해진 시각에 주자 지시,
  // miss 뜬공·직선타를 수비수가 뒤로 빠뜨림(backup이면 다른 수비수가 받아 줌, 아니면 놓친 수비수가 쫓아감),
  // firstThrow { base, carry } 공을 잡은 수비수의 첫 송구(carry면 공을 들고 그 베이스까지 뜀),
  // noChase 파울 뜬공을 아무도 쫓지 않음
  function start(bb, st) {
    let FM = st.fielders ? { ...BB_FIELD_M, ...st.fielders } : BB_FIELD_M,
      // 번트 시프트: 타자가 번트 자세를 보이면 투구와 함께 1루수·3루수가 앞으로 (DEMO는 그대로)
      shift = bb.bunt && !st.demo,
      c = cfg(st.diff),
      bases = st.bases,
      P = {
        t: 0,
        done: !1,
        bb,
        st,
        c,
        outs: [], // { id, base, t, force, by }
        runs: [], // { id, t }
        error: !1,
        wallBall: !1,
        caught: null, // { key, p, t }
        homeRun: !1,
        foul: !!bb.foul,
        foulOut: !1,
        distance: null,
        throws: 0,
        possessed: !1,
        landed: !1,
        landT: 1e9,
        fixedEnd: null, // 홈런·파울은 정해진 시각에 끝남
        f: {}, // 수비수 { x, y, goal, startAt, spd }
        r: [], // 주자 (앞 주자부터 순서대로, 마지막이 타자)
        ball: { mode: `track`, track: [], x: 0, y: 0, h: 1 },
        holder: null,
        holderBase: null,
        readyAt: 0,
        oi: 0, // 처리한 orders 수
        cover: { 1: `inf-1b`, 2: `inf-ss`, 3: `inf-3b`, 4: `catcher` },
        ev: null,
      };
    // 2루수는 1루 커버, 유격수는 2루 커버를 위해 투구와 함께 그쪽으로
    shift && (FM = { ...FM, "inf-1b": { x: 14, y: 19 }, "inf-3b": { x: -14, y: 18 }, "inf-2b": { x: 14, y: 34 }, "inf-ss": { x: -6, y: 39 } });
    for (let k in FM) {
      let m = FM[k];
      P.f[k] = {
        x: m.x,
        y: m.y,
        goal: null,
        // 투수는 투구 동작 직후라 반응이 조금 늦음. 번트 시프트로 달려 나오던 1루수·3루수는 거의 바로
        startAt: shift && k.startsWith(`inf`) ? 0.1 : c.react + (k === `pitcher` ? 0.2 : 0),
        spd: k.startsWith(`out`) ? c.ofSpd : c.ifSpd,
      };
    }
    let mk = (id, from) => ({
      id,
      from,
      touched: from, // 마지막으로 정상적으로 밟은 베이스
      s: from, // 베이스 경로 위치
      target: from,
      state: `safe`, // safe | run | wait | out | scored
      delay: 0,
      manual: !1, // 플레이어가 지시하면 AI가 더 이상 바꾸지 않음
      forced: !1,
      tagIntent: !1,
      retouch: !1,
      margin: st.demo ? 0.3 : rnd(0, 0.8), // 주자 성향: 작을수록 과감한 주루
      holdS: from,
      outT: null,
      scoredT: null,
    });
    for (let b of [3, 2, 1]) bases[b - 1] && P.r.push(mk(`runner-${b}`, b));
    // 리드(st.leads[루-1] = -1 짧게 · 0 보통 · 1 넓게): 넓게 잡은 주자는 조금 앞에서 출발
    for (let r of P.r) r.s += Math.max(0, (st.leads || [])[r.from - 1] || 0) * 0.06;
    // 도루 스타트한 주자 (st.steal = { 루: 스타트 뒤 뛴 시간(초) }): 리드(1·3루 2.7m, 2루는 수비가 비어 있어 5.5m,
    // 넓게 +1.6m, 짧게 -1.6m)에 뛴 만큼 더 앞에서
    for (let r of P.r) {
      let run = (st.steal || {})[r.from];
      run != null &&
        ((r.stealing = !0),
        (r.s = Math.min(r.from + 0.92, r.from + (r.from === 2 ? 0.2 : 0.1) + ((st.leads || [])[r.from - 1] || 0) * 0.06 + (Math.max(0, run) * c.run * 1.08) / BB_LEG)),
        (r.state = `run`),
        (r.target = r.from + 1));
    }
    let bat = mk(`runner-t`, 0);
    st.batRun && (bat.run = st.batRun);
    (P.r.push(bat), (P.bat = bat));

    let spd = (k) => P.f[k].spd,
      need = (k, p, slack) => P.f[k].startAt + Math.max(0, dist(FM[k], p) - slack) / spd(k),
      track = P.ball.track,
      arc = (from, to, t0, t1, H, h0 = 1, h1 = 0) => {
        let n = Math.max(2, Math.ceil((t1 - t0) / 0.08));
        for (let i = 0; i <= n; i++) {
          let u = i / n,
            p = lerp(from, to, u);
          track.push([t0 + (t1 - t0) * u, p.x, p.y, h0 * (1 - u) + h1 * u + 4 * H * u * (1 - u)]);
        }
      },
      roll = (fn, t0, t1) => {
        for (let t = t0; t < t1; t += 0.08) {
          let p = fn(t);
          track.push([t, p.x, p.y, 0]);
        }
        let p = fn(t1);
        track.push([t1, p.x, p.y, 0]);
      },
      intercept = (keys, fn, t0, t1, slack) => {
        for (let t = t0; t <= t1; t += 0.05) {
          let p = fn(t),
            best = null;
          for (let k of keys) {
            let n = need(k, p, slack);
            n <= t && (!best || n < best.n) && (best = { k, n });
          }
          if (best) return { key: best.k, t, p, n: best.n };
        }
        return null;
      },
      interceptOr = (keys, fn, t0, t1, slack) =>
        intercept(keys, fn, t0, t1, slack) ||
        (() => {
          let p = fn(t1),
            k = keys.reduce((a, b) => (dist(FM[a], p) < dist(FM[b], p) ? a : b));
          return { key: k, t: Math.max(t1, need(k, p, 1)), p, n: need(k, p, 1) };
        })();

    // ── 도루(bb.steal: 포수가 공을 받은 순간부터) · 견제 런다운(bb.pick = 루: 투수가 스타트한 그 주자를 잡으려는 순간부터) ──
    // 타자는 뛰지 않음. 주자가 있는 베이스와 그 다음 베이스의 커버는 투구 동안(0.5초) 이미 움직이기 시작함
    if (bb.steal || bb.pick) {
      (P.r.pop(), (P.runnerOnly = !0), (P.cover = { 1: `inf-1b`, 2: `inf-ss`, 3: `inf-3b`, 4: `catcher` }));
      let k0 = bb.steal ? `catcher` : `pitcher`;
      for (let b = 1; b <= 4; b++) {
        let f = P.f[P.cover[b]],
          B = BB_BASES[b],
          d = dist(f, B),
          m = Math.min(d, f.spd * 0.5);
        if (P.cover[b] === k0 || !(bases[b - 1] || bases[b - 2] || b === 4)) continue;
        ((f.startAt = 0), (f.goal = { ...B }), d > 0 && ((f.x += ((B.x - f.x) / d) * m), (f.y += ((B.y - f.y) / d) * m)));
      }
      if (bb.pick) {
        let r = P.r.find((x) => x.from === bb.pick);
        r && ((r.s += 0.12), (r.state = `run`), (r.target = r.from + 1)); // 이미 다음 루로 스타트
      }
      // 포수가 받고 나서 던지기까지(EASY 0.45~1.05초, HARD 0.75~1.35초. HARD는 송구가 빨라 전체로는 더 빠름), 투수는 바로 돌아서 던짐
      P.ev = { key: k0, t: 0, p: { x: P.f[k0].x, y: P.f[k0].y }, ready: bb.steal ? c.pop + rnd(0, 0.6) : 0.35 };
      return wrap(P);
    }

    // ── 파울 ──
    if (bb.foul) {
      if (bb.kind === `ground`) {
        let L = at(bb.phi, Math.min(35, bb.v0 * 1.2));
        return (roll((t) => lerp({ x: 0, y: 0 }, L, t / 1.2), 0, 1.2), (P.fixedEnd = 1.6), wrap(P));
      }
      let L = at(bb.phi, bb.D),
        H = (9.8 * bb.T ** 2) / 8,
        lateral = bb.D * Math.sin(((Math.abs(bb.phi) - 45) * Math.PI) / 180),
        best = null;
      if (lateral < 16 && bb.D < 75 && !st.noChase)
        for (let k of [`catcher`, `inf-1b`, `inf-3b`, `pitcher`, `out-lf`, `out-rf`]) {
          let n = need(k, L, 1.5);
          n <= bb.T + 0.1 && (!best || n < best.n) && (best = { k, n });
        }
      if (best && (st.demo || R() > c.flyErr)) {
        (arc({ x: 0, y: 0 }, L, 0, bb.T, H, 1, 2), (P.f[best.k].goal = L), (P.foulOut = best.k));
        return ((P.fixedEnd = bb.T + 0.8), wrap(P));
      }
      return (arc({ x: 0, y: 0 }, L, 0, bb.T, H), (P.fixedEnd = Math.min(bb.T, 2.5) + 0.4), wrap(P));
    }

    // ── 페어 타구: 누가 언제 어디서 공을 잡는지는 주자와 무관하게 먼저 계산 ──
    let fence = bbFence(bb.phi),
      ev = null;
    if (bb.kind === `ground`) {
      let s = (t) => (bb.bunt ? bb.v0 * 1.3 * (1 - Math.exp(-t / 1.1)) : Math.min(fence - 1.5, bb.v0 * 4 * (1 - Math.exp(-t / 4)))),
        g = (t) => at(bb.phi, s(t)),
        tPast = 0.15;
      while (s(tPast) < 50 && tPast < 6) tPast += 0.05;
      let f = intercept(bb.bunt ? [...IF, `catcher`] : IF, g, 0.15, tPast, 1.0);
      if (f) {
        let err = !st.demo && R() < c.gbErr;
        ev = { key: f.key, t: f.t, p: f.p, infield: !0, error: err, ready: f.t + c.transfer + (err ? 1.4 : 0) };
      } else {
        let o = interceptOr(OF, g, tPast, 10, 1.0);
        ev = { key: o.key, t: o.t, p: o.p, ready: o.t + c.transfer + 0.15 };
      }
      (roll(g, 0, ev.t), (P.distance = Math.round(dist(ev.p, { x: 0, y: 0 }))));
    } else {
      let L = at(bb.phi, bb.D),
        H = (9.8 * bb.T ** 2) / 8;
      P.distance = Math.round(bb.D);
      if (bb.kind !== `pop` && bb.D >= fence) {
        let f = fence / bb.D,
          hWall = 1 - f + 4 * H * f * (1 - f);
        if (hWall >= BB_WALL_H) {
          // 홈런: 모든 주자가 홈까지 (수비 없음)
          (arc({ x: 0, y: 0 }, L, 0, bb.T, H), (P.homeRun = !0), (P.fixedEnd = 1e9)); // 끝은 모든 주자 홈인 때
          for (let r of P.r) ((r.state = `run`), (r.target = 4), (r.delay = 0.3), (r.manual = !0), (r.trot = !0));
          return wrap(P);
        }
        // 펜스 직격: 맞고 튀어나온 공을 외야수가 처리
        let tw = bb.T * f,
          W = at(bb.phi, fence - 0.5),
          rest = (t) => at(bb.phi, fence - 0.5 - 6 * (1 - Math.exp(-(t - tw) / 0.4)));
        arc({ x: 0, y: 0 }, W, 0, tw, H, 1, hWall);
        let o = interceptOr(OF, (t) => (t < tw ? W : rest(t)), tw, tw + 8, 1.0);
        (roll(rest, tw, o.t), (P.wallBall = !0), (P.landT = tw));
        ev = { key: o.key, t: o.t, p: o.p, ready: o.t + c.transfer + 0.15 };
      } else {
        // 높이 뜬 내야 뜬공은 투수 대신 야수·포수가 잡음
        // 뜬 번트는 낮고 짧아 투수·포수도 잡음
        let keys = bb.bunt ? [...IF, `catcher`] : bb.kind === `pop` ? [...IF.filter((k) => k !== `pitcher`), `catcher`, ...OF] : [...OF, ...IF],
          slack = bb.kind === `line` ? 1.0 : 1.6,
          best = null;
        for (let k of keys) {
          let n = need(k, L, slack) + (bb.kind === `line` ? 0.2 : 0); // 직선타는 첫 판단이 늦음
          n <= bb.T + (bb.kind === `line` ? 0 : 0.1) && (!best || n < best.n) && (best = { k, n });
        }
        if (best && !st.miss && (st.demo || R() > c.flyErr)) {
          arc({ x: 0, y: 0 }, L, 0, bb.T, H, 1, 2);
          ev = { key: best.k, t: bb.T, p: L, catch: !0, ready: bb.T + c.transfer + 0.1 };
        } else {
          let err = !!best,
            miss = err && st.miss, // 뒤로 빠뜨려 공이 굴러감
            pick = (a, b) => (st.demo ? (a + b) / 2 : rnd(a, b)), // DEMO는 가운데 값으로 고정
            rl = miss ? 30 : bb.kind === `line` ? pick(12, 28) : bb.kind === `pop` ? pick(1, 4) : pick(5, 14),
            end = Math.min(bb.D + rl, fence - 1.5),
            rest = (t) => at(bb.phi, bb.D + (end - bb.D) * (1 - Math.exp(-(t - bb.T) / 0.6)));
          arc({ x: 0, y: 0 }, L, 0, bb.T, H);
          // 뒤로 빠뜨렸을 때: 백업이 있으면 다른 수비수가 받고, 없으면 놓친 수비수가 몸을 돌려(0.8초) 쫓아감
          let chase = () => {
              let t = bb.T;
              while (t < bb.T + 12 && bb.T + 0.8 + Math.max(0, dist(L, rest(t)) - 1) / spd(best.k) > t) t += 0.05;
              return { key: best.k, t, p: rest(t) };
            },
            o =
              err && !miss
                ? { key: best.k, t: bb.T + 0.9, p: L }
                : miss && !st.backup
                  ? chase()
                  : interceptOr([...OF, ...IF].filter((k) => !miss || k !== best.k), (t) => (t < bb.T ? L : rest(t)), bb.T, bb.T + 12, 1.0);
          (roll(err && !miss ? () => L : rest, bb.T, o.t), (P.landT = bb.T));
          ev = { key: o.key, t: o.t, p: o.p, error: err, errBy: err ? best.k : null, missP: L, ready: o.t + c.transfer + 0.15 };
        }
      }
      ev.catch && (P.landT = bb.T);
    }
    P.ev = ev;

    // ── 수비 배치: 처리할 선수는 공으로, 나머지는 베이스 커버 ──
    P.f[ev.key].goal = ev.p;
    let infieldPlay = bb.kind === `ground` && !!ev.infield;
    ((P.cover[1] = ev.key === `inf-1b` ? `pitcher` : `inf-1b`), // 1루수가 공을 잡으면 투수가 1루 커버
      (P.cover[2] = ev.key === `inf-ss` || ev.key === `inf-3b` || (!infieldPlay && bb.phi < 0) ? `inf-2b` : `inf-ss`),
      ev.key === P.cover[2] && (P.cover[2] = P.cover[2] === `inf-ss` ? `inf-2b` : `inf-ss`),
      (P.cover[3] = ev.key === `inf-3b` ? (P.cover[2] === `inf-ss` ? `pitcher` : `inf-ss`) : `inf-3b`),
      (P.cover[4] = ev.key === `catcher` ? `pitcher` : `catcher`));
    // 번트 시프트 커버: 1루는 2루수, 2루는 유격수, 3루수가 번트를 잡으면 3루는 투수
    shift && ((P.cover[1] = `inf-2b`), (P.cover[2] = `inf-ss`), ev.key === `inf-3b` && (P.cover[3] = `pitcher`));
    for (let b = 1; b <= 4; b++) {
      let k = P.cover[b];
      k !== ev.key && (P.f[k].goal = { ...BB_BASES[b] });
    }
    for (let k of OF)
      if (k !== ev.key) {
        let f = P.f[k];
        f.goal = lerp(f, ev.p, 0.3); // 다른 외야수는 백업
      }
    ev.errBy && ev.errBy !== ev.key && (P.f[ev.errBy].goal = { ...ev.missP });
    // 외야로 간 타구: 2루를 맡지 않은 유격수·2루수가 중계하러 외야수와 2루 사이로 나감 (DEMO는 그대로)
    !st.demo && OF.includes(ev.key) && (P.f[P.cover[2] === `inf-ss` ? `inf-2b` : `inf-ss`].goal = lerp(BB_BASES[2], ev.p, 0.35));
    // 투수 1루 커버: 바로 출발해 1루 앞 파울라인(4m 전)을 거쳐 선을 따라 베이스로 (DEMO는 그대로)
    !st.demo && P.cover[1] === `pitcher` && ((P.f.pitcher.startAt = c.react), (P.f.pitcher.via = { x: 16.6, y: 16.6 }));

    // ── 주자 출발 ──
    let two = st.outs === 2;
    ((bat.state = `run`), (bat.target = 1), (bat.delay = 0.55), (bat.forced = !0));
    for (let r of P.r) {
      if (r === bat) continue;
      r.forced = r.from === 1 ? !0 : r.from === 2 ? bases[0] : bases[0] && bases[1];
      if (r.stealing) continue; // 도루 스타트한 주자는 그대로 달림 (히트 앤드 런)
      // 공이 맞을 때 주자는 리드한 자리에서 출발: 1·3루 0.4m, 2루 1.1m (EASY 인플레이 타율 .33~.34에 맞춤).
      // 번트는 대는 순간 스타트하므로 2.7m · 5.5m (넓게·짧게 ±1.6m. DEMO는 그대로)
      st.demo || (r.s = r.from + (bb.bunt ? (r.from === 2 ? 0.2 : 0.1) : r.from === 2 ? 0.04 : 0.015) + ((st.leads || [])[r.from - 1] || 0) * 0.06);
      if (two) {
        // 2아웃: 타격과 동시에 출발
        ((r.state = `run`), (r.delay = 0.1), (r.s = st.demo ? r.from + 0.06 : r.s), (r.target = r.from + 1));
      } else if (bb.kind === `ground`) {
        if (r.forced) ((r.state = `run`), (r.delay = 0.1), (r.target = r.from + 1));
        else if (r.from === 2 && bb.phi > 8) ((r.state = `run`), (r.delay = 0.1), (r.target = 3));
        else if (r.from === 3 && (ev.key === `inf-1b` || ev.key === `inf-2b`)) ((r.state = `run`), (r.delay = 0.1), (r.target = 4));
        else r.s > r.from && ((r.state = `run`), (r.delay = 0.1), (r.target = r.from)); // 안 뛰는 주자는 리드에서 베이스로 돌아감
      } else {
        // 뜬공·직선타: 리드한 채로 타구를 지켜봄
        ((r.state = `wait`),
          (r.holdS = r.from + (bb.kind === `pop` ? 0.1 : bb.kind === `line` ? 0.06 : clamp(0.12 + (bb.D || 0) / 400, 0.12, 0.42))));
      }
    }
    return wrap(P);
  }

  // ────────────────────────────────────────────────────────────────
  // 플레이 객체에 진행/명령/결과 함수 부착
  function wrap(P) {
    let c = P.c,
      bat = P.bat,
      live = (r) => r.state !== `out` && r.state !== `scored`,
      speed = (r) => (r.trot ? 6 : (r.run || c.run) * (r.touched >= 1 || r.from > 0 ? 1.08 : 1)) / BB_LEG, // 베이스/초
      thrT = (p, k) => {
        let d = dist(p, BB_BASES[k]);
        return d / c.thr + (d > 62 ? 0.45 : 0); // 62m 넘으면 중계
      },
      // 지금부터 공이 베이스 k에 도착하기까지 걸리는 시간 (주자 AI의 판단 근거)
      ballTimeTo = (k) => {
        let b = P.ball;
        if (b.mode === `track`) return Math.max(P.ev ? P.ev.ready - P.t : 9, 0) + (P.ev ? thrT(P.ev.p, k) : 9);
        if (b.mode === `held`) return P.holderBase === k ? 0 : Math.max(0, P.readyAt - P.t) + thrT(P.f[P.holder], k);
        let rem = Math.max(0, b.t1 - P.t);
        return b.toBase === k ? rem : rem + 0.45 + thrT(b.toBase == null ? b.to : BB_BASES[b.toBase], k); // toBase 없음 = 중계 선수에게
      },
      runnerTime = (r, k) => r.delay + (Math.abs(k - r.s) * 1) / speed(r) + (Math.sign(k - r.s) !== Math.sign(r.target - r.s) && r.state === `run` ? 0.3 : 0),
      idx = (r) => P.r.indexOf(r),
      leadOf = (r) => {
        for (let i = idx(r) - 1; i >= 0; i--) if (live(P.r[i])) return P.r[i];
        return null;
      },
      trailOf = (r) => {
        for (let i = idx(r) + 1; i < P.r.length; i++) if (live(P.r[i])) return P.r[i];
        return null;
      },
      limitOf = (r) => {
        let l = leadOf(r),
          lim = l ? (l.target >= 4 ? 4 : l.target - 1) : 4;
        // 타자는 언제나 1루까지는 감 (앞 주자가 뜬공을 보며 1루 근처에서 기다려도 홈으로 되돌아가지 않음)
        return r === bat ? Math.max(1, lim) : lim;
      },
      minOf = (r) => (r === bat ? 1 : r.forced ? r.from + 1 : r.touched),
      setTarget = (r, k) => {
        if (k === r.target && r.state === `run`) return;
        let wasDir = Math.sign(r.target - r.s),
          dir = Math.sign(k - r.s);
        ((r.target = k),
          dir === 0 ? r.state !== `wait` && (r.state = `safe`) : ((r.state = `run`), wasDir && dir !== wasDir && (r.delay = Math.max(r.delay, 0.25))));
      },
      // 주자 AI: 공보다 먼저 닿을 수 있는 만큼 진루 (플레이어가 지시한 주자는 건드리지 않음)
      decide = (r) => {
        if (r.manual || !live(r) || r.state === `wait` || r.retouch || P.done) return;
        let k = Math.max(r.touched, Math.floor(r.s + 1e-6)),
          lim = limitOf(r),
          minB = Math.min(minOf(r), lim);
        k = Math.min(k, lim);
        while (k + 1 <= lim) {
          if (k + 1 <= minB || runnerTime(r, k + 1) < ballTimeTo(k + 1) - r.margin) k++;
          else break;
        }
        (k = Math.max(k, Math.min(minB, lim))), setTarget(r, k);
      },
      finish = () => {
        P.done || ((P.done = !0), (P.endT = P.t));
      },
      isForce = (r, k) => (r === bat && k === 1) || (r.forced && k === r.from + 1) || (r.retouch && k === r.from),
      out = (r, k, force, by, tag) => {
        if (!live(r)) return;
        ((r.state = `out`), (r.outT = P.t), P.outs.push({ id: r.id, base: k, t: P.t, force, by, tag })); // tag: 베이스 사이 태그아웃 문구
        // 뒤 주자가 아웃되면 앞 주자의 포스 상황이 풀림
        for (let i = 0; i < idx(r); i++) P.r[i].forced = !1;
        P.st.outs + P.outs.length >= 3 && finish();
      },
      // 베이스 k를 맡은 수비수가 그 베이스에 닿기까지 남은 시간 (공을 든 선수가 맡았으면 0)
      recvT = (k) => {
        let key = P.cover[k],
          f = P.f[key],
          B = BB_BASES[k];
        if (key === P.holder) return 0;
        return Math.max(0, f.startAt - P.t) + (f.via ? dist(f, f.via) + dist(f.via, B) : dist(f, B)) / f.spd;
      },
      throwTo = (k, carry) => {
        let h = P.f[P.holder],
          from = { x: h.x, y: h.y },
          to = BB_BASES[k],
          d = dist(from, to),
          tt = carry || d < 7 ? d / c.ifSpd + 0.1 : thrT(from, k), // 가까우면 직접 들고 뛰어감
          rec = carry || P.cover[k] === P.holder || (!P.st.demo && d < 7) ? P.holder : P.cover[k],
          // 받을 선수가 아직 오는 중이면 기다렸다가, 베이스에 닿는 순간 공이 도착하게 던짐 (DEMO는 그대로)
          wait = !P.st.demo && rec !== P.holder ? Math.max(0, recvT(k) - tt) : 0;
        ((P.ball = { mode: `thrown`, from, to, t0: P.t + wait, t1: P.t + wait + tt, toBase: k, receiver: rec, by: P.holder, x: from.x, y: from.y, h: 1.5 }),
          (P.holderBase = null),
          P.throws++,
          rec !== P.holder && (P.f[rec].goal = { ...to }));
        if (rec === P.holder) P.f[P.holder].goal = { ...to };
        // 송구가 다른 곳으로 가면 그 틈에 진루할 수 있는지 다시 판단
        for (let r of P.r) live(r) && r.state === `safe` && decide(r);
      },
      // 외야 → 베이스 k 중계: 내야수가 외야수와 베이스 사이(베이스에서 40% 지점)에서 받음.
      // 홈은 왼쪽이면 3루수, 아니면 1루수 / 2·3루는 2루를 맡지 않은 유격수·2루수. 비운 베이스는 투수가 커버
      cutTo = (k) => {
        let h = P.f[P.holder],
          from = { x: h.x, y: h.y },
          to = lerp(BB_BASES[k], from, 0.4),
          key = k === 4 ? (h.x < -15 ? `inf-3b` : `inf-1b`) : P.cover[2] === `inf-ss` ? `inf-2b` : `inf-ss`;
        for (let j = 1; j <= 3; j++) P.cover[j] === key && ((P.cover[j] = `pitcher`), (P.f.pitcher.goal = { ...BB_BASES[j] }), (P.f.pitcher.via = null));
        P.f[key].via = null;
        ((P.ball = { mode: `thrown`, from, to, t0: P.t, t1: P.t + dist(from, to) / c.thr, toBase: null, receiver: key, by: P.holder, x: from.x, y: from.y, h: 1.5 }),
          (P.holderBase = null),
          P.throws++,
          (P.f[key].goal = { ...to }));
        for (let r of P.r) live(r) && r.state === `safe` && decide(r);
      },
      // 아무도 잡을 수 없을 때 쓰는 어림: 공이 베이스 j에 닿는 시각 tb(j)가 이렇다면 주자들이 지금 가려는 베이스보다
      // 몇 베이스를 더 가는지 (득점은 0.5 더). 앞 주자부터, 앞 주자를 앞지르지 않게. 플레이어가 지시한 주자는 그대로
      // ponytail: 한 번 던진 뒤만 어림(이어지는 송구·주자 재판단은 안 봄). 어색한 송구가 또 보이면 P를 복제해 끝까지 돌려 비교
      adv = (tb) => {
        let cost = 0,
          leadK = 5;
        for (let r of P.r) {
          if (!live(r)) continue;
          let cur = r.state === `run` && r.target > r.s ? r.target : Math.max(r.touched, Math.floor(r.s + 1e-6)),
            lim = leadK >= 4 ? 4 : leadK - 1,
            k = cur;
          if (!r.manual) while (k + 1 <= lim && runnerTime(r, k + 1) < tb(k + 1) - r.margin) k++;
          ((cost += k - cur + (k === 4 && cur < 4 ? 0.5 : 0)), (leadK = k));
        }
        return cost;
      },
      // 송구 후보들(앞쪽이 기본) 중 주자를 가장 덜 보내는 것. 같으면 앞쪽
      leastAdv = (opts) => opts.reduce((a, o) => ((o.cost = adv(o.tb)), !a || o.cost < a.cost ? o : a), null),
      // 공을 베이스 k로 직접 던졌을 때의 tb (받을 선수가 늦으면 기다렸다 던짐)
      tbThrow = (h, k, ready) => {
        let d = dist(h, BB_BASES[k]),
          T = ready + Math.max(d < 7 ? d / c.ifSpd + 0.1 : thrT(h, k), recvT(k));
        return (j) => (j === k ? T : T + 0.45 + thrT(BB_BASES[k], j));
      },
      // 외야수의 송구 (DEMO 제외): 잡을 수 있으면 그 베이스로, 아니면 주자를 가장 덜 보내는 쪽으로 던짐
      // (기본은 맨 뒤 주자가 노릴 다음 베이스). 45m 넘으면 중계 선수를 거침 → 중계 선수가 받아서 다시 판단
      ofDefense = () => {
        let h = P.f[P.holder],
          via = (k) => dist(h, BB_BASES[k]) > 45,
          tOf = (k) => Math.max(via(k) ? dist(h, BB_BASES[k]) / c.thr + 0.3 : thrT(h, k), recvT(k)),
          best = null;
        for (let r of P.r) {
          if (!live(r) || r.delay > 0.5 || r.state !== `run` || r.target < 1) continue;
          let k = r.target,
            tt = tOf(k),
            rt = runnerTime(r, k);
          // 중계 시간까지 넣어 확실히 잡을 수 있을 때만 승부 (늦은 승부 송구는 그 틈에 뒤 주자들이 진루함)
          if (tt + 0.05 < rt) {
            let twoOut = P.st.outs + P.outs.length === 2,
              score = (twoOut ? 0 : k * 10) + (isForce(r, k) ? 5 : 0) + (rt - tt) * (twoOut ? 10 : 1);
            (!best || score > best.score) && (best = { k, score });
          }
        }
        let k = best && best.k;
        if (!k) {
          if (!P.r.some((r) => live(r) && r.state === `run` && r.target > r.s)) return !1;
          let tr = P.r.filter(live).pop(),
            b = tr.state === `run` && tr.target > tr.s ? tr.target : Math.floor(tr.s + 1e-6),
            k0 = Math.min(4, b + 1),
            // 중계면 공은 중계 지점(베이스에서 40%)에 먼저 가고, 중계 선수가 어디로든 이어 던질 수 있음
            opt = (k) => {
              if (!via(k)) return { k, tb: tbThrow(h, k, 0) };
              let cp = lerp(BB_BASES[k], h, 0.4),
                T = dist(h, cp) / c.thr + 0.3;
              return { k, tb: (j) => T + thrT(cp, j) };
            };
          k = leastAdv([k0, 1, 2, 3, 4].filter((x, i, a) => a.indexOf(x) === i).map(opt)).k;
        }
        return (via(k) ? cutTo(k) : throwTo(k), !0);
      },
      // 수비 판단: 공을 가진 선수가 아웃시킬 수 있는 주자에게 송구
      defense = () => {
        if (P.throws >= 6) return !1;
        let ft = P.st.firstThrow;
        if (ft && !P.throws) return (throwTo(ft.base, ft.carry), !0); // DEMO: 정해진 첫 송구
        // 달려오는 주자가 곧 손 닿을 거리면 던지지 않고 태그하러 감 (실제 경기만. 아래에서 더 앞선 주자를 잡을 송구가 없을 때)
        let lunge = null,
          doLunge = () => ((lunge.f.goal = lunge.p), (lunge.f.via = null), (P.holderBase = null), !0);
        if (!P.st.demo) {
          if (P.rd) return !0; // 협살 중 (tick에서 처리)
          let f = P.f[P.holder];
          for (let r of P.r)
            if (!lunge && live(r) && r.state === `run` && !r.trot && r.delay <= 0 && P.holderBase !== r.target) {
              let p2 = basePos(r.s + Math.sign(r.target - r.s) * Math.min(Math.abs(r.target - r.s), speed(r) * 0.4));
              dist(f, p2) < 1.2 + f.spd * 0.4 && (lunge = { f, p: p2, k: r.target });
            }
          if (P.holder.startsWith(`out`)) return lunge ? doLunge() : ofDefense();
        }
        let h = P.f[P.holder],
          best = null;
        for (let r of P.r) {
          if (!live(r) || r.delay > 0.5) continue;
          let k = r.state === `run` ? r.target : null;
          if (k == null || P.holderBase === k || k < 1) continue;
          let d = dist(h, BB_BASES[k]),
            tt = Math.min(d < 7 ? d / c.ifSpd + 0.1 : 99, thrT(h, k));
          !P.st.demo && d >= 7 && (tt = Math.max(tt, recvT(k))); // 받을 선수가 늦으면 그만큼 늦음 (DEMO는 그대로)
          let rt = runnerTime(r, k),
            // 외야에서 홈·3루로 길게 던질 때는 보살 가능성이 높을 때만. 아니면 아래에서 내야로 중계해
            // 타자·뒤 주자의 추가 진루를 막음
            // (실제 경기에서는 외야수만. 중계 선수는 접전이면 바로 홈·3루로 이어 던짐)
            need = d > 45 && k >= 3 && (P.st.demo || P.holder.startsWith(`out`)) ? BB_RELAY_MARGIN : 0.05;
          if (tt + need < rt) {
            // 2아웃이면 가장 확실한 아웃, 아니면 앞선 주자(실점 방지) 우선.
            // 단 앞 주자가 아슬아슬하면(번트 0.25초, 그 밖 0.05초 미만) 확실한 타자 아웃을 먼저 (그것도 없을 때만 승부, DEMO는 그대로)
            let twoOut = P.st.outs + P.outs.length === 2,
              close = !P.st.demo && !twoOut && r !== bat && rt - tt < (P.bb.bunt ? 0.25 : 0.05),
              score = (twoOut ? 0 : k * 10) + (isForce(r, k) ? 5 : 0) + (rt - tt) * (twoOut ? 10 : 1) - (close ? 1000 : 0);
            (!best || score > best.score) && (best = { k, score });
          }
        }
        // 태그는 2아웃이거나, 송구로 잡을 주자가 태그할 주자보다 앞서지 않을 때만 (예: 홈으로 뛰는 3루 주자를 두고 지나가는 주자를 쫓지 않음)
        if (lunge && (!best || P.st.outs + P.outs.length === 2 || lunge.k >= best.k)) return doLunge();
        if (best) return (throwTo(best.k), !0);
        if (P.runnerOnly) return !1; // 도루·런다운: 늦었으면 던지지 않음 (1·3루에서 3루 주자에게 홈을 내주지 않게)
        // 실제 경기: 공을 들고 있기 / 각 베이스로 던지기 중 주자를 가장 덜 보내는 쪽 (같으면 들고 있기)
        if (!P.st.demo) {
          if (!P.r.some((r) => live(r) && r.state === `run` && r.target > r.s)) return !1;
          let ready = Math.max(0, P.readyAt - P.t),
            o = leastAdv([{ k: 0, tb: (j) => ready + thrT(h, j) }, ...[1, 2, 3, 4].filter((k) => k !== P.holderBase).map((k) => ({ k, tb: tbThrow(h, k, ready) }))]);
          return o.k ? (throwTo(o.k), !0) : !1;
        }
        // 잡을 수 없으면: 달리는 주자가 더 못 가도록 맨 뒤 주자의 다음 베이스로
        let moving = P.r.filter((r) => live(r) && r.state === `run` && r.target > r.s);
        if (moving.length) {
          // 외야수는 내야(2루 쪽 중계)로, 내야수는 뒤 주자가 가는 베이스로 던져 더 못 가게 묶음.
          // 이미 늦은 홈 송구는 하지 않음 (그 틈에 타자가 한 베이스 더 가므로)
          let kc = P.holder.startsWith(`out`) ? 2 : Math.min(...moving.map((r) => r.target));
          if (kc < 4 && kc !== P.holderBase) return (throwTo(kc), !0);
          return !1;
        }
        return !1;
      },
      possess = () => {
        let ev = P.ev;
        ((P.possessed = !0), (P.ball = { mode: `held`, x: ev.p.x, y: ev.p.y, h: 1.2 }), (P.holder = ev.key), (P.holderBase = null), (P.readyAt = ev.ready));
        ev.error && (P.error = !0);
        if (ev.catch) {
          P.caught = { key: ev.key, p: ev.p, t: P.t };
          out(bat, 0, !0, ev.key); // 뜬공 아웃 (이때 들어온 득점은 인정 안 됨 → force 취급)
          if (P.done) return;
          // 잡히기 전에 홈을 밟은 주자는 원래 베이스를 다시 밟지 않았으므로 득점 취소, 아웃
          for (let r of P.r)
            if (r !== bat && r.state === `scored`) {
              ((P.runs = P.runs.filter((x) => x.id !== r.id)), (r.state = `out`), (r.outT = P.t));
              P.outs.push({ id: r.id, base: r.from, t: P.t, force: !0, by: ev.key, early: !0 });
            }
          P.st.outs + P.outs.length >= 3 && finish();
          if (P.done) return;
          for (let r of P.r) {
            if (!live(r)) continue;
            // 잡혔으면 원래 베이스로 돌아가 다시 밟아야 함 (태그업)
            ((r.touched = r.from), (r.forced = !1));
            if (r.s > r.from + 1e-6) ((r.retouch = !0), (r.target = r.from), (r.state = `run`), (r.delay = Math.max(r.delay, 0.2)));
            else ((r.s = r.from), (r.state = `safe`), (r.target = r.from));
            // AI 태그업: 잡은 위치에서 다음 베이스까지 송구보다 빠르면 출발
            if (!r.manual && r.from < 4 && P.st.outs + P.outs.length < 3) {
              let runT = (r.s - r.from) / speed(r) + 1 / speed(r) + 0.35,
                ballT = Math.max(0, ev.ready - P.t) + thrT(ev.p, r.from + 1);
              runT < ballT - r.margin && (r.tagIntent = !0);
            }
            !r.retouch && r.tagIntent && ((r.tagIntent = !1), setTarget(r, r.from + 1), (r.delay = 0.25));
          }
        }
      },
      // 송구가 베이스 k에 도착
      arrive = () => {
        let b = P.ball,
          k = b.toBase,
          rec = P.f[b.receiver];
        // 빠진 송구: 공은 그 자리에 멈춰 있고, 받을 선수가 달려가 주울 때까지 기다림
        if (b.wild) return void (P.ball = { ...b, wild: !1, lie: !0, from: b.to, t0: P.t, t1: P.t + dist(rec, b.to) / rec.spd + 0.3, h: 0.1 });
        ((rec.x = b.to.x), (rec.y = b.to.y), (rec.goal = null), (rec.via = null));
        ((P.ball = { mode: `held`, x: b.to.x, y: b.to.y, h: 1.2 }), (P.holder = b.receiver), (P.holderBase = k), (P.readyAt = P.t + (k == null ? 0.3 : 0.45))); // 중계 선수는 바로 몸을 돌려 던짐
        P.assistBy = b.by; // 이 베이스에서 나오는 아웃은 송구한 선수의 보살
        for (let r of P.r) {
          if (!live(r) || r.state !== `run` || r.target !== k) continue;
          let remain = Math.abs(k - r.s) * BB_LEG;
          // 베이스 가까이(DEMO 8m, 실제 경기 3m)면 멈추지 못해 아웃. 실제 경기에서 그보다 멀면 되돌아가다 협살에 걸릴 수 있음
          if (isForce(r, k) || remain <= (P.st.demo ? 8 : 3)) out(r, k, isForce(r, k), b.by);
          else if (!r.manual && !r.retouch) (setTarget(r, k > r.s ? r.touched : Math.ceil(r.s)), P.st.demo || startRd(r)); // 늦었으면 되돌아감
        }
        // 협살 중 공을 받으면 주자는 멈칫하고(0.5초) 반대 베이스로
        if (b.rd && P.rd) {
          let r = P.r.find((x) => x.id === P.rd.id);
          live(r) && ((P.rd.flee = P.rd.flee === P.rd.lo ? P.rd.lo + 1 : P.rd.lo), setTarget(r, P.rd.flee), (r.delay = 0.5));
        }
      },
      // 협살 시작: 되돌아가는 주자보다 공이 먼저 그 베이스에 닿을 수 있으면, 두 베이스 사이에 가둠
      // P.rd = { id, lo: 두 베이스 중 앞쪽, flee: 주자가 향하는 베이스 }
      startRd = (r) => {
        let back = r.target;
        if (P.rd || P.cover[back] === P.holder) return;
        Math.max(thrT(P.f[P.holder], back), recvT(back)) + 0.05 < runnerTime(r, back) && (P.rd = { id: r.id, lo: Math.floor(r.s), flee: back });
      },
      arriveBase = (r) => {
        let k = r.target;
        P.rd && P.rd.id === r.id && (P.rd = null); // 베이스에 닿으면 협살 끝
        if (P.ball.mode === `held` && P.holderBase === k && !r.trot) return out(r, k, isForce(r, k), P.assistBy || P.holder);
        r.retouch && k === r.from && (r.retouch = !1);
        if (k > r.touched) r.touched = k;
        if (k === 4) return ((r.state = `scored`), (r.scoredT = P.t), P.runs.push({ id: r.id, t: P.t }));
        r.state = `safe`;
        if (P.caught && r.tagIntent && !r.retouch) return ((r.tagIntent = !1), setTarget(r, r.from + 1), void (r.delay = 0.25));
        decide(r);
      },
      tick = (h) => {
        P.t += h;
        let t = P.t;
        // 수비수 이동
        for (let k in P.f) {
          let f = P.f[k];
          if (!f.goal || t < f.startAt) continue;
          let g = f.via || f.goal, // 거쳐 갈 지점(via)이 있으면 먼저 그곳으로
            dx = g.x - f.x,
            dy = g.y - f.y,
            d = Math.hypot(dx, dy),
            m = f.spd * h;
          d <= m ? ((f.x = g.x), (f.y = g.y), g === f.via && (f.via = null)) : ((f.x += (dx / d) * m), (f.y += (dy / d) * m));
        }
        // 공
        let b = P.ball;
        if (b.mode === `track`) {
          let s = sample(b.track, t);
          s && ((b.x = s[1]), (b.y = s[2]), (b.h = s[3]));
          if (!P.landed && t >= P.landT) {
            P.landed = !0;
            // 뜬공이 떨어졌으면 기다리던 주자들이 판단
            if (P.ev && !P.ev.catch)
              for (let r of P.r) {
                // 공이 떨어지면 포스 상태인 주자는 반드시 다음 베이스로
                live(r) && r !== bat && r.forced && r.state !== `wait` && r.target < r.from + 1 && setTarget(r, r.from + 1);
                if (live(r) && r.state === `wait`) {
                  ((r.state = `safe`), (r.target = r.s));
                  // 플레이어가 미리 지시했으면 그대로, 아니면 AI 판단
                  r.manual
                    ? setTarget(r, r.holdS <= r.from && !r.forced ? r.from : Math.min(limitOf(r), r.from + 1))
                    : decide(r);
                }
              }
          }
          if (P.ev && t >= P.ev.t && !P.fixedEnd) {
            let f = P.f[P.ev.key];
            dist(f, P.ev.p) < 2 && possess();
          }
        } else if (b.mode === `thrown`) {
          let u = clamp((t - b.t0) / Math.max(0.01, b.t1 - b.t0), 0, 1);
          ((b.x = b.from.x + (b.to.x - b.from.x) * u), (b.y = b.from.y + (b.to.y - b.from.y) * u), (b.h = b.lie ? 0.1 : 1.5 + 2.5 * u * (1 - u)));
          t >= b.t1 && arrive();
        } else if (b.mode === `held` && P.holder) {
          let f = P.f[P.holder];
          ((b.x = f.x), (b.y = f.y));
        }
        if (P.done) return;
        // DEMO: 정해진 시각의 주자 지시 (플레이어가 지시한 것처럼 AI가 바꾸지 않음)
        for (let os = P.st.orders || []; P.oi < os.length && t >= os[P.oi].t; P.oi++) {
          let o = os[P.oi],
            r = P.r.find((x) => x.id === o.id);
          r && live(r) && ((r.manual = !0), setTarget(r, o.base));
        }
        // 주자
        for (let r of P.r) {
          if (!live(r)) continue;
          if (r.delay > 0) {
            r.delay -= h;
            continue;
          }
          if (r.state === `wait`) {
            let d = r.holdS - r.s,
              m = speed(r) * h;
            r.s += Math.abs(d) <= m ? d : Math.sign(d) * m;
            continue;
          }
          if (r.state !== `run`) continue;
          let dir = Math.sign(r.target - r.s),
            ns = r.s + dir * speed(r) * h;
          if (dir > 0) for (let k = Math.floor(r.s + 1e-6) + 1; k <= Math.floor(ns + 1e-6) && k < r.target; k++) r.touched = Math.max(r.touched, k);
          if (dir === 0 || (dir > 0 && ns >= r.target) || (dir < 0 && ns <= r.target)) {
            r.s = r.target;
            arriveBase(r);
            if (P.done) return;
          } else r.s = ns;
        }
        // 앞 주자 추월: 뒤 주자가 앞 주자를 앞지르면 뒤 주자 아웃
        for (let r of P.r) {
          let l = leadOf(r);
          if (l && live(r) && r.s > l.s + 0.03 && (out(r, Math.min(4, Math.max(1, Math.round(l.s))), !1, `pass`), P.done)) return;
        }
        // 공을 든 수비수가 베이스를 벗어난 주자에게 닿으면(1.2m) 태그아웃 (DEMO는 그대로)
        if (!P.st.demo && P.ball.mode === `held` && P.holder) {
          let f = P.f[P.holder];
          for (let r of P.r)
            if (live(r) && !r.trot && Math.abs(r.s - Math.round(r.s)) * BB_LEG > 0.6 && dist(f, basePos(r.s)) < 1.2 && (out(r, r.target, isForce(r, r.target), P.holder, P.rd && P.rd.id === r.id ? `협살 태그아웃` : `태그아웃`), P.done)) return;
        }
        // 협살: 공 든 선수가 주자를 몰고, 주자가 반대편 수비수에게 가까워지면 그쪽으로 던짐
        // (공이 닿을 때 주자와 2.5m쯤 남게 → 주자가 멈칫하는 사이 태그). 던진 선수는 자기 쪽 베이스를 맡음
        if (P.rd) {
          let r = P.r.find((x) => x.id === P.rd.id);
          if (!live(r) || r.state !== `run`) P.rd = null;
          else if (P.ball.mode === `held`) {
            let f = P.f[P.holder],
              rp = basePos(r.s),
              other = P.rd.flee === P.rd.lo ? P.rd.lo + 1 : P.rd.lo,
              recK = P.cover[P.rd.flee],
              rec = P.f[recK];
            ((f.goal = rp), (f.via = null), (P.holderBase = null));
            if (recK !== P.holder && dist(rp, rec) <= 2.5 + speed(r) * BB_LEG * (dist(f, rec) / c.thr + 0.05)) {
              let from = { x: f.x, y: f.y },
                to = { x: rec.x, y: rec.y },
                // 가끔(EASY 6%, HARD 3%) 송구 실책: 공이 받을 선수 뒤로 6~10m 빠짐 → 받을 선수가 쫓아가는 사이 주자가 삶
                wild = R() < (P.st.diff === `HARD` ? 0.03 : 0.06);
              if (wild) {
                let d = Math.max(1, dist(from, to)),
                  over = rnd(6, 10);
                ((to = { x: to.x + ((to.x - from.x) / d) * over, y: to.y + ((to.y - from.y) / d) * over }), (P.rdErr = P.holder), (rec.goal = { ...to }));
              } else rec.goal = null;
              ((P.ball = { mode: `thrown`, from, to, t0: t, t1: t + dist(from, to) / c.thr + 0.05, toBase: null, receiver: recK, by: P.holder, rd: !wild, wild, x: from.x, y: from.y, h: 1.5 }),
                (f.goal = { ...BB_BASES[other] }),
                (P.cover[other] = P.holder));
            }
          }
        }
        // 고정 종료(파울), 홈런은 모든 주자가 홈에 들어오면
        if (P.fixedEnd != null) {
          (t >= P.fixedEnd || (P.homeRun && !P.r.some(live))) && finish();
          return;
        }
        // 수비
        let thrown = !1;
        P.ball.mode === `held` && t >= P.readyAt && (thrown = defense());
        // 종료: 공을 잡고 있고, 움직이는 주자가 없고, 더 던질 곳도 없을 때
        let busy = P.r.some((r) => live(r) && (r.state === `run` || r.state === `wait` || r.delay > 0 || r.tagIntent));
        P.possessed && P.ball.mode === `held` && t >= P.readyAt && !thrown && !busy && finish();
        t > 30 && finish();
      };

    // ── 외부에서 쓰는 함수들 ──
    P.step = (dt) => {
      for (let left = dt; left > 1e-9 && !P.done; left -= 0.02) tick(Math.min(0.02, left));
    };
    P.runToEnd = () => {
      while (!P.done) tick(0.02);
      return P;
    };
    P.live = (id) => {
      let r = P.r.find((x) => x.id === id);
      return !!r && live(r);
    };
    P.can = (id, cmd) => {
      let r = P.r.find((x) => x.id === id);
      if (!r || !live(r) || P.done || P.fixedEnd != null) return !1;
      if (cmd === `advance`) {
        if (P.caught && r.retouch) return !r.tagIntent;
        let base = r.state === `run` && r.target > r.s ? r.target : Math.floor(r.s + 1e-6);
        return base + 1 <= limitOf(r) && base < 4;
      }
      // 귀루: 마지막으로 밟은 베이스로. 뒤 주자가 그 베이스로 오고 있으면 불가
      if (r === bat && r.touched === 0) return !1;
      if (r.state === `wait`) return r.holdS > r.from;
      if (!(r.s > r.touched + 1e-6 || r.target > r.touched)) return !1;
      // 뜬공이 떠 있는 동안은 언제든 귀루 가능 (잡히면 타자가 아웃되므로)
      if (P.ball.mode === `track` && !P.landed && P.bb.kind !== `ground`) return !0;
      let tr = trailOf(r);
      return !(tr && tr.target >= r.touched && tr !== r);
    };
    P.command = (id, cmd) => {
      if (!P.can(id, cmd)) return !1;
      let r = P.r.find((x) => x.id === id);
      r.manual = !0;
      if (cmd === `advance`) {
        if (P.caught && r.retouch) return ((r.tagIntent = !0), !0); // 베이스를 다시 밟자마자 태그업
        if (r.state === `wait`) return ((r.state = `run`), (r.target = Math.min(limitOf(r), r.from + 1)), !0);
        if (P.caught && r.state === `safe` && r.s === r.from) return (setTarget(r, r.from + 1), (r.delay = 0.25), !0);
        let base = r.state === `run` && r.target > r.s ? r.target : Math.floor(r.s + 1e-6);
        return (setTarget(r, Math.min(limitOf(r), base + 1)), !0);
      }
      if (r.state === `wait`) return ((r.holdS = r.from), !0);
      return (setTarget(r, r.touched), !0);
    };
    P.commandAll = (cmd) => {
      let list = cmd === `advance` ? P.r : [...P.r].reverse(),
        any = !1;
      for (let r of list) any = P.command(r.id, cmd) || any;
      return any;
    };
    P.view = () => {
      let fs = {},
        rs = [];
      for (let k in P.f) fs[k] = { x: P.f[k].x, y: P.f[k].y };
      for (let r of P.r) {
        let p = basePos(r.s),
          vis = r.state === `out` ? P.t < r.outT + 0.6 : r.state === `scored` ? P.t < r.scoredT + 0.5 : !0;
        rs.push({ id: r.id, x: p.x, y: p.y, state: r.state, visible: vis, manual: r.manual });
      }
      return { ball: { x: P.ball.x, y: P.ball.y, h: P.ball.h || 0 }, fielders: fs, runners: rs };
    };
    P.result = () => result(P);
    return P;
  }

  // ────────────────────────────────────────────────────────────────
  // 결과 정리: 아웃·득점·누상 주자·기록 문구
  function result(P) {
    let bb = P.bb,
      st = P.st,
      res = { bb, foul: P.foul, homeRun: P.homeRun, error: !1, errorBy: null, distance: P.distance, outsAdded: 0, runs: 0, newBases: [...st.bases] };
    if (P.foul) {
      if (P.foulOut) {
        let why = `${BB_POS[P.foulOut]} 파울플라이`;
        return Object.assign(res, { foul: !0, foulOut: !0, outsAdded: 1, label: why, display: bbOut(why), status: `${BB_POS[P.foulOut]}가 파울 지역에서 잡아냄` });
      }
      return Object.assign(res, { label: `파울` });
    }
    if (P.homeRun) {
      let n = P.r.length;
      return Object.assign(res, {
        runs: n,
        newBases: [!1, !1, !1],
        batterBase: 4,
        label: HR[n],
        display: `${HR[n]}!<br><span class="bb-out-reason">${Math.round(bb.D)}m · ${n}타점</span>`,
        color: `#f1c40f`,
        status: `담장을 넘겼다! ${Math.round(bb.D)}m ${HR[n]}`,
      });
    }
    let outs = P.outs,
      total = st.outs + outs.length,
      third = total >= 3 ? outs[2 - st.outs] : null,
      runs = P.runs.filter((x) => !third || (!third.force && x.t < third.t)).length,
      nb = [!1, !1, !1];
    if (total < 3) for (let r of P.r) r.state === `safe` && r.s >= 1 && r.s <= 3 && Number.isInteger(r.s) && (nb[r.s - 1] = !0);
    let bat = P.bat,
      ev = P.ev,
      pos = BB_POS[ev.key],
      batOut = outs.find((o) => o.id === `runner-t`),
      otherOuts = outs.filter((o) => o.id !== `runner-t`),
      baseName = (k) => (k === 4 ? `홈` : `${k}루`),
      throwWhy = (o) => o.tag ? `${BB_POS[o.by] || pos} ${o.tag}` : (o.base === 4 ? `${BB_POS[o.by] || pos} 홈 보살` : `${BB_POS[o.by] || pos} → ${baseName(o.base)} 송구 아웃`),
      why = null,
      label;
    // 도루·견제 런다운: 타자 없이 주자만
    if (P.runnerOnly) {
      let parts = [],
        steals = 0,
        counted = P.runs.filter((x) => !third || (!third.force && x.t < third.t)).map((x) => x.id);
      for (let r of P.r) {
        let o = outs.find((x) => x.id === r.id),
          f = r.from;
        if (o) (parts.push(`${f}루 주자 ${r.stealing ? (o.base === 4 ? `홈스틸 실패` : `도루 실패`) : /협살/.test(o.tag) ? `런다운 아웃` : `${baseName(o.base)}에서 아웃`}`), why || (why = throwWhy(o)));
        else if (r.s === f && r.state === `safe` && (r.stealing || bb.pick === f)) parts.push(`${f}루 주자 귀루`);
        else if (counted.includes(r.id)) parts.push(r.stealing && f === 3 ? `홈스틸 성공` : `${f}루 주자 득점`);
        else if (r.s > f && Number.isInteger(r.s))
          r.stealing && r.s === f + 1 ? (steals++, parts.push(`${f}루 → ${r.s}루 도루 성공`)) : parts.push(`${f}루 주자 ${r.s}루까지`);
      }
      label = parts.join(` · `) || `주자 그대로`;
      P.rdErr && ((res.rdErr = P.rdErr), (label += ` · 협살 중 ${BB_POS[P.rdErr]} 송구 실책`));
      return Object.assign(res, {
        runnerOnly: !0,
        outsAdded: outs.length,
        runs,
        newBases: nb,
        label,
        display: why ? bbOut(why) : runs ? `득점!` : steals > 1 ? `더블스틸!` : steals ? `도루 성공!` : `SAFE!`,
        color: why ? `#c0392b` : runs ? `#f1c40f` : `#2ecc71`,
        status: label,
      });
    }
    if (P.caught) {
      let sac = runs > 0 && total < 3;
      ((why = `${pos} ${bb.bunt ? `번트 뜬공` : sac ? `희생플라이` : KIND_OUT[bb.kind]}`), (label = why));
      otherOuts.length && ((why += otherOuts.some((o) => o.early) ? ` · 주자가 일찍 출발해 아웃` : ` · 더블플레이`), (label = why));
    } else if (batOut) {
      // 번트로 타자만 아웃되고 주자가 진루(득점)하면 희생번트 (DEMO는 그대로)
      let sacBunt = !st.demo && bb.bunt && bb.kind === `ground` && outs.length === 1 && total < 3 && P.r.some((r) => r !== bat && (r.state === `scored` || (r.state !== `out` && r.s > r.from)));
      if (bat.touched === 0)
        ((why = sacBunt ? `${pos} 희생번트` : bb.kind === `ground` ? `${pos} ${outs.length >= 2 ? `병살타` : `땅볼`}` : `${pos} → 1루 송구 아웃`), (label = why));
      else ((why = throwWhy(batOut)), (label = `${HIT[bat.touched]} → ${baseName(batOut.base)}에서 아웃`));
    } else {
      let b = bat.state === `scored` ? 4 : Math.round(bat.s),
        // 실책 기록: 더듬거나 놓쳐서 타자가 아웃 없이 살았을 때만. 다른 주자를 아웃시켰으면
        // (타자가 몇 루까지 갔든) 야수선택, 더듬고도 타자를 아웃시켰으면 실책이 아님
        ec = P.error && !otherOuts.length,
        fc = otherOuts.length > 0 && (P.error || (bb.kind === `ground` && otherOuts.some((o) => o.force)));
      ((res.error = ec), ec && (res.errorBy = ev.errBy || ev.key));
      label = ec ? `${BB_POS[ev.errBy || ev.key]} 실책 출루` : fc ? `${pos} ${KIND_OUT[bb.kind]}, 야수선택` : bb.kind === `ground` && ev.infield && b === 1 ? `내야안타` : HIT[b] || `안타`;
      otherOuts.length && ((why = otherOuts[0].by === `pass` ? `앞 주자 추월 아웃` : otherOuts[0].force ? `${baseName(otherOuts[0].base)} 포스아웃` : throwWhy(otherOuts[0])), (label += otherOuts[0].by === `pass` ? ` (주자가 앞 주자를 앞질러 아웃)` : ` (주자 ${baseName(otherOuts[0].base)}에서 아웃)`));
      res.batterBase = b;
    }
    runs && !P.caught && (label = `${runs}타점 ` + label);
    P.rdErr && ((res.rdErr = P.rdErr), (label += ` · 협살 중 ${BB_POS[P.rdErr]} 송구 실책`)); // 점수판 E는 app에서
    let hitText = label,
      color = why ? `#c0392b` : res.error ? `#e67e22` : /홈런/.test(label) ? `#f1c40f` : `#2ecc71`;
    return Object.assign(res, {
      outsAdded: outs.length,
      runs,
      newBases: nb,
      caught: P.caught,
      fieldedBy: ev.key,
      label,
      display: why ? bbOut(why) : res.error ? `실책!<br><span class="bb-out-reason">(${BB_POS[ev.errBy || ev.key]})</span>` : hitText,
      color,
      status: why
        ? `${why}${runs ? ` · ${runs}점 득점` : ``}`
        : `${label}! ${P.wallBall ? `펜스 직격, ` : ``}${res.batterBase === 4 ? `타자 홈인` : res.batterBase ? `타자 ${res.batterBase}루` : ``}`,
    });
  }

  // 한 번에 끝까지 진행 (AI 주루만 사용) — 밸런스 테스트용
  function play(bb, st) {
    return start(bb, st).runToEnd().result();
  }

  return { batted, bunt, start, play, sample, cfg, basePos };
})();
typeof module !== `undefined` && (module.exports = { BB_SIM, bbFence, BB_FIELD_M, BB_BASES }); // Node 테스트용
