---
name: cursor-dsa-system-design-history
description: Cold history rotated out of CURSOR-DSA-SYSTEM-DESIGN.md — superseded session blocks, verbatim. Opened by name or by recall.sh, never on the hot path
metadata:
  type: progress
---

# CURSOR-DSA-SYSTEM-DESIGN.md — history

---

<!-- rotated out of CURSOR-DSA-SYSTEM-DESIGN.md on 2026-09-08 -->

## 🔴 PAGES — position (opened 2026-09-07, session `9602e64d`)

**Standing order (user, 2026-09-07):** *"Continue DSA and System Design"* — the first message of a new
session after both syllabi were complete and pushed; read as the rule-5 approval for pages (the only
continuation left). No agents (the 2026-09-06 *"work on your self"* instruction is kept). Order:
**System Design phase 0 → DSA phase 0 → alternate by phase.** One topic at a time, closed before the next.

**Research banks (fetch once per phase, write every page from the bank):**
`research_system-design_phase0.md` — Norvig timing table, SRE book ch.3 + ch.4, Dynamo §2.2/§2.3/§4.5/§4.6, Raft abstract/§2/§5/Fig.3, Bigtable + Spanner abstracts, Jepsen hierarchy. Kafka design doc NOT obtained (two fetches, nav shell only).

**✅ System Design phase 0 — `docs/system-design/pages/phase-0-the-interview/` — COMPLETE 2026-09-07 07:59: 13 topics, 14 files, 3,196 lines, all committed (last `git log` entry names it):**

| # | File | sidebar_position | State |
|---|---|---|---|
| 01 | `01-what-design-means-at-each-level.md` | 1 | ✅ 234 lines, 5 ★ |
| 01b | `01b-staff-and-reading-the-room.md` | 2 | ✅ 190 lines, 3 ★ — **split** of 01, proven 304→424 lines / 6→8 ★ |
| 02 | `02-the-three-design-rounds.md` | 3 | ✅ 289 lines, 5 ★ |
| 03 | `03-the-rubric.md` | 4 | ✅ 247 lines, 5 ★ |
| 04 | `04-the-vocabulary-contract.md` | 5 | ✅ 296 lines, 5 ★ |
| 05 | `05-the-latency-ladder.md` | 6 | ✅ 245 lines, 5 ★ |
| 06 | `06-reading-the-question.md` | 7 | ✅ 234 lines, 5 ★ |
| 07 | `07-the-common-ways-to-fail.md` | 8 | ✅ 232 lines, 4 ★ |
| 08 | `08-reasoned-wrong-beats-memorised-right.md` | 9 | ✅ 232 lines, 3 ★ |
| 09 | `09-communication-mechanics.md` | 10 | ✅ 212 lines, 4 ★ |
| 10 | `10-how-to-practise.md` | 11 | ✅ 234 lines, 4 ★ |
| 11 | `11-whiteboard-and-remote-tooling.md` | 12 | ✅ 191 lines, 2 ★ |
| 12 | `12-primary-sources.md` | 13 | ✅ 246 lines, 3 ★ |
| 13 | `13-how-this-track-relates.md` | 14 | ✅ 168 lines, 2 ★ |

(positions shift by one for every later split — keep them gap-free in the directory.)

**✅ DSA phase 0 — `docs/dsa/pages/phase-0-the-interview-and-practice/` — COMPLETE 2026-09-07 08:25: 14 topics, 15 files, all committed:**

