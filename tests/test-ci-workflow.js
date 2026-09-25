/**
 * SOVEREIGN // AEGIS — CI Workflow Guard Suite
 *
 * Pins the nightly-failure notification (STATUS.md open item 4, amended 2026-09-25):
 * a red scheduled run must open or append to a `nightly-failure` GitHub issue assigned
 * to and cc-ing the repo owner — GitHub's own notification email is the delivery
 * channel, no external alerting service — and a green scheduled run must auto-close
 * those issues, so an open issue always means "the last nightly was red".
 *
 * These pins are intentionally structural (text assertions on the workflow source):
 * CI YAML cannot be executed headlessly, but it CAN be pinned so that removing the
 * notification, its permission, or its schedule trigger fails the gate loudly instead
 * of silently re-creating the "red nightly nobody sees" failure mode.
 *
 * Zero external runtime dependencies.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const workflowPath = path.join(ROOT_DIR, '.github', 'workflows', 'ci.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`    ✓ ${message}`);
  } else {
    failed++;
    console.error(`    ✗ [FAIL] ${message}`);
  }
}

function assertIncludes(needle, message) {
  assert(workflow.includes(needle), message);
}

/** The schedule trigger block: cron under `on: schedule:`. */
function hasScheduledCron() {
  const onBlock = workflow.match(/^on:([\s\S]*?)(?=^\w|\n\w)/m);
  if (!onBlock) return false;
  return /schedule:/.test(onBlock[1]) && /cron:\s*'30 3 \* \* \*'/.test(onBlock[1]);
}

/** Extract a named step's `if:` condition and run body from the workflow text. */
function step(name) {
  const idx = workflow.indexOf(`name: ${name}`);
  if (idx === -1) return null;
  const rest = workflow.slice(idx);
  const nextStep = rest.slice(1).search(/\n      - name: /);
  return nextStep === -1 ? rest : rest.slice(0, nextStep + 1);
}

console.log('\n  --- Nightly failure notification (CI workflow guards) ---');

// Trigger surface: the notification only exists if the schedule does.
assert(hasScheduledCron(), "workflow still triggers on schedule with the '30 3 * * *' cron");

// Permission surface: issues cannot be created or closed without issues:write.
assertIncludes('issues: write', 'workflow grants issues:write (issue creation/comment/close needs it)');

// Failure path: scheduled failure → open or append to the tracking issue.
{
  const notify = step('Open or update nightly-failure issue');
  assert(notify !== null, 'a notification step exists for failed scheduled runs');
  if (notify) {
    assert(/if:\s*failure\(\) && github\.event_name == 'schedule'/.test(notify),
      "notification step is gated on failure() AND schedule (never on green, never on push)");
    assert(notify.includes('gh issue create'), 'it can open the tracking issue');
    assert(notify.includes('gh issue comment'), 'it appends to an already-open tracking issue instead of spawning duplicates');
    assert(notify.includes('gh label create nightly-failure'), 'it bootstraps the nightly-failure label idempotently (--force)');
    assert(notify.includes('--add-assignee'), 'it assigns the issue to the owner (best-effort)');
    assert(/cc @\$\{OWNER\}/.test(notify), 'the issue body cc-mentions the owner so GitHub email fires even without assignment');
    assert(notify.includes('github.run_id') || notify.includes('${{ github.run_id }}'),
      'the issue links the failing run');
    assert(notify.includes('headless-gate.log') && notify.includes('e2e.log'),
      'the issue carries the real failure evidence from both logs');
  }
}

// Success path: green nightly closes stale tracking issues.
{
  const close = step('Auto-close nightly-failure issue on green');
  assert(close !== null, 'an auto-close step exists for green scheduled runs');
  if (close) {
    assert(/if:\s*success\(\) && github\.event_name == 'schedule'/.test(close),
      'auto-close step is gated on success() AND schedule');
    assert(close.includes('gh issue close'), 'it closes open tracking issues');
    assert(close.includes('exit 0'), 'green runs with nothing to close exit cleanly (no phantom failures)');
  }
}

// The E2E job must still be schedule-gated (regression guard for the 2026-09-24 change).
assert(/if:\s*github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'schedule'/.test(workflow),
  'browser E2E remains gated to workflow_dispatch and schedule');

// The notification must be silence-proof by construction: no `continue-on-error` on
// the notify step, which would swallow credential problems and fail silently again.
{
  const notify = step('Open or update nightly-failure issue');
  if (notify) {
    assert(!notify.includes('continue-on-error'), 'notification step has no continue-on-error — a broken notify FAILS the run loudly');
  }
}

console.log('====================================================');
console.log(`[CI WORKFLOW Summary: ${passed} Passed, ${failed} Failed]`);
console.log('====================================================');

if (failed > 0) process.exit(1);
