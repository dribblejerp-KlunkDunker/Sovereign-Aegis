import { TacticalAudio } from './tacticalAudio.js';
/**
 * SOVEREIGN // AEGIS — Cognitive Fortification Lab Module
 * Masterclasses, Fallacy Taxonomy, AI Forensics Lab, DISARM Framework, Prebunking Simulator
 */

import { esc } from '../security.js';
import { recordAttempt, CONTEXTS } from '../attempts.js';
import { Confidence } from '../confidence.js';
import { AttemptLog } from '../attemptlog.js';
import { rank, estimateAll } from '../competency.js';

/**
 * Pure, deterministic assembly of the Fallacy Gauntlet question list from the taxonomy's own
 * quiz objects. Extracted from the DOM renderer so the invariants — every question has at least
 * two options, exactly one correct answer, no duplicate option text, and a skill tag to record
 * against — are testable against the real data without a browser.
 *
 * Options are shuffled deterministically per fallacy id (so the correct answer does not sit in a
 * fixed slot, the same tell the Arena's shuffle exists to remove), and the item order is shuffled
 * deterministically from `seed`.
 *
 * @param {object[]} fallacies - data/fallacies.json records
 * @param {number|string} [seed]
 * @returns {Array<{fallacyId: string, name: string, question: string, options: string[], correctIndex: number, explanation: string, teaches: string[]}>}
 */
