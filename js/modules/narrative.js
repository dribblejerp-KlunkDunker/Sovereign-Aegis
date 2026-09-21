/**
 * SOVEREIGN // AEGIS — Narrative Topology Module
 * 48-Hour Spatiotemporal Contagion Diffusion Physics Engine
 * Multi-Tier Network Graph, Dynamic Seeding, Botnet Amplification, Bridge Laundering
 */

import { esc } from '../security.js';

// Fallback narrative topology for headless testing & offline protocols
const FALLBACK_NARRATIVES = [
  {
    id: "narrative-deepfake-bank-run",
    title: "Operation Liquidity Shock: Synthetic Audio-Driven Bank Run",
    summary: "Propagation timeline of an AI-synthesized audio recording claiming the immediate insolvency of Apex Regional Bank.",
    diffusionTimeline: [
      { t_hours: 0, phase: "Inception & Seeding", velocitySharesPerHour: 120, cumulativeReach: 1500, botnetActivityPct: 92.5, activeVectors: ["Fringe Finance Telegram", "4chan /biz/"] },
      { t_hours: 4, phase: "Bridge Laundering", velocitySharesPerHour: 4200, cumulativeReach: 95000, botnetActivityPct: 65.0, activeVectors: ["Day-Trading Subreddits", "Fintech Influencers"] },
      { t_hours: 12, phase: "Mainstream Infiltration", velocitySharesPerHour: 38000, cumulativeReach: 1250000, botnetActivityPct: 28.0, activeVectors: ["Cable Financial News", "Mobile Banking Alerts"] },
      { t_hours: 24, phase: "Institutional Clashes & Decay", velocitySharesPerHour: 41000, cumulativeReach: 4100000, botnetActivityPct: 12.0, activeVectors: ["Federal Reserve Briefing", "Emergency Press Desk"] },
      { t_hours: 48, phase: "Institutional Clashes & Decay", velocitySharesPerHour: 6500, cumulativeReach: 5800000, botnetActivityPct: 5.0, activeVectors: ["SEC Regulatory Bulletins"] }
    ],
    topologyGraph: {
      nodes: [
        { id: "n1-fringe-origin", label: "Telegram @ApexWhistleblower", type: "Seeder", reach: 5000 },
        { id: "n2-botnet-cluster", label: "Botnet Swarm Hydra (1,200 bots)", type: "Amplifier", reach: 150000 },
        { id: "n3-reddit-rwallstreet", label: "r/WallStreetBets Thread", type: "Bridge", reach: 850000 },
        { id: "n4-fintech-influencer", label: "Fintech Creator @CryptoMacro", type: "Influencer", reach: 600000 },
        { id: "n5-cable-news", label: "Cable Business Ticker", type: "Mainstream", reach: 2500000 },
        { id: "n6-regulator-desk", label: "FDIC / Fed Press Desk", type: "Institutional", reach: 3000000 }
      ],
      edges: [
        { source: "n1-fringe-origin", target: "n2-botnet-cluster", type: "Amplification" },
        { source: "n2-botnet-cluster", target: "n3-reddit-rwallstreet", type: "Cross-Posting" },
        { source: "n3-reddit-rwallstreet", target: "n4-fintech-influencer", type: "Quote-Broadcast" },
        { source: "n4-fintech-influencer", target: "n5-cable-news", type: "Laundering" },
        { source: "n5-cable-news", target: "n6-regulator-desk", type: "Regulatory Trigger" },
        { source: "n6-regulator-desk", target: "n1-fringe-origin", type: "Direct Refutation" }
      ]
    },
    countermeasureWindows: [
      { timeframe: "T+0h to T+4h (Golden Inoculation Window)", interventionType: "Rapid Audio Spectral Forensics", effectivenessRating: "95% (Maximum)", recommendedAction: "Publish 2048-point linear spectrogram showing vocoder cutoff and deploy prebunking alerts." },
      { timeframe: "T+4h to T+12h (Bridge Severing Window)", interventionType: "Exchange Circuit Breakers & DID Attestation", effectivenessRating: "75% (Moderate-High)", recommendedAction: "Coordinate SEC 8-K attestation signed with executive DID keys and halt algorithmic volatility spikes." },
      { timeframe: "T+12h to T+48h (Harm Mitigation & Cleanup)", interventionType: "Truth Sandwich Mainstream Broadcast", effectivenessRating: "45% (Sub-optimal)", recommendedAction: "Mandate Truth Sandwich reporting on cable channels and refer short-seller transaction logs to enforcement." }
    ]
  }
];

