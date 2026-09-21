/**
 * SOVEREIGN // AEGIS — Richards J. Heuer ACH Matrix Lab Module
 * Analysis of Competing Hypotheses, Mathematical Inconsistency Scoring, Dynamic Re-ranking
 */

import { esc } from '../security.js';
import { recordAttempt, CONTEXTS } from '../attempts.js';
export class AchEngine {
  /**
   * Calculates Richards Heuer inconsistency score I(H_j) for a given hypothesis.
   * I(H_j) = sum( max(0, -R_ij) * W_i )
   * where W_i = max(0, w_cred) * max(0, w_rel)
   */
  static calculateInconsistency(hypothesisId, evidenceList = [], ratingsMatrix = {}) {
    let inconsistency = 0;
    for (const ev of evidenceList) {
      const cred = Math.max(0, Math.min(5, ev.credibility ?? 3));
      const rel = Math.max(0, Math.min(5, ev.relevance ?? 3));
      const weight = cred * rel;

      const rawRating = ratingsMatrix[ev.id]?.[hypothesisId] ?? 0;
      const clampedRating = Math.max(-2, Math.min(2, rawRating));

      if (clampedRating < 0) {
        inconsistency += (-clampedRating) * weight;
      }
    }
    return inconsistency;
  }

  /**
   * Calculates supportive evidence score S(H_j) for a given hypothesis.
   * S(H_j) = sum( max(0, R_ij) * W_i )
   */
  static calculateSupport(hypothesisId, evidenceList = [], ratingsMatrix = {}) {
    let support = 0;
    for (const ev of evidenceList) {
      const cred = Math.max(0, Math.min(5, ev.credibility ?? 3));
      const rel = Math.max(0, Math.min(5, ev.relevance ?? 3));
      const weight = cred * rel;

      const rawRating = ratingsMatrix[ev.id]?.[hypothesisId] ?? 0;
      const clampedRating = Math.max(-2, Math.min(2, rawRating));

      if (clampedRating > 0) {
        support += clampedRating * weight;
      }
    }
    return support;
  }

  /**
   * Ranks hypotheses ascending by inconsistency (least contradicted first).
   * Tie-break 1: Descending by support score.
   * Tie-break 2: Lexicographical ID.
   */
  static rankHypotheses(hypotheses = [], evidenceList = [], ratingsMatrix = {}) {
    const scored = hypotheses.map(h => {
      const hId = typeof h === 'string' ? h : h.id;
      const hName = typeof h === 'object' ? (h.name || h.title || hId) : hId;
      const inconsistency = this.calculateInconsistency(hId, evidenceList, ratingsMatrix);
      const support = this.calculateSupport(hId, evidenceList, ratingsMatrix);
      return {
        id: hId,
        name: hName,
        inconsistency,
        support,
        rawHypothesis: h
      };
    });

    scored.sort((a, b) => {
      if (a.inconsistency !== b.inconsistency) {
        return a.inconsistency - b.inconsistency;
      }
      if (a.support !== b.support) {
        return b.support - a.support;
      }
      return a.id.localeCompare(b.id);
    });

    return scored.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }

  /**
   * Computes 5-axis quantified epistemic confidence score.
   * Formula: Confidence = 100 * (0.25*Sr + 0.25*Cc + 0.25*Cb + 0.15*Tf + 0.10*Ap) * P_contra
   * where Tf = exp(-0.02 * ageHours), P_contra = max(0.1, 1.0 - 0.15 * contradictions)
   */
  static computeConfidence(factors = {}) {
    const sr = Math.max(0, Math.min(1, factors.sourceReliability ?? 0.8));
    const cc = Math.max(0, Math.min(1, factors.contentCredibility ?? 0.8));
    const cb = Math.max(0, Math.min(1, factors.corroboration ?? 0.8));
    const ageHours = Math.max(0, factors.ageHours ?? 0);
    const tf = Math.exp(-0.02 * ageHours);
    const ap = Math.max(0, Math.min(1, factors.analyticalPeerReview ?? 0.8));

    const baseWeightedSum = (0.25 * sr) + (0.25 * cc) + (0.25 * cb) + (0.15 * tf) + (0.10 * ap);

    const contradictions = Math.max(0, factors.contradictions ?? 0);
    const pContra = Math.max(0.1, 1.0 - (0.15 * contradictions));

    const rawScore = 100 * baseWeightedSum * pContra;
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

    let label = 'Unlikely';
    if (finalScore >= 85) label = 'Almost Certain';
    else if (finalScore >= 70) label = 'Highly Likely';
    else if (finalScore >= 55) label = 'Likely';
    else if (finalScore >= 40) label = 'Roughly Even Chance';
    else if (finalScore >= 20) label = 'Unlikely';
    else label = 'Remote';

    return {
      score: finalScore,
      label,
      breakdown: {
        sourceReliability: sr,
        contentCredibility: cc,
        corroboration: cb,
        temporalFreshness: tf,
        analyticalPeerReview: ap,
        contradictionPenalty: pContra,
        baseSum: baseWeightedSum
      }
    };
  }
}