| # | File | sidebar_position | State |
|---|---|---|---|
| 01 | `01-what-the-coding-rounds-grade.md` | 1 | ✅ 238 lines, 5 ★ |
| 02 | `02-the-45-minute-shape.md` | 2 | ✅ 249 lines, 4 ★ |
| 03 | `03-the-method.md` | 3 | ✅ 253 lines, 4 ★ |
| 04 | `04-language-choice-and-runtime-traps.md` | 4 | ✅ 249 lines, 5 ★ |
| 04b | `04b-java-traps-and-sorting.md` | 5 | ✅ SPLIT of 04 |
| 05 | `05-reading-the-constraints.md` | 6 | ✅ 198 lines, 4 ★ |
| 06 | `06-spaced-repetition-and-the-mistake-log.md` | 7 | ✅ 200 lines, 4 ★ |
| 07 | `07-the-when-stuck-protocol.md` | 8 | ✅ 219 lines, 4 ★ |
| 08 | `08-testing-your-own-code-live.md` | 9 | ✅ 202 lines, 4 ★ |
| 09 | `09-the-ladders.md` | 10 | ✅ 165 lines, 2 ★ |
| 10 | `10-mock-interviews.md` | 11 | ✅ 189 lines, 3 ★ |
| 11 | `11-communication-mechanics.md` | 12 | ✅ 165 lines, 4 ★ |
| 12 | `12-javas-collections-for-interviews.md` | 13 | ✅ 278 lines, 4 ★ |
| 13 | `13-how-this-track-relates-to-javascript.md` | 14 | ✅ 129 lines, 2 ★ |
| 14 | `14-competitive-programming-vs-interviews.md` | 15 | ✅ 122 lines, 2 ★ |

(superseded — see the SD phase 1 table below) After DSA phase 0: **System Design phase 1** (`docs/system-design/pages/phase-1-the-method/`, 18 topics — fetch a research bank first), then DSA phase 1, alternating.



**✅ System Design phase 1 — COMPLETE 2026-09-07 16:25 (18 topics, 19 files, 4,388 lines, 76 ★) — `docs/system-design/pages/phase-1-the-method/` (18 topics from `docs/system-design/syllabus/01-the-interview-and-the-method.md` phase 1; file names fixed, keep them; research bank `research_system-design_phase1.md` — C4 model, ADRs, RFC 9110 safe/idempotent, plus the phase-0 bank's SRE book quotes; `_category_.json` `{"label":"01 · The method: requirements to deep dives","position":1,"collapsed":true}`; phase README modelled on phase 0's):**

| # | File | sidebar_position | State |
|---|---|---|---|
| 01 | `01-functional-requirements.md` | 1 | ✅ 193 lines, 4 ★ |
| 02 | `02-non-functional-requirements.md` | 2 | ✅ 217 lines, 4 ★ |
| 03 | `03-back-of-the-envelope-estimation.md` | 3 | ✅ 212 lines, 4 ★ |
| 04 | `04-traffic-shapes.md` | 4 | ✅ 226 lines, 4 ★ |
| 05 | `05-the-api-sketch.md` | 5 | ✅ 263 lines, 4 ★ |
| 06 | `06-the-data-model-from-access-patterns.md` | 6 | ✅ 235 lines, 4 ★ |
| 07 | `07-the-high-level-diagram.md` | 7 | ✅ 210 lines, 4 ★ |
| 08 | `08-read-path-and-write-path.md` | 8 | ✅ 254 lines, 4 ★ |
| 09 | `09-choosing-the-deep-dives.md` | 9 | ✅ 175 lines, 4 ★ |
| 10 | `10-trade-offs-in-one-sentence.md` | 10 | ✅ 208 lines, 4 ★ |
| 11 | `11-bottlenecks-and-single-points-of-failure.md` | 11 | ✅ 170 lines, 6 ★ |
| 11b | `11b-the-load-walk-and-the-price-of-redundancy.md` | 12 | ✅ 185 lines, 2 ★ — **split** of 11, proven 315→355 lines / 6→8 ★ |
| 12 | `12-the-scaling-walk.md` | 13 | ✅ 258 lines, 4 ★ |
| 13 | `13-designing-for-cost.md` | 14 | ✅ 283 lines, 4 ★ |
| 14 | `14-evolution-and-operations.md` | 15 | ✅ 240 lines, 4 ★ |
| 15 | `15-time-management.md` | 16 | ✅ 231 lines, 4 ★ |
| 16 | `16-estimation-worked-examples.md` | 17 | ✅ 259 lines, 4 ★ |
| 17 | `17-the-same-method-in-writing.md` | 18 | ✅ 273 lines, 4 ★ |
| 18 | `18-diagrams-that-scale.md` | 19 | ✅ 237 lines, 4 ★ |

