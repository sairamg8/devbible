---
name: cursor-java-history
description: Superseded START HERE banners, run-by-run history and banked research for devbible Java's phase 12, split out of CURSOR-JAVA.md at the 300-line cap on 2026-09-02. Nothing here is the current resume point — read [[cursor-java]] first. Kept for the record and for banked research (topic 10 packaging) still worth citing.
metadata:
  type: project
---

# ☕ Java cursor — history and banked research (not the resume point)

🔴 **This is not where a session resumes.** Read [[cursor-java]] for the current START HERE,
standing order and open defects. Everything below is either superseded banners kept for the
record, or reference research that is still correct but no longer urgent (topic 10 is closed).

---

## (historic, mid-run) LIVE 2026-09-02 — session `67176b1d` + forks A/B/C

Last gate commit: **2026-09-02 14:48**. Fork A = 10 → 09 · fork B = 08 → 13 · fork C = 12 → 11. A
topic is CLOSED only with README.md + boards wired.

| Topic | On disk | Positions | Index | Committed files |
|---|---|---|---|---|
| 08-metrics-with-micrometer | 30 chunks · 7585 L · 431 ★ | max pos 30 → next 31 | ❌ no index | 32 tracked |
| 09-distributed-tracing | 6 chunks · 1403 L · 79 ★ | max pos 6 → next 7 | ❌ no index | 8 tracked |
| 10-packaging-for-deploy | 29 chunks · 7538 L · 527 ★ | max pos 29 → next 30 | ✅ index | 32 tracked |
| 11-graalvm-native-image | 0 chunks · 0 L · 0 ★ | max pos 0 → next 1 | ❌ no index | 1 tracked |
| 12-graceful-shutdown | 10 chunks · 1682 L · 80 ★ | max pos 10 → next 11 | ❌ no index | 11 tracked |
| 13-jvm-flags-that-matter | 0 chunks · 0 L · 0 ★ | max pos 0 → next 1 | ❌ no index | 1 tracked |

## (historic — session 67176b1d's own 14:43 draft, superseded by its 14:52 final banner) START HERE

```
docs/java/pages/phase-12-jvm-production/10-packaging-for-deploy/README.md   ← DONE 2026-09-02
```

**Why there:** topic 10 has **all 29 chunks written** (positions 1–29 contiguous, 0 over cap,
219 links 0 broken) and is missing **only its index**. One file closes a topic and takes phase 12
to 10/15. `sidebar_position: 0`, `sidebar_label: "Overview"`, tier `t-understand`; copy the shape
of `../14-benchmarking-with-jmh/README.md` or `../phase-11-testing/02-assertj/README.md`.

**Then, in this order:**

| # | Topic | What it owes |
|---|---|---|
| 1 | **10 Packaging** | `README.md` only → **CLOSES** |
| 2 | **08 Metrics** | `11-cost-and-overhead.md` (pos 29), `12-the-checklist.md` (pos 30) — which also closes its one broken link — then `README.md` → **CLOSES** |
| 3 | **12 Graceful shutdown** | `06-executors-and-schedulers.md` at **pos 9**, then `06b-message-consumers`, `07-connection-pools`, `08-readiness-and-the-load-balancer`, `08b-prestop-and-termination-grace-period`, `09-idempotency-as-the-backstop`, `10-the-checklist`, `README.md`. 8 chunks written, positions 1–8 |
| 4 | **09 Distributed tracing** | 4 chunks, next pos 5. 🔴 Its 17 dangling links name the earlier author's intended filenames — honour them |
| 5 | **11 GraalVM native image** | `_plan.md` only. Boot native-image source quotes are banked in [[progress-java-p12-run-20260901b]] |
| 6 | **13 JVM flags** | `_plan.md` only, starts at pos 1 |

Then phase 12 is complete — and the standing order below said **stop**. (Superseded 2026-09-02 —
see [[cursor-java]].)

---

## (historic 2026-09-01) START HERE — wind-down banner

