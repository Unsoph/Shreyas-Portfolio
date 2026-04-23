/* main.js — Portfolio interactions and animations */

(() => {
  /* ---- BOOT SEQUENCE ---- */
  const bootLines = [
    '[BOOT] Initializing subsystems...',
    '[OK]   ROS2 Jazzy runtime — rcl_init OK',
    '[OK]   Servo controller — PCA9685 @ 0x40',
    '[OK]   Vision pipeline — EVS-YOLO loaded',
    '[OK]   ONNX Runtime — inference backend ready',
    '[LOAD] Loading project index... 14 entries found',
    '[OK]   RGB-D sensor — depth stream active',
    '[OK]   Serial bridge — 115200 baud / ESP32',
    '[SCAN] Scanning embedded nodes... 3 SmartNodes online',
    '[OK]   MQTT broker — Mosquitto local',
    '[OK]   ByteTrack MOT — tracker initialized',
    '[OK]   OpenCV 4.x — perception module',
    '[OK]   Portfolio renderer initialized',
    '[OK]   All systems nominal',
    '',
    '> READY_'
  ];

  const bootOverlay = document.getElementById('boot-overlay');
  const bootContent = document.getElementById('boot-content');

  let bootIndex = 0;
  let bootSkipped = false;

  function showNextBootLine() {
    if (bootSkipped || bootIndex >= bootLines.length) {
      setTimeout(dismissBoot, 400);
      return;
    }
    const line = document.createElement('div');
    line.className = 'boot-line';
    line.textContent = bootLines[bootIndex];
    if (bootLines[bootIndex].startsWith('[WARN]')) line.classList.add('warn');
    bootContent.appendChild(line);
    requestAnimationFrame(() => line.classList.add('visible'));
    bootIndex++;
    setTimeout(showNextBootLine, 120);
  }

  let dismissRan = false;
  function dismissBoot() {
    if (dismissRan || !bootOverlay) return;
    dismissRan = true;
    bootOverlay.classList.add('fade-out');
    setTimeout(() => {
      if (bootOverlay.parentNode) bootOverlay.remove();
      initAfterBoot();
    }, 600);
  }

  function skipBoot(e) {
    if (bootSkipped) return;
    bootSkipped = true;
    document.removeEventListener('click', skipBoot);
    document.removeEventListener('keydown', skipBoot);
    dismissBoot();
  }

  if (bootOverlay) {
    document.addEventListener('click', skipBoot);
    document.addEventListener('keydown', skipBoot);
    showNextBootLine();
  } else {
    initAfterBoot();
  }

  /* ---- AFTER BOOT ---- */
  function initAfterBoot() {
    initParticles();
    initNav();
    initScrollProgress();
    initBackToTop();
    initBlueprintToggle();
    initSoundToggle();
    initCursor();
    initScrollReveals();
    initContactForm();
  }



  /* ---- PARTICLE CANVAS ---- */
  function initParticles() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const MAX = 100;
    const CONNECT_DIST = 120;
    let w, h, animId;

    function resize() {
      const hero = document.getElementById('hero');
      w = canvas.width = hero.offsetWidth;
      h = canvas.height = hero.offsetHeight;
    }

    function createParticle() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 1.5 + 0.5
      };
    }

    function init() {
      resize();
      particles = Array.from({ length: MAX }, createParticle);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 245, 255, 0.5)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0, 245, 255, ${0.15 * (1 - dist / CONNECT_DIST)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener('resize', () => { resize(); });
  }

  /* ---- NAVIGATION ---- */
  function initNav() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    const links = navLinks?.querySelectorAll('a[href^="#"]') ?? [];
    const sections = document.querySelectorAll('section[id]');

    hamburger?.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      if (navLinks.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    links.forEach(link => {
      link.addEventListener('click', () => navLinks?.classList.remove('open'));
    });

    // Scroll spy
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY + 100;
          sections.forEach(sec => {
            const top = sec.offsetTop;
            const bottom = top + sec.offsetHeight;
            const id = sec.getAttribute('id');
            const link = navLinks?.querySelector(`a[href="#${id}"]`);
            if (scrollY >= top && scrollY < bottom) {
              links.forEach(l => l.classList.remove('active'));
              link?.classList.add('active');
            }
          });
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ---- SCROLL PROGRESS ---- */
  function initScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    window.addEventListener('scroll', () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0%';
    });
  }

  /* ---- SKILLS TABS ---- */




  /* ---- BACK TO TOP ---- */
  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > window.innerHeight);
    });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---- BLUEPRINT TOGGLE ---- */
  function initBlueprintToggle() {
    let btn = document.getElementById('blueprint-toggle');
    if (!btn) return;

    // Clone to prevent double-listener bugs
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    btn = newBtn;

    let isBlueprint = document.body.classList.contains('blueprint');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      isBlueprint = !isBlueprint;
      
      if (isBlueprint) {
        document.body.classList.add('blueprint');
        btn.classList.add('active');
        btn.textContent = 'NORMAL';
      } else {
        document.body.classList.remove('blueprint');
        btn.classList.remove('active');
        btn.textContent = 'BLUEPRINT';
      }
    });
  }

  /* ---- SOUND TOGGLE ---- */
  function initSoundToggle() {
    let btn = document.getElementById('sound-toggle');
    if (!btn) return;

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    btn = newBtn;

    let enabled = false;
    let audioCtx = null;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      enabled = !enabled;
      
      if (enabled) {
        btn.classList.add('active');
        btn.textContent = 'SFX ON';
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
      } else {
        btn.classList.remove('active');
        btn.textContent = 'SFX OFF';
      }
    });

    // Attach click sounds to interactive elements
    document.addEventListener('click', (e) => {
      if (!enabled || !audioCtx) return;
      if (e.target.closest('a, button')) playClick();
    });

    function playClick() {
      try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 800;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.06);
      } catch (e) { /* silent fallback */ }
    }
  }

  /* ---- CUSTOM CURSOR ---- */
  function initCursor() {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const cursor = document.getElementById('custom-cursor');
    const trailCanvas = document.getElementById('cursor-trail');
    if (!cursor || !trailCanvas) return;

    const ctx = trailCanvas.getContext('2d');
    const trail = [];
    const MAX_TRAIL = 30;
    let lastMove = Date.now();
    let mouseX = -100, mouseY = -100;

    function resizeTrail() {
      trailCanvas.width = window.innerWidth;
      trailCanvas.height = window.innerHeight;
    }
    resizeTrail();
    window.addEventListener('resize', resizeTrail);

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.style.left = mouseX + 'px';
      cursor.style.top = mouseY + 'px';
      trail.push({ x: mouseX, y: mouseY, t: Date.now() });
      if (trail.length > MAX_TRAIL) trail.shift();
      lastMove = Date.now();
    });

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('a, button')) cursor.classList.add('hovering');
      else cursor.classList.remove('hovering');
    });

    function drawTrail() {
      ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      if (Date.now() - lastMove > 2000) {
        trail.length = 0;
      }
      for (let i = 0; i < trail.length; i++) {
        const alpha = (i / trail.length) * 0.3;
        const r = (i / trail.length) * 3;
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 245, 255, ${alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(drawTrail);
    }
    drawTrail();
  }

  /* ---- SCROLL REVEALS ---- */
  function initScrollReveals() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
      reveals.forEach(el => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          once: true,
          onEnter: () => el.classList.add('revealed')
        });
      });
    } else {
      // Fallback: IntersectionObserver
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
      }, { threshold: 0.1 });
      reveals.forEach(el => obs.observe(el));
    }
  }

  /* ---- STAT COUNTERS ---- */


  /* ---- CONTACT FORM ---- */
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('[name="name"]')?.value;
      const email = form.querySelector('[name="email"]')?.value;
      const message = form.querySelector('[name="message"]')?.value;
      const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
      const body = encodeURIComponent(`From: ${name} (${email})\n\n${message}`);
      window.location.href = `mailto:sharma.shreyas.2k5@gmail.com?subject=${subject}&body=${body}`;
    });
  }
})();
