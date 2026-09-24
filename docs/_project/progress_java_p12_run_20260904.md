---
name: progress-java-p12-run-20260904
description: The 2026-09-04 Java run — session 77cb65cf closing the last two rows of phase 12 (topic 13 JVM flags as coordinator, topic 11 GraalVM as a devbible-author fork), plus the JAVA-BOARD repair of 15 wrong rows and the hardened Gemini prompt for phase 14. Carries the verified corrections topic 13 makes to the plan and the phase notes.
metadata:
  type: project
---

# Java · the 2026-09-04 run — phase 12's last two rows

**Coordinator: session `77cb65cf`.** User order, in sequence:

> *"i have java status"* → *"your sole task is with java am i clear ? … i want a prompt for
> gemini … and you continue with jvm in production deploy one more agents finish that make
> sure to use devbible skill"*

Two workers, disjoint topic directories, **coordinator commits, fork runs no git**:

| Worker | Topic |
|---|---|
| coordinator `77cb65cf` | **13 · JVM flags that matter in 2026** |
| fork (`devbible-author`) | **11 · GraalVM native image** |

Those were the only two rows left in phase 12. Both were `_plan.md`-only with **full research
already banked** by the 2026-09-02 forks — see [[progress-java-p12-run-20260902]]; neither
worker re-fetched it.

## 🔴 On arrival: JAVA-BOARD.md had 15 wrong rows

Found by running `java-board-recount.py` before claiming anything, exactly as the claim
protocol says to. **Disk was right and the board was wrong in two separate ways.**

**12 CORRUPTED rows.** The phase-12 rows *"08 Metrics with Micrometer"*, *"09 Distributed
tracing"* and *"12 Graceful shutdown"* had been pasted verbatim into the phase-**13**,
**14**, **15** and **16** tables, where those topics do not exist. Four tables were wrong
about their own contents. **Plus 3 more of the same kind in the phase-11 (Testing) table.**
Restored from `docs/java/syllabus/05-distributed.md` and disk:

| Table | Rows 08 / 09 / 12 should be |
|---|---|
| phase 11 | Test data patterns · Coverage with JaCoCo · Real-world testing scenarios |
| phase 13 | Spring Security resource server · Spring as OAuth2 *client* · Token relay across microservices |
| phase 14 | Service discovery · Centralized configuration · The distributed monolith |
| phase 15 | Idempotent consumers · The transactional outbox · Schema evolution on the wire |
| phase 16 | Deploying without downtime · Kubernetes for the Java developer · Distributed locks and leader election |

**4 STALE rows** the recount flagged: p12 topics 08, 09 and 12 said `⚠️ partial`; disk says
`✅ done` since 2026-09-03. p12/09 measured here at **15 chunks + index, 3,042 lines, 117 ★**,
0 over cap, 0 duplicate positions, 0 `{/* FOOTER */}` markers. Phase-12 header corrected
12/15 → **13/15**. Commit `74bffd8` in the store.

🔴 **Lesson: run the recount BEFORE claiming, every time.** Nothing else would have caught
this — every corrupted row was well-formed markdown that passed every check, and four phases
were carrying a false picture of their own contents.

## Topic 13 · JVM flags — 3 corrections, do not revert them

The topic is written and these are its load-bearing findings. **All three contradict something
already in this corpus**, which is why they are recorded here rather than only on the pages.

1. 🔴 **`-XX:+PrintFlagsFinal` does not print `:=` on JDK 25.** The topic's own `_plan.md`
   chunk 4 says to teach *"reading `:=` vs `=`"*. That output form is gone: the value prints
   with a plain `=` whatever its origin, and the non-default signal moved to a separate origin
   token (`{default}` / `{ergonomic}` / `{command line}`). **The failure mode is why this
   matters**: the decade-old idiom `grep ':='` now matches *nothing*, and empty output reads
   as *"nothing is overridden"* — the exact opposite of what a long inherited `JAVA_OPTS`
   means. A silent failure that confirms the wrong conclusion. Confirms the defect already
   listed against `01-memory-layout/09d-verifying-what-the-jvm-chose.md`.
2. 🔴 **`-XX:+PrintFlagsFinal` is not in the JDK 25 `java` man page at all.** Checked directly
   this session: `-XX:+PrintFlagsRanges` is documented, `PrintFlagsFinal` is not. Confirms the
   defect listed against `02-gc-in-practice/02c2-flags-that-still-work.md`. The real
   consequence, which the page draws: **its output format is not a committed interface**, so
   anything parsing it breaks silently across releases — the `:=` change is that having
   already happened once.
3. 🔴 **`_PHASE-NOTES.md` item 1 is wrong** where it says `-XX:-ZGenerational` *"will not even
   parse"* on JDK 25. It is **obsolete** — accepted, warns, ignored — not removed. The
   distinction is the topic's organising idea, and the wrong version sends a reader hunting a
   launch failure that never happens. **Found, not fixed** — the notes file is phase-wide.

### Two findings worth keeping from the source pass

