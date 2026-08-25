# Plan — repair & depth pass A (chunks 01–09b + new 20d)

Fork A ownership: `01`, `02`, `02b`, `02c`, `03`, `03b`, `03c`, `04`, `04b`, `04c`,
`05`, `05b`, `05c`, `06`, `06b`, `06c`, `07`, `07b`, `08`, `08b`, `09`, `09b`
(18 files… 22 files) **plus** the new `20d-what-a-test-must-assert.md` and any of its
splits (`20e`, …).

NOT mine: 10–14b (fork B), 15–22b (finished), `README.md`, `_plan-c.md`, `_plan-d.md`.

## Task 1 — write 20d (fixes the one dangling link in this topic)

Written to the length it deserved, then split on concept boundaries into five chunks.

| File | Status |
|---|---|
| 20d-what-a-test-must-assert.md | ✅ 183 lines, 3 gotchas, 4 questions |
| 20e-what-the-context-hides.md | ✅ 257 lines, 6 gotchas, 7 questions |
| 20f-asserting-the-boundary-exists.md | ✅ 270 lines, 6 gotchas, 6 questions |
| 20g-asserting-the-settings.md | ✅ 255 lines, 5 gotchas, 5 questions |
| 20h-asserting-the-commit.md | ✅ 252 lines, 4 gotchas, 4 questions |
| 20i-committing-and-what-participates.md | ✅ 228 lines, 6 gotchas, 6 questions |
| 20j-the-fixture-and-the-real-database.md | ✅ 296 lines, 6 gotchas, 7 questions |

**TASK 1 COMPLETE** — 7 files, 1,741 lines, 0 over the cap, all links resolve.

## Task 2 — per-file interview-Q&A depth re-judge

Re-judge each file on its own merits. No blanket +2. A file that is genuinely
exhaustive is left alone and the reason recorded.

| File | Before lines | Before Q | Status |
|---|---|---|---|
| 01-not-a-language-feature.md | see below | | ✅ 281 lines, 7 Q (was 5) — +autocommit, +two managers |
| 02-the-proxy.md | see below | | ✅ 289 lines, 8 Q (was 5) — +Objenesis, +AopUtils, +module system |
| 02b-where-the-annotation-lives.md | see below | | ✅ 225 lines, 6 Q — split; +commit-can-throw |
| 02c-visibility-and-the-interface-question.md | see below | | ✅ 282 lines, 7 Q (was 6) — +package-private across packages |
| 03-the-self-invocation-trap.md | 252 | 4 | ⏳ |
| 03b-the-initialization-variant.md | 251 | 5 | ⏳ |
| 03c-bound-receivers.md | 280 | 6 | ⏳ |
| 04-fixing-self-invocation.md | 260 | 6 | ⏳ |
| 04b-the-escape-hatches.md | 261 | 6 | ⏳ |
| 04c-aspectj-weaving.md | 254 | 6 | ⏳ |
| 05-annotations-that-do-nothing.md | 227 | 6 | ⏳ |
| 05b-detecting-a-dead-annotation.md | 249 | 6 | ⏳ |
| 05c-proving-it-and-preventing-it.md | 240 | 6 | ⏳ |
| 06-the-transaction-manager.md | 297 | 6 | ⏳ |
| 06b-which-manager-you-have.md | 270 | 6 | ⏳ |
| 06c-what-boot-picked-for-you.md | 258 | 6 | ⏳ |
| 07-thread-binding.md | 282 | 6 | ⏳ |
| 07b-getting-the-connection-safely.md | 237 | 6 | ⏳ |
| 08-propagation-required.md | 272 | 6 | ⏳ |
| 08b-whose-settings-win.md | 262 | 6 | ⏳ |
| 09-marked-rollback-only.md | 244 | 5 | ⏳ |
| 09b-fixing-the-rollback-only-trap.md | 287 | 6 | ⏳ |

Rules held: never trim prose to fit a question; split at >296 body lines onto a
concept boundary using the next free letter suffix; never rewrite the existing
generated `← Prev … Next →` footer line; new files end with a bare `<!--FOOTER-->`.


## Task 2 running log

