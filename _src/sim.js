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
  BB_WALL_H = 3.6; // 펜스 높이(m). 이 높이 이상으로 넘어가야 홈런

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
    KIND_OUT = { fly: `뜬공`, line: `직선타`, pop: `팝플라이`, ground: `땅볼` },
    // 난이도별 수비 능력. EASY는 송구가 느리고(21m/s) 수비 반응이 늦음. 주자 속도(run)는 같음
    cfg = (diff) =>
      diff === `HARD`
        ? { thr: 29, ofSpd: 8.0, ifSpd: 6.4, react: 0.3, run: 7.3, flyErr: 0.015, gbErr: 0.02, transfer: 0.5 }
        : { thr: 21, ofSpd: 7.4, ifSpd: 6.0, react: 0.4, run: 7.3, flyErr: 0.03, gbErr: 0.04, transfer: 0.65 },
    // 베이스 경로 위치 s(0=홈, 1=1루 … 4=홈) → 좌표
    basePos = (s) => {
      s = clamp(s, 0, 4);
      let i = Math.min(3, Math.floor(s));
      return lerp(BB_BASES[i], BB_BASES[i + 1], s - i);
    };

  // 스윙 결과(q: 타구 질 0~1, phi: 방향, foul) → 타구
  function batted(q, phi, foul) {
    if (foul) {
      let p = (phi < 0 ? -1 : 1) * rnd(48, 78);
      if (q < 0.45) return { kind: `ground`, foul: !0, phi: p, v0: rnd(15, 30) };
      let D = rnd(15, 70);
      return { kind: `fly`, foul: !0, phi: p, D, T: 1.6 + D / 26 + rnd(0, 1) };
    }
    // 발사각(타구 종류)은 실제 비율에 가깝게: 땅볼 40% · 라이너 22% · 뜬공 30% · 팝업 8%
    // 타이밍(q)은 타구 속도/비거리를 정함. 빗맞으면 땅볼·팝업 비중이 커짐
    let wPop = 0.06 + 0.12 * (1 - q),
      wGround = 0.4 + 0.15 * (1 - q),
      r = R() * (wGround + 0.22 + 0.3 + wPop);
    if ((r -= wGround) < 0) return { kind: `ground`, phi, v0: 18 + 26 * q + rnd(-3, 3) };
    if ((r -= 0.22) < 0) {
      let D = Math.max(25, 30 + 70 * q + rnd(-10, 10));
      return { kind: `line`, phi, D, T: 0.25 + D / 45 };
    }
    if ((r -= 0.3) < 0) {
      let D = Math.max(35, 43 + 84 * q ** 1.4 + rnd(-16, 8));
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
  function start(bb, st) {
    let c = cfg(st.diff),
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
        cover: { 1: `inf-1b`, 2: `inf-ss`, 3: `inf-3b`, 4: `catcher` },
        ev: null,
      };
    for (let k in BB_FIELD_M) {
      let m = BB_FIELD_M[k];
      P.f[k] = {
        x: m.x,
        y: m.y,
        goal: null,
        startAt: c.react + (k === `pitcher` ? 0.2 : 0), // 투수는 투구 동작 직후라 반응이 조금 늦음
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
      margin: rnd(0, 0.8), // 주자 성향: 작을수록 과감한 주루
      holdS: from,
      outT: null,
      scoredT: null,
    });
    for (let b of [3, 2, 1]) bases[b - 1] && P.r.push(mk(`runner-${b}`, b));
    let bat = mk(`runner-t`, 0);
    (P.r.push(bat), (P.bat = bat));

    let spd = (k) => P.f[k].spd,
      need = (k, p, slack) => P.f[k].startAt + Math.max(0, dist(BB_FIELD_M[k], p) - slack) / spd(k),
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
            k = keys.reduce((a, b) => (dist(BB_FIELD_M[a], p) < dist(BB_FIELD_M[b], p) ? a : b));
          return { key: k, t: Math.max(t1, need(k, p, 1)), p, n: need(k, p, 1) };
        })();

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
      if (lateral < 16 && bb.D < 75)
        for (let k of [`catcher`, `inf-1b`, `inf-3b`, `pitcher`, `out-lf`, `out-rf`]) {
          let n = need(k, L, 1.5);
          n <= bb.T + 0.1 && (!best || n < best.n) && (best = { k, n });
        }
      if (best && R() > c.flyErr) {
        (arc({ x: 0, y: 0 }, L, 0, bb.T, H, 1, 2), (P.f[best.k].goal = L), (P.foulOut = best.k));
        return ((P.fixedEnd = bb.T + 0.8), wrap(P));
      }
      return (arc({ x: 0, y: 0 }, L, 0, bb.T, H), (P.fixedEnd = Math.min(bb.T, 2.5) + 0.4), wrap(P));
    }

    // ── 페어 타구: 누가 언제 어디서 공을 잡는지는 주자와 무관하게 먼저 계산 ──
    let fence = bbFence(bb.phi),
      ev = null;
    if (bb.kind === `ground`) {
      let s = (t) => Math.min(fence - 1.5, bb.v0 * 4 * (1 - Math.exp(-t / 4))),
        g = (t) => at(bb.phi, s(t)),
        tPast = 0.15;
      while (s(tPast) < 50 && tPast < 6) tPast += 0.05;
      let f = intercept(IF, g, 0.15, tPast, 1.0);
      if (f) {
        let err = R() < c.gbErr;
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
          (arc({ x: 0, y: 0 }, L, 0, bb.T, H), (P.homeRun = !0), (P.fixedEnd = bb.T + 1.4));
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
        // 팝업은 투수 대신 야수·포수가 잡음
        let keys = bb.kind === `pop` ? [...IF.filter((k) => k !== `pitcher`), `catcher`, ...OF] : [...OF, ...IF],
          slack = bb.kind === `line` ? 1.0 : 1.6,
          best = null;
        for (let k of keys) {
          let n = need(k, L, slack) + (bb.kind === `line` ? 0.2 : 0); // 라이너는 첫 판단이 늦음
          n <= bb.T + (bb.kind === `line` ? 0 : 0.1) && (!best || n < best.n) && (best = { k, n });
        }
        if (best && R() > c.flyErr) {
          arc({ x: 0, y: 0 }, L, 0, bb.T, H, 1, 2);
          ev = { key: best.k, t: bb.T, p: L, catch: !0, ready: bb.T + c.transfer + 0.1 };
        } else {
          let err = !!best,
            rl = bb.kind === `line` ? rnd(12, 28) : bb.kind === `pop` ? rnd(1, 4) : rnd(5, 14),
            end = Math.min(bb.D + rl, fence - 1.5),
            rest = (t) => at(bb.phi, bb.D + (end - bb.D) * (1 - Math.exp(-(t - bb.T) / 0.6)));
          arc({ x: 0, y: 0 }, L, 0, bb.T, H);
          let o = err
            ? { key: best.k, t: bb.T + 0.9, p: L }
            : interceptOr([...OF, ...IF], (t) => (t < bb.T ? L : rest(t)), bb.T, bb.T + 8, 1.0);
          (roll(err ? () => L : rest, bb.T, o.t), (P.landT = bb.T));
          ev = { key: o.key, t: o.t, p: o.p, error: err, ready: o.t + c.transfer + 0.15 };
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
    for (let b = 1; b <= 4; b++) {
      let k = P.cover[b];
      k !== ev.key && (P.f[k].goal = { ...BB_BASES[b] });
    }
    for (let k of OF)
      if (k !== ev.key) {
        let f = P.f[k];
        f.goal = lerp(f, ev.p, 0.3); // 다른 외야수는 백업
      }

    // ── 주자 출발 ──
    let two = st.outs === 2;
    ((bat.state = `run`), (bat.target = 1), (bat.delay = 0.55), (bat.forced = !0));
    for (let r of P.r) {
      if (r === bat) continue;
      r.forced = r.from === 1 ? !0 : r.from === 2 ? bases[0] : bases[0] && bases[1];
      if (two) {
        // 2아웃: 타격과 동시에 출발
        ((r.state = `run`), (r.delay = 0.1), (r.s = r.from + 0.06), (r.target = r.from + 1));
      } else if (bb.kind === `ground`) {
        if (r.forced) ((r.state = `run`), (r.delay = 0.1), (r.target = r.from + 1));
        else if (r.from === 2 && bb.phi > 8) ((r.state = `run`), (r.delay = 0.1), (r.target = 3));
        else if (r.from === 3 && (ev.key === `inf-1b` || ev.key === `inf-2b`)) ((r.state = `run`), (r.delay = 0.1), (r.target = 4));
      } else {
        // 뜬공·라이너: 리드한 채로 타구를 지켜봄
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
      speed = (r) => (r.trot ? 6 : c.run * (r.touched >= 1 || r.from > 0 ? 1.08 : 1)) / BB_LEG, // 베이스/초
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
        return b.toBase === k ? rem : rem + 0.45 + thrT(BB_BASES[b.toBase], k);
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
        let l = leadOf(r);
        return l ? (l.target >= 4 ? 4 : l.target - 1) : 4;
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
      out = (r, k, force, by) => {
        if (!live(r)) return;
        ((r.state = `out`), (r.outT = P.t), P.outs.push({ id: r.id, base: k, t: P.t, force, by }));
        // 뒤 주자가 아웃되면 앞 주자의 포스 상황이 풀림
        for (let i = 0; i < idx(r); i++) P.r[i].forced = !1;
        P.st.outs + P.outs.length >= 3 && finish();
      },
      throwTo = (k) => {
        let h = P.f[P.holder],
          from = { x: h.x, y: h.y },
          to = BB_BASES[k],
          d = dist(from, to),
          tt = d < 7 ? d / c.ifSpd + 0.1 : thrT(from, k), // 가까우면 직접 들고 뛰어감
          rec = P.cover[k] === P.holder ? P.holder : P.cover[k];
        ((P.ball = { mode: `thrown`, from, to, t0: P.t, t1: P.t + tt, toBase: k, receiver: rec, by: P.holder, x: from.x, y: from.y, h: 1.5 }),
          (P.holderBase = null),
          P.throws++,
          rec !== P.holder && (P.f[rec].goal = { ...to }));
        if (rec === P.holder) P.f[P.holder].goal = { ...to };
        // 송구가 다른 곳으로 가면 그 틈에 진루할 수 있는지 다시 판단
        for (let r of P.r) live(r) && r.state === `safe` && decide(r);
      },
      // 수비 판단: 공을 가진 선수가 아웃시킬 수 있는 주자에게 송구
      defense = () => {
        if (P.throws >= 6) return !1;
        let h = P.f[P.holder],
          best = null;
        for (let r of P.r) {
          if (!live(r) || r.delay > 0.5) continue;
          let k = r.state === `run` ? r.target : null;
          if (k == null || P.holderBase === k || k < 1) continue;
          let d = dist(h, BB_BASES[k]),
            tt = Math.min(d < 7 ? d / c.ifSpd + 0.1 : 99, thrT(h, k)),
            rt = runnerTime(r, k);
          if (tt + 0.05 < rt) {
            // 2아웃이면 가장 확실한 아웃, 아니면 앞선 주자(실점 방지) 우선
            let twoOut = P.st.outs + P.outs.length === 2,
              score = (twoOut ? 0 : k * 10) + (isForce(r, k) ? 5 : 0) + (rt - tt) * (twoOut ? 10 : 1);
            (!best || score > best.score) && (best = { k, score });
          }
        }
        if (best) return (throwTo(best.k), !0);
        // 잡을 수 없으면: 달리는 주자가 더 못 가도록 맨 뒤 주자의 다음 베이스로
        let moving = P.r.filter((r) => live(r) && r.state === `run` && r.target > r.s);
        if (moving.length) {
          let kc = Math.min(4, Math.min(...moving.map((r) => r.target)) + 1);
          if (kc !== P.holderBase) return (throwTo(kc), !0);
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
        ((rec.x = b.to.x), (rec.y = b.to.y), (rec.goal = null));
        ((P.ball = { mode: `held`, x: b.to.x, y: b.to.y, h: 1.2 }), (P.holder = b.receiver), (P.holderBase = k), (P.readyAt = P.t + 0.45));
        P.assistBy = b.by; // 이 베이스에서 나오는 아웃은 송구한 선수의 보살
        for (let r of P.r) {
          if (!live(r) || r.state !== `run` || r.target !== k) continue;
          let remain = Math.abs(k - r.s) * BB_LEG;
          if (isForce(r, k) || remain <= 8) out(r, k, isForce(r, k), b.by);
          else if (!r.manual && !r.retouch) setTarget(r, k > r.s ? r.touched : Math.ceil(r.s)); // 늦었으면 되돌아감
        }
      },
      arriveBase = (r) => {
        let k = r.target;
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
          let dx = f.goal.x - f.x,
            dy = f.goal.y - f.y,
            d = Math.hypot(dx, dy),
            m = f.spd * h;
          d <= m ? ((f.x = f.goal.x), (f.y = f.goal.y)) : ((f.x += (dx / d) * m), (f.y += (dy / d) * m));
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
          ((b.x = b.from.x + (b.to.x - b.from.x) * u), (b.y = b.from.y + (b.to.y - b.from.y) * u), (b.h = 1.5 + 2.5 * u * (1 - u)));
          t >= b.t1 && arrive();
        } else if (b.mode === `held` && P.holder) {
          let f = P.f[P.holder];
          ((b.x = f.x), (b.y = f.y));
        }
        if (P.done) return;
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
        // 고정 종료(홈런·파울)
        if (P.fixedEnd != null) {
          t >= P.fixedEnd && finish();
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
      res = { bb, foul: P.foul, homeRun: P.homeRun, distance: P.distance, outsAdded: 0, runs: 0, newBases: [...st.bases] };
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
      throwWhy = (o) => (o.base === 4 ? `${BB_POS[o.by] || pos} 홈 보살` : `${BB_POS[o.by] || pos} → ${baseName(o.base)} 송구 아웃`),
      why = null,
      label;
    if (P.caught) {
      let sac = runs > 0 && total < 3;
      ((why = `${pos} ${sac ? `희생플라이` : KIND_OUT[bb.kind]}`), (label = why));
      otherOuts.length && ((why += ` · 더블플레이`), (label = why));
    } else if (batOut) {
      if (bat.touched === 0)
        ((why = bb.kind === `ground` ? `${pos} ${outs.length >= 2 ? `병살타` : `땅볼`}` : `${pos} → 1루 송구 아웃`), (label = why));
      else ((why = throwWhy(batOut)), (label = `${HIT[bat.touched]} → ${baseName(batOut.base)}에서 아웃`));
    } else {
      let b = bat.state === `scored` ? 4 : Math.round(bat.s),
        fc = bb.kind === `ground` && otherOuts.some((o) => o.force);
      label = P.error ? `${pos} 실책 출루` : fc ? `${pos} 땅볼, 야수선택` : bb.kind === `ground` && ev.infield && b === 1 ? `내야안타` : HIT[b] || `안타`;
      otherOuts.length && ((why = fc ? `${baseName(otherOuts[0].base)} 포스아웃` : throwWhy(otherOuts[0])), (label += ` (주자 ${baseName(otherOuts[0].base)}에서 아웃)`));
      res.batterBase = b;
    }
    runs && !P.caught && (label = `${runs}타점 ` + label);
    let hitText = label,
      color = why ? `#c0392b` : P.error ? `#e67e22` : /홈런/.test(label) ? `#f1c40f` : `#2ecc71`;
    return Object.assign(res, {
      outsAdded: outs.length,
      runs,
      newBases: nb,
      caught: P.caught,
      fieldedBy: ev.key,
      label,
      display: why ? bbOut(why) : P.error ? `실책!<br><span class="bb-out-reason">(${pos})</span>` : hitText,
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

  return { batted, start, play, sample, cfg, basePos };
})();
typeof module !== `undefined` && (module.exports = { BB_SIM, bbFence, BB_FIELD_M, BB_BASES }); // Node 테스트용
