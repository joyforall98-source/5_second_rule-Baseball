// ── 타자·투수 동작: 3D 뼈대(스켈레톤)를 키프레임으로 보간해 캔버스에 그림 ──
// 관절 위치는 미터 단위. 포즈는 골반·어깨 회전, 상체 기울기, 발·손 위치로 정하고
// 팔·다리는 2관절 IK(역운동학)로 팔꿈치·무릎을 계산합니다. 매 프레임 보간되므로 동작이 끊기지 않음.
var BB_RIG = (() => {
  let rad = (d) => (d * Math.PI) / 180,
    clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)),
    easeOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) * (1 - t)),
    easeIn = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t),
    // 로컬 벡터 {f, u, s}: f = 앞(투수/홈 방향), u = 위, s = 가슴이 향하는 옆 방향(닫힌 자세 기준)
    L = (f = 0, u = 0, s = 0) => ({ f, u, s }),
    add = (a, b) => L(a.f + b.f, a.u + b.u, a.s + b.s),
    sub = (a, b) => L(a.f - b.f, a.u - b.u, a.s - b.s),
    mul = (a, k) => L(a.f * k, a.u * k, a.s * k),
    dot = (a, b) => a.f * b.f + a.u * b.u + a.s * b.s,
    len = (a) => Math.sqrt(dot(a, a)),
    nrm = (a) => mul(a, 1 / (len(a) || 1)),
    lerpV = (a, b, t) => L(a.f + (b.f - a.f) * t, a.u + (b.u - a.u) * t, a.s + (b.s - a.s) * t),
    UP = L(0, 1, 0),
    // 2관절 IK: 시작 a에서 끝 c까지, 길이 l1·l2, pole 쪽으로 굽힘
    ik = (a, c, l1, l2, pole) => {
      let d = sub(c, a),
        D = clamp(len(d), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999),
        dn = nrm(d),
        x = (l1 * l1 - l2 * l2 + D * D) / (2 * D),
        h = Math.sqrt(Math.max(0, l1 * l1 - x * x)),
        pp = sub(pole, mul(dn, dot(pole, dn)));
      return add(add(a, mul(dn, x)), mul(nrm(pp), h));
    },
    // 포즈 보간 (숫자와 벡터 모두)
    blend = (p, q, t) => {
      let o = {};
      for (let k in p) {
        let a = p[k],
          b = q[k] ?? a;
        o[k] = typeof a === `number` ? a + (b - a) * t : lerpV(a, b, t);
      }
      return o;
    },
    // 포즈 → 관절 (로컬 좌표)
    solve = (p) => {
      let a = rad(p.hipYaw),
        b = rad(p.torsoYaw),
        ln = rad(p.lean),
        hipLine = L(Math.cos(a), 0, -Math.sin(a)), // 뒤 → 앞 골반
        chestH = L(Math.sin(a), 0, Math.cos(a)),
        shLine = L(Math.cos(b), 0, -Math.sin(b)), // 뒤 → 앞 어깨
        chestT = L(Math.sin(b), 0, Math.cos(b)),
        spine = nrm(add(mul(UP, Math.cos(ln)), mul(chestT, Math.sin(ln)))),
        pel = p.pel,
        neck = add(pel, mul(spine, 0.52)),
        J = {
          pel,
          neck,
          head: add(add(neck, mul(spine, 0.22)), L(0.02, 0.02, 0)),
          fSh: add(add(neck, mul(shLine, 0.19)), L(0, -0.04, 0)),
          bSh: add(add(neck, mul(shLine, -0.19)), L(0, -0.04, 0)),
          fHip: add(pel, mul(hipLine, 0.12)),
          bHip: add(pel, mul(hipLine, -0.12)),
          chestT,
          chestH,
        };
      // 손: 배트를 쥔 타자는 손 위치 + 배트 방향으로, 투수는 양손 따로
      if (p.bat) {
        let bd = nrm(p.bat);
        ((J.fHand = sub(p.hands, mul(bd, 0.045))), (J.bHand = add(p.hands, mul(bd, 0.045))));
        ((J.knob = sub(J.fHand, mul(bd, 0.07))), (J.tip = add(p.hands, mul(bd, 0.84))));
      } else ((J.fHand = p.handF), (J.bHand = p.handB));
      J.fElb = ik(J.fSh, J.fHand, 0.29, 0.27, add(add(mul(UP, -1), mul(chestT, 0.4)), mul(shLine, 0.25)));
      J.bElb = ik(J.bSh, J.bHand, 0.29, 0.27, p.bElbPole || add(add(mul(UP, -0.6), mul(chestT, -0.2)), mul(shLine, -0.7)));
      let fAnk = add(p.ff, L(0, 0.08, 0)),
        bAnk = add(p.bf, L(0, 0.08, 0));
      J.fAnk = fAnk;
      J.bAnk = bAnk;
      J.fKnee = ik(J.fHip, fAnk, 0.46, 0.45, add(chestH, L(0.35, 0, 0)));
      J.bKnee = ik(J.bHip, bAnk, 0.46, 0.45, add(chestH, L(-0.15, 0, 0)));
      // 발끝: 대체로 가슴 방향
      J.fToe = add(fAnk, mul(nrm(add(p.fToeDir || chestH, L(0.25, 0, 0))), 0.22));
      J.bToe = add(bAnk, mul(nrm(p.bToeDir || chestH), 0.22));
      return J;
    };

  // ── 타자 키프레임 (좌타 기준. f = 투수 쪽, s = 홈플레이트 쪽) ──
  let BAT = {
    stance: { hipYaw: 4, torsoYaw: -4, lean: 20, pel: L(-0.03, 0.9, -0.02), ff: L(0.38, 0, 0.02), bf: L(-0.36, 0, -0.02), hands: L(-0.16, 1.4, 0.2), bat: L(-0.45, 0.82, -0.36) },
    load: { hipYaw: -14, torsoYaw: -22, lean: 19, pel: L(-0.12, 0.88, -0.02), ff: L(0.24, 0.14, 0.04), bf: L(-0.36, 0, -0.02), hands: L(-0.3, 1.44, 0.12), bat: L(-0.58, 0.64, -0.48) },
    stride: { hipYaw: 12, torsoYaw: -18, lean: 20, pel: L(0.02, 0.86, 0), ff: L(0.56, 0, 0.05), bf: L(-0.36, 0, -0.02), hands: L(-0.3, 1.38, 0.14), bat: L(-0.62, 0.5, -0.52) },
    contact: { hipYaw: 72, torsoYaw: 84, lean: 22, pel: L(0.07, 0.86, 0.04), ff: L(0.56, 0, 0.05), bf: L(-0.34, 0.03, 0.02), hands: L(0.1, 1.0, 0.42), bat: L(0.22, -0.06, 1), bToeDir: L(0.6, 0, 1) },
    extend: { hipYaw: 92, torsoYaw: 118, lean: 18, pel: L(0.08, 0.87, 0.04), ff: L(0.56, 0, 0.05), bf: L(-0.32, 0.05, 0.04), hands: L(0.38, 1.12, 0.28), bat: L(0.92, 0.08, 0.36), bToeDir: L(0.8, 0, 0.6) },
    follow: { hipYaw: 100, torsoYaw: 152, lean: 10, pel: L(0.07, 0.9, 0.03), ff: L(0.56, 0, 0.05), bf: L(-0.28, 0.08, 0.06), hands: L(0.04, 1.56, -0.12), bat: L(-0.55, 0.18, -0.82), bToeDir: L(1, 0, 0.3) },
  };
  // ── 투수 키프레임 (우투. f = 홈 방향, s = 닫힌 자세에서 가슴 방향) ──
  let PIT = {
    set: { hipYaw: 82, torsoYaw: 82, lean: 6, pel: L(0, 0.98, 0), ff: L(0.04, 0, 0.16), bf: L(-0.04, 0, -0.16), handF: L(0.22, 1.3, 0.04), handB: L(0.22, 1.3, -0.04) },
    lift: { hipYaw: 4, torsoYaw: -8, lean: 4, pel: L(-0.06, 1.0, 0), ff: L(0.08, 0.56, 0.12), bf: L(-0.06, 0, 0), handF: L(0.06, 1.38, 0.24), handB: L(0.02, 1.38, 0.22) },
    stride: { hipYaw: 32, torsoYaw: -6, lean: 8, pel: L(0.36, 0.84, 0), ff: L(0.98, 0, 0.06), bf: L(-0.06, 0, 0), handF: L(0.78, 1.36, 0.08), handB: L(-0.58, 1.2, -0.14), fToeDir: L(1, 0, 0.3) },
    cock: { hipYaw: 70, torsoYaw: 40, lean: 12, pel: L(0.5, 0.82, 0), ff: L(0.98, 0, 0.06), bf: L(-0.02, 0.02, 0), handF: L(0.48, 1.2, 0.26), handB: L(-0.16, 1.78, -0.26), fToeDir: L(1, 0, 0.3) },
    release: { hipYaw: 90, torsoYaw: 102, lean: 26, pel: L(0.62, 0.8, 0), ff: L(0.98, 0, 0.06), bf: L(0.1, 0.06, -0.04), handF: L(0.3, 1.12, 0.2), handB: L(0.6, 1.74, -0.2), fToeDir: L(1, 0, 0.2), bElbPole: L(-0.3, 0.6, -0.6) },
    follow: { hipYaw: 96, torsoYaw: 124, lean: 46, pel: L(0.7, 0.74, 0.02), ff: L(0.98, 0, 0.06), bf: L(0.0, 0.38, -0.22), handF: L(0.2, 1.0, 0.26), handB: L(0.62, 0.62, 0.36), fToeDir: L(1, 0, 0.2) },
    ready: { hipYaw: 90, torsoYaw: 90, lean: 22, pel: L(0.62, 0.88, 0), ff: L(0.78, 0, 0.26), bf: L(0.6, 0, -0.26), handF: L(0.85, 0.95, 0.12), handB: L(0.85, 0.95, -0.12) },
  };

  // 시간축 키프레임 재생: [[시각, 포즈, 보간], ...]
  let seq = (frames, t) => {
    if (t <= frames[0][0]) return frames[0][1];
    for (let i = 1; i < frames.length; i++)
      if (t <= frames[i][0]) {
        let [t0, p0] = frames[i - 1],
          [t1, p1, fn] = frames[i];
        return blend(p0, p1, (fn || ease)((t - t0) / (t1 - t0)));
      }
    return frames[frames.length - 1][1];
  };

  // ── 그리기 도구 ──
  let cap = (g, a, b, w, color, outline = `#0000008c`) => {
    (g.beginPath(), g.moveTo(a.x, a.y), g.lineTo(b.x, b.y));
    ((g.lineCap = `round`), (g.strokeStyle = outline), (g.lineWidth = w + 2.2), g.stroke());
    ((g.strokeStyle = color), (g.lineWidth = w), g.stroke());
  };

  function create(canvasP, canvasB) {
    let gp = canvasP.getContext(`2d`),
      gb = canvasB.getContext(`2d`),
      dpr = Math.min(2, window.devicePixelRatio || 1),
      paused = !1,
      pausedAt = 0,
      pausedSum = 0,
      clock = () => (paused ? pausedAt : performance.now()) - pausedSum,
      bat = { state: `idle`, t0: 0, from: BAT.stance, hand: `L`, num: 1, trail: [] },
      pit = { state: `idle`, t0: 0 },
      lastBatPose = BAT.stance;
    for (let c of [canvasP, canvasB]) ((c.width = 850 * dpr), (c.height = 580 * dpr));

    // ── 타자 카메라: 포수 뒤, 눈높이 0.8m(스트라이크존 중앙과 같은 높이) ──
    let CAM = { x: 0, y: 0.8, z: -2.8 },
      FOC = 625,
      OX = 425,
      OY = 337.5,
      // 좌타는 1루 쪽(+x), 우타는 3루 쪽(-x). 모델을 살짝 돌려 등이 보이게(실제 중계 화면 느낌)
      batWorld = (v) => {
        let side = bat.hand === `R` ? -1 : 1,
          yaw = rad(32),
          // 로컬 → 좌타 월드: f → +z(투수), s → -x(홈 쪽), u → +y
          x0 = -v.s,
          z0 = v.f,
          x = x0 * Math.cos(yaw) + z0 * Math.sin(yaw),
          z = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
        return { x: side * (0.78 + x), y: v.u, z: 0.15 + z };
      },
      projB = (v) => {
        let w = batWorld(v),
          Z = w.z - CAM.z;
        return { x: OX + (FOC * (w.x - CAM.x)) / Z, y: OY - (FOC * (w.y - CAM.y)) / Z, s: FOC / Z, z: Z };
      },
      // ── 투수: 마운드(화면 425, 262)에 작게. 홈(카메라) 쪽을 향함 ──
      PS = 27,
      projP = (v) => {
        // 로컬 → 월드: f → -z(홈), s → -x(닫힌 자세에서 가슴이 3루 쪽), u → +y
        let x = -v.s,
          z = -v.f;
        return { x: 425 + x * PS, y: 262 - v.u * PS, s: PS, z };
      };

    let batPose = (t) => {
        let d = (t - bat.t0) / 1000,
          B = BAT;
        switch (bat.state) {
          case `load`:
            return seq([[0, bat.from], [0.26, B.load], [0.34, B.load], [0.52, B.stride]], d);
          case `swing`:
            return seq([[0, bat.from], [0.11, B.contact, easeIn], [0.18, B.extend, (x) => x], [0.44, B.follow, easeOut]], d);
          case `take`:
            return seq([[0, bat.from], [0.45, B.stance]], d);
          default: {
            // 대기: 배트를 가볍게 흔듦
            let w = Math.sin(t / 380) * 0.07,
              p = blend(bat.from, B.stance, ease(d / 0.5));
            return { ...p, bat: add(p.bat, L(w, 0, -w * 0.6)), hands: add(p.hands, L(0, Math.sin(t / 520) * 0.012, 0)) };
          }
        }
      },
      pitPose = (t) => {
        let d = (t - pit.t0) / 1000,
          Pp = PIT;
        switch (pit.state) {
          case `windup`: // 1.2초 뒤 릴리스
            return seq([[0, Pp.set], [0.5, Pp.lift], [0.9, Pp.stride], [1.08, Pp.cock], [1.2, Pp.release, easeIn]], d);
          case `release`:
            return seq([[0, Pp.release], [0.3, Pp.follow, easeOut], [1.1, Pp.follow], [1.7, Pp.ready]], d);
          default:
            return Pp.set;
        }
      };

    function drawFigure(g, J, proj, style) {
      let P = {};
      for (let k in J) J[k] && J[k].f !== void 0 && (P[k] = proj(J[k]));
      let k = P.pel.s,
        items = [],
        push = (z, fn) => items.push({ z, fn }),
        zOf = (...ks) => ks.reduce((a, b) => a + P[b].z, 0) / ks.length;
      // 다리
      for (let sd of [`b`, `f`]) {
        push(zOf(sd + `Hip`, sd + `Knee`), () => cap(g, P[sd + `Hip`], P[sd + `Knee`], 0.145 * k, style.pants));
        push(zOf(sd + `Knee`, sd + `Ank`) - 0.01, () => {
          let mid = { x: (P[sd + `Knee`].x * 0.45 + P[sd + `Ank`].x * 0.55), y: (P[sd + `Knee`].y * 0.45 + P[sd + `Ank`].y * 0.55) };
          (cap(g, P[sd + `Knee`], mid, 0.115 * k, style.pants), cap(g, mid, P[sd + `Ank`], 0.095 * k, style.socks));
        });
        push(zOf(sd + `Ank`, sd + `Toe`) - 0.02, () => cap(g, P[sd + `Ank`], P[sd + `Toe`], 0.09 * k, `#151515`));
      }
      // 몸통 (어깨~골반 사각형) + 등번호
      push(zOf(`fSh`, `bSh`, `fHip`, `bHip`), () => {
        let q = [P.fSh, P.bSh, P.bHip, P.fHip];
        (g.beginPath(), q.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))), g.closePath());
        ((g.lineJoin = `round`), (g.strokeStyle = `#0000008c`), (g.lineWidth = 0.13 * k + 2.2), g.stroke());
        ((g.fillStyle = style.jersey), (g.strokeStyle = style.jersey), (g.lineWidth = 0.13 * k), g.fill(), g.stroke());
        // 벨트
        cap(g, P.fHip, P.bHip, 0.06 * k, style.belt, `transparent`);
        // 등이 카메라 쪽이면 등번호
        if (style.num != null) {
          let back = proj(sub(J.neck, mul(J.chestT, 0.3))),
            front = proj(add(J.neck, mul(J.chestT, 0.3))),
            facing = back.z < front.z, // 등이 더 가까움
            cx = (P.fSh.x + P.bSh.x + P.fHip.x + P.bHip.x) / 4,
            cy = (P.fSh.y + P.bSh.y) / 2 * 0.55 + (P.fHip.y + P.bHip.y) / 2 * 0.45,
            wsh = Math.abs(P.fSh.x - P.bSh.x) / (0.38 * k);
          facing &&
            wsh > 0.25 &&
            (g.save(),
            g.translate(cx, cy),
            g.scale(Math.min(1, wsh), 1),
            (g.font = `900 ${0.2 * k}px "Arial Black", Arial, sans-serif`),
            (g.textAlign = `center`),
            (g.textBaseline = `middle`),
            (g.fillStyle = style.numColor),
            g.fillText(String(style.num), 0, 0),
            g.restore());
        }
      });
      // 팔 (뒤 팔 → 앞 팔은 깊이로 정렬)
      for (let sd of [`b`, `f`]) {
        push(zOf(sd + `Sh`, sd + `Elb`), () => cap(g, P[sd + `Sh`], P[sd + `Elb`], 0.11 * k, style.sleeve));
        push(zOf(sd + `Elb`, sd + `Hand`), () => {
          (cap(g, P[sd + `Elb`], P[sd + `Hand`], 0.085 * k, style.skin),
            g.beginPath(),
            g.arc(P[sd + `Hand`].x, P[sd + `Hand`].y, Math.max(1.5, (sd === `f` ? style.fGloveR : 0.05) * k), 0, 7),
            (g.fillStyle = sd === `f` ? style.fGlove : style.glove),
            g.fill());
        });
      }
      // 배트 (손잡이 가늘고 배럴 굵게) + 스윙 잔상
      if (P.tip) {
        push(Math.min(P.knob.z, P.tip.z) - 0.05, () => {
          for (let i = 0; i < style.trail.length; i++) {
            let [a, b] = style.trail[i];
            ((g.globalAlpha = 0.07 + 0.05 * i), cap(g, a, b, 0.05 * k, `#d9a463`, `transparent`));
          }
          g.globalAlpha = 1;
          let a = P.knob,
            b = P.tip,
            dx = b.x - a.x,
            dy = b.y - a.y,
            l = Math.hypot(dx, dy) || 1,
            nx = -dy / l,
            ny = dx / l,
            w0 = 0.016 * k,
            w1 = 0.034 * k,
            m = { x: a.x + dx * 0.45, y: a.y + dy * 0.45 },
            grad = g.createLinearGradient(a.x + nx * w1, a.y + ny * w1, a.x - nx * w1, a.y - ny * w1);
          (grad.addColorStop(0, `#7d4f24`), grad.addColorStop(0.45, `#e2b070`), grad.addColorStop(1, `#8a5a2b`));
          (g.beginPath(),
            g.moveTo(a.x + nx * w0, a.y + ny * w0),
            g.lineTo(m.x + nx * w0 * 1.1, m.y + ny * w0 * 1.1),
            g.lineTo(b.x + nx * w1, b.y + ny * w1),
            g.arc(b.x, b.y, w1, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, !0),
            g.lineTo(m.x - nx * w0 * 1.1, m.y - ny * w0 * 1.1),
            g.lineTo(a.x - nx * w0, a.y - ny * w0),
            g.closePath(),
            (g.fillStyle = grad),
            g.fill(),
            (g.strokeStyle = `#0000008c`),
            (g.lineWidth = 1),
            g.stroke());
          (g.beginPath(), g.arc(a.x, a.y, w0 * 1.5, 0, 7), (g.fillStyle = `#5c3a1a`), g.fill());
        });
      }
      // 머리 (헬멧/모자): 어깨 위에 있으므로 몸통보다 나중에 그림
      push(Math.min(P.head.z, P.neck.z) - 0.25, () => {
        let h = P.head,
          r = style.headR * k;
        (cap(g, P.neck, h, 0.09 * k, style.skin),
          g.beginPath(),
          g.arc(h.x, h.y, r, 0, 7),
          (g.fillStyle = style.helmet),
          g.fill(),
          (g.strokeStyle = `#0000008c`),
          (g.lineWidth = 1.2),
          g.stroke(),
          g.beginPath(),
          g.ellipse(h.x - r * 0.3, h.y - r * 0.35, r * 0.4, r * 0.22, -0.5, 0, 7),
          (g.fillStyle = `#ffffff30`),
          g.fill());
        // 챙: 시선(f) 방향
        let fwd = proj(add(J.head, L(0.14, -0.03, 0)));
        (g.beginPath(), g.ellipse((h.x + fwd.x) / 2, (h.y + fwd.y) / 2 + r * 0.25, r * 0.75, r * 0.28, 0, 0, 7), (g.fillStyle = style.helmet), g.fill());
      });
      items.sort((a, b) => b.z - a.z).forEach((it) => it.fn());
    }

    let BAT_STYLE = { jersey: `#f4f5f8`, pants: `#e6e8ee`, socks: `#1b2944`, belt: `#1b2944`, sleeve: `#f4f5f8`, skin: `#d7a77c`, glove: `#222`, fGlove: `#222`, fGloveR: 0.05, helmet: `#13284b`, headR: 0.125, numColor: `#1b2944`, trail: [] },
      PIT_STYLE = { jersey: `#d9dce2`, pants: `#cfd3da`, socks: `#1b2944`, belt: `#1b2944`, sleeve: `#d9dce2`, skin: `#d7a77c`, glove: `#d7a77c`, fGlove: `#7a4a1f`, fGloveR: 0.09, helmet: `#1b2944`, headR: 0.11, num: null, trail: [] };

    let raf = 0,
      visible = !0,
      frame = () => {
        raf = requestAnimationFrame(frame);
        if (!visible) return;
        let t = clock();
        // 투수
        (gp.setTransform(dpr, 0, 0, dpr, 0, 0), gp.clearRect(0, 0, 850, 580));
        let pj = solve(pitPose(t));
        // 그림자
        ((gp.fillStyle = `#00000040`), gp.beginPath(), gp.ellipse(425 + 0.3 * PS, 263, 0.9 * PS, 0.12 * PS, 0, 0, 7), gp.fill());
        drawFigure(gp, pj, projP, PIT_STYLE);
        // 타자
        (gb.setTransform(dpr, 0, 0, dpr, 0, 0), gb.clearRect(0, 0, 850, 580));
        let bp = batPose(t);
        lastBatPose = bp;
        let bj = solve(bp),
          sh = projB(L(0, 0, 0));
        ((gb.fillStyle = `#00000045`), gb.beginPath(), gb.ellipse(sh.x, sh.y + 4, 0.75 * sh.s, 0.12 * sh.s, 0, 0, 7), gb.fill());
        // 스윙 잔상: 최근 배트 위치 몇 개
        let d = (t - bat.t0) / 1000;
        bat.state === `swing` && d < 0.3 ? (bat.trail.push([projB(bj.knob), projB(bj.tip)]), bat.trail.length > 6 && bat.trail.shift()) : (bat.trail.length = 0);
        BAT_STYLE.trail = bat.trail;
        BAT_STYLE.num = bat.num;
        drawFigure(gb, bj, projB, BAT_STYLE);
      };
    raf = requestAnimationFrame(frame);

    return {
      batter(state) {
        ((bat.from = lastBatPose), (bat.state = state), (bat.t0 = clock()), (bat.trail.length = 0));
      },
      pitcher(state) {
        ((pit.state = state), (pit.t0 = clock()));
      },
      setHand(h) {
        bat.hand = h;
      },
      setNumber(n) {
        bat.num = n;
      },
      setVisible(v) {
        visible = v;
      },
      pause(p) {
        p && !paused ? ((paused = !0), (pausedAt = performance.now())) : !p && paused && ((paused = !1), (pausedSum += performance.now() - pausedAt));
      },
      // 릴리스 순간 투수의 손 위치 (공이 출발하는 화면 좌표)
      releasePoint() {
        let j = solve(PIT.release);
        return projP(j.bHand);
      },
      destroy() {
        cancelAnimationFrame(raf);
      },
    };
  }
  return { create };
})();