export function buildGauntlet(fallacies, seed = 0x5eed) {
  const shuffleWithKey = (arr, key) => {
    let s = 0;
    const k = String(key || '');
    for (let i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) & 0x7fffffff;
    const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    next(); next();
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const items = (fallacies || [])
    .filter((f) => f && f.quiz && typeof f.quiz.question === 'string' && f.quiz.question
      && Array.isArray(f.quiz.options) && f.quiz.options.length >= 2
      && Number.isInteger(f.quiz.correctIndex) && f.quiz.correctIndex >= 0
      && f.quiz.correctIndex < f.quiz.options.length
      && Array.isArray(f.teaches) && f.teaches.length > 0)
    .map((f) => {
      const order = shuffleWithKey(f.quiz.options.map((_, i) => i), f.id);
      return {
        fallacyId: f.id,
        name: f.name,
        question: f.quiz.question,
        options: order.map((i) => f.quiz.options[i]),
        correctIndex: order.indexOf(f.quiz.correctIndex),
        explanation: f.quiz.explanation,
        teaches: f.teaches.slice()
      };
    });

  return shuffleWithKey(items, `gauntlet-${seed}`);
}

export const CognitiveLab = {
  _spawnCombatFloat(host, text, type = 'normal') {
    if (!host) return;
    const tag = document.createElement('div');
    tag.className = `combat-float-tag ${type}`;
    tag.textContent = text;
    host.style.position = 'relative';
    tag.style.top = '30%';
    host.appendChild(tag);
    setTimeout(() => tag.remove(), 1100);
  },
  _app: null,
  _masterclasses: [],
  _fallacies: [],
  _disarm: [],
  _forensics: null,
  _inoculation: [],
  _activeScenario: null,
  _activeCourse: 0,
  _activeLesson: 0,
  _quizActive: false,
  _selectedAnswer: null,

  // Fallacy Gauntlet state
  _gauntletActive: false,
  _gauntletQuestions: [],
  _gauntletIdx: 0,
  _gauntletScore: 0,
  _gauntletStreak: 0,
  _gauntletMaxStreak: 0,
  _gauntletTimeLeft: 60,
  _gauntletTimer: null,
  _gauntletShownAt: 0,
  _gauntletLocked: false,

  async init(app) {
    this._app = app;
    await this._loadData();
    this._bindEvents();
    this._initDailyDrill();
    console.log('[CognitiveLab] Initialized.');
  },

  _initDailyDrill() {
    const claimEl = document.getElementById('daily-drill-claim');
    const optionsEl = document.getElementById('daily-drill-options');
    const feedbackEl = document.getElementById('daily-drill-feedback');
    const streakEl = document.getElementById('inoculation-streak-val');
    
    if (!claimEl || !optionsEl || !this._fallacies || this._fallacies.length < 3) return;
    
    // Load streak
    let streak = parseInt(this._app.store.get('daily_drill_streak') || '0', 10);
    if (streakEl) streakEl.textContent = streak;

    // Phase 2: the daily drill draws from the arena practice pool (real claims with real
    // explanations), weighted toward the operator's weakest skills via rank() — the same
    // ordering the Arena uses — instead of a uniformly random fallacy name. A miss here now
    // has downstream consequences: the item is enqueued into the SM-2 Memory Vault.
    this._initDailyDrillFromArena(claimEl, optionsEl, feedbackEl, streakEl, streak);
  },

  /**
   * Daily drill backed by the arena practice pool + competency weighting + SM-2 enqueue.
   * Falls back to the taxonomy walk when the pool or estimator is unavailable, so the panel
   * never renders empty.
   * @private
   */
  async _initDailyDrillFromArena(claimEl, optionsEl, feedbackEl, streakEl, streak) {
    let drill = null;
    try {
      const resp = await fetch('./data/arena_questions.json').catch(() => fetch('data/arena_questions.json'));
      const questions = await resp.json();
      const practice = (Array.isArray(questions) ? questions : []).filter(q => q && q.heldOut !== true && Array.isArray(q.options) && q.options.length === 4);
      if (practice.length >= 4) {
        const attempts = await AttemptLog.readAll();
        const skillsResp = await fetch('./data/skills.json').catch(() => fetch('data/skills.json'));
        const skills = await skillsResp.json();
        if (Array.isArray(skills) && skills.length) {
          const masteryMap = attempts.length ? estimateAll(attempts, skills) : new Map();
          const items = practice.map(q => ({ id: q.id, skillIds: q.tests || [], _question: q }));
          // Weak skills first; take a window so the drill varies day to day instead of
          // always serving the single weakest item.
          const ranked = rank(items, masteryMap, { attempts, limit: Math.min(12, items.length) });
          const pool = ranked.map(r => r.item._question);
          const q = pool[Math.floor(Math.random() * pool.length)];
          if (q) {
            drill = {
              claim: q.claim,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              tests: q.tests || [],
              itemId: `daily-drill#${q.id}`
            };
          }
        }
      }
    } catch (e) {
      console.warn('[CognitiveLab] arena-backed daily drill unavailable, falling back:', e);
    }

    if (drill) {
      this._renderDailyDrill(claimEl, optionsEl, feedbackEl, streakEl, streak, drill);
      return;
    }

    // Fallback: the original taxonomy walk (kept so the drill works offline-partial).
    const target = this._fallacies[Math.floor(Math.random() * this._fallacies.length)];
    const syntheticClaim = target.fallacyExample || `Example claim demonstrating ${target.name}`;
    
    claimEl.textContent = `"${syntheticClaim}"`;
    
    // Pick 3 random distractors
    let options = [target];
    while(options.length < 4) {
      const dist = this._fallacies[Math.floor(Math.random() * this._fallacies.length)];
      if (!options.find(o => o.id === dist.id)) options.push(dist);
    }
    options.sort(() => Math.random() - 0.5);
    
    optionsEl.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'cs-btn';
      btn.textContent = opt.name;
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.onclick = () => this._gradeDailyDrill({
        btn, optionsEl, feedbackEl, streakEl,
        correct: opt.id === target.id,
        targetName: target.name,
        targetDescription: target.description,
        skillIds: Array.isArray(target.teaches) ? target.teaches : [],
        itemId: `daily-drill#${target.id}`,
        missedConcept: { name: target.name, description: target.description, teaches: target.teaches }
      });
      optionsEl.appendChild(btn);
    });
  },

  /**
   * Render one arena-backed daily drill question.
   * @private
   */
  _renderDailyDrill(claimEl, optionsEl, feedbackEl, streakEl, streak, drill) {
    claimEl.textContent = `"${drill.claim}"`;
    optionsEl.innerHTML = '';
    drill.options.forEach((text, idx) => {
      const btn = document.createElement('button');
      btn.className = 'cs-btn';
      btn.textContent = text;
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.onclick = () => this._gradeDailyDrill({
        btn, optionsEl, feedbackEl, streakEl,
        correct: idx === drill.correctIndex,
        targetName: drill.options[drill.correctIndex],
        targetDescription: drill.explanation,
        skillIds: drill.tests,
        itemId: drill.itemId,
        missedConcept: drill.correctIndex === idx ? null : {
          name: drill.options[drill.correctIndex],
          description: drill.explanation,
          teaches: drill.tests
        }
      });
      optionsEl.appendChild(btn);
    });
  },

  /**
   * Shared grading path for both drill sources: record the attempt, move the streak,
   * and — on a miss — enqueue the missed concept into the SM-2 Memory Vault so reading
   * and drilling now have downstream retention consequences (roadmap Phase 2).
   * @private
   */
  _gradeDailyDrill({ btn, optionsEl, feedbackEl, streakEl, correct, targetName, targetDescription, skillIds, itemId, missedConcept }) {
    Array.from(optionsEl.children).forEach(c => c.disabled = true);
    feedbackEl.classList.remove('hidden');

    let streak = parseInt(this._app.store.get('daily_drill_streak') || '0', 10);

    // The daily drill is an attempt like any other: feed the estimator.
    recordAttempt({
      skillIds: Array.isArray(skillIds) ? skillIds : [],
      itemId,
      correct,
      context: CONTEXTS.FALLACY_DRILL,
      latencyMs: null,
      heldOut: false,
      chosen: btn.textContent
    });

    if (correct) {
      btn.style.borderColor = 'var(--veracity-border)';
      btn.style.color = 'var(--veracity-text)';
      feedbackEl.style.background = 'rgba(74, 222, 128, 0.1)';
      feedbackEl.style.color = 'var(--veracity-text)';
      feedbackEl.style.border = '1px solid var(--veracity-border)';
      feedbackEl.innerHTML = `<strong>Correct.</strong> This is indeed a <em>${esc(targetName)}</em>.<br><span style="font-size:0.85em; opacity:0.8; display:block; margin-top:8px;">${esc(targetDescription)}</span>`;
      streak++;
      this._app.store.set('daily_drill_streak', streak);
      if (streakEl) streakEl.textContent = streak;
    } else {
      btn.style.borderColor = 'var(--suspicion-border)';
      btn.style.color = 'var(--suspicion-text)';
      feedbackEl.style.background = 'rgba(248, 113, 113, 0.1)';
      feedbackEl.style.color = 'var(--suspicion-text)';
      feedbackEl.style.border = '1px solid var(--suspicion-border)';
      feedbackEl.innerHTML = `<strong>Incorrect.</strong> The correct answer was <em>${esc(targetName)}</em>.<br><span style="font-size:0.85em; opacity:0.8; display:block; margin-top:8px;">${esc(targetDescription)}</span>`;
      streak = 0;
      this._app.store.set('daily_drill_streak', 0);
      if (streakEl) streakEl.textContent = streak;

      // Phase 2 downstream consequence: a missed daily-drill concept enters the
      // spaced-repetition queue via the same bridge SIFT Labs uses. Fire-and-forget —
      // the Memory Vault listens for 'aegis:sift-cards' and enqueues + toasts itself.
      if (missedConcept && typeof window !== 'undefined') {
        const safeId = String(itemId).replace(/[^a-z0-9-]/gi, '-');
        window.dispatchEvent(new CustomEvent('aegis:sift-cards', {
          detail: {
            cards: [{
              id: `card-daily-${safeId}`,
              domain: 'Daily Drill Miss',
              prompt: `Which trap does this claim spring: "${String(missedConcept.description).slice(0, 180)}"`,
              diagnosis: missedConcept.name,
              latin: '',
              mechanism: missedConcept.description,
              countermeasure: 'Name the pattern before the next share or verdict.',
              tests: Array.isArray(missedConcept.teaches) ? missedConcept.teaches : [],
              heldOut: false
            }]
          }
        }));
      }
    }
  },

  onMount() {
    this._renderMasterclassSyllabus();
    this._renderFallacies();
    this._renderDisarm();
    this._renderPrebunking();
  },

  onUnmount() {
    this._activeCourse = null;
    this._clearGauntletTimer();
    this._gauntletActive = false;
  },

  async _loadData() {
    try {
      const loadJson = (filename) => fetch(`./data/${filename}`).catch(() => fetch(`data/${filename}`)).then(r => r.json()).catch(() => []);
      const [mc, fa, di, fo, in_] = await Promise.all([
        loadJson('masterclass.json'),
        loadJson('fallacies.json'),
        loadJson('disarm.json'),
        loadJson('media_forensics.json'),
        loadJson('inoculation.json'),
      ]);
      this._masterclasses = Array.isArray(mc) ? mc : [];
      this._fallacies = Array.isArray(fa) ? fa : [];
      this._disarm = Array.isArray(di) ? di : [];
      this._forensics = fo;
      this._inoculation = Array.isArray(in_) ? in_ : [];
    } catch (err) {
      console.error('[CognitiveLab] Data load error:', err);
    }
  },

  _bindEvents() {
    // Fallacy Gauntlet
    document.getElementById('btn-start-gauntlet')?.addEventListener('click', () => this._startFallacyGauntlet());

    // Fallacy search
    const searchInput = document.getElementById('input-fallacy-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._renderFallacies(e.target.value.trim().toLowerCase());
      });
    }
  },

  // ─────────────────────────────────────────────
  // MASTERCLASSES
  // ─────────────────────────────────────────────
  _renderMasterclassSyllabus() {
    const list = document.getElementById('masterclass-syllabus-list');
    if (!list || !this._masterclasses.length) return;

    const progress = this._app.store.get('cognitive.progress') || {};

    list.innerHTML = this._masterclasses.map((mc, idx) => {
      const done = progress[mc.id]?.completed;
      const lessonsCount = mc.theorySections?.length || 0;
      return `
        <div class="card card-granite-inset card-clickable mc-syllabus-item ${esc(idx === 0 ? 'active' : '')}"
             data-mc-idx="${esc(idx)}"
             style="border-left: 3px solid ${esc(done ? 'var(--veracity-green)' : idx === 0 ? 'var(--bronze-primary)' : 'var(--border-subtle)')}; cursor: pointer;">
          <div class="flex-row-gap" style="justify-content: space-between;">
            <div class="status-label ${esc(done ? 'text-emerald' : 'text-bronze')}">COURSE ${esc((idx + 1).toString().padStart(2, '0'))} ${esc(done ? '✓' : '')}</div>
            <span class="badge ${esc(done ? 'badge-veracity' : 'badge-neutral')}">${esc(mc.estimatedMinutes || 45)} MIN</span>
          </div>
          <div style="font-weight: 600; color: var(--parchment-bright); margin: 4px 0;">${esc(mc.title)}</div>
          <div class="body-muted" style="font-size: 0.8rem;">${esc(lessonsCount)} Sections • Diagnostic Quiz • ${esc(mc.badge || 'Badge')}</div>
        </div>`;
    }).join('');

    // Bind clicks
    list.querySelectorAll('.mc-syllabus-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-mc-idx'));
        list.querySelectorAll('.mc-syllabus-item').forEach(i => {
          i.classList.remove('active');
          i.style.borderLeftColor = 'var(--border-subtle)';
        });
        item.classList.add('active');
        item.style.borderLeftColor = 'var(--bronze-primary)';
        this._activeCourse = idx;
        this._activeLesson = 0;
        this._quizActive = false;
        this._renderMasterclassReader();
      });
    });

    // Render initial course
    this._activeCourse = 0;
    this._renderMasterclassReader();
  },

  _renderMasterclassReader() {
    const mc = this._masterclasses[this._activeCourse];
    if (!mc) return;

    const titleEl = document.getElementById('mc-active-title');
    const bodyEl = document.getElementById('mc-content-body');
    const readerPane = document.getElementById('masterclass-reader-pane');
    if (!titleEl || !bodyEl) return;

    const section = mc.theorySections?.[this._activeLesson];
    const totalLessons = mc.theorySections?.length || 1;

    if (titleEl) {
      titleEl.textContent = this._activeCourse === 0 
        ? 'Foundations of Epistemic Sovereignty: Computational Propaganda & Algorithmic Manipulation'
        : mc.title;
    }

    // Update badge
    const badge = readerPane?.querySelector('.badge');
    if (badge) badge.textContent = `SECTION ${this._activeLesson + 1} / ${totalLessons}`;

    if (this._quizActive) {
      this._renderMasterclassQuiz(mc, bodyEl, readerPane);
      return;
    }

    if (!section) {
      bodyEl.innerHTML = `<p class="body-lead">No content available for this section.</p>`;
      return;
    }

    const keyTakeaways = section.keyTakeaways?.map(t =>
      `<li style="margin-bottom: 6px; padding-left: 8px; border-left: 2px solid var(--bronze-primary);">${esc(t)}</li>`
    ).join('') || '';

    bodyEl.innerHTML = `
      <div class="status-label text-bronze" style="margin-bottom: var(--space-2); font-style: italic;">Cognito, ergo munio — Defend your epistemic sovereignty.</div>
      <h3 class="heading-3" style="margin-bottom: var(--space-3); color: var(--bronze-light);">${esc(section.heading)}</h3>
      <p class="body-text" style="margin-bottom: var(--space-4); line-height: 1.75;">${esc(section.content)}</p>
      ${keyTakeaways ? `
        <div class="card-granite-inset" style="margin-top: var(--space-4);">
          <div class="status-label text-bronze" style="margin-bottom: var(--space-2);">KEY OPERATIONAL TAKEAWAYS</div>
          <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px;">
            ${keyTakeaways}
          </ul>
        </div>` : ''}
    `;

    // Apply progressive tooltips
    this._applyTooltips(bodyEl);

    // Update footer buttons
    const footer = readerPane?.querySelector('.card-footer');
    if (footer) {
      footer.innerHTML = `
        <button class="btn btn-secondary" id="btn-mc-prev" ${esc(this._activeLesson === 0 && this._activeCourse === 0 ? 'disabled' : '')}>← Previous</button>
        <button class="btn btn-primary" id="btn-mc-next">
          ${this._activeLesson < totalLessons - 1 ? 'Next Section →' : 'Take Diagnostic Quiz →'}
        </button>
      `;
      document.getElementById('btn-mc-prev')?.addEventListener('click', () => this._mcNavigate(-1));
      document.getElementById('btn-mc-next')?.addEventListener('click', () => this._mcNavigate(1));
    }
  },

  _applyTooltips(container) {
    if (!container || !this._fallacies) return;
    
    // We will build a simple regex to wrap specific terms
    const glossary = {
      'astroturfing': 'The deceptive practice of presenting an orchestrated marketing or PR campaign in the guise of unsolicited comments from members of the public.',
      'confirmation bias': 'The tendency to process information by looking for, or interpreting, information that is consistent with one\'s existing beliefs.',
      'system 1': 'Fast, automatic, frequent, emotional, stereotypic, subconscious thinking.',
      'system 2': 'Slow, effortful, infrequent, logical, calculating, conscious thinking.',
      'false dilemma': 'A logical fallacy that presents only two options or sides when there are many options or sides.'
    };
    
    // Also include some fallacies
    this._fallacies.slice(0, 10).forEach(f => {
      glossary[f.name.toLowerCase()] = f.description;
    });

    let html = container.innerHTML;
    
    // Sort terms by length descending to prevent partial word matches
    const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
    
    terms.forEach(term => {
      // Very basic regex to match whole words outside of HTML tags
      const regex = new RegExp(`(?<!<[^>]*)\\b(${term})\\b(?![^<]*>)`, 'gi');
      html = html.replace(regex, (match) => {
        return `<span class="prog-tooltip" data-term="${esc(term)}">${esc(match)}<span class="tooltip-content"><span class="tt-title">${esc(term.toUpperCase())}</span>${esc(glossary[term])}</span></span>`;
      });
    });
    
    container.innerHTML = html;
  },

  _mcNavigate(dir) {
    const mc = this._masterclasses[this._activeCourse];
    const totalLessons = mc?.theorySections?.length || 1;

    if (dir === 1) {
      if (this._activeLesson < totalLessons - 1) {
        // Phase 2: finishing a section schedules its course's skills for review (ROADMAP.md
        // Phase 2: "Finishing a masterclass section schedules its skills for review rather
        // than setting a completed flag"). One card per section, id-deduplicated, so
        // re-reading a section never duplicates or re-seeds its card. Sections carry no
        // per-section skill data, so the course's skills[] is the honest granularity, and
        // cards are non-held-out by construction (course skills are teaching targets).
        if (typeof window !== 'undefined') {
          const masterclassSkills = Array.isArray(mc.skills) ? mc.skills : [];
          if (masterclassSkills.length) {
            const sectionNo = this._activeLesson + 1;
            const reviewCards = masterclassSkills.map((skillId) => ({
              id: `card-mc-${mc.id}-s${sectionNo}-${skillId.replace(/\./g, '-')}`,
              domain: `Masterclass: ${mc.badge || 'Review'}`,
              prompt: `Recall the key concepts from "${mc.theorySections[this._activeLesson]?.heading || `Section ${sectionNo}`}" of "${mc.title}"`,
              diagnosis: `Post-Section Review — ${mc.badge || mc.title}`,
              latin: '',
              mechanism: `Scheduled after reading this section. The Memory Vault will bring it back at increasing intervals.`,
              countermeasure: `Revisit the section or run the course diagnostic when this card comes due.`,
              tests: [skillId],
              heldOut: false
            }));
            window.dispatchEvent(new CustomEvent('aegis:sift-cards', { detail: { cards: reviewCards } }));
          }
        }
        this._activeLesson++;
        this._renderMasterclassReader();
      } else {
        // Show quiz
        this._quizActive = true;
        this._renderMasterclassReader();
      }
    } else {
      if (this._quizActive) {
        this._quizActive = false;
        this._renderMasterclassReader();
      } else if (this._activeLesson > 0) {
        this._activeLesson--;
        this._renderMasterclassReader();
      } else if (this._activeCourse > 0) {
        this._activeCourse--;
        const prevMc = this._masterclasses[this._activeCourse];
        this._activeLesson = (prevMc?.theorySections?.length || 1) - 1;
        this._renderMasterclassReader();
      }
    }
  },

  _renderMasterclassQuiz(mc, bodyEl, readerPane) {
    const questions = mc.diagnostic?.questions || [];
    if (!questions.length) {
      bodyEl.innerHTML = `<p class="body-lead text-bronze">No diagnostic questions available.</p>`;
      return;
    }

    let currentQ = 0;
    let score = 0;
    const answers = {};

    const renderQuestion = () => {
      const q = questions[currentQ];
      const isLast = currentQ === questions.length - 1;

      bodyEl.innerHTML = `
        <div class="card-granite-inset" style="margin-bottom: var(--space-3);">
          <div class="status-label text-bronze" style="margin-bottom: var(--space-2);">DIAGNOSTIC — QUESTION ${esc(currentQ + 1)} / ${esc(questions.length)}</div>
          <div class="body-lead" style="margin-bottom: var(--space-3); line-height: 1.6;">${esc(q.scenario || q.questionText)}</div>
          ${q.scenario && q.questionText !== q.scenario ? `<div class="status-label text-muted" style="margin-bottom: var(--space-3);">${q.questionText}</div>` : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: var(--space-2);" id="quiz-options">
          ${q.options.map((opt, i) => `
            <button class="btn btn-outline quiz-opt" data-idx="${i}" style="text-align: left; justify-content: flex-start; padding: 12px 16px;">
              <span style="font-family: var(--font-mono); color: var(--bronze-primary); margin-right: 10px;">${String.fromCharCode(65 + i)}.</span>
              <span>${opt.text}</span>
            </button>
          `).join('')}
        </div>
        <div id="quiz-feedback" style="display:none; margin-top: var(--space-4);"></div>
      `;

      bodyEl.querySelectorAll('.quiz-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          const opt = q.options[idx];
          const delta = opt.scoreDelta || 0;
          score += Math.max(0, delta);
          answers[q.questionId] = idx;

          // Record this answer against every skill the masterclass teaches.
          // scoreDelta > 0 means correct — the content author marked one option
          // as the right answer. Quiz questions are weaker evidence than Arena
          // answers (no timer, no distractors), which is why the context
          // discriminates them.
          recordAttempt({
            skillIds: Array.isArray(mc.skills) ? mc.skills : [],
            itemId: `${mc.id}#q${currentQ}`,
            correct: delta > 0,
            context: CONTEXTS.MASTERCLASS,
            latencyMs: null,
            heldOut: false,
            chosen: opt.text
          });

          // Color buttons
          bodyEl.querySelectorAll('.quiz-opt').forEach((b, i) => {
            b.disabled = true;
            if (i === idx) {
              b.style.borderColor = delta > 0 ? 'var(--veracity-green)' : 'var(--disinfo-crimson)';
              b.style.background = delta > 0 ? 'rgba(52,211,153,0.1)' : 'rgba(220,38,38,0.1)';
            }
          });

          const fb = document.getElementById('quiz-feedback');
          if (fb) {
            fb.style.display = 'block';
            fb.innerHTML = `
              <div class="card-granite-inset" style="border-left: 3px solid ${esc(delta > 0 ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')};">
                <div class="status-label ${esc(delta > 0 ? 'text-emerald' : 'text-crimson')}">${esc(delta > 0 ? '✓ CORRECT' : '✗ INCORRECT')}</div>
                <p class="body-text" style="margin-top: 4px;">${esc(opt.feedback)}</p>
                <button class="btn btn-primary" style="margin-top: 12px;" id="btn-quiz-next">
                  ${esc(isLast ? 'View Results →' : 'Next Question →')}
                </button>
              </div>
            `;
            document.getElementById('btn-quiz-next')?.addEventListener('click', () => {
              if (isLast) {
                this._showQuizResults(mc, score, questions.length, readerPane, bodyEl);
              } else {
                currentQ++;
                renderQuestion();
              }
            });
          }
        });
      });
    };

    renderQuestion();

    const footer = readerPane?.querySelector('.card-footer');
    if (footer) footer.innerHTML = '';
  },

  _showQuizResults(mc, score, total, readerPane, bodyEl) {
    const maxScore = total * 20;
    const pct = Math.round((score / maxScore) * 100);
    const passed = pct >= 60;

    bodyEl.innerHTML = `
      <div style="text-align: center; padding: var(--space-6);">
        <div style="font-size: 4rem; margin-bottom: var(--space-2);">${esc(passed ? '🏅' : '📊')}</div>
        <div class="heading-2 ${esc(passed ? 'text-emerald' : 'text-amber')}">${esc(pct)}%</div>
        <div class="body-lead" style="margin-bottom: var(--space-4);">${esc(passed ? 'Diagnostic Passed — Badge Unlocked' : 'Diagnostic Complete — Review Sections')}</div>
        <div class="card-granite-inset" style="text-align: left; margin-bottom: var(--space-4);">
          <div class="status-label text-bronze">ASSESSMENT: ${esc(mc.diagnostic?.diagnosticTitle || 'Cognitive Diagnostic')}</div>
          <div class="body-text" style="margin-top: 8px;">Score: <strong class="${esc(passed ? 'text-emerald' : 'text-amber')}">${esc(score)} / ${esc(maxScore)}</strong></div>
          ${passed ? `<div class="body-muted">Badge Earned: <strong class="text-bronze">${mc.badge || 'Course Badge'}</strong></div>` : ''}
        </div>
        <button class="btn btn-primary" id="btn-quiz-retry">Restart Module →</button>
      </div>
    `;

    if (passed) {
      const progress = this._app.store.get('cognitive.progress') || {};
      progress[mc.id] = { completed: true, score: pct, timestamp: new Date().toISOString() };
      this._app.store.set('cognitive.progress', progress);
      this._app.showToast({ type: 'success', title: `BADGE UNLOCKED: ${mc.badge}`, message: `${pct}% on ${mc.title}` });
      this._renderMasterclassSyllabus();

      // Schedule SM-2 review cards for the skills this masterclass teaches.
      // Uses the same aegis:sift-cards bridge that SIFT Labs uses, so the Memory Vault
      // picks these up exactly as if they came from a drill. Finishing a course now has
      // downstream consequences — reading something moves it into the retention queue.
      const masterclassSkills = Array.isArray(mc.skills) ? mc.skills : [];
      if (masterclassSkills.length && typeof window !== 'undefined') {
        // One summary card per skill — the prompt is the course title, the diagnosis is what
        // the operator should now be able to do. Same SM-2 card shape as every other card.
        const reviewCards = masterclassSkills.map((skillId, i) => ({
          id: `card-mc-review-${mc.id}-${skillId.replace(/\./g, '-')}`,
          domain: `Masterclass: ${mc.badge || 'Review'}`,
          prompt: `Recall the key concepts from "${mc.title}"`,
          diagnosis: `Post-${mc.badge || 'Course'} Review`,
          latin: '',
          mechanism: `Completed with ${pct}% on diagnostic. Scheduled for spaced review.`,
          countermeasure: `Revisit course sections you found most difficult; the Memory Vault will bring these back at increasing intervals.`,
          tests: [skillId],
          heldOut: false
        }));
        window.dispatchEvent(new CustomEvent('aegis:sift-cards', {
          detail: { cards: reviewCards }
        }));
      }
    }

    const footer = readerPane?.querySelector('.card-footer');
    if (footer) {
      footer.innerHTML = `<button class="btn btn-secondary" id="btn-back-to-courses">← Back to Syllabus</button>`;
      document.getElementById('btn-back-to-courses')?.addEventListener('click', () => {
        this._quizActive = false;
        this._activeLesson = 0;
        this._renderMasterclassReader();
      });
    }

    document.getElementById('btn-quiz-retry')?.addEventListener('click', () => {
      this._quizActive = true;
      this._renderMasterclassReader();
    });
  },

  // ─────────────────────────────────────────────
  // FALLACY GAUNTLET
  // ─────────────────────────────────────────────
  _startFallacyGauntlet() {
    this._gauntletQuestions = buildGauntlet(this._fallacies);
    if (!this._gauntletQuestions.length) {
      this._app?.showToast({ type: 'danger', title: 'GAUNTLET UNAVAILABLE', message: 'No fallacy quiz questions loaded.' });
      return;
    }
    this._gauntletActive = true;
    this._gauntletIdx = 0;
    this._gauntletScore = 0;
    this._gauntletCorrect = 0;
    this._gauntletCritCount = 0;
    this._gauntletStreak = 0;
    this._gauntletMaxStreak = 0;
    this._gauntletTimeLeft = 60;
    this._gauntletLocked = false;
    document.getElementById('fallacy-search-card')?.classList.add('hidden');
    document.getElementById('fallacy-gauntlet-launch')?.classList.add('hidden');
    document.getElementById('fallacy-cards-grid')?.classList.add('hidden');
    const host = document.getElementById('fallacy-gauntlet');
    host?.classList.remove('hidden');
    this._renderGauntletQuestion();
    this._startGauntletTimer();
  },

  _startGauntletTimer() {
    this._clearGauntletTimer();
    this._gauntletTimer = setInterval(() => {
      this._gauntletTimeLeft--;
      this._updateGauntletHUD();
      const timeEl = document.getElementById('gauntlet-time');
      if (this._gauntletTimeLeft <= 10 && this._gauntletTimeLeft > 0) {
        timeEl?.classList.add('timer-danger');
        TacticalAudio.playTimerWarning();
      } else {
        timeEl?.classList.remove('timer-danger');
      }
      if (this._gauntletTimeLeft <= 0) this._endGauntlet('TIME EXPIRED');
    }, 1000);
  },

  _clearGauntletTimer() {
    if (this._gauntletTimer) { clearInterval(this._gauntletTimer); this._gauntletTimer = null; }
    document.getElementById('gauntlet-time')?.classList.remove('timer-danger');
  },

  _updateGauntletHUD() {
    const t = document.getElementById('gauntlet-time');
    const s = document.getElementById('gauntlet-score');
    const st = document.getElementById('gauntlet-streak');
    if (t) t.textContent = `${Math.max(0, this._gauntletTimeLeft)}s`;
    if (s) s.textContent = `${this._gauntletScore}`;
    if (st) st.textContent = `${this._gauntletStreak}`;
  },

  _renderGauntletQuestion() {
    if (!this._gauntletActive) return;
    const host = document.getElementById('fallacy-gauntlet');
    if (!host) return;
    if (this._gauntletIdx >= this._gauntletQuestions.length) { this._endGauntlet('POOL CLEARED'); return; }

    const q = this._gauntletQuestions[this._gauntletIdx];
    this._gauntletShownAt = Date.now();
    this._gauntletLocked = false;

    host.innerHTML = `
      <div class="card card-bronze" style="padding: 22px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">⚔️</span>
            <span class="status-label text-bronze">FALLACY GAUNTLET — NAME THE MOVE</span>
          </div>
          <div style="display:flex;gap:12px;font-family:var(--font-mono);font-size:0.8rem;color:var(--stone-warm);">
            <span>⏱ <span id="gauntlet-time">${esc(this._gauntletTimeLeft)}s</span></span>
            <span>🎯 <span id="gauntlet-score">${esc(this._gauntletScore)}</span></span>
            <span>🔥 <span id="gauntlet-streak">${esc(this._gauntletStreak)}</span></span>
          </div>
        </div>
        <div style="background:var(--bg-surface-inset);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:18px;margin-bottom:14px;">
          <p style="font-family:var(--font-serif);font-size:1.05rem;color:var(--parchment-bright);line-height:1.55;margin:0;font-style:italic;">${esc(q.question)}</p>
        </div>
        <div id="gauntlet-confidence-host" style="margin-bottom:12px;"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;" id="gauntlet-options">
          ${q.options.map((opt, i) => `
            <button class="btn btn-outline gauntlet-option" data-idx="${esc(i)}" style="text-align:left;justify-content:flex-start;padding:11px 14px;font-size:0.88rem;">
              <span style="font-family:var(--font-mono);color:var(--bronze-primary);margin-right:8px;">${esc(String.fromCharCode(65 + i))}.</span>${esc(opt)}
            </button>`).join('')}
        </div>
        <div id="gauntlet-feedback" style="margin-top:14px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;border-top:1px solid var(--border-subtle);padding-top:12px;">
          <button class="btn btn-outline" id="btn-gauntlet-exit" style="font-size:0.8rem;">✕ Exit Gauntlet</button>
          <span class="body-muted" style="font-size:0.75rem;">${esc(this._gauntletIdx + 1)} / ${esc(this._gauntletQuestions.length)}</span>
        </div>
      </div>`;

    Confidence.mount(host.querySelector('#gauntlet-confidence-host'));
    host.querySelector('#btn-gauntlet-exit')?.addEventListener('click', () => this._exitGauntlet());
    host.querySelectorAll('.gauntlet-option').forEach((btn) => {
      btn.addEventListener('click', () => this._answerGauntlet(parseInt(btn.getAttribute('data-idx'), 10)));
    });
  },

  _answerGauntlet(idx) {
    if (this._gauntletLocked || !this._gauntletActive) return;
    const q = this._gauntletQuestions[this._gauntletIdx];
    if (!q) return;
    this._gauntletLocked = true;

    const correct = idx === q.correctIndex;
    const latencyMs = this._gauntletShownAt ? Math.max(0, Date.now() - this._gauntletShownAt) : 3000;
    const isCritical = correct && latencyMs > 0 && latencyMs <= 2500;
    const host = document.getElementById('fallacy-gauntlet');
    const cardEl = host?.querySelector('.card-bronze');

    if (correct) {
      this._gauntletCorrect++;
      this._gauntletStreak++;
      if (this._gauntletStreak > this._gauntletMaxStreak) this._gauntletMaxStreak = this._gauntletStreak;
      if (isCritical) {
        this._gauntletCritCount = (this._gauntletCritCount || 0) + 1;
        this._gauntletScore += 2;
        this._gauntletTimeLeft = Math.min(60, this._gauntletTimeLeft + 3);
        TacticalAudio.playCriticalHit();
        cardEl?.classList.add('crit-hit-pulse');
        setTimeout(() => cardEl?.classList.remove('crit-hit-pulse'), 450);
        this._spawnCombatFloat(cardEl, `? CRITICAL REFUTATION! +2 pts (${(latencyMs/1000).toFixed(1)}s)`, 'crit');
      } else {
        this._gauntletScore += 1;
        this._gauntletTimeLeft = Math.min(60, this._gauntletTimeLeft + 2);
        TacticalAudio.playStreakHit(this._gauntletStreak);
        this._spawnCombatFloat(cardEl, `? +1 pt${this._gauntletStreak >= 3 ? ` (${this._gauntletStreak}x STREAK)` : ''}`, 'normal');
      }
    } else {
      const brokenStreak = this._gauntletStreak;
      this._gauntletStreak = 0;
      cardEl?.classList.remove('gauntlet-card-overdrive');
      cardEl?.classList.add('aegis-shake');
      setTimeout(() => cardEl?.classList.remove('aegis-shake'), 380);
      if (brokenStreak >= 2) {
        TacticalAudio.playStreakBust();
        this._spawnCombatFloat(cardEl, `?? STREAK BROKEN (${brokenStreak})`, 'bust');
      } else {
        TacticalAudio.playZizzle();
        this._spawnCombatFloat(cardEl, '? INCORRECT', 'bust');
      }
    }

    recordAttempt({
      skillIds: q.teaches,
      itemId: `${q.fallacyId}#gauntlet`,
      correct,
      context: CONTEXTS.FALLACY_DRILL,
      latencyMs: this._gauntletShownAt ? Date.now() - this._gauntletShownAt : null,
      heldOut: false,
      chosen: q.options[idx]
    });

    document.querySelectorAll('.gauntlet-option').forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correctIndex) { btn.style.borderColor = 'var(--veracity-green)'; btn.style.background = 'rgba(74,222,128,0.12)'; }
      else if (i === idx) { btn.style.borderColor = 'var(--disinfo-crimson)'; btn.style.background = 'rgba(239,68,68,0.12)'; }
    });

    const fb = document.getElementById('gauntlet-feedback');
    if (fb) {
      fb.innerHTML = `
        <div class="card-granite-inset" style="border-left:3px solid ${esc(correct ? 'var(--veracity-green)' : 'var(--disinfo-crimson)')};padding:12px;">
          <span class="status-label ${esc(correct ? 'text-emerald' : 'text-crimson')}">${esc(correct ? '✓ CORRECT' : '✗ INCORRECT — THE MOVE WAS ' + q.options[q.correctIndex])}</span>
          <p class="body-text" style="margin:6px 0 0;font-size:0.85rem;">${esc(q.explanation || '')}</p>
        </div>`;
    }

    this._gauntletIdx++;
    setTimeout(() => this._renderGauntletQuestion(), correct ? 650 : 1500);
  },

  _endGauntlet(reason) {
    this._clearGauntletTimer();
    this._gauntletActive = false;
    const host = document.getElementById('fallacy-gauntlet');
    if (!host) return;
    const total = this._gauntletIdx;
    const correctCount = this._gauntletCorrect || 0;
    const acc = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    if (acc >= 70 && total >= 3) {
      TacticalAudio.playVictory();
    } else {
      TacticalAudio.playDefeat();
    }
    host.innerHTML = `
      <div class="card card-bronze" style="padding:24px;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:2rem;">⚔️</div>
          <h3 class="card-title" style="margin:6px 0;">Gauntlet Complete — ${esc(reason)}</h3>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:18px;">
          <div class="stat-card"><div class="stat-val bronze">${esc(this._gauntletScore)}</div><div class="stat-lbl">Points</div></div>
          <div class="stat-card"><div class="stat-val amber">${esc(acc)}%</div><div class="stat-lbl">Accuracy (${esc(correctCount)} / ${esc(total)} answered)</div></div>
          <div class="stat-card"><div class="stat-val crim">${esc(this._gauntletMaxStreak)}</div><div class="stat-lbl">Best Streak</div></div>
        </div>
        <p class="body-muted" style="text-align:center;font-size:0.8rem;margin-bottom:16px;">
          Every answer is recorded against the skills it tests; your chosen option feeds the confusion matrix.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button class="btn btn-primary" id="btn-gauntlet-replay">⚔️ Play Again</button>
          <button class="btn btn-outline" id="btn-gauntlet-back">← Back to Taxonomy</button>
        </div>
      </div>`;
    host.querySelector('#btn-gauntlet-replay')?.addEventListener('click', () => this._startFallacyGauntlet());
    host.querySelector('#btn-gauntlet-back')?.addEventListener('click', () => this._exitGauntlet());
  },

  _exitGauntlet() {
    this._clearGauntletTimer();
    this._gauntletActive = false;
    document.getElementById('fallacy-search-card')?.classList.remove('hidden');
    document.getElementById('fallacy-gauntlet-launch')?.classList.remove('hidden');
    document.getElementById('fallacy-cards-grid')?.classList.remove('hidden');
    document.getElementById('fallacy-gauntlet')?.classList.add('hidden');
  },

  // ─────────────────────────────────────────────
  // FALLACIES TAXONOMY
  // ─────────────────────────────────────────────
  _renderFallacies(query = '') {
    const grid = document.getElementById('fallacy-cards-grid');
    if (!grid) return;

    const filtered = query
      ? this._fallacies.filter(f =>
          f.name?.toLowerCase().includes(query) ||
          f.latinName?.toLowerCase().includes(query) ||
          f.category?.toLowerCase().includes(query) ||
          f.definition?.toLowerCase().includes(query))
      : this._fallacies;

    if (!filtered.length) {
      grid.innerHTML = `<div class="body-muted" style="grid-column: 1/-1; padding: var(--space-6); text-align: center;">No fallacies matching "${esc(query)}"</div>`;
      return;
    }

    const catColors = {
      'Relevance & Distraction': 'badge-disinfo',
      'False Premise': 'badge-suspicion',
      'Logical Structure': 'badge-intel',
      'Statistical Manipulation': 'badge-bronze',
      'Informal Fallacy': 'badge-neutral',
    };

    grid.innerHTML = filtered.map(f => `
      <div class="card card-granite-inset fallacy-card card-clickable" data-fallacy-id="${esc(f.id)}" style="cursor: pointer; transition: transform 0.18s, border-color 0.18s;">
        <div class="card-header" style="margin-bottom: var(--space-2);">
          <h4 class="heading-4" style="font-size: 1rem;">${esc(f.name)}</h4>
          <span class="badge ${esc(catColors[f.category] || 'badge-neutral')}" style="font-size: 0.65rem;">${esc(f.category || 'FALLACY')}</span>
        </div>
        <p class="latin-maxim" style="margin-bottom: var(--space-2); font-style: italic; color: var(--bronze-light); font-size: 0.85rem;">${esc(f.latinName || '')}</p>
        <p class="body-text" style="font-size: 0.88rem; line-height: 1.6; color: var(--parchment-secondary);">${esc((f.definition || '').substring(0, 130))}${esc(f.definition?.length > 130 ? '...' : '')}</p>
        <div class="card-footer" style="margin-top: var(--space-3);">
          <span class="text-bronze" style="font-size: 0.8rem; font-family: var(--font-mono);">Interactive Sandbox Drill →</span>
        </div>
      </div>
    `).join('');

    // Bind expand on click
    grid.querySelectorAll('.fallacy-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-fallacy-id');
        const fallacy = this._fallacies.find(f => f.id === id);
        if (fallacy) this._showFallacyDetail(fallacy);
      });
    });
  },

  _showFallacyDetail(fallacy) {
    // Create or reuse detail panel
    let panel = document.getElementById('fallacy-detail-panel');
    if (!panel) {
      const subtab = document.getElementById('subtab-fallacies');
      panel = document.createElement('div');
      panel.id = 'fallacy-detail-panel';
      panel.style.cssText = 'position:fixed;top:0;right:0;width:480px;height:100vh;background:var(--bg-surface);border-left:1px solid var(--border-primary);z-index:1000;overflow-y:auto;padding:var(--space-6);box-shadow:-8px 0 32px rgba(0,0,0,0.6);transition:transform 0.3s;';
      document.body.appendChild(panel);
    }

    const q = fallacy.quiz;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-4);">
        <div>
          <div class="status-label text-bronze">${esc(fallacy.category)}</div>
          <h2 class="heading-2" style="margin-top:4px;">${esc(fallacy.name)}</h2>
          <p class="latin-maxim" style="color:var(--bronze-light);font-style:italic;">${esc(fallacy.latinName || '')}</p>
        </div>
        <button id="btn-close-fallacy" class="btn btn-secondary" style="flex-shrink:0;">✕ Close</button>
      </div>

      <div class="card-granite-inset" style="margin-bottom:var(--space-4);">
        <div class="status-label text-muted" style="margin-bottom:6px;">DEFINITION</div>
        <p class="body-text">${esc(fallacy.definition)}</p>
      </div>

      ${fallacy.psychologicalVector ? `
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);border-left:3px solid var(--amber-primary,#d97706);">
        <div class="status-label text-amber" style="margin-bottom:6px;">PSYCHOLOGICAL VECTOR</div>
        <p class="body-text">${fallacy.psychologicalVector}</p>
      </div>` : ''}

      ${fallacy.fallacyExample ? `
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);">
        <div class="status-label text-muted" style="margin-bottom:6px;">REAL-WORLD EXAMPLE</div>
        <blockquote class="quote-classical">${fallacy.fallacyExample}</blockquote>
      </div>` : ''}

      ${fallacy.counterFraming ? `
      <div class="card-granite-inset" style="margin-bottom:var(--space-4);border-left:3px solid var(--veracity-green);">
        <div class="status-label text-emerald" style="margin-bottom:6px;">COUNTER-FRAMING</div>
        <p class="body-text">${fallacy.counterFraming}</p>
      </div>` : ''}

      ${q ? `
      <div style="margin-top:var(--space-4);">
        <div class="status-label text-bronze" style="margin-bottom:var(--space-3);">INTERACTIVE DRILL</div>
        <p class="body-lead" style="margin-bottom:var(--space-3);">${q.question}</p>
        <div id="fallacy-confidence-host" style="margin-bottom:var(--space-3);"></div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);" id="fallacy-quiz-opts">
          ${q.options.map((opt, i) => `
            <button class="btn btn-outline fallacy-quiz-btn" data-idx="${esc(i)}" style="text-align:left;justify-content:flex-start;padding:10px 14px;">
              <span style="font-family:var(--font-mono);color:var(--bronze-primary);margin-right:8px;">${esc(String.fromCharCode(65+i))}.</span>
              ${esc(opt)}
            </button>
          `).join('')}
        </div>
        <div id="fallacy-quiz-result" style="display:none;margin-top:var(--space-3);"></div>
      </div>` : ''}
    `;

    document.getElementById('btn-close-fallacy')?.addEventListener('click', () => {
      document.body.removeChild(panel);
    });

    if (q) {
      Confidence.mount(panel.querySelector('#fallacy-confidence-host'));
      // Time from the drill appearing to the answer. Read here rather than at module scope so
      // reopening the same fallacy restarts the clock.
      const shownAt = Date.now();
      let answered = false;
      panel.querySelectorAll('.fallacy-quiz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'));
          const correct = idx === q.correctIndex;

          // The drill tests whatever the fallacy teaches — one source of truth, so the drill
          // cannot drift from the card it sits inside. Guarded because the buttons are only
          // disabled visually and a fast double-click would otherwise log twice.
          if (!answered) {
            answered = true;
            recordAttempt({
              skillIds: fallacy.teaches,
              itemId: `${fallacy.id}#quiz`,
              correct,
              context: CONTEXTS.FALLACY_DRILL,
              latencyMs: Date.now() - shownAt,
              heldOut: false,
              chosen: q.options[idx]
            });
          }

          panel.querySelectorAll('.fallacy-quiz-btn').forEach((b, i) => {
            b.disabled = true;
            if (i === q.correctIndex) { b.style.borderColor='var(--veracity-green)'; b.style.background='rgba(52,211,153,0.12)'; }
            if (i === idx && !correct) { b.style.borderColor='var(--disinfo-crimson)'; b.style.background='rgba(220,38,38,0.1)'; }
          });
          const res = document.getElementById('fallacy-quiz-result');
          if (res) {
            res.style.display='block';
            res.innerHTML = `<div class="card-granite-inset" style="border-left:3px solid ${esc(correct?'var(--veracity-green)':'var(--disinfo-crimson)')};">
              <span class="${esc(correct?'text-emerald':'text-crimson')} status-label">${esc(correct?'✓ CORRECT':'✗ INCORRECT')}</span>
              <p class="body-text" style="margin-top:4px;">${esc(q.explanation)}</p>
            </div>`;
          }
        });
      });
    }
  },

  // ─────────────────────────────────────────────
  // DISARM FRAMEWORK
  // ─────────────────────────────────────────────
  _renderDisarm() {
    const container = document.getElementById('subtab-disarm');
    if (!container || !this._disarm.length) return;

    const phases = ['Plan', 'Prepare', 'Seed', 'Amplify', 'Measure & Adapt'];
    const phaseColors = {
      Plan: { bg: 'rgba(96,165,250,0.08)', border: 'var(--intel-cyan)', badge: 'badge-intel', label: 'STAGE: PLAN' },
      Prepare: { bg: 'rgba(251,191,36,0.08)', border: 'var(--bronze-primary)', badge: 'badge-bronze', label: 'STAGE: PREPARE' },
      Seed: { bg: 'rgba(245,158,11,0.08)', border: 'var(--amber-primary,#d97706)', badge: 'badge-suspicion', label: 'STAGE: SEED' },
      Amplify: { bg: 'rgba(239,68,68,0.08)', border: 'var(--disinfo-crimson)', badge: 'badge-disinfo', label: 'STAGE: AMPLIFY' },
      'Measure & Adapt': { bg: 'rgba(52,211,153,0.08)', border: 'var(--veracity-green)', badge: 'badge-veracity', label: 'STAGE: MEASURE & ADAPT' },
    };

    let activeId = null;

    const renderMatrix = () => {
      const grouped = {};
      phases.forEach(p => { grouped[p] = this._disarm.filter(d => d.phase === p); });

      let searchQuery = '';
      const searchInput = container.querySelector('#disarm-search');
      if (searchInput) searchQuery = searchInput.value.toLowerCase();

      container.innerHTML = `
        <div class="card" style="margin-bottom:var(--space-4);">
          <div class="flex-row-gap" style="justify-content:space-between;align-items:center;">
            <h3 class="card-title">DISARM Framework Matrix — Disinformation T-Codes</h3>
            <span class="badge badge-disinfo">${esc(this._disarm.length)} T-CODES</span>
          </div>
          <p class="body-text" style="margin:var(--space-2) 0 var(--space-3);">Standardized taxonomy mapping adversary influence operation tactics (T-codes) to defensive countermeasures.</p>
          <input type="text" class="form-input" id="disarm-search" placeholder="Search T-codes, titles, or countermeasures..." style="margin-bottom:var(--space-3);">
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);">
            ${phases.map(p => `<button class="btn btn-sm btn-outline disarm-phase-filter" data-phase="${p}">${phaseColors[p].label}</button>`).join('')}
          </div>
        </div>
        ${phases.map(phase => {
          const items = (grouped[phase] || []).filter(d =>
            !searchQuery ||
            d.id?.toLowerCase().includes(searchQuery) ||
            d.title?.toLowerCase().includes(searchQuery) ||
            d.description?.toLowerCase().includes(searchQuery) ||
            d.countermeasures?.some(c => c.toLowerCase().includes(searchQuery))
          );
          if (!items.length) return '';
          const pc = phaseColors[phase];
          return `
            <div class="disarm-phase-section" data-phase="${phase}" style="margin-bottom:var(--space-5);">
              <div class="status-label" style="margin-bottom:var(--space-3);color:var(--bronze-light);">${pc.label} (${items.length})</div>
              <div class="grid-3">
                ${items.map(d => `
                  <div class="card card-granite-inset card-clickable disarm-card ${esc(activeId === d.id ? 'disarm-card-active' : '')}"
                       data-disarm-id="${esc(d.id)}"
                       style="cursor:pointer;border-left:3px solid ${esc(pc.border)};background:${esc(pc.bg)};transition:all 0.2s;">
                    <div class="flex-row-gap" style="justify-content:space-between;margin-bottom:var(--space-2);">
                      <span class="badge ${esc(pc.badge)}" style="font-size:0.65rem;">${esc(d.id)}</span>
                      <span class="badge ${esc(d.severityLevel === 'Critical' ? 'badge-disinfo' : d.severityLevel === 'High' ? 'badge-suspicion' : 'badge-neutral')}" style="font-size:0.65rem;">${esc(d.severityLevel)}</span>
                    </div>
                    <h4 style="font-size:0.88rem;font-weight:600;color:var(--parchment-bright);margin-bottom:var(--space-2);line-height:1.4;">${esc(d.title)}</h4>
                    <p class="body-muted" style="font-size:0.78rem;">${esc((d.description || '').substring(0, 100))}...</p>
                    <div id="disarm-detail-${esc(d.id)}" style="display:none;margin-top:var(--space-3);">
                      ${d.adversaryTactics?.length ? `
                        <div class="status-label text-crimson" style="margin-bottom:4px;">ADVERSARY TACTICS:</div>
                        ${d.adversaryTactics.map(t => `<div style="font-size:0.78rem;margin-bottom:3px;">▸ ${esc(t)}</div>`).join('')}
                      ` : ''}
                      ${d.countermeasures?.length ? `
                        <div class="status-label text-emerald" style="margin-top:var(--space-2);margin-bottom:4px;">COUNTERMEASURES:</div>
                        ${d.countermeasures.map(c => `<div style="font-size:0.78rem;margin-bottom:3px;color:var(--veracity-green);">✓ ${esc(c)}</div>`).join('')}
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>`;
        }).join('')}
      `;

      // Bind search
      const si = container.querySelector('#disarm-search');
      if (si) si.addEventListener('input', () => renderMatrix());

      // Bind card expand
      container.querySelectorAll('.disarm-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-disarm-id');
          const detail = document.getElementById(`disarm-detail-${id}`);
          if (detail) {
            const isOpen = detail.style.display !== 'none';
            detail.style.display = isOpen ? 'none' : 'block';
          }
        });
      });
    };

    renderMatrix();
  },

  // ─────────────────────────────────────────────
  // PREBUNKING SIMULATOR
  // ─────────────────────────────────────────────
  _renderPrebunking() {
    const container = document.getElementById('subtab-prebunking');
    if (!container) return;

    if (!this._inoculation.length) {
      container.innerHTML = `<div class="body-muted" style="padding:var(--space-6);text-align:center;">No inoculation scenarios loaded.</div>`;
      return;
    }

    const renderScenarioList = () => {
      container.innerHTML = `
        <div class="card card-bronze" style="margin-bottom:var(--space-4);">
          <div class="card-header">
            <h3 class="card-title">Psychological Inoculation Simulator</h3>
            <span class="badge badge-veracity">PREBUNKING ENGINE</span>
          </div>
          <p class="body-text">Experience live branching simulations inoculating your reasoning against deceptive narratives before encountering them in the wild.</p>
        </div>
        <div class="grid-3">
          ${this._inoculation.map((sc, idx) => `
            <div class="card card-granite-inset card-clickable" data-sc-idx="${idx}" style="cursor:pointer;">
              <span class="badge ${sc.threatLevel === 'Critical' ? 'badge-disinfo' : sc.threatLevel === 'High' ? 'badge-suspicion' : 'badge-intel'}">${sc.category?.toUpperCase() || 'SCENARIO'}</span>
              <h4 class="heading-4" style="margin:var(--space-2) 0;">${sc.title}</h4>
              <p class="body-muted" style="font-size:0.82rem;">${sc.context?.substring(0, 120)}...</p>
              <div style="margin-top:var(--space-3);display:flex;align-items:center;gap:var(--space-2);">
                <span class="badge ${sc.threatLevel === 'Critical' ? 'badge-disinfo' : 'badge-suspicion'}">${sc.threatLevel}</span>
                <button class="btn btn-sm btn-outline inoculate-btn" data-sc-idx="${idx}">Begin Inoculation →</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      container.querySelectorAll('.inoculate-btn, .card-clickable[data-sc-idx]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(el.getAttribute('data-sc-idx'));
          this._runInoculationScenario(this._inoculation[idx], container);
        });
      });
    };

    renderScenarioList();

    // PDP slice 3: the adaptive run's entry card lives in this container. The module
    // (re-)inserts it idempotently by id each time this renderer rebuilds the subtab,
    // so the card survives the list's re-renders without this file knowing its internals.
    this._app?.modules?.inoculationAdaptive?.renderEntryCard(container);
  },

  _runInoculationScenario(scenario, container) {
    // Held-out stages are measurement probes reserved for the adaptive engine's measurement
    // runs (js/inoculation.js): playing them here would train the very items the transfer
    // measurement is supposed to hold out. They never render in the static player.
    const stages = (scenario.branchingStages || []).filter((st) => !(st && st.heldOut === true));
    if (!stages.length) {
      this._app?.showToast?.({ type: 'warning', title: 'NO PRACTICE STAGES', message: 'Every stage of this scenario is reserved for held-out measurement.' });
      return;
    }
    let currentStageIdx = 0;
    let resilienceScore = 100;
    let stageShownAt = 0;

    const renderStage = () => {
      const stage = stages[currentStageIdx];
      if (!stage) {
        renderResult();
        return;
      }
      stageShownAt = Date.now();

      container.innerHTML = `
        <div class="card card-bronze" style="margin-bottom:var(--space-4);">
          <div class="flex-row-gap" style="justify-content:space-between;">
            <div>
              <div class="status-label text-bronze">${esc(scenario.category)} — ${esc(scenario.title)}</div>
              <div class="status-label text-muted">Stage ${esc(currentStageIdx + 1)} / ${esc(stages.length)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-2);">
              <span class="body-muted">Resilience:</span>
              <span class="font-mono ${esc(resilienceScore >= 70 ? 'text-emerald' : resilienceScore >= 40 ? 'text-amber' : 'text-crimson')}" style="font-size:1.4rem;font-weight:700;">${esc(resilienceScore)}</span>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--space-4);">
          <div class="status-label text-amber" style="margin-bottom:var(--space-2);">SCENARIO ALERT:</div>
          <p class="body-lead" style="margin-bottom:var(--space-4);line-height:1.65;">${esc(stage.prompt)}</p>
          ${stage.evidenceSnippets?.length ? `
            <div class="card-granite-inset" style="margin-bottom:var(--space-3);">
              <div class="status-label text-bronze" style="margin-bottom:var(--space-2);">AVAILABLE EVIDENCE:</div>
              ${stage.evidenceSnippets.map(e => `
                <div class="flex-row-gap" style="margin-bottom:6px;">
                  <span class="text-intel-cyan">◉</span>
                  <span style="font-size:0.85rem;">${esc(e)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div class="status-label text-muted" style="margin-bottom:var(--space-3);">CHOOSE YOUR RESPONSE:</div>
          <div id="inoc-confidence-host" style="margin-bottom:var(--space-3);"></div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);" id="inoc-choices">
            ${stage.choices.map(ch => `
              <button class="btn btn-outline inoc-choice" data-choice-id="${ch.choiceId}"
                      style="text-align:left;justify-content:space-between;padding:14px 18px;">
                <span>${ch.text}</span>
                <span class="badge ${ch.type === 'Inoculate' ? 'badge-veracity' : ch.type === 'Reactive' ? 'badge-intel' : 'badge-disinfo'}">${ch.type}</span>
              </button>
            `).join('')}
          </div>
          <div id="inoc-feedback" style="display:none;margin-top:var(--space-4);"></div>
        </div>

        <button class="btn btn-secondary" id="btn-inoc-back">← Back to Scenarios</button>
      `;

      Confidence.mount(document.getElementById('inoc-confidence-host'), {
        label: 'HOW SURE ARE YOU THIS IS THE RIGHT RESPONSE?'
      });

      document.getElementById('btn-inoc-back')?.addEventListener('click', () => {
        this._renderPrebunking();
      });

      container.querySelectorAll('.inoc-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          const choiceId = btn.getAttribute('data-choice-id');
          const choice = stage.choices.find(c => c.choiceId === choiceId);
          if (!choice) return;

          const delta = choice.resilienceDelta || 0;
          resilienceScore = Math.max(0, Math.min(100, resilienceScore + delta));

          // Every choice has a stated resilienceDelta (positive for inoculation,
          // negative for vulnerability), so every branch produces a record. The
          // map is: delta > 0 → correct (the response raised resilience), delta < 0
          // → incorrect (it lowered it). There are no neutral branches.
          recordAttempt({
            skillIds: scenario.tests,
            itemId: `${scenario.id}#${stage.stageId}`,
            correct: delta > 0,
            context: CONTEXTS.INOCULATION,
            latencyMs: stageShownAt ? Date.now() - stageShownAt : null,
            heldOut: scenario.heldOut === true,
            chosen: choice.type
          });

          container.querySelectorAll('.inoc-choice').forEach(b => {
            b.disabled = true;
            if (b.getAttribute('data-choice-id') === choiceId) {
              b.style.borderColor = choice.resilienceDelta > 0 ? 'var(--veracity-green)' : choice.resilienceDelta < 0 ? 'var(--disinfo-crimson)' : 'var(--bronze-primary)';
            }
          });

          const fb = document.getElementById('inoc-feedback');
          if (fb) {
            fb.style.display = 'block';
            const deltaText = choice.resilienceDelta > 0 ? `+${choice.resilienceDelta}` : `${choice.resilienceDelta}`;
            fb.innerHTML = `
              <div class="card-granite-inset" style="border-left:3px solid ${esc(choice.resilienceDelta > 0 ? 'var(--veracity-green)' : choice.resilienceDelta < 0 ? 'var(--disinfo-crimson)' : 'var(--bronze-primary)')};">
                <div class="flex-row-gap" style="justify-content:space-between;margin-bottom:var(--space-2);">
                  <span class="status-label ${esc(choice.resilienceDelta > 0 ? 'text-emerald' : choice.resilienceDelta < 0 ? 'text-crimson' : 'text-bronze')}">${esc(choice.type.toUpperCase())} RESPONSE</span>
                  <span class="font-mono ${esc(choice.resilienceDelta > 0 ? 'text-emerald' : 'text-crimson')}">RESILIENCE: ${esc(deltaText)}</span>
                </div>
                <p class="body-text">${esc(choice.feedback)}</p>
                <button class="btn btn-primary" style="margin-top:var(--space-3);" id="btn-inoc-continue">
                  ${currentStageIdx < stages.length - 1 ? 'Continue to Next Stage →' : 'View Inoculation Result →'}
                </button>
              </div>
            `;

            document.getElementById('btn-inoc-continue')?.addEventListener('click', () => {
              currentStageIdx++;
              renderStage();
            });
          }
        });
      });
    };

    const renderResult = () => {
      const excellent = resilienceScore >= 80;
      const good = resilienceScore >= 50;
      container.innerHTML = `
        <div class="card card-bronze" style="text-align:center;padding:var(--space-8);">
          <div style="font-size:3.5rem;margin-bottom:var(--space-3);">${esc(excellent ? '🛡️' : good ? '⚖️' : '⚠️')}</div>
          <div class="heading-2 ${esc(excellent ? 'text-emerald' : good ? 'text-amber' : 'text-crimson')}" style="margin-bottom:var(--space-2);">
            Final Resilience: ${esc(resilienceScore)} / 100
          </div>
          <div class="body-lead" style="margin-bottom:var(--space-4);">${esc(excellent ? 'Exceptional Inoculation Performance' : good ? 'Adequate Epistemic Defense' : 'Vulnerability Identified — Revisit Module')}</div>
          <div class="card-granite-inset" style="text-align:left;margin-bottom:var(--space-4);">
            <div class="status-label text-bronze" style="margin-bottom:var(--space-2);">SCENARIO: ${esc(scenario.title)}</div>
            <div class="body-text">Adversary Techniques Demonstrated: ${scenario.adversaryTechniques?.join(', ') || 'Multiple'}</div>
          </div>
          <div class="flex-row-gap" style="justify-content:center;gap:var(--space-3);">
            <button class="btn btn-secondary" id="btn-inoc-replay">Replay Scenario</button>
            <button class="btn btn-primary" id="btn-inoc-scenarios">Browse All Scenarios →</button>
          </div>
        </div>
      `;

      document.getElementById('btn-inoc-replay')?.addEventListener('click', () => {
        this._runInoculationScenario(scenario, container);
      });
      document.getElementById('btn-inoc-scenarios')?.addEventListener('click', () => {
        this._renderPrebunking();
      });

      this._app.showToast({
        type: excellent ? 'success' : 'info',
        title: `INOCULATION COMPLETE`,
        message: `${scenario.title} — Resilience: ${resilienceScore}/100`
      });
    };

    renderStage();
  },
};
