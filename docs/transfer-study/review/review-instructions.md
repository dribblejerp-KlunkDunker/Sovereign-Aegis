# Ground-Truth Review Packet — Phase 4 Transfer Study (protocol §9 item 3)

**Reviewer instructions.** You are independently verifying the scored content of the two
held-out forms (T0 baseline, T1 post-test) before the study can be preregistered. Work
row by row through `ground-truth-worksheet.csv`:

1. **Single defensible key.** For each item, satisfy yourself that exactly one option is
   correct as written, and that no other option is arguably also correct. The answer keys
   themselves are in `../forms/form-keys-T0.json` / `form-keys-T1.json` (they were
   withheld from the served forms on purpose; consult them, do not edit them).
2. **Rationale check.** The source bank carries an `explanation` per item (see
   `data/arena_questions.json`); confirm it actually justifies the key and contains no
   factual error a fact-checker would flag.
3. **Leak check.** Confirm the item does not give away its own answer (leading wording,
   giveaway phrasing, duplicate of another item on the same form).
4. **Ambiguity/difficulty sanity.** Flag anything whose difficulty looks wildly
   mismatched to its neighbors — do not reorder anything; flag and stop.
5. **Fill the four review columns** (verdict ok/revise/reject, note, date, initials) for
   every row. A blank review column blocks enrollment.

**What happens to your review.** The completed worksheet is hashed and recorded alongside
the frozen artifacts in `form-manifest.json`'s freeze block. If any item is rejected or
revised, the forms are REBUILT (new seed policy entry, new hashes, new review packet) —
never patched in place — before preregistration and enrollment.

**Independence.** The reviewer must not be the author of the reviewed items and should
have access to at least one external reference per domain stratum (the item's skillTags
column names them).

Forms covered: T0 (20 items), T1 (19 items) —
39 rows in the worksheet.