- **The 1792 MB cliff.** The GC Tuning Guide: *"The VM considers machines as server-class if
  the VM detects two or more processors and physical memory larger than or equal to 1792 MB."*
  Both conditions, and failing it does **not** give a smaller G1 heap — it gives the **Serial
  collector**. Since HotSpot reads the cgroup limit, an ordinary 2 GiB → 1.5 GiB cost
  reduction silently changes the collector, and presents as a memory-pressure problem that
  every memory-shaped investigation will confirm.
- **`-XX:MaxDirectMemorySize` defaults to your max heap.** The man page says only *"if not
  set, the flag is ignored and the JVM chooses the size for NIO direct-buffer allocations
  automatically"* — it states a choice is made and never says what it is. HotSpot takes
  `Runtime.getRuntime().maxMemory()`. So the process worst case is ~2× what reading `-Xmx`
  suggests, and **raising `-Xmx` raises the direct ceiling with it** — a real mechanism behind
  *"we gave it more memory and it got OOMKilled sooner"*.

### Uncertainty stated rather than invented (both on-page)

- The complete set of `PrintFlagsFinal` origin tokens is **not enumerated** in the tool
  reference. The pages give the three that carry the audit signal and say the list is not
  closed.
- The small-memory threshold below which `-XX:MinRAMPercentage` applies is **not stated** in
  the JDK 25 `java` tool reference. The page refuses to give a number and tells the reader to
  read the resolved value on their own JVM.
- Which flags are **manageable** (runtime-writable via `jcmd VM.set_flag`) is **not
  enumerated** anywhere in the reference. Both pages that touch it say to discover it by
  attempting the set — safe, because a non-manageable flag is refused rather than silently
  accepted.

## Sources actually fetched this run (do not re-fetch)

- JDK 25 `java` tool reference — the three option classes verbatim, both unlock-flag entries
  verbatim, `JDK_JAVA_OPTIONS` semantics, `MaxDirectMemorySize`, `UseCompactObjectHeaders`.
  ⚠️ **The page is too large for one fetch** — two passes both truncated before the
  Removed/Obsolete/Deprecated inventories, `MaxRAMPercentage`, `IgnoreUnrecognizedVMOptions`
  and the AOT cache options. **Treat that fetcher's "NOT PRESENT" as "not reached".**
- JVM TI 25 spec — `JAVA_TOOL_OPTIONS` in full: prepended by `JNI_CreateJavaVM`, disabled when
  effective and real user IDs differ, and *"options processed by a launcher … will not be
  handled"* (the real distinction from `JDK_JAVA_OPTIONS`, which is launcher-level).
- JDK 25 GC Tuning Guide, Ergonomics — the four defaults, verbatim.
- JDK 25 `jcmd` tool reference — `VM.flags` (incl. `-all`), `VM.command_line`,
  `VM.system_properties`, `VM.set_flag`, `VM.native_memory` (the only *Impact: Medium*
  command), and the attach constraint: *"same machine"* + *"same effective user and group
  identifiers"*.

## Phase 14 · the Gemini prompt

Written as [[prompt-gemini-java-phase-14]], committed `dc6487f` + `058969a`. Built against
two named failure modes: work that *looks* finished, and confident staleness. Countermeasures
are a machine-checkable Definition of Done, a 12-item anti-pattern list, the split proof, the
pinned Oakwood spine and a *"name the change, don't silently write the new form"* rule.

🔴 **Correction to the board's phase-14 line: the "103 dangling links" figure is STALE.** The
de-link pass `74e8d2f7` converted them to `*(not written yet)*` prose; `devbible-linkcheck.py`
reports **371 links, 0 broken**.

⚠️ **A live session was found writing phase 14 topic 02 mid-run** (33 → 34 chunks, uncommitted,
mtimes minutes old). The prompt gained a §1b making a `git status` + `find -mmin -30` sweep its
**first** command, with the rule that anything touched in the last ten minutes belongs to
someone else and the instruction to stop rather than take a held topic.

## ⚠️ Phase 13 is being written by another agent — review deferred at the user's request

Measured 2026-09-04: phase 13 went **3 → 7 topics closed**, all 76 chunks got real footers,
0 over cap at the time of measurement, 0 MDX hazards, 0 duplicate positions. Topic 07 ·
OpenID Connect is mid-write.

🔴 **One verified content defect, reported but NOT fixed** (the user asked to hold the review
while the agent was still writing) — `07-openid-connect/03-validating-an-id-token.md`
reproduces OIDC Core §3.1.3.7 as a 13-row table. Checked against the spec: the *count* is
right, the *rows are not the spec's rules*.

- **Spec rule 5 is missing entirely** — *"This validation MAY include that when an `azp`
  (authorized party) Claim is present, the Client SHOULD verify that its `client_id` is the
  Claim Value."* The page splits spec rule 6 across two rows to reach thirteen, so from row 5
  on, its numbers do not match the spec a reader opens beside it.
