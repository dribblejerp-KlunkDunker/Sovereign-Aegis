/**
 * SOVEREIGN // AEGIS — InfoWar Tactical Network Simulator (Next-Gen Edition)
 * Turn-based network defense serious game with AP economy, Web Audio synthesizer,
 * contagion wavefront particle physics, adversary threat radar, strategic doctrines,
 * breaking crisis dilemmas, and interactive turn-by-turn post-mortem AAR.
 */

import { TacticalAudio } from './tacticalAudio.js';
import { recordAttempt, CONTEXTS } from '../attempts.js';
import { esc } from '../security.js';

export function getContainmentGrade(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

export const DISARM_DIAGNOSTICS = {
  T0002: {
    id: 'T0002',
    name: 'Establish Strategic Influence Objectives',
    phase: 'Plan',
    description: 'Adversary established strategic influence objectives and targeted institutional trust early.',
    remedy: 'Deploy threat radar monitoring and prebunk core narrative themes before infection waves begin.',
    blueStage: 'TA02',
    tacticMatch: ['campaign-alpha-apt', 'campaign-gamma-viral']
  },
  T0004: {
    id: 'T0004',
    name: 'Map Information Ecology & Channel Redundancy',
    phase: 'Plan',
    description: 'Adversary mapped cross-channel redundancy between fringe and mainstream media to evade containment.',
    remedy: 'Map multi-tier distribution channels and deploy early boundary monitoring across bridge nodes.',
    blueStage: 'TA01',
    tacticMatch: ['campaign-alpha-apt', 'campaign-beta-syndicate']
  },
  T0008: {
    id: 'T0008',
    name: 'Micro-Target Vulnerable Clusters',
    phase: 'Prepare',
    description: 'Adversary targeted susceptible demographic clusters to establish resilient regional footholds.',
    remedy: 'Inoculate susceptible peripheral nodes before high-reach hubs are contaminated.',
    blueStage: 'TA05',
    tacticMatch: ['campaign-beta-syndicate', 'campaign-gamma-viral']
  },
  T0009: {
    id: 'T0009',
    name: 'Amplify & Swarm Network Channels',
    phase: 'Execute',
    description: 'Automated botnet swarms flooded high-reach bridge nodes to overwhelm human verification capacity.',
    remedy: 'Deploy algorithmic friction and circuit breakers to dampen cross-network propagation velocity.',
    blueStage: 'TA15',
    tacticMatch: ['campaign-alpha-apt', 'campaign-gamma-viral']
  },
  T0015: {
    id: 'T0015',
    name: 'Fabricate Synthetic Audio & Media',
    phase: 'Build',
    description: 'Synthetic audio and deepfake media bypassed baseline filters and triggered rapid public panic.',
    remedy: 'Mandate C2PA cryptographic provenance and cryptographic hash verification.',
    blueStage: 'TA15',
    tacticMatch: ['campaign-alpha-apt', 'campaign-gamma-viral']
  },
  T0026: {
    id: 'T0026',
    name: 'Tainted Leaks & Selective Decontextualization',
    phase: 'Acquire',
    description: 'Compromised records were selectively poisoned with falsified metadata to undermine institutional credibility.',
    remedy: 'Quarantine compromised nodes immediately and issue cryptographic attestations.',
    blueStage: 'TA08',
    tacticMatch: ['campaign-alpha-apt', 'campaign-beta-syndicate']
  }
};

export const InfoWar = {
  _app: null,
  _campaigns: [],
  _engine: null,
  _selectedNode: null,
  _historicalStates: [],
  _activeDilemma: null,
  _disarmBlue: null,   // parsed data/disarm_blue.json (DISARM Blue countermeasures, by stage)

  async init(app) {
    this._app = app;
    await this._loadData();
    console.log('[InfoWar] Next-Gen Tactical Simulator Initialized.');
  },

  onMount() {
    if (this._campaigns && this._campaigns.length > 0) {
      this._startCampaign(this._campaigns[0]);
    } else {
      this._renderCampaignSelect();
    }
  },

  onUnmount() {
    this._engine = null;
    this._activeDilemma = null;
  },

  async _loadData() {
    try {
      const data = await fetch('./data/scenarios.json').catch(() => fetch('data/scenarios.json')).then(r => r.json()).catch(() => ({}));
      this._campaigns = data.infowarCampaigns || [];

      // DISARM Blue countermeasure framework — genuine C-codes, keyed by tactic stage, so the AAR
      // can grade against the real framework rather than a hand-written match.
      const blue = await fetch('./data/disarm_blue.json')
        .catch(() => fetch('data/disarm_blue.json'))
        .then(r => r.json())
        .catch(() => null);
      this._disarmBlue = blue && Array.isArray(blue.stages) ? blue : null;
      if (document.getElementById('view-infowar') && !document.getElementById('view-infowar').classList.contains('hidden')) {
        this.onMount();
      }
    } catch (err) {
      console.error('[InfoWar] Data load error:', err);
    }
  },

  // ─────────────────────────────────────────────
  // CAMPAIGN SELECT VIEW
  // ─────────────────────────────────────────────
  _renderCampaignSelect() {
    const view = document.getElementById('view-infowar');
    if (!view) return;

    const mainGrid = view.querySelector('.grid-split-2-1');
    if (!mainGrid) return;

    mainGrid.innerHTML = `
      <div class="card card-bronze" style="grid-column:1/-1;">
        <div class="card-header">
          <div>
            <h3 class="card-title">Select Operational Campaign</h3>
            <div class="status-label text-muted" style="font-size: 0.75rem; margin-top: 2px;">DISARM-MAPPED NETWORK DEFENSE SIMULATION</div>
          </div>
          <button class="btn btn-sm btn-outline" id="btn-infowar-audio-toggle">
            ${esc(TacticalAudio.isMuted() ? '🔇 Audio: OFF' : '🔊 Audio: ON')}
          </button>
        </div>
        <p class="body-text" style="margin-bottom:var(--space-4);">
          Choose an adversary campaign. Each operation features distinct topologies (Hub-and-Spoke, Decentralized Mesh, Hierarchical), telegraphed adversary doctrines, and breaking crisis dilemmas.
        </p>
        <div class="grid-3" id="campaign-select-grid">
          ${this._campaigns.map((c, i) => `
            <div class="card card-granite-inset card-clickable campaign-card" data-campaign-idx="${i}" style="cursor:pointer;border-left:3px solid ${c.difficulty === 'Hard' ? 'var(--disinfo-crimson)' : c.difficulty === 'Medium' ? 'var(--bronze-primary)' : 'var(--veracity-green)'}; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div class="flex-row-gap" style="justify-content:space-between;margin-bottom:var(--space-2);">
                  <span class="badge ${c.difficulty === 'Hard' ? 'badge-disinfo' : c.difficulty === 'Medium' ? 'badge-suspicion' : 'badge-veracity'}">${c.difficulty}</span>
                  <span class="badge badge-ap">${c.apPerTurn} AP/TURN</span>
                </div>
                <h4 style="font-weight:700;color:var(--parchment-bright);margin-bottom:var(--space-2);font-size:0.95rem;line-height:1.4;">${c.name}</h4>
                <div class="body-muted" style="font-size:0.8rem;margin-bottom:var(--space-2);">${c.adversaryType}</div>
                <div class="status-label text-bronze" style="font-size:0.7rem;margin-bottom:var(--space-3);">DOCTRINE: ${c.adversaryDoctrine || 'Viral Infiltration'}</div>
              </div>
              <div>
                <div class="flex-row-gap" style="font-size:0.78rem;color:var(--parchment-secondary); margin-bottom: 12px;">
                  <span>🌐 ${c.nodes?.length || 7} nodes (${c.topology || 'mesh'})</span>
                  <span>⚡ ${c.maxTurns} turns</span>
                </div>
                <button class="btn btn-sm btn-primary" style="width:100%;" data-campaign-idx="${i}">Deploy Countermeasures →</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-infowar-audio-toggle')?.addEventListener('click', () => {
      const muted = TacticalAudio.toggleMute();
      const btn = document.getElementById('btn-infowar-audio-toggle');
      if (btn) btn.textContent = muted ? '🔇 Audio: OFF' : '🔊 Audio: ON';
      if (!muted) TacticalAudio.playSelect();
    });

    view.querySelectorAll('[data-campaign-idx]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-campaign-idx'));
        TacticalAudio.playSelect();
        this._startCampaign(this._campaigns[idx]);
      });
    });
  },

  // ─────────────────────────────────────────────
  // GAME ENGINE INITIALIZER
  // ─────────────────────────────────────────────
  _createEngine(campaign) {
    const nodes = campaign.nodes.map(n => ({
      ...n,
      quarantined: false,
      immunized: false,
      provenanceActive: false
    }));
    const edges = this._generateEdges(nodes, campaign.topology);

    return {
      campaign,
      turn: 1,
      maxTurns: campaign.maxTurns,
      ap: campaign.apPerTurn,
      maxAp: campaign.apPerTurn,
      nodes,
      edges,
      health: campaign.initialHealth,
      panic: campaign.initialPanic,
      history: [],
      gameOver: false,
      won: false,
      circuitBreakerActive: false,
      selectedNodeId: null,

      getNode(id) { return this.nodes.find(n => n.id === id); },

      getAverageInfection() {
        return this.nodes.reduce((s, n) => s + n.infection, 0) / this.nodes.length;
      },

      canAfford(cost) { return this.ap >= cost; },

      spend(cost) { this.ap = Math.max(0, this.ap - cost); },

      // Standard Tactical Actions
      quarantine(nodeId) {
        if (this.gameOver) return { ok: false, msg: 'Game is already completed.' };
        const n = this.getNode(nodeId);
        if (!n || this.ap < 5 || n.quarantined) return { ok: false, msg: n?.quarantined ? 'Node already quarantined.' : 'Not enough AP (5 required).' };
        this.spend(5);
        n.quarantined = true;
        n.infection = Math.max(0, n.infection - 0.4);
        n.resistance = Math.min(1, n.resistance + 0.3);
        TacticalAudio.playZizzle();
        this.log(`🚧 QUARANTINE: ${n.name} severed from network. Infection reduced to ${Math.round(n.infection * 100)}%.`, 'amber');
        return { ok: true };
      },

      immunize(nodeId) {
        if (this.gameOver) return { ok: false, msg: 'Game is already completed.' };
        const n = this.getNode(nodeId);
        if (!n || this.ap < 3 || n.immunized) return { ok: false, msg: n?.immunized ? 'Node already immunized.' : 'Not enough AP (3 required).' };
        this.spend(3);
        n.immunized = true;
        n.resistance = Math.min(1, n.resistance + 0.45);
        n.trust = Math.min(1, n.trust + 0.15);
        TacticalAudio.playShield();
        this.log(`🛡️ INOCULATION: ${n.name} immunized. Resistance elevated to ${Math.round(n.resistance * 100)}%.`, 'emerald');
        return { ok: true };
      },

      counterMessage(nodeId) {
        if (this.gameOver) return { ok: false, msg: 'Game is already completed.' };
        const n = this.getNode(nodeId);
        if (!n || this.ap < 2) return { ok: false, msg: 'Not enough AP (2 required).' };
        this.spend(2);
        const reduction = 0.15 + (n.trust * 0.1);
        n.infection = Math.max(0, n.infection - reduction);
        n.trust = Math.min(1, n.trust + 0.1);
        TacticalAudio.playSelect();
        this.log(`📡 COUNTER-MSG: ${n.name} verified context broadcast. Infection down -${Math.round(reduction * 100)}%.`, 'cyan');
        return { ok: true };
      },

      exposeBotnet(nodeId) {
        if (this.gameOver) return { ok: false, msg: 'Game is already completed.' };
        const n = this.getNode(nodeId);
        if (!n || this.ap < 4) return { ok: false, msg: 'Not enough AP (4 required).' };
        this.spend(4);
        n.infection = Math.max(0, n.infection - 0.35);
        n.resistance = Math.min(1, n.resistance + 0.2);
        TacticalAudio.playZizzle();
        this.log(`⚡ EXPOSED: Botnet amplification cluster on ${n.name} taken down. Infection: ${Math.round(n.infection * 100)}%.`, 'bronze');
        return { ok: true };
      },

      // Epistemic Strategic Doctrines / Superweapons
      deployC2PAProvenance() {
        if (this.gameOver) return { ok: false, msg: 'Game is already completed.' };
        if (this.ap < 6) return { ok: false, msg: 'Not enough AP (6 required for C2PA Broadcast).' };
        this.spend(6);
        this.nodes.filter(n => n.type === 'Press' || n.type === 'Municipal' || n.type === 'Institutional').forEach(n => {
          n.resistance = Math.min(1, n.resistance + 0.4);
          n.trust = Math.min(1, n.trust + 0.25);
          n.provenanceActive = true;
        });
        TacticalAudio.playShield();
        this.log(`🔏 DOCTRINE: C2PA Cryptographic Signature Broadcast deployed. All Press & Municipal nodes hardened (+40% Res).`, 'emerald');
        return { ok: true };
      },

      deployCircuitBreaker() {
        if (this.gameOver) return { ok: false, msg: 'Game is already completed.' };
        if (this.ap < 4) return { ok: false, msg: 'Not enough AP (4 required for Circuit-Breaker).' };
        this.spend(4);
        this.circuitBreakerActive = true;
        TacticalAudio.playZizzle();
        this.log(`⚡ DOCTRINE: Algorithmic Circuit-Breaker engaged. Transmission velocity halved for Next Turn.`, 'cyan');
        return { ok: true };
      },

      deployOsintTakedown() {
        if (this.gameOver) return { ok: false, msg: 'Game is already completed.' };
        if (this.ap < 5) return { ok: false, msg: 'Not enough AP (5 required for OSINT Takedown).' };
        this.spend(5);
        this.nodes.filter(n => n.type === 'Darknet' || n.type === 'Social').forEach(n => {
          n.infection = Math.max(0, n.infection - 0.5);
          n.resistance = Math.min(1, n.resistance + 0.3);
        });
        TacticalAudio.playZizzle();
        this.log(`🔍 DOCTRINE: OSINT Multi-Platform Takedown executed. Darknet & Social vectors suppressed.`, 'bronze');
        return { ok: true };
      },

      endTurn() {
        if (this.gameOver) return;

        const transmissionMultiplier = this.circuitBreakerActive ? 0.2 : 0.4;
        this.circuitBreakerActive = false;

        // Contagion physics simulation
        const infectedNodes = this.nodes.filter(n => n.infection > 0.1 && !n.quarantined);
        infectedNodes.forEach(src => {
          const neighbors = this.edges
            .filter(e => e.source === src.id || e.target === src.id)
            .map(e => e.source === src.id ? e.target : e.source);
          neighbors.forEach(targetId => {
            const tgt = this.getNode(targetId);
            if (!tgt || tgt.quarantined || tgt.immunized) return;
            const spreadProb = src.infection * tgt.reach * (1 - tgt.resistance) * transmissionMultiplier;
            tgt.infection = Math.min(1, tgt.infection + spreadProb);
          });
        });

        // Metric recalculations
        const avgInfection = this.getAverageInfection();
        this.panic = Math.min(100, this.panic + avgInfection * 8);
        this.health = Math.max(0, this.health - avgInfection * 5);

        // Turn scheduled events
        const event = this.campaign.turnEvents?.find(e => e.turn === this.turn);
        if (event) {
          const tgt = this.getNode(event.affectedNode);
          if (tgt && !tgt.quarantined) {
            tgt.infection = Math.min(1, tgt.infection + event.infectionDelta);
          }
          this.log(`⚠ ADVERSARY EVENT [T${this.turn}]: ${event.title} — ${event.description}`, 'amber');
        }

        // Sound triggers
        if (this.panic >= 70) {
          TacticalAudio.playAlarm();
        } else {
          TacticalAudio.playPulse();
        }

        this.log(`Turn ${this.turn} concluded. Network Health: ${Math.round(this.health)}% | Public Panic: ${Math.round(this.panic)}%`, '');

        this.turn++;
        this.ap = this.maxAp;

        // Check end game states
        if (this.health < 20 || this.panic >= 85) {
          this.gameOver = true;
          this.won = false;
        } else if (this.turn > this.maxTurns) {
          const wc = this.campaign.winConditions;
          this.gameOver = true;
          this.won = this.health >= (wc?.minHealth || 60) && this.panic <= (wc?.maxPanic || 40);
        }
      },

      log(msg, color) {
        this.history.unshift({ msg, color, turn: this.turn, ts: new Date().toISOString() });
        if (this.history.length > 50) this.history.pop();
      }
    };
  },

  _generateEdges(nodes, topology = 'mesh') {
    const edges = [];
    const count = nodes.length;
    if (count === 0) return edges;

    const safePush = (srcIdx, tgtIdx) => {
      if (nodes[srcIdx] && nodes[tgtIdx]) {
        edges.push({ source: nodes[srcIdx].id, target: nodes[tgtIdx].id });
      }
    };

    if (topology === 'hub-spoke') {
      // Node 2 (Platform X) is central hub connected to all other nodes
      const hubId = nodes[2]?.id || nodes[0]?.id;
      for (let i = 0; i < count; i++) {
        if (nodes[i] && nodes[i].id !== hubId) {
          edges.push({ source: hubId, target: nodes[i].id });
        }
      }
      // Add cross perimeter links
      safePush(0, 1);
      safePush(3, 6);
    } else if (topology === 'hierarchy') {
      // Tree topology
      safePush(0, 4); // Institutional -> Academic
      safePush(0, 5); // Institutional -> Municipal
      safePush(4, 1); // Academic -> Social
      safePush(5, 6); // Municipal -> Influencer
      safePush(1, 2); // Social -> Video Net
      safePush(2, 3); // Video Net -> Darknet
    } else {
      // Mesh default
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          if (Math.random() < 0.45) {
            safePush(i, j);
          }
        }
      }
      for (let i = 1; i < count; i++) {
        const hasEdge = edges.some(e => e.source === nodes[i].id || e.target === nodes[i].id);
        if (!hasEdge) safePush(0, i);
      }
    }
    return edges;
  },

  // ─────────────────────────────────────────────
  // GAMEPLAY UI & RENDERING
  // ─────────────────────────────────────────────
  _startCampaign(campaign) {
    this._engine = this._createEngine(campaign);
    this._selectedNode = null;
    this._historicalStates = [];
    this._activeDilemma = null;
    this._saveHistoricalSnapshot();

    this._engine.log(`⚡ OPERATION ACTIVATED: ${campaign.name}`, 'bronze');
    this._engine.log(`Targeting Adversary: ${campaign.adversaryType} | Doctrine: ${campaign.adversaryDoctrine || 'Active Measures'}`, '');
    this._renderGameView();
  },

  _saveHistoricalSnapshot() {
    if (!this._engine) return;
    this._historicalStates.push({
      turn: this._engine.turn,
      health: this._engine.health,
      panic: this._engine.panic,
      avgInfection: this._engine.getAverageInfection(),
      nodes: this._engine.nodes.map(n => ({ ...n })),
      edges: this._engine.edges.map(e => ({ ...e }))
    });
  },

  _renderGameView() {
    const view = document.getElementById('view-infowar');
    const mainGrid = view?.querySelector('.grid-split-2-1');
    if (!mainGrid) return;

    const eng = this._engine;

    // Get telegraphed adversary next target
    const nextEvent = eng.campaign.turnEvents?.find(e => e.turn === eng.turn + 1);
    const targetNode = nextEvent ? eng.getNode(nextEvent.affectedNode) : null;
    const adversaryRadarText = targetNode
      ? `PROJECTED STRIKE: Adversary bot cluster targeting [${targetNode.name}] on Turn ${eng.turn + 1}`
      : `RADAR CLEAR: No high-confidence zero-day attacks detected for Turn ${eng.turn + 1}`;

    mainGrid.innerHTML = `
      <!-- Left: SVG Arena & Threat Radar -->
      <div class="card card-bronze" style="display:flex; flex-direction:column; gap:12px;">
        <div class="card-header" style="padding-bottom:0;">
          <div>
            <h3 class="card-title" style="font-size:0.95rem;">${esc(eng.campaign.name)}</h3>
            <div class="status-label text-muted" style="font-size:0.75rem;">TOPOLOGY: ${esc((eng.campaign.topology || 'mesh').toUpperCase())}</div>
          </div>
          <div class="flex-row-gap">
            <button class="btn btn-sm btn-outline" id="btn-infowar-audio-toggle">
              ${esc(TacticalAudio.isMuted() ? '🔇 OFF' : '🔊 ON')}
            </button>
            <span class="badge badge-disinfo" id="infowar-infection-rate">INFECTION: ${Math.round(eng.getAverageInfection() * 100)}%</span>
          </div>
        </div>

        <!-- Adversary Threat Intent Radar Ticker -->
        <div class="radar-ticker">
          <div class="radar-pulse-dot"></div>
          <span style="font-weight:700;">THREAT INTEL:</span>
          <span id="infowar-radar-text" style="color:var(--parchment-light);">${esc(adversaryRadarText)}</span>
        </div>

        <!-- SVG Interactive Arena -->
        <div class="card-granite-inset" style="height:390px;position:relative;overflow:hidden;background:radial-gradient(circle at center,rgba(16,21,32,0.9),var(--bg-void)); border: 1px solid var(--border-subtle);">
          <svg width="100%" height="100%" viewBox="0 0 600 380" id="infowar-svg-arena" style="cursor:grab;"></svg>
        </div>

        <div class="card-footer" style="flex-direction:column;align-items:stretch;gap:var(--space-2); padding-top:4px;">
          <div id="node-inspector" class="font-mono card-granite-inset" style="font-size:0.75rem;padding:8px 12px;color:var(--parchment-secondary);">
            Click a network node in the visualizer to inspect telemetry and deploy actions.
          </div>
          <div class="flex-row-gap">
            <button class="btn btn-secondary" id="btn-abandon-campaign">← Exit Operation</button>
            <button class="btn btn-primary" id="btn-end-turn" style="flex:1;">End Operational Turn (Advance Contagion) →</button>
          </div>
        </div>
      </div>

      <!-- Right: Telemetry, Actions & Strategic Superweapons -->
      <div style="display:flex;flex-direction:column;gap:var(--space-3);">
        
        <!-- Status Deck -->
        <div class="card" style="padding:16px;">
          <div class="grid-2" style="gap:var(--space-2);">
            <div class="card-granite-inset" style="text-align:center; padding:8px;">
              <div class="status-label" style="font-size:0.65rem;">TURN</div>
              <div class="font-mono text-bronze" style="font-size:1.25rem;font-weight:700;" id="infowar-turn-badge">TURN ${esc(eng.turn)} / ${esc(eng.maxTurns)}</div>
            </div>
            <div class="card-granite-inset" style="text-align:center; padding:8px;">
              <div class="status-label" style="font-size:0.65rem;">ACTION POINTS</div>
              <div class="font-mono text-bronze" style="font-size:1.25rem;font-weight:700;" id="infowar-ap-badge">${esc(eng.ap)} / ${esc(eng.maxAp)} AP</div>
            </div>
            <div class="card-granite-inset" style="text-align:center; padding:8px; border-left:3px solid var(--veracity-green);">
              <div class="status-label text-emerald" style="font-size:0.65rem;">NETWORK RESILIENCE</div>
              <div class="font-mono text-emerald" style="font-size:1.15rem;font-weight:700;" id="infowar-health">${Math.round(eng.health)}%</div>
            </div>
            <div class="card-granite-inset" style="text-align:center; padding:8px; border-left:3px solid var(--disinfo-crimson);">
              <div class="status-label text-crimson" style="font-size:0.65rem;">PUBLIC PANIC</div>
              <div class="font-mono text-amber" style="font-size:1.15rem;font-weight:700;" id="infowar-panic">${Math.round(eng.panic)}%</div>
            </div>
          </div>
        </div>

        <!-- Node Targeted Countermeasure Deck -->
        <div class="card" style="padding:16px;">
          <div class="card-header" style="margin-bottom:8px;">
            <h4 class="card-title" style="font-size:0.85rem;">Targeted Countermeasures</h4>
            <span class="badge badge-bronze">NODE REQUIRED</span>
          </div>
          <div class="grid-2" style="gap:8px;">
            <button class="btn btn-outline countermeasure-btn" data-action="immunize" style="justify-content:space-between;font-size:0.75rem;padding:8px;">
              <span>🛡️ Inoculate</span><span class="badge badge-ap">3 AP</span>
            </button>
            <button class="btn btn-outline countermeasure-btn" data-action="counterMessage" style="justify-content:space-between;font-size:0.75rem;padding:8px;">
              <span>📡 Counter-Msg</span><span class="badge badge-ap">2 AP</span>
            </button>
            <button class="btn btn-outline countermeasure-btn" data-action="exposeBotnet" style="justify-content:space-between;font-size:0.75rem;padding:8px;">
              <span>⚡ Expose Botnet</span><span class="badge badge-ap">4 AP</span>
            </button>
            <button class="btn btn-outline countermeasure-btn" data-action="quarantine" style="justify-content:space-between;font-size:0.75rem;padding:8px;">
              <span>🚧 Quarantine</span><span class="badge badge-ap">5 AP</span>
            </button>
          </div>
        </div>

        <!-- Epistemic Strategic Doctrines (Superweapons) -->
        <div class="card card-bronze" style="padding:16px;">
          <div class="card-header" style="margin-bottom:8px;">
            <h4 class="card-title" style="font-size:0.85rem;">Strategic Doctrines (Superweapons)</h4>
            <span class="badge badge-intel">NETWORK-WIDE</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button class="superweapon-btn" id="btn-doctrine-c2pa">
              <div>
                <div style="font-weight:700;font-size:0.8rem;color:var(--parchment-bright);">🔏 C2PA Provenance Broadcast</div>
                <div style="font-size:0.7rem;color:var(--stone-warm);">Hardens Press & Municipal nodes (+40% Res)</div>
              </div>
              <span class="badge badge-ap">6 AP</span>
            </button>
            <button class="superweapon-btn" id="btn-doctrine-breaker">
              <div>
                <div style="font-weight:700;font-size:0.8rem;color:var(--parchment-bright);">⚡ Algorithmic Circuit-Breaker</div>
                <div style="font-size:0.7rem;color:var(--stone-warm);">Halves contagion propagation for Next Turn</div>
              </div>
              <span class="badge badge-ap">4 AP</span>
            </button>
            <button class="superweapon-btn" id="btn-doctrine-osint">
              <div>
                <div style="font-weight:700;font-size:0.8rem;color:var(--parchment-bright);">🔍 OSINT Multi-Platform Takedown</div>
                <div style="font-size:0.7rem;color:var(--stone-warm);">Suppresses Darknet & Social amplification hubs</div>
              </div>
              <span class="badge badge-ap">5 AP</span>
            </button>
          </div>
        </div>

        <!-- Real-Time After-Action Telemetry Log -->
        <div class="card" style="flex:1;padding:16px;">
          <div class="card-header" style="margin-bottom:6px;">
            <h4 class="card-title" style="font-size:0.85rem;">Operational Telemetry Log</h4>
            <span class="badge badge-neutral">AAR</span>
          </div>
          <div id="aar-log" class="card-granite-inset" style="height:120px;overflow-y:auto;font-family:var(--font-mono);font-size:0.7rem;display:flex;flex-direction:column;gap:3px;padding:8px;"></div>
        </div>

      </div>

      <!-- BREAKING CRISIS DILEMMA MODAL -->
      <div id="infowar-dilemma-modal" class="modal-backdrop hidden" style="position:fixed;inset:0;background:rgba(18,18,17,0.9);backdrop-filter:blur(6px);z-index:var(--z-modal,900);display:flex;align-items:center;justify-content:center;">
        <div class="modal-panel card card-bronze" style="max-width:560px;width:90%;padding:24px;border-left:4px solid var(--disinfo-crimson);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <span class="badge badge-disinfo" id="dilemma-tactic-badge">DISARM TACTIC</span>
            <span class="status-label text-amber">MANDATORY DECISION</span>
          </div>
          <h3 id="dilemma-title" class="heading-3" style="color:var(--parchment-bright);margin-bottom:8px;">Breaking Dilemma</h3>
          <p id="dilemma-prompt" class="body-text" style="font-size:0.95rem;line-height:1.55;color:var(--parchment-secondary);margin-bottom:20px;">
            Crisis prompt...
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-outline" id="btn-dilemma-opt-a" style="text-align:left;padding:12px;font-size:0.88rem;border-color:var(--veracity-green);">
              Option A
            </button>
            <button class="btn btn-outline" id="btn-dilemma-opt-b" style="text-align:left;padding:12px;font-size:0.88rem;border-color:var(--amber-mid);">
              Option B
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind Core Buttons
    document.getElementById('btn-infowar-audio-toggle')?.addEventListener('click', () => {
      const muted = TacticalAudio.toggleMute();
      const btn = document.getElementById('btn-infowar-audio-toggle');
      if (btn) btn.textContent = muted ? '🔇 OFF' : '🔊 ON';
      if (!muted) TacticalAudio.playSelect();
    });

    document.getElementById('btn-end-turn')?.addEventListener('click', () => this._doEndTurn());
    document.getElementById('btn-abandon-campaign')?.addEventListener('click', () => this._renderCampaignSelect());

    // Bind Targeted Countermeasures
    document.querySelectorAll('.countermeasure-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (!this._selectedNode) {
          TacticalAudio.playAlarm();
          this._app?.showToast({ type: 'warning', title: 'SELECT A NODE', message: 'Click a node in the network graph first.' });
          return;
        }
        const result = this._engine[action](this._selectedNode);
        if (!result.ok) {
          TacticalAudio.playAlarm();
          this._app?.showToast({ type: 'warning', title: 'ACTION FAILED', message: result.msg });
        }
        this._refreshUI();
      });
    });

    // Bind Superweapon Doctrines
    document.getElementById('btn-doctrine-c2pa')?.addEventListener('click', () => {
      const res = this._engine.deployC2PAProvenance();
      if (!res.ok) {
        TacticalAudio.playAlarm();
        this._app?.showToast({ type: 'warning', title: 'DOCTRINE UNAVAILABLE', message: res.msg });
      }
      this._refreshUI();
    });

    document.getElementById('btn-doctrine-breaker')?.addEventListener('click', () => {
      const res = this._engine.deployCircuitBreaker();
      if (!res.ok) {
        TacticalAudio.playAlarm();
        this._app?.showToast({ type: 'warning', title: 'DOCTRINE UNAVAILABLE', message: res.msg });
      }
      this._refreshUI();
    });

    document.getElementById('btn-doctrine-osint')?.addEventListener('click', () => {
      const res = this._engine.deployOsintTakedown();
      if (!res.ok) {
        TacticalAudio.playAlarm();
        this._app?.showToast({ type: 'warning', title: 'DOCTRINE UNAVAILABLE', message: res.msg });
      }
      this._refreshUI();
    });

    this._renderSVGGraph();
    this._refreshAAR();
  },

  _renderSVGGraph(nodesOverride = null, edgesOverride = null) {
    const svg = document.getElementById('infowar-svg-arena');
    if (!svg || !this._engine) return;

    const eng = this._engine;
    const W = 600, H = 380;
    const nodes = nodesOverride || eng.nodes;
    const edges = edgesOverride || eng.edges;
    const nodeCount = nodes.length;

    // Topology Position Calculations
    const positions = {};
    const topology = eng.campaign.topology || 'mesh';

    if (topology === 'hub-spoke') {
      const hubId = nodes[2]?.id || nodes[0]?.id;
      if (hubId) positions[hubId] = { x: W / 2, y: H / 2 };
      const spokeNodes = nodes.filter(n => n.id !== hubId);
      spokeNodes.forEach((n, i) => {
        const angle = (i / Math.max(1, spokeNodes.length)) * Math.PI * 2;
        positions[n.id] = {
          x: W / 2 + Math.cos(angle) * (W * 0.38),
          y: H / 2 + Math.sin(angle) * (H * 0.38)
        };
      });
    } else if (topology === 'hierarchy') {
      if (nodes[0]) positions[nodes[0].id] = { x: W / 2, y: 50 };
      if (nodes[4]) positions[nodes[4].id] = { x: W * 0.28, y: 150 };
      if (nodes[5]) positions[nodes[5].id] = { x: W * 0.72, y: 150 };
      if (nodes[1]) positions[nodes[1].id] = { x: W * 0.16, y: 260 };
      if (nodes[6]) positions[nodes[6].id] = { x: W * 0.84, y: 260 };
      if (nodes[2]) positions[nodes[2].id] = { x: W * 0.38, y: 330 };
      if (nodes[3]) positions[nodes[3].id] = { x: W * 0.62, y: 330 };
      nodes.forEach(n => {
        if (!positions[n.id]) positions[n.id] = { x: W / 2, y: H / 2 };
      });
    } else {
      nodes.forEach((n, i) => {
        if (i === 0) {
          positions[n.id] = { x: W / 2, y: H / 2 };
        } else {
          const angle = ((i - 1) / Math.max(1, nodeCount - 1)) * Math.PI * 2;
          positions[n.id] = {
            x: W / 2 + Math.cos(angle) * (W * 0.34),
            y: H / 2 + Math.sin(angle) * (H * 0.36)
          };
        }
      });
    }

    const typeColors = {
      Press: '#c8a96e',
      Social: '#f59e0b',
      Academic: '#34d399',
      Municipal: '#38bdf8',
      Darknet: '#ef4444',
      Influencer: '#a78bfa',
      Technical: '#64748b',
      Institutional: '#22d3ee',
      Financial: '#fbbf24'
    };

    let svgHtml = `<defs>
      <filter id="glow-infowar" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

    // Render Edges with Contagion Wavefront
    const getNodeById = (id) => nodes.find(n => n.id === id);
    edges.forEach(e => {
      const s = positions[e.source];
      const t = positions[e.target];
      if (!s || !t) return;
      const srcNode = getNodeById(e.source);
      const tgtNode = getNodeById(e.target);
      const srcInf = (srcNode?.infection > 1 ? srcNode.infection / 100 : srcNode?.infection) || 0;
      const tgtInf = (tgtNode?.infection > 1 ? tgtNode.infection / 100 : tgtNode?.infection) || 0;
      const isContagionActive = (srcInf > 0.2 || tgtInf > 0.2) && !srcNode?.quarantined && !tgtNode?.quarantined;

      svgHtml += `<line x1="${esc(s.x)}" y1="${esc(s.y)}" x2="${esc(t.x)}" y2="${esc(t.y)}"
        class="${esc(isContagionActive ? 'edge-contagion-active' : 'edge-clean')}" />`;
    });

    // Render Nodes
    nodes.forEach(n => {
      const pos = positions[n.id];
      if (!pos) return;
      const r = 14 + (n.reach ?? 0.5) * 14;
      const baseColor = typeColors[n.type] || '#c8a96e';
      const rawInf = n.infection > 1 ? n.infection / 100 : (n.infection || 0);
      const infectionPct = Math.max(0, Math.min(1, rawInf));
      const infectionColor = `rgb(${Math.round(220 * infectionPct + 30 * (1 - infectionPct))},${Math.round(38 * infectionPct + 180 * (1 - infectionPct))},${Math.round(38 * infectionPct + 110 * (1 - infectionPct))})`;
      const fillColor = infectionPct > 0.4 ? infectionColor : baseColor;
      const isSelected = this._selectedNode === n.id;
      const isQuarantined = Boolean(n.quarantined);
      const isImmunized = Boolean(n.immunized);
      const isProvenance = Boolean(n.provenanceActive);

      // Hazard pulsation ring when infection > 40%
      if (infectionPct > 0.4 && !isQuarantined) {
        svgHtml += `<circle cx="${esc(pos.x)}" cy="${esc(pos.y)}" r="${esc(r + 8)}" fill="none" stroke="var(--disinfo-crimson)" stroke-width="1.5" class="infowar-danger-ring" />`;
      }

      // Selection indicator ring
      if (isSelected) {
        svgHtml += `<circle cx="${esc(pos.x)}" cy="${esc(pos.y)}" r="${esc(r + 5)}" fill="none" stroke="var(--bronze-primary)" stroke-width="2.5" stroke-dasharray="4 2" />`;
      }

      // Provenance / Immunized / Quarantined Status Rings
      if (isQuarantined) {
        svgHtml += `<circle cx="${esc(pos.x)}" cy="${esc(pos.y)}" r="${esc(r + 3)}" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="3 3"/>`;
      } else if (isImmunized || isProvenance) {
        svgHtml += `<circle cx="${esc(pos.x)}" cy="${esc(pos.y)}" r="${esc(r + 3)}" fill="none" stroke="var(--veracity-green)" stroke-width="2"/>`;
      }

      // Main Node Circle
      svgHtml += `
        <circle cx="${esc(pos.x)}" cy="${esc(pos.y)}" r="${esc(r)}"
          fill="${esc(fillColor)}" fill-opacity="${esc(0.75 + infectionPct * 0.25)}"
          stroke="${esc(isSelected ? 'var(--bronze-primary)' : 'rgba(255,255,255,0.25)')}"
          stroke-width="${esc(isSelected ? 2.5 : 1)}"
          class="infowar-node" data-node-id="${esc(n.id)}"
          style="cursor:pointer;transition:all 0.3s ease;"
          ${esc(infectionPct > 0.4 ? 'filter="url(#glow-infowar)"' : '')}/>
        <text x="${esc(pos.x)}" y="${esc(pos.y - 2)}" text-anchor="middle" fill="#fff" font-size="9"
          font-family="var(--font-mono)" pointer-events="none" font-weight="700">
          ${esc((n.name || 'NODE').split(' ').slice(-1)[0].toUpperCase().substring(0, 8))}
        </text>
        <text x="${esc(pos.x)}" y="${esc(pos.y + 11)}" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="7.5"
          font-family="var(--font-mono)" pointer-events="none">
          ${Math.round(infectionPct * 100)}%🔴
        </text>
      `;
    });

    svg.innerHTML = svgHtml;

    // Bind Node Clicks
    svg.querySelectorAll('.infowar-node').forEach(el => {
      el.addEventListener('click', () => {
        const nodeId = el.getAttribute('data-node-id');
        this._selectedNode = nodeId;
        TacticalAudio.playSelect();
        const n = nodes.find(item => item.id === nodeId);
        const inspector = document.getElementById('node-inspector');
        if (inspector && n) {
          const inf = n.infection > 1 ? n.infection / 100 : (n.infection || 0);
          const res = n.resistance > 1 ? n.resistance / 100 : (n.resistance || 0);
          const tru = n.trust > 1 ? n.trust / 100 : (n.trust || 0);
          inspector.innerHTML = `
            <span class="text-bronze">⬡ ${esc(n.name)}</span> [${esc(n.type)}] —
            Infection: <span class="${esc(inf > 0.5 ? 'text-crimson' : 'text-amber')}">${Math.round(inf * 100)}%</span> |
            Resistance: <span class="text-emerald">${Math.round(res * 100)}%</span> |
            Trust: <span class="text-bronze">${Math.round(tru * 100)}%</span>
            ${n.quarantined ? ' | <span class="text-amber">🚧 QUARANTINED</span>' : ''}
            ${n.immunized ? ' | <span class="text-emerald">🛡️ IMMUNIZED</span>' : ''}
            ${n.provenanceActive ? ' | <span class="text-emerald">🔏 C2PA VERIFIED</span>' : ''}
          `;
        }
        this._renderSVGGraph(nodes, edges);
      });
    });
  },

  _checkBreakingDilemma() {
    if (!this._engine || !Array.isArray(this._engine.campaign.dilemmas)) return false;
    const dilemma = this._engine.campaign.dilemmas.find(d => d.turn === this._engine.turn);
    if (!dilemma) return false;

    this._activeDilemma = dilemma;
    const modal = document.getElementById('infowar-dilemma-modal');
    if (!modal) return false;

    TacticalAudio.playAlarm();

    document.getElementById('dilemma-tactic-badge').textContent = dilemma.disarmTactic || 'TACTICAL CRISIS';
    document.getElementById('dilemma-title').textContent = dilemma.title;
    document.getElementById('dilemma-prompt').textContent = dilemma.prompt;

    const optABtn = document.getElementById('btn-dilemma-opt-a');
    const optBBtn = document.getElementById('btn-dilemma-opt-b');

    if (optABtn) optABtn.textContent = `[OPTION A] ${dilemma.optionA.label}`;
    if (optBBtn) optBBtn.textContent = `[OPTION B] ${dilemma.optionB.label}`;

    optABtn.onclick = () => this._resolveDilemma(dilemma.optionA);
    optBBtn.onclick = () => this._resolveDilemma(dilemma.optionB);

    modal.classList.remove('hidden');
    return true;
  },

  _resolveDilemma(choice) {
    const modal = document.getElementById('infowar-dilemma-modal');
    modal?.classList.add('hidden');

    if (choice.apCost) this._engine.spend(choice.apCost);
    if (choice.healthDelta) this._engine.health = Math.max(0, Math.min(100, this._engine.health + choice.healthDelta));
    if (choice.panicDelta) this._engine.panic = Math.max(0, Math.min(100, this._engine.panic + choice.panicDelta));

    if (choice.nodeBoostType) {
      this._engine.nodes.filter(n => n.type === choice.nodeBoostType).forEach(n => {
        n.resistance = Math.min(1, n.resistance + 0.25);
      });
    }

    if (choice.quarantineNode) {
      const qn = this._engine.getNode(choice.quarantineNode);
      if (qn) qn.quarantined = true;
    }

    if (choice.infectionTarget) {
      const it = this._engine.getNode(choice.infectionTarget);
      if (it) it.infection = Math.min(1, it.infection + 0.25);
    }

    this._engine.log(`⚖️ DILEMMA RESOLVED: ${choice.effectMsg}`, 'emerald');
    TacticalAudio.playShield();
    this._refreshUI();
  },

  _doEndTurn() {
    this._engine.endTurn();
    this._saveHistoricalSnapshot();
    this._refreshUI();

    if (this._engine.gameOver) {
      if (this._engine.won) TacticalAudio.playVictory();
      else TacticalAudio.playDefeat();
      setTimeout(() => this._showEndScreen(), 600);
      return;
    }

    // Check if turn triggers breaking dilemma
    this._checkBreakingDilemma();
  },

  _refreshUI() {
    const eng = this._engine;
    const apEl = document.getElementById('infowar-ap-badge');
    const turnEl = document.getElementById('infowar-turn-badge');
    const infEl = document.getElementById('infowar-infection-rate');
    const healthEl = document.getElementById('infowar-health');
    const panicEl = document.getElementById('infowar-panic');
    const radarEl = document.getElementById('infowar-radar-text');

    if (apEl) apEl.textContent = `${eng.ap} / ${eng.maxAp} AP`;
    if (turnEl) turnEl.textContent = `TURN ${eng.turn} / ${eng.maxTurns}`;
    if (infEl) infEl.textContent = `INFECTION: ${Math.round(eng.getAverageInfection() * 100)}%`;
    if (healthEl) healthEl.textContent = `${Math.round(eng.health)}%`;
    if (panicEl) panicEl.textContent = `${Math.round(eng.panic)}%`;

    const nextEvent = eng.campaign.turnEvents?.find(e => e.turn === eng.turn + 1);
    const targetNode = nextEvent ? eng.getNode(nextEvent.affectedNode) : null;
    if (radarEl) {
      radarEl.textContent = targetNode
        ? `PROJECTED STRIKE: Adversary bot cluster targeting [${targetNode.name}] on Turn ${eng.turn + 1}`
        : `RADAR CLEAR: No high-confidence zero-day attacks detected for Turn ${eng.turn + 1}`;
    }

    this._app?.store?.set('telemetry.activeAp', eng.ap, false);

    this._renderSVGGraph();
    this._refreshAAR();
  },

  _refreshAAR() {
    const log = document.getElementById('aar-log');
    if (!log || !this._engine) return;
    log.innerHTML = this._engine.history.map(entry => `
      <div style="padding:2px 0;border-bottom:1px solid rgba(200,169,110,0.08);">
        <span style="color:var(--border-primary);">[T${esc(entry.turn)}]</span>
        <span style="color:${esc(entry.color === 'emerald' ? 'var(--veracity-green)' : entry.color === 'amber' ? '#f59e0b' : entry.color === 'bronze' ? 'var(--bronze-light)' : entry.color === 'cyan' ? 'var(--intel-cyan)' : 'var(--parchment-secondary)')};">${esc(entry.msg)}</span>
      </div>
    `).join('');
    log.scrollTop = 0;
  },

  /**
   * Stage-matched DISARM Blue countermeasures for a post-mortem diagnostic, drawn from the
   * genuine framework in data/disarm_blue.json (C-codes, CC-BY-SA-4.0). Returns an HTML string,
   * or '' when the dataset is unavailable or the stage has no countermeasures — the AAR then
   * falls back to the hand-written remedy rather than inventing one.
   * @private
   */
  _renderBlueCountermeasures(diag) {
    if (!diag || !diag.blueStage || !this._disarmBlue) return '';
    const stage = (this._disarmBlue.stages || []).find(s => s.id === diag.blueStage);
    if (!stage || !Array.isArray(stage.countermeasures) || stage.countermeasures.length === 0) return '';

    return `
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle);">
        <div style="font-size:0.72rem;color:var(--stone-warm);margin-bottom:6px;letter-spacing:0.04em;">
          DISARM BLUE COUNTERMEASURES — ${esc(stage.id)} ${esc(stage.name)}
        </div>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px;">
          ${stage.countermeasures.map(c => `
            <li style="font-size:0.78rem;color:var(--parchment-primary);line-height:1.45;">
              <span style="font-family:var(--font-mono);color:var(--intel-cyan, #38bdf8);">${esc(c.id)}</span> — ${esc(c.name)}${esc(c.notRecommended ? ' · not recommended by the framework' : '')}
            </li>`).join('')}
        </ul>
        <div style="font-size:0.66rem;color:var(--stone-warm);margin-top:6px;">
          Source: DISARM Foundation Blue framework (CC-BY-SA-4.0).
        </div>
      </div>`;
  },

  // ─────────────────────────────────────────────
  // INTERACTIVE POST-MORTEM & TURN SCRUBBER
  // ─────────────────────────────────────────────
  _showEndScreen() {
    const eng = this._engine;
    const view = document.getElementById('view-infowar');
    const mainGrid = view?.querySelector('.grid-split-2-1');
    if (!mainGrid || !eng) return;

    const containmentScore = Math.max(0, Math.min(100, Math.round(eng.health * 0.7 + (100 - eng.panic) * 0.3)));
    const grade = getContainmentGrade(containmentScore);

    // Save completed campaign stats to StateStore
    const existingStats = this._app?.store?.get('infowar.stats') || {
      completedCampaigns: 0,
      victories: 0,
      defeats: 0,
      highestContainment: 0,
      totalApSpent: 0,
      byCampaign: {}
    };

    existingStats.completedCampaigns = (existingStats.completedCampaigns || 0) + 1;
    if (eng.won) {
      existingStats.victories = (existingStats.victories || 0) + 1;
    } else {
      existingStats.defeats = (existingStats.defeats || 0) + 1;
    }
    existingStats.highestContainment = Math.max(existingStats.highestContainment || 0, containmentScore);
    const apSpent = eng.apSpentTotal || Math.max(0, (eng.maxAp * (eng.turn - 1)) - eng.ap);
    existingStats.totalApSpent = (existingStats.totalApSpent || 0) + apSpent;

    if (!existingStats.byCampaign) existingStats.byCampaign = {};
    existingStats.byCampaign[eng.campaign.id] = {
      name: eng.campaign.name,
      lastPlayed: new Date().toISOString(),
      lastScore: containmentScore,
      lastGrade: grade,
      won: eng.won
    };

    this._app?.store?.set('infowar.stats', existingStats);

    // Dispatch completion event
    window.dispatchEvent(new CustomEvent('aegis:infowar-complete', {
      detail: {
        campaignId: eng.campaign.id,
        campaignName: eng.campaign.name,
        won: eng.won,
        score: containmentScore,
        grade,
        turns: eng.turn - 1,
        health: Math.round(eng.health),
        panic: Math.round(eng.panic),
        stats: existingStats
      }
    }));

    // Record attempt to AttemptLog
    try {
      recordAttempt({
        skillIds: ['skill.disarm.countermeasures', 'skill.disarm.plan-prepare'],
        itemId: `infowar-${eng.campaign.id}-${eng.turn}`,
        correct: Boolean(eng.won),
        context: CONTEXTS.INFOWAR || 'infowar',
        confidence: 'sure'
      }).catch(() => {});
    } catch {}

    const lastSnap = this._historicalStates[this._historicalStates.length - 1] || {
      turn: Math.max(1, eng.turn - 1),
      health: eng.health,
      panic: eng.panic,
      avgInfection: eng.getAverageInfection(),
      nodes: eng.nodes,
      edges: eng.edges
    };

    mainGrid.innerHTML = `
      <div class="card card-bronze" style="grid-column:1/-1;text-align:center;padding:var(--space-6);">
        <div style="font-size:3.5rem;margin-bottom:var(--space-2);">${esc(eng.won ? '🏆' : '💀')}</div>
        <div class="heading-1 ${esc(eng.won ? 'text-emerald' : 'text-crimson')}" style="margin-bottom:var(--space-2);">
          ${esc(eng.won ? 'PERIMETER DEFENSE SUCCESSFUL' : 'NETWORK PERIMETER COMPROMISED')}
        </div>
        <div class="body-lead" style="margin-bottom:var(--space-4); color:var(--parchment-secondary);">
          ${esc(eng.campaign.name)} — Containment Rating: <strong>Grade ${esc(grade)} (${esc(containmentScore)}%)</strong>
        </div>

        <!-- Metric Grid -->
        <div class="grid-4" style="max-width:720px;margin:0 auto var(--space-4);">
          <div class="card-granite-inset">
            <div class="status-label text-bronze">TOTAL TURNS</div>
            <div class="font-mono" style="font-size:1.4rem;">${esc(eng.turn - 1)} / ${esc(eng.maxTurns)}</div>
          </div>
          <div class="card-granite-inset">
            <div class="status-label text-bronze">FINAL RESILIENCE</div>
            <div class="font-mono ${esc(eng.health >= 60 ? 'text-emerald' : 'text-crimson')}" style="font-size:1.4rem;">${Math.round(eng.health)}%</div>
          </div>
          <div class="card-granite-inset">
            <div class="status-label text-bronze">PUBLIC PANIC</div>
            <div class="font-mono ${esc(eng.panic <= 40 ? 'text-emerald' : 'text-crimson')}" style="font-size:1.4rem;">${Math.round(eng.panic)}%</div>
          </div>
          <div class="card-granite-inset">
            <div class="status-label text-bronze">AVG INFECTION</div>
            <div class="font-mono ${esc(eng.getAverageInfection() <= 0.3 ? 'text-emerald' : 'text-crimson')}" style="font-size:1.4rem;">${Math.round(eng.getAverageInfection() * 100)}%</div>
          </div>
        </div>

        <!-- Interactive Turn History Replay Scrubber & Network Visualization -->
        <div class="card-granite-inset" style="max-width:720px;margin:0 auto var(--space-4);padding:16px;text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="status-label text-bronze">INTERACTIVE TURN SCRUBBER (AAR VISUAL REPLAY)</span>
            <span id="scrubber-turn-label" class="font-mono text-emerald" style="font-size:0.85rem;">TURN ${esc(this._historicalStates.length)} (FINAL)</span>
          </div>
          <input type="range" id="infowar-aar-scrubber" min="1" max="${esc(Math.max(1, this._historicalStates.length))}" value="${esc(this._historicalStates.length)}" style="width:100%;cursor:pointer;">
          <div id="scrubber-stats" class="body-text" style="font-size:0.85rem;margin-top:8px;margin-bottom:12px;color:var(--parchment-secondary);">
            Turn ${esc(lastSnap.turn)} State: Health: <strong class="text-emerald">${Math.round(lastSnap.health)}%</strong> | 
            Panic: <strong class="text-amber">${Math.round(lastSnap.panic)}%</strong> | 
            Avg Contagion: <strong class="text-crimson">${Math.round(lastSnap.avgInfection * 100)}%</strong>
          </div>
          <div style="height:300px;position:relative;overflow:hidden;background:radial-gradient(circle at center,rgba(16,21,32,0.9),var(--bg-void)); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
            <svg width="100%" height="100%" viewBox="0 0 600 380" id="infowar-svg-arena"></svg>
          </div>
        </div>

        <!-- Debrief & Reflective AAR -->
        <div class="card-granite-inset" style="text-align:left;max-width:720px;margin:0 auto var(--space-4);padding:16px;">
          <div class="status-label text-bronze" style="margin-bottom:var(--space-2);">TACTICAL DOCTRINE LESSONS</div>
          <p class="body-text" style="font-size:0.9rem;line-height:1.5;">${eng.won
            ? `Superior epistemic defense. You contained the ${eng.campaign.adversaryType} assault, protected critical bridge hubs with C2PA/inoculation protocols, and prevented social panic cascading.`
            : `The ${eng.campaign.adversaryType} offensive breached perimeter defenses. Key vulnerability: Delayed prebunking allowed infected super-spreaders to transmit virality to regional press nodes.`
          }</p>

          ${!eng.won ? `
            <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-subtle);">
              <div class="status-label text-amber" style="margin-bottom: var(--space-2);">REFLECTIVE AFTER-ACTION REVIEW (DISARM FRAMEWORK POST-MORTEM)</div>
              <p class="body-text" style="font-size: 0.85rem; margin-bottom: 8px;">Map this breach to a <strong>Canonical DISARM Framework Tactic</strong> to diagnose adversarial tradecraft and unlock the retry protocol:</p>
              <select id="infowar-aar-select" class="omni-input" style="width: 100%; padding: 8px; border: 1px solid var(--bronze-mid); border-radius: var(--radius-sm); background: var(--bg-surface); color: var(--parchment-light);">
                <option value="">-- Select Failed Containment Stage (Canonical DISARM ID) --</option>
                <option value="T0002">T0002: Plan Strategy (Establish Strategic Influence Objectives)</option>
                <option value="T0004">T0004: Map Ecology (Map Information Ecology & Channel Redundancy)</option>
                <option value="T0008">T0008: Micro-Targeting (Target Vulnerable Peripheral Clusters)</option>
                <option value="T0009">T0009: Amplify & Swarm (Coordinated Botnet Amplification)</option>
                <option value="T0015">T0015: Fabricate Media (Synthetic Audio & Video Forgeries)</option>
                <option value="T0026">T0026: Tainted Leaks (Selective Decontextualization & Poisoning)</option>
              </select>
              <div id="infowar-aar-diagnostic" style="display:none;margin-top:12px;padding:12px;background:var(--bg-surface-inset);border-left:3px solid var(--bronze-primary);border-radius:var(--radius-sm);">
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Action Row -->
        <div class="flex-row-gap" style="justify-content:center;gap:12px;">
          <button class="btn btn-secondary" id="btn-pin-infowar-dossier">📌 Pin AAR to Dossier</button>
          <button class="btn btn-secondary" id="btn-replay-campaign" ${esc(!eng.won ? 'disabled' : '')}>Replay Operation</button>
          <button class="btn btn-primary" id="btn-new-campaign" ${esc(!eng.won ? 'disabled' : '')}>Select New Campaign →</button>
        </div>
      </div>
    `;

    // Immediately render final historical state into the replay arena
    this._renderSVGGraph(lastSnap.nodes, lastSnap.edges);

    // Bind Scrubber Slider
    const scrubber = document.getElementById('infowar-aar-scrubber');
    scrubber?.addEventListener('input', (e) => {
      const turnIdx = parseInt(e.target.value, 10) - 1;
      const snap = this._historicalStates[turnIdx];
      if (snap) {
        const isFinal = turnIdx === this._historicalStates.length - 1;
        const turnLabel = document.getElementById('scrubber-turn-label');
        if (turnLabel) turnLabel.textContent = `TURN ${snap.turn}${isFinal ? ' (FINAL)' : ''}`;
        const statsEl = document.getElementById('scrubber-stats');
        if (statsEl) {
          statsEl.innerHTML = `
            Turn ${esc(snap.turn)} State: Health: <strong class="text-emerald">${Math.round(snap.health)}%</strong> | 
            Panic: <strong class="text-amber">${Math.round(snap.panic)}%</strong> | 
            Avg Contagion: <strong class="text-crimson">${Math.round(snap.avgInfection * 100)}%</strong>
          `;
        }
        this._renderSVGGraph(snap.nodes, snap.edges);
        TacticalAudio.playSelect();
      }
    });

    // Bind Pin to Dossier
    document.getElementById('btn-pin-infowar-dossier')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('aegis:pin', {
        detail: {
          source: 'InfoWar Tactical Simulator',
          title: `AAR: ${eng.campaign.name} [Grade ${grade}]`,
          content: `OUTCOME: ${eng.won ? 'VICTORY' : 'DEFEAT'}\nADVERSARY: ${eng.campaign.adversaryType}\nHEALTH: ${Math.round(eng.health)}% | PANIC: ${Math.round(eng.panic)}%\nTURNS: ${eng.turn - 1} / ${eng.maxTurns}\nGRADE: ${grade} (${containmentScore}% Containment Efficiency)`
        }
      }));
      TacticalAudio.playShield();
      this._app?.showToast({ type: 'success', title: 'PINNED TO DOSSIER', message: 'After-Action Report saved.' });
    });

    document.getElementById('btn-replay-campaign')?.addEventListener('click', () => {
      TacticalAudio.playSelect();
      this._startCampaign(eng.campaign);
    });

    document.getElementById('btn-new-campaign')?.addEventListener('click', () => {
      TacticalAudio.playSelect();
      this._renderCampaignSelect();
    });

    if (!eng.won) {
      const aarSelect = document.getElementById('infowar-aar-select');
      const diagContainer = document.getElementById('infowar-aar-diagnostic');
      aarSelect?.addEventListener('change', (e) => {
        const val = e.target.value;
        const diag = DISARM_DIAGNOSTICS[val];
        const canUnlock = Boolean(val);
        const replayBtn = document.getElementById('btn-replay-campaign');
        const newCampaignBtn = document.getElementById('btn-new-campaign');
        if (replayBtn) replayBtn.disabled = !canUnlock;
        if (newCampaignBtn) newCampaignBtn.disabled = !canUnlock;

        if (diag && diagContainer) {
          diagContainer.style.display = 'block';
          diagContainer.innerHTML = `
            <div style="font-weight:700;color:var(--bronze-bright);font-size:0.88rem;margin-bottom:4px;">
              🔍 [DISARM ${esc(diag.id)}] ${esc(diag.name)} (Phase: ${esc(diag.phase)})
            </div>
            <div style="font-size:0.82rem;color:var(--parchment-primary);line-height:1.45;margin-bottom:6px;">
              ${esc(diag.description)}
            </div>
            <div style="font-size:0.8rem;color:var(--veracity-green);font-weight:600;">
              🛡️ ${esc(diag.remedy)}
            </div>
            ${/* locally-built fragment — must NOT be encoded */ this._renderBlueCountermeasures(diag)}
          `;
          TacticalAudio.playSelect();
        } else if (diagContainer) {
          diagContainer.style.display = 'none';
        }
      });
    }

    this._app?.showToast({
      type: eng.won ? 'success' : 'danger',
      title: eng.won ? 'OPERATION SUCCESSFUL' : 'OPERATION COMPROMISED',
      message: `${eng.campaign.name} — Containment: ${containmentScore}% (Grade ${grade})`
    });
  }
};

/**
 * Headless Class Engine for Automated Verification & Testing
 */
export class InfoWarEngine {
  constructor(campaignData = {}) {
    this.id = campaignData.id || 'campaign-default';
    this.name = campaignData.name || 'Defensive Simulation';
    this.maxTurns = campaignData.maxTurns || 8;
    this.maxAp = campaignData.apPerTurn || 10;
    this.ap = this.maxAp;
    this.turn = 1;
    this.gameOver = false;
    this.won = false;
    this.frictionActive = false;

    this.ACTION_COSTS = {
      inoculate: 3,
      debunk: 4,
      friction: 2,
      botnet_takedown: 5,
      attestation: 3
    };

    const defaultNodes = [
      { id: 'node-1', name: 'National News Wire', type: 'Press', reach: 0.90, resistance: 0.45, infection: 15, trust: 85 },
      { id: 'node-2', name: 'Regional Press Syndicates', type: 'Press', reach: 0.50, resistance: 0.25, infection: 35, trust: 70 },
      { id: 'node-3', name: 'Platform X / Global Microblog', type: 'Social', reach: 1.00, resistance: 0.15, infection: 60, trust: 40 },
      { id: 'node-4', name: 'Encrypted Dark Channels', type: 'Darknet', reach: 0.60, resistance: 0.05, infection: 90, trust: 10 },
      { id: 'node-5', name: 'National Scientific Academy', type: 'Academic', reach: 0.30, resistance: 0.85, infection: 5, trust: 95 },
      { id: 'node-6', name: 'Emergency Services Dispatch', type: 'Municipal', reach: 0.80, resistance: 0.60, infection: 10, trust: 90 },
      { id: 'node-7', name: 'Viral Influencer Mesh', type: 'Influencer', reach: 0.75, resistance: 0.20, infection: 50, trust: 50 }
    ];

    const sourceNodes = campaignData.nodes && campaignData.nodes.length > 0 ? campaignData.nodes : defaultNodes;
    this.nodes = sourceNodes.map(n => ({
      id: n.id,
      name: n.name,
      type: n.type,
      reach: n.reach ?? 0.5,
      resistance: n.resistance ?? 0.3,
      infection: n.infection > 1 ? n.infection : (n.infection * 100),
      trust: n.trust > 1 ? n.trust : (n.trust * 100)
    }));

    this.turnEvents = campaignData.turnEvents || [];
    this.history = [];
    this.apSpentTotal = 0;
    this.actionCounts = { inoculate: 0, debunk: 0, friction: 0, botnet_takedown: 0, attestation: 0 };

    this.recalculateMetrics();
  }

  getNode(nodeId) {
    return this.nodes.find(n => n.id === nodeId) || null;
  }

  takeAction(actionType, targetNodeId = null) {
    if (this.gameOver) {
      return { success: false, error: 'Game is already completed.' };
    }

    if (!Object.prototype.hasOwnProperty.call(this.ACTION_COSTS, actionType)) {
      return { success: false, error: `Unknown action type: ${actionType}` };
    }
    const cost = this.ACTION_COSTS[actionType];

    if (this.ap < cost) {
      return { success: false, error: `Insufficient Action Points (requires ${cost} AP, has ${this.ap} AP)` };
    }

    let targetNode = null;
    if (actionType !== 'friction' && actionType !== 'attestation') {
      targetNode = this.getNode(targetNodeId);
      if (!targetNode) {
        return { success: false, error: `Invalid target node ID: ${targetNodeId}` };
      }
    }

    this.ap -= cost;
    this.apSpentTotal += cost;
    this.actionCounts[actionType] = (this.actionCounts[actionType] || 0) + 1;

    switch (actionType) {
      case 'inoculate':
        targetNode.resistance = Math.min(1.0, Math.round((targetNode.resistance + 0.40) * 100) / 100);
        targetNode.trust = Math.min(100, targetNode.trust + 5);
        break;
      case 'debunk':
        targetNode.infection = Math.max(0, targetNode.infection - 50);
        targetNode.trust = Math.min(100, targetNode.trust + 25);
        break;
      case 'friction':
        this.frictionActive = true;
        break;
      case 'botnet_takedown':
        targetNode.infection = Math.max(0, targetNode.infection - 70);
        targetNode.resistance = Math.min(1.0, Math.round((targetNode.resistance + 0.20) * 100) / 100);
        break;
      case 'attestation':
        for (const n of this.nodes) {
          n.trust = Math.min(100, n.trust + 10);
        }
        break;
    }

    this.recalculateMetrics();

    return {
      success: true,
      action: actionType,
      cost,
      remainingAp: this.ap,
      targetNode: targetNode ? { ...targetNode } : null,
      health: this.health,
      panic: this.panic
    };
  }

  endTurn() {
    if (this.gameOver) {
      return this.getState();
    }

    const beta = this.frictionActive ? 0.10 : 0.20;
    this.frictionActive = false;

    const infectionDeltas = new Map();
    for (const node of this.nodes) {
      infectionDeltas.set(node.id, 0);
    }

    for (const source of this.nodes) {
      if (source.infection > 20) {
        const outbreakStrength = (source.infection / 100) * source.reach * beta;
        for (const target of this.nodes) {
          if (target.id !== source.id) {
            const spreadDelta = outbreakStrength * (1 - target.resistance) * 20;
            infectionDeltas.set(target.id, infectionDeltas.get(target.id) + spreadDelta);
          }
        }
      }
    }

    for (const node of this.nodes) {
      const delta = infectionDeltas.get(node.id) || 0;
      node.infection = Math.min(100, Math.round((node.infection + delta) * 10) / 10);
    }

    const event = this.turnEvents.find(e => e.turn === this.turn);
    if (event) {
      const target = this.getNode(event.affectedNode);
      if (target) {
        const addedInfection = event.infectionDelta > 1 ? event.infectionDelta : (event.infectionDelta * 100);
        target.infection = Math.min(100, target.infection + addedInfection);
      }
    }

    this.history.push({
      turn: this.turn,
      health: this.health,
      panic: this.panic,
      avgInfection: this.avgInfection,
      event: event ? event.title : null
    });

    this.turn++;
    this.ap = this.maxAp;

    this.recalculateMetrics();

    if (this.health < 20 || this.panic >= 85) {
      this.gameOver = true;
      this.won = false;
    } else if (this.turn > this.maxTurns) {
      this.gameOver = true;
      this.won = this.health >= 60 && this.panic <= 40;
    }

    return this.getState();
  }

  recalculateMetrics() {
    let totalInfection = 0;
    let totalTrust = 0;
    for (const n of this.nodes) {
      totalInfection += n.infection;
      totalTrust += n.trust;
    }
    const count = this.nodes.length || 1;
    this.avgInfection = Math.round((totalInfection / count) * 10) / 10;
    this.avgTrust = Math.round((totalTrust / count) * 10) / 10;

    this.health = Math.max(0, Math.min(100, Math.round(100 - this.avgInfection)));
    const panicRaw = this.avgInfection * (1.2 - (this.avgTrust / 200));
    this.panic = Math.max(0, Math.min(100, Math.round(panicRaw)));
  }

  getState() {
    return {
      id: this.id,
      turn: Math.min(this.turn, this.maxTurns),
      maxTurns: this.maxTurns,
      ap: this.ap,
      maxAp: this.maxAp,
      nodes: this.nodes.map(n => ({ ...n })),
      health: this.health,
      panic: this.panic,
      avgInfection: this.avgInfection,
      avgTrust: this.avgTrust,
      history: [...this.history],
      gameOver: this.gameOver,
      won: this.won
    };
  }

  generateAAR() {
    const containmentEfficiency = Math.max(0, Math.min(100, Math.round(this.health * 0.7 + (100 - this.panic) * 0.3)));
    let grade = 'Breached Perimeter (F)';
    let gradeLetter = 'F';
    if (containmentEfficiency >= 85) {
      grade = 'Sovereign Aegis Elite (S)';
      gradeLetter = 'S';
    } else if (containmentEfficiency >= 70) {
      grade = 'Epistemic Defender (A)';
      gradeLetter = 'A';
    } else if (containmentEfficiency >= 55) {
      grade = 'Containment Operator (B)';
      gradeLetter = 'B';
    } else if (containmentEfficiency >= 40) {
      grade = 'Contested Perimeter (C)';
      gradeLetter = 'C';
    } else if (containmentEfficiency >= 20) {
      grade = 'Compromised Perimeter (D)';
      gradeLetter = 'D';
    } else {
      grade = 'Breached Perimeter (F)';
      gradeLetter = 'F';
    }

    return {
      campaignId: this.id,
      campaignName: this.name,
      outcome: this.won ? 'VICTORY' : 'DEFEAT',
      finalHealth: this.health,
      finalPanic: this.panic,
      totalApSpent: this.apSpentTotal,
      actionsTaken: { ...this.actionCounts },
      containmentEfficiency,
      performanceGrade: grade,
      gradeLetter,
      grade: gradeLetter,
      timestamp: new Date().toISOString()
    };
  }
}
