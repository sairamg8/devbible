---
name: progress-nodejs-improve-review
description: Node.js — improvement pass (review first) · session 08ab5390
metadata:
  type: progress
---

# Node.js — improvement pass (review first) · session 08ab5390

**Started 2026-08-16.** User instruction: *"I want to improve all existing languages first
starting with node js first review syllabus and then the explanations"*, then mid-turn:
*"my goals basically a fullstack based tech stack each contribute its share for developing
a fullfledged app, when i am with node js i need a custom syllabus about the
implementations"* and *"Please use graphify efficiently save tokens"*.

**This session's lock: Node.js.** Step asked = REVIEW (then improve after report).
User is near weekly usage limits — save memory every step.

## State: syllabus review DONE, explanation review IN FLIGHT

### Syllabus verdict (all 4 parts read fully)

- Strong; 2026-08-09 review (kept at `docs/nodejs/reviews/syllabus-review.md`) was
  applied: 248 topics, Master 74 (30%), platform-gap topics (outbox, uploads/temp,
  outbound client discipline, boot sequence, time-on-server) all present.
- Fullstack boundaries explicit and correct ("Where this connects" / "Deliberately not
  here" in `syllabus/04-production.md`).
- 🔴 **Gap matching user's goal:** the review's §4.6 "minimum path to ship"
  **implementation track was never added** to `docs/nodejs/README.md`. Recommended
  improvement: add an "Implementation track" section mapping build milestones of a
  fullstack app → syllabus rows (ship first API: 0→1→2→5→6→8→11; +background: 3,7;
  +production: 9,10; defer 12), cross-linking where Express/Mongo/PG/Redis/Docker pick
  up their share. This IS the "custom syllabus about the implementations" the user asked
  for.

### Mechanical findings (already measured)

- **Two files at exactly 300 lines** (the rework-down tell):
  `pages/phase-6-data-access/06-transactions.md`,
  `pages/phase-8-security/17-input-validation.md`. Agents examining.
- **30 slug-form links** (end in `/`, not `.md`) across nodejs pages+syllabus — resolve
  today (all in leaf pages) but violate the .md-link hard rule. Fix with
  `shared/scripts/fixlinks.py` (dry-run first), never bulk-sed.
- Line distribution: 137 of ~249 files in the 200–299 band — clustering suggests some
  budgeting-to-cap; agents judging per page.
- All 240 leaf pages HAVE Interview + Gotcha sections (grep-verified). All have
  `> Verified:` lines. Node pages are **sandbox-proven** (sandbox/js-p0..p3,
  p7-background-work, p8-security, p9-testing, p10-observability, pg-api exist).
- Phase 11 (deployment) looks thin: 15 files / 1,473 lines (~98/file) with 4 Master
  topics. Phase 12 thin too but that's fine (Know/When-Needed tier).
- `instructions.md` §11 "Current state" is badly stale (says only Node phases 0–2
  written, "strict focus Node.js"). NOT touched — needs explicit user instruction.

### Explanation review — 6 background Explore agents launched (2026-08-16)

One per pair of phases: 0–1, 2–3, 4–5, 6–7, 8–9, 10–12. Each reviews: accuracy vs
Node 24 LTS (Aug 2026), depth vs tier badge, contract compliance (interview Qs/gotchas/
runnable code), cap-trimming evidence, README consistency. Reports pending — compile
into a single prioritized findings report + improvement plan, then STOP and report
(review only; improvements after user approves).

## Agent reports received

### Phases 8–9 (done 2026-08-16) — strong; narrow defects

Phase 8 verdict: strongest security writing; all 6 upstream-verified claims held
(no `--allow-net` on Node 24 — it's v25; `--allow-inspector` v24.12.0; npm 12
allowScripts/min-release-age all correct). Findings:
1. ACCURACY `phase-8-security/12-ssrf.md:118` — `isPrivateAddress` misses
   IPv4-mapped IPv6 loopback (`::ffff:7f00:1`), the exact case its own gotcha
   (:242) prescribes handling.
2. ACCURACY `12-ssrf.md:124` — `guardedLookup` validates only `address[0]` but
   passes the full array; under `{all:true}` a `[public, private]` result passes.
3. DEPTH `01-password-storage.md` — recommends argon2id as first choice but shows
   zero argon2 code/params (all scrypt). Master page.
4. CONTRACT `01-password-storage.md:147` — `needsRehash()` called, never defined.
5. CONTRACT `17-input-validation.md` — zod used with no import; same at
   `07-mfa-totp.md:60` (`timingSafeEqual` not imported).
6. CONTRACT `17-input-validation.md:62-71` — check 1 of "four checks in order"
   (content-type) never shown in code.
7. MINOR — three stale `*(being written)*` footers (`03-token-storage.md:222`,
   `17-input-validation.md:300`, `24-permission-model.md:199`); bare-text footer
   `08-injection.md:227`.
✅ `17-input-validation.md` at exactly 300: **cleared — naturally that length, no
trimming** (density matches neighbouring practices pages).

Phase 9 verdict: best-executed; no substantive inaccuracy. Findings:
1. CONTRACT `phase-9-testing/08-module-mocking.md:62-67` — console block on the
   ✗ WRONG example is labelled ✖ CORRECT (pasted from other case) — inverts the
   page's key teaching point.
2. MINOR `11-coverage.md:48,52` — command says threshold 80, output says 90;
   81.82% clears 80 so command/output don't correspond.
Best pages (don't touch): 16-timing-attacks, 13-prototype-pollution,
19-https-hsts-cookies, 14-runner-flags, 06-async-testing.

### Phases 4–5 (done 2026-08-16) — phase 4 strongest; phase 5 Master tier uneven

Phase 4 verdict: best material reviewed; README↔files exact. Findings:
1. ACCURACY `phase-4-filesystem/04-path-traversal.md:45-53` — transcript shows
   relative paths but `path.resolve` output is absolute (agent reproduced on
   24.19.0); hides the very thing the page proves.
2. ACCURACY `02-the-three-flavors.md:25-34` — transcript order AND mechanism wrong:
   real order is sync, callback, promises; `fs/promises` is not microtask-gated as
   claimed. Interview-answer-poisoning bug.
3. MINOR `01-fs-promises.md:129` (45ms vs 86ms stated as a rule), `07-directories.md`
   fixture drift, `14-virtual-filesystems.md` needs re-verify marker on node:sea.

Phase 5 verdict: process/shutdown cluster excellent; outbound cluster has the gaps.
1. ACCURACY `phase-5-http-processes/06-outbound-timeouts.md:11,23,154` — "no timeout
   at all without AbortSignal" is wrong: bundled undici defaults headersTimeout/
   bodyTimeout = 300 000 ms (UND_ERR_HEADERS_TIMEOUT). Restate as "default 5 min =
   effectively none". ★ interview answer affected.
2. DEPTH pages 05/06/07/08 — zero proxy coverage; Node 24 `--use-env-proxy` /
   NODE_USE_ENV_PROXY missing = biggest 2026-currency gap.
3. DEPTH `09-https-and-tls.md` — `--use-system-ca` absent (page claims bundle-only).
4. DEPTH `06-outbound-timeouts.md` (187 lines) — never teaches per-phase undici
   timeouts; `01-http-server.md` missing smuggling/maxHeaderSize; `02-request-bodies`
   missing 100-continue; `15-process.md` hand-rolls env without --env-file.
5. CONTRACT all 26 phase-5 pages: exactly 6 Q/4★/6 gotchas — template quota smell
   (phase 4 varies naturally).
6. CONTRACT `02-request-bodies.md:30` — transcript stitched from two programs.
7. MINOR: version pin `01-http-server.md:85` (setHeaders is v18.15/v19.6 not
   v18.17); syllabus-pointing cross-refs `04-cookies.md:130`,
   `26-single-executable-applications.md:98`; phase README order vs prev/next.
NOTE: phase-5 Master gaps are NOT cap-forced — pages sit 45–115 lines under cap;
fix in place, no splits needed. No trimming evidence in either phase.
Best (don't touch): 17-graceful-shutdown, phase-4/10-atomic-writes,
07-keep-alive-and-agents, 08-stat-and-existence, 20-shell-injection.

### Phases 2–3 (done 2026-08-16) — strongest conceptually; 4 accuracy errors in ph3

Phase 2: core event-loop claims all reproduce on 24.19.0. Findings:
1. TRIM `phase-2-async/11-error-handling.md` — README:35 and 17-promise-antipatterns:140
   both promise a `return await` section that is NOT on the page (258 lines). Restore it.
2. DEPTH — `Promise.withResolvers()` (stable Node 22) absent from
   13-callbacks-and-promisify:83, 07-promise-states:180, 17-promise-antipatterns:172.
3. DEPTH `02-poll-phase.md` — only Master page with no runnable evidence for its claim.
4. CONTRACT — non-runnable listings presented as files: 07-promise-states:64 (`sleep`
   undefined), 17:95 (`get()` undefined), 08-async-await:137 (no readFile import);
   `...` elisions in console blocks 12-floating-promises:30, 11-error-handling:64.
5. MINOR 03-microtasks:40 label numbering inverts output order; 09-combinators:155.
Best: 03-microtasks, 22-cpu-bound-work, 10-sequential-vs-parallel.

Phase 3: 11 numeric claims spot-checked, all correct. Findings:
1. ACCURACY `08-stream-types.md:39` — stdout-as-pure-Writable only true redirected
   to file; piped it's a Socket (Duplex true). Wrong mental model as presented.
2. ACCURACY `15-web-streams.md:54` — async iteration IS in WHATWG spec (browser
   support is the caveat); also mangled markdown same line.
3. ACCURACY `04-buffer-as-uint8array.md:169` — `toBase64` undefined on 24.19.0.
4. ACCURACY `03-alloc-vs-allocunsafe.md:58` — CVE-2016-2216 is wrong citation.
5. LINKS — six `./transform-streams/` refs (05:182, 06:176, 08:191, 12:242, 14:244,
   17:215) omit the `13-` prefix; prior audit says build was clean so they likely
   resolve as URLs, but normalize to `13-transform-streams/README.md` .md form.
6. CONTRACT `16-zlib.md:194` — maxOutputLength 10MB vs output saying 1MB cap,
   unshown bomb.mjs; :44 output precedes source, first line never emitted.
7. DEPTH `13-transform-streams/02` — headline decodeStrings topic has no runnable
   demo; chunk 02 reads like cap remainder, has room to expand.
8. MINOR: 12:96 annotation inside verified block; 19:7 badge text outlier;
   02-encodings says eight names shows seven; heading spacing in chunks.
Best: 09-backpressure, 19-highwatermark-tuning, 03-alloc-vs-allocunsafe (sans CVE).

### Phases 6–7 (done 2026-08-16) — transactions TRIMMED confirmed; outbox INVERTED

Phase 6:
1. TRIM CONFIRMED `06-transactions.md` (exactly 300) — elisions at :186 (inside
   load-bearing savepoint example) and :230; isolation levels entirely absent
   (no READ COMMITTED default, no 40001) though page 14 depends on them; Mongo half
   a stub (no txn lifetime limit); :160 "verified" claim with output cut. FIX = split
   into chunk dir (scoping+propagation / isolation+savepoints+retry+Mongo).
2. ACCURACY `14-retry-backoff.md:48-72` — jitter output contradicts code (off-by-one
   exponent); page's own prose sides with code.
3. DEPTH `06-transactions.md:72` — unguarded ROLLBACK in catch swallows original error.
4. DEPTH `09-mongoose.md` — `.populate()` never explained though 07-n-plus-1:170
   points to it; VERIFY the "{new:true} deprecated in Mongoose 9" claim (:148).
5. MINOR: `16-cursors.md:249` stale "(not yet written)" footer for phase 7;
   04:190 + 02:192 link syllabus placeholders instead of real phase pages;
   15-read-replicas:46 pg result object printed unrealistically;
   12-node-sqlite:51 `Session` export list worth verifying.

Phase 7:
1. 🔴 ACCURACY CRITICAL `06-transactional-outbox.md:95-122,212` — relay marks
   published THEN enqueues autocommitted ⇒ crash between = event LOSS (at-most-once),
   page claims at-least-once twice + ★ interview answer. Fix: enqueue-then-mark or
   mark in txn committed after enqueue.
2. ACCURACY `13-deadline-propagation.md:73,122` — pg signal goes INSIDE query config
   not second arg; pg cancel DOES stop server-side work (sends real cancel, 57014).
3. ACCURACY `08-scheduled-jobs.md:17` — setInterval drift mechanism misstated and
   contradicted by page's own ticks; "4 min/day" number matches neither model.
4. ACCURACY `12-timeout-budgets.md:17,171` — same undici 300s default error as
   phase 5 finding (★ answer says "no default timeout at all").
5. DEPTH `04-retries-and-stalled-jobs.md` + `11-graceful-shutdown.md` — BullMQ
   maxStalledCount default 1 never mentioned; changes operational conclusions.
6. DEPTH `05-job-idempotency.md` — missing idempotency-record state machine and
   BullMQ `deduplication:{id,ttl}` despite pinning bullmq 6.0.10.
7. DEPTH phase-wide — all 7 Master pages 185–239 lines, flat band regardless of
   tier; expand where findings above land.
8. MINOR: 11:100 `job.ack()` not a BullMQ API (label pseudo-code); 15:104
   Retry-After HTTP-date form unparsed; 10-time-on-the-server:68 re-verify
   --harmony-temporal claim.
Best: 01-connection-pooling (model for whole reference), 04-postgresql-from-node,
11-graceful-shutdown, 16-cursors, 16-concurrency-limiting.

### Phases 0–1 (done 2026-08-16) — strong; version-stamp errors are systemic

1. ACCURACY SYSTEMIC — **npm "12.0.2 bundled with Node 24.19.0" is WRONG, it is
   11.17.0** (verified) — appears in `phase-0/07-choosing-a-version.md:116` + SIX
   `> Verified:` stamps across phase 1 (README:9, 07:9, 09:9, 10:9, 11:9, 13:9).
2. ACCURACY — **require(esm) "stable in v24.15.0" is WRONG — v25.4.0** (verified,
   no v24 backport): `phase-1/04-cjs-esm-interop.md:11,229`, `README.md:81`,
   `13-publishing.md:141,196`. Accurate line: unflagged 23.0/22.12/20.19, stable 25.4.
3. ACCURACY `phase-0/07:26` — "30 months total life" contradicted by page's own v27
   timeline (36 months post-v27); :32 table omits Node 25 entirely.
4. CONTRACT `phase-0/08-running-node.md:150` — `node --run greet` shows output `2`
   copy-pasted from another example, no greet script defined.
5. ACCURACY `phase-1/14-node-module-api.md:89` — hooks are three (initialize
   omitted); `04-cjs-esm-interop.md:107,204,253` — __esModule only added when
   default export exists, experimental, don't depend on it.
6. ACCURACY `phase-1/05-module-resolution.md:98` — case-sensitivity mechanism
   conflated; CJS throws MODULE_NOT_FOUND not ERR_MODULE_NOT_FOUND.
7. CONTRACT `phase-1/12-typescript-natively.md:122` — fabricated console block
   (no .catch, would print stack trace); :93 --experimental-transform-types
   REMOVED in v26 — needs forward note.
8. DEPTH — peerDependencies/ERESOLVE/--legacy-peer-deps NOWHERE in phase 1 despite
   two Master npm pages; `phase-0/01-what-node-is.md` thinnest Master (174);
   `phase-1/03-node-prefix.md` 158 lines/4 Qs as Master — expand or demote.
9. MINOR: engines ceiling advice contradicts between phase-0/07:76 and
   phase-1/07:127 (app vs library never drawn); three different require(esm)
   floors given (08-exports-map:137 vs 13-publishing:136,195); libuv pool list
   includes child_process unsupported; README "three pairs merged" is 2+triple;
   badge text "Learn When Needed" vs "When Needed".
10. VERIFY-checked OK: --env-file v24.10/v22.21 ✓, type stripping v25.2/v24.12 ✓,
    ReadableStream v23.11/v22.15 ✓, fetch v21 ✓, release dates ✓, v27 story ✓.
⚠️ AGENT'S POINT: both hard errors sit INSIDE `> Verified:` stamps — re-check
every "stable as of vX" stamp bible-wide on the same suspicion.
Best: phase-0 02/03/06, 10-how-v8-optimizes; phase-1 01-esm, 12-ts (sans block),
08-exports-map.

### Phases 10–12 (done 2026-08-16) — ph10 strong, ph11 UNDER-WRITTEN, ph12 fine

Phase 10 findings: ACCURACY 23-startup-time:37 (compile cache dir contradiction);
01-structured-logging:68 (pino "buffered non-blocking" only with opt-in
destination/transport — name the setting); 10-health-checks:116 (sleep full
terminationGracePeriod = SIGKILL race — advice wrong) + :60 readiness query has
no timeout contradicting own gotcha. MINOR: README:59 stale "when written";
4 pages plain-text footers (09/10/11/12); unused import 12:63; undefined err 02:53.

Phase 11 — UNDER-WRITTEN relative to tier (18 code blocks/14 pages vs ph10's
60/23; 4 pages zero code; zero measured output; flagships 101–125 lines):
1. ACCURACY `02-boot-sequence.md:26` — listen callback never receives err;
   EADDRINUSE = promise never settles + unhandled 'error'. Broken snippet on the
   fail-fast page.
2. ACCURACY `04-pid1-and-signals.md:28` — never states the actual kernel rule
   (PID 1 has no default signal dispositions); hedges instead.
3. ACCURACY `03-dockerizing-node.md:31vs96` — runner copies FULL node_modules
   incl. devDeps, contradicting own gotcha; no --omit=dev anywhere; corepack
   removal (not shipped 25+) uncaveated at :23.
4. DEPTH — 04: no exit watchdog/double-SIGTERM/exit-143/--init; 07-zero-downtime
   never names closeIdleConnections/closeAllConnections; 01-twelve-factor: one
   code block, no schema validation/loadEnvFile/precedence/redacted dump;
   03: no cache mounts/digest pin demo/HEALTHCHECK/node user.
5. CONTRACT — 08-cicd + 10-process-managers: only CI YAML and systemd unit are
   fully commented-out "pseudo-code"; 01/02/04/06 claim "Verified on 24.19.0"
   with zero executed code (weaker standard than ph10 under same banner).
6. MINOR: 07:96 broken grammar in ★ question; markReady/closeServer/pool used
   across 3 pages, defined nowhere.
Phase 12: appropriately brief. DEPTH: 08-custom-loaders never names
module.register(); 09-startup-snapshots never names --build-snapshot flags;
07-wasi omits Stability 1 warning. MINOR: README lacks VERIFY-policy note.
Best of all 49: ph10 09-event-loop-lag, 04-what-to-log, 16-caching-strategy,
21-gc-basics; ph12 01-node-vm.

## 🔴 NEW USER INSTRUCTION (2026-08-16, mid-review)

*"design a new chapters per languages with real world examples such as
implementing custom hooks with react js, and using node and express a chapter
about handling requests etc … using javascript write custom functions for real
world use case all the new chapters which you going to showcase should be usable
for me in near future for development"*

= a **practical implementations / cookbook track per language**: build-from-
scratch, copy-usable real-world code (React custom hooks; Node+Express request
handling; JS custom utility functions; etc.). DESIGN first (rule 5: syllabus/plan
→ approval → content). Note existing overlap: JS phase 17 (machine coding) and
18 (storefront) already do this shape for JS; React has no hooks-cookbook;
Node/Express have no end-to-end request-handling cookbook. Rule 8 applies to new
chapters: no sandbox runs, no invented console output — implementations validated
against docs, shipped without output blocks.

## 🔴 START HERE — the improvement worklist (review complete, fixes NOT started)

A new session told "work on Node.js gaps" starts at the first unchecked item.
Work top to bottom; per-file memory cadence; never trim to the cap — split.
All findings above carry file:line detail; re-verify a claim upstream before
editing if marked (verify).

**P1 · Accuracy errors (wrong facts a reader will repeat):**
- [ ] 1. `phase-7-background-work/06-transactional-outbox.md` — INVERTED at-least-once
      claim (mark-then-enqueue loses events). Fix code order + prose + ★ answer.
- [ ] 2. undici 300s defaults — `phase-5/06-outbound-timeouts.md` +
      `phase-7/12-timeout-budgets.md`: "no timeout at all" → "default 5 min =
      effectively none"; add UND_ERR_HEADERS_TIMEOUT diagnosis.
- [ ] 3. npm version stamps — 7 files say npm 12.0.2; bundled is 11.17.0.
- [ ] 4. require(esm) stable v25.4.0 not v24.15.0 — 5 spots in phase 1.
- [ ] 5. `phase-7/13-deadline-propagation.md` — pg signal inside query config;
      pg cancel DOES stop server work.
- [ ] 6. `phase-7/08-scheduled-jobs.md` — setInterval drift mechanism + bogus
      4-min/day number.
- [ ] 7. `phase-8-security/12-ssrf.md` — ::ffff: loopback miss + address[0]-only
      guard.
- [ ] 8. Phase-4 transcripts: `04-path-traversal.md` (absolute paths),
      `02-the-three-flavors.md` (order + microtask mechanism).
- [ ] 9. Phase-3 four: stdout-Duplex (08), WHATWG async-iteration (15),
      toBase64-not-in-24 (04), CVE citation (03).
- [ ] 10. `phase-6/14-retry-backoff.md` jitter exponent off-by-one.
- [ ] 11. Phase-10 three: compile-cache dir (23), pino buffering caveat (01),
      health-check sleep advice + untimed readiness query (10).
- [ ] 12. Phase-11 three: boot listen-callback bug (02), PID-1 kernel rule (04),
      Dockerfile devDeps + corepack caveat (03).
- [ ] 13. Phase-9 two: module-mocking label swap (08), coverage threshold
      mismatch (11). Phase-0: 30-months claim + missing Node 25 row (07), --run
      output (08). Phase-1: initialize hook (14), __esModule conditional (04),
      resolution mechanism (05), fabricated TS console block (12).
- [ ] 14. (verify) mongoose "{new:true} deprecated in 9" (`phase-6/09:148`);
      node:sqlite Session export (`12:51`); --harmony-temporal (`phase-7/10:68`).

**P2 · Confirmed trim/structure (split, never shorten):**
- [ ] 15. SPLIT `phase-6-data-access/06-transactions.md` into chunk dir; add
      isolation levels (+40001), Mongo txn limits, guard the ROLLBACK.
- [ ] 16. Restore promised `return await` section in `phase-2-async/11`.
- [ ] 17. Expand `phase-3/13-transform-streams/02` (decodeStrings runnable demo).

**P3 · Depth gaps (expand in place — pages sit far under cap):**
- [ ] 18. Phase-5 outbound cluster: --use-env-proxy (05–08), --use-system-ca (09),
      per-phase undici timeouts (06), smuggling/maxHeaderSize (01),
      100-continue (02), --env-file in 15.
- [ ] 19. Phase-11 flagships: 01 (env schema validation, loadEnvFile), 03 (BuildKit
      cache mounts, --omit=dev, HEALTHCHECK, node user), 04 (watchdog, exit codes,
      --init), 07 (closeIdleConnections + preStop); make 08/10 artifacts copyable.
- [ ] 20. argon2 code+params on `phase-8/01-password-storage.md`; needsRehash defined.
- [ ] 21. peerDependencies/ERESOLVE material in phase-1 npm pages.
- [ ] 22. BullMQ maxStalledCount (phase-7/04+11); deduplication option (05);
      populate() on mongoose page (phase-6/09).
- [ ] 23. Promise.withResolvers in phase-2 (3 spots); poll-phase evidence (02).
- [ ] 24. Phase-12: name module.register() (08) and --build-snapshot flags (09);
      WASI stability note (07).
- [ ] 25. Missing zod import (phase-8/17), timingSafeEqual import (07); check-1
      code (17); phase-2 non-runnable listings (07/08/17); zlib output blocks (16).

**P4 · Mechanical sweep (one pass):**
- [ ] 26. 30 slug-form links → .md form (fixlinks.py dry-run then --apply).
- [ ] 27. Stale footers: "(being written)" ×3 in phase-8, "(not yet written)"
      `phase-6/16:249`, "when written" `phase-10 README:59`; plain-text footers
      (phase-8/08, phase-10 09–12); syllabus-pointing cross-refs (phase-5/04+26,
      phase-6/02+04); badge-text "Learn When Needed" outliers; phase-0 README
      "three pairs"; phase-5 README ordering note.

**P5 · Additions (user-approved direction, design in final report):**
- [ ] 28. "Implementation track" section in `docs/nodejs/README.md` (minimum path
      to ship, from the 2026-08-09 review §4.6).
- [ ] 29. NEW cookbook chapters per the user's instruction (see section above) —
      design approved? If not yet, propose before writing.

**Then:** same review+improve pass for the other languages (user's stated goal),
one language per session.

## Traps

- Do NOT run `yarn build`/`yarn start` without claiming the registry
  (`shared/session_build_devserver_registry.md`) — rule 12.
- Reviews dir is a historical record — never edit `syllabus-review.md`.
- Node pages' console blocks are sandbox-proven — do not delete/regenerate outputs.
- Use graphify for codebase questions (user asked explicitly; hooks enforce).