- 🔴 **Rule 3 is quoted to one sentence of three**, and the dropped clause is load-bearing:
  the token *"MUST be rejected if the ID Token does not list the Client as a valid audience,
  **or if it contains additional audiences not trusted by the Client**."* This **contradicts
  the page's own advice** — it teaches `audiences.contains(clientId)`, which accepts a token
  listing your `client_id` *and* an attacker's. On the page arguing that rule 3 is what makes
  an ID token an ID token, that errs in the wrong direction.
- Rule 8's dropped sentence — *"For MAC based algorithms, the behavior is unspecified if the
  `aud` is multi-valued"* — matters because the page argues for multi-valued `aud`.
- A 313-line file (`07-openid-connect/04-nonce-state-and-the-three-bindings.md`) appeared
  over the cap while this was being written; it needs a split, not a trim.

Related: [[java-board]] · [[cursor-java]] · [[progress-java-p12-run-20260902]] ·
[[prompt-gemini-java-phase-14]] · [[java-playbook]]

## ⏹️ WOUND DOWN 2026-09-04 08:32 — clean stop on *"Please wind down for now"*

**Everything in this lane is committed. Nothing to salvage.** The fork was told to finish only
its current file and report; it did.

| # | Topic | Final state | Next file |
|---|---|---|---|
| 13 | JVM flags | 9 chunks · 2,372 lines · 111 ★ · pos 1–9 | `05d-the-live-list-diagnostics.md` (pos 10) |
| 11 | GraalVM native image | 14 chunks · 2,697 lines · 202 ★ · pos 1–14 | `07c-getting-throughput-back.md` (pos 15) |

Both: 0 over cap, 0 MDX hazards, 0 duplicate positions, all links resolving. Neither has a
`README.md` or `_category_.json` yet, and `{/* FOOTER */}` markers are in place **by design**
until close. Phase 12 stays **13/15** — neither topic closed, so no UI board moved.

### 🔴 The correction that cost a re-write, and the lesson in it

A **targeted** re-fetch of the JDK 25 `java` man page — asking for named sections rather than
the whole page — returned the full `-XX:+HeapDumpOnOutOfMemoryError` entry, ending:

