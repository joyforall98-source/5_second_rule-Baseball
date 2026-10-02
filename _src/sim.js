// ── 타구·수비·주루 시뮬레이션 (화면과 무관한 순수 계산) ──
// 좌표는 미터. 홈플레이트 (0,0), +y = 중견수 방향, +x = 1루(우측) 방향.
// 타구 각도 phi: 0 = 중앙, +45 = 우측 파울라인, -45 = 좌측 파울라인 (|phi| > 45 는 파울).
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
    dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }),
    at = (phi, s) => ({
      x: Math.sin((phi * Math.PI) / 180) * s,
      y: Math.cos((phi * Math.PI) / 180) * s,
    }),
    IF = [`inf-1b`, `inf-2b`, `inf-ss`, `inf-3b`],
    OF = [`out-lf`, `out-cf`, `out-rf`],
    HIT = [``, `안타`, `2루타`, `3루타`, `그라운드 홈런`],
    HR = [``, `솔로 홈런`, `투런 홈런`, `스리런 홈런`, `만루 홈런`],
    // 난이도별 수비/주루 능력. EASY는 송구가 느리고(22m/s) 수비 반응이 늦음
    cfg = (diff) =>
      diff === `HARD`
        ? { thr: 29, ofSpd: 8.0, ifSpd: 6.4, react: 0.3, run: 7.3, flyErr: 0.015, gbErr: 0.02, transfer: 0.5 }
        : { thr: 21, ofSpd: 7.4, ifSpd: 6.0, react: 0.4, run: 7.3, flyErr: 0.03, gbErr: 0.04, transfer: 0.65 };

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

  function play(bb, st) {
    let c = cfg(st.diff),
      bases = st.bases,
      res = {
        bb,
        ball: [],
        fielders: {},
        runners: {},
        hideAt: {},
        outsAdded: 0,
        runs: 0,
        newBases: [...bases],
        foul: !!bb.foul,
        distance: null,
        dur: 1,
      },
      fpos = (k) => BB_FIELD_M[k],
      spd = (k) => (k.startsWith(`out`) ? c.ofSpd : c.ifSpd),
      need = (k, p, slack) => c.react + Math.max(0, dist(fpos(k), p) - slack) / spd(k),
      // 수비수 이동: 반응시간 후 출발해 tArrive에 도착
      move = (k, to, tArrive) => {
        let f = fpos(k),
          t0 = Math.min(c.react, Math.max(0, tArrive - 0.05));
        res.fielders[k] = [
          [0, f.x, f.y],
          [t0, f.x, f.y],
          [Math.max(t0 + 0.05, tArrive), to.x, to.y],
        ];
      },
      arc = (from, to, t0, t1, H, h0 = 1, h1 = 0) => {
        let n = Math.max(2, Math.ceil((t1 - t0) / 0.08));
        for (let i = 0; i <= n; i++) {
          let u = i / n,
            p = lerp(from, to, u);
          res.ball.push([t0 + (t1 - t0) * u, p.x, p.y, h0 * (1 - u) + h1 * u + 4 * H * u * (1 - u)]);
        }
      },
      roll = (pathFn, t0, t1) => {
        for (let t = t0; t < t1; t += 0.08) {
          let p = pathFn(t);
          res.ball.push([t, p.x, p.y, 0]);
        }
        let p = pathFn(t1);
        res.ball.push([t1, p.x, p.y, 0]);
      },
      throwTo = (from, to, t0, t1) => res.ball.push([t0, from.x, from.y, 1.5], [t1, to.x, to.y, 1.5]),
      // 경로를 따라 가장 먼저 공을 처리할 수 있는 수비수 (공이 지나가는 지점에 먼저 도착)
      intercept = (keys, pathFn, t0, t1, slack) => {
        for (let t = t0; t <= t1; t += 0.05) {
          let p = pathFn(t),
            best = null;
          for (let k of keys) {
            let n = need(k, p, slack);
            n <= t && (!best || n < best.n) && (best = { k, n });
          }
          if (best) return { key: best.k, t, p, n: best.n };
        }
        return null;
      },
      // 끝까지 못 잡으면(드묾) 가장 가까운 외야수가 마지막 지점에서 처리
      interceptOr = (keys, pathFn, t0, t1, slack) =>
        intercept(keys, pathFn, t0, t1, slack) ||
        (() => {
          let p = pathFn(t1),
            k = keys.reduce((a, b) => (dist(fpos(a), p) < dist(fpos(b), p) ? a : b));
          return { key: k, t: Math.max(t1, need(k, p, 1)), p, n: need(k, p, 1) };
        })(),
      runnerList = () => {
        let l = [];
        for (let b of [3, 2, 1]) bases[b - 1] && l.push({ id: `runner-${b}`, from: b });
        return (l.push({ id: `runner-t`, from: 0 }), l);
      },
      forced = (b) => (b === 0 ? !0 : b === 1 ? !0 : b === 2 ? bases[0] : bases[0] && bases[1]),
      batterFirst = 0.55 + BB_LEG / c.run,
      leadFirst = BB_LEG / c.run - 0.15,
      leg = BB_LEG / (c.run * 1.12) + 0.15, // 가속이 붙은 뒤의 한 베이스 (약 3.5초)
      arrival = (r, k, start) => {
        if (k <= r.from) return start;
        let t = r.from === 0 ? batterFirst : start + leadFirst;
        return t + (k - r.from - 1) * leg;
      },
      runTrack = (r, start, target, outT) => {
        let b0 = BB_BASES[r.from],
          tr = [
            [0, b0.x, b0.y],
            [r.from === 0 ? 0 : start, b0.x, b0.y],
          ];
        for (let k = r.from + 1; k <= target; k++) {
          let b = BB_BASES[k];
          tr.push([arrival(r, k, start), b.x, b.y]);
        }
        if (outT != null && target > r.from) {
          let p = lerp(BB_BASES[target - 1], BB_BASES[target], 0.85);
          (tr.pop(), tr.push([outT, p.x, p.y]), (res.hideAt[r.id] = outT + 0.7));
        }
        res.runners[r.id] = tr;
      },
      cover = (base, key) =>
        base === 1
          ? key === `inf-1b` ? `inf-2b` : `inf-1b`
          : base === 2
            ? key === `inf-ss` || key === `inf-3b` ? `inf-2b` : `inf-ss`
            : base === 3
              ? key === `inf-3b` ? `inf-ss` : `inf-3b`
              : `catcher`,
      coverMove = (base, key, tBy) => {
        let ck = cover(base, key);
        ck !== key && move(ck, BB_BASES[base], Math.max(0.6, tBy - 0.3));
      };

    // ── 파울 ──
    if (bb.foul) {
      if (bb.kind === `ground`) {
        let L = at(bb.phi, Math.min(35, bb.v0 * 1.2));
        return (roll((t) => lerp({ x: 0, y: 0 }, L, t / 1.2), 0, 1.2), (res.dur = 1.6), (res.label = `파울`), res);
      }
      let L = at(bb.phi, bb.D),
        H = (9.8 * bb.T ** 2) / 8,
        lateral = bb.D * Math.sin(((Math.abs(bb.phi) - 45) * Math.PI) / 180), // 파울라인에서 벗어난 거리
        best = null;
      if (lateral < 16 && bb.D < 75)
        for (let k of [`catcher`, `inf-1b`, `inf-3b`, `out-lf`, `out-rf`]) {
          let n = need(k, L, 1.5);
          n <= bb.T + 0.1 && (!best || n < best.n) && (best = { k, n });
        }
      if (best && R() > c.flyErr) {
        (arc({ x: 0, y: 0 }, L, 0, bb.T, H, 1, 2), move(best.k, L, Math.min(best.n, bb.T)));
        let why = `${BB_POS[best.k]} 파울플라이`;
        return Object.assign(res, {
          outsAdded: 1,
          foulOut: !0,
          label: why,
          display: bbOut(why),
          status: `${BB_POS[best.k]}가 파울 지역에서 잡아냄`,
          dur: bb.T + 0.8,
        });
      }
      return (arc({ x: 0, y: 0 }, L, 0, bb.T, H), (res.dur = Math.min(bb.T, 2.5) + 0.4), (res.label = `파울`), res);
    }

    let fence = bbFence(bb.phi),
      hit = null; // { key, t, p (처리 지점), runStart, error }

    if (bb.kind === `ground`) {
      // ── 땅볼: 내야수가 막으면 내야 플레이, 빠지면 외야로 굴러간 안타 ──
      let s = (t) => Math.min(fence - 1.5, bb.v0 * 4 * (1 - Math.exp(-t / 4))),
        g = (t) => at(bb.phi, s(t)),
        tPast = 0.15;
      while (s(tPast) < 50 && tPast < 6) tPast += 0.05;
      let f = intercept(IF, g, 0.15, tPast, 1.0);
      if (f) return infieldPlay(f, g);
      let o = interceptOr(OF, g, tPast, 10, 1.0);
      (roll(g, 0, o.t), (res.distance = Math.round(s(o.t))), (hit = { key: o.key, t: o.t, p: o.p, runStart: 0.1 }));
      move(o.key, o.p, o.n);
    } else {
      // ── 뜬공 / 라이너 / 팝업 ──
      let L = at(bb.phi, bb.D),
        H = (9.8 * bb.T ** 2) / 8;
      res.distance = Math.round(bb.D);
      if (bb.kind !== `pop` && bb.D >= fence) {
        let f = fence / bb.D,
          hWall = 1 - f + 4 * H * f * (1 - f);
        if (hWall >= BB_WALL_H) return homeRun(L, H);
        // 펜스 직격: 펜스에 맞고 튀어나옴
        let tw = bb.T * f,
          W = at(bb.phi, fence - 0.5),
          rest = (t) => at(bb.phi, fence - 0.5 - 6 * (1 - Math.exp(-(t - tw) / 0.4)));
        arc({ x: 0, y: 0 }, W, 0, tw, H, 1, hWall);
        let o = interceptOr(OF, (t) => (t < tw ? W : rest(t)), tw, tw + 8, 1.0);
        (roll(rest, tw, o.t), move(o.key, o.p, o.n));
        ((res.wallBall = !0),
          (hit = { key: o.key, t: o.t, p: o.p, runStart: st.outs === 2 ? 0.1 : Math.max(0.3, tw - 1.2) }));
      } else {
        // 잡을 수 있는가? (공이 떨어지기 전에 도착)
        let keys = bb.kind === `pop` ? [...IF, `catcher`, ...OF] : [...OF, ...IF],
          slack = bb.kind === `line` ? 1.0 : 1.6,
          best = null;
        for (let k of keys) {
          let n = need(k, L, slack) + (bb.kind === `line` ? 0.2 : 0); // 라이너는 첫 판단이 늦음
          n <= bb.T + (bb.kind === `line` ? 0 : 0.1) && (!best || n < best.n) && (best = { k, n });
        }
        if (best && R() > c.flyErr) {
          (arc({ x: 0, y: 0 }, L, 0, bb.T, H, 1, 2), move(best.k, L, Math.min(best.n, bb.T)));
          let why = `${BB_POS[best.k]} ${bb.kind === `line` ? `직선타` : bb.kind === `pop` ? `팝플라이` : `뜬공`}`;
          for (let r of runnerList()) r.from && runTrack(r, 0, r.from);
          return Object.assign(res, {
            outsAdded: 1,
            caught: { key: best.k, p: L },
            label: why,
            display: bbOut(why),
            status: `${BB_POS[best.k]}가 타구를 잡아냄`,
            dur: bb.T + 0.8,
          });
        }
        // 떨어진 공: 굴러간 뒤 수비수가 처리
        let err = !!best,
          rl = bb.kind === `line` ? rnd(12, 28) : bb.kind === `pop` ? rnd(1, 4) : rnd(5, 14), // 굴러가는 거리
          end = Math.min(bb.D + rl, fence - 1.5),
          rest = (t) => at(bb.phi, bb.D + (end - bb.D) * (1 - Math.exp(-(t - bb.T) / 0.6)));
        arc({ x: 0, y: 0 }, L, 0, bb.T, H);
        let o = err
          ? { key: best.k, t: bb.T + 0.9, p: L, n: best.n }
          : interceptOr([...OF, ...IF], (t) => (t < bb.T ? L : rest(t)), bb.T, bb.T + 8, 1.0);
        (roll(err ? () => L : rest, bb.T, o.t), move(o.key, o.p, Math.min(o.n, o.t)));
        hit = {
          key: o.key,
          t: o.t,
          p: o.p,
          error: err,
          runStart: st.outs === 2 || bb.kind === `line` ? 0.25 : Math.max(0.3, bb.T - 1.2),
        };
      }
    }
    return advance(hit);

    function homeRun(L, H) {
      arc({ x: 0, y: 0 }, L, 0, bb.T, H);
      let n = bases.filter(Boolean).length + 1;
      for (let r of runnerList()) {
        let tr = [[0, BB_BASES[r.from].x, BB_BASES[r.from].y]];
        for (let k = r.from + 1; k <= 4; k++) tr.push([0.4 + (k - r.from) * 2.2, BB_BASES[k].x, BB_BASES[k].y]);
        res.runners[r.id] = tr;
      }
      return Object.assign(res, {
        homeRun: !0,
        runs: n,
        newBases: [!1, !1, !1],
        batterBase: 4,
        label: HR[n],
        display: `${HR[n]}!<br><span class="bb-out-reason">${Math.round(bb.D)}m · ${n}타점</span>`,
        color: `#f1c40f`,
        status: `담장을 넘겼다! ${Math.round(bb.D)}m ${HR[n]}`,
        dur: bb.T + 1.4,
      });
    }

    // ── 안타 처리 후 주루: 주자마다 송구보다 먼저 도착할 수 있으면 한 베이스 더 ──
    function advance(h) {
      let release = h.t + c.transfer + 0.15,
        thr = (b) => {
          let d = dist(h.p, BB_BASES[b]);
          return release + d / c.thr + (d > 62 ? 0.45 : 0); // 62m 넘으면 중계
        },
        list = runnerList(),
        limit = 4;
      for (let r of list) {
        let start = r.from === 0 ? 0 : h.runStart,
          minB = r.from === 0 ? 1 : forced(r.from) ? r.from + 1 : r.from,
          margin = rnd(-0.35, 0.75), // 주자 성향: 음수면 무리한 주루
          k = r.from;
        while (k + 1 <= limit) {
          let a = arrival(r, k + 1, start);
          if (k + 1 <= minB || a < thr(k + 1) - margin) k++;
          else break;
        }
        ((r.start = start), (r.target = k), (r.arr = arrival(r, k, start)), (limit = k === 4 ? 4 : k - 1));
      }
      // 수비: 잡을 수 있는 주자 중 가장 앞선 주자에게 송구
      let cand = list.filter((r) => r.target > r.from && thr(r.target) < r.arr).sort((a, b) => b.target - a.target)[0],
        lead = list[0],
        tgtBase = cand ? cand.target : Math.min(4, Math.max(2, lead.target === 4 ? 4 : lead.target)),
        tOut = cand ? thr(cand.target) : null;
      throwTo(h.p, BB_BASES[tgtBase], release, thr(tgtBase));
      coverMove(tgtBase, h.key, thr(tgtBase));
      let runs = 0,
        nb = [!1, !1, !1],
        outs3 = cand && st.outs + 1 >= 3;
      for (let r of list) {
        let isOut = r === cand;
        (runTrack(r, r.start, r.target, isOut ? tOut : null),
          isOut ||
            (r.target === 4 ? (!outs3 || r.arr < tOut) && runs++ : r.target > 0 && (nb[r.target - 1] = !0)));
      }
      let bat = list[list.length - 1],
        hitBases = bat === cand ? bat.target - 1 : bat.target,
        hitName = h.error ? `실책 출루` : HIT[hitBases] || `안타`,
        why = cand ? (cand.target === 4 ? `${BB_POS[h.key]} 홈 보살` : `${BB_POS[h.key]} → ${cand.target}루 송구 아웃`) : null,
        rbiText = runs ? `${runs}타점 ` : ``;
      return Object.assign(res, {
        outsAdded: cand ? 1 : 0,
        runs,
        newBases: nb,
        batterBase: bat === cand ? 0 : bat.target,
        label: cand ? `${hitName} → ${why}` : rbiText + hitName,
        display: cand ? bbOut(why) : hitBases === 4 ? `그라운드 홈런!!<br><span class="bb-out-reason">${runs}타점</span>` : rbiText + hitName,
        color: cand ? `#c0392b` : hitBases >= 4 ? `#f1c40f` : `#2ecc71`,
        status: cand
          ? `${hitName}, 그러나 ${why}`
          : `${hitName}! ${res.wallBall ? `펜스 직격, ` : ``}${HIT[bat.target] ? `타자 ${bat.target === 4 ? `홈인` : bat.target + `루까지`}` : ``}`,
        fieldedBy: h.key,
        dur: Math.max(thr(tgtBase), ...list.map((r) => (r === cand ? tOut : r.arr))) + 0.7,
      });
    }

    // ── 내야 땅볼: 포스/병살/1루 송구, 내야안타 ──
    function infieldPlay(f, g) {
      (roll(g, 0, f.t), move(f.key, f.p, f.n), (res.distance = Math.round(dist(f.p, { x: 0, y: 0 }))));
      let err = R() < c.gbErr,
        release = f.t + c.transfer + (err ? 1.4 : 0),
        list = runnerList(),
        r1 = list.find((r) => r.from === 1),
        bat = list[list.length - 1],
        start = 0.1,
        outs = [], // { r, base, t, force }
        B1 = BB_BASES[1],
        B2 = BB_BASES[2],
        tThrow = null,
        lastBall = f.p,
        lastT = release;
      for (let r of list) r.start = r.from === 0 ? 0 : start;
      if (!err && r1 && st.outs < 2 && f.key !== `inf-1b`) {
        let t2 = release + dist(f.p, B2) / c.thr;
        if (t2 < arrival(r1, 2, start)) {
          (outs.push({ r: r1, base: 2, t: t2 }), throwTo(f.p, B2, release, t2), coverMove(2, f.key, t2));
          let t1 = t2 + 0.55 + dist(B2, B1) / c.thr;
          (throwTo(B2, B1, t2 + 0.55, t1), coverMove(1, f.key, t1), (lastT = t1), (lastBall = B1));
          t1 < arrival(bat, 1, 0) && outs.push({ r: bat, base: 1, t: t1 });
          tThrow = !0;
        }
      }
      if (!tThrow && !err) {
        let t1 =
          f.key === `inf-1b` && dist(f.p, B1) < 9
            ? f.t + 0.2 + dist(f.p, B1) / c.ifSpd
            : release + dist(f.p, B1) / c.thr;
        (f.key === `inf-1b` && dist(f.p, B1) < 9
          ? move(f.key, B1, t1)
          : (throwTo(f.p, B1, release, t1), coverMove(1, f.key, t1)),
          (lastT = t1));
        t1 < arrival(bat, 1, 0) && outs.push({ r: bat, base: 1, t: t1 });
      }
      let totalOuts = st.outs + outs.length,
        isOut = (r) => outs.find((o) => o.r === r),
        rightSide = f.key === `inf-1b` || f.key === `inf-2b`;
      for (let r of list) {
        let o = isOut(r);
        if (o) r.target = o.base;
        else if (r.from === 0) r.target = 1;
        else if (forced(r.from) || st.outs === 2) r.target = r.from + 1;
        else if (r.from === 2) r.target = rightSide ? 3 : 2;
        else if (r.from === 3) r.target = f.key === `inf-3b` || f.key === `catcher` ? 3 : 4;
        else r.target = r.from;
        r.arr = arrival(r, r.target, r.start);
      }
      // 앞 주자를 추월하지 않게 정리
      let limit = 4;
      for (let r of list) (isOut(r) || ((r.target = Math.min(r.target, limit)), (r.arr = arrival(r, r.target, r.start))), (limit = r.target === 4 ? 4 : r.target - 1));
      let runs = 0,
        nb = [!1, !1, !1];
      for (let r of list) {
        let o = isOut(r);
        (runTrack(r, r.start, r.target, o ? o.t : null),
          o || (r.target === 4 ? totalOuts < 3 && runs++ : r.target > 0 && (nb[r.target - 1] = !0)));
      }
      let pos = BB_POS[f.key],
        dp = outs.length === 2,
        batOut = isOut(bat),
        why = dp ? `${pos} 병살타` : batOut ? `${pos} 땅볼` : outs.length ? `2루 포스아웃` : null,
        label = err
          ? `${pos} 실책 출루`
          : dp
            ? why
            : batOut
              ? why + (runs ? ` (${runs}타점)` : r1 || bases[1] ? ` (진루타)` : ``)
              : outs.length
                ? `${pos} 땅볼, 야수선택 (2루 포스아웃)`
                : `${runs ? runs + `타점 ` : ``}내야안타`;
      return Object.assign(res, {
        outsAdded: outs.length,
        runs,
        newBases: nb,
        batterBase: batOut ? 0 : 1,
        label,
        display: err ? `실책!<br><span class="bb-out-reason">(${pos})</span>` : why ? bbOut(why) : label,
        color: err ? `#e67e22` : why ? `#c0392b` : `#2ecc71`,
        status: err ? `${pos} 포구 실책! 타자 출루` : dp ? `병살! 아웃카운트 2개` : batOut ? `${pos} 땅볼 아웃` : outs.length ? `2루 포스아웃, 타자는 1루 세이프` : `내야안타! 1루 세이프`,
        fieldedBy: f.key,
        dur: Math.max(lastT, ...list.map((r) => r.arr)) + 0.7,
      });
    }
  }

  // 희생플라이 태그업: 잡은 지점에서 다음 베이스까지 송구 vs 주자
  function tagUp(catchM, fromBase, diff) {
    let c = cfg(diff),
      d = dist(catchM, BB_BASES[fromBase + 1]),
      ballT = c.transfer + 0.2 + d / c.thr + (d > 62 ? 0.45 : 0),
      runT = BB_LEG / c.run + 0.35;
    return runT + rnd(-0.35, 0.35) < ballT;
  }

  return { batted, play, sample, tagUp, cfg };
})();
typeof module !== `undefined` && (module.exports = { BB_SIM, bbFence, BB_FIELD_M, BB_BASES }); // Node 테스트용