> **Repointed 2026-09-01** by session `f413d97a` (coordinator + 2 `devbible-author` forks),
> winding down on the user's instruction: *"Please finish current files including agents wind down
> for now"* / *"Only current file and enough for the day"* / *"Please verify build failing issues
> in case"*.
>
> ✅ **CLEAN STOP — nothing to salvage.** Working tree clean, everything committed and pushed,
> and **`yarn build` SUCCEEDS**.
>
> 🔴 **THIS SESSION FIXED TWO BUILD-BREAKING MDX DEFECTS. Read this before writing prose:**
> a literal `{` or `}` in prose is an **MDX expression**, even inside quotation marks, inside a
> blockquote, inside emphasis. `p12/07-logging-done-right/04-parameterised-messages.md` had
> SLF4J's own sentence about the `'{'` anchor and it killed the whole build; `p14/01-monolith-first/11f-nested-modules.md`
> had `$.{moduleName}` and it killed SSG rendering with *"moduleName is not defined"*.
> **Escape them `\{` and `\}`, or put them in backticks.** ⚠️ `mdxcheck.py` does **not** catch
> this — only the build does. Run `yarn build` before ending a session.
>
> **Closed this session: phase 12 topic 14 (Benchmarking with JMH) and topic 15 (CRaC).**
> Phase 12 is **9 / 15**. Java is **177 / 233 (76%)**.

## (historic 2026-09-01 morning) START HERE

```
docs/java/pages/phase-12-jvm-production/10-packaging-for-deploy/03-base-images.md   ← DONE
```

**Why there:** topic 10 now has **eight** chunks and `03-base-images.md` is the next `_plan.md` row.
**Next free `sidebar_position` is 9.**

| pos | file | L | ★ |
|---|---|---|---|
| 1 | `01-the-fat-jar.md` | 182 | 14 |
| 2 | `01b-why-not-shading.md` | 252 | 17 |
| 3 | `01c-the-collision-catalogue.md` | 236 | 17 |
| 4 | `01d-minimizing-relocating-and-choosing.md` | 215 | 20 |
| 5 | `02-layered-jars.md` | 223 | 19 |
| 6 | `02b-extracting-layers-and-the-image-cache.md` | 238 | 20 |
| 7 | `02c-a-real-layered-dockerfile.md` | 272 | 22 |
| 8 | `02d-the-cache-variants-of-the-dockerfile.md` | 222 | 18 |

🔴 **Three proven splits on 2026-09-01, each recorded in its commit message:**

| Drafted | Before | After | Both up? |
|---|---|---|---|
| `01b-why-not-shading.md` | 1 file · 406 L · 25 ★ | 3 files · 703 L · 54 ★ | ✅ |
| `02-layered-jars.md` | 1 file · 352 L · 25 ★ | 2 files · 461 L · 39 ★ | ✅ |
| `02c-a-real-layered-dockerfile.md` | 1 file · 322 L · 24 ★ | 2 files · 494 L · 40 ★ | ✅ |

⚠️ **One of those splits first landed at 303 L — 3 over — and was RE-CUT three ways rather than
shaved.** The lesson is worth carrying: **an over-cap result after a split means the boundary was
wrong, not that the content was too long.** The second boundary was better content anyway.

🔴 **`_plan.md` is maintained** — it carries a "Written so far" position table and the renumbering
(the Dockerfile chunk moved `02b` → `02c` when 02 split; `02d` is new). **Read it before picking the
next file**; its chunk letters are a plan, not a budget.

⚠️ **The topic's one remaining dangling link is `01-the-fat-jar.md → 05b-the-aot-cache.md`**, a
forward reference that resolves when chunk 05b lands. `devbible-linkcheck.py` on the directory:
28 links checked, 1 broken. `mdxcheck.py`: 0 hazards. 0 files over the 300-line cap.

Its `_plan.md` is written and good — topic 10 is now closed, so this is reference only.

---

## The standing order (2026-09-01 — SUPERSEDED 2026-09-02, see [[cursor-java]])

> *"After completing current phase do not start new"* — user, 2026-09-01. **Overridden** by
> *"complete all pending jobs in java then please pick python"*, 2026-09-02.

**Was: finish all 15 topics of phase 12, then STOP.** Do not begin phase 13, 14, 15 or 16 without a
new instruction. Phase 14 was separately in flight under a different session at the time.

**Java was at 177 / 233 topics (76%)** when this order was written. Phase 12 was **9 of 15 closed**.

---

## Phase 12 state, measured off disk at the 2026-09-01 morning stop

| # | Topic | State | Owed |
|---|---|---|---|
| 01 | Memory layout | ✅ **CLOSED** | 47 files, 11,490 lines, 691 ★ |
| 02 | GC in practice | 🚧 **33 files, 8,333 lines, 396 ★** | `README.md` index + contiguous renumber. Max pos **33**; last written `08b-where-allocation-comes-from.md` |
| 03 | Heap sizing in containers | ✅ **CLOSED** | 17 files, 3,890 lines, 213 ★ |
| 04 | `OutOfMemoryError` | ✅ **CLOSED** | 24 files, 6,167 lines, 316 ★ |
| 05 | Thread dumps | ✅ **CLOSED** | 16 files, 3,792 lines, 248 ★ |
| 06 | JFR and profiling | ✅ **CLOSED** | 20 files, 4,666 lines, 320 ★ |
| 07 | Logging done right (**Master**) | 🚧 **16 files, 4,218 lines, 236 ★** | index + renumber. Max pos **16**; last `07-correlation-ids.md` |
| 08 | Metrics with Micrometer | 🚧 **3 files, 877 lines, 44 ★** | 🔴 **`03-the-meter-types.md` is 339 lines — OVER CAP, owes a proven split.** Max pos **3** |
| 09 | Distributed tracing (**Know**) | 🚧 **4 files, 996 lines, 54 ★** | index + rest. Max pos **4**; last `03-context-propagation.md` |
| 10 | Packaging for deploy | 🚧 **8 files, 1,875 lines, 149 ★** | Max pos **8**; last `02d-the-cache-variants-of-the-dockerfile.md` |
| 11 | GraalVM native image (**Know**) | 📋 planned | `_plan.md` exists |
| 12 | Graceful shutdown | 📋 planned | `_plan.md` exists |
| 13 | JVM flags that matter (**Know**) | 📋 planned | `_plan.md` exists |
| 14 | Benchmarking with JMH (**Know**) | 📋 planned | `_plan.md` exists |
| 15 | Checkpoint/restore CRaC (**When**) | 📋 planned | ⚠️ phase README uses tier class **`t-when`**, not `t-when-needed` |

(All rows below 08 have since advanced — see [[cursor-java]] for current state.)

---

## How the 2026-09-01 morning run worked, and what to repeat

**Coordinator + up to 4 `devbible-author` forks, one whole topic directory each.** Disjoint
directories, so there is no cross-fork renumbering. **Forks run NO git commands; the coordinator
commits**, gated on `wc -l <= 300` AND a `{/* FOOTER */}` marker.

- That gate held back several files that were momentarily over the cap — and in every case the
  fork split it itself within minutes. It costs nothing and prevents committing a rule violation.
- ⚠️ **A file's line count changes between checking and committing.** One file read 344 lines and
  227 a minute later. **Re-check at commit time.**
- 🔴 **Tell every fork to delete its scratch files.** One left 1.9 MB of downloaded `.cpp`/`.html`
  in `.src/` inside the docs tree, and a directory-level `git add` swept it into a commit.
- **Best practice, proven by the fork that did it:** plan chunk boundaries so every file lands
  under the cap on first write. That fork needed zero post-hoc splits.

**A reusable fork brief is in [[progress-java-p12-run-20260901]]** — copy its shape, including the
"verify from primary sources, not memory" list.

---

## 🔴 Banked research for topic 10 — reference (topic is closed; kept because pages cite it)

**Spring Boot packaging** (`docs.spring.io/spring-boot/reference/packaging/efficient.html`,
documented at 4.1.x):
- It is **`-Djarmode=tools`**, not `layertools`: `java -Djarmode=tools -jar my-app.jar extract`,
  and `help extract` lists options.
- Extracted layout: libraries to a `lib/` folder; the app jar holds classes plus a manifest
  referencing them.
- *"Loading classes from nested jars has a small startup cost"*; running extracted *"is faster and
  recommended in production"*. The default layout is *"AOT cache and CDS friendly"*.
- *"After startup, you should not expect any differences in execution time."*

**AOT cache** (`.../packaging/aot-cache.html`, Spring Boot 4.1.1):
- *"Spring Boot supports the AOT cache for Java 25 and above. If you're using an earlier version of
  Java, you have to use CDS instead."* and *"we recommend using the AOT cache whenever possible."*
- Training run, from the **extracted** dir:
  `java -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh -jar my-app.jar`
- Production: `java -XX:AOTCache=app.aot -jar my-app.jar`
- 🔴 **"You have to use the cache file with the extracted form of the application, otherwise it has
  no effect."** Silent no-op — the single most valuable gotcha in the topic.
- Cache is valid *"as long as the application is not updated and the same Java version is used"*.

**JEP 483** (JDK 24) — two-step: `-XX:AOTMode=record -XX:AOTConfiguration=app.aotconf`, then
`-XX:AOTMode=create -XX:AOTConfiguration=app.aotconf -XX:AOTCache=app.aot`. Non-goal: *"It is not a
goal to cache classes that are loaded by user-defined class loaders. Only classes loaded from the
class path, the module path, and the JDK itself, by the JDK's built-in class loaders, can be
cached."* Format *"is not specified and is subject to change without notice"*.

**JEP 514** (JDK 25) — one step: **`-XX:AOTCacheOutput=app.aot`** does the training run and cache
creation, creating and deleting a temporary config file. New env var **`JDK_AOT_VM_OPTIONS`**
applies options to the cache-creation sub-invocation only.

**JEP 515** (JDK 25, Scope: Implementation) — the AOT cache now also stores **method profiles**, so
the JIT starts optimising immediately. *"Profiles cached during training runs do not prevent
additional profiling during production runs."* No new workflow — same cache commands.

Related: [[cursor-java]] · [[java-board]] · [[java-playbook]] ·
[[progress-java-p12-run-20260901]] · [[progress-java-p12-run-20260901b]] ·
[[progress-java-p12-run-20260902]] · [[research-java-p12-t01-jvm-memory-internals]] ·
[[research-java-p12-metaspace-codecache-tlabs]].
