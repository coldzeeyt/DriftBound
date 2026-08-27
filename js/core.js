// core.js -- shared namespace, constants, input, audio, screen management, utils
var SS = (function () {
  'use strict';

  //// Constants ////////////////////////////////////////////////////////////
  const C = {
    GRID: 40,
    GRAVITY: 2600,
    JUMP_SPEED: 880,

    // Bolt: grounded jump with variable height while held
    BOLT_HOLD_GRAVITY_MULT: 0.45,
    BOLT_MAX_HOLD_TIME: 0.26,

    // Pulsar: hold to charge a launch, release to fire
    PULSAR_MIN_LAUNCH: 420,
    PULSAR_MAX_LAUNCH: 980,
    PULSAR_MAX_CHARGE_TIME: 0.62,

    // Comet: tap-boost impulse, floaty capped glide between taps
    COMET_BOOST_SPEED: 640,
    COMET_TERMINAL_FALL: 250,
    COMET_BOOST_COOLDOWN: 0.1,

    // Anchor: eased arc leap to the opposite surface
    ANCHOR_ARC_TIME: 0.5,
    ANCHOR_ARC_BULGE: 26,

    // Phase: acceleration-based drift (momentum carries through)
    PHASE_ACCEL: 1900,
    PHASE_MAX_SPEED: 520,

    PLAYER_SIZE: 34,
    PLAYER_SCREEN_X_RATIO: 0.26,
    GROUND_MARGIN: 90,   // px from bottom of play area to canvas bottom
    CEIL_MARGIN: 70,     // px from top of play area to canvas top
    PIT_DEATH_Y: -260,
    DEFAULT_SCROLL_SPEED: 360,
    ORB_RADIUS: 16,
    ORB_TRIGGER_RADIUS: 46,
    PAD_W: 40, PAD_H: 12,
    PORTAL_W: 30,
    COUNTDOWN: 0.9
  };

  //// Small utils ///////////////////////////////////////////////////////////
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function uid() { return 'l_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function fmtTime(s) {
    return s.toFixed(2) + 's';
  }

  //// Storage ///////////////////////////////////////////////////////////////
  const STORAGE_KEY = 'driftbound.levels.v1';
  const HISCORE_KEY = 'driftbound.hiscore.v1';
  const Storage = {
    getCustomLevels() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
      catch (e) { return []; }
    },
    saveCustomLevel(level) {
      const all = Storage.getCustomLevels();
      const idx = all.findIndex(l => l.id === level.id);
      if (idx >= 0) all[idx] = level; else all.push(level);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    },
    deleteCustomLevel(id) {
      const all = Storage.getCustomLevels().filter(l => l.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    },
    getHiscore() {
      try { return parseFloat(localStorage.getItem(HISCORE_KEY)) || 0; }
      catch (e) { return 0; }
    },
    setHiscore(v) { localStorage.setItem(HISCORE_KEY, String(v)); }
  };

  //// Input /////////////////////////////////////////////////////////////////
  const Input = {
    held: false,
    justPressed: false,
    justReleased: false,
    _downListeners: [],
    init(target) {
      const press = (e) => {
        if (e.type === 'keydown') {
          if (e.repeat) return;
          if (!['Space', 'ArrowUp', 'KeyW'].includes(e.code)) return;
          e.preventDefault();
        }
        if (e.type === 'mousedown' && e.button !== 0) return;
        Input.held = true;
        Input.justPressed = true;
      };
      const release = (e) => {
        if (e.type === 'keyup' && !['Space', 'ArrowUp', 'KeyW'].includes(e.code)) return;
        Input.held = false;
        Input.justReleased = true;
      };
      window.addEventListener('keydown', press);
      window.addEventListener('keyup', release);
      target.addEventListener('mousedown', press);
      window.addEventListener('mouseup', release);
      target.addEventListener('touchstart', (e) => { e.preventDefault(); press(e); }, { passive: false });
      window.addEventListener('touchend', (e) => { release(e); }, { passive: false });
      window.addEventListener('blur', () => { Input.held = false; });
    },
    consumeFrame() {
      Input.justPressed = false;
      Input.justReleased = false;
    }
  };

  //// Tiny WebAudio SFX /////////////////////////////////////////////////////
  const Audio = (function () {
    let ctx = null;
    function ensure() {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { ctx = null; }
      }
      return ctx;
    }
    function beep(freq, dur, type, vol, glide) {
      const ac = ensure();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), t0 + dur);
      gain.gain.setValueAtTime((vol || 0.15), t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
    return {
      unlock() { ensure(); },
      jump() { beep(520, 0.09, 'square', 0.12, 260); },
      flip() { beep(300, 0.08, 'triangle', 0.12, -120); },
      orb() { beep(700, 0.12, 'sine', 0.14, 400); },
      pad() { beep(220, 0.14, 'sawtooth', 0.12, 500); },
      portal() { beep(440, 0.18, 'sine', 0.1, 220); },
      death() { beep(160, 0.28, 'sawtooth', 0.16, -140); },
      win() { beep(660, 0.5, 'sine', 0.15, 260); }
    };
  })();

  //// Screen manager ////////////////////////////////////////////////////////
  const Screens = {
    show(id) {
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    },
    showOverlay(id) {
      document.getElementById(id).classList.add('active');
    },
    hideOverlay(id) {
      document.getElementById(id).classList.remove('active');
    }
  };

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  //// Canvas / DPR handling /////////////////////////////////////////////////
  const canvas = document.getElementById('game-canvas');
  const ctx2d = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    // visualViewport tracks the actual visible area on mobile browsers
    // (address bar show/hide, on-screen keyboard); innerWidth/Height is the fallback.
    const vv = window.visualViewport;
    W = vv ? vv.width : window.innerWidth;
    H = vv ? vv.height : window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 60));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resize);
  }
  resize();

  return {
    C, clamp, aabb, lerp, uid, fmtTime,
    Storage, Input, Audio, Screens, toast,
    canvas, ctx: ctx2d,
    get W() { return W; }, get H() { return H; }
  };
})();
