/**
 * ⚽ Soccer Stats Tracker — script.js
 * =====================================
 * Handles:
 *   - Stat counter logic (increment / decrement, floor at 0)
 *   - localStorage persistence
 *   - Score banner sync
 *   - Goal confetti celebration
 *   - Reset with confirmation
 *
 * Deploy to GitHub Pages:
 *   Upload index.html, style.css, script.js → Settings → Pages → main / (root)
 */

'use strict';

/* ===================================================
   1. STATE
=================================================== */

/**
 * All tracked statistics and their default values.
 * Order here matches the HTML row order.
 */
const STATS = ['goals', 'shots', 'sog', 'passes', 'freekicks', 'fouls', 'saves'];

/** In-memory state — synced to localStorage on every change */
const state = {
  home: { goals: 0, shots: 0, sog: 0, passes: 0, freekicks: 0, fouls: 0, saves: 0 },
  away: { goals: 0, shots: 0, sog: 0, passes: 0, freekicks: 0, fouls: 0, saves: 0 },
};

const STORAGE_KEY = 'soccer_stats_v1';

/* ===================================================
   2. PERSISTENCE
=================================================== */

/** Load saved stats from localStorage, merging into `state`. */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    // Safely merge only known teams & stats
    ['home', 'away'].forEach((team) => {
      STATS.forEach((stat) => {
        const val = parsed?.[team]?.[stat];
        if (typeof val === 'number' && Number.isFinite(val)) {
          state[team][stat] = Math.max(0, Math.floor(val));
        }
      });
    });
  } catch {
    // Corrupted data — start fresh
    console.warn('Soccer Stats: Could not load saved data, starting fresh.');
  }
}

/** Persist current state to localStorage. */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage might be unavailable (private browsing quota) — silent fail
  }
}

/* ===================================================
   3. RENDER
=================================================== */

/** Update a single stat's display and its minus-button disabled state. */
function renderStat(team, stat) {
  const el = document.getElementById(`${team}-${stat}`);
  if (el) el.textContent = state[team][stat];

  // Disable minus button when value is 0
  const minusBtn = document.querySelector(
    `.btn-minus[data-team="${team}"][data-stat="${stat}"]`
  );
  if (minusBtn) {
    minusBtn.disabled = state[team][stat] === 0;
    minusBtn.setAttribute('aria-disabled', state[team][stat] === 0 ? 'true' : 'false');
  }
}

/** Sync the score banner to current goal counts. */
function renderScore() {
  const homeEl = document.getElementById('score-home');
  const awayEl = document.getElementById('score-away');
  if (homeEl) homeEl.textContent = state.home.goals;
  if (awayEl) awayEl.textContent = state.away.goals;
}

/** Full render pass — all teams, all stats. */
function renderAll() {
  ['home', 'away'].forEach((team) => {
    STATS.forEach((stat) => renderStat(team, stat));
  });
  renderScore();
}

/* ===================================================
   4. COUNTER LOGIC
=================================================== */

/**
 * Increment a stat.
 * @param {string} team  - 'home' | 'away'
 * @param {string} stat  - one of STATS
 */
function increment(team, stat) {
  state[team][stat] += 1;
  renderStat(team, stat);
  if (stat === 'goals') renderScore();
  saveState();
  animateValue(team, stat, 'up');
}

/**
 * Decrement a stat (floor at 0).
 * @param {string} team  - 'home' | 'away'
 * @param {string} stat  - one of STATS
 */
function decrement(team, stat) {
  if (state[team][stat] <= 0) return;
  state[team][stat] -= 1;
  renderStat(team, stat);
  if (stat === 'goals') renderScore();
  saveState();
  animateValue(team, stat, 'down');
}

/* ===================================================
   5. VALUE ANIMATION
=================================================== */

/**
 * Briefly animate a stat value element to give tactile feedback.
 * @param {string} team      - 'home' | 'away'
 * @param {string} stat      - stat key
 * @param {'up'|'down'} dir  - direction
 */
function animateValue(team, stat, dir) {
  const el = document.getElementById(`${team}-${stat}`);
  if (!el) return;
  el.classList.remove('animating', 'bump', 'bump-down');
  // Force reflow so re-adding the class triggers the animation fresh
  void el.offsetWidth;
  el.classList.add('animating');
  el.addEventListener('animationend', () => el.classList.remove('animating'), { once: true });

  // Also bump the score number if this is goals
  if (stat === 'goals') {
    const scoreEl = document.getElementById(`score-${team}`);
    if (scoreEl) {
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
      setTimeout(() => scoreEl.classList.remove('bump'), 400);
    }
  }
}

