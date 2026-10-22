/* Shreyas Sharma — portfolio interactions. No dependencies. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /* ---------------------------------------------------------------- theme */
  const root = document.documentElement;
  const themeBtn = $('.theme-btn');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches;
  const syncThemeLabel = () => {
    themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  };
  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    syncThemeLabel();
    arm && arm.refreshColors();
  });
  darkQuery.addEventListener('change', () => { syncThemeLabel(); arm && arm.refreshColors(); });
  syncThemeLabel();

  /* ------------------------------------------------------------ header/nav */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const nav = $('.site-nav');
  const menuBtn = $('.menu-btn');
  const closeMenu = () => { nav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  $$('#nav-list a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', e => { if (!nav.contains(e.target)) closeMenu(); });

  // mark the section currently in view
  const links = new Map($$('#nav-list a').map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.removeAttribute('aria-current'));
      const id = en.target.id === 'open-source' ? 'builds' : en.target.id === 'education' ? 'skills' : en.target.id;
      const a = links.get(id);
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => spy.observe(s));

  /* --------------------------------------------------------- build filter */
  const chips = $$('.filters .chip');
  const builds = $$('.builds > li');
  const empty = $('.filter-empty');
  chips.forEach(chip => chip.addEventListener('click', () => {
    const f = chip.dataset.filter;
    chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    let shown = 0;
    builds.forEach(li => {
      const show = f === 'all' || li.dataset.area === f;
      li.hidden = !show;
      if (show) shown++;
    });
    empty.hidden = shown > 0;
  }));

  /* ----------------------------------------------------------- copy email */
  $$('.copy-btn').forEach(btn => btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Email copied';
    } catch (e) {
      btn.textContent = 'Copy failed, select it instead';
    }
    setTimeout(() => { btn.textContent = label; }, 2200);
  }));

  /* ------------------------------------------------------------- the arm */
  // A two-link arm with a wrist that keeps the gripper pointing down. Left alone it
  // rebuilds its blocks into a new shape on the opposite side; a visitor can take over
  // and pick blocks up. Units are millimetres, y up, origin at the shoulder pivot.
  const arm = (() => {
    const canvas = $('#arm');
    if (!canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext('2d');
    const stage = canvas.parentElement;
    const ro = { t1: $('#ro-t1'), t2: $('#ro-t2'), xy: $('#ro-xy'), state: $('#ro-state') };

    const L1 = 180, L2 = 150, REACH = L1 + L2, INNER = L1 - L2;
    const G = 34;                    // wrist pivot to fingertips
    const FLOOR = -25;               // floor height relative to the shoulder
    const BW = 36, BH = 36;          // block size
    const GRIP_Y = 10;               // fingertips sit this far above a held block's base
    const MAX_RATE = 3.4;            // rad/s joint slew limit
    const TRAVEL = 300, DESCEND = 170; // mm/s for planned Cartesian moves
    const GAP_OPEN = 27, GAP_HELD = BW / 2 + 2, GAP_SHUT = 5;
    const DEG = 180 / Math.PI;
    const MIN_X = 78, MAX_X = REACH - 34; // where blocks can rest on the floor

    let W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
    let colors = {};
    let q1 = Math.PI * 0.5, q2 = -Math.PI * 0.92;     // folded at load
    let tip = { x: 0, y: 0 };                          // fingertip point actually reached
    let goal = { x: -200, y: 120 };                    // where the fingertips are heading
    let reachable = true;
    let mode = 'auto';                                 // auto | pointer | keys
    let lastInput = -1e9;
    let gripIntent = 0;                                // 1 = trying to close
    let gap = GAP_OPEN;
    let held = null;
    const trail = [];
    let visible = true, rafId = 0, last = performance.now(), frame = 0;

    // ---- blocks and shapes
    const S = 40; // slot pitch
    const SHAPES = [
      { name: 'Pyramid', slots: [[-1, 0], [0, 0], [1, 0], [-0.5, 1], [0.5, 1], [0, 2]] },
      { name: 'Wall',    slots: [[-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] },
      { name: 'Stairs',  slots: [[-1, 0], [0, 0], [1, 0], [0, 1], [1, 1], [1, 2]] },
      { name: 'Tower',   slots: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] },
    ];
    let shapeIdx = 0, side = 1, shapePause = 0;
    const slotPos = (i, sh = SHAPES[shapeIdx], sd = side) => ({
      x: sd * 190 + sd * sh.slots[i][0] * S,
      y: FLOOR + sh.slots[i][1] * BH,
    });

    const blocks = [];
    function initBlocks(prebuilt) {
      blocks.length = 0;
      for (let i = 0; i < 6; i++) {
        const accent = i === 2 || i === 5;
        if (prebuilt) {
          const p = slotPos(i, SHAPES[0], 1);
          blocks.push({ x: p.x, y: p.y, vy: 0, accent });
        } else {
          blocks.push({ x: -310 + i * 44, y: FLOOR, vy: 0, accent });
        }
      }
      if (prebuilt) { shapeIdx = 1; side = -1; }
    }

    const overlaps = (a, b) => Math.abs(a.x - b.x) < BW - 1;
    function supportUnder(b) {
      let s = FLOOR;
      for (const o of blocks) {
        if (o === b || o === held) continue;
        const top = o.y + BH;
        if (overlaps(o, b) && top <= b.y + 0.5 && top > s) s = top;
      }
      return s;
    }
    function settled() { return blocks.every(b => b === held || b.vy === 0); }

    function physics(dt) {
      // lower blocks first so stacks settle bottom-up
      const order = blocks.filter(b => b !== held).sort((a, b) => a.y - b.y);
      for (const b of order) {
        const s = supportUnder(b);
        if (b.y > s + 0.01) {
          b.vy -= 2400 * dt;
          b.y += b.vy * dt;
          if (b.y <= s) { b.y = s; b.vy = 0; }
        } else { b.y = s; b.vy = 0; }
      }
      if (held) { held.x = tip.x; held.y = tip.y - GRIP_Y; held.vy = 0; }
    }

    function release() {
      if (!held) return;
      const b = held;
      held = null;
      // keep dropped blocks off the pedestal and inside the workspace
      const sgn = b.x < 0 ? -1 : 1;
      b.x = sgn * Math.min(MAX_X, Math.max(MIN_X, Math.abs(b.x)));
      b.vy = 0;
    }
    function tryGrasp() {
      if (held) return;
      for (const b of blocks) {
        if (Math.abs(b.x - tip.x) < 13 && tip.y > b.y + 2 && tip.y < b.y + BH - 4) {
          // only lift a block with nothing resting on it
          const covered = blocks.some(o => o !== b && overlaps(o, b) && o.y >= b.y + BH - 0.5);
          if (!covered) { held = b; return; }
        }
      }
    }

    // ---- autonomous planner: a queue of Cartesian waypoints and gripper actions
    let plan = [];
    let leg = null;          // current straight-line move
    let waitT = 0;

    function slotFilled(i) {
      const p = slotPos(i);
      return blocks.some(b => b !== held && b.vy === 0 && Math.abs(b.x - p.x) < 6 && Math.abs(b.y - p.y) < 2);
    }
    function nextTask() {
      const n = SHAPES[shapeIdx].slots.length;
      let k = 0;
      while (k < n && slotFilled(k)) k++;
      if (k === n) return { done: true };
      const used = new Set();
      for (let i = 0; i < k; i++) {
        const p = slotPos(i);
        const b = blocks.find(b => Math.abs(b.x - p.x) < 6 && Math.abs(b.y - p.y) < 2);
        if (b) used.add(b);
      }
      if (held) return { src: held, dst: slotPos(k), k };
      const free = blocks.filter(b => !used.has(b) &&
        !blocks.some(o => o !== b && overlaps(o, b) && o.y >= b.y + BH - 0.5));
      if (!free.length) return null;
      // clear the build site first, otherwise take the highest free block
      const inSite = b => Math.sign(b.x) === side && Math.abs(b.x - side * 190) < S * 1.5 + BW;
      free.sort((a, b) => (inSite(b) - inSite(a)) || (b.y - a.y));
      return { src: free[0], dst: slotPos(k), k };
    }

    function stackTop(x) {
      let top = FLOOR;
      for (const b of blocks) if (b !== held && Math.abs(b.x - x) < BW * 2) top = Math.max(top, b.y + BH);
      return top;
    }
    // highest fingertip height the wrist can still reach above x
    const maxTipY = x => Math.sqrt(Math.max(0, (REACH - 8) ** 2 - x * x)) - G;
    function travelHeight(x1, x2) {
      let top = FLOOR;
      const lo = Math.min(x1, x2) - BW, hi = Math.max(x1, x2) + BW;
      for (const b of blocks) if (b !== held && b.x > lo && b.x < hi) top = Math.max(top, b.y + BH);
      // fingertips must clear the highest stack, plus the block being carried
      return Math.min(top + BH + GRIP_Y + 26, maxTipY(x1), maxTipY(x2));
    }

    function buildPlan(task) {
      const steps = [];
      const from = task.src, to = task.dst;
      if (task.src !== held) {
        const up = Math.min(Math.max(stackTop(from.x) + 30, tip.y), maxTipY(from.x), maxTipY(tip.x));
        steps.push({ to: { x: tip.x, y: up }, v: TRAVEL });
        steps.push({ to: { x: from.x, y: Math.min(Math.max(up, from.y + GRIP_Y + 30), maxTipY(from.x)) }, v: TRAVEL });
        steps.push({ to: { x: from.x, y: from.y + GRIP_Y }, v: DESCEND, fine: true });
        steps.push({ grip: 1 });
      }
      const h = travelHeight(from.x, to.x);
      steps.push({ to: { x: from.x, y: h }, v: DESCEND, carry: true });
      steps.push({ to: { x: to.x, y: h }, v: TRAVEL, carry: true });
      steps.push({ to: { x: to.x, y: to.y + GRIP_Y + 4 }, v: DESCEND, fine: true, carry: true });
      steps.push({ grip: 0 });
      steps.push({ to: { x: to.x, y: to.y + GRIP_Y + BH + 14 }, v: DESCEND });
      return steps;
    }

    function runAuto(dt) {
      if (shapePause > 0) { shapePause -= dt; return; }
      if (!plan.length && !leg) {
        if (!settled()) return;
        const t = nextTask();
        if (!t) return;
        if (t.done) {
          shapePause = 1.6;
          shapeIdx = (shapeIdx + 1) % SHAPES.length;
          side = -side;
          return;
        }
        plan = buildPlan(t);
        gripIntent = held ? 1 : 0;
      }
      if (waitT > 0) { waitT -= dt; return; }
      if (!leg) {
        const s = plan.shift();
        if (!s) return;
        if ('grip' in s) {
          gripIntent = s.grip;
          if (!s.grip) release();
          waitT = 0.28;
          return;
        }
        if (s.carry && !held) { plan = []; return; }   // lost the block: replan
        leg = { from: { x: goal.x, y: goal.y }, to: s.to, v: s.v, t: 0, age: 0, fine: s.fine,
          len: Math.hypot(s.to.x - goal.x, s.to.y - goal.y) };
      }
      leg.t += dt * leg.v;
      leg.age += dt;
      const f = leg.len < 0.5 ? 1 : Math.min(1, leg.t / leg.len);
      const e = f < 1 ? f * f * (3 - 2 * f) : 1;   // smoothstep along the segment
      goal = { x: leg.from.x + (leg.to.x - leg.from.x) * e, y: leg.from.y + (leg.to.y - leg.from.y) * e };
      const near = Math.hypot(tip.x - goal.x, tip.y - goal.y) < (leg.fine ? 1.5 : 6);
      if (f >= 1 && (near || leg.age > leg.len / leg.v + 1.5)) leg = null;
    }

    // ---- kinematics
    const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
    function solve(tx, ty) {
      // IK is solved for the wrist, which sits G above the fingertips
      let x = tx, y = ty + G;
      const d = Math.hypot(x, y);
      reachable = d <= REACH - 1 && d >= INNER + 1;
      const dc = Math.min(Math.max(d, INNER + 2), REACH - 2);
      if (d > 0) { x *= dc / d; y *= dc / d; } else { y = dc; }
      const c2 = (dc * dc - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      const opts = [1, -1].map(sg => {
        const b = sg * Math.acos(Math.min(1, Math.max(-1, c2)));
        const a = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(b), L1 + L2 * Math.cos(b));
        return { a, b, ey: L1 * Math.sin(a) };
      });
      opts.sort((p, q) => q.ey - p.ey);
      return opts[0];
    }
    function fk() {
      const ex = L1 * Math.cos(q1), ey = L1 * Math.sin(q1);
      const wx = ex + L2 * Math.cos(q1 + q2), wy = ey + L2 * Math.sin(q1 + q2);
      return { ex, ey, wx, wy, tx: wx, ty: wy - G };
    }

    function clampGoal(g) {
      const minY = held ? FLOOR + GRIP_Y : FLOOR + 3;
      return { x: Math.max(-REACH, Math.min(REACH, g.x)), y: Math.max(minY, Math.min(REACH, g.y)) };
    }

    function step(dt) {
      const now = performance.now();
      if (mode !== 'auto' && now - lastInput > 2600 && !(gripIntent && !held)) {
        mode = 'auto'; plan = []; leg = null; waitT = 0;
      }
      if (mode === 'auto' && !reduceMotion.matches) runAuto(dt);

      const g = clampGoal(goal);
      const sol = solve(g.x, g.y);
      const maxStep = MAX_RATE * dt;
      const e1 = wrapA(sol.a - q1), e2 = wrapA(sol.b - q2);
      q1 += Math.max(-maxStep, Math.min(maxStep, e1 * Math.min(1, dt * 11)));
      q2 += Math.max(-maxStep, Math.min(maxStep, e2 * Math.min(1, dt * 11)));
      q1 = wrapA(q1); q2 = wrapA(q2);
      const k = fk();
      tip = { x: k.tx, y: k.ty };

      // the gripper closes only once the fingertips have arrived, like a real pick
      const arrived = Math.hypot(tip.x - g.x, tip.y - g.y) < 5;
      let gapGoal = GAP_OPEN;
      if (gripIntent && (arrived || held)) gapGoal = held ? GAP_HELD : GAP_SHUT;
      if (!gripIntent) gapGoal = GAP_OPEN;
      gap += (gapGoal - gap) * Math.min(1, dt * 12);
      if (gripIntent && !held && gap < GAP_OPEN - 2 && gap > GAP_SHUT + 4) tryGrasp();
      if (!gripIntent && held && gap > GAP_HELD + 2) release();

      physics(dt);
    }

    // ---- drawing
    function refreshColors() {
      const cs = getComputedStyle(root);
      const v = n => cs.getPropertyValue(n).trim();
      colors = { ink: v('--ink'), ink2: v('--ink-2'), line: v('--line'), plate: v('--plate'),
        steel: v('--steel'), grid: v('--grid'), kapton: v('--kapton') };
    }
    function resize() {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      scale = Math.min((W * 0.94) / (2 * REACH), (H * 0.8) / (REACH - FLOOR));
      ox = W / 2;
      oy = H - 34 - (0 - FLOOR) * scale;
    }
    const P = (x, y) => [ox + x * scale, oy - y * scale];

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function drawBlock(b) {
      const c = colors, k = scale;
      const [x, y] = P(b.x - BW / 2, b.y + BH);
      const w = BW * k, h = BH * k;
      roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(2, 3 * k));
      ctx.fillStyle = b.accent ? c.kapton : c.steel;
      ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = c.ink; ctx.stroke();
      // a small bore, so they read as machined parts rather than squares
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.max(1.5, 4 * k), 0, Math.PI * 2);
      ctx.fillStyle = b.accent ? c.ink : c.ink2; ctx.fill();
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const c = colors, k = scale;
      const floorPx = Math.round(P(0, FLOOR)[1]) + 0.5;

      // 30 mm grid
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath();
      const pitch = 30 * k;
      for (let x = ox % pitch; x < W; x += pitch) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
      for (let y = floorPx % pitch; y < H; y += pitch) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
      ctx.stroke();

      // reach envelope for the wrist, drawn for the fingertips
      ctx.setLineDash([4, 6]); ctx.strokeStyle = c.line; ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(ox, oy + G * k, REACH * k, Math.PI, 0); ctx.stroke();
      ctx.setLineDash([]);

      // floor
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, floorPx); ctx.lineTo(W, floorPx); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = c.line; ctx.beginPath();
      for (let x = -20; x < W + 20; x += 12) { ctx.moveTo(x, floorPx + 1); ctx.lineTo(x - 10, floorPx + 13); }
      ctx.stroke();

      // ghost of the shape being built
      if (mode === 'auto' && !reduceMotion.matches) {
        ctx.setLineDash([3, 4]); ctx.strokeStyle = c.ink2; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;
        SHAPES[shapeIdx].slots.forEach((_, i) => {
          if (slotFilled(i)) return;
          const p = slotPos(i);
          const [x, y] = P(p.x - BW / 2, p.y + BH);
          roundRect(x + 1, y + 1, BW * k - 2, BH * k - 2, Math.max(2, 3 * k)); ctx.stroke();
        });
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      blocks.forEach(b => { if (b !== held) drawBlock(b); });

      const { ex, ey, wx, wy } = fk();
      const [sx, sy] = P(0, 0), [epx, epy] = P(ex, ey), [wpx, wpy] = P(wx, wy);
      const [tpx, tpy] = P(tip.x, tip.y);

      // fingertip trail
      trail.push([tpx, tpy]); if (trail.length > 50) trail.shift();
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        ctx.globalAlpha = (i / trail.length) * 0.45; ctx.strokeStyle = c.kapton; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // pointer target
      if (mode !== 'auto') {
        const [gx, gy] = P(goal.x, goal.y), rr = Math.max(10, 20 * k);
        ctx.strokeStyle = reachable ? c.kapton : c.ink2; ctx.lineWidth = 2;
        if (!reachable) ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(gx, gy, rr * 0.55, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(gx - rr, gy); ctx.lineTo(gx - rr * 0.3, gy); ctx.moveTo(gx + rr * 0.3, gy); ctx.lineTo(gx + rr, gy);
        ctx.moveTo(gx, gy - rr); ctx.lineTo(gx, gy - rr * 0.3); ctx.moveTo(gx, gy + rr * 0.3); ctx.lineTo(gx, gy + rr);
        ctx.stroke();
      }

      // shoulder angle arc
      ctx.strokeStyle = c.kapton; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(28, 52 * k), 0, -q1, q1 > 0); ctx.stroke();

      // pedestal
      const pw = Math.max(26, 52 * k);
      ctx.fillStyle = c.ink; ctx.beginPath();
      ctx.moveTo(sx - pw, floorPx); ctx.lineTo(sx - pw * 0.5, sy - 4);
      ctx.lineTo(sx + pw * 0.5, sy - 4); ctx.lineTo(sx + pw, floorPx); ctx.closePath(); ctx.fill();

      const link = (x1, y1, x2, y2, w) => {
        ctx.lineCap = 'round'; ctx.strokeStyle = c.ink; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = c.plate; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1;
      };
      const w1 = Math.max(12, 30 * k), w2 = Math.max(9, 23 * k);
      link(sx, sy, epx, epy, w1);
      link(epx, epy, wpx, wpy, w2);

      if (held) drawBlock(held);

      // wrist housing and two vertical fingers
      const hw = Math.max(8, (GAP_OPEN + 5) * k), hh = Math.max(5, 9 * k);
      ctx.fillStyle = c.ink;
      roundRect(wpx - hw, wpy, hw * 2, hh, 2); ctx.fill();
      ctx.strokeStyle = c.ink; ctx.lineWidth = Math.max(3, 5 * k); ctx.lineCap = 'butt';
      const gp = gap * k;
      ctx.beginPath();
      ctx.moveTo(wpx - gp, wpy + hh); ctx.lineTo(wpx - gp, tpy);
      ctx.moveTo(wpx + gp, wpy + hh); ctx.lineTo(wpx + gp, tpy);
      ctx.stroke();

      const joint = (x, y, r) => {
        ctx.fillStyle = c.plate; ctx.strokeStyle = c.ink; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.kapton; ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, Math.PI * 2); ctx.fill();
      };
      joint(sx, sy, Math.max(10, w1 * 0.62));
      joint(epx, epy, Math.max(8, w2 * 0.66));
      joint(wpx, wpy, Math.max(5, w2 * 0.42));

      if (frame++ % 6 === 0) {
        ro.t1.textContent = (q1 * DEG).toFixed(1) + '°';
        ro.t2.textContent = (q2 * DEG).toFixed(1) + '°';
        ro.xy.textContent = Math.round(tip.x) + ', ' + Math.round(tip.y) + ' mm';
        let s;
        if (mode === 'auto') {
          if (reduceMotion.matches) s = 'Parked';
          else {
            const sh = SHAPES[shapeIdx];
            let n = 0; while (n < sh.slots.length && slotFilled(n)) n++;
            s = shapePause > 0 ? 'Done' : sh.name + ', ' + n + ' of ' + sh.slots.length;
          }
        } else s = held ? 'Holding block' : reachable ? 'Tracking' : 'Out of reach';
        ro.state.textContent = s;
      }
    }

    function loop(now) {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      if (visible && !document.hidden) rafId = requestAnimationFrame(loop);
      else rafId = 0;
    }
    function start() { if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(loop); } }

    // ---- input
    const takeOver = () => {
      if (mode === 'auto') { plan = []; leg = null; waitT = 0; if (!held) gripIntent = 0; }
      lastInput = performance.now();
    };
    const pointAt = e => {
      const r = canvas.getBoundingClientRect();
      goal = { x: (e.clientX - r.left - ox) / scale, y: (oy - (e.clientY - r.top)) / scale };
      takeOver(); mode = 'pointer'; start();
    };
    stage.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) pointAt(e); });
    stage.addEventListener('pointerdown', e => {
      pointAt(e);
      // mouse: hold to grip. touch and pen: each tap toggles the gripper
      gripIntent = e.pointerType === 'mouse' ? 1 : (held || gripIntent ? 0 : 1);
    });
    window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && mode === 'pointer') gripIntent = 0; });
    stage.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse') { gripIntent = 0; lastInput = performance.now() - 1800; }
    });

    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', e => {
      const d = e.shiftKey ? 40 : 12;
      const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
      if (mv) {
        e.preventDefault();
        if (mode === 'auto') goal = { x: tip.x, y: tip.y };
        takeOver(); mode = 'keys'; lastInput = performance.now() + 4000;
        goal = clampGoal({ x: goal.x + mv[0], y: goal.y + mv[1] }); start();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'auto') goal = { x: tip.x, y: tip.y };
        takeOver(); mode = 'keys'; lastInput = performance.now() + 4000;
        gripIntent = held || gripIntent ? 0 : 1; start();
      }
    });
    canvas.setAttribute('aria-describedby', 'workcell-caption');
    canvas.title = 'Arrow keys move the gripper, Space picks up or drops a block';

    new ResizeObserver(() => { resize(); draw(); }).observe(stage);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    reduceMotion.addEventListener('change', start);

    refreshColors();
    resize();
    initBlocks(reduceMotion.matches);
    if (reduceMotion.matches) {
      const s = solve(-120, 150); q1 = s.a; q2 = s.b; goal = { x: -120, y: 150 };
    }
    { const k0 = fk(); tip = { x: k0.tx, y: k0.ty }; goal = reduceMotion.matches ? goal : { x: tip.x, y: tip.y }; }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    start();

    return { refreshColors: () => { refreshColors(); start(); } };
  })();
})();
