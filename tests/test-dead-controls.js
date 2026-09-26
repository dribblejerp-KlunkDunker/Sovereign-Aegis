/**
 * SOVEREIGN // AEGIS — Dead-Control Regression Suite
 *
 * Every finding from the 2026-09-24 dead-control audit (STATUS.md, open item 3) is pinned
 * here BY BEHAVIOR, not by grep. A control is dead when nothing that reads it changes what
 * the app does; therefore each pin drives the real module and asserts the state change the
 * control is supposed to cause — attempts written, badges shown, packs assembled, docs
 * exported. If a fix regresses, this suite names the control and fails the gate.
 *
 * Infrastructure: the in-memory IndexedDB stub is the same design as test-attemptlog.js
 * (real IndexedDB behaviour is covered by the Playwright browser suite), plus a minimal
 * document stub — just enough DOM for the modules under test: ids, classes, listeners.
 *
 * Zero external runtime dependencies.
 */

/* ------------------------------------------------------ in-memory IndexedDB stub */

function installIndexedDbStub() {
  const databases = new Map();

  class FakeRequest {
    constructor() { this.result = undefined; this.error = null; }
  }

  class FakeStore {
    constructor(map, tx) { this._map = map; this._tx = tx; }
    _req(value) { const r = new FakeRequest(); r.result = value; return r; }
    put(value, key) {
      if (this._tx.mode !== 'readwrite') throw new Error('read-only transaction');
      this._map.set(key, JSON.parse(JSON.stringify(value)));
      return this._req(key);
    }
    getAll(range) {
      let entries = [...this._map.entries()];
      if (range) entries = entries.filter(([k]) => range.includes(k));
      return this._req(entries.map(([, v]) => v));
    }
    getAllKeys() { return this._req([...this._map.keys()]); }
    count() { return this._req(this._map.size); }
    clear() {
      if (this._tx.mode !== 'readwrite') throw new Error('read-only transaction');
      this._map.clear();
      return this._req(undefined);
    }
  }

  class FakeTransaction {
    constructor(db, storeName, mode) {
      this.mode = mode;
      this._db = db;
      this._storeName = storeName;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      this.error = null;
      queueMicrotask(() => { if (this.oncomplete) this.oncomplete(); });
    }
    objectStore(name) {
      const store = this._db._stores.get(name);
      if (!store) throw new Error(`no such store: ${name}`);
      return new FakeStore(store, this);
    }
  }

  class FakeDb {
    constructor(rec) {
      this._stores = rec.stores;
      this.closed = false;
      this.objectStoreNames = { contains: (n) => rec.stores.has(n) };
    }
    createObjectStore(name) { this._stores.set(name, new Map()); return {}; }
    transaction(storeName, mode = 'readonly') {
      if (this.closed) throw new Error('database is closed');
      return new FakeTransaction(this, storeName, mode);
    }
    close() { this.closed = true; }
  }

  globalThis.indexedDB = {
    open(name, version) {
      const req = new FakeRequest();
      req.onupgradeneeded = null;
      req.onsuccess = null;
      req.onerror = null;
      queueMicrotask(() => {
        let rec = databases.get(name);
        const isNew = !rec || rec.version < version;
        if (!rec) { rec = { version, stores: new Map() }; databases.set(name, rec); }
        req.result = new FakeDb(rec);
        if (isNew) { rec.version = version; if (req.onupgradeneeded) req.onupgradeneeded(); }
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    _databases: databases
  };

  globalThis.IDBKeyRange = {
    lowerBound(bound) { return { includes: (k) => String(k) >= String(bound) }; }
  };
}

installIndexedDbStub();

/* ---------------------------------------------------------- minimal document stub */

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this._classes = new Set();
    this._listeners = new Map();
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.style = {};
  }
  get classList() {
    const self = this;
    return {
      add: (...cs) => cs.forEach((c) => self._classes.add(c)),
      remove: (...cs) => cs.forEach((c) => self._classes.delete(c)),
      toggle: (c, force) => {
        const on = force === undefined ? !self._classes.has(c) : Boolean(force);
        if (on) self._classes.add(c); else self._classes.delete(c);
        return on;
      },
      contains: (c) => self._classes.has(c)
    };
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(child) {
    if (child && child.parentElement) {
      const siblings = child.parentElement.children;
      const at = siblings.indexOf(child);
      if (at !== -1) siblings.splice(at, 1);
    }
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      const at = siblings.indexOf(this);
      if (at !== -1) siblings.splice(at, 1);
      this.parentElement = null;
    }
  }
  get firstChild() { return this.children.length ? this.children[0] : null; }
  insertBefore(node, reference) {
    if (node && node.parentElement) {
      const siblings = node.parentElement.children;
      const at = siblings.indexOf(node);
      if (at !== -1) siblings.splice(at, 1);
    }
    if (!reference) {
      this.children.push(node);
    } else {
      const at = this.children.indexOf(reference);
      this.children.splice(at === -1 ? this.children.length : at, 0, node);
    }
    node.parentElement = this;
    return node;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }

  get dataset() {
    const self = this;
    const toAttr = (key) => 'data-' + String(key).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    return new Proxy({}, {
      get(_, key) {
        const v = self.attributes.get(toAttr(key));
        return v === undefined ? undefined : v;
      },
      set(_, key, value) { self.attributes.set(toAttr(key), String(value)); return true; }
    });
  }

  /**
   * Minimal selector support, only what the modules under test use:
   * `:scope > .class` (Confidence.mount), `.class` and `[attr]` (Confidence._sync),
   * plus `#id` / `[attr="value"]` at document level.
   */
  querySelector(selector) {
    const scopeChild = selector.match(/^:scope\s*>\s*\.([\w-]+)$/);
    if (scopeChild) return this.children.find((c) => c._classes.has(scopeChild[1])) || null;
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const cls = selector.match(/^\.([\w-]+)$/);
    const attr = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (!cls && !attr) return [];
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        const ok = cls
          ? child._classes.has(cls[1])
          : child.attributes.has(attr[1]) && (attr[2] === undefined || child.attributes.get(attr[1]) === attr[2]);
        if (ok) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  _fire(type, event = { preventDefault() {}, stopPropagation() {} }) {
    for (const fn of this._listeners.get(type) || []) fn.call(this, event);
  }
}

function installDocumentStub() {
  const byId = new Map();          // id -> FakeElement
  const byAttr = new Map();        // 'attr="value"' -> FakeElement

  globalThis.document = {
    body: new FakeElement('body'),
    _registerById(el) { if (el.id) byId.set(el.id, el); return el; },
    _registerByAttr(el, attr, value) { byAttr.set(`${attr}="${value}"`, el); return el; },
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
    getElementById: (id) => {
      const direct = byId.get(id);
      // A cached node only counts while it is still attached — .remove() must make it
      // unfindable, exactly like the real DOM.
      const attached = (el) => {
        let cur = el;
        while (cur) { if (cur === globalThis.document.body) return true; cur = cur.parentElement; }
        return false;
      };
      if (direct && attached(direct)) return direct;
      if (direct && !attached(direct)) byId.delete(id);
      // Dynamically created nodes get ids but are only reachable through the tree.
      const scan = (el) => {
        for (const child of el.children) {
          if (child.id === id) { byId.set(id, child); return child; }
          const hit = scan(child);
          if (hit) return hit;
        }
        return null;
      };
      return scan(globalThis.document.body);
    },
    querySelector: (sel) => {
      const idMatch = sel.match(/^#([\w-]+)$/);
      if (idMatch) return byId.get(idMatch[1]) || null;
      const attrMatch = sel.match(/^(?:[\w-]+)?\[([\w-]+)="([^"]*)"\]$/);
      if (attrMatch) return byAttr.get(`${attrMatch[1]}="${attrMatch[2]}"`) || null;
      return null;
    },
    querySelectorAll: (sel) => {
      const clsMatch = sel.match(/^\.([\w-]+)$/);
      if (!clsMatch) return [];
      const found = [];
      const walk = (el) => {
        for (const child of el.children) {
          if (child._classes.has(clsMatch[1])) found.push(child);
          walk(child);
        }
      };
      walk(globalThis.document.body);
      return found;
    },
    addEventListener() {},
    _byId: byId
  };

  globalThis.Element = FakeElement;
  globalThis.window = globalThis;
  const windowListeners = new Map();
  globalThis.window.addEventListener = (type, fn) => {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(fn);
  };
  globalThis.window._fire = (type, event = {}) => {
    for (const fn of windowListeners.get(type) || []) fn({ preventDefault() {}, ...event });
  };
  globalThis.window.dispatchEvent = () => true;
}

installDocumentStub();

/* ------------------------------------------------------------------ harness */

class TestHarness {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.totalAssertions = 0;
    this.passed = 0;
    this.failed = 0;
    this.failures = [];
    this.currentSuite = '';
  }

  describe(name, fn) {
    this.currentSuite = name;
    console.log(`\n  --- ${name} ---`);
    return fn();
  }

  async it(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.failed++;
      this.totalAssertions++;
      this.failures.push({ suite: this.currentSuite, test: name, error: err.message });
      console.error(`  ✗ [FAIL] ${name} (${err.message})`);
    }
  }

  assert(condition, message) {
    this.totalAssertions++;
    if (condition) {
      this.passed++;
      console.log(`    ✓ ${message}`);
    } else {
      this.failed++;
      this.failures.push({ suite: this.currentSuite, test: message, error: 'Assertion failed' });
      console.error(`    ✗ [FAIL] ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    this.assert(actual === expected, `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }

  summary() {
    console.log('\n====================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('====================================================');
    if (this.failed > 0) {
      console.error('\nFailure Details:');
      this.failures.forEach(f => console.error(` - [${f.suite}] ${f.test}: ${f.error}`));
      if (process.exitCode === undefined || process.exitCode === 0) {
        process.exitCode = 1;
      }
    }
    return { passed: this.passed, failed: this.failed, total: this.totalAssertions };
  }
}

const harness = new TestHarness('Dead-Control Regression Suite');
const t = harness;
const drain = () => new Promise((r) => setTimeout(r, 20));

function el(id, cls = '') {
  const e = new FakeElement('div');
  e.id = id;
  if (cls) e.className = cls;
  globalThis.document._registerById(e);
  globalThis.document.body.appendChild(e);
  return e;
}

async function runTests() {
  const { AegisCrypto } = await import('../js/crypto.js');

  /* ---------------------------------------------------------- Arena controls */

  await t.describe('Dead control 1+2 — Arena probe badge & Calibrated Mode', async () => {
    const { InfiniteArena } = await import('../js/modules/infiniteArena.js');
    const { Confidence } = await import('../js/confidence.js');
    const { AttemptLog } = await import('../js/attemptlog.js');
    const makeArena = (questions) => Object.assign(Object.create(Object.getPrototypeOf(InfiniteArena)), InfiniteArena, {
      _questions: questions, _skills: [], _sinceProbe: 0, _questionShownAt: 0,
      _rankedPool: null, _mode: 'blitz', _score: 0, _streak: 0, _roundHistory: [],
      _app: { store: { get: () => null, set: () => {} } }
    });
    const QS = [
      { id: 'p1', domain: 'Test Domain', difficulty: 1200, claim: 'c1', options: ['a0', 'a1', 'a2', 'a3'], correctIndex: 0, tests: ['skill.a'], heldOut: false, explanation: 'x' },
      { id: 'h1', domain: 'Test Domain', difficulty: 1300, claim: 'c2', options: ['b0', 'b1', 'b2', 'b3'], correctIndex: 0, tests: ['skill.a'], heldOut: true, explanation: 'x' }
    ];
    const fixtureEls = () => {
      el('arena-options-grid');
      el('arena-confidence-host');
      el('arena-active-probe', 'badge hidden');
      el('arena-live-feedback');
      el('arena-active-view');
      el('arena-timer-display');
    };

    await t.it('the TRANSFER PROBE badge shows exactly while a held-out probe is active', async () => {
      fixtureEls();
      const arena = makeArena(QS);
      const badge = globalThis.document.getElementById('arena-active-probe');
      arena._updateProbeBadge(QS[0]); // practice item
      t.assertEqual(badge.classList.contains('hidden'), true, 'practice question keeps the badge hidden');
      arena._updateProbeBadge(QS[1]); // held-out probe
      t.assertEqual(badge.classList.contains('hidden'), false, 'probe question reveals the badge');
      arena._updateProbeBadge({});
      t.assertEqual(badge.classList.contains('hidden'), true, 'an unflagged question never shows the badge');
    });

    await t.it('the probe badge element exists in the shipped markup (a deleted badge fails loudly here)', async () => {
      const fsMod = await import('node:fs');
      const urlMod = await import('node:url');
      const html = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
      t.assert(html.includes('id="arena-active-probe"'), 'index.html still carries the probe badge element');
      t.assert(html.includes('id="btn-mode-calibrated"'), 'index.html still carries the Calibrated Mode card');
      t.assert(html.includes('id="check-include-custom-cards"'), 'index.html still carries the custom-cards checkbox');
      t.assert(html.includes('data-aegis-modal="modal-did-export"'), 'the DID-export trigger is still wired to the modal');
    });

    await t.it('Calibrated Mode gates answers until a confidence tap, then records THAT tap', async () => {
      fixtureEls();
      Confidence._reset();
      Confidence.init(null);
      await AttemptLog.clear();
      const arena = makeArena(QS);
      await arena.startRound('calibrated');
      await drain();

      t.assertEqual(arena._mode, 'calibrated', 'the mode is armed');
      t.assert(arena._activeQuestion, 'a question is on the floor');
      const grid = globalThis.document.getElementById('arena-options-grid');
      t.assertEqual(grid.classList.contains('arena-calibrated-locked'), true, 'options start locked');
      t.assert(globalThis.document.getElementById('arena-calibration-gate'), 'the lock notice is rendered');

      arena.submitAnswer(0);
      await drain();
      t.assertEqual(arena._roundHistory.length, 0, 'no tap → no answer, no attempt, no score');
      t.assertEqual(await AttemptLog.count(), 0, 'the attempt log is untouched before the tap');

      Confidence.set('unsure');
      t.assertEqual(grid.classList.contains('arena-calibrated-locked'), false, 'a tap unlocks the grid');
      t.assertEqual(globalThis.document.getElementById('arena-calibration-gate'), null, 'the lock notice is removed');

      arena.submitAnswer(0);
      await drain();
      t.assertEqual(arena._roundHistory.length, 1, 'the answer is recorded after the tap');
      t.assertEqual(arena._roundHistory[0].confidence, 'unsure', 'the round history carries the tapped level');
      const all = await AttemptLog.readAll();
      t.assertEqual(all.length, 1, 'one attempt written');
      t.assertEqual(all[0].confidence, 'unsure', 'the ATTEMPT LOG carries the tapped level, not a default');

      arena.nextQuestion();
      await drain();
      t.assertEqual(grid.classList.contains('arena-calibrated-locked'), true, 'the next question is locked again — every answer needs a fresh statement');
      t.assertEqual(arena._calibratedTap, null, 'no stale tap survives into the next question');

      Confidence.set('guess');
      arena.submitAnswer(1);
      await drain();
      t.assertEqual(arena._roundHistory[1].confidence, 'guess', 'the second answer carries its own statement');

      arena.endRound('Regression test finished');
      await drain();
      const attempts = await AttemptLog.readAll();
      t.assertEqual(attempts.length, 2, 'both calibrated answers reached the log');
      t.assertEqual(JSON.stringify(attempts.map((a) => a.confidence)), '["unsure","guess"]', 'no default confidence anywhere in the round');
    });

    await t.it('keyboard answers obey the same gate — key 1 is not a cheat code', async () => {
      fixtureEls();
      Confidence._reset();
      Confidence.init(null);
      await AttemptLog.clear();
      const arena = makeArena(QS);
      await arena.startRound('calibrated');
      arena._bindEvents(); // registers the window keydown path under test
      await drain();

      globalThis.window._fire('keydown', { key: '1' });
      await drain();
      t.assertEqual(arena._roundHistory.length, 0, 'keyboard submit is refused without a tap');

      Confidence.set('sure');
      globalThis.window._fire('keydown', { key: '1' });
      await drain();
      t.assertEqual(arena._roundHistory.length, 1, 'keyboard submit works after the tap');
      t.assertEqual(arena._roundHistory[0].confidence, 'sure', 'the keyboard path records the tapped level too');

      arena.endRound('Regression test finished');
      await drain();
    });

    await t.it('non-calibrated modes never gate and keep the shared default', async () => {
      fixtureEls();
      Confidence._reset();
      Confidence.init(null);
      await AttemptLog.clear();
      const arena = makeArena(QS);
      await arena.startRound('blitz');
      await drain();
      const grid = globalThis.document.getElementById('arena-options-grid');
      t.assertEqual(grid.classList.contains('arena-calibrated-locked'), false, 'blitz is never locked');
      arena.submitAnswer(0);
      await drain();
      t.assertEqual(arena._roundHistory.length, 1, 'blitz answers without any tap ceremony');
      arena.endRound('Regression test finished');
      await drain();
      const attempts = await AttemptLog.readAll();
      t.assertEqual(attempts.length, 1, 'blitz still writes its attempt');
      t.assertEqual(attempts[0].confidence === undefined || typeof attempts[0].confidence === 'string', true, 'blitz confidence comes from the shared control, unchanged');
    });

    await t.it('Confidence.subscribe fires on statements, never on subscribe, and unsubscribes', async () => {
      Confidence._reset();
      Confidence.init(null);
      const seen = [];
      const unsub = Confidence.subscribe((level) => seen.push(level));
      t.assertEqual(seen.length, 0, 'subscribing does not replay the current level');
      Confidence.set('sure');
      Confidence.set('sure'); // a re-tap is still a statement
      unsub();
      Confidence.set('guess');
      t.assertEqual(JSON.stringify(seen), '["sure","sure"]', 'both statements delivered; nothing after unsubscribe');
    });
  });

  /* ------------------------------------------------------- Commons pack builder */

  await t.describe('Dead control 3 — custom-cards checkbox assembles real packs', async () => {
    const { EpistemicCommons } = await import('../js/modules/epistemicCommons.js');
    const makeCommons = (storeMap) => {
      const store = { get: (k) => (storeMap.has(k) ? storeMap.get(k) : null), set: (k, v) => storeMap.set(k, v) };
      const toasts = [];
      return Object.assign(Object.create(Object.getPrototypeOf(EpistemicCommons)), EpistemicCommons, {
        _app: { store, showToast: (x) => toasts.push(x) }
      });
    };
    const DECK = JSON.stringify([
      { id: 'card-custom-1', domain: 'Logical Fallacy', prompt: 'P1', diagnosis: 'D1', latin: '', mechanism: 'M1', countermeasure: 'C1' },
      { id: 'card-legacy-99', domain: 'Curated', prompt: 'P2', diagnosis: 'D2', latin: '', mechanism: 'M2', countermeasure: 'C2' }
    ]);
    const PINS = JSON.stringify([{ id: 'pin1', title: 'Pinned Title', content: 'Pinned content body' }]);
    const INPUTS = { title: 'Operator Pack', author: 'Tester', domain: 'AI Forensics & Statecraft', desc: 'A pack description' };

    await t.it('unchecked, the checkbox contributes nothing — exactly the old behavior', async () => {
      const commons = makeCommons(new Map([['sm2.deck', DECK], ['dossier.pins', PINS]]));
      const pack = commons._assemblePack({ ...INPUTS, includeDossier: false, includeCustom: false });
      t.assertEqual(pack.cards.length, 0, 'no cards without either switch');
      t.assertEqual(pack.stats.cards, 0, 'the declared card count matches the pack body');
    });

    await t.it('checked, every card-custom-* Memory Vault card ships in the pack', async () => {
      const commons = makeCommons(new Map([['sm2.deck', DECK], ['dossier.pins', PINS]]));
      const pack = commons._assemblePack({ ...INPUTS, includeDossier: false, includeCustom: true });
      t.assertEqual(pack.cards.length, 1, 'exactly the operator-authored card is included');
      t.assertEqual(pack.cards[0].id, 'card-custom-1', 'the custom card is present verbatim');
      t.assert(!pack.cards.some((c) => c.id === 'card-legacy-99'), 'curated deck items are never swept in');
      t.assertEqual(pack.stats.cards, 1, 'the declared count matches');
    });

    await t.it('both switches compose; the count never lies', async () => {
      const commons = makeCommons(new Map([['sm2.deck', DECK], ['dossier.pins', PINS]]));
      const pack = commons._assemblePack({ ...INPUTS, includeDossier: true, includeCustom: true });
      t.assertEqual(pack.cards.length, 2, 'one dossier pin + one custom card');
      t.assert(pack.cards.some((c) => c.id === 'card-pin1'), 'the dossier card is present');
      t.assert(pack.cards.some((c) => c.id === 'card-custom-1'), 'the custom card is present');
      t.assertEqual(pack.stats.cards, 2, 'the declared count matches the body');
    });
  });

  /* ------------------------------------------------------------ DID-export modal */

  await t.describe('Dead control 5 — DID-export modal shows and copies the live identity', async () => {
    const { IdentityModule } = await import('../js/modules/identity.js');
    const makeIdentity = (storeMap) => {
      const store = { get: (k) => (storeMap.has(k) ? storeMap.get(k) : null), set: (k, v) => storeMap.set(k, v) };
      return Object.assign(Object.create(Object.getPrototypeOf(IdentityModule)), IdentityModule, {
        _app: { store, showToast: () => {} }
      });
    };
    const fixtureEls = () => {
      el('did-export-json-view');
      el('btn-copy-jsonld');
      const opener = new FakeElement('button');
      opener.setAttribute('data-aegis-modal', 'modal-did-export');
      globalThis.document._registerByAttr(opener, 'data-aegis-modal', 'modal-did-export');
      globalThis.document.body.appendChild(opener);
      return opener;
    };

    await t.it('opening the modal populates it with a REAL, verifiable export of THIS identity', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      const opener = fixtureEls();
      const identity = makeIdentity(new Map([
        ['identity.did', kp.did],
        ['identity.publicKeyJwk', kp.publicKeyJwk]
      ]));
      // The browser vault holds a non-extractable CryptoKey; here the freshly generated
      // private key stands in for it, so the displayed credential is signed for real.
      identity._resolveSigningKey = async () => ({ key: kp.keyPair.privateKey, hardened: true });
      // Bind the module's listeners to the stub DOM (same wiring the browser boot runs).
      identity._bindAttestationEvents();

      const view = globalThis.document.getElementById('did-export-json-view');
      opener._fire('click');
      await new Promise((r) => setTimeout(r, 50));

      t.assert(!view.textContent.includes('z6MkuA9vR7q'), 'the hardcoded example DID is gone');
      const exported = JSON.parse(view.textContent);
      t.assertEqual(exported.didDocument.id, kp.did, 'the DID Document carries the operator DID');
      t.assertEqual(exported.didDocument.verificationMethod[0].publicKeyJwk.x, kp.publicKeyJwk.x, 'the published key is the operator key (public coordinates only)');
      t.assert(exported.selfSignedCredential && exported.selfSignedCredential.proof.jws, 'a self-signed credential is present with its proof');

      // The modal must not just SHOW crypto — it must show VALID crypto.
      const ok = await AegisCrypto.verifyStatement(
        kp.publicKeyJwk,
        exported.selfSignedCredential.credentialSubject,
        exported.selfSignedCredential.proof.jws
      );
      t.assertEqual(ok, true, 'the displayed credential verifies against the displayed key');

      // The copy button must copy exactly what is displayed.
      let copied = null;
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { clipboard: { writeText: async (text) => { copied = text; } } }
      });
      globalThis.document.getElementById('btn-copy-jsonld')._fire('click');
      await new Promise((r) => setTimeout(r, 20));
      t.assert(copied && JSON.parse(copied).didDocument.id === kp.did, 'copy exports the live document, not the old static prop');
    });

    await t.it('with no identity, the modal says so instead of showing a fake', async () => {
      const opener = fixtureEls();
      const identity = makeIdentity(new Map());
      identity._bindAttestationEvents();
      const view = globalThis.document.getElementById('did-export-json-view');
      opener._fire('click');
      await new Promise((r) => setTimeout(r, 20));
      t.assert(/No identity found/.test(view.textContent), 'the empty case is stated plainly');
    });

    await t.it('a missing signing key still exports the DID Document, visibly without the proof', async () => {
      const kp = await AegisCrypto.generateKeyPair();
      const opener = fixtureEls();
      const identity = makeIdentity(new Map([
        ['identity.did', kp.did],
        ['identity.publicKeyJwk', kp.publicKeyJwk]
      ]));
      identity._resolveSigningKey = async () => null; // vault unavailable
      identity._bindAttestationEvents();
      const view = globalThis.document.getElementById('did-export-json-view');
      opener._fire('click');
      await new Promise((r) => setTimeout(r, 50));
      const exported = JSON.parse(view.textContent);
      t.assertEqual(exported.didDocument.id, kp.did, 'the DID Document still exports');
      t.assertEqual(exported.selfSignedCredential, null, 'the credential is absent — the absence is visible, never faked');
    });
  });

  /* ------------------------------------------------- Honest chrome (2026-09-25) */

  await t.describe('Honest chrome — theatrical statics replaced by derived state (2026-09-25)', async () => {
    const { VerdadEngine } = await import('../js/modules/verdad.js');
    const { StateStore, SEED_STATE } = await import('../js/state.js');
    const { estimateAggregate, practiceDaySpan } = await import('../js/competency.js');
    const fsMod = await import('node:fs');
    const urlMod = await import('node:url');
    const html = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
    const stateSrc = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../js/state.js', import.meta.url)), 'utf8');
    const SKILLS = [{ id: 'skill.a' }, { id: 'skill.b' }];

    await t.it('the theatrical strings are gone from markup and seed, placeholders fail loud', async () => {
      t.assert(!html.includes('THREAT: ELEVATED'), 'index.html no longer hardcodes THREAT: ELEVATED (42%)');
      t.assert(!html.includes('94.8% RESILIENT'), 'index.html no longer hardcodes 94.8% RESILIENT');
      t.assert(!html.includes('T+2026.08.16'), 'index.html no longer hardcodes the invented epoch');
      t.assert(html.includes('THREAT: UNAUDITED'), 'the pill ships with the fail-loud UNAUDITED placeholder');
      t.assert(html.includes('id="telemetry-immunity-val" title='), 'the immunity placeholder names its measurement rule in markup');
      t.assert(!SEED_STATE.telemetry.threatLevel, 'no seeded threatLevel');
      t.assert(!SEED_STATE.telemetry.epistemicHealth, 'no seeded epistemicHealth');
      t.assert(!SEED_STATE.telemetry.blockHeight, 'no fake blockHeight');
      t.assert(!SEED_STATE.telemetry.uptimeSeconds, 'no fake uptime');
      t.assert(!stateSrc.includes("threatLevel: 'ELEVATED'"), 'the ELEVATED seed string is gone from state.js');
    });

    await t.it('deriveThreat maps Verdad risk bands to pill labels and fails closed', async () => {
      t.assertEqual(VerdadEngine.deriveThreat({ manipulationRisk: 58 }).label, 'THREAT: HIGH (58%)', 'a mid-band audit maps to HIGH with the measured pct');
      t.assertEqual(VerdadEngine.deriveThreat({ manipulationRisk: 70 }).level, 'CRITICAL', '70 is Critical in Verdad\u2019s own tiering');
      t.assertEqual(VerdadEngine.deriveThreat({ manipulationRisk: 40 }).level, 'HIGH', '40 is the HIGH boundary');
      t.assertEqual(VerdadEngine.deriveThreat({ manipulationRisk: 25 }).level, 'MODERATE', '25 is the MODERATE boundary');
      t.assertEqual(VerdadEngine.deriveThreat({ manipulationRisk: 5 }).level, 'LOW', 'a low-risk claim reads LOW');
      t.assertEqual(VerdadEngine.deriveThreat({ manipulationRisk: 140 }).pct, 100, 'out-of-range risk clamps, never propagates garbage');
      t.assertEqual(VerdadEngine.deriveThreat(null), null, 'no result, no level');
      t.assertEqual(VerdadEngine.deriveThreat({}), null, 'an audit without a measured risk produces no level, never a default');
    });

    await t.it('estimateAggregate means mastery over ATTEMPTED skills only, probes excluded', async () => {
      const now = 1_800_000_000_000;
      const attempts = [
        { ts: now, skillId: 'skill.a', itemId: 'i1', correct: true },
        { ts: now, skillId: 'skill.a', itemId: 'i2', correct: true },
        { ts: now, skillId: 'skill.b', itemId: 'i3', correct: false },
        { ts: now, skillId: 'skill.a', itemId: 'i4', correct: true, heldOut: true }
      ];
      const agg = estimateAggregate(attempts, SKILLS, { now });
      t.assertEqual(agg.available, true, 'attempts produce a real measurement');
      t.assertEqual(agg.skillsAttempted, 2, 'only attempted skills enter the mean');
      t.assertEqual(agg.n, 3, 'held-out probes are excluded from the headline');
      t.assert(agg.value > 0.5, 'two of three correct sits above the cold-start prior');
      const empty = estimateAggregate([], SKILLS);
      t.assertEqual(empty.available, false, 'no attempts is a distinct stated state');
      t.assertEqual(empty.value, null, 'it never masquerades as 0.5 or 50%');
    });

    await t.it('practiceDaySpan measures from the first real attempt, unknown skills excluded', async () => {
      const now = 1_800_000_000_000;
      const day = 86_400_000;
      const attempts = [
        { ts: now - 3 * day, skillId: 'skill.a', itemId: 'i1', correct: true },
        { ts: now, skillId: 'skill.b', itemId: 'i2', correct: false },
        { ts: now - 30 * day, skillId: 'skill.unknown', itemId: 'ghost', correct: true }
      ];
      const span = practiceDaySpan(attempts, SKILLS, { now });
      t.assertEqual(span.available, true, 'history exists');
      t.assertEqual(span.days, 3, 'the epoch is the first catalogue-tagged attempt, three days back');
      t.assertEqual(span.firstAttemptAt, now - 3 * day, 'the first-attempt timestamp rides along for the tooltip');
      t.assertEqual(practiceDaySpan([], SKILLS).available, false, 'no history is stated, never rendered as D+0');
    });
  });

  await t.describe('Honest chrome — the app shell renders derived state into the ticker', async () => {
    // App.js auto-inits one microtask after import when document.readyState is undefined;
    // pin readyState so the boot path never runs against the stub DOM.
    globalThis.document.readyState = 'loading';
    const appMod = await import('../js/app.js');
    const { AttemptLog } = await import('../js/attemptlog.js');
    const { StateStore } = await import('../js/state.js');

    const buildApp = () => {
      const store = new StateStore({}, { storageKey: 'honesty-test' });
      const app = Object.assign(Object.create(Object.getPrototypeOf(appMod.AegisApp)), appMod.AegisApp, {
        store,
        _sessionStart: Date.now() - 90_000, // 90s into this session, so the SESSION clock reads 00:01:30
        _loadSkills: async () => [{ id: 'skill.a' }, { id: 'skill.b' }]
      });
      return app;
    };
    const fixtureEls = () => {
      el('threat-index-val');
      el('topbar-threat-badge');
      el('telemetry-immunity-val');
      el('telemetry-epoch');
    };

    await t.it('the THREAT pill renders UNAUDITED until a real audit, then the derived label', async () => {
      fixtureEls();
      await AttemptLog.clear();
      const app = buildApp();
      app._renderThreatPill(app.store.get('verdad.lastAudit', null));
      const pill = globalThis.document.getElementById('threat-index-val');
      t.assertEqual(pill.textContent, 'THREAT: UNAUDITED', 'no audit, no level — the placeholder says so');
      t.assert(pill.classList.contains('aegis-threat-unaudited'), 'the placeholder is styled as unaudited');

      app.setThreatFromAudit({ manipulationRisk: 58, claimText: 'A claim the operator actually submitted.', at: 123 });
      const audit = app.store.get('verdad.lastAudit', null);
      t.assertEqual(audit.label, 'THREAT: HIGH (58%)', 'the completed audit is stored as the pill source');
      app._renderThreatPill(audit);
      t.assertEqual(pill.textContent, 'THREAT: HIGH (58%)', 'the pill shows the derived label, not a seeded level');
      t.assert(!pill.classList.contains('aegis-threat-unaudited'), 'the unaudited styling is cleared');
      t.assert(globalThis.document.getElementById('topbar-threat-badge').title.includes('A claim the operator'), 'the hover title names the audited claim');

      app.setThreatFromAudit({});
      t.assertEqual(app.store.get('verdad.lastAudit', null).pct, 58, 'a result without a measurement cannot clobber the last real one');
    });

    await t.it('the subscribe path repaints the pill from verdad.lastAudit changes', async () => {
      fixtureEls();
      const app = buildApp();
      app._subscribeTelemetryUI();
      app.setThreatFromAudit({ manipulationRisk: 80, claimText: 'Critical claim.' });
      await drain();
      t.assertEqual(globalThis.document.getElementById('threat-index-val').textContent, 'THREAT: CRITICAL (80%)', 'a new audit repaints the pill through the store subscription');
    });

    await t.it('IMMUNITY INDEX derives from the attempt log and says UNMEASURED when empty', async () => {
      fixtureEls();
      await AttemptLog.clear();
      const app = buildApp();
      await app._refreshChromeHonesty();
      app._renderImmunityIndex();
      const scoreEl = globalThis.document.getElementById('telemetry-immunity-val');
      t.assertEqual(scoreEl.textContent, 'UNMEASURED', 'cold start is stated, never faked');

      const now = Date.now();
      await AttemptLog.append({ skillId: 'skill.a', itemId: 'i1', correct: true, ts: now - 1000, context: 'arena' });
      await AttemptLog.append({ skillId: 'skill.b', itemId: 'i2', correct: true, ts: now - 2000, context: 'arena' });
      await app._refreshChromeHonesty();
      app._renderImmunityIndex();
      t.assertEqual(scoreEl.textContent, '67% RESILIENT (n=2, 2 skills)', 'the headline carries the measured value AND its sample size (the Beta prior keeps one attempt per skill honest, below 100%)');
      t.assert(scoreEl.title.includes('held-out'), 'the tooltip discloses that it is an estimate from the log');
    });

    await t.it('EPOCH shows D+<practice days> with history, SESSION age without', async () => {
      fixtureEls();
      await AttemptLog.clear();
      const app = buildApp();
      await app._refreshChromeHonesty();
      app._renderEpoch();
      const epochEl = globalThis.document.getElementById('telemetry-epoch');
      t.assert(/^SESSION \d\d:\d\d:\d\d$/.test(epochEl.textContent), `no history renders the labeled session age, got: ${epochEl.textContent}`);

      const day = 86_400_000;
      await AttemptLog.append({ skillId: 'skill.a', itemId: 'i1', correct: true, ts: Date.now() - 3 * day, context: 'arena' });
      await app._refreshChromeHonesty();
      app._renderEpoch();
      t.assertEqual(epochEl.textContent, 'D+3', 'the epoch is days since the first recorded attempt');
      t.assert(epochEl.title.includes('first attempt'), 'the tooltip names the real first-attempt date');
    });

    await t.it('the tick loop updates EPOCH every second from the same derived state', async () => {
      fixtureEls();
      await AttemptLog.clear();
      const app = buildApp();
      app.startTelemetryLoop();
      try {
        const epochEl = globalThis.document.getElementById('telemetry-epoch');
        await new Promise((r) => setTimeout(r, 1100)); // first clock tick (1000ms) fires _renderEpoch
        t.assert(/^SESSION \d\d:\d\d:\d\d$/.test(epochEl.textContent), `the tick renders the labeled session age (${epochEl.textContent})`);
        const before = epochEl.textContent;
        await new Promise((r) => setTimeout(r, 1100)); // second tick advances it
        t.assert(epochEl.textContent !== before, `the session clock advances on the tick (${before} → ${epochEl.textContent})`);
      } finally {
        app.stopTelemetryLoop(); // never leak intervals into the rest of the gate
      }
    });

    await t.it('the shell wires the audit hook, the derived keys, and no ghost telemetry keys', async () => {
      const fsMod = await import('node:fs');
      const urlMod = await import('node:url');
      const appSrc = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../js/app.js', import.meta.url)), 'utf8');
      const verdadSrc = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../js/modules/verdad.js', import.meta.url)), 'utf8');
      t.assert(verdadSrc.includes('setThreatFromAudit?.(result)'), 'executeAudit publishes the completed audit to the shell');
      t.assert(appSrc.includes("subscribe('verdad.lastAudit'"), 'the shell subscribes the pill to the audit record');
      t.assert(appSrc.includes("subscribe('chrome.honesty'"), 'the shell subscribes immunity/epoch to the derived snapshot');
      t.assert(!appSrc.includes("store.set('telemetry.blockHeight'"), 'nothing writes the removed fake blockHeight anymore');
    });
  });

  await t.describe('Honest chrome II — sentinel posture, AP truth, measured latency (2026-09-25)', async () => {
    const appMod = await import('../js/app.js');
    const { StateStore, SEED_STATE } = await import('../js/state.js');
    const fsMod = await import('node:fs');
    const urlMod = await import('node:url');
    const html = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
    const stateSrc = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../js/state.js', import.meta.url)), 'utf8');
    const appSrc = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../js/app.js', import.meta.url)), 'utf8');

    const buildApp = () => {
      const store = new StateStore({}, { storageKey: 'honesty2-test' });
      return Object.assign(Object.create(Object.getPrototypeOf(appMod.AegisApp)), appMod.AegisApp, { store });
    };
    const fixtureEls = () => {
      const badge = el('topbar-sentinel-badge');
      const label = new FakeElement('span'); label.className = 'status-label'; badge.appendChild(label);
      const dot = new FakeElement('span'); dot.className = 'pulse-dot dot-emerald'; badge.appendChild(dot);
      el('telemetry-ap-val', 'text-bronze');
      el('telemetry-latency-val');
    };

    await t.it('the theatrical strings are gone from markup and seed', async () => {
      t.assert(!html.includes('SENTINEL: ARMED</span>'), 'markup no longer hardcodes SENTINEL: ARMED');
      t.assert(!/id="telemetry-ap-val"[^>]*>10 \/ 10 AP/.test(html), 'the AP TICKER no longer hardcodes 10 / 10 AP (the in-game badge is real game state and stays)');
      t.assert(!html.includes('24ms (EDGE)'), 'markup no longer hardcodes a fake latency');
      t.assert(html.includes('SENTINEL: …'), 'the sentinel pill ships with a fail-loud placeholder');
      t.assert(html.includes('AP: — (NO CAMPAIGN)'), 'the AP ticker ships with a fail-loud placeholder');
      t.assert(html.includes('MEASURING…'), 'the latency ticker ships with a measuring placeholder');
      // Structural seed checks: the fictional blocks must not exist AT ALL.
      t.assert(!('attestation' in SEED_STATE), 'no invented enclave/PCR attestation block in the seed');
      t.assert(!('consensus' in SEED_STATE), 'no fictional consensus-peers block in the seed');
      t.assert(!('alerts' in SEED_STATE), 'no hardcoded-alerts block in the seed');
      t.assert(!('reputationScore' in SEED_STATE.identity), 'no fabricated reputation score in the seed');
      t.assert(!('activeNodes' in SEED_STATE.telemetry), 'no fake node counter in the seed');
      t.assert(!appSrc.includes('Math.floor(2840 + Math.random()'), 'the heartbeat no longer jitters node counts');
      t.assert(!appSrc.includes('Math.floor(18 + Math.random()'), 'the heartbeat no longer jitters latency');
      t.assert(appSrc.includes('aegis-latency-probe'), 'the heartbeat MEASURES the real storage round-trip');
      t.assert(appSrc.includes("'telemetry.blockHeight', 'telemetry.syncStatus'"), 'the boot migration purges legacy fictional keys from persisted blobs');
    });

    await t.it('the sentinel pill renders ARMED on healthy state and UNPROVEN with reasons otherwise', async () => {
      fixtureEls();
      const app = buildApp();
      app.store.set('identity.did', 'did:key:zTest', false);
      app.store.set('identity.publicKeyJwk', { kty: 'EC', x: 'x', y: 'y' }, false);
      app._renderSentinelPill();
      const badge = globalThis.document.getElementById('topbar-sentinel-badge');
      const label = badge.querySelector('.status-label');
      t.assertEqual(label.textContent, 'SENTINEL: ARMED', 'healthy posture (identity + vault + log) reads ARMED, just checked');
      app.store.set('identity.did', null, false);
      app._renderSentinelPill();
      t.assertEqual(label.textContent, 'SENTINEL: UNPROVEN', 'a failed check renders UNPROVEN');
      t.assert(badge.title.includes('no cryptographic identity'), 'the tooltip names the failed check');
    });

    await t.it('the AP ticker says NO CAMPAIGN before a game and mirrors the live budget after', async () => {
      fixtureEls();
      const app = buildApp();
      app.store.set('telemetry.activeAp', null, false); // no campaign has run
      app._subscribeTelemetryUI(); // boot-time initial render + subscription
      const apEl = globalThis.document.getElementById('telemetry-ap-val');
      t.assertEqual(apEl.textContent, 'AP: — (NO CAMPAIGN)', 'no campaign → the ticker says so instead of asserting 10/10');
      app.store.set('telemetry.activeAp', 7, false);
      await drain();
      t.assertEqual(apEl.textContent, '7 / 10 AP', 'a live campaign budget is mirrored, never defaulted');
    });

    await t.it('the heartbeat writes a MEASURED storage latency, not a random number', async () => {
      if (typeof globalThis.localStorage === 'undefined') {
        // Node exposes localStorage only with --localstorage-file; a minimal stub stands
        // in so the heartbeat can measure a real round-trip in this process.
        const mem = new Map();
        Object.defineProperty(globalThis, 'localStorage', {
          configurable: true,
          value: {
            setItem: (k, v) => mem.set(String(k), String(v)),
            getItem: (k) => (mem.has(String(k)) ? mem.get(String(k)) : null),
            removeItem: (k) => mem.delete(String(k)),
            key: (i) => [...mem.keys()][i] ?? null,
            get length() { return mem.size; }
          }
        });
      }
      fixtureEls();
      const app = buildApp();
      app._subscribeTelemetryUI(); // the subscriber repaints the ticker on each measured tick
      app.store.set('telemetry.networkLatencyMs', null, false);
      app.startTelemetryLoop();
      try {
        await new Promise((r) => setTimeout(r, 4300)); // one heartbeat tick
        const v = app.store.get('telemetry.networkLatencyMs', 'unset');
        t.assert(typeof v === 'number' && v >= 0, `latency is a measured number, got: ${JSON.stringify(v)}`);
        const latEl = globalThis.document.getElementById('telemetry-latency-val');
        t.assert(/(<1|\d+)ms \(LOCAL\)/.test(latEl.textContent), `the ticker shows the measured value with the honest LOCAL label (${latEl.textContent})`);
      } finally {
        app.stopTelemetryLoop();
      }
    });
  });

  await t.describe('Honest chrome III — nav-rail badges & offline recon truth (2026-09-26 audit)', async () => {
    const fsMod = await import('node:fs');
    const urlMod = await import('node:url');
    const readSrc = (p) => fsMod.readFileSync(urlMod.fileURLToPath(new URL(p, import.meta.url)), 'utf8');
    const ewSrc = readSrc('../js/modules/earlyWarning.js');
    const osintSrc = readSrc('../js/modules/osint.js');
    const repSrc = readSrc('../js/modules/reputation.js');
    const infowarSrc = readSrc('../js/modules/infowar.js');
    const cognitiveSrc = readSrc('../js/modules/cognitive.js');
    const profileSrc = readSrc('../js/modules/profile.js');
    const appSrc2 = readSrc('../js/app.js');
    const html = readSrc('../index.html');
    const ewData = JSON.parse(readSrc('../data/early_warning.json'));
    const sourcesData = JSON.parse(readSrc('../data/sources.json'));

    const fakeBadge = (id) => {
      const b = el(id);
      b.textContent = '';
      return b;
    };

    await t.it('no static stat copy remains in the nav rail — every badge is a derived placeholder', async () => {
      t.assert(!/>\s*4 COURSES\s*</.test(html), 'markup no longer hardcodes "4 COURSES"');
      t.assert(!/>\s*10 AP\s*</.test(html), 'markup no longer hardcodes "10 AP" (the in-game AP badge is real game state)');
      t.assert(!/>\s*50\+ SITES\s*</.test(html), 'markup no longer hardcodes "50+ SITES"');
      t.assert(!/>\s*5 ACTIVE\s*</.test(html), 'markup no longer hardcodes "5 ACTIVE"');
      t.assert(!/>\s*60\+ DOSSIERS\s*</.test(html), 'markup no longer hardcodes "60+ DOSSIERS"');
      t.assert(!/>\s*38 ITEMS\s*</.test(html), 'markup no longer hardcodes "38 ITEMS"');
      for (const id of ['nav-badge-cognitive', 'nav-badge-infowar', 'nav-badge-osint', 'nav-badge-early-warning', 'nav-badge-reputation', 'nav-badge-defense']) {
        t.assert(html.includes(`id="${id}"`), `badge ${id} exists in markup with a derived id`);
      }
      t.assert((html.match(/COURSES: …|AP: …|SITES: …|RADAR: …|DOSSIERS: …|ITEMS: …/g) || []).length >= 6, 'every dataset badge ships with a labeled "…" placeholder');
    });

    await t.it('each module derives its badge from the real loaded dataset, with fail-loud N/A', async () => {
      t.assert(ewSrc.includes("document.getElementById('nav-badge-early-warning')") && ewSrc.includes('early_warning.json unavailable'), 'early-warning badge derives from its dataset and fails loud');
      t.assert(infowarSrc.includes("document.getElementById('nav-badge-infowar')") && infowarSrc.includes('scenarios.json unavailable'), 'infowar badge derives from its ruleset and fails loud');
      t.assert(cognitiveSrc.includes("document.getElementById('nav-badge-cognitive')") && cognitiveSrc.includes('masterclass.json unavailable'), 'cognitive badge derives from its curriculum and fails loud');
      t.assert(osintSrc.includes("document.getElementById('nav-badge-osint')"), 'osint badge derives from its toolkit count');
      t.assert(repSrc.includes("document.getElementById('nav-badge-reputation')"), 'reputation badge derives from its dataset count');
      t.assert(profileSrc.includes('profile-items.json unavailable'), 'defense badge derives from the loaded inventory and fails loud');
      t.assert(appSrc2.includes('_deriveNavBadges'), 'app.js boot re-derives unresolved badges as a backstop');
    });

    await t.it('the early-warning radar renders REAL dataset geometry, never hardcoded blips', async () => {
      t.assert(!html.includes('Active Threat Blips -->\n                  <circle'), 'markup no longer hardcodes radar blips');
      t.assert(html.includes('<g id="radar-blips"></g>'), 'blips render into a data-driven container');
      t.assert(ewSrc.includes('radarAngle') && ewSrc.includes('radarDistance'), 'blips are plotted from the dataset polar fields');
      t.assert(!ewSrc.includes('Astroturfed Liquidity Panic'), 'the hardcoded incident-name fallback is gone from code');
      t.assert(!ewSrc.includes('DEFCON 2'), 'the fictional DEFCON fallback is gone from code');
      // The fictional fallback data block is gone — a failed fetch yields NO domains.
      t.assert(!/this\._alerts\s*=\s*\[\s*\{\s*id:\s*'EW-01'/.test(ewSrc), 'the fictional three-alert fallback array is deleted');
      t.assert(ewData.length === 6 && ewData.every((d) => Array.isArray(d.activeIncidents)), 'the dataset itself carries 6 domains with active incidents');
    });

    await t.it('the incident dossier renders dataset incidents — no hardcoded incident card', async () => {
      t.assert(!html.includes('Threat Incident: Astroturfed Liquidity Panic'), 'markup no longer hardcodes the incident card');
      t.assert(html.includes('id="ew-incident-title"') && html.includes('id="ew-playbook-checklist"'), 'the dossier is a data-driven container');
      t.assert(html.includes('id="btn-ew-countermeasure"'), 'the countermeasure button is wired via its id');
      t.assert(ewSrc.includes("getElementById('btn-ew-countermeasure')"), 'earlyWarning binds the countermeasure acknowledgment');
      t.assert(ewSrc.includes("getElementById('ew-incident-title')"), 'earlyWarning populates the dossier from data');
    });

    await t.it('the OSINT recon flow no longer fabricates results', async () => {
      t.assert(!osintSrc.includes("status: 'FOUND'"), 'no simulated FOUND statuses in the platform table');
      t.assert(!osintSrc.includes('RECON COMPLETE (5 FOUND)'), 'the fake "RECON COMPLETE (5 FOUND)" status is gone');
      t.assert(!osintSrc.includes('2 active infrastructure ties'), 'the fabricated infrastructure-ties toast is gone');
      t.assert(!osintSrc.includes('SCANNING 50+ NODES'), 'the theatrical scanning status is gone');
      t.assert(osintSrc.includes('NO LIVE SCAN PERFORMED'), 'the grid declares that no live scan is performed');
      t.assert(osintSrc.includes('NOT CHECKED'), 'platform rows carry the honest NOT-CHECKED state');
      t.assert(!html.includes('>FOUND</span>'), 'markup no longer ships the FOUND-result skeleton');
      t.assert(!/>VERIFIED PGP</.test(html), 'markup no longer ships the fake PGP-verified result');
      t.assert(osintSrc.includes("if (activeSubtab === 'search') this.renderPlatforms('target_user')"), 'onMount renders the honest plan at boot');
    });

    await t.it('the reputation directory never substitutes fictional source ratings', async () => {
      t.assert(!/catch \{\s*\n\s*this\._sources = \[\s*\n\s*\{ name: 'Reuters'/.test(repSrc), 'the hardcoded Reuters/AP/RT fallback list is deleted');
      t.assert(repSrc.includes('SOURCE DIRECTORY UNAVAILABLE'), 'a failed dataset load renders a labeled unavailable state');
      t.assert(!repSrc.includes("credibilityScore || 90"), 'no invented default credibility score');
      t.assert(sourcesData.length === 55, 'the real dataset ships 55 source dossiers (the badge derives this)');
    });

    await t.it('view-08 copy states the data source instead of claiming a live sweep', async () => {
      t.assert(!html.includes('360° POLAR SWEEP ACTIVE'), 'the theatrical sweep badge is gone');
      t.assert(!html.includes('Real-time threat monitoring'), 'the live-monitoring claim is gone');
      t.assert(html.includes('id="ew-dataset-badge"'), 'the dataset badge replaces it');
    });

    await t.it('no inflated count claims survive in view headers', async () => {
      t.assert(!html.includes('22+ FALLACIES'), 'the "22+ FALLACIES" claim is gone (the dataset has 24, derived at runtime)');
      t.assert(!html.includes('50+ PLATFORMS') && !html.includes('50+ Sites') && !html.includes('(50+ Sites)'), 'the "50+ platforms/sites" claims are gone');
      t.assert(!html.includes('60+ SOURCE DOSSIERS'), 'the "60+ SOURCE DOSSIERS" claim is gone (dataset ships 55)');
      t.assert(html.includes('id="cognitive-header-badge"'), 'the cognitive header badge is derived');
      t.assert(html.includes('id="reputation-header-badge"'), 'the reputation header badge is derived');
      t.assert(!osintSrc.includes('SCANNING 50+ NODES'), 'no scanning copy cites an invented node count');
    });

    await t.it('topbar storage and DID tickers ship honest placeholders, not fabricated values', async () => {
      t.assert(!html.includes('48.2 KB'), 'markup no longer ships a fabricated storage footprint');
      t.assert(html.includes('id="telemetry-storage-size"') && html.includes('MEASURING…'), 'the storage ticker starts at its measuring placeholder');
      t.assert(!html.includes('did:key:z6Mku'), 'markup no longer ships a fake-looking DID');
      t.assert(html.includes('DID: — (NONE YET)'), 'the DID ticker ships a labeled none-yet state');
      t.assert(appSrc2.includes('_renderStorageFootprint'), 'storage is measured by the shared extractor at boot and per tick');
    });

    await t.it('the honesty dashboard doc exists and stays in sync with the placeholders it documents', async () => {
      const doc = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../docs/HONESTY-DASHBOARD.md', import.meta.url)), 'utf8');
      for (const honest of ['DID: — (NONE YET)', 'NO LIVE SCAN PERFORMED', 'DATASET: N DOMAINS / M INCIDENTS', '_renderStorageFootprint', 'aegis-latency-probe']) {
        t.assert(doc.includes(honest), `the doc documents ${honest}`);
      }
      // Every string the doc lists as REMOVED must actually be gone from the app.
      for (const gone of ['48.2 KB', 'did:key:z6Mku', 'RECON COMPLETE (5 FOUND)', '360° POLAR SWEEP']) {
        t.assert(!html.includes(gone) && !ewSrc.includes(gone) && !osintSrc.includes(gone), `"${gone}" is gone from the app, as the doc claims`);
      }
    });

    /* --------------- In-app honesty panel (About) — Honest chrome IV -------------- */

    const honestyPanelSrc = readSrc('../js/honestyDashboard.js');

    await t.it('the About modal ships in markup with a labeled empty body and a declarative opener', async () => {
      t.assert(html.includes('id="modal-honesty-about"'), 'About modal exists in markup');
      t.assert(html.includes('id="honesty-about-body"'), 'About modal body container exists');
      t.assert(html.includes('id="btn-open-honesty-about"'), 'sidebar footer opener exists');
      t.assert(html.includes('data-aegis-modal="modal-honesty-about"'), 'opener uses the declarative open-modal delegation');
      // The body must ship EMPTY: boot-painted content belongs in the module, not
      // as copy in markup that can go stale.
      t.assert(!/>[^<]\S/.test(html.slice(html.indexOf('id="honesty-about-body"'), html.indexOf('id="honesty-about-body"') + 220)), 'the panel body ships empty (no stale copy in markup)');
    });

    await t.it('the panel content module exists, is boot-painted, and fails loud', async () => {
      t.assert(fsMod.existsSync(urlMod.fileURLToPath(new URL('../js/honestyDashboard.js', import.meta.url))), 'js/honestyDashboard.js exists');
      t.assert(appSrc2.includes("from './honestyDashboard.js'") && appSrc2.includes('_renderHonestyAbout'), 'app.js imports the builder and boot-paints it');
      t.assert(appSrc2.includes("document.getElementById('honesty-about-body')"), 'app.js paints the modal body at boot');
      t.assert(appSrc2.includes("host.textContent = 'HONESTY DASHBOARD: UNAVAILABLE"), 'render failure paints a labeled fallback, never blank');
      t.assert(!appSrc2.includes("fetch('docs/"), 'the panel is never fetched at runtime (standalone only shims data/)');
    });
    await t.it('the panel mirrors the doc: section titles, doc keys and honesty rules survive', async () => {
      const doc = fsMod.readFileSync(urlMod.fileURLToPath(new URL('../docs/HONESTY-DASHBOARD.md', import.meta.url)), 'utf8');
      const sections = ['Topbar & telemetry ribbon', 'Nav rail', 'View headers & cards', 'Module view bodies', 'Removed entirely', 'Verification hooks'];
      for (const s of sections) {
        t.assert(doc.includes(s), `doc carries the "${s}" section`);
        t.assert(honestyPanelSrc.includes(`'${s}'`), `panel module carries the "${s}" section`);
      }
      // Doc keys the panel must mirror exactly, or the two maps drift apart.
      for (const key of ['DID: — (NONE YET)', 'NO LIVE SCAN PERFORMED', 'DATASET: N DOMAINS / M INCIDENTS', '_renderStorageFootprint', 'aegis-latency-probe', 'MEASURING…']) {
        t.assert(doc.includes(key), `doc documents ${key}`);
        t.assert(honestyPanelSrc.includes(key), `panel mirrors ${key}`);
      }
      // The panel itself must obey the honesty standard it describes.
      t.assert(honestyPanelSrc.includes("import { esc } from './security.js'") && honestyPanelSrc.includes('esc(r.k)') && honestyPanelSrc.includes('esc(r.v)'), 'panel output is escaped like every other module');
      t.assert(honestyPanelSrc.includes('HONESTY RULES FOR THIS PANEL ITSELF'), 'the module states its own honesty rules');
      t.assert(!honestyPanelSrc.includes('48.2 KB') && !honestyPanelSrc.includes('did:key:z6Mku'), 'the panel never repeats removed-fiction literals');
      t.assert(!honestyPanelSrc.includes('Math.random'), 'no simulated values in a panel about not simulating');
    });
  });

  return harness.summary();
}

// Standalone execution support
runTests().then(result => {
  if (result.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Fatal error running dead-controls suite:', err);
  process.exit(1);
});