> *"This applies only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does
> not apply to `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for
> other types of resource exhaustion (such as native thread creation errors)."*

Chunk 05 had **already been committed** telling the reader to pair `-XX:MaxMetaspaceSize` with
`HeapDumpOnOutOfMemoryError` so the error "leaves evidence". It does not — metaspace exhaustion
is not Java-heap exhaustion, so the error is raised and no dump is written. Corrected in all
three places it appeared, in `1113f9f6`.

🔴 **The lesson is about fetch strategy, not about the flag.** The first two passes over that
man page were broad ("quote everything about X, Y, Z") and both silently truncated, reporting
`NOT PRESENT` for sections they never reached. The third asked for a short, named list and got
complete, verbatim entries. **On a very large reference page, ask narrowly and repeatedly
rather than broadly once** — and never read that fetcher's "NOT PRESENT" as evidence of
absence.

### The split, proven

Correcting chunk 05 pushed it to 311 lines. Split on a boundary the page already had — sizing
the **heap** versus the ceilings that are **not** the heap:

```
BEFORE  292 lines / 13 ★     (git show HEAD)
AFTER   475 lines / 24 ★     (234 + 241)
```

Both totals **up**. The 05x series was renumbered to make room: `05` heap sizing · `05b`
ceilings-that-are-not-the-heap · `05c` GC (git mv from `05b`) · planned `05d` diagnostics ·
`05e` JDK 25. Every inbound reference updated; positions 1–9 contiguous.

### Also done at wind-down

- 10 stale `*(not written yet)*` markers re-linked across four chunks, now that the files they
  named exist.
- The lane file was narrowed from `docs/java` to
  `docs/java/pages/phase-12-jvm-production`, because the cadence hook was reporting **other
  agents'** uncommitted files (Gemini's phase 14, the Python session's topic 12) as though they
  were mine. A lane declared too broadly makes the guard unactionable.

## 🔴 The fork's report — findings a successor must not re-derive

**Topic 11 final: 14 chunks, 2,697 lines, 202 ★ (measured off disk; the fork report said 2,659/207, taken before its own link-repair pass — disk is the truth), positions 1–14, 0 over cap, 71 links 0 broken.**

### The defect the fork caught in MY commit

Chunks 01, 01b, 03b, 03c and 04b — already committed in `5dfafb30` — carried **real markdown
links to files that do not exist yet** (`07c-getting-throughput-back.md`,
`08-testing-a-native-image.md`, `09-when-it-pays.md`, and a `07d` reference). A dangling
relative link breaks the production build **for every other session in this shared checkout**.
18 occurrences, repaired in `42210012`.

🔴 **Why I missed it: I ran `mdxcheck.py` over the directory and not
`devbible-linkcheck.py`.** `mdxcheck` does not resolve links, so the topic passed the check I
ran and failed the one I skipped. **Both are in the authoring contract's pre-report list.
Running one is not running the gate.**

### Research is COMPLETE for topic 11 — do not re-fetch

Sources, all reachable via `raw.githubusercontent.com`: `oracle/graal` branch
**`release/graal-vm/25.3`**, `docs/reference-manual/native-image/*.md` (README,
NativeImageBasics, ReachabilityMetadata, AutomaticMetadataCollection, ClassInitialization,
Compatibility, MemoryManagement, JFR, JCmd, NMT, JDWP, BuildOptions, BuildOutput,
BuildConfiguration, OptimizationsAndPerformance, PGO, PerfProfiling, and
`guides/create-heap-dump-from-native-executable.md`); `spring-projects/spring-boot` tag
**`v4.1.0`** native-image adocs; `graalvm/native-build-tools` tag **`1.1.1`**
`maven-plugin.adoc`. Spine: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Framework 7.0.8
· Native Build Tools 1.1.1**.

**Contents already itemised for the two next chunks**, so they can be written from the bank:

- **`07c-getting-throughput-back.md`** (pos 15) — `-O0/-Ob/-Os/-O1/-O2/-O3`; PGO
  (`--pgo-instrument` → run → `--pgo`, `default.iprof`); GraalSP vs GraalNN; `-march`
  (`x86-64-v3`/`armv8-a` defaults, `native`, `compatibility`, `list`); PIE and relative code
  pointers. 🔴 **PGO, GraalNN and `-O3` are Oracle-GraalVM-only.**
- **`07d-the-diagnostic-toolbox.md`** (pos 16) — five heap-dump routes including
  `-XX:+DumpHeapAndExit`, `SIGUSR1` and the `svm-heapdump-<PID>-OOME.hprof` name;
  `--enable-monitoring=threaddump` → SIGQUIT; NMT (**summary only — no detail, no baselines,
  malloc-only**); JDWP (experimental, `--macro:svmjdwp-library`, `-H:+JDWP`,
  `-XX:JDWPOptions=`); `perf`.

### Seven claims the fork could not confirm, and what it wrote instead

All are stated on-page as uncertain rather than guessed. **Do not "resolve" them without a
source.**

1. **Container/cgroup awareness of native-image heap sizing.** Memory Management says the
   Serial GC default max heap is *"80% of the physical memory size"* and never says whether
   that means the cgroup limit. Container JFR events exist, which hints at awareness; no doc
   settles it. Written as unspecified, with "set the heap explicitly".
2. **`-XX:MaxDirectMemorySize` default in a native image.** Documented as an option with no
   stated default. Written as "set it explicitly".
3. **`--no-fallback`** is absent from the GraalVM 25.3 generated options table, so its
   existence was **not asserted**; `02` prescribes a CI assertion instead.
4. **Liberica NIK's licence** — not verified; the page says so and tells the reader to check.
5. **CE and the quarterly CPU line** — the release-calendar table shows dashes for CE on two
   2026 CPU rows and values on two earlier ones; no sentence states the policy. Table
   reported, policy not inferred.
6. **Incremental native builds** — no documented mechanism found; written as not found.
7. **Binary string-extraction techniques** — deliberately not claimed in `04b`.

**No fabricated build times, startup times, binary sizes or RSS figures anywhere.** `06b`
opens with an explicit disclaimer that no duration on it is a measurement.

### 🔴 A real upstream documentation divergence — bank this, do not "fix" it

**Spring Boot 4.1's *Introducing GraalVM Native Images* still names the five legacy hint files**
(`reflect-config.json`, `resource-config.json`, `serialization-config.json`,
`proxy-config.json`, `jni-config.json`) **while GraalVM 25.3's reference documents
`reachability-metadata.json`.** Both are accepted by the builder — GraalVM's
`-H:ConfigurationFileDirectories` text says so explicitly. Recorded on both `03b` and `05` as
*"do not 'fix' one to match the other"*. A future currency sweep will otherwise try to
reconcile them.

### Other findings outside the fork's lane — found, not fixed

- `10-packaging-for-deploy/` has a `_category_.json`; **`15-checkpoint-restore-crac/` does
  not**, and neither does topic 14.
- ⚠️ **`mdxcheck.py` can abort rather than report** when another session is mid-rename — it
  crashed once on a stale path from the Python session's `05j` rename. Not a script bug, but a
  whole-`docs/` run is unreliable while other lanes are live. **Scope it to your own directory.**

## ▶️ SESSION RESUMED 2026-09-04 08:45 — "finish topic 13 and close phase 12"

Both phase-12 rows reclaimed (commit `30caba5`, claim before content as the protocol requires).
Coordinator `77cb65cf` on **topic 13 · JVM flags**; a `devbible-author` fork on **topic 11 ·
GraalVM**, briefed to write `07c`, `07d`, `08`, `09`, `10`, `README.md` (**pos 0**) and
`_category_.json`, **and to replace all 14 `{/* FOOTER */}` markers with real navigation** —
the step that is forgotten most often, because every automated check passes a page that has
no navigation at all.

Closing both takes phase 12 to **15/15**. The four UI boards move only then.

## 📋 Review queue — the user asked for an ACCURACY pass, expecting more bugs

Measured 2026-09-04 08:47. Mechanically both phases are clean; the ask is about *claims*.

**Phase 13 · OAuth2 & OIDC — 8/8 topics on disk now indexed** (of 14 planned in the syllabus):

| Topic | Chunks | Lines |
|---|---:|---:|
| 01 Why OAuth2 exists | 6 | 1,222 |
| 02 The four roles | 7 | 1,602 |
| 03 Authorization code + PKCE | 21 | 4,895 |
| 04 Client credentials | 4 | 722 |
| 05 The three tokens | 17 | 4,152 |
| 06 JWT anatomy and validation | 12 | 3,167 |
| 07 OpenID Connect | 15 | 3,417 |
| 08 Spring Security resource server | 16 | 3,748 |

All: 0 over cap, **0 `{/* FOOTER */}` markers**, indexes present.

**Phase 14 · Microservices** — topic **02 · Service boundaries closed at 61 chunks** with an
index (it was 33 when this session started). Topics 01 (39 chunks) and 04 (34) remain
index-less; nine topics are still `_plan.md`-only.

🔴 **The one defect already verified, reported but NOT yet fixed** —
`07-openid-connect/03-validating-an-id-token.md` renders OIDC Core §3.1.3.7 as a 13-row table.
Fetched the spec: the *count* is right, the *rows are not the spec's rules*.

- **Spec rule 5 is missing entirely** — *"This validation MAY include that when an `azp`
  (authorized party) Claim is present, the Client SHOULD verify that its `client_id` is the
  Claim Value."* The page splits spec rule 6 across two rows to reach thirteen, so from row 5
  onward its numbers do not match the spec a reader opens beside it.
- 🔴 **Rule 3 is quoted to one sentence of three**, and the dropped clause is load-bearing:
  the token *"MUST be rejected if the ID Token does not list the Client as a valid audience,
  **or if it contains additional audiences not trusted by the Client**."* This **contradicts
  the page's own advice** — it teaches `audiences.contains(clientId)`, which accepts a token
  listing your `client_id` *and* an attacker's. On the page arguing that rule 3 is what makes
  an ID token an ID token, that errs in the wrong direction.
- Rule 8's dropped sentence — *"For MAC based algorithms, the behavior is unspecified if the
  `aud` is multi-valued"* — matters because the page argues for multi-valued `aud`.

🔴 **The standing lesson this confirms: a mechanical pass is not a review.** Phase 13 passes
every check — cap, MDX, links, positions, footers — and still carries a spec-contradicting
security claim. The same thing happened to Python phase 2 (clean mechanically, 7 factual
defects). **Verify claims against the primary source, not against the checklist.**

## 🔍 ACCURACY REVIEW of phase 13 — 2026-09-04 08:55, session `77cb65cf`

The user asked for an accuracy pass expecting more bugs. **One real defect found and fixed;
five other areas sampled and confirmed correct.** This was a SAMPLE, not exhaustive — phase 13
is 22,925 lines and what follows names exactly what was and was not checked.

### 🔴 DEFECT — found, verified against the spec, FIXED in `8cfd1d5c`

`07-openid-connect/03-validating-an-id-token.md` rendered OIDC Core §3.1.3.7 as a 13-row
table. The **count** was right; the **rows were not the spec's rules**.

- **Spec rule 5 was missing entirely** — *"This validation MAY include that when an `azp`
  (authorized party) Claim is present, the Client SHOULD verify that its `client_id` is the
  Claim Value."* The page reached thirteen rows by splitting spec rule 6 across two, so from
  row 5 onward its numbering did not match the spec a reader opens beside it.
- 🔴 **Rule 3 was quoted to one sentence of three, and the dropped clause reversed the page's
  advice**: *"The ID Token MUST be rejected if the ID Token does not list the Client as a valid
  audience, **or if it contains additional audiences not trusted by the Client**."* The page
  taught `audiences.contains(clientId)` as the fix — which **accepts** a token whose `aud` is
  `["your-client","attacker-client"]`, exactly what the spec says MUST be rejected. On the page
  arguing that rule 3 is what makes an ID token an ID token, the advice erred toward accepting
  attacker tokens. Now teaches membership **and** an untrusted-audience rejection, in code.
- Rule 8's dropped sentence restored — *"For MAC based algorithms, the behavior is unspecified
  if the `aud` is multi-valued"* — which matters precisely because the page argues for
  multi-valued `aud`. Tied to why RS256 is rule 7's default.
- Rules 10–13 restored to full text. Framing sentence renumbered `5–8` → `6–8`.

176 → 210 lines, 8 gotchas preserved, 0 MDX hazards, 79 links 0 broken.

### ✅ Checked and CORRECT — do not re-review these

1. **PKCE quotes vs RFC 7636.** Every sampled quote in `03/06-the-code-verifier.md` and
   `03/07-s256-vs-plain.md` is **exact**: the §4.1 `code_verifier` definition and 43/128 bounds,
   the 32-octet / 43-character NOTE, §4.2's `plain`/`S256` transformations and the
   *"MUST use S256"* sentence, §4.3's *"defaults to plain"*, and both §7.2 sentences
   (*"MUST NOT downgrade"*, *"plain SHOULD NOT be used"*). Section numbers correct throughout.
2. **The UserInfo provenance hedge is HONEST and must be left alone.**
   `07/07-the-userinfo-endpoint.md` declares that OIDC Core §5.3 and §5.3.2 could not be read
   and presents the `sub` cross-check as established practice rather than a quotation.
   🔴 **I hit the same truncation independently** — the published HTML ends mid-§3. That is
   correct sourcing under `verification.md`, not laziness. Do not "upgrade" it to a citation
   without a source that actually reaches §5.
3. **Split discipline is genuine.** Both topic-07 files that went over cap were split, not
   trimmed, and both are proven: `04-nonce-state…` 313 → 416 lines (26 ★),
   `05-discovery…` 316 → 400 lines (22 ★). The commit messages record the proof.
4. **Spring's default-validator gotcha is stated correctly** — `JwtValidators.createDefault()`
   has no audience validator and `issuer-uri` does not add one; `setJwtValidator` replaces the
   whole chain. Pages cite the Spring Security 7 source methods by name.
5. **JWT dangerous-header quotes** (`06/03e`) are correctly attributed to RFC 7515 header
   definitions and RFC 8725 BCP guidance.
6. **All 8 phase-13 topic READMEs are at `sidebar_position: 0`** with `sidebar_label:
   "Overview"` — none drifted to the topic's own number, the defect the house-style note says
   affects 135 of 608 READMEs corpus-wide.

### ⚠️ NOT reviewed — the honest boundary

- **The other ~22,700 lines of phase 13.** Topics 01, 02, 04, 05, 08 had only their *quotes*
  spot-checked, not their arguments. Topic 03 (21 chunks) had PKCE claims checked and nothing else.
- **Phase 14 topic 02 — reviewing it now would be reviewing a moving target.** It was **still
  being written at 08:51** (files touched within 10 minutes, dozens of uncommitted
  modifications). It grew 33 → 61 chunks and gained an index during this session.
- **Phase 13's remaining 6 syllabus topics** (09–14) do not exist on disk at all; the phase is
  8 of 14, not complete.

🔴 **The standing lesson, now confirmed twice in this corpus:** phase 13 passes every
mechanical check — cap, MDX, links, positions, footers, README positions — and still carried a
spec-contradicting security claim. **A mechanical pass is not a review.** The defect class to
hunt is the *truncated verbatim quote*: it looks authoritative, cites a real section, and drops
the clause that would have changed the advice.

## ⏹️ ALL TASKS KILLED 2026-09-04 09:15 — "first kill all tasks … rest save to memory"

**Everything committed. Nothing to salvage.** The GraalVM fork was stopped mid-topic; its
four in-flight chunks were gate-checked and committed, and the 5 forward links it left behind
were de-linked before they could break the build.

| # | Topic | On disk | Next file |
|---|---|---|---|
| 13 | JVM flags | 11 chunks, pos 1–11 | `05f-the-live-list-jdk-25.md` (pos 12) |
| 11 | GraalVM native image | 18 chunks, pos 1–18 | `08-testing-a-native-image.md` (pos 19) |

Both: 0 over cap, 0 MDX hazards, 0 duplicate positions, 0 broken links. Neither has a
`README.md` or `_category_.json`, and the `{/* FOOTER */}` markers are in place **by design**
until close.

### 🔴 The same miss nearly shipped twice today

A fork that finishes — or is killed — leaves **forward links to chunks it never wrote**, and
`mdxcheck.py` does not resolve links, so the topic passes the check people actually run. It
happened on the first fork (18 links) and again on the killed one (5 links). **Run
`devbible-linkcheck.py` on every fork salvage, without exception.** Both are in the authoring
contract's pre-report list; running one is not running the gate.

### Topic 13's fifth correction, added this session

🔴 **`-XX:+HeapDumpOnOutOfMemoryError` AND `-XX:OnOutOfMemoryError` both apply *only* to Java
heap exhaustion.** Verbatim from the JDK 25 man page, in two separately-documented entries:

> *"This applies only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does
> not apply to `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for
> other types of resource exhaustion (such as native thread creation errors)."*