**✅ DSA phase 1 — COMPLETE 2026-09-07 16:55 (11 topics, 15 files, 3,235 lines, 63 ★) — `docs/dsa/pages/phase-1-complexity/` (11 topics from `docs/dsa/syllabus/01-foundations.md` phase 1; file names fixed below; research bank `research_dsa_phase1.md`; `_category_.json` `{"label":"01 · Complexity analysis","position":1,"collapsed":true}`; phase README modelled on DSA phase 0's):**

| # | File | sidebar_position | State |
|---|---|---|---|
| 01 | `01-big-o-theta-and-omega.md` | 1 | ✅ 298 lines, 6 ★ |
| 02 | `02-reading-complexity-off-code.md` | 2 | ✅ 256 lines, 4 ★ |
| 02b | `02b-recursion-as-a-tree.md` | 3 | ✅ split of 02, proven 331→365 lines / 6→7 ★ |
| 03 | `03-amortised-analysis.md` | 4 | ✅ 218 lines, 4 ★ |
| 03b | `03b-union-find-and-the-limits-of-amortised.md` | 5 | ✅ split of 03, proven 320→353 lines / 6→7 ★ |
| 04 | `04-space-and-the-recursion-stack.md` | 6 | ✅ 184 lines, 4 ★ |
| 04b | `04b-tail-calls-and-the-explicit-stack.md` | 7 | ✅ split of 04, proven 304→339 lines / 6→7 ★ |
| 05 | `05-the-common-classes-and-what-the-limits-imply.md` | 8 | ✅ 281 lines, 6 ★ |
| 06 | `06-hidden-costs.md` | 9 | ✅ 245 lines, 3 ★ |
| 06b | `06b-hash-keys-and-the-test-for-hidden-loops.md` | 10 | ✅ split of 06, proven 305→340 lines / 6→7 ★ |
| 07 | `07-complexity-of-the-built-ins.md` | 11 | ✅ 262 lines, 6 ★ |
| 08 | `08-recurrences-and-the-master-theorem.md` | 12 | ✅ 240 lines, 4 ★ |
| 09 | `09-best-average-and-worst.md` | 13 | ✅ 254 lines, 5 ★ |
| 10 | `10-benchmarking-vs-analysis.md` | 14 | ✅ 225 lines, 4 ★ |
| 11 | `11-proving-optimality.md` | 15 | ✅ 217 lines, 4 ★ |

**✅ System Design phase 2 — COMPLETE 2026-09-07 18:08 (18 topics, 34 files) — `docs/system-design/pages/phase-2-request-path/` (18 topics from `docs/system-design/syllabus/02-the-network-path-and-caching.md` phase 2; file names fixed below; research bank `research_system-design_phase2.md` + phase-0 latency rows; `_category_.json` `{"label":"02 · The request path: DNS to gateway","position":2,"collapsed":true}`; phase README modelled on phase 1's):**

| # | File | sidebar_position | State |
|---|---|---|---|
| 01 | `01-from-the-tap-to-the-first-byte.md` | 1 | ✅ 261 lines, 6 ★ |
| 02 | `02-load-balancing-layer-4-vs-layer-7.md` | 2 | ✅ 251 lines, 6 ★ |
| 03 | `03-reverse-proxies-and-api-gateways.md` | 3 | ✅ 251 lines, 6 ★ |
| 04 | `04-stateless-services-and-where-the-state-went.md` | 4 | ✅ 254 lines, 6 ★ |
| 05 | `05-cdns.md` | 5 | ✅ 250 lines, 6 ★ |
| 06 | `06-long-lived-connections.md` | 6 | ✅ 300 lines, 6 ★ |
| 07 | `07-rate-limiting.md` | 7 | ✅ 284 lines, 6 ★ |
| 08 | `08-timeouts-retries-and-budgets.md` | 8 | ✅ 296 lines, 6 ★ |
| 09 | `09-dns-as-a-component.md` | 9 | ✅ 256 lines, 5 ★ |
| 10 | `10-tls-termination-and-where-it-lives.md` | 10 | ✅ 251 lines, 6 ★ |
| 11 | `11-http-1-1-http-2-and-http-3.md` | 11 | ✅ 249 lines, 6 ★ |
| 12 | `12-service-discovery.md` | 12 | ✅ 241 lines, 6 ★ |
| 13 | `13-serialization-on-the-wire.md` | 13 | ✅ 248 lines, 6 ★ |
| 14 | `14-connection-pooling-and-keep-alive.md` | 14 | ✅ 266 lines, 6 ★ |
| 15 | `15-the-path-in-the-storefront.md` | 15 | ✅ 244 lines, 6 ★ |
| 16 | `16-service-mesh.md` + `16b-mesh-mtls-and-workload-identity.md` + `16c-mesh-retries-timeouts-and-circuit-breaking.md` + `16d-mesh-traffic-splitting-and-canaries.md` + `16e-what-a-service-mesh-costs.md` + `16f-north-south-and-east-west.md` + `16g-when-a-mesh-earns-its-cost.md` | 16, 16.1–16.6 | ✅ **7 files**, 1,875 lines, 42 ★ — split proof 485→1,875 |
| 17 | `17-gateway-patterns.md` + `17b-aggregation-and-partial-failure.md` + `17c-the-fan-out-n-plus-1.md` + `17d-routing-versus-orchestration.md` + `17e-graphql-at-the-edge.md` + `17f-graphql-authorisation-cost-and-federation.md` | 17, 17.2–17.7 | ✅ **6 files**, 1,517 lines, 43 ★ — split proof 471→1,517 / 10→43 ★ |
| 18 | `18-abuse-at-the-edge.md` + `18b-the-waf-and-its-false-positives.md` + `18c-bots-challenges-and-the-ladder.md` + `18d-abuse-that-is-business-logic.md` + `18e-degrading-instead-of-falling-over.md` | 18, 18.2–18.8 | ✅ **5 files**, 1,311 lines, 32 ★ — split proof 470→1,311 / 8→32 ★ |

**✅ SD phase 2 closed 2026-09-07 18:08.** Pushed as `db0c26c4` (rebased onto `64c0eda2`, a sibling
session's currency refresh). `gate.sh` clean (34 files, 0 problems); corpus `yarn linkcheck` clean
(7,113 files, 0 problems).

🔴 **NEXT: DSA phase 2** — `docs/dsa/pages/phase-2-recursion-maths-bits/` (13 topics). **The
directory is already scaffolded and committed** (`README.md` with all 13 ⬜ rows + `_category_.json`,
gate clean) and **the research bank is already fetched**: [research_dsa_phase2.md](research_dsa_phase2.md).
Write from the bank; do not re-fetch. First file: **`01-recursion-and-the-call-stack.md`**
(`sidebar_position: 1`).

**Per-page cadence (done for every page so far):** write → `wc -l` → `mdxcheck.py --no-rawtag <dir>` → `yarn linkcheck <dir>` →
phase `README.md` row → `docs/system-design/pages/README.md` phase row → `src/data/progress.js` (`pages` for the
phase + `updated`) → `docs/README.md` two rows → `node scripts/page-counts.mjs` → `node scripts/status.mjs` →
`git add` explicit paths (include `src/data/page-counts.json`, `static/status.json`) → commit → repoint here.
Page shape: the Java phase-0 pages (`docs/java/pages/phase-0-platform-jvm/02-jdk-jre-jvm.md`); phase README
shape: MongoDB phase 6 (`docs/mongodb/pages/phase-6-aggregation/README.md`) with a `State` column.

## Position

| | |
|---|---|
| Written | system-design: 01 (ph 0–1, 31 rows) · 02 (ph 2–3, 34 rows) · 03 (ph 4–5, 34 rows) · 04 (ph 6–7, 35 rows) · 05 (ph 8–9, 37 rows) · 06 (ph 10–11, 36 rows) · 07 (ph 12–14, 58 rows) · 08 (ph 15–16, 32 rows) · 09 (ph 17, 25 rows) · 10 (ph 18, 28 rows) · 11 (ph 19–20, 51 rows) · 12 (ph 21–22, 53 rows) · 13 (ph 23, 18 rows) — ALL 13 PARTS ON DISK · README (472 topics: M 220 / U 194 / K 58) · pages stub · footers · CARD WIRED (progress.js `'system-design'`, stack.js layer 'Architecture and interviews', sidebars.js, docs/README rows, page-counts.json) — devbible `git log` has it · **dsa: 01 (ph 0–2, 38 rows) · 02 (ph 3–5, 42 rows) · 03 (ph 6–8, 36 rows) · 04 (ph 9–11, 36 rows) · 05 (ph 12–13, 31 rows) · 06 (ph 14–16, 53 rows) · 07 (ph 17–18, 33 rows) · 08 (ph 19–20, 32 rows) — ALL 8 DSA PARTS ON DISK** · DSA README (301 topics: M 146 / U 113 / K 42) · stub · footers · CARD WIRED. ✅ **LANE CLOSED 2026-09-07 07:21** |
| 🔴 **NEXT FILE** | **`docs/dsa/pages/phase-2-recursion-maths-bits/01-recursion-and-the-call-stack.md`** (`sidebar_position: 1`, written from [research_dsa_phase2.md](research_dsa_phase2.md) — already fetched; the phase directory, its README with 13 ⬜ rows and `_category_.json` are already committed). |
| Then | *(done)* — see the Owed list: every item is ticked as of 2026-09-07 07:21 |
| Ceiling | none — write it all; split a part on a phase boundary at 301 lines |

## The plan — parts and phases (phase numbers are global per track)

**system-design:** 01 interview + method (ph 0–1) · 02 network path + caching (2–3) · 03 storage + data (4–5) ·
04 distributed theory (6–7) · 05 event streaming + async (8–9) · 06 API design (10–11) ·
07 cloud + Kubernetes + IaC (12–14) · 08 reliability + observability (15–16) · 09 security + compliance (17) ·
10 AI systems (18) · 11 low-level design (19–20) · 12 the HLD catalogue (21–22) · 13 the senior loop + proof of work (23)

**dsa:** 01 foundations (ph 0–2) · 02 arrays, strings, hashing (3–5) · 03 linear structures + binary search (6–8) ·
04 trees, heaps, tries (9–11) · 05 graphs (12–13) · 06 backtracking, greedy, DP (14–16) ·
07 design-flavoured + applied (17–18) · 08 the ladder + the plan (19–20)

## Owed before the lane closes

1. every part file above, ≤ 300 lines, `{/* NAV */}` replaced by the real footer
2. `docs/<track>/README.md` (tier distribution counted from badges, not estimated) and `docs/<track>/pages/README.md` stub (Java's first version is the model)
3. wiring: `sidebars.js` (`dsaSidebar`, `systemDesignSidebar`), `src/data/progress.js` (`dsa`, `'system-design'` with `topics` per phase = row counts, `pages: 0`), `src/data/stack.js` (new layer; drop the parked GraphQL/tRPC/Kubernetes items it now covers), `docs/README.md` (claim row + two Coverage rows), regenerate `src/data/page-counts.json`
4. QC: `wc -l`, `mdxcheck.py`, `fixlinks.py` dry-run, `node scripts/status.mjs`
5. commit explicit paths (devbible is committed, **not pushed** — the user pushes), clear the registry row, update LOCKS §0b, INDEX entry

## Wiring recipe (step 3 in detail — do it once every part exists)

- **NAV footer:** replace the last line `{/* NAV */}` of each part with `← Index: [System Design](../README.md) · Next → [Part N — Title](NN-file.md)` (last part: `← Prev … · Index`), copying `docs/java/syllabus/01-foundations.md`'s last line.
- **`docs/<track>/README.md`:** model on `docs/java/README.md` — `> Verified:` line, intro, "Where this sits, as of <month>" table (only facts verified via WebFetch; otherwise the corpus pins: Node 24 LTS until 2026-10-28, Java 25), Parts table linking real files, a "The concept lives in / This track adds" table like `docs/real-world/README.md`, `import Progress …` + `<Progress lang="dsa" compact />` (key `system-design` for the other), Tier legend, Tier distribution **counted** with `grep -c 't-master' syllabus/*.md` etc., Prerequisites, Reading order, Sources.
- **`docs/<track>/pages/README.md`:** copy the FIRST Java version (`git show 8f6b95ce:docs/angular/pages/README.md` is the same shape): "Nothing is written yet", `<Progress lang=… />`, one `Planned` row per phase with its row count, `← Index: [Track](../README.md)`.
- **`sidebars.js`:** `dsaSidebar: [{type: 'autogenerated', dirName: 'dsa'}]`, `systemDesignSidebar: [{type: 'autogenerated', dirName: 'system-design'}]`.
- **`src/data/progress.js`:** entries `dsa: {label: 'DSA', updated: '<date HH:MM>', docsPath: '/docs/dsa', pagesPath: '/docs/dsa/pages', phases: [{n, slug: 'phase-N-<kebab>', name, part, topics: <rows>, pages: 0}, …]}` and `'system-design': {label: 'System Design', …}`. `topics` = the row count per phase from `qc.sh` output (system-design ph0 13, ph1 18, ph2 18, ph3 16 so far). Insert after `realworld`.
- **`src/data/stack.js`:** new layer before 'Beyond the core stack': `{name: 'Architecture and interviews', note: 'What the senior loop tests', items: [{key: 'dsa', desc: '…'}, {key: 'system-design', desc: '…'}]}`; delete the parked GraphQL/tRPC/Kubernetes items (now inside System Design) and the layer if it is then empty.
- **`docs/README.md`:** append one row to the "Active work" table (claim: session id, since 2026-09-06, state) and one Coverage row per track at the bottom of the main table: `| **[DSA](./dsa/README.md)** | 8 parts · N topics | Syllabus only — pages not started |`.
- **`src/data/page-counts.json`:** regenerate with `node scripts/page-counts.mjs` (skips tracks with no `pages/` dir; ours have one with only README + `_category_.json`, so expect a 0-page entry) and commit it.
- **QC:** `wc -l` every file · `python3 …/shared/scripts/mdxcheck.py --no-rawtag docs` — ⚠️ it scans **git-changed files**, not a directory tree, so run it while the files are still uncommitted or pass the docs root · `python3 …/shared/scripts/fixlinks.py` dry-run · `node scripts/status.mjs` must not throw with the new keys · **no build, no dev server** (rule 8).

## Cold-start note (2026-09-07 18:10, session `5c396fd0` — WOUND DOWN at 90 % usage on the user's instruction)

**The user's words:** *"Continue with DSA and System design and deploy 3 ageents and assign and split the
task between them and you can monitor the ageents"*, then *"Signal everything for winddown are at 90% of
usage save the session progress and push everything to github and no need to monitor CI just signal them
do not interrupt"*. Everything below is committed and **pushed**; nothing is half-written.

**Landed:** ✅ **System Design phase 2 COMPLETE** — 18/18 topics, 34 files. Topic 16 (7 files), 17 (6),
18 (5), all written by three parallel agents. devbible `db0c26c4` pushed; **CI deliberately not watched**
(the user's instruction) — a deploy run follows that push and nobody is waiting on it.

**Also landed, ready for the next session to start writing immediately:**
- [research_dsa_phase2.md](research_dsa_phase2.md) — 9 primary sources fetched and banked (MDN bitwise
  32-bit coercion, `MAX_SAFE_INTEGER`, `BigInt`, the `Array.prototype.sort` comparator contract,
  `Math.random`, "too much recursion"; Java 25 `Math.floorMod`/`addExact`, `Integer`'s bit methods,
  `Collections.shuffle`). **Do not re-fetch.**
- `docs/dsa/pages/phase-2-recursion-maths-bits/` scaffolded and committed — README with all 13 ⬜ rows
  (wire.py-compatible), `_category_.json` `{"label":"02 · Recursion, maths and bits","position":2,"collapsed":true}`.

🔴 **THE AGENT SPLIT PLAN, ALREADY DESIGNED — reuse it.** Three agents, topics paired so each agent's
two pages share their half of the research bank:
| Agent | Topics |
|---|---|
| A | 01 recursion and the call stack · 02 divide and conquer |
| B | 03 mathematical foundations · 07 fast exponentiation and the modular inverse |
| C | 04 bit manipulation · 05 integer limits and overflow |
Then a second wave: D 06 backtracking skeleton + 09 bitmask enumeration · E 08 combinatorics +
12 matrix exponentiation · F 10 randomisation + 11 number problems + 13 geometry basics.

🔴 **WHAT THE THREE-AGENT RUN ACTUALLY TAUGHT — read before dispatching the next wave:**
1. **Every one of the three topics blew the 300-line cap on the first draft** (485, 471, 470) and every
   one split correctly, with both totals rising. **Budget for that**: a "one page" dispatch reliably
   produces 5–7 files. That is the expected outcome, not an overrun.
2. **An agent mid-split leaves stale sibling files on disk.** Topic 16 briefly had two `16b-` and two
   `16c-` files with a duplicate `sidebar_position: 16.4`. It cleaned them up itself once it converged —
   **do not intervene early**; wait for the parent file to drop under the cap, then check
   `grep -h '^sidebar_position:' *.md | sort -n | uniq -d` for collisions.
3. **Agents cannot renumber `sidebar_position` when siblings are writing the same directory concurrently.**
   All three independently chose decimals (16.1–16.6, 17.2–17.7, 18.2–18.8). That works and the sidebar
   orders correctly. Keep it; it is now this phase's convention.
4. **The footer chain is the session's job and is strictly sequential** — 15→16→16b→…→18e. Agents end
   every file with the literal `{/* FOOTER */}` and the session rewrites all of them in one pass. This is
   why no page can be wired before the one before it.
5. **`wire.py` does not fit a multi-file topic** — it flips one numbered README row. For split topics the
   session rewrites the phase README table directly (a ~30-line python pass); everything else
   (pages board, `progress.js`, `docs/README.md`, `page-counts.json`, `status.json`) still applies.
6. **Two agents independently hit a fetch wall:** `graphql.org/learn/caching/` and
   `spec.graphql.org/October2021/` both returned **403**. Nothing is quoted from either; every GraphQL
   claim in 17e/17f is written as mechanism and the `> Verified:` lines say so. **A future session wanting
   quotable GraphQL primary source needs a different fetch path.**
7. **Push conflicts are normal here.** `origin/main` had moved (a sibling session's currency refresh);
   `git -c rebase.autoStash=true rebase origin/main` handled it, and `graphify-out/cache/last_query_stamp`
   is a permanently-dirty file that is not ours — autostash is the way past it.
8. **An agent can still be editing after it reports.** 16c gained a real paragraph *after* the commit was
   made; it was folded in with `--amend` before the push. **Re-check `git status` right before pushing.**

**Superseded topic-16 draft files** were moved to this session's scratchpad (`superseded-16-splits/`),
not deleted. They are strictly covered by 16b/16c/16d and nothing is owed on them.

## Cold-start note (2026-09-07 17:28, session `cac93078` — PAUSED on the user's instruction: *"commit everything right now and push it and wait for signal before you proceed"*)

**State at pause — all committed in devbible and pushed to `origin/main` (deploy runs 34112489795, 34114378267, 34116857685 all green; a fourth run follows the 17:28 push).** SD phase 1 ✅ 18/19 files · DSA phase 1 ✅ 11/15 files · **SD phase 2: 15 of 18 written**, next `16-service-mesh.md` (`sidebar_position: 16`), then 17, 18; after that **DSA phase 2** (check the slug in `progress.js`, fetch a research bank first). Do not proceed until the user signals. Per-page chain and tools unchanged (below). Drafts are written to the session scratchpad first and copied into `docs/` before the gate, so a directory gate never sees a half-written file.

## Cold-start note (2026-09-07 08:43, session `9602e64d` — STOPPED by the user: *"Enough for now just save the session progress"*)

**State at stop — everything below is committed in devbible and pushed in this store. Nothing is half-written.**

| Track / phase | State |
|---|---|
| System Design phase 0 (`docs/system-design/pages/phase-0-the-interview/`) | ✅ COMPLETE — 13 topics, 14 files (01 split into 01/01b), 3,300 lines, 55 ★ |
| DSA phase 0 (`docs/dsa/pages/phase-0-the-interview-and-practice/`) | ✅ COMPLETE — 14 topics, 15 files (04 split into 04/04b), 3,029 lines, 53 ★ |
| System Design phase 1 (`docs/system-design/pages/phase-1-the-method/`) | 🚧 **10 of 18** — topics 01–10 written and wired; **NEXT = `11-bottlenecks-and-single-points-of-failure.md`** (`sidebar_position: 11`, Master) |
| DSA phase 1 (`docs/dsa/pages/phase-1-complexity/`) | ⬜ not started — after SD phase 1 closes (alternating by phase) |

✅ **devbible `main` was pushed 2026-09-07 16:05 (session `cac93078`, user: *"merge everything and … deploy"*); later commits are pushed by the session at the user's request.** Last devbible commit: `179b6f1a system-design ph1: topic 10 'trade-offs in one sentence' (208 lines, 4 ★); re-linked 09→10; boards, progress.js pages=10, page-counts, status`.
Every page passed the gate (cap, real MDX compile via `yarn mdxcheck <dir>`, `yarn linkcheck <dir>`) before its commit; boards (`phase README`, `pages/README.md`, `progress.js`, `docs/README.md`, `page-counts.json`, `status.json`) are current through SD ph1 topic 10.

**Standing order for the next session:** open this file, go to the NEXT FILE row, write that page from
`research_system-design_phase1.md` (+ the SRE quotes in `research_system-design_phase0.md`), then run the cadence below. No agents (user: *"work on your self"*). Two mid-session user instructions to keep: save progress per page (done — cursor + LOCKS repointed and pushed after every file), and report failures in one line.

**Tools — copied into the store at `tools-dsa-system-design/`** (they lived in `/tmp` this session):
`wire.py` (marks the phase-README row ✅, re-links the previous page's footer, updates the pages board row, `progress.js` pages/updated, and the `docs/README.md` row), `store.py` (flips the cursor table row ✅ / next **NEXT**, rewrites the NEXT FILE row, updates the LOCKS count), `delink.py` (turns any `[label](NN-file.md)` whose target is missing into `**label** *(not written yet)*` — run it on every new page BEFORE the gate), `gate.sh` (cap + `yarn mdxcheck` + `yarn linkcheck` with a real non-zero exit). Usage lines are in each file's docstring; the per-page chain used all session was:
`python3 delink.py <page> && bash gate.sh <dir> && python3 wire.py <track> <phasedir> <phaseN> <total> <NN> <file> "<NN · Label>" <prevfile> '<prev footer title>' && node scripts/page-counts.mjs && node scripts/status.mjs && bash gate.sh <dir> && git add <explicit paths> && git commit && python3 store.py "<Label phase N>" <total> <NN> <lines> <stars> <nextNN> <nextfile> <nextpos> <nextdir> <bank> && (store) git add/commit/push`.

**Two incidents this session, both fixed, both worth knowing:**
1. `yarn linkcheck <dir> 2>&1 | tail -1` masks the exit code — page 07 of SD ph1 was committed with three dangling forward links (commit `9aa3a917`, fixed in `4f1cc21c`). `gate.sh` exists because of this; never pipe a gate through `tail`.
2. `mdxcheck.py` does not catch a bare `{…}` in prose; the user's real build failed on DSA ph0 03 ("Could not parse expression with acorn"). Fixed by backticking; `yarn mdxcheck <dir>` (the real compiler) is now in the gate and must stay there.

**Pending outside this lane (found, not fixed):** `devbible/INDEX.md` in this store is over the 300-line cap (pre-existing); the older corpus decisions in [CURSOR-AUDIT.md](CURSOR-AUDIT.md).

Superseded blocks from [CURSOR-DSA-SYSTEM-DESIGN.md](CURSOR-DSA-SYSTEM-DESIGN.md), verbatim, newest first. Nothing here was dropped;
it was moved so the live file stays inside its 160-line budget.

Search rather than read: `shared/scripts/recall.sh --cold <terms>`

