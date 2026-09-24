---
name: devbible-verify-your-own-measurements
description: Real console output can still be wrong evidence — check the measurement is not confounded before a number goes on a page
metadata:
  type: feedback
---

# A measurement can be genuine and still prove the wrong thing

The house rule "never invent console output" ([[devbible-postgresql-rewrite-handoff]])
stops fabrication. It does **not** stop a script from producing real output that does not
support the claim the page makes. Three of these were caught in the 2026-08-12 sessions,
all of which would have shipped as confident, measured-looking nonsense.

**Why:** the corpus is being rewritten precisely because 216 pages carried false
`Verified:` lines. A confounded measurement is the same failure wearing a better
disguise — worse, because the output is real and therefore survives review.

## The three that were caught

| Claim being made | What the script actually showed | Fix |
|---|---|---|
| "`DELETE` does not return space; `VACUUM` only makes it reusable" | Deleted **every** row, so `VACUUM` truncated the trailing pages: 47 MB → **24 kB**. The output disproved the page's point. | Delete **half** the rows so dead tuples are interspersed. Then 47 MB stayed 47 MB, and `VACUUM FULL` gave 24 MB. Kept the all-rows case as an explicit contrast. |
| "A cursor uses less memory than buffering" | Cursor peak **149 MB** vs buffered **102 MB** — cursor looked *worse*. The buffered `Result` was still referenced and uncollected. | Null the reference, force GC, re-baseline. Then buffered +101 MB vs cursor +52 MB. Also stated on the page that the cursor's peak is mostly uncollected garbage and the real point is that it is *flat in result size*. |
| "Prepared statements are per-session, not per-pool" | Second `pool.connect()` returned the **same physical connection**, so it saw the statement — appearing to disprove the claim. | Hold **both** clients at once and print `pg_backend_pid()` for each. pid 1932 prepared it, pid 1933 saw 0. |

## The same failure in a *review* (2026-08-13)

The three above are scripts. The fourth instance was a **finding in a code review**, which is
worse because a review's job is to be the check.

A correctness review flagged a real defect — a backoff `sleep` inside a `try`/`finally` that
holds a pooled connection — and justified it with "this page's measured 12.4 s is retry cost
plus pool starvation, against a default `max: 10` pool." Verifying it:

- The script uses **`max: 25`**, not the default 10, against 20 concurrent transfers. Every
  sleeper had its own connection, so **none** of the 12.4 s was queueing.
- Probing at `max: 10` produced the *opposite* of the prediction: capping the pool also caps
  simultaneous conflict, which cut the retry count, so the **unfixed** variant ran faster —
  8.3 s vs 12.4 s — with retries swinging **71–156 between runs**.

**A correct finding can carry a wrong justification, and the justification is what gets
written on the page.** Fix such a defect on the mechanism ("holding a pooled connection while
deliberately idle is wrong") and refuse to claim a number the benchmark does not produce. Do
not cite probe numbers at all unless the probe is a committed sandbox script.

Related failure in the same review: a finding predicted that adding a column would invalidate
every console block in the phase. No query in the script selected `*` from that table, so
nothing changed. **Check that the thing you are about to budget for is actually reachable.**

## Session 10 (2026-08-13) — six more, and a new category

Phase 9 and phase 12 produced six. Four were the familiar kinds; **two were a
distinct failure worth naming: the narration was written before the output was
read, and the assertion was too weak to detect the thing it claimed.**

| Script | What went wrong | Fix |
|---|---|---|
| `ex39` §5 | Narration said "the INSERT survived a ROLLBACK" while the output printed `orders=0` — it had not. An idle pool reuses one connection (same pid 3153), so the bug does not reproduce sequentially. | Split into two cases: sequential **looks correct**; with 8 concurrent inserts **7 survive**. The "it appears to work" half is the better finding. |
| `ex45` §11 | Narration claimed trigram finds what FTS cannot; the run showed FTS finding 1 row and trigram 0. | The measurement was right and the framing wrong: `%` compares **whole strings** (0.273, under the 0.3 threshold) while `word_similarity` scores 1.000. Rewrote around `<%`. The trap became the centrepiece. |
| `ex42` §7 | Claimed parallel test files corrupt each other; both files saw exactly 1 row, so a **row-count assertion passed**. | Assert on row *identity*, not count. File A then visibly saw file B's row. This is also why the bug is diagnosed as flakiness in real suites. |
| `ex43` §3 | `pg_stat_user_tables` returned 0 for everything; a 600 ms sleep is not enough. | Do the updates **and** the reads on one dedicated client and call `pg_stat_force_next_flush()` — it only flushes its own backend. |
| `ex39` §8 | Read `.milliseconds` off a parsed `interval` — 209 for a 1211 ms wait. | `extract(epoch FROM …) * 1000`. `pg` parses intervals into component objects. |
| `ex45` §13 | The honest result showed trigram **also** missing the typo at the default threshold (`word_similarity` 0.571 vs 0.6). | Do not assert an undemonstrated capability. Added a threshold sweep: 0.55 finds it with **zero** extra false positives — which is the actionable finding. |

**Why:** two of these would have shipped a page whose prose contradicted the console
block printed directly beneath it. That is worse than a confounded number, because a
reader checking the output against the claim finds the contradiction immediately and
stops trusting the corpus.

## How to apply

Before a number goes on a page, ask:

1. **Does the setup actually create the condition?** The `VACUUM` case had the right
   command and the wrong data shape.
2. **Is anything else holding the resource I am measuring?** Memory comparisons need a
   dropped reference, a forced GC, and a re-read baseline between arms.
3. **Did the pool/cache hand me the same thing twice?** Anything claiming "per-session",
   "per-connection" or "per-process" must prove the two are actually distinct — print the
   pid, the object identity, the OID.
4. **Does the output say what I am about to write, or merely sit near it?** If the claim
   is "X is slower than Y", the numbers must be X and Y under the same baseline.
5. **When a result contradicts the expected claim, that is information.** Two of the three
   above showed up as "the measurement disagrees with me" — the correct response is to fix
   the measurement or change the claim, never to quietly reframe the sentence around a
   number that does not support it.
6. **Read the config before repeating a claim about it.** Both 2026-08-13 errors were one
   `grep` away: `max: 25` was on line 6 of the script, and `SELECT *` was absent from it.
   A claim about *someone else's* measurement — including a reviewer's — needs the same
   verification as your own.
7. **Read the output before writing the sentence above it.** Two session-10 failures were
   narration composed from what the script was *designed* to show, then never checked
   against what it printed. Read the console block first, then write the prose.
8. **Ask whether your assertion could even detect the failure.** A row *count* cannot
   detect two test files overwriting each other's row; only identity can. If the check
   would pass in the broken world, it is not evidence.
9. **A capability you did not demonstrate is not a capability.** When "trigram handles
   typos" did not reproduce at the default threshold, the fix was to measure which
   threshold does — not to soften the sentence.

Also: a script that crashes is sometimes the finding. The `idle_in_transaction` timeout
killed `ex21` with an unhandled `'error'` event — that crash *is* the page's central
point, so it was captured deliberately with a handler rather than engineered away.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-pages-validation]]