So metaspace exhaustion, direct-buffer exhaustion and `unable to create native thread` each
raise a **real** `OutOfMemoryError` and produce **no dump and no hook**. Because the
restriction is documented separately on each flag, a team that learns it for the heap-dump
flag still reaches for `OnOutOfMemoryError` as the general-purpose hook it is not. This
corrected an earlier version of chunk 05 that advised the opposite.

### The 05x series has been renumbered TWICE — use these names

`05` heap sizing · `05b` ceilings-that-are-not-the-heap · `05c` GC · `05d` diagnostics ·
`05e` armed instrumentation · planned `05f` JDK 25. Two proven splits produced it:
292→475 lines / 13→24 ★, and 319→364 / 15→19 ★.

## 🔍 GEMINI REVIEW — phase 14 topic 02 · Service boundaries, 2026-09-04 09:20

**61 chunks, 12,509 lines, 581 ★, 0 over cap, positions contiguous 1–60, index present.**
Agent has stopped (nothing touched in 15 min). 🔴 **All 61 files are still UNCOMMITTED.**

### ✅ What is correct — do not re-check

- **ArchUnit API is exact.** Imports (`com.tngtech.archunit.core.importer.ImportOption`,
  `…junit.AnalyzeClasses`, `@ArchTest`, `…lang.syntax.ArchRuleDefinition.classes/noClasses`,
  `…library.dependencies.SlicesRuleDefinition.slices`) and the fluent DSL are all real and
  correctly spelled.
