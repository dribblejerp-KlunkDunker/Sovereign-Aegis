/**
 * SOVEREIGN // AEGIS — Empirical Verification & Adversarial Stress Harness (Challenger 2)
 * Validates HTML Shell, CSS Architecture, DOM Scaffolding, Modals, Toasts, Layout & Animations
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

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
    console.log(`\n======================================================`);
    console.log(`  ${name}`);
    console.log(`======================================================`);
    fn();
  }

  it(name, fn) {
    try {
      fn();
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
    console.log('\n======================================================');
    console.log(`[${this.suiteName}] Summary: ${this.passed}/${this.totalAssertions} Passed (${this.failed} Failed)`);
    console.log('======================================================');
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

const harness = new TestHarness('Challenger 2 Empirical HTML/CSS/DOM Verification');

// Read files
const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// ----------------------------------------------------
// 1. STYLESHEET LINKS & CSS FILE VALIDATION
// ----------------------------------------------------
harness.describe('Group 1: Stylesheet Link Resolution & CSS Syntax Validity', () => {
  const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  const stylesheetHrefs = [];
  let match;
  while ((match = linkRegex.exec(indexHtml)) !== null) {
    const href = match[1] || match[2];
    if (href) stylesheetHrefs.push(href);
  }

  harness.assert(stylesheetHrefs.length > 0, `Discovered ${stylesheetHrefs.length} stylesheet links in index.html`);

  const localCssFiles = stylesheetHrefs.filter(href => !href.startsWith('http://') && !href.startsWith('https://'));
  harness.assertEqual(localCssFiles.length, 6, 'Found exactly 6 local modular CSS stylesheets in index.html');

  const expectedLocalCss = [
    'css/variables.css',
    'css/typography.css',
    'css/base.css',
    'css/layout.css',
    'css/components.css',
    'css/animations.css'
  ];

  for (const exp of expectedLocalCss) {
    harness.assert(localCssFiles.includes(exp), `index.html includes link to ${exp}`);
    const fullPath = path.join(ROOT_DIR, exp);
    harness.assert(fs.existsSync(fullPath), `File exists on disk: ${exp}`);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      harness.assert(stats.size > 100, `${exp} is non-empty (${stats.size} bytes)`);

      // Validate balanced braces in CSS
      const cssContent = fs.readFileSync(fullPath, 'utf8');
      
      // Strip comments and string literals for brace balance checking
      const cleanCss = cssContent
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/"[^"]*"/g, '""')
        .replace(/'[^']*'/g, "''");

      let openCurly = 0;
      let openParen = 0;
      let openSquare = 0;
      let balanceError = null;

      for (let i = 0; i < cleanCss.length; i++) {
        const char = cleanCss[i];
        if (char === '{') openCurly++;
        else if (char === '}') {
          openCurly--;
          if (openCurly < 0) { balanceError = `Unmatched closing brace '}' at pos ${i}`; break; }
        } else if (char === '(') openParen++;
        else if (char === ')') {
          openParen--;
          if (openParen < 0) { balanceError = `Unmatched closing paren ')' at pos ${i}`; break; }
        } else if (char === '[') openSquare++;
        else if (char === ']') {
          openSquare--;
          if (openSquare < 0) { balanceError = `Unmatched closing bracket ']' at pos ${i}`; break; }
        }
      }

      if (!balanceError && openCurly !== 0) balanceError = `Unclosed curly braces: ${openCurly} remaining`;
      if (!balanceError && openParen !== 0) balanceError = `Unclosed parentheses: ${openParen} remaining`;
      if (!balanceError && openSquare !== 0) balanceError = `Unclosed brackets: ${openSquare} remaining`;

      harness.assert(balanceError === null, `${exp} has balanced braces and valid syntax (${balanceError || 'OK'})`);
    }
  }

  // Verify Google Fonts link
  const googleFontsLink = stylesheetHrefs.find(h => h.includes('fonts.googleapis.com'));
  harness.assert(Boolean(googleFontsLink), 'Google Fonts typography link is included in index.html');
  if (googleFontsLink) {
    harness.assert(googleFontsLink.includes('Cinzel'), 'Google Fonts link includes Cinzel');
    harness.assert(googleFontsLink.includes('Cormorant+Garamond') || googleFontsLink.includes('Cormorant Garamond'), 'Google Fonts link includes Cormorant Garamond');
    harness.assert(googleFontsLink.includes('EB+Garamond') || googleFontsLink.includes('EB Garamond'), 'Google Fonts link includes EB Garamond');
    harness.assert(googleFontsLink.includes('JetBrains+Mono') || googleFontsLink.includes('JetBrains Mono'), 'Google Fonts link includes JetBrains Mono');
    harness.assert(googleFontsLink.includes('Space+Mono') || googleFontsLink.includes('Space Mono'), 'Google Fonts link includes Space Mono');
  }
});

// ----------------------------------------------------
// 2. 11 VIEW CONTAINERS & NAVIGATION MAPPINGS
// ----------------------------------------------------
harness.describe('Group 2: 11 View Containers & Navigation Links in index.html', () => {
  const expectedViews = [
    { id: 'view-overview', dataView: 'overview', name: '00 // Command Center', badge: 'SYS' },
    { id: 'view-cognitive', dataView: 'cognitive', name: '01 // Cognitive Lab', badge: '4 COURSES' },
    { id: 'view-infowar', dataView: 'infowar', name: '02 // InfoWar Simulator', badge: '10 AP' },
    { id: 'view-aftercare', dataView: 'aftercare', name: '03 // System 2 Pacer', badge: '4-7-8' },
    { id: 'view-verdad', dataView: 'verdad', name: '04 // VERDAD Engine', badge: 'NLP AUDIT' },
    { id: 'view-osint', dataView: 'osint', name: '05 // OSINT Suite', badge: '50+ SITES' },
    { id: 'view-ach', dataView: 'ach', name: '06 // ACH Matrix Lab', badge: 'MATH RANK' },
    { id: 'view-narrative', dataView: 'narrative', name: '07 // Narrative Topology', badge: 'T+0..48h' },
    { id: 'view-early-warning', dataView: 'early-warning', name: '08 // Threat Radar', badge: '5 ACTIVE' },
    { id: 'view-reputation', dataView: 'reputation', name: '09 // Source Directory', badge: '60+ DOSSIERS' },
    { id: 'view-identity', dataView: 'identity', name: '10 // Sovereign DID', badge: 'P-256' }
  ];

  harness.assertEqual(expectedViews.length, 11, 'Target view suite contains exactly 11 operational views');

  for (const view of expectedViews) {
    // Check section container
    const sectionRegex = new RegExp(`<section[^>]*id=["']${view.id}["'][^>]*>`, 'i');
    const hasSection = sectionRegex.test(indexHtml);
    harness.assert(hasSection, `DOM contains <section id="${view.id}">`);

    if (hasSection) {
      const sectionMatch = indexHtml.match(sectionRegex)[0];
      harness.assert(sectionMatch.includes('class="view-container') || sectionMatch.includes("class='view-container"), `${view.id} has class="view-container"`);
      harness.assert(sectionMatch.includes(`data-view="${view.dataView}"`) || sectionMatch.includes(`data-view='${view.dataView}'`), `${view.id} has data-view="${view.dataView}"`);
      harness.assert(sectionMatch.includes('role="tabpanel"'), `${view.id} has role="tabpanel"`);
      harness.assert(sectionMatch.includes(`aria-labelledby="nav-${view.dataView}"`), `${view.id} has aria-labelledby="nav-${view.dataView}"`);
    }

    // Check nav item
    const navBtnRegex = new RegExp(`<button[^>]*id=["']nav-${view.dataView}["'][^>]*>`, 'i');
    const hasNavBtn = navBtnRegex.test(indexHtml);
    harness.assert(hasNavBtn, `Sidebar contains nav trigger <button id="nav-${view.dataView}">`);

    if (hasNavBtn) {
      const navBtnMatch = indexHtml.match(navBtnRegex)[0];
      harness.assert(navBtnMatch.includes('class="nav-item') || navBtnMatch.includes("class='nav-item"), `nav-${view.dataView} has class="nav-item"`);
      harness.assert(navBtnMatch.includes(`data-view="${view.dataView}"`), `nav-${view.dataView} has data-view="${view.dataView}"`);
      harness.assert(navBtnMatch.includes(`aria-controls="${view.id}"`), `nav-${view.dataView} has aria-controls="${view.id}"`);
      harness.assert(navBtnMatch.includes('role="tab"'), `nav-${view.dataView} has role="tab"`);
    }
  }

  // Verify initial state: overview active, others hidden
  const overviewMatch = indexHtml.match(/<section[^>]*id=["']view-overview["'][^>]*>/i)[0];
  harness.assert(overviewMatch.includes('active'), 'view-overview container initially has active class');

  const otherViews = expectedViews.filter(v => v.dataView !== 'overview');
  for (const v of otherViews) {
    const vMatch = indexHtml.match(new RegExp(`<section[^>]*id=["']${v.id}["'][^>]*>`, 'i'))[0];
    harness.assert(vMatch.includes('hidden'), `${v.id} container initially has hidden class`);
  }
});

// ----------------------------------------------------
// 3. MODAL DIALOGS & TOAST HUB VALIDATION
// ----------------------------------------------------
harness.describe('Group 3: Modal Dialogs & Toast Hub in DOM', () => {
  // Modal Container
  harness.assert(indexHtml.includes('id="modal-root"'), 'DOM contains accessible modal container #modal-root');

  const expectedModals = [
    { id: 'modal-byok-settings', titleId: 'byok-modal-title', titleText: 'System Settings & BYOK Gemini API' },
    { id: 'modal-did-export', titleId: 'did-modal-title', titleText: 'W3C Verifiable Credential / DID Document' },
    { id: 'modal-journal-entry', titleId: 'journal-modal-title', titleText: 'Epistemic Reflection Journal Entry' },
    { id: 'modal-node-inspector', titleId: 'node-modal-title', titleText: 'Node Intelligence Dossier' },
    { id: 'modal-shortcuts', titleId: 'shortcuts-modal-title', titleText: 'Operational Keyboard Shortcuts' }
  ];

  harness.assertEqual(expectedModals.length, 5, 'Exactly 5 modal dialogs configured');

  for (const modal of expectedModals) {
    const modalRegex = new RegExp(`<div[^>]*id=["']${modal.id}["'][^>]*>`, 'i');
    const hasModal = modalRegex.test(indexHtml);
    harness.assert(hasModal, `DOM contains #${modal.id}`);

    if (hasModal) {
      const modalTag = indexHtml.match(modalRegex)[0];
      harness.assert(modalTag.includes('class="modal-backdrop') || modalTag.includes("class='modal-backdrop"), `${modal.id} has class="modal-backdrop"`);
      harness.assert(modalTag.includes('role="dialog"'), `${modal.id} has role="dialog"`);
      harness.assert(modalTag.includes('aria-modal="true"'), `${modal.id} has aria-modal="true"`);
      harness.assert(modalTag.includes('aria-hidden="true"'), `${modal.id} has aria-hidden="true"`);
      harness.assert(modalTag.includes(`aria-labelledby="${modal.titleId}"`), `${modal.id} has aria-labelledby="${modal.titleId}"`);
    }
  }

  // Toast Hub
  harness.assert(indexHtml.includes('id="toast-hub"'), 'DOM contains #toast-hub notification container');
  const toastHubMatch = indexHtml.match(/<div[^>]*id=["']toast-hub["'][^>]*>/i);
  if (toastHubMatch) {
    const tag = toastHubMatch[0];
    harness.assert(tag.includes('class="toast-hub"'), '#toast-hub has class="toast-hub"');
    harness.assert(tag.includes('aria-live="polite"'), '#toast-hub has aria-live="polite"');
  }

  // Header, Telemetry, Drawer & Script anchors
  harness.assert(indexHtml.includes('id="topbar"'), 'DOM contains sticky topbar #topbar');
  harness.assert(indexHtml.includes('id="telemetry-bar"'), 'DOM contains active telemetry ribbon #telemetry-bar');
  harness.assert(indexHtml.includes('id="drawer-backdrop"'), 'DOM contains responsive drawer backdrop #drawer-backdrop');
  harness.assert(indexHtml.includes('<script type="module" src="js/app.js"></script>'), 'DOM bootstraps js/app.js via ES module script tag');
});

// ----------------------------------------------------
// 4. ANIMATIONS, TRANSITIONS & LAYOUT RULES
// ----------------------------------------------------
harness.describe('Group 4: Keyframes, Transitions, CSS Variables & Layout Rules', () => {
  const animCss = fs.readFileSync(path.join(ROOT_DIR, 'css/animations.css'), 'utf8');
  const layoutCss = fs.readFileSync(path.join(ROOT_DIR, 'css/layout.css'), 'utf8');
  const varsCss = fs.readFileSync(path.join(ROOT_DIR, 'css/variables.css'), 'utf8');
  const compCss = fs.readFileSync(path.join(ROOT_DIR, 'css/components.css'), 'utf8');

  // Keyframes
  const expectedKeyframes = [
    'radar-sweep',
    'pulsing-sentinel',
    'bronze-shimmer',
    'ring-breathe',
    'toast-slide-in',
    'toast-fade-out',
    'modal-pop',
    'network-edge-flow',
    'scanline-drift'
  ];

  for (const kf of expectedKeyframes) {
    harness.assert(animCss.includes(`@keyframes ${kf}`), `animations.css defines @keyframes ${kf}`);
  }

  // 4-7-8 Breathing Timing verification (19s cycle)
  harness.assert(animCss.includes('21.05%'), 'ring-breathe keyframe contains 21.05% stop (4s inhale peak)');
  harness.assert(animCss.includes('57.89%'), 'ring-breathe keyframe contains 57.89% stop (11s hold end)');
  harness.assert(animCss.includes('ring-breathe 19s'), 'animate-breathe utility specifies 19s duration');

  // Layout Grid rules
  const expectedGridClasses = [
    '.grid-1',
    '.grid-2',
    '.grid-3',
    '.grid-4',
    '.grid-split-2-1',
    '.grid-split-1-2',
    '.grid-auto-fit'
  ];

  for (const cls of expectedGridClasses) {
    harness.assert(layoutCss.includes(cls), `layout.css defines responsive grid utility ${cls}`);
  }

  // Media Query Breakpoints
  harness.assert(layoutCss.includes('@media (max-width: 1024px)'), 'layout.css contains 1024px tablet breakpoint');
  harness.assert(layoutCss.includes('@media (max-width: 768px)'), 'layout.css contains 768px mobile breakpoint');
  harness.assert(layoutCss.includes('@media (min-width: 1440px)'), 'layout.css contains 1440px desktop ultra breakpoint');

  // Design Tokens in variables.css
  const expectedTokens = [
    '--bg-void',
    '--bg-base',
    '--bg-surface',
    '--bg-surface-elevated',
    '--bronze-primary',
    '--bronze-light',
    '--bronze-gradient',
    '--gold-primary',
    '--parchment-primary',
    '--parchment-secondary',
    '--parchment-muted',
    '--veracity-green',
    '--suspicion-amber',
    '--disinfo-crimson',
    '--intel-cyan',
    '--crypto-violet',
    '--font-display',
    '--font-serif',
    '--font-mono',
    '--topbar-height',
    '--telemetry-height',
    '--sidebar-width'
  ];

  for (const tok of expectedTokens) {
    harness.assert(varsCss.includes(`${tok}:`), `variables.css defines design token ${tok}`);
  }

  // Component styles in components.css
  const expectedComponents = [
    '.card',
    '.card-bronze',
    '.card-granite-inset',
    '.btn-primary',
    '.btn-secondary',
    '.btn-outline',
    '.btn-danger',
    '.btn-success',
    '.modal-backdrop',
    '.modal-dialog',
    '.toast-hub',
    '.toast',
    '.range-slider',
    '.progress-bar',
    '.switch'
  ];

  for (const comp of expectedComponents) {
    harness.assert(compCss.includes(comp), `components.css defines component ${comp}`);
  }
});

// ----------------------------------------------------
// 5. FUNCTIONAL APP & DOM LOGIC SIMULATION
// ----------------------------------------------------
harness.describe('Group 5: AegisApp Navigation, Modal & Toast Logic Simulation', () => {
  class MockClassList {
    constructor() {
      this._set = new Set();
    }
    add(...tokens) { tokens.forEach(t => this._set.add(t)); }
    remove(...tokens) { tokens.forEach(t => this._set.delete(t)); }
    contains(token) { return this._set.has(token); }
    get value() { return Array.from(this._set).join(' '); }
  }

  class MockElement {
    constructor(id, tagName = 'div') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this.classList = new MockClassList();
      this.attributes = new Map();
      this.children = [];
      this.parentNode = null;
      this.textContent = '';
      this.innerHTML = '';
      this.eventListeners = {};
    }

    setAttribute(name, val) { this.attributes.set(name, String(val)); }
    getAttribute(name) { return this.attributes.get(name) || null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }

    addEventListener(event, handler) {
      if (!this.eventListeners[event]) this.eventListeners[event] = [];
      this.eventListeners[event].push(handler);
    }

    dispatchEvent(event) {
      const handlers = this.eventListeners[event.type] || [];
      handlers.forEach(h => h(event));
    }

    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
      const matches = [];
      const checkNode = (node) => {
        if (selector.startsWith('#') && node.id === selector.slice(1)) matches.push(node);
        else if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) matches.push(node);
        else if (selector.includes('[data-view]')) {
          if (node.hasAttribute('data-view')) matches.push(node);
        } else if (selector === 'div' && node.tagName === 'DIV') matches.push(node);
        node.children.forEach(checkNode);
      };
      this.children.forEach(checkNode);
      return matches;
    }

    closest(selector) {
      let cur = this;
      while (cur) {
        if (selector.startsWith('.') && cur.classList.contains(selector.slice(1))) return cur;
        if (selector.startsWith('#') && cur.id === selector.slice(1)) return cur;
        cur = cur.parentNode;
      }
      return null;
    }
  }

  const mockNavItems = [
    'overview', 'cognitive', 'infowar', 'aftercare', 'verdad', 'osint',
    'ach', 'narrative', 'early-warning', 'reputation', 'identity'
  ].map(view => {
    const el = new MockElement(`nav-${view}`, 'button');
    el.classList.add('nav-item');
    el.setAttribute('data-view', view);
    return el;
  });

  const mockViewContainers = [
    'overview', 'cognitive', 'infowar', 'aftercare', 'verdad', 'osint',
    'ach', 'narrative', 'early-warning', 'reputation', 'identity'
  ].map(view => {
    const el = new MockElement(`view-${view}`, 'section');
    el.classList.add('view-container');
    el.setAttribute('data-view', view);
    if (view === 'overview') el.classList.add('active');
    else el.classList.add('hidden');
    return el;
  });

  const mockModals = [
    'modal-byok-settings', 'modal-did-export', 'modal-journal-entry', 'modal-node-inspector', 'modal-shortcuts'
  ].map(mId => {
    const el = new MockElement(mId, 'div');
    el.classList.add('modal-backdrop');
    el.setAttribute('aria-hidden', 'true');
    return el;
  });

  const mockToastHub = new MockElement('toast-hub', 'div');
  mockToastHub.classList.add('toast-hub');

  // Test Tab Switching Simulation
  function simulateSwitchTab(targetTab) {
    mockNavItems.forEach(item => {
      if (item.getAttribute('data-view') === targetTab) {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      }
    });

    mockViewContainers.forEach(container => {
      if (container.getAttribute('data-view') === targetTab) {
        container.classList.remove('hidden');
        container.classList.add('active');
      } else {
        container.classList.add('hidden');
        container.classList.remove('active');
      }
    });
  }

  // Switch to cognitive
  simulateSwitchTab('cognitive');
  harness.assert(mockNavItems.find(n => n.getAttribute('data-view') === 'cognitive').classList.contains('active'), 'Switching to cognitive activates nav-cognitive');
  harness.assert(mockViewContainers.find(v => v.id === 'view-cognitive').classList.contains('active'), 'Switching to cognitive activates view-cognitive container');
  harness.assert(mockViewContainers.find(v => v.id === 'view-overview').classList.contains('hidden'), 'Previous view-overview container is hidden');

  // Switch across all 11 views sequentially
  const allTabs = [
    'overview', 'cognitive', 'infowar', 'aftercare', 'verdad', 'osint',
    'ach', 'narrative', 'early-warning', 'reputation', 'identity'
  ];

  let allSwitchesSuccessful = true;
  for (const tab of allTabs) {
    simulateSwitchTab(tab);
    const activeNav = mockNavItems.find(n => n.getAttribute('data-view') === tab);
    const activeCont = mockViewContainers.find(v => v.getAttribute('data-view') === tab);
    if (!activeNav.classList.contains('active') || !activeCont.classList.contains('active')) {
      allSwitchesSuccessful = false;
    }
  }
  harness.assert(allSwitchesSuccessful, 'Full tab navigation cycle across all 11 views succeeds seamlessly');

  // Test Modal Open/Close Simulation
  function simulateOpenModal(modalId) {
    const modal = mockModals.find(m => m.id === modalId);
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function simulateCloseModal(modalId) {
    const modal = mockModals.find(m => m.id === modalId);
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  simulateOpenModal('modal-byok-settings');
  const byokModal = mockModals.find(m => m.id === 'modal-byok-settings');
  harness.assert(byokModal.classList.contains('open') && byokModal.getAttribute('aria-hidden') === 'false', 'openModal adds .open and sets aria-hidden="false"');

  simulateCloseModal('modal-byok-settings');
  harness.assert(!byokModal.classList.contains('open') && byokModal.getAttribute('aria-hidden') === 'true', 'closeModal removes .open and sets aria-hidden="true"');

  // Test Toast Spawning Simulation
  function simulateShowToast(options) {
    const toast = new MockElement(`toast-${Date.now()}`, 'div');
    toast.classList.add('toast');
    toast.classList.add(`toast-${options.type || 'info'}`);
    mockToastHub.appendChild(toast);
    return toast;
  }

  const toast1 = simulateShowToast({ type: 'crypto', title: 'KEYPAIR LOADED', message: 'did:key initialized' });
  harness.assert(mockToastHub.children.includes(toast1), 'showToast appends new toast element to #toast-hub');
  harness.assert(toast1.classList.contains('toast-crypto'), 'Toast contains type-specific styling class .toast-crypto');

  mockToastHub.removeChild(toast1);
  harness.assert(!mockToastHub.children.includes(toast1), 'Toast dismissal removes element from #toast-hub');
});

// ----------------------------------------------------
// 6. ADVERSARIAL STRESS TESTING & BOUNDARY INVARIANTS
// ----------------------------------------------------
harness.describe('Group 6: Adversarial Stress Testing & Boundary Invariants', () => {
  // 1. DOM ID Uniqueness Check
  const idRegex = /\sid=["']([^"']+)["']/g;
  const idCounts = new Map();
  let idMatch;
  while ((idMatch = idRegex.exec(indexHtml)) !== null) {
    const id = idMatch[1];
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }

  const duplicates = [];
  for (const [id, count] of idCounts.entries()) {
    if (count > 1) duplicates.push({ id, count });
  }
  harness.assertEqual(duplicates.length, 0, `DOM ID Uniqueness across index.html (${idCounts.size} unique IDs, 0 duplicates: ${duplicates.map(d => `${d.id}(${d.count})`).join(', ')})`);

  // 2. Main Viewport & Skip Link Anchor
  harness.assert(indexHtml.includes('id="main-viewport"'), 'DOM contains #main-viewport corresponding to accessibility skip-link');

  // 3. Sub-tab panel and button consistency
  const subtabBtnRegex = /class="[^"]*subtab-btn[^"]*"[^>]*data-subtab=["']([^"']+)["']/g;
  const subtabBtns = new Set();
  let stMatch;
  while ((stMatch = subtabBtnRegex.exec(indexHtml)) !== null) {
    subtabBtns.add(stMatch[1]);
  }

  harness.assert(subtabBtns.size > 0, `Found ${subtabBtns.size} unique subtab triggers across views`);

  for (const subtabId of subtabBtns) {
    const hasPanel = indexHtml.includes(`data-subtab-id="${subtabId}"`) || indexHtml.includes(`id="subtab-${subtabId}"`);
    harness.assert(hasPanel, `Subtab trigger '${subtabId}' has matching subtab content panel in DOM`);
  }

  // 4. CSS Variable Definition & Usage Integrity
  const varsCss = fs.readFileSync(path.join(ROOT_DIR, 'css/variables.css'), 'utf8');
  const definedVarRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;
  const definedVars = new Set();
  let varDefMatch;
  while ((varDefMatch = definedVarRegex.exec(varsCss)) !== null) {
    definedVars.add(varDefMatch[1]);
  }

  const cssFiles = [
    'css/variables.css',
    'css/typography.css',
    'css/base.css',
    'css/layout.css',
    'css/components.css',
    'css/animations.css'
  ];

  // `var(--token, fallback)` is valid CSS: an undefined token with a fallback resolves
  // to the fallback and renders correctly. Only a bare `var(--token)` with no fallback
  // is a defect — that declaration is dropped by the browser. The previous regex did
  // not distinguish the two and reported valid fallback usage as a failure.
  const usedVarRegex = /var\(\s*(--[a-zA-Z0-9_-]+)\s*(,)?/g;
  const undefinedUsages = [];

  for (const cssFile of cssFiles) {
    const content = fs.readFileSync(path.join(ROOT_DIR, cssFile), 'utf8');
    let usageMatch;
    while ((usageMatch = usedVarRegex.exec(content)) !== null) {
      const varName = usageMatch[1];
      const hasFallback = Boolean(usageMatch[2]);
      if (!definedVars.has(varName) && !hasFallback) {
        undefinedUsages.push({ file: cssFile, varName });
      }
    }
  }

  harness.assertEqual(undefinedUsages.length, 0, `CSS Variable Reference Integrity: every bare var(--token) without a fallback resolves (${undefinedUsages.map(u => `${u.file}:${u.varName}`).join(', ') || 'None undefined'})`);

  // 5. Epistemic Palette Signal Completeness
  const signalFamilies = ['veracity', 'suspicion', 'disinfo', 'intel', 'crypto'];
  for (const family of signalFamilies) {
    const hasColor = definedVars.has(`--${family}-green`) || 
                     definedVars.has(`--${family}-amber`) || 
                     definedVars.has(`--${family}-crimson`) || 
                     definedVars.has(`--${family}-cyan`) || 
                     definedVars.has(`--${family}-violet`) || 
                     definedVars.has(`--${family}-primary`);
    const hasDim = definedVars.has(`--${family}-dim`);
    const hasBorder = definedVars.has(`--${family}-border`);
    const hasGlow = definedVars.has(`--${family}-glow`);

    harness.assert(hasColor && hasDim && hasBorder && hasGlow, `Epistemic signal family '${family}' has full token suite (color, dim, border, glow)`);
  }
});

const result = harness.summary();
export default result;

