/**
 * SOVEREIGN // AEGIS — Decentralized Identity & Cryptographic Signer Module
 * WebCrypto ECDSA P-256 Keys, Statement Signer, Signature Verifier, W3C JSON-LD VCs,
 * and Cryptographic Competency Attestations.
 */

import { AegisCrypto } from '../crypto.js';
import { KeyStore } from '../keystore.js';
import { AttemptLog } from '../attemptlog.js';
import { esc } from '../security.js';
import {
  signCompetencyAttestation,
  verifyCompetencyAttestation,
  formatAttestationSummary
} from './attestation.js';

export const IdentityModule = {
  _app: null,
  _inspectedCredential: null,

  init(app) {
    this._app = app;
    this._bindEvents();
    this._bindAttestationEvents();
    console.log('[IdentityModule] Initialized.');
  },

  onMount() {
    this.renderProfile();
    this.renderCredentials();
  },

  /**
   * Resolve the signing handle for the active identity.
   *
   * Preference order:
   *   1. A non-extractable CryptoKey vaulted in IndexedDB (current scheme).
   *   2. A legacy private JWK in localStorage (pre-hardening identities).
   *
   * Legacy keys keep working deliberately — rotating would orphan every credential the
   * operator has already signed and published. `renderProfile()` surfaces a rotation
   * prompt instead, and the choice stays theirs.
   *
   * @returns {Promise<{key: CryptoKey|JsonWebKey, hardened: boolean}|null>}
   * @private
   */
  async _resolveSigningKey() {
    const vaulted = await KeyStore.get();
    if (vaulted && vaulted.privateKey) {
      return { key: vaulted.privateKey, hardened: true };
    }
    const legacyJwk = this._app?.store?.get('identity.privateKeyJwk');
    if (legacyJwk) {
      return { key: legacyJwk, hardened: false };
    }
    // Private browsing / IndexedDB unavailable: the boot keypair lives only in memory
    // for this session.
    if (this._app?._sessionKeyPair && this._app?._sessionKeyPair.privateKey) {
      return { key: this._app._sessionKeyPair.privateKey, hardened: true };
    }
    return null;
  },

  _bindEvents() {
    if (typeof document === 'undefined') return;

    // 1. Generate Keypair
    const btnNewKey = document.getElementById('btn-generate-new-keypair');
    if (btnNewKey) {
      btnNewKey.addEventListener('click', async () => {
        try {
          // Non-extractable by default: the private scalar is never exposed to JS,
          // so it cannot be read out of storage by injected script.
          const generated = await AegisCrypto.generateKeyPair();

          let hardened = false;
          if (KeyStore.isAvailable()) {
            try {
              await KeyStore.put(generated.keyPair);
              hardened = true;
            } catch (e) {
              console.warn('[IdentityModule] Key vault unavailable, key is session-only:', e);
            }
          }

          this._app.store.set('identity.did', generated.did);
          this._app.store.set('identity.publicKeyJwk', generated.publicKeyJwk);
          this._app.store.set('identity.fingerprint', generated.fingerprint);
          this._app.store.set('identity.keyStorage', hardened ? 'indexeddb-nonextractable' : 'session-only');

          // Retire any legacy plaintext private key this identity replaces.
          this._app.store.set('identity.privateKeyJwk', null);

          this.renderProfile();
          this._app.showToast({
            type: 'crypto',
            title: 'NEW KEYPAIR GENERATED',
            message: `Created DID: ${generated.did.slice(0, 22)}...`
          });
        } catch (err) {
          console.error('[IdentityModule] Keypair error:', err);
          this._app?.showToast({ type: 'danger', title: 'KEYPAIR GENERATION FAILED', message: err.message });
        }
      });
    }

    // 2. Sign Statement
    const btnSign = document.getElementById('btn-sign-statement-now');
    const textareaSign = document.getElementById('textarea-sign-statement');
    const outputSig = document.getElementById('signature-output-display');

    if (btnSign && textareaSign && outputSig) {
      btnSign.addEventListener('click', async () => {
        const text = textareaSign.value.trim();
        if (!text) {
          this._app?.showToast({ type: 'warning', title: 'EMPTY STATEMENT', message: 'Please enter a statement to sign.' });
          return;
        }

        const resolved = await this._resolveSigningKey();
        if (!resolved) {
          this._app?.showToast({ type: 'danger', title: 'KEY MISSING', message: 'No private key available in secure store.' });
          return;
        }

        try {
          const statementObj = {
            assertion: text,
            issuer: this._app.store.get('identity.did'),
            timestamp: new Date().toISOString()
          };

          const signature = await AegisCrypto.signStatement(resolved.key, statementObj);
          outputSig.textContent = signature;
          outputSig.style.wordBreak = 'break-all';

          this._app?.showToast({
            type: 'success',
            title: 'STATEMENT SIGNED',
            message: `ECDSA SHA-256 signature generated (${signature.slice(0, 24)}...)`
          });
        } catch (err) {
          console.error('[IdentityModule] Signing error:', err);
          this._app?.showToast({ type: 'danger', title: 'SIGNING FAILED', message: err.message });
        }
      });
    }

    // 3. Verify Signature
    const btnVerify = document.getElementById('btn-verify-signature-now');
    if (btnVerify) {
      btnVerify.addEventListener('click', async () => {
        const payload = document.getElementById('textarea-verify-payload')?.value?.trim() || '';
        const sig = document.getElementById('input-verify-sig')?.value?.trim() || '';
        const pubKeyJwk = this._app.store.get('identity.publicKeyJwk');
        const statementObj = { assertion: payload, issuer: this._app.store.get('identity.did') };
        const isValid = await AegisCrypto.verifyStatement(pubKeyJwk, statementObj, sig);
        this._app?.showToast({
          type: isValid ? 'success' : 'danger',
          title: isValid ? 'SIGNATURE VALID' : 'SIGNATURE INVALID',
          message: isValid ? 'Cryptographic integrity confirmed.' : 'Payload or signature mismatch.'
        });
      });
    }
  },

  /**
   * Bind event listeners for the W3C Verifiable Credential repository and verifier.
   * @private
   */
  _bindAttestationEvents() {
    if (typeof document === 'undefined') return;

    // A. Issue Competency Attestation
    const btnIssue = document.getElementById('btn-issue-competency-attestation');
    if (btnIssue) {
      btnIssue.addEventListener('click', async () => {
        await this._issueAttestation();
      });
    }

    // B. Import Credential File Trigger
    const btnImport = document.getElementById('btn-import-credential');
    const inputImport = document.getElementById('input-import-credential');
    if (btnImport && inputImport) {
      btnImport.addEventListener('click', () => {
        inputImport.click();
      });

      inputImport.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);

          const result = await verifyCompetencyAttestation(parsed);
          if (!result.ok) {
            this._app?.showToast({
              type: 'danger',
              title: 'INVALID CREDENTIAL',
              message: `Verification failed: ${result.reason}`
            });
            inputImport.value = '';
            return;
          }

          const existing = this._app?.store?.get('identity.attestations', []) || [];
          const deduped = [parsed, ...existing.filter(c => c.id !== parsed.id)];
          this._app?.store?.set('identity.attestations', deduped);

          this.renderCredentials();
          this._app?.showToast({
            type: 'success',
            title: 'CREDENTIAL IMPORTED',
            message: `Verified and stored attestation for ${parsed.issuer.slice(0, 22)}...`
          });
        } catch (err) {
          console.error('[IdentityModule] Import error:', err);
          this._app?.showToast({
            type: 'danger',
            title: 'IMPORT ERROR',
            message: err.message || 'Failed to parse credential file.'
          });
        } finally {
          inputImport.value = '';
        }
      });
    }

    // C. Independent Third-Party Verifier Button
    const btnVerifyJson = document.getElementById('btn-verify-credential-json');
    if (btnVerifyJson) {
      btnVerifyJson.addEventListener('click', async () => {
        await this._verifyPastedCredential();
      });
    }

    // D. Credential Actions Delegation (Inspect, Export, Copy)
    const listContainer = document.getElementById('credentials-list-container');
    if (listContainer) {
      listContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const credId = btn.getAttribute('data-credential-id');
        const credentials = this._app?.store?.get('identity.attestations', []) || [];
        const cred = credentials.find(c => c.id === credId);

        if (!cred) return;

        if (action === 'inspect-credential') {
          this._inspectCredential(cred);
        } else if (action === 'export-credential') {
          this._exportCredential(cred);
        } else if (action === 'copy-credential') {
          await this._copyCredential(cred);
        }
      });
    }

    // E. Inspector Modal Actions
    const btnModalCopy = document.getElementById('btn-inspector-copy-json');
    if (btnModalCopy) {
      btnModalCopy.addEventListener('click', async () => {
        if (this._inspectedCredential) {
          await this._copyCredential(this._inspectedCredential);
        }
      });
    }

    const btnModalDownload = document.getElementById('btn-inspector-download-json');
    if (btnModalDownload) {
      btnModalDownload.addEventListener('click', () => {
        if (this._inspectedCredential) {
          this._exportCredential(this._inspectedCredential);
        }
      });
    }
  },

  /**
   * Issues a signed W3C Verifiable Credential attesting to demonstrated competencies.
   * @private
   */
  async _issueAttestation() {
    try {
      const did = this._app?.store?.get('identity.did');
      const publicKeyJwk = this._app?.store?.get('identity.publicKeyJwk');

      if (!did || !publicKeyJwk) {
        this._app?.showToast({
          type: 'danger',
          title: 'IDENTITY MISSING',
          message: 'Please generate a decentralized keypair first.'
        });
        return;
      }

      const resolved = await this._resolveSigningKey();
      if (!resolved) {
        this._app?.showToast({
          type: 'danger',
          title: 'KEY MISSING',
          message: 'No private signing key available in keystore.'
        });
        return;
      }

      // Load attempts and skills catalogue
      const attempts = await AttemptLog.readAll();
      const skills = this._app?._loadSkills ? await this._app._loadSkills() : [];

      const credential = await signCompetencyAttestation(resolved.key, {
        did,
        publicKeyJwk,
        attempts,
        skills,
        options: { minEvidence: 1, includeAllSkills: true }
      });

      const existing = this._app?.store?.get('identity.attestations', []) || [];
      const updated = [credential, ...existing.filter(c => c.id !== credential.id)];
      this._app?.store?.set('identity.attestations', updated);

      this.renderCredentials();
      this._app?.showToast({
        type: 'crypto',
        title: 'ATTESTATION ISSUED',
        message: `Signed W3C Credential (${credential.credentialSubject.summary.skillsAssessed} skills attested)`
      });
    } catch (err) {
      console.error('[IdentityModule] Attestation generation failed:', err);
      this._app?.showToast({
        type: 'danger',
        title: 'ATTESTATION FAILED',
        message: err.message
      });
    }
  },

  /**
   * Verifies credential JSON pasted into the independent verifier textarea.
   * @private
   */
  async _verifyPastedCredential() {
    const textarea = document.getElementById('textarea-verify-credential-json');
    const resultBox = document.getElementById('credential-verification-result');
    if (!textarea || !resultBox) return;

    const raw = textarea.value.trim();
    if (!raw) {
      this._app?.showToast({ type: 'warning', title: 'EMPTY INPUT', message: 'Paste a JSON-LD credential to verify.' });
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const res = await verifyCompetencyAttestation(parsed);

      resultBox.style.display = 'block';

      if (res.ok) {
        const sub = res.credentialSubject;
        const sum = sub.summary || {};
        const cal = sub.calibration || {};

        let tableRows = '';
        for (const c of (sub.competencies || []).slice(0, 10)) {
          const statusClass = c.status === 'mastered' ? 'text-emerald' : (c.status === 'proficient' ? 'text-amber' : 'text-muted');
          tableRows += `
            <tr>
              <td>${esc(c.label)}</td>
              <td>${esc(c.pillar)}</td>
              <td style="text-align:right;">${(c.mastery * 100).toFixed(0)}%</td>
              <td style="text-align:right;">${(c.confidence * 100).toFixed(0)}%</td>
              <td style="text-align:center;"><span class="${statusClass}">${esc(c.status.toUpperCase())}</span></td>
            </tr>
          `;
        }

        resultBox.innerHTML = `
          <div class="flex-row-gap" style="justify-content: space-between; margin-bottom: var(--space-3);">
            <span class="heading-4 text-emerald">✓ CRYPTOGRAPHIC PROOF CONFIRMED</span>
            <span class="badge badge-veracity">ECDSA P-256 VERIFIED</span>
          </div>
          <div class="crypto-hash" style="margin-bottom: var(--space-2); font-size: 0.8rem;">
            Issuer: ${esc(res.did)}
          </div>
          <div class="body-muted" style="font-size: 0.82rem; margin-bottom: var(--space-3);">
            Issued: ${esc(res.issuanceDate)} • Credential ID: ${esc(res.credentialId || 'urn:uuid')}
          </div>
          <div class="grid-split-2-1" style="margin-bottom: var(--space-3); gap: 10px;">
            <div class="card-granite-inset" style="padding: 8px 12px;">
              <div class="metric-label">Competencies Assessed</div>
              <div class="metric-value text-emerald">${sum.skillsAssessed || 0} <span style="font-size:0.9rem;color:var(--stone-light);">/ ${sum.totalCatalogueSkills || 24}</span></div>
              <div class="metric-subtext">Avg Mastery: ${((sum.averageMastery || 0) * 100).toFixed(1)}%</div>
            </div>
            <div class="card-granite-inset" style="padding: 8px 12px;">
              <div class="metric-label">Brier Calibration</div>
              <div class="metric-value text-bronze">${cal.brierScore !== null ? cal.brierScore.toFixed(3) : 'N/A'}</div>
              <div class="metric-subtext">${esc(cal.headline || 'Metacognitive calibration')}</div>
            </div>
          </div>
          ${tableRows ? `
            <div class="table-container" style="max-height: 240px; overflow-y: auto;">
              <table class="data-table" style="font-size: 0.8rem;">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Pillar</th>
                    <th style="text-align:right;">Mastery</th>
                    <th style="text-align:right;">Conf</th>
                    <th style="text-align:center;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
            </div>
          ` : ''}
          <div class="body-muted" style="margin-top: var(--space-3); font-size: 0.78rem;">
            🔒 ${esc(sub.privacyGuarantee || 'Zero raw attempt logs included.')}
          </div>
        `;

        this._app?.showToast({
          type: 'success',
          title: 'VERIFICATION CONFIRMED',
          message: 'Digital signature is mathematically authentic.'
        });
      } else {
        resultBox.innerHTML = `
          <div class="flex-row-gap" style="justify-content: space-between; margin-bottom: var(--space-2);">
            <span class="heading-4 text-crimson">✗ VERIFICATION FAILED</span>
            <span class="badge badge-danger">TAMPER DETECTED</span>
          </div>
          <p class="body-text" style="color: var(--disinfo-crimson); font-size: 0.88rem; margin: 0;">
            ${esc(res.reason || 'Cryptographic signature is invalid or payload has been mutated.')}
          </p>
        `;
        this._app?.showToast({
          type: 'danger',
          title: 'VERIFICATION FAILED',
          message: res.reason || 'Cryptographic signature mismatch.'
        });
      }
    } catch (err) {
      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div class="flex-row-gap" style="margin-bottom: var(--space-2);">
          <span class="heading-4 text-crimson">✗ JSON PARSE ERROR</span>
        </div>
        <p class="body-text" style="color: var(--disinfo-crimson); font-size: 0.88rem; margin: 0;">
          Invalid JSON: ${esc(err.message)}
        </p>
      `;
    }
  },

  /**
   * Opens the Credential Inspector modal with full details.
   * @private
   */
  _inspectCredential(cred) {
    this._inspectedCredential = cred;
    const container = document.getElementById('credential-inspector-content');
    if (!container) return;

    const sub = cred.credentialSubject || {};
    const sum = sub.summary || {};
    const cal = sub.calibration || {};
    const tr = sub.transfer || {};

    let skillRows = '';
    for (const c of sub.competencies || []) {
      const statusClass = c.status === 'mastered' ? 'text-emerald' : (c.status === 'proficient' ? 'text-amber' : 'text-muted');
      skillRows += `
        <tr>
          <td><strong>${esc(c.label)}</strong><br><small class="body-muted">${esc(c.skillId)}</small></td>
          <td>${esc(c.pillar)}</td>
          <td style="text-align:right;">${(c.mastery * 100).toFixed(0)}%</td>
          <td style="text-align:right;">${(c.confidence * 100).toFixed(0)}%</td>
          <td style="text-align:right;">${c.evidenceCount || 0}</td>
          <td style="text-align:center;"><span class="${statusClass}">${esc(c.status.toUpperCase())}</span></td>
        </tr>
      `;
    }

    container.innerHTML = `
      <div class="card card-granite-inset" style="margin-bottom: var(--space-4);">
        <div class="flex-row-gap" style="justify-content: space-between; margin-bottom: 8px;">
          <span class="heading-4 text-bronze">W3C Verifiable Credential Details</span>
          <span class="badge badge-crypto">JSON-LD 2020</span>
        </div>
        <div class="crypto-hash" style="margin-bottom: 4px; font-size: 0.82rem;">
          ID: ${esc(cred.id)}
        </div>
        <div class="crypto-hash" style="margin-bottom: 4px; font-size: 0.82rem;">
          Issuer: ${esc(cred.issuer)}
        </div>
        <div class="body-muted" style="font-size: 0.82rem;">
          Issued At: ${esc(cred.issuanceDate)} • Proof Type: ${esc(cred.proof?.type || 'JsonWebSignature2020')}
        </div>
      </div>

      <div class="grid-split-2-1" style="margin-bottom: var(--space-4); gap: 12px;">
        <div class="card card-granite-inset">
          <div class="status-label">COMPETENCY SUMMARY</div>
          <div class="metric-value text-emerald" style="margin: 4px 0;">${sum.skillsAssessed || 0} <small style="font-size:1rem;color:var(--stone-light);">/ ${sum.totalCatalogueSkills || 24} Skills</small></div>
          <div class="body-muted" style="font-size: 0.82rem;">
            Average Mastery: <strong>${((sum.averageMastery || 0) * 100).toFixed(1)}%</strong><br>
            Total Attempts Evaluated: <strong>${sum.totalAttemptsEvaluated || 0}</strong>
          </div>
        </div>
        <div class="card card-granite-inset">
          <div class="status-label">CALIBRATION & TRANSFER</div>
          <div class="metric-value text-bronze" style="margin: 4px 0;">${cal.brierScore !== null ? cal.brierScore.toFixed(3) : 'N/A'} <small style="font-size:0.8rem;color:var(--stone-light);">Brier</small></div>
          <div class="body-muted" style="font-size: 0.82rem;">
            ${esc(cal.headline || 'No calibration data')}<br>
            ${tr.available ? `Transfer Delta: <strong>${(tr.generalizationDelta * 100).toFixed(1)}%</strong>` : 'Transfer data pending'}
          </div>
        </div>
      </div>

      <h4 class="heading-4" style="margin-bottom: var(--space-2);">Attested Skill Competencies</h4>
      <div class="table-container" style="max-height: 280px; overflow-y: auto; margin-bottom: var(--space-4);">
        <table class="data-table" style="font-size: 0.82rem;">
          <thead>
            <tr>
              <th>Skill Description</th>
              <th>Pillar</th>
              <th style="text-align:right;">Mastery</th>
              <th style="text-align:right;">Certainty</th>
              <th style="text-align:right;">Attempts</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${skillRows}
          </tbody>
        </table>
      </div>

      <h4 class="heading-4" style="margin-bottom: var(--space-2);">Raw W3C JSON-LD Representation</h4>
      <pre style="max-height: 180px; overflow-y: auto; font-size: 0.78rem;"><code>${esc(JSON.stringify(cred, null, 2))}</code></pre>
    `;

    this._app?.openModal('modal-credential-inspector');
  },

  /**
   * Downloads a credential as a JSON file.
   * @private
   */
  _exportCredential(cred) {
    if (typeof document === 'undefined' || !cred) return;
    const jsonStr = JSON.stringify(cred, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competency-attestation-${(cred.id || 'cred').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Copies credential JSON to clipboard.
   * @private
   */
  async _copyCredential(cred) {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !cred) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(cred, null, 2));
      this._app?.showToast({
        type: 'success',
        title: 'COPIED TO CLIPBOARD',
        message: 'W3C JSON-LD credential copied to clipboard.'
      });
    } catch (err) {
      console.warn('[IdentityModule] Clipboard write failed:', err);
    }
  },

  /**
   * Renders the repository of issued and imported credentials.
   */
  async renderCredentials() {
    if (typeof document === 'undefined') return;

    const listContainer = document.getElementById('credentials-list-container');
    const badgeCount = document.getElementById('badge-credential-count');
    if (!listContainer) return;

    const credentials = this._app?.store?.get('identity.attestations', []) || [];
    if (badgeCount) {
      badgeCount.textContent = `${credentials.length} ${credentials.length === 1 ? 'Credential' : 'Credentials'}`;
    }

    if (credentials.length === 0) {
      listContainer.innerHTML = `
        <div class="card card-granite-inset" style="text-align: center; padding: 24px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">📜</div>
          <h4 class="heading-4 text-parchment" style="margin-bottom: 4px;">No Attestations Issued Yet</h4>
          <p class="body-muted" style="max-width: 480px; margin: 0 auto var(--space-3); font-size: 0.85rem;">
            You have not yet generated a signed competency credential. Click <strong>Issue Signed Competency Attestation</strong> above to publish a verifiable proof of your demonstrated skills.
          </p>
        </div>
      `;
      return;
    }

    let cardsHtml = '';
    for (const c of credentials) {
      const sub = c.credentialSubject || {};
      const sum = sub.summary || {};
      const cal = sub.calibration || {};

      // Verify each stored credential
      const verifyResult = await verifyCompetencyAttestation(c);
      const isValid = verifyResult.ok;

      const badgeHtml = isValid
        ? `<span class="badge badge-veracity">✓ CRYPTOGRAPHICALLY VALID</span>`
        : `<span class="badge badge-danger">✗ TAMPER DETECTED</span>`;

      cardsHtml += `
        <div class="card card-granite-inset" style="padding: 16px; border-left: 3px solid ${isValid ? 'var(--emerald-bright, #10b981)' : 'var(--disinfo-crimson, #ef4444)'};">
          <div class="flex-row-gap" style="justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap;">
            <div>
              <span class="heading-4 text-bronze">Competency Attestation</span>
              <div class="body-muted" style="font-size: 0.78rem; margin-top: 2px;">
                Issued: ${esc(c.issuanceDate)} • ID: <span class="crypto-hash" style="display:inline; padding: 2px 4px;">${esc(c.id)}</span>
              </div>
            </div>
            ${badgeHtml}
          </div>

          <div class="crypto-hash" style="margin: 6px 0; font-size: 0.8rem; word-break: break-all;">
            Issuer DID: ${esc(c.issuer)}
          </div>

          <div class="flex-row-gap" style="margin: 10px 0; gap: 16px; flex-wrap: wrap; font-size: 0.82rem;">
            <div>Skills Assessed: <strong class="text-emerald">${sum.skillsAssessed || 0} / ${sum.totalCatalogueSkills || 24}</strong></div>
            <div>Avg Mastery: <strong class="text-emerald">${((sum.averageMastery || 0) * 100).toFixed(1)}%</strong></div>
            <div>Brier Score: <strong class="text-bronze">${cal.brierScore !== null ? cal.brierScore.toFixed(3) : 'N/A'}</strong></div>
            <div>Evaluated Attempts: <strong>${sum.totalAttemptsEvaluated || 0}</strong></div>
          </div>

          <div class="flex-row-gap" style="margin-top: 12px; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm" data-action="inspect-credential" data-credential-id="${esc(c.id)}">
              📜 Inspect Claims
            </button>
            <button class="btn btn-outline btn-sm" data-action="export-credential" data-credential-id="${esc(c.id)}">
              ⭳ Export JSON-LD
            </button>
            <button class="btn btn-outline btn-sm" data-action="copy-credential" data-credential-id="${esc(c.id)}">
              📋 Copy JSON-LD
            </button>
          </div>
        </div>
      `;
    }

    listContainer.innerHTML = cardsHtml;
  },

  renderProfile() {
    if (typeof document === 'undefined') return;

    const didDisplay = document.getElementById('did-full-display');
    const jwkDisplay = document.getElementById('code-public-jwk');

    const did = this._app?.store?.get('identity.did', 'did:key:z6Mku...');
    const jwk = this._app?.store?.get('identity.publicKeyJwk', null);

    if (didDisplay) {
      didDisplay.textContent = did;
    }

    if (jwkDisplay) {
      jwkDisplay.textContent = jwk ? JSON.stringify(jwk, null, 2) : '{"kty":"EC","crv":"P-256"}';
    }

    this._renderKeyStorageNotice();
  },

  /**
   * Surface a rotation prompt for identities still backed by a plaintext private JWK
   * in localStorage. Rendered only when such a key is actually present, so operators
   * on the hardened scheme see no change.
   * @private
   */
  _renderKeyStorageNotice() {
    if (typeof document === 'undefined') return;

    const legacyJwk = this._app?.store?.get('identity.privateKeyJwk');
    const existing = document.getElementById('identity-key-rotation-notice');

    if (!legacyJwk) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const anchor = document.getElementById('did-full-display');
    const host = anchor ? anchor.closest('.card') || anchor.parentElement : null;
    if (!host) return;

    const notice = document.createElement('div');
    notice.id = 'identity-key-rotation-notice';
    notice.className = 'card-granite-inset';
    notice.style.cssText = 'border-left: 3px solid var(--suspicion-amber, #f59e0b); padding: 12px 14px; margin-top: 14px;';

    const label = document.createElement('div');
    label.className = 'status-label';
    label.style.cssText = 'color: var(--suspicion-amber, #f59e0b); margin-bottom: 4px;';
    label.textContent = 'LEGACY KEY STORAGE';

    const body = document.createElement('p');
    body.className = 'body-text';
    body.style.cssText = 'font-size: 0.85rem; line-height: 1.5; margin: 0;';
    body.textContent =
      'This identity was created before hardened key storage. Its private key is held as '
      + 'an exportable JWK and remains readable by page script. Signing still works. '
      + 'Generating a new keypair stores the key non-extractably, so it can sign but can '
      + 'never be read out — note that rotating changes your DID, so credentials signed '
      + 'under the old one will no longer match.';

    notice.append(label, body);
    host.appendChild(notice);
  }
};