- **Spring Modulith API names are correct** — `ApplicationModules.of(...).verify()`,
  `@ApplicationModule(allowedDependencies…)`, `@NamedInterface`, `@ApplicationModuleListener`,
  `@ApplicationModuleTest`, `Documenter`.
- **It followed the version spine it was given** — Boot 4.1.0 / Framework 7.0.8 / Spring Cloud
  train 2025.1.x / Modulith 2.1.1, exactly as `_PHASE-NOTES.md` specifies.
- 0 files over the 300-line cap.

### 🔴 DEFECT 1 — 58 of 60 chunks have a `sidebar_label` number that is not the filename's

The labels were numbered by **`sidebar_position`** instead of by the **filename prefix**. So
`26-archunit-rules.md` carries `sidebar_label: "37 · ArchUnit rules"` at `sidebar_position: 37`.

**The corpus convention is the opposite, and it is unanimous** — measured 2026-09-04 across
three closed topics: `p12/01-memory-layout` **0 / 46** mismatches, `p11/09-jacoco` **0 / 22**,
`p13/03-authorization-code-pkce` **0 / 20**. That is 0 of 88.

Consequences: the sidebar shows a number the filename contradicts, and prose cross-references
already use the *label* number against the *file* name (e.g. a link reading
`[34 · Package structure is the boundary](24-package-structure-is-the-boundary.md)`), so two
numbering schemes are live in the same topic. **Positions themselves are fine** — contiguous
1–60, no duplicates — so this is a label-only repair, mechanical and low-risk.