| File | Before | After | Before Q | After Q | Verdict |
|---|---|---|---|---|---|
| 01-not-a-language-feature.md | 254 | 281 | 5 | 7 | +autocommit-without-a-transaction, +two transaction managers and the qualifier |
| 02-the-proxy.md | 250 | 289 | 5 | 8 | +Objenesis/constructor bypass, +AopUtils runtime check, +module-system limit |
| 02b-where-the-annotation-lives.md | 293 | 225 | 6 | 6 | **split** → 02d; +"the commit is a call that can fail" |
| 02d-the-inheritance-rule.md (NEW) | — | 155 | — | 5 | inheritance rule carved out of 02b; +annotate-the-base trade, +abstract method/@Inherited, +bridge methods |
| 02c-visibility-and-the-interface-question.md | 268 | 282 | 6 | 7 | +package-private is conditional on same-package overridability |
| 03-the-self-invocation-trap.md | 252 | 292 | 4 | 7 | +outer-annotated/inner-REQUIRES_NEW, +which other annotations, +how to test it |
| 03b-the-initialization-variant.md | 251 | 277 | 5 | 7 | +self-injection is a circular ref (Boot default false), +which event and why one fires twice |
| 03c-bound-receivers.md | 280 | 294 | 6 | 7 | +calibration: a self-bound reference is a bug only when its target is advised |
| 04-fixing-self-invocation.md | 260 | 274 | 6 | 7 | +circular references disallowed by default since Boot 2.6, so @Lazy is load-bearing |
| 04b-the-escape-hatches.md | 261 | 277 | 6 | 7 | +checked exceptions in a TransactionTemplate callback |
| 04c-aspectj-weaving.md | 254 | 276 | 6 | 9 | **REPAIRED: 3 duplicated sections removed, 1 wrong gotcha corrected**; +private under weaving, +interface rule is a requirement, +starter rename |
| 05-annotations-that-do-nothing.md | 227 | 269 | 6 | 9 | +what "unwrapped" means (AopTestUtils), +what a static analyser can and cannot catch, +final class under JDK proxies |
| 05b-detecting-a-dead-annotation.md | 249 | 278 | 6 | 8 | +what the TRACE line actually says, +what the assertion does NOT cover |
| 05c-proving-it-and-preventing-it.md | 240 | 285 | 6 | 8 | +where the injected failure should come from (shown), +what to do when the rule fails on 40 existing methods |
| 06-the-transaction-manager.md | 297 | 235 | 6 | 6 | **split** → 06d; +TransactionException is unchecked, +why ISOLATION_* match java.sql.Connection |
| 06d-the-status-handle.md (NEW) | — | 162 | — | 5 | TransactionStatus carved out; +hasSavepoint/isCompleted, +NoTransactionException is a feature, +reading isNewTransaction from declarative code |
| 06b-which-manager-you-have.md | 270 | 298 | 6 | 7 | +TransactionAwareDataSourceProxy, named twice in the chunk and never explained |
| 06c-what-boot-picked-for-you.md | 258 | 296 | 6 | 8 | +rollback-on-commit-failure (in the table, never explained), +globalRollbackOnParticipationFailure / failEarlyOnGlobalRollbackOnly |
| 07-thread-binding.md | 282 | 282 | 6 | 6 | **LEFT ALONE** — its 6 questions already cover every claim the chunk makes; the two gaps found (isConnectionTransactional, LazyConnectionDataSourceProxy) belong to 07b, which is what that chunk is about |
| 07b-getting-the-connection-safely.md | 237 | 284 | 6 | 8 | +DataSourceUtils.isConnectionTransactional / applyTransactionTimeout, +LazyConnectionDataSourceProxy (the chunk argues connection-hold time and never names the class built for it) |
| 08-propagation-required.md | 272 | 288 | 6 | 7 | +how to find the outermost @Transactional at runtime (the chunk says to and never says how) |
| 08b-whose-settings-win.md | 262 | 219 | 6 | 6 | **split** → 08c; +inner rollbackFor DOES take effect (the asymmetry), +the inner method inherits the outer DEADLINE, shrinking |
| 08c-making-the-mismatch-loud.md (NEW) | — | 207 | — | 5 | validateExistingTransaction carved out; +TransactionManagerCustomizer, +the two exact exception messages, +why timeout is not policed |
| 09-marked-rollback-only.md | 244 | 287 | 5 | 7 | +failEarlyOnGlobalRollbackOnly (fail where the marking happened), +Spring Data repositories are transactional by default |
| 09b-fixing-the-rollback-only-trap.md | 287 | 288 | 6 | 7 | **REPAIRED: duplicated "Seeing it coming" section removed**; +NESTED as the missing fourth option and why it is not in the table |

## ✅ TASK 2 COMPLETE — all 22 owned files re-judged

3 splits (02b→02d, 06→06d, 08b→08c), 2 structural repairs (04c and 09b each had a
duplicated section; 04c also had a factually wrong gotcha), 1 file deliberately left
alone (07). Question counts now range **5–9** across the range, replacing the near-uniform
6. Every file ≤300 lines after the coordinator's footer; 0 unresolved links in the
directory except three inbound to `13d-the-matching-algorithm.md`, which is another
fork's file.