/* ===================================================
   6. EVENT DELEGATION
   One listener on the stats grid handles all +/- buttons.
=================================================== */

function setupButtonListeners() {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-team][data-stat]');
    if (!btn || btn.disabled) return;

    const { team, stat } = btn.dataset;

    if (btn.classList.contains('btn-plus')) {
      increment(team, stat);
      if (stat === 'goals') celebrateGoal();
    } else if (btn.classList.contains('btn-minus')) {
      decrement(team, stat);
    }
  });
}

/* ===================================================
   7. RESET
=================================================== */

function setupResetButton() {
  const btn = document.getElementById('reset-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const confirmed = window.confirm(
      '🔄 Reset ALL stats to zero?\n\nThis cannot be undone.'
    );
    if (!confirmed) return;

    // Zero out everything
    ['home', 'away'].forEach((team) => {
      STATS.forEach((stat) => {
        state[team][stat] = 0;
      });
    });

    saveState();
    renderAll();

    // Quick visual feedback on the button
    btn.textContent = '✅ Stats Reset!';
    btn.style.background = 'linear-gradient(145deg, #86efac, #16a34a)';
    setTimeout(() => {
      btn.textContent = '🔄 Reset All Stats';
      btn.style.background = '';
    }, 1800);
  });
}

/* ===================================================
   8. CONFETTI CELEBRATION
=================================================== */

const confetti = (() => {
  // Module-scoped state for the confetti system
  let canvas, ctx, particles, animFrameId, endTime;

  const COLORS = [
    '#facc15', // gold
    '#f97316', // orange
    '#22c55e', // green
    '#3b82f6', // blue
    '#ec4899', // pink
    '#a855f7', // purple
    '#ef4444', // red
    '#ffffff',
  ];

  const PARTICLE_COUNT = 160;
  const DURATION_MS    = 7000;

  /** Create a single confetti particle */
  function makeParticle() {
    return {
      x:      Math.random() * canvas.width,
      y:      Math.random() * -canvas.height * 0.5,  // start above viewport
      w:      6 + Math.random() * 8,
      h:      3 + Math.random() * 5,
      color:  COLORS[Math.floor(Math.random() * COLORS.length)],
      vx:     (Math.random() - 0.5) * 4,
      vy:     2 + Math.random() * 4,
      angle:  Math.random() * Math.PI * 2,
      spin:   (Math.random() - 0.5) * 0.2,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.08,
    };
  }

  /** Draw and update all particles for one frame */
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();
    const alive = now < endTime;

    // Spawn fresh particles while celebration is active
    if (alive && particles.length < PARTICLE_COUNT) {
      for (let i = 0; i < 4; i++) particles.push(makeParticle());
    }

    particles = particles.filter((p) => {
      // Physics
      p.wobble += p.wobbleSpeed;
      p.x += p.vx + Math.sin(p.wobble) * 1.2;
      p.y += p.vy;
      p.angle += p.spin;
      p.vy += 0.08; // gravity

      // Draw
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alive ? 1 : Math.max(0, (p.y / canvas.height));
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      // Remove once off-screen
      return p.y < canvas.height + 40;
    });

    if (particles.length > 0 || alive) {
      animFrameId = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /** Resize canvas to match viewport */
  function resize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  return {
    init() {
      canvas = document.getElementById('confetti-canvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    },

    launch() {
      if (!canvas || !ctx) this.init();
      // Cancel any running animation
      if (animFrameId) cancelAnimationFrame(animFrameId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = [];
      endTime   = Date.now() + DURATION_MS;
      tick();
    },
  };
})();

/* ===================================================
   9. GOAL CELEBRATION ORCHESTRATOR
=================================================== */

let goalToastTimer = null;

function celebrateGoal() {
  // Confetti
  confetti.launch();

  // Toast overlay
  const toast = document.getElementById('goal-toast');
  if (toast) {
    if (goalToastTimer) clearTimeout(goalToastTimer);
    toast.classList.remove('show');
    void toast.offsetWidth; // reflow
    toast.classList.add('show');
    goalToastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
}

/* ===================================================
   10. INIT
=================================================== */

function init() {
  loadState();     // Restore from localStorage
  renderAll();     // Paint the UI
  setupButtonListeners(); // Wire up +/- buttons
  setupResetButton();     // Wire up reset
  confetti.init();        // Prepare confetti canvas
}

// Kick off when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