### 🔴 DEFECT 2 — two libraries taught with exact versions and NO pin

`src/data/pins.js` is the corpus's single source of truth for versions and is read by
`scripts/currency.mjs --check`, which exits 1 on drift. Neither of these is in it:

| Library | Version taught | Mentions in topic 02 | In `pins.js`? |
|---|---|---:|---|
| **Spring Modulith** | 2.1.1 | 45 | ❌ **no** |
| **ArchUnit** | 1.4.2 | 2 | ❌ **no** |

The project's library rule is explicit: a library may only be pulled in **if it gets a pin in
the same change**, *"otherwise you have taught something nothing watches."* Both need a
`pins.js` entry (`gh:spring-projects/spring-modulith`, `gh:TNG/ArchUnit`), or the versions come
out of the pages.

### 🔴 DEFECT 3 — NOT Gemini's fault: the brief disagrees with the pin registry

| Source | Spring Boot | Spring Framework |
|---|---|---|
| `src/data/pins.js` (checked 2026-08-31) | **4.1.1** | **7.0.9** |
| `p14/_PHASE-NOTES.md` + 136 phase-14 files | **4.1.0** | **7.0.8** |

Only **18 files corpus-wide** use 4.1.1. Gemini did exactly what the phase notes told it to;
**the phase notes are stale relative to the registry that governs them.** This affects phase 12
too — my own topic-13 pages carry 4.1.0 from the same notes. It is a corpus-wide decision
(bump the notes and the pages, or freeze the pin with a `reason`), not a page-level fix, and
`yarn currency --check` should already be failing on it.

### ⚠️ Provenance I cannot verify

Eleven chunks cite **Eric Evans, *Domain-Driven Design*, Chapter 14** and others cite **Vaughn
Vernon, *Effective Aggregate Design***. Books are not fetchable, so these are unverifiable from
here — not wrong, just unchecked. The web-reachable citations it uses (Martin Fowler
*BoundedContext*, microservices.io, Michael Nygard *Entity Service Antipattern*) are real
sources correctly named.

### Next actions when this is picked up

1. Repair the 58 `sidebar_label` numbers to match filename prefixes (mechanical; positions are
   already correct).
2. Add `springModulith` and `archunit` to `src/data/pins.js`, or drop the versions.
3. Decide the 4.1.0-vs-4.1.1 question corpus-wide — it is not a phase-14 question.
4. **Commit the 61 files.** They are complete and clean apart from the label numbering.