/**
 * Real mathematical contagion diffusion engine.
 * Computes node-by-node infection propagation, edge fluxes, and aggregate metrics
 * over 48 hours using network epidemic differential physics.
 *
 * @param {object} topologyGraph - { nodes: Array, edges: Array }
 * @param {Array} [diffusionTimeline=[]] - Empirical milestone timeline for calibration
 * @param {number} [maxHours=48]
 * @returns {Array<object>} 49 snapshots (indices 0..48)
 */
export function simulateContagionDiffusion(topologyGraph, diffusionTimeline = [], maxHours = 48) {
  if (!topologyGraph || !Array.isArray(topologyGraph.nodes)) {
    return [];
  }

  const nodes = topologyGraph.nodes.map(n => ({
    ...n,
    resistance: n.resistance !== undefined ? n.resistance :
                n.type === 'Seeder' || n.type === 'Seed' ? 0.05 :
                n.type === 'Amplifier' || n.type === 'Botnet' ? 0.12 :
                n.type === 'Bridge' ? 0.35 :
                n.type === 'Influencer' || n.type === 'Social' ? 0.40 :
                n.type === 'Mainstream' || n.type === 'Broadcast' ? 0.70 :
                n.type === 'Institutional' || n.type === 'Municipal' ? 0.85 : 0.30
  }));

  const edges = topologyGraph.edges || [];
  const snapshots = [];

  // Initial infection states at h=0
  const state = new Map();
  nodes.forEach(n => {
    const isSeed = n.type === 'Seeder' || n.type === 'Seed' || (n.id && n.id.includes('seed'));
    state.set(n.id, isSeed ? 0.95 : 0.0);
  });

  for (let h = 0; h <= maxHours; h++) {
    const nodeInfections = {};
    let cumulativeReach = 0;
    let botnetInfection = 0;
    let totalInfection = 0;

    nodes.forEach(n => {
      const inf = state.get(n.id) || 0;
      nodeInfections[n.id] = inf;
      cumulativeReach += inf * (n.reach || 10000);
      totalInfection += inf;
      if (n.type === 'Seeder' || n.type === 'Seed' || n.type === 'Amplifier' || n.type === 'Botnet') {
        botnetInfection += inf;
      }
    });

    const edgeFluxes = {};
    edges.forEach(e => {
      const srcInf = state.get(e.source) || 0;
      const tgtNode = nodes.find(n => n.id === e.target);
      const res = tgtNode?.resistance || 0.3;
      // Transmission flux = source infection * transmission coefficient * (1 - target resistance)
      const flux = srcInf * 0.48 * (1 - res);
      edgeFluxes[`${e.source}->${e.target}`] = flux;
    });

    let activePhase = 'PHASE 1: INCEPTION & FRINGE SEEDING';
    let phaseClass = 'badge-disinfo';
    if (h >= 36) {
      activePhase = 'PHASE 5: INSTITUTIONAL CLASHES & DECAY';
      phaseClass = 'badge-intel';
    } else if (h >= 24) {
      activePhase = 'PHASE 4: MAINSTREAM MEDIA LAUNDERING';
      phaseClass = 'badge-intel';
    } else if (h >= 12) {
      activePhase = 'PHASE 3: BRIDGE INFLUENCER CASCADE';
      phaseClass = 'badge-suspicion';
    } else if (h >= 4) {
      activePhase = 'PHASE 2: BOTNET SWARM AMPLIFICATION';
      phaseClass = 'badge-disinfo';
    }

    // Match empirical timeline active vectors if present
    const timelineStep = diffusionTimeline.find(step => step.t_hours === h);
    const activeVectors = timelineStep?.activeVectors || 
      (h < 4 ? ['Fringe Telegram', 'Encrypted Pastes'] :
       h < 12 ? ['Botnet Clusters', 'Automated Microblogs'] :
       h < 24 ? ['High-Reach Bridge Influencers', 'Community Forums'] :
       h < 36 ? ['Mainstream Broadcast News', 'Algorithmic Trending Feeds'] :
       ['Regulatory Attestation Desks', 'Truth Sandwich Briefings']);

    const velocitySharesPerHour = Math.round(
      timelineStep?.velocitySharesPerHour || 
      (h < 4 ? 250 + h * 400 :
       h < 12 ? 2000 + (h - 4) * 4500 :
       h < 24 ? 38000 + (h - 12) * 1200 :
       h < 36 ? 48000 - (h - 24) * 2500 :
       Math.max(1200, 18000 - (h - 36) * 1400))
    );

    snapshots.push({
      hour: h,
      nodeInfections: { ...nodeInfections },
      edgeFluxes,
      cumulativeReach: Math.round(cumulativeReach),
      velocitySharesPerHour,
      botnetActivityPct: totalInfection > 0 ? Math.round((botnetInfection / totalInfection) * 100) : 0,
      activeVectors,
      activePhase,
      phaseClass
    });

    // Advance to next hour step (h -> h+1)
    if (h < maxHours) {
      const nextState = new Map();
      nodes.forEach(n => {
        const currentInf = state.get(n.id) || 0;
        let inboundFlux = 0;
        edges.filter(e => e.target === n.id).forEach(e => {
          inboundFlux += edgeFluxes[`${e.source}->${e.target}`] || 0;
        });

        // Contagion differential: new exposure
        const newExposure = (1 - currentInf) * (1 - Math.exp(-inboundFlux));

        // Natural decay and institutional countermeasures
        let decay = 0.015;
        if (h >= 20) decay += 0.04;
        if (h >= 32) decay += 0.06;

        // Regulatory direct refutation links exert strong dampening
        const refutations = edges.filter(e => e.target === n.id && e.type === 'Direct Refutation');
        refutations.forEach(e => {
          const institutionalInf = state.get(e.source) || 0;
          if (institutionalInf > 0.3) {
            decay += 0.15 * institutionalInf;
          }
        });

        const nextInf = Math.min(1.0, Math.max(0.0, currentInf + newExposure - decay * currentInf));
        nextState.set(n.id, nextInf);
      });

      nodes.forEach(n => {
        state.set(n.id, nextState.get(n.id));
      });
    }
  }

  return snapshots;
}

