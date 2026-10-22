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
  const arm = (() => {
    const canvas = $('#arm');
    if (!canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext('2d');
    const stage = canvas.parentElement;
    const ro = {
      t1: $('#ro-t1'), t2: $('#ro-t2'), xy: $('#ro-xy'), state: $('#ro-state'),
    };

    // geometry in millimetres; y points up from the shoulder
    const L1 = 180, L2 = 150, REACH = L1 + L2, INNER = L1 - L2;
    const MAX_RATE = 3.4;            // rad/s, roughly a hobby servo under load
    const DEG = 180 / Math.PI;

    let W = 0, H = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
    let colors = {};
    let q1 = Math.PI * 0.5, q2 = -Math.PI * 0.92;   // folded at load
    let target = { x: 150, y: 170 };
    let reachable = true;
    let mode = 'idle';                               // idle | pointer | keys
    let lastInput = -1e9;
    let grip = 0, gripGoal = 0;
    const trail = [];
    let visible = true, rafId = 0, last = performance.now(), t = 0, frame = 0;

    canvas.tabIndex = 0;

    function refreshColors() {
      const cs = getComputedStyle(root);
      const v = n => cs.getPropertyValue(n).trim();
      colors = {
        ink: v('--ink'), ink2: v('--ink-2'), line: v('--line'), plate: v('--plate'),
        grid: v('--grid'), kapton: v('--kapton'),
      };
    }

    function resize() {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      scale = Math.min((W * 0.94) / (2 * REACH), (H * 0.8) / REACH);
      ox = W / 2;
      oy = H * 0.86;
    }

    const toPx = (x, y) => [ox + x * scale, oy - y * scale];
    const toMm = (px, py) => ({ x: (px - ox) / scale, y: (oy - py) / scale });
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

    // analytic two-link IK; prefer the elbow-up solution that keeps both links above the floor
    function solve(tx, ty) {
      let x = tx, y = Math.max(ty, 8);
      let d = Math.hypot(x, y);
      reachable = d <= REACH - 1 && d >= INNER + 1 && ty >= 0;
      const dc = Math.min(Math.max(d, INNER + 2), REACH - 2);
      if (d > 0) { x *= dc / d; y *= dc / d; } else { x = 0; y = dc; }
      const c2 = (dc * dc - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      const options = [1, -1].map(sign => {
        const b = sign * Math.acos(Math.min(1, Math.max(-1, c2)));
        const a = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(b), L1 + L2 * Math.cos(b));
        const elbowY = L1 * Math.sin(a);
        return { a, b, elbowY };
      });
      options.sort((p, q) => q.elbowY - p.elbowY);
      return options[0];
    }

    function idleTarget(time) {
      return { x: 205 * Math.sin(time * 0.42), y: 175 + 75 * Math.sin(time * 0.84 + 0.6) };
    }

    function step(dt) {
      t += dt;
      if (mode !== 'idle' && performance.now() - lastInput > 2600) mode = 'idle';
      if (mode === 'idle' && !reduceMotion.matches) target = idleTarget(t);

      const sol = solve(target.x, target.y);
      if (reduceMotion.matches && mode === 'idle') {
        q1 = sol.a; q2 = sol.b;
      } else {
        const maxStep = MAX_RATE * dt;
        const e1 = wrap(sol.a - q1), e2 = wrap(sol.b - q2);
        // proportional approach, then clamp to the joint rate limit
        q1 += Math.max(-maxStep, Math.min(maxStep, e1 * Math.min(1, dt * 9)));
        q2 += Math.max(-maxStep, Math.min(maxStep, e2 * Math.min(1, dt * 9)));
      }
      grip += (gripGoal - grip) * Math.min(1, dt * 14);
    }

    function fk() {
      const ex = L1 * Math.cos(q1), ey = L1 * Math.sin(q1);
      const tx = ex + L2 * Math.cos(q1 + q2), ty = ey + L2 * Math.sin(q1 + q2);
      return { ex, ey, tx, ty };
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const c = colors;
      const k = scale;

      // millimetre grid, 30 mm pitch
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      const pitch = 30 * k;
      for (let x = ox % pitch; x < W; x += pitch) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
      for (let y = oy % pitch; y < H; y += pitch) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
      ctx.stroke();

      // workspace envelope
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(ox, oy, REACH * k, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(ox, oy, INNER * k, Math.PI, 0); ctx.stroke();
      ctx.setLineDash([]);

      // floor and hatching, just below the shoulder pivot
      const floor = Math.round(oy + 16) + 0.5;
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(W, floor); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = c.line;
      ctx.beginPath();
      for (let x = -20; x < W + 20; x += 12) { ctx.moveTo(x, floor + 1); ctx.lineTo(x - 10, floor + 13); }
      ctx.stroke();

      const { ex, ey, tx, ty } = fk();
      const [sx, sy] = [ox, oy];
      const [epx, epy] = toPx(ex, ey);
      const [tpx, tpy] = toPx(tx, ty);

      // tool trail
      trail.push([tpx, tpy]);
      if (trail.length > 60) trail.shift();
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        ctx.globalAlpha = (i / trail.length) * 0.55;
        ctx.strokeStyle = c.kapton; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // target reticle
      const [gx, gy] = toPx(target.x, Math.max(target.y, 0));
      const rr = Math.max(10, 20 * k);
      ctx.strokeStyle = reachable ? c.kapton : c.ink2;
      ctx.lineWidth = 2;
      if (!reachable) ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(gx, gy, rr * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(gx - rr, gy); ctx.lineTo(gx - rr * 0.3, gy);
      ctx.moveTo(gx + rr * 0.3, gy); ctx.lineTo(gx + rr, gy);
      ctx.moveTo(gx, gy - rr); ctx.lineTo(gx, gy - rr * 0.3);
      ctx.moveTo(gx, gy + rr * 0.3); ctx.lineTo(gx, gy + rr);
      ctx.stroke();
      if (!reachable) {
        ctx.setLineDash([2, 5]); ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.moveTo(tpx, tpy); ctx.lineTo(gx, gy); ctx.stroke();
        ctx.setLineDash([]);
      }

      // shoulder angle arc
      ctx.strokeStyle = c.kapton; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(28, 52 * k), 0, -q1, q1 > 0); ctx.stroke();

      // pedestal
      const pw = Math.max(26, 52 * k);
      ctx.fillStyle = c.ink;
      ctx.beginPath();
      ctx.moveTo(sx - pw, floor); ctx.lineTo(sx - pw * 0.5, sy - 4);
      ctx.lineTo(sx + pw * 0.5, sy - 4); ctx.lineTo(sx + pw, floor);
      ctx.closePath(); ctx.fill();

      // links: dark body with a machined centre line
      const link = (x1, y1, x2, y2, w) => {
        ctx.lineCap = 'round';
        ctx.strokeStyle = c.ink; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = c.plate; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = 1;
      };
      const w1 = Math.max(12, 30 * k), w2 = Math.max(9, 23 * k);
      link(sx, sy, epx, epy, w1);
      link(epx, epy, tpx, tpy, w2);

      // gripper, oriented along link 2
      const ang = Math.atan2(tpy - epy, tpx - epx);
      ctx.save();
      ctx.translate(tpx, tpy); ctx.rotate(ang);
      const open = Math.max(6, 11 * k) * (1 - grip * 0.65), fl = Math.max(13, 26 * k);
      ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -open - 2); ctx.lineTo(0, open + 2);
      ctx.moveTo(0, -open); ctx.lineTo(fl, -open + grip * 2);
      ctx.moveTo(0, open); ctx.lineTo(fl, open - grip * 2);
      ctx.stroke();
      ctx.restore();

      // joints
      const joint = (x, y, r, accent) => {
        ctx.fillStyle = c.plate; ctx.strokeStyle = c.ink; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = accent ? c.kapton : c.ink;
        ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, Math.PI * 2); ctx.fill();
      };
      joint(sx, sy, Math.max(10, w1 * 0.62), true);
      joint(epx, epy, Math.max(8, w2 * 0.66), true);

      // readout, a few times a second is plenty
      if (frame++ % 6 === 0) {
        ro.t1.textContent = (q1 * DEG).toFixed(1) + '°';
        ro.t2.textContent = (q2 * DEG).toFixed(1) + '°';
        ro.xy.textContent = Math.round(tx) + ', ' + Math.round(ty) + ' mm';
        ro.state.textContent = mode === 'idle' ? (reduceMotion.matches ? 'Holding' : 'Idle path')
          : reachable ? 'Tracking' : 'Out of reach';
      }
    }

    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      if (visible && !document.hidden) rafId = requestAnimationFrame(loop);
      else rafId = 0;
    }
    function start() {
      if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(loop); }
    }

    // input
    const setFromEvent = e => {
      const r = canvas.getBoundingClientRect();
      target = toMm(e.clientX - r.left, e.clientY - r.top);
      mode = 'pointer';
      lastInput = performance.now();
      start();
    };
    stage.addEventListener('pointermove', setFromEvent);
    stage.addEventListener('pointerdown', e => { setFromEvent(e); gripGoal = 1; });
    window.addEventListener('pointerup', () => { gripGoal = 0; });
    stage.addEventListener('pointerleave', () => { lastInput = performance.now() - 1800; gripGoal = 0; });

    canvas.addEventListener('keydown', e => {
      const stepMm = e.shiftKey ? 40 : 12;
      const moves = { ArrowLeft: [-stepMm, 0], ArrowRight: [stepMm, 0], ArrowUp: [0, stepMm], ArrowDown: [0, -stepMm] };
      if (moves[e.key]) {
        e.preventDefault();
        if (mode === 'idle') { const f = fk(); target = { x: f.tx, y: f.ty }; }
        target = { x: target.x + moves[e.key][0], y: Math.max(0, target.y + moves[e.key][1]) };
        mode = 'keys'; lastInput = performance.now() + 4000; start();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); gripGoal = gripGoal ? 0 : 1; start();
      }
    });
    canvas.setAttribute('aria-describedby', 'workcell-caption');
    canvas.title = 'Arrow keys move the target, Space toggles the gripper';

    new ResizeObserver(() => { resize(); draw(); }).observe(stage);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    reduceMotion.addEventListener('change', start);

    refreshColors();
    resize();
    // fonts can shift the hero layout after first paint
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { resize(); });
    start();

    return { refreshColors: () => { refreshColors(); start(); } };
  })();
})();