## ⏹️ SESSION CLOSED 2026-09-04 09:40 at ~90% usage

**Working tree clean: 0 uncommitted files in `docs/` and `src/`.** All agents killed.
Cold-start cursor: [[cursor-java]] → `13-jvm-flags-that-matter/05f-the-live-list-jdk-25.md`.

### ✅ The patch bump, done by the book

Boot **4.1.0 → 4.1.1**, Framework **7.0.8 → 7.0.9**, **1,646 files** (`8f0506fc`), following
`devbible-currency/references/triage-ladder.md` class 2 exactly: blast radius listed, sed
scoped to `^> ` lines, diff gate re-run, bolding preserved (40 bold pins survive),
`pins.js` `checked` moved forward to 2026-09-04 and never back-dated.

Two things worth carrying forward:

- The scoped sed **created an inconsistency the gate could not catch**: 314 lines ended up
  reading `spring-boot-dependencies:4.1.0` beside the new `Spring Boot 4.1.1`, both inside the
  same `> ` line. Fixed in the same commit. **A gate that checks *where* a hunk lands says
  nothing about whether the line is internally consistent afterwards.**
- The four `_PHASE-NOTES.md` spine tables were updated **deliberately**, outside the `> `-line
  rule, because they are the brief every fork reads. Leaving them at 4.1.0 would have had
  every future agent re-introduce the old version — the bump would have undone itself.

🔴 **CORRECTION TO MY OWN EARLIER FINDING.** I reported the 4.1.0-vs-4.1.1 gap as defect 3 of
the Gemini review. **By the corpus's own rules it was not a defect.** The triage ladder states
*"a patch bump never causes a page to be re-read"*, and the detector *"reports but never
flags"* a patch difference — *"Patch drift is not work, here as everywhere."* I over-called
it. The bump was done because the user asked, not because the tooling demanded it.

### 🔴 The honest boundary on the review — I did NOT read everything

Asked directly whether I had read and validated all the explanations: **no.** What was
actually verified, and what was not:

**Verified against primary sources:**
- OIDC Core §3.1.3.7 — fetched, compared row by row, **defect found and fixed**.
- RFC 7636 §4.1–4.5 and §7.2 — every sampled PKCE quote confirmed exact.
- OIDC Core §5.3.2 — **could not be reached**; the published HTML truncates mid-§3, which
  independently confirms the UserInfo page's own provenance hedge is honest.
- ArchUnit and Spring Modulith API surface in phase 14 topic 02 — imports, package paths and
  DSL confirmed real and correctly spelled.
- Structural, corpus-wide: `sidebar_label` convention (0 mismatches in 88 chunks across three
  closed topics), README positions, split proofs, cap, MDX, links, footers.

**NOT verified — the real boundary:**
- **~22,700 of phase 13's 22,925 lines.** Topics 01, 02, 04, 05, 08 had quotes spot-checked
  only; their *arguments* were not read.
- **Phase 14 topic 02's 12,509 lines were not read for reasoning quality.** Its API surface and
  numbering were checked; its DDD content was not.
- **11 chunks cite Eric Evans' *Domain-Driven Design* ch. 14 and Vaughn Vernon by book.** Books
  are not fetchable — unchecked rather than wrong.
- Phase 12 topics 01–10, 12, 14, 15 were not re-validated at all this session.

🔴 **The standing lesson, now demonstrated three times in this corpus:** a mechanical pass is
not a review. Phase 13 passed cap, MDX, links, positions, footers **and** README positions and
still shipped an audience check that accepts attacker tokens. **The defect class to hunt is the
truncated verbatim quote** — it cites a real section, reads authoritatively, and drops the
clause that would have changed the advice.

### Rating given for the external agent's (Gemini) phase-14 topic 02 work: **8/10**

Not lazy — 61 chunks, 12,509 lines, 581 ★, **0 over cap**, real concept-boundary splits, and
**0 `{/* FOOTER */}` markers left**, which is the close step almost everyone skips. Technically
sound — no invented APIs, correct version spine, real citations. Lost points for **145
numbering defects** (one wrong convention applied consistently, mechanically fixable) and for
teaching two libraries with exact versions and **pinning neither**. Better failure profile than
the phase-13 agent, whose work was mechanically perfect and contained a security defect.

### Still open when this is picked up

1. **`src/data/pins.js` has no entry for Spring Modulith (2.1.1) or ArchUnit (1.4.2)**, both
   taught with exact versions in phase 14 topic 02. The project's library rule requires a pin
   in the same change. **This is the one unactioned defect from the review.**
2. Topic 13 (next: `05f`, pos 12) and topic 11 (next: `08-testing-a-native-image.md`, pos 19).
3. Pre-existing MDX RAW-TAG hazards, found not fixed:
   `phase-11/04-mockito/04d-additional-matchers.md:87`,
   `phase-10/01-jdbc/22e-setting-the-timeouts.md:186,238`.
4. **Nothing has been pushed.** A push to `main` fires the deploy workflow; that is a
   deliberate decision left to the user.