export const NarrativeModule = {
  _app: null,
  _timer: null,
  _currentTime: 12,
  _isPlaying: false,
  _campaigns: [],
  _activeCampaign: null,
  _simulation: [],

  async init(app) {
    this._app = app;
    await this._loadData();
    this._runSimulation();
    this._bindEvents();
    console.log('[NarrativeModule] Initialized with real contagion diffusion physics.');
  },

  async _loadData() {
    try {
      const res = await (typeof fetch !== 'undefined' ? fetch('data/narratives.json').catch(() => null) : null);
      if (res && res.ok) {
        this._campaigns = await res.json();
      } else {
        this._campaigns = FALLBACK_NARRATIVES;
      }
    } catch (e) {
      this._campaigns = FALLBACK_NARRATIVES;
    }
    this._activeCampaign = this._campaigns[0] || FALLBACK_NARRATIVES[0];
  },

  _runSimulation() {
    if (!this._activeCampaign) return;
    this._simulation = simulateContagionDiffusion(
      this._activeCampaign.topologyGraph,
      this._activeCampaign.diffusionTimeline,
      48
    );
  },

  onMount() {
    this._bindCampaignButtons();
    this.updateTimeline(this._currentTime);
  },

  onUnmount() {
    this.stopPlayback();
  },

  _bindCampaignButtons() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.narrative-campaign-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const campaignId = btn.getAttribute('data-campaign-id');
        this.selectCampaign(campaignId);
      });
    });
  },

  selectCampaign(campaignId) {
    const found = this._campaigns.find(c => c.id === campaignId);
    if (!found) return;
    this._activeCampaign = found;
    this._runSimulation();

    if (typeof document !== 'undefined') {
      document.querySelectorAll('.narrative-campaign-btn').forEach(btn => {
        const isMatch = btn.getAttribute('data-campaign-id') === campaignId;
        btn.classList.toggle('btn-primary', isMatch);
        btn.classList.toggle('btn-outline', !isMatch);
      });
    }

    this.updateTimeline(this._currentTime);
    this._app?.showToast({
      type: 'info',
      title: 'CAMPAIGN LOADED',
      message: `Active narrative topology: ${found.title}`
    });
  },

  _bindEvents() {
    if (typeof document === 'undefined') return;
    const slider = document.getElementById('slider-narrative-timeline');
    const btnPlay = document.getElementById('btn-timeline-play');
    const btnPause = document.getElementById('btn-timeline-pause');

    if (slider) {
      slider.addEventListener('input', () => {
        this.stopPlayback();
        this._currentTime = parseInt(slider.value, 10);
        this.updateTimeline(this._currentTime);
      });
    }

    if (btnPlay) {
      btnPlay.addEventListener('click', () => this.startPlayback());
    }

    if (btnPause) {
      btnPause.addEventListener('click', () => this.stopPlayback());
    }

    // Modal node inspection delegation on SVG
    const svg = document.getElementById('narrative-svg-canvas');
    if (svg) {
      svg.addEventListener('click', (e) => {
        const nodeTarget = e.target.closest('[data-node-id]');
        if (nodeTarget) {
          const nodeId = nodeTarget.getAttribute('data-node-id');
          this.inspectNode(nodeId);
        }
      });
    }
  },

  inspectNode(nodeId) {
    if (typeof document === 'undefined' || !this._activeCampaign) return;
    const graph = this._activeCampaign.topologyGraph;
    const node = graph?.nodes?.find(n => n.id === nodeId);
    if (!node) return;

    const snapshot = this._simulation[this._currentTime] || {};
    const inf = snapshot.nodeInfections ? (snapshot.nodeInfections[nodeId] || 0) : 0;
    const infPct = Math.round(inf * 100);

    const titleEl = document.getElementById('inspector-node-title');
    if (titleEl) titleEl.textContent = `${node.label} [${node.type.toUpperCase()}]`;

    const descEl = document.getElementById('inspector-node-desc');
    if (descEl) {
      descEl.textContent = `Contagion saturation: ${infPct}% | Estimated Reach: ${node.reach.toLocaleString()} nodes | Cognitive Resistance: ${Math.round((node.resistance || 0.3) * 100)}%.\nRole: ${node.type} in coordinated narrative diffusion.`;
    }

    const ipEl = document.getElementById('inspector-node-ip');
    if (ipEl) {
      const fakeIps = {
        'n1-fringe-origin': '198.51.100.42 (Anonymous VPN Exit Node)',
        'n2-botnet-cluster': 'AS13335 C2 Botnet Swarm (Distributed 1,200 Proxies)',
        'n3-reddit-rwallstreet': 'Public Web Forum Cluster (Social Bridge)',
        'n4-fintech-influencer': 'Verified Creator CDN (Hyper-Partisan Bridge)',
        'n5-cable-news': 'Broadcast News Syndication Wire (Institutional Laundering)',
        'n6-regulator-desk': 'Federal Regulatory Attestation Authority (Hardened Core)'
      };
      ipEl.textContent = fakeIps[nodeId] || '192.0.2.88 (Network Ingestion Point)';
    }

    // Countermeasure recommendation for current time
    const remedyEl = document.getElementById('inspector-node-remedy');
    if (remedyEl && this._activeCampaign.countermeasureWindows) {
      const window = this._activeCampaign.countermeasureWindows.find(w => {
        if (this._currentTime <= 4 && w.timeframe.includes('T+0h')) return true;
        if (this._currentTime > 4 && this._currentTime <= 12 && w.timeframe.includes('T+4h')) return true;
        if (this._currentTime > 12 && w.timeframe.includes('T+12h')) return true;
        return false;
      }) || this._activeCampaign.countermeasureWindows[0];

      if (window) {
        remedyEl.textContent = `[${window.interventionType}] (${window.effectivenessRating}): ${window.recommendedAction}`;
      }
    }

    // Open Modal
    const modal = document.getElementById('modal-node-inspector');
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }
  },

  startPlayback() {
    if (this._isPlaying) return;
    this._isPlaying = true;
    const btnPlay = document.getElementById('btn-timeline-play');
    if (btnPlay) btnPlay.classList.add('active');

    this._timer = setInterval(() => {
      this._currentTime = (this._currentTime + 1) % 49;
      const slider = document.getElementById('slider-narrative-timeline');
      if (slider) slider.value = this._currentTime;
      this.updateTimeline(this._currentTime);
    }, 450);

    this._app?.showToast({ type: 'info', title: 'SIMULATION RUNNING', message: 'Playing 48h mathematical contagion diffusion.' });
  },

  stopPlayback() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._isPlaying = false;
    const btnPlay = document.getElementById('btn-timeline-play');
    if (btnPlay) btnPlay.classList.remove('active');
  },

  updateTimeline(hours) {
    if (this._simulation.length === 0) {
      this._runSimulation();
    }
    const snapshot = this._simulation[hours] || this._simulation[0];
    if (!snapshot) return;

    if (typeof document === 'undefined') return;

    const timeLabel = document.getElementById('narrative-time-label');
    const phaseBadge = document.getElementById('narrative-phase-badge');
    const svg = document.getElementById('narrative-svg-canvas');

    if (timeLabel) timeLabel.textContent = `T+${hours}h`;

    if (phaseBadge) {
      phaseBadge.textContent = snapshot.activePhase;
      phaseBadge.className = `badge ${snapshot.phaseClass}`;
    }

    // Update Live Global Contagion Telemetry HUD
    const elReach = document.getElementById('narrative-stat-reach');
    if (elReach) elReach.textContent = `${snapshot.cumulativeReach.toLocaleString()} users`;

    const elVel = document.getElementById('narrative-stat-velocity');
    if (elVel) elVel.textContent = `${snapshot.velocitySharesPerHour.toLocaleString()} shares/hr`;

    const elBot = document.getElementById('narrative-stat-botnet');
    if (elBot) elBot.textContent = `${snapshot.botnetActivityPct}% botnet`;

    const elVec = document.getElementById('narrative-stat-vectors');
    if (elVec && snapshot.activeVectors) {
      elVec.textContent = snapshot.activeVectors.join(' • ');
    }

    // Dynamic Multi-Tier Topology Graph SVG Rendering
    if (svg && this._activeCampaign) {
      const graph = this._activeCampaign.topologyGraph;
      if (!graph || !graph.nodes) return;

      const nodes = graph.nodes;
      const edges = graph.edges || [];
      const nodeInfections = snapshot.nodeInfections || {};
      const edgeFluxes = snapshot.edgeFluxes || {};

      // Tier assignments and layout coordinates
      const tierColumns = {
        tier1: { x: 100, label: '01 // ORIGIN SEED' },
        tier2: { x: 300, label: '02 // BOT SWARM' },
        tier3: { x: 520, label: '03 // BRIDGE HUB' },
        tier4: { x: 710, label: '04 // MAINSTREAM' }
      };

      const categorized = { tier1: [], tier2: [], tier3: [], tier4: [] };
      nodes.forEach(n => {
        if (n.type === 'Seeder' || n.type === 'Seed' || n.id.includes('seed') || n.id.includes('origin')) {
          categorized.tier1.push(n);
        } else if (n.type === 'Amplifier' || n.type === 'Botnet' || n.id.includes('bot')) {
          categorized.tier2.push(n);
        } else if (n.type === 'Bridge' || n.type === 'Influencer' || n.type === 'Social' || n.id.includes('influencer') || n.id.includes('reddit')) {
          categorized.tier3.push(n);
        } else {
          categorized.tier4.push(n);
        }
      });

      // Ensure every tier has at least fallback placement if categorization differs
      if (categorized.tier1.length === 0 && nodes[0]) categorized.tier1.push(nodes[0]);
      if (categorized.tier4.length === 0 && nodes[nodes.length - 1]) categorized.tier4.push(nodes[nodes.length - 1]);

      const nodeCoords = new Map();
      Object.entries(categorized).forEach(([tierKey, tierNodes]) => {
        const colX = tierColumns[tierKey].x;
        const count = tierNodes.length;
        tierNodes.forEach((n, idx) => {
          const y = 110 + (idx + 0.5) * (230 / Math.max(1, count));
          nodeCoords.set(n.id, { x: colX, y, node: n });
        });
      });

      // Compute tier aggregate infection for headers
      const getTierAvg = (tNodes) => {
        if (!tNodes || tNodes.length === 0) return 0;
        const sum = tNodes.reduce((acc, n) => acc + (nodeInfections[n.id] || 0), 0);
        return Math.round((sum / tNodes.length) * 100);
      };

      // Build SVG elements
      let svgContent = `
        <defs>
          <linearGradient id="narrative-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="var(--disinfo-crimson)" stop-opacity="0.85"/>
            <stop offset="50%" stop-color="var(--suspicion-amber)" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="var(--intel-cyan)" stop-opacity="0.85"/>
          </linearGradient>
        </defs>
      `;

      // Tier Column Headers
      Object.entries(tierColumns).forEach(([tierKey, col]) => {
        const avg = getTierAvg(categorized[tierKey]);
        svgContent += `
          <text x="${col.x}" y="36" text-anchor="middle" fill="var(--parchment-muted)" font-size="11" font-family="var(--font-mono)">${col.label}</text>
          <text x="${col.x}" y="52" text-anchor="middle" fill="${avg > 50 ? 'var(--disinfo-crimson)' : 'var(--parchment-bright)'}" font-size="9" font-family="var(--font-mono)">INFECTION: ${avg}%</text>
        `;
      });

      // Render Edges
      edges.forEach(e => {
        const src = nodeCoords.get(e.source);
        const tgt = nodeCoords.get(e.target);
        if (!src || !tgt) return;

        const flux = edgeFluxes[`${e.source}->${e.target}`] || 0;
        const isRefutation = e.type === 'Direct Refutation';
        const isHighFlux = flux > 0.08;

        const strokeColor = isRefutation ? 'var(--intel-cyan)' :
                            isHighFlux ? 'url(#narrative-line-grad)' :
                            'rgba(148, 163, 184, 0.25)';
        const strokeWidth = isRefutation ? 2.0 : isHighFlux ? Math.min(4.5, 1.5 + flux * 5.0) : 1.2;
        const dashArray = isHighFlux ? (hours % 2 === 0 ? '6 3' : '3 6') : isRefutation ? '4 4' : 'none';
        const opacity = Math.min(1.0, Math.max(0.2, isRefutation ? 0.8 : flux * 2.0 + 0.25));

        svgContent += `
          <line x1="${src.x}" y1="${src.y}" x2="${tgt.x}" y2="${tgt.y}"
                stroke="${strokeColor}" stroke-width="${strokeWidth.toFixed(1)}"
                stroke-dasharray="${dashArray}" opacity="${opacity.toFixed(2)}"/>
        `;
      });

      // Render Nodes
      nodes.forEach(n => {
        const coord = nodeCoords.get(n.id);
        if (!coord) return;

        const inf = nodeInfections[n.id] || 0;
        const radius = 16 + inf * 10;
        const fillColor = inf >= 0.55 ? 'var(--disinfo-crimson)' :
                          inf >= 0.20 ? 'var(--suspicion-amber)' :
                          '#1e293b';
        const strokeColor = inf >= 0.55 ? '#f87171' :
                            inf >= 0.20 ? '#fbbf24' :
                            '#475569';
        const isPulsing = inf >= 0.40;
        const pulseClass = isPulsing ? 'animate-pulse' : '';

        // Truncate label for clean display
        const displayLabel = n.label.length > 20 ? n.label.substring(0, 18) + '…' : n.label;

        svgContent += `
          <g class="card-clickable" data-node-id="${esc(n.id)}" style="cursor:pointer;">
            <circle cx="${coord.x}" cy="${coord.y}" r="${radius.toFixed(1)}"
                    fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5"
                    class="${pulseClass}" opacity="0.95"/>
            <text x="${coord.x}" y="${coord.y + 4}" text-anchor="middle" fill="#ffffff" font-size="9" font-family="var(--font-mono)" font-weight="bold">${Math.round(inf * 100)}%</text>
            <text x="${coord.x}" y="${coord.y + radius + 14}" text-anchor="middle" fill="var(--parchment-bright)" font-size="9" font-family="var(--font-mono)">${esc(displayLabel)}</text>
          </g>
        `;
      });

      svg.innerHTML = svgContent;
    }
  }
};
