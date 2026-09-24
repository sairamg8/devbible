---
name: devbible-index-meta
description: devbible index shard — gates, hooks, audits, dashboards, currency, house rules, and every piece of feedback from the user
metadata:
  type: reference
---

# devbible index — Meta — the site and how we work

Gates, hooks, audits, dashboards, currency, house rules, and every piece of feedback from the user.

**One line per memory: the claim, then the terms to search on.** If an entry tells you the
answer, the file has been duplicated into a surface every session loads — put the answer in
the file. Budget: 108 entries, sharded at 120 ([../shared/MEMORY-ARCHITECTURE.md](../shared/MEMORY-ARCHITECTURE.md)).

> 🗄️ **Not here? It is not missing.** The pre-2026-09-08 index, with the long-form summary
> of every entry, is verbatim in [INDEX-ARCHIVE.md](INDEX-ARCHIVE.md); closed lanes are in
> [LOCKS-ARCHIVE.md](LOCKS-ARCHIVE.md). Search all of it without loading any of it:
> `shared/scripts/recall.sh <terms>`


## Feedback — how the user wants this worked

- [🔴 Never build/test locally — commit, push, verify in GitHub Actions (2026-09-24)](feedback_never_run_local_build_or_check_ci.md) — per-file gates stay linkcheck + mdxcheck `yarn build` `gh run` `CI`
- [🔴 Hub + delta: link free basics, write the gaps (2026-09-14)](feedback_hub_plus_delta_20260914.md) — PERN/MERN, then Java; vs brief §5 `w3schools` `MDN` `gap` `delta`
- [Answer the user briefly — every time (2026-09-04)](feedback_answer_simply.md) — The user wants SHORT, simplified answers every time — asked twice on 2026-09-04 ("simplify", then "every time you…
- [Answer the question asked](feedback_answer_the_question_asked.md) — 2026-08-17 — asked whether pages were chunked to get under 300, I audited for "content debt" instead and started… `nn-topic/`
- [Audit External Reviews](feedback_audit_external_reviews.md) — External reviews of the Dev Bible get audited against instructions.md before anything is applied — they have been… `review` `second opinion` `audit` `verify`
- [COUNTING TRAP — tiers by the first badge, not grep -rl…](feedback_count_by_first_tier_badge.md) — Counting pages per tier with grep -rl over-counts, because phase index pages list every tier — count the first badge…
- [Git only — the standing order](feedback_git_only_20260814.md) — Standing order — Git is locked to session 45e775dc; docs/git only, phases 1-12, doc-validated not sandboxed,… `docs/git/` `master` `git-filter-repo` `git-lfs`
- [STANDING ORDER — Claude never spends usage on graphify; ASK…](feedback_graphify_never_costs_claude_usage.md) — 🔴 STANDING ORDER (2026-09-06) — Claude must never be the LLM that graphify falls back to. Gemini…
- [Incremental Scope](feedback_incremental_scope.md) — Do one step at a time on the Dev Bible — no mass scaffolding ahead of being asked `scope` `one at a time` `do not scaffold` `approve first` `stop and report`
- [MDX backtick-escape trap](feedback_mdx_backtick_escape_trap.md) — An escaped backtick inside a single-backtick code span does NOT escape — it closes the span, unbalances the line and…
- [mdxcheck --no-rawtag hides a build breaker](feedback_mdxcheck_no_rawtag_hides_a_build_breaker.md) — 🔴 misses bare `<word>` and `<=`; the real gate is `mdx-compile-check.mjs` (recurred 2026-09-10)
- [Memory File Cap](feedback_memory_file_cap.md) — Memory files are capped at 300 lines — past that, split into children and index them from the parent with a one-line… `memory` `300 lines` `too long` `split` `chunk`
- [Update memory as you go](feedback_memory_update_cadence.md) — Update the memory store after every completed file and every completed phase — not once at the end of a session `memory` `cadence` `when to save` `after every file`
- ["Merge to main" ALWAYS includes the push (2026-08-31)](feedback_merge_implies_push.md) — Standing instruction 2026-08-31 — "merge to main" ALWAYS includes pushing to origin. Never stop to ask for push…
- [Merge to main includes the push](feedback_merge_to_main_includes_push.md) — In devbible, "merge to main" is a standing instruction that INCLUDES pushing to origin. Never stop to ask for the…
- [MOVE, DON'T REWRITE (2026-08-14)](feedback_move_dont_rewrite.md) — When asked to move or import existing content, move it and edit in place — never author replacement prose. Given in…
- [Chunk Means Split, Never Condense](feedback_never_compress_to_fit_cap.md) — The 300-line per-file cap is hard — a bigger topic is SPLIT across multiple files, never condensed to fit; the… `300 lines` `cap` `hard limit` `chunk`
- [No new sandbox scripts](feedback_no_new_sandbox_scripts.md) — Standing rule from 2026-08-13 — no sandbox scripts at all (usage cost). Write explanations and verify them against… `> verified:` `no new scripts` `usage` `cost`
- [One topic at a time](feedback_one_topic_at_a_time.md) — Standing order 2026-08-30 — finish and CLOSE the current topic before opening another, and distribute parallel work… `readme.md` `_phase-notes.md` `one topic` `one chapter`
- [One workflow at a time, and save the moment you dispatch](feedback_one_workflow_at_a_time.md) — Standing order 2026-09-06 — dispatch ONE Workflow at a time, never two in parallel, and write the session's progress…
- [A running Workflow cannot be drained — only aborted](feedback_workflow_cannot_drain_20260921.md) — user 2026-09-21: finish current agents, launch no more. Not possible mid-run; bound each Workflow to ≤3 topics
- [Parallel sessions share the working tree](feedback_parallel_sessions.md) — Several Claude sessions work on devbible at once, sharing one working tree and one git HEAD — what that breaks and… `progress.js` `parallel` `concurrent`
- [SUPERSEDED — React only, in a worktree (2026-08-14)](feedback_react_only_worktree_20260814.md) — Standing instruction — React only, in a worktree (2026-08-14) `~/.claude/claude.md` `63fa2a80` `main` `memory.md`
- [Shared-FILE staging: git add <path> is not enough (2026-09-04)](feedback_shared_file_staging.md) — "Stage explicit paths" is NOT enough protection on src/data/progress.js — several sessions edit that one file, and…
- [Topic cadence and handoff](feedback_topic_cadence_and_handoff.md) — The per-topic working loop — UI after every topic, memory every 3 topics, and on language completion update…
- [Verify in GitHub Actions, not with a local full build…](feedback_verify_in_ci_not_locally.md) — Do NOT run a full yarn build locally to verify devbible work — commit, push, and read the result from GitHub…
- [Verify Your Own Measurements](feedback_verify_your_own_measurements.md) — Real console output can still be wrong evidence — check the measurement is not confounded before a number goes on a… `measure` `confounded`
- [Worktrees are temporary](feedback_worktrees_are_temporary.md) — 🔴 STANDING RULE — a worktree is temporary. Merge it to main and DELETE it in the same breath, branch included. Never… `main`

## Standing decisions

- [CURRENCY SYSTEM — how devbible stays up to date (2026-08-31)](project_currency_system.md) — How devbible stays current — a pin list, a script that checks it against upstream, and a weekly CI run. Open on… `grep` `> verified:`
- [Dev Bible Brief](project_devbible_brief.md) — The standing brief for the Dev Bible — scope, priority tiers, granularity rule, 300-line cap `brief` `scope` `tier` `master` `understand`
- [FOOTER PLACEHOLDER BACKLOG — 1,241 pages with NO prev/next…](project_footer_cleanup_scope.md) — The {/ FOOTER /} placeholder backlog — 1,241 pages ship with NO prev/next navigation, scoped per track and per phase…
- [Git syllabus](project_git_syllabus.md) — The Git syllabus — moved out of "parked" into scope as technology 12, 13 phases / 191 topics, with the measured git… `instructions.md` `master` `main` `replay` `last-modified`
- [React patterns and search split](project_react_patterns_and_search_split.md) — devbible — React patterns + site search, split two ways `phase-2/08` `phase-2/12` `phase-2/13` `phase-2/03` `phase-2/04`
- [React split parts ab](project_react_split_parts_ab.md) — The A/B split of the remaining React work across two parallel sessions — who owns which files, and the three shared…
- [React syllabus](project_react_syllabus.md) — The React syllabus — 15 phases, 244 topics, written 2026-08-13 and UI-wired; the measured React 19.2.8 API facts and… `viewtransition` `resume` `resumeandprerender` `cd` `docs/docs/`
- [Scope Boundaries](project_scope_boundaries.md) — Where each technology's syllabus stops — especially the Node/Express line and what stays project-based `boundary` `node vs express` `where does this belong` `overlap` `handoff`
- [Senior roadmap suggestions](project_senior_roadmap_suggestions.md) — The 2026-09-06 advisory answer to "what else gets me to a senior product-company package with PERN/MERN" — the 8…
- [THE TWO SKILLS — currency (versions) + topic (content),…](project_skills_system.md) — The two in-repo, agent-neutral skills — devbible-currency (versions, corpus-wide) and devbible-topic (content, one… `.agents/skills/`
- [VALIDATION PLAN — checking everything already written, 7…](project_validation_plan_multisession.md) — THE plan for validating every explanation page already written in devbible — two passes, seven parallel lanes, a…

## Gaps — what no gate catches

- [Stale *(not written yet)* markers](gap_stale_not_written_yet_markers.md) — a forward ref goes stale when its target lands and no gate catches it: it is bold text, not a link `not written yet` `map page` `topic close`

- [Gates do not validate frontmatter](gap_gates_do_not_validate_frontmatter.md) — 🔴 devbible's two gates — yarn mdxcheck and yarn linkcheck — do NOT validate YAML frontmatter or house-style marks. A…
- [The four ways prose becomes JSX and breaks the build](gap_mdxcheck_compiles_but_does_not_render.md) — 🔴 The four ways prose becomes JSX and kills a devbible build — bare <, bare {ident}, nested backticks, and a… `, bare`
- [Bare `{0}` renders "0", no gate says so](feedback_mdx_literal_braces.md) — fix `\{…\}`; 270 swept 2026-09-10… `{0}` `EXPRESSION` `mdx-escape-braces`

## Reference

- [Dispatching agents · QC · the five boards](reference_agent_dispatch_and_boards.md) — Cross-track: dispatch rules, the QC check for agent output, and the FIVE boards `dispatch` `agent` `qc` `boards`

- [Depth audit prompt](reference_depth_audit_prompt.md) — The reusable prompt for auditing whether existing pages were sized to the 300-line cap instead of written to full… `depth audit` `re-review` `too thin` `sized to the cap`
- [Phase 10 verification](reference_phase10_verification.md) — Verification pass over Grok's Phase 10 draft — what was measured on Node 24.19.0, what is still unverified, and the… `docs/` `phase 10` `grok` `external draft` `verify`
- [Phase 6 measurements](reference_phase6_measurements.md) — The full measured dataset for Node Phase 6 (data access) — every number, error code and console line the 16 pages… `phase 6` `data access` `measured` `pg` `mongodb`
- [Phase 7 measurements](reference_phase7_measurements.md) — The full measured dataset for Node Phase 7 (background work and resilience) — every number and console line the 16… `phase 7` `background` `measured` `bullmq` `redis`
- [Phase 9 measurements](reference_phase9_measurements.md) — The measured dataset behind Node Phase 9 (Testing) — runner discovery, isolation, assert edge cases, async traps,… `phase 9` `testing` `node:test` `assert` `mock`
- [Phase findings](reference_phase_findings.md) — Sandbox findings that contradicted common advice or corrected an already-written page, Node phases 0–5 — the reasons… `verified` `measured` `folklore` `nexttick order` `poolsize`
- [React concepts phase2](reference_react_concepts_phase2.md) — React Phase 2 concept record — every load-bearing claim on the 16 topics, with its source, so a later session can…
- [React concepts phase3](reference_react_concepts_phase3.md) — React Phase 3 concept record — the load-bearing claims across the 17 state/render-cycle topics, with sources
- [React concepts phase4](reference_react_concepts_phase4.md) — React Phase 4 (Effects) — the load-bearing claims per topic and the primary source each came from, for review or…
- [React concepts phase5](reference_react_concepts_phase5.md) — React Phase 5 (Refs, context and reducers) — the load-bearing claims per topic and the primary source each came from
- [React concepts phase6](reference_react_concepts_phase6.md) — React Phase 6 (Rendering performance and the React Compiler) — load-bearing claims per topic with primary sources
- [React Phase 7 concepts — custom hooks and the Rules of React](reference_react_concepts_phase7.md) — React Phase 7 (custom hooks and the Rules of React) — the load-bearing claims and their sources, so a later session… `storage`
- [React Phase 9 concepts — forms, Actions and optimistic UI](reference_react_concepts_phase9.md) — React Phase 9 (forms, Actions, optimistic UI) — the load-bearing claims and their sources, so a later session can… `values`
- [React validation status](reference_react_validation_status.md) — Which React pages are evidence-backed and which are written but not yet validated — the single tracker, replacing… `react` `validated` `unvalidated` `doc-checked`
- [Review system](reference_review_system.md) — How a phase gets reviewed — the reusable prompt, output path convention, the read-only rule, and the Grok/Gemini… `review` `ultrareview` `code-review ultra` `diff review`

## Progress — what happened, by lane

- [Audit workflow findings 20260906](progress_audit_workflow_findings_20260906.md) — The findings that SURVIVED the two multi-agent audit workflows before the session usage limit killed both synthesis…
- [devbible build warnings: 277 → 0 from the GitHub deploy log…](progress_build_warnings_20260903.md) — How devbible reached its first ZERO-warning deploy on 2026-09-03 — read the GitHub Actions log, not a local yarn…
- [Corpus audit 20260905](progress_corpus_audit_20260905.md) — Corpus-wide QC audit of 2026-09-05 — the measured baseline that replaces the 2026-08-16 one, the two dashboard…
- [B1 CLOSED — Node "Active LTS" expiry, 140 pages (2026-09-08)](progress_currency_node_lts_b1_20260908.md) — Not a 24→26 bump; the phrase was de-expired… `node 24` `active lts` `class 6 event`
- [CURRENCY SYSTEM — BUILT AND RUNNING (2026-08-31, commit…](progress_currency_system_build.md) — BUILT 2026-08-31 — pins.js, currency.mjs and the weekly workflow are on main and running. What the first real run… `1ae8f47e`
- [DASHBOARD RECONCILE — yarn status had been THROWING, so the…](progress_dashboard_reconcile_20260906.md) — The 2026-09-06 dashboard reconciliation — yarn status had been THROWING since page-counts.json landed, so… `e61a15b5`
- [Disk vs dashboard validation 20260906](progress_disk_vs_dashboard_validation_20260906.md) — Full disk-vs-dashboard reconciliation of 2026-09-06 — every track's page count, topic count, validated count and…
- [2026-09-04 — README frontmatter drift, storybook, and the…](progress_frontmatter_and_hooks_20260904.md) — Session 2026-09-04 — the topic README sidebarposition/sidebarlabel audit (473 to 509 of 609 conforming), the…
- [FULL CORPUS AUDIT — 2026-08-17, disk-verified](progress_full_corpus_audit_20260817.md) — Disk-verified board across all 25 technologies on 2026-08-17, plus three measurement traps that make the usual… `fixlinks.py` `readme.md`
- [Git A1 — interview questions closed 2026-09-06](progress_git_a1_interview_questions_20260906.md) — Audit item A1 CLOSED 2026-09-06 — all 36 git pages that lacked ## Interview questions now have it, so all 57 pages…
- [Git pages — live progress](progress_git_pages.md) — Live per-file progress for the Git explanation pages — the 2026-08-14 re-scope to 52 daily-driver topics, what is… `45e775dc` `ex3` `ex2` `git` `resume`
- [Homepage board sync 20260817](progress_homepage_board_sync_20260817.md) — Session e86a1703 (2026-08-17) — audited the homepage against disk, fixed the stale hero, three missing Complete… `e86a1703` `progress.js`
- [Homepage dashboard rebuild](progress_homepage_dashboard_rebuild.md) — 2026-08-31 — the homepage dashboard was rebuilt around derived data after the user said they did not like it. The… `recentlyupdated()`
- [Homepage: the imported toolchain tracks now score on…](progress_homepage_imported_track_status.md) — 2026-09-05 — the 11 imported frontend-toolchain tracks now carry a real status on the homepage, scored on pages… `46f68b97`
- [Overall snapshot — all languages (refreshed 2026-08-15 LATE,…](progress_overall_snapshot.md) — Point-in-time board across every devbible technology — refreshed 2026-08-15 (late) and VERIFIED AGAINST DISK, not…
- [REACT PART A — Phase 11 COMPLETE, 17/17 (2026-08-14)](progress_react_part_a_phase11.md) — React Part A — Phase 11 COMPLETE 17/17, merged to main; what each topic argues, the traps found, and what is… `main` `a583dae2`
- [React patterns chunk a](progress_react_patterns_chunk_a.md) — React patterns — chunk A · build progress `02b2af2d` `docs/react/` `f49e21d6` `as` `12-render-props.md`
- [React Phase 0 — COMPLETE](progress_react_phase0.md) — Live progress for React Phase 0 pages — updated after every page and at phase end; carries the sandbox harness facts… `sandbox/react-p0/` `react` `react-dom`
- [React Phase 1 — JSX](progress_react_phase1.md) — Live progress for React Phase 1 (JSX) — the sandbox/react-p1 scripts, the full measured dataset, and the per-page… `react-p1` `main` `e40c5b3` `react-phases` `locked`
- [REACT PART B — Phase 14 · Testing React (2026-08-14)](progress_react_phase14.md) — React Part B — Phase 14 "Testing React" is COMPLETE (14/14, merged into main). What was written, the sources used,… `on`
- [React Phase 2 — COMPLETE](progress_react_phase2.md) — React Phase 2 (Components, props and composition) — COMPLETE, the first fully doc-validated phase, and the resume… `c462cc8` `main` `> verified:` `exit=1` `proptypes`
- [React Phase 3 — COMPLETE](progress_react_phase3.md) — React Phase 3 (State and the render cycle) — COMPLETE, 17 topics, build-verified `91b17dd` `useref` `react` `phase 3` `state`
- [React Phase 4 — COMPLETE](progress_react_phase4.md) — React Phase 4 (Effects and synchronization) — COMPLETE, 18 topics, 27 files, 0 broken links, build-verified `useeffectevent` `useinsertioneffect` `react` `phase 4` `effects`
- [React Phase 5 — COMPLETE](progress_react_phase5.md) — React Phase 5 (Refs, context and reducers) — COMPLETE — 16 topics, 18 files, 0 broken links, 0 over cap `6ffd754d` `.docusaurus` `rm -rf .docusaurus` `react` `phase 5`
- [React Phase 6 — COMPLETE](progress_react_phase6.md) — React Phase 6 (Rendering performance and the React Compiler) — COMPLETE — 17 topics, 18 files, 0 broken links,… `rm -rf .docusaurus` `node_modules/.cache` `memo`
- [REACT — resume point: Phases 7, 8 AND 9 COMPLETE, Phase 10…](progress_react_phase7.md) — React resume point — Phases 0–11 COMPLETE and merged (Part A finished 2026-08-14); only Phase 14 remains, owned by… `, branch **`
- [Search — chunk B, DONE](progress_search_chunk_b.md) — devbible chunk B — local offline search via @easyops-cn/docusaurus-search-local. Measured baseline vs search build,… `f49e21d6` `gh-pages` `searchcontextbypaths`
- [Session 20260814 handoff](progress_session_20260814_handoff.md) — Full handoff for session 6f020813 (2026-08-14) — PostgreSQL closed out, CSS completed 74/74, MongoDB claimed and cut…
- [SESSION HANDOFF 2026-08-14 — React](progress_session_20260814_react.md) — Session handoff 2026-08-14 (session 6ffd754d) — React phases 4, 5 and 6 completed; MongoDB syllabus written and… `6ffd754d` `rm -rf .docusaurus`
- [SESSION 2026-08-15 · e75b3868 — board audit, then Docker…](progress_session_20260815_e75b3868.md) — Session record for e75b3868 (2026-08-15) — memory/board audit that found the snapshot badly stale, then Docker chunk…
- [JavaScript CHUNK B — FINISHED (2026-08-15)](progress_session_20260815_js_chunk_b.md) — Session 233dede7 — JavaScript chunk B finished (phase 17 closed 18/18). What was written, the sources quoted, and… `233dede7` `promisify`
- [SESSION 2026-08-15 — JS chunk D: phase 12 COMPLETE 21/21,…](progress_session_20260815_js_chunk_d_phase12.md) — Session dbaa68e7 (2026-08-15) — JavaScript chunk D: phase 12 finished 21/21, phase 18 topic 11 written, remaining…
- [Session 20260815 js p18 topic12 ui](progress_session_20260815_js_p18_topic12_ui.md) — Session 78e4bc26 (2026-08-15) — verified JS phase 11, wrote phase 18 topic 12 (long lists), created hard rule 12 +… `78e4bc26` `main`
- [Session 20260815 pre os reset verification](progress_session_20260815_pre_os_reset_verification.md) — Pre-OS-reset verification — 2026-08-15, session a153184e `a153184e` `~/.claude/**/memory/` `main` `~/.claude/claude.md`
- [Session 2026-08-30 — reset recovery + P11 T06 closed](progress_session_20260830.md) — Session 460b1fa8, 2026-08-30 — OS reset recovery, Java phase 11 topic 06 MockMvc CLOSED at 34 chunks, and the three… `$home` `2026-08-30`
- [Session 45e775dc — Git, start to finish (2026-08-14)](progress_session_45e775dc_git.md) — Session handoff — Git picked up, locked, re-scoped 191→52 and finished; what was decided, what is parked, and the… `45e775dc`
- [Session 8679dc8c handoff](progress_session_8679dc8c_handoff.md) — Full handoff for session 8679dc8c (2026-08-14) — Node audited, Express completed, Redis syllabus written; what is… `8679dc8c` `##` `build/` `--out-dir` `handoff`
- [START HERE · SKILLS + TOOLING LANE — session 2026-09-03](progress_skills_session_20260903.md) — START HERE for the skills/tooling lane. What the 2026-09-03 session built (two skills, currency fixes, bcrypt topic,…
- [MERN/PERN coverage map — 2026-09-01](progress_stack_coverage_map_20260901.md) — MERN/PERN coverage map of the whole devbible corpus as of 2026-09-01 — what a fullstack learner can actually walk… `pg` `progress.js` `pages`
- [Status config (status.json)](progress_status_config.md) — The single fetchable status config — static/status.json, generated by scripts/status.mjs (yarn status) — its shape,… `static/status.json` `declared`
- [EVERYTHING CONSOLIDATED INTO main — 2026-08-15](progress_worktree_consolidation_20260815.md) — 2026-08-15 — every devbible worktree and branch merged into main and deleted; main is now the only place work… `main`

## Boards, cursors, briefs and plans

- [Author brief](AUTHOR-BRIEF.md) — The compact standing brief handed to every devbible-author fork — hard rules and page skeleton in one short read, so… `devbible-author`
- [BRIEF sd phase3 caching](BRIEF-sd-phase3-caching.md) — The dispatch brief handed to every devbible-author agent writing docs/system-design/pages/phase-3-caching/ — file…
- [CURSOR-A2-TOOLCHAIN — THE LIVE COLD-START FILE for the…](CURSOR-A2-TOOLCHAIN.md) — 🔴 START HERE for the A2 toolchain lane. tanstack-query and vite are COMPLETE; the lane's next unit is the ORM track…
- [CURSOR free-resources gap (2026-09-14, paused)](CURSOR-FREE-RESOURCES-GAP.md) — Resume: 8 area briefs, verify, study map `w3schools` `MDN` `gap` `study map`
- [✅ THE ONE CHECKLIST (2026-09-24)](CHECKLIST.md) — every pending/upcoming task, bug, feature and open decision, with pointers `checklist` `pending` `todo`
- [🔴 Tracking moved into the repo at docs/_project/ (2026-09-24)](reference_tracking_moved_to_docs_project_20260924.md) — store devbible/ is a symlink; tools changed; public repo `move` `symlink` `_project`
- [CURSOR VERSION COVERAGE](CURSOR-VERSION-COVERAGE.md) — 🔴 START HERE: every track vs LTS lines — applies-up-to version + what is missing (2026-09-24) `LTS` `version` `coverage`
- [CURSOR AUDIT](CURSOR-AUDIT.md) — 🔴 START HERE for a cold devbible session asked "what is pending / what do you suggest / is it accurate / is it up to…
- [Dispatch anti-stall rule](DISPATCH-ANTI-STALL.md) — 🔴 The one line every devbible authoring-agent dispatch MUST carry. Six agents were killed by the 600s stall watchdog…
- [INDEX backend](INDEX-backend.md) — devbible index shard — PostgreSQL, Node, Express, Docker & Podman, Redis, MongoDB, Nginx, Git, Python, DSA and…
- [INDEX meta](INDEX-meta.md) — devbible index shard — gates, hooks, audits, dashboards, currency, house rules, and every piece of feedback from the…
- [INDEX web](INDEX-web.md) — devbible index shard — JavaScript, TypeScript, React, CSS, Angular, Storybook and the toolchain tracks (vite,…
- [PROMPT antigravity syllabus and concepts](PROMPT-antigravity-syllabus-and-concepts.md) — Antigravity prompt — devbible syllabus & concept authoring (language-agnostic)
- [Topic README frontmatter drift](README-FRONTMATTER-DRIFT.md) — The topic README sidebarposition/sidebarlabel drift audit of 2026-09-04. nextjs, javascript and typescript FIXED (35…
- [RESUME-A2 — SUPERSEDED 2026-09-08, see CURSOR-A2-TOOLCHAIN](RESUME-A2.md) — 🔴 COLD-START FILE. Say the keyword "RESUME-A2" and read this file first. Written 2026-09-06 at the end of session…
- [THE VALIDATION PIPELINE + LEDGER — the mechanism the two…](VALIDATION-LEDGER.md) — The append-only ledger of devbible validation passes — one row per unit, banked the moment that unit closes. Open it… `scripts/validate.mjs`
- [Build memory tuning](memory_build_memory_tuning.md) — The TWO build memory ceilings and which knob each takes; CI exit-143 wants 4096, NOT 8192.… `@docusaurus/faster` `future: {v4: true}` `fasterbydefault`
- [Docusaurus faster was never on · builds stalled on SWAP, not…](memory_docusaurus_faster_and_build_memory.md) — Why devbible builds crawled at 16% — swap thrashing, not CPU — and that @docusaurus/faster was…
- [A new src/theme/ swizzle needs a dev server RESTART](memory_docusaurus_swizzle_needs_restart.md) — A NEWLY CREATED file under src/theme/ is invisible to a running Docusaurus dev server — the @theme alias map is… `src/theme/`