export const AchModule = {
  _app: null,
  _activeCase: 'case-1',
  _cases: {
    'case-1': {
      title: 'Critical Infrastructure Cyber Intrusion',
      hypotheses: [
        { id: 'H1', name: 'State-Sponsored Unit' },
        { id: 'H2', name: 'Rogue Insider' },
        { id: 'H3', name: 'False Flag Actor' }
      ],
      evidence: [
        { id: 'E1', description: 'Zero-day exploit used in initial breach', credibility: 5, relevance: 5 },
        { id: 'E2', description: 'Infrastructure logs wiped via insider credentials', credibility: 4, relevance: 4 },
        { id: 'E3', description: 'Code comments written in localized regional dialect', credibility: 3, relevance: 4 }
      ],
      matrix: {
        E1: { H1: 2, H2: -2, H3: 1 },
        E2: { H1: 1, H2: 2, H3: 0 },
        E3: { H1: 1, H2: -1, H3: 2 }
      }
    },
    'case-2': {
      title: 'Leaked Ministerial Audio Authenticity',
      hypotheses: [
        { id: 'H1', name: 'AI Voice Clone Synthesis' },
        { id: 'H2', name: 'Compromised Account + Recycled Audio' },
        { id: 'H3', name: 'Authentic Leak from Whistleblower' }
      ],
      evidence: [
        { id: 'E1', description: 'High-frequency spectral acoustic jitter detected', credibility: 5, relevance: 5 },
        { id: 'E2', description: 'Minister had public speech with identical phrase 6mo ago', credibility: 4, relevance: 4 },
        { id: 'E3', description: 'Metadata timestamp predates official cabinet meeting', credibility: 4, relevance: 5 }
      ],
      matrix: {
        E1: { H1: 2, H2: -2, H3: -2 },
        E2: { H1: 1, H2: 2, H3: -1 },
        E3: { H1: 2, H2: 1, H3: -2 }
      }
    },
    'case-3': {
      title: 'Coordinated Disinformation Campaign',
      hypotheses: [
        { id: 'H1', name: 'Automated Botnet Swarm' },
        { id: 'H2', name: 'Organic Viral Outrage' },
        { id: 'H3', name: 'Commercial Astroturfing PR Firm' }
      ],
      evidence: [
        { id: 'E1', description: '840 accounts created in same 15-minute window', credibility: 5, relevance: 5 },
        { id: 'E2', description: 'Identical punctuation and formatting typos across 300+ posts', credibility: 4, relevance: 5 },
        { id: 'E3', description: 'Geographic posting cluster coincides with local election rally', credibility: 3, relevance: 3 }
      ],
      matrix: {
        E1: { H1: 2, H2: -2, H3: 2 },
        E2: { H1: 2, H2: -2, H3: 1 },
        E3: { H1: 0, H2: 2, H3: 1 }
      }
    }
  },

  async init(app) {
    this._app = app;
    this._bindEvents();
    await this._loadScenarios();
    console.log('[AchModule] Initialized.');
  },

  async _loadScenarios() {
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('data/scenarios.json');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.achCases)) {
            for (const c of data.achCases) {
              this._cases[c.id] = {
                title: c.caseTitle || c.title,
                description: c.description || '',
                hypotheses: (c.hypotheses || []).map(h => ({
                  id: h.id,
                  name: h.name,
                  description: h.description || ''
                })),
                evidence: (c.evidenceList || c.evidence || []).map(e => ({
                  id: e.id,
                  description: e.description || '',
                  credibility: e.credibility ?? 4,
                  relevance: e.relevance ?? 4
                })),
                matrix: JSON.parse(JSON.stringify(c.defaultMatrix || c.matrix || {}))
              };
            }
            this._updateCaseDropdown();
            if (document.getElementById('ach-matrix-table')) {
              this.renderMatrix();
              this.recomputeRankings();
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AchModule] scenarios.json fetch failed, retaining offline defaults:', err);
    }
  },

  _updateCaseDropdown() {
    const selectCase = document.getElementById('select-ach-case');
    if (!selectCase) return;
    const currentVal = selectCase.value || this._activeCase;
    let html = '';
    for (const [caseId, caseData] of Object.entries(this._cases)) {
      html += `<option value="${esc(caseId)}" ${caseId === currentVal ? 'selected' : ''}>${esc(caseData.title)}</option>`;
    }
    selectCase.innerHTML = html;
  },

  onMount() {
    this._updateCaseDropdown();
    this.renderMatrix();
    this.recomputeRankings();
  },

  _bindEvents() {
    const selectCase = document.getElementById('select-ach-case');
    const btnRecompute = document.getElementById('btn-recompute-ach');
    const btnAddHyp = document.getElementById('btn-add-hypothesis');
    const btnAddEv = document.getElementById('btn-add-evidence');

    if (selectCase) {
      selectCase.addEventListener('change', () => {
        this._activeCase = selectCase.value;
        this.renderMatrix();
        this.recomputeRankings();
        this._app?.showToast({ type: 'info', title: 'ACH CASE LOADED', message: `Loaded ${this._cases[this._activeCase]?.title}` });
      });
    }

    if (btnRecompute) {
      btnRecompute.addEventListener('click', () => {
        this.recomputeRankings();
        this._app?.showToast({ type: 'success', title: 'ACH COMPUTED', message: 'Mathematical inconsistency rankings updated.' });
      });
    }

    if (btnAddHyp) {
      btnAddHyp.addEventListener('click', () => {
        const name = prompt('Enter New Hypothesis Title:');
        if (name && name.trim()) {
          const current = this._cases[this._activeCase];
          const newId = `H${current.hypotheses.length + 1}`;
          current.hypotheses.push({ id: newId, name: name.trim() });
          for (const ev of current.evidence) {
            current.matrix[ev.id][newId] = 0;
          }
          this.renderMatrix();
          this.recomputeRankings();
        }
      });
    }

    if (btnAddEv) {
      btnAddEv.addEventListener('click', () => {
        const desc = prompt('Enter New Evidence Description:');
        if (desc && desc.trim()) {
          const current = this._cases[this._activeCase];
          const newId = `E${current.evidence.length + 1}`;
          current.evidence.push({ id: newId, description: desc.trim(), credibility: 4, relevance: 4 });
          current.matrix[newId] = {};
          for (const h of current.hypotheses) {
            current.matrix[newId][h.id] = 0;
          }
          this.renderMatrix();
          this.recomputeRankings();
        }
      });
    }
  },

  cycleRating(evId, hypId) {
    const current = this._cases[this._activeCase];
    const val = current.matrix[evId]?.[hypId] ?? 0;
    // Cycle: 2 (++ Consistent) -> 1 (+ Consistent) -> 0 (Neutral) -> -1 (- Inconsistent) -> -2 (-- Inconsistent) -> 2
    const nextMap = { 2: 1, 1: 0, 0: -1, '-1': -2, '-2': 2 };
    const nextVal = nextMap[val] ?? 0;
    if (!current.matrix[evId]) current.matrix[evId] = {};
    current.matrix[evId][hypId] = nextVal;
    this.renderMatrix();
    this.recomputeRankings();
  },

  renderMatrix() {
    const table = document.getElementById('ach-matrix-table');
    if (!table) return;

    const current = this._cases[this._activeCase];
    if (!current) return;

    let theadHtml = `
      <tr>
        <th style="min-width: 250px;">Evidence Item (E_i)</th>
        <th>Weight (w)</th>
    `;
    for (const h of current.hypotheses) {
      theadHtml += `<th>${esc(h.id)}: ${esc(h.name)}</th>`;
    }
    theadHtml += `</tr>`;

    let tbodyHtml = '';
    for (const ev of current.evidence) {
      const weight = (ev.credibility || 3) * (ev.relevance || 3);
      tbodyHtml += `
        <tr>
          <td><strong>${esc(ev.id)}:</strong> ${esc(ev.description)}</td>
          <td><span class="badge badge-bronze">W=${esc(weight)}</span></td>
      `;
      for (const h of current.hypotheses) {
        const rating = current.matrix[ev.id]?.[h.id] ?? 0;
        let badgeClass = 'badge-neutral';
        let label = '0 (Neutral)';
        if (rating === 2) { badgeClass = 'badge-veracity'; label = '++ (Consistent)'; }
        else if (rating === 1) { badgeClass = 'badge-suspicion'; label = '+ (Consistent)'; }
        else if (rating === -1) { badgeClass = 'badge-disinfo'; label = '- (Inconsistent)'; }
        else if (rating === -2) { badgeClass = 'badge-disinfo'; label = '-- (Inconsistent)'; }

        tbodyHtml += `
          <td>
            <span class="badge ${esc(badgeClass)} card-clickable" style="cursor:pointer;" data-aegis-action="ach-cycle" data-aegis-evidence="${esc(ev.id)}" data-aegis-hypothesis="${esc(h.id)}" title="Click to cycle rating">
              ${esc(label)}
            </span>
          </td>
        `;
      }
      tbodyHtml += `</tr>`;
    }

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (thead) thead.innerHTML = theadHtml;
    if (tbody) tbody.innerHTML = tbodyHtml;
  },

  recomputeRankings() {
    const current = this._cases[this._activeCase];
    if (!current) return;

    const rankings = AchEngine.rankHypotheses(current.hypotheses, current.evidence, current.matrix);
    const container = document.getElementById('ach-rankings-grid');
    if (!container) return;

    const rank1 = rankings.find(r => r.rank === 1) || rankings[0];
    let conf = null;

    if (rank1) {
      let totalCred = 0, posCount = 0, negCount = 0, ratedCount = 0;
      for (const ev of current.evidence) {
        const rating = current.matrix[ev.id]?.[rank1.id] ?? 0;
        if (rating > 0) {
          posCount++;
          totalCred += (ev.credibility ?? 4);
          ratedCount++;
        } else if (rating < 0) {
          negCount++;
          ratedCount++;
        }
      }
      const sourceRel = posCount > 0 ? (totalCred / posCount) / 5.0 : 0.75;
      const contentCred = ratedCount > 0 ? posCount / ratedCount : 0.75;
      const corroboration = Math.min(1.0, Math.max(0.2, posCount / 2.0));

      conf = AchEngine.computeConfidence({
        sourceReliability: sourceRel,
        contentCredibility: contentCred,
        corroboration: corroboration,
        ageHours: 0,
        analyticalPeerReview: 0.85,
        contradictions: negCount
      });
    }

    let html = '';
    for (const item of rankings) {
      let borderCol = 'var(--veracity-green)';
      let labelClass = 'text-emerald';
      let rankText = 'MOST PROBABLE (LEAST CONTRADICTED)';
      let fillClass = 'progress-fill-emerald';

      if (item.rank === 2) {
        borderCol = 'var(--suspicion-amber)';
        labelClass = 'text-amber';
        rankText = 'PLAUSIBLE ALTERNATIVE';
        fillClass = 'progress-fill-cyan';
      } else if (item.rank >= 3) {
        borderCol = 'var(--disinfo-crimson)';
        labelClass = 'text-crimson';
        rankText = 'HIGHLY DISPROVED';
        fillClass = 'progress-fill-crimson';
      }

      const barWidth = Math.max(10, Math.min(95, 100 - item.inconsistency * 1.5));

      let rank1ExtraHtml = '';
      if (item.rank === 1 && conf) {
        rank1ExtraHtml = `
          <div class="card-granite-inset" style="padding: 10px; margin-top: 10px; border-left: 3px solid var(--bronze-light);">
            <div class="status-label text-bronze" style="font-size: 0.7rem;">ICD 203 ESTIMATIVE CERTAINTY:</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
              <span style="font-weight:700; color:var(--parchment-bright); font-size:0.88rem;">${esc(conf.label.toUpperCase())}</span>
              <span class="badge badge-bronze">${conf.score.toFixed(1)}% CONFIDENCE</span>
            </div>
            <div style="font-size:0.75rem; color:var(--stone-light); margin-top:4px;">
              5-Axis: Source Rel ${(conf.breakdown.sourceReliability * 100).toFixed(0)}% · Corroboration ${(conf.breakdown.corroboration * 100).toFixed(0)}% · Contradiction Penalty ×${conf.breakdown.contradictionPenalty.toFixed(2)}
            </div>
          </div>
        `;
      }

      html += `
        <div class="card card-granite-inset" style="border-top: 3px solid ${esc(borderCol)};">
          <div class="status-label ${esc(labelClass)}">RANK ${esc(item.rank)}: ${esc(rankText)}</div>
          <h4 class="heading-4" style="margin: var(--space-2) 0;">${esc(item.id)}: ${esc(item.name)}</h4>
          <div class="flex-row-gap" style="justify-content: space-between; margin-bottom: 4px;">
            <span class="body-muted">Inconsistency Score:</span>
            <span class="status-label ${esc(labelClass)}">${item.inconsistency.toFixed(1)}${esc(item.rank === 1 ? ' (Lowest)' : '')}</span>
          </div>
          <div class="flex-row-gap" style="justify-content: space-between; margin-bottom: 8px;">
            <span class="body-muted">Support Score:</span>
            <span class="status-label text-bronze">${item.support.toFixed(1)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${esc(fillClass)}" style="width: ${esc(barWidth)}%;"></div>
          </div>
          ${rank1ExtraHtml}
        </div>
      `;
    }
    container.innerHTML = html;

    // Record attempt to AttemptLog & dispatch completion event
    if (conf) {
      try {
        recordAttempt({
          skillIds: ['skill.bias.confirmation'],
          itemId: this._activeCase,
          correct: true,
          context: CONTEXTS.FORENSICS,
          confidence: conf.score >= 70 ? 'sure' : (conf.score >= 40 ? 'unsure' : 'guess')
        });
      } catch (err) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aegis:ach-complete', {
          detail: {
            caseId: this._activeCase,
            rankings,
            confidence: conf
          }
        }));
      }
    }
  }
};
