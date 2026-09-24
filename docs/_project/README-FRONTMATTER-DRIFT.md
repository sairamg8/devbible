---
name: readme-frontmatter-drift
description: The topic README sidebar_position/sidebar_label drift audit of 2026-09-04. nextjs, javascript and typescript FIXED (35 files); java and python (100 files) still owed and listed per file.
metadata:
  type: project
---

# Topic `README.md` frontmatter drift — the remediation list

✅ **MERGED TO `main` AND THE WORKTREE DELETED, 2026-09-04.** Merge commit `431fd701`
(parents `4bdc626a` + `6656d7dc`). Worktree `.claude/worktrees/musing-diffie-ebf274` and
branch `claude/musing-diffie-ebf274` both removed, `git worktree prune` run, the now-empty
`.claude/worktrees/` directory removed. `git worktree list` shows only the main checkout;
`git branch -a` shows only `main` plus the two `origin/` refs. The store carries no
reference to the dead worktree path.

⚠️ **Merged into a checkout with TWO live sessions writing** (java `77cb65cf`, python
`57732ef2`, both committing within the minute). Verified safe by diffing my 36 changed
files against main's 50 dirty files — **zero overlap** — before merging, and the merge's
first-parent diff confirmed it contributed **zero** java/python files. A mid-merge drop in
main's dirty count from 50 to 39 was the **python session committing its own work**
(`4bdc626a`), not a clobber; confirmed by matching the 13 files to that commit.
🔴 **The method is the reusable bit: diff your changed-file list against the live
checkout's dirty list and require an empty intersection before merging into a shared
working tree.**

⚠️ **NOT PUSHED.** `main` was 32 commits ahead of `origin/main` at hand-off; the deploy
workflow fires on any push to `main`, so pushing is a release and was left to the user.

**Audited 2026-09-04** against `.agents/references/house-style.md` line 64:
a topic `README.md` takes `sidebar_position: 0` and `sidebar_label: "Overview"`.

**Verdict: house-style.md is CORRECT.** 473 of 608 topic READMEs (78%) already conform.
The rule was NOT changed. The corpus is what drifted.

🔴 **This is not cosmetic.** In java / javascript / typescript the chunks number from 1,
so a README carrying the topic's number sorts **after** the chunks it indexes.
`phase-8-build-dependencies/11-javac-flags/README.md` sits at position 11 behind chunks
1, 2, 3 — the overview renders last in its own topic.

⚠️ **41 files are self-inconsistent under EITHER convention** (numbered position with
`"Overview"` label, or position 0 with a numbered label). That is the proof this is drift
and not a rival convention — a deliberate convention does not produce half-and-half files.

## Status

| Track | Affected | Lock state 2026-09-04 | Action |
|---|---:|---|---|
| **java** | 62 | 🔴 LIVE — session `77cb65cf`, committed 08:15 | ⏸ reported, NOT touched |
| **python** | 38 | 🔴 LIVE — session `57732ef2`, committed 08:07 | ⏸ reported, NOT touched |
| **javascript** | 17 | lock cleared by the user 2026-09-04 (20d idle) | ✅ **FIXED** — `6656d7dc` |
| **typescript** | 16 | lock cleared by the user 2026-09-04 (17d idle) | ✅ **FIXED** — `6656d7dc` |
| **nextjs** | 2 | ⏹️ wound down 2026-09-03 | ✅ **FIXED** |

✅ **RESOLVED 2026-09-04.** The user cleared the javascript and typescript board locks and
both tracks were fixed in `6656d7dc` (33 files: 17 position-only, 16 position + label).
**Corpus is now 508/608 conforming.** Only java (62) and python (38) remain, and both are
genuinely live — leave them to their own sessions.

🔴 **Pre-existing chunk-level defects found in passing, NOT fixed** (renumbering chunks
reorders the reading sequence and the footer chain, so it needs its own pass):
`typescript/phase-6-modules-build/07-authoring-d-ts-files/` duplicate positions 2,2 and
3,3 with gaps at 4 and 8 · `javascript/phase-4-objects-and-classes/03-existence-checks-and-delete/`
duplicate position 2,2.

## The fix

Positions are already gap-free in every affected directory once the README moves to 0,
because no chunk uses 0. So the fix is per-file and needs no renumbering of siblings:

```
sidebar_position: <topic number>   ->  sidebar_position: 0
sidebar_label: "NN · Whatever"     ->  sidebar_label: "Overview"
```

`sidebar_label` is not a link target; the audit confirmed no affected label is quoted in
prose as a label. Verify per directory with the house-style checklist line added 2026-09-04:

```bash
grep -H '^sidebar_\(position\|label\):' <dir>/README.md   # must be 0 and "Overview"
```

## The files

### java

```
pos=1 label="01 · What Java is"  docs/java/pages/phase-0-platform-jvm/01-what-java-is/README.md
pos=5 label="05 · Packages & classpath"  docs/java/pages/phase-0-platform-jvm/05-packages-classpath/README.md
pos=1 label="01 · JDBC"  docs/java/pages/phase-10-data-access/01-jdbc/README.md
pos=2 label="02 · AssertJ"  docs/java/pages/phase-11-testing/02-assertj/README.md
pos=7 label="07 · Testcontainers"  docs/java/pages/phase-11-testing/07-testcontainers/README.md
pos=5 label="05 · Floating point, BigDecimal"  docs/java/pages/phase-1-language-core/05-floating-point-bigdecimal/README.md
pos=6 label="06 · Strings"  docs/java/pages/phase-1-language-core/06-strings/README.md
pos=8 label="08 · Control flow, switch"  docs/java/pages/phase-1-language-core/08-control-flow-switch/README.md
pos=13 label="13 · null and NPE"  docs/java/pages/phase-1-language-core/13-null-and-npe/README.md
pos=6 label="06 · equals and hashCode"  docs/java/pages/phase-2-classes-objects/06-equals-hashcode/README.md
pos=8 label="08 · Records"  docs/java/pages/phase-2-classes-objects/08-records/README.md
pos=10 label="10 · Enums"  docs/java/pages/phase-2-classes-objects/10-enums/README.md
pos=1 label="01 · Generics and raw types"  docs/java/pages/phase-3-generics-collections/01-generics-raw-types/README.md
pos=5 label="05 · ArrayList"  docs/java/pages/phase-3-generics-collections/05-arraylist/README.md
pos=10 label="10 · Comparable vs Comparator"  docs/java/pages/phase-3-generics-collections/10-comparable-comparator/README.md
pos=11 label="11 · Iteration and CME"  docs/java/pages/phase-3-generics-collections/11-concurrent-modification/README.md
pos=14 label="14 · Choosing a collection"  docs/java/pages/phase-3-generics-collections/14-choosing-a-collection/README.md
pos=1 label="01 · Lambdas and functional interfaces"  docs/java/pages/phase-4-lambdas-streams/01-lambdas-functional-interfaces/README.md
pos=3 label="03 · The stream pipeline"  docs/java/pages/phase-4-lambdas-streams/03-stream-pipeline/README.md
pos=4 label="04 · map, filter, flatMap"  docs/java/pages/phase-4-lambdas-streams/04-map-filter-flatmap/README.md
pos=5 label="05 · Collectors"  docs/java/pages/phase-4-lambdas-streams/05-collectors/README.md
pos=7 label="07 · Optional used correctly"  docs/java/pages/phase-4-lambdas-streams/07-optional/README.md
pos=1 label="01 · The hierarchy, checked vs unchecked"  docs/java/pages/phase-5-exceptions/01-hierarchy-checked-unchecked/README.md
pos=2 label="02 · try/catch/finally mechanics"  docs/java/pages/phase-5-exceptions/02-try-catch-finally/README.md
pos=3 label="03 · try-with-resources"  docs/java/pages/phase-5-exceptions/03-try-with-resources/README.md
pos=5 label="05 · Reading stack traces"  docs/java/pages/phase-5-exceptions/05-reading-stack-traces/README.md
pos=1 label=lifecycle, interrupt"  docs/java/pages/phase-6-concurrency/01-threads-lifecycle-interrupt/README.md
pos=2 label="02 · Platform vs virtual threads"  docs/java/pages/phase-6-concurrency/02-platform-vs-virtual-threads/README.md
pos=3 label="03 · Race conditions"  docs/java/pages/phase-6-concurrency/03-race-conditions/README.md
pos=4 label="04 · synchronized"  docs/java/pages/phase-6-concurrency/04-synchronized-intrinsic-locks/README.md
pos=5 label="05 · The Java Memory Model"  docs/java/pages/phase-6-concurrency/05-java-memory-model/README.md
pos=6 label="06 · ExecutorService and pools"  docs/java/pages/phase-6-concurrency/06-executorservice-pools/README.md
pos=15 label="15 · Immutability first"  docs/java/pages/phase-6-concurrency/15-immutability-first-strategy/README.md
pos=1 label="01 · java.time"  docs/java/pages/phase-7-io-time-stdlib/01-java-time/README.md
pos=5 label="05 · JSON with Jackson"  docs/java/pages/phase-7-io-time-stdlib/05-json-jackson/README.md
pos=1 label="01 · Maven core"  docs/java/pages/phase-8-build-dependencies/01-maven-core/README.md
pos=2 label="02 · Dependency scopes"  docs/java/pages/phase-8-build-dependencies/02-dependency-scopes/README.md
pos=3 label="03 · Transitive and mediation"  docs/java/pages/phase-8-build-dependencies/03-transitive-and-mediation/README.md
pos=4 label="04 · Gradle"  docs/java/pages/phase-8-build-dependencies/04-gradle/README.md
pos=5 label="05 · Wrappers"  docs/java/pages/phase-8-build-dependencies/05-wrappers/README.md
pos=6 label="06 · Layout & multi-module"  docs/java/pages/phase-8-build-dependencies/06-layout-and-multi-module/README.md
pos=7 label="07 · Versioning, updates & CVEs"  docs/java/pages/phase-8-build-dependencies/07-versioning-updates-cve/README.md
pos=8 label="08 · Jar anatomy"  docs/java/pages/phase-8-build-dependencies/08-jar-anatomy/README.md
pos=9 label="09 · Annotation processing"  docs/java/pages/phase-8-build-dependencies/09-annotation-processing/README.md
pos=10 label="10 · Artifact repositories"  docs/java/pages/phase-8-build-dependencies/10-artifact-repositories/README.md
pos=11 label="11 · javac flags that matter"  docs/java/pages/phase-8-build-dependencies/11-javac-flags/README.md
pos=1 label=the servlet model"  docs/java/pages/phase-9-spring-boot/01-why-frameworks-servlet-model/README.md
pos=0 label="02 · The IoC container"  docs/java/pages/phase-9-spring-boot/02-the-ioc-container/README.md
pos=3 label="03 · Dependency injection"  docs/java/pages/phase-9-spring-boot/03-dependency-injection/README.md
pos=4 label="04 · Bean scopes and lifecycle"  docs/java/pages/phase-9-spring-boot/04-bean-scopes-lifecycle/README.md
pos=5 label="05 · Boot auto-configuration"  docs/java/pages/phase-9-spring-boot/05-auto-configuration/README.md
pos=0 label="06 · Configuration and profiles"  docs/java/pages/phase-9-spring-boot/06-configuration-and-profiles/README.md
pos=0 label="07 · REST controllers"  docs/java/pages/phase-9-spring-boot/07-rest-controllers/README.md
pos=0 label="08 · Validation"  docs/java/pages/phase-9-spring-boot/08-validation/README.md
pos=0 label="09 · Error handling"  docs/java/pages/phase-9-spring-boot/09-error-handling/README.md
pos=0 label="10 · The request pipeline"  docs/java/pages/phase-9-spring-boot/10-the-request-pipeline/README.md
pos=0 label="11 · Spring Security"  docs/java/pages/phase-9-spring-boot/11-spring-security/README.md
pos=0 label="12 · Outbound HTTP"  docs/java/pages/phase-9-spring-boot/12-outbound-http/README.md
pos=0 label="13 · Actuator"  docs/java/pages/phase-9-spring-boot/13-actuator/README.md
pos=0 label="14 · OpenAPI with springdoc"  docs/java/pages/phase-9-spring-boot/14-openapi-springdoc/README.md
pos=0 label="15 · WebFlux and reactive"  docs/java/pages/phase-9-spring-boot/15-webflux-reactive/README.md
pos=0 label="16 · The alternatives"  docs/java/pages/phase-9-spring-boot/16-the-alternatives/README.md
```

### python

```
pos=1 label="01 · What Python is"  docs/python/pages/phase-0-runtime/01-what-python-is/README.md
pos=2 label="02 · The GIL"  docs/python/pages/phase-0-runtime/02-the-gil/README.md
pos=3 label="03 · The release model"  docs/python/pages/phase-0-runtime/03-release-model/README.md
pos=4 label="04 · Installing and versions"  docs/python/pages/phase-0-runtime/04-installing-and-versions/README.md
pos=5 label="05 · Virtual environments"  docs/python/pages/phase-0-runtime/05-virtual-environments/README.md
pos=6 label="06 · Running code"  docs/python/pages/phase-0-runtime/06-running-code/README.md
pos=7 label="07 · Everything is an object"  docs/python/pages/phase-0-runtime/07-everything-is-an-object/README.md
pos=8 label="08 · Imports"  docs/python/pages/phase-0-runtime/08-imports/README.md
pos=9 label="09 · if __name__ == \"__main__\""  docs/python/pages/phase-0-runtime/09-name-main/README.md
pos=10 label="10 · Python vs Node"  docs/python/pages/phase-0-runtime/10-python-vs-node/README.md
pos=11 label="11 · Startup and import cost"  docs/python/pages/phase-0-runtime/11-startup-and-import-cost/README.md
pos=12 label="12 · Bytecode inspection with `dis`"  docs/python/pages/phase-0-runtime/12-dis-bytecode/README.md
pos=1 label="1 · Syntax and indentation"  docs/python/pages/phase-1-language-core/01-syntax-and-indentation/README.md
pos=2 label="02 · Numbers"  docs/python/pages/phase-1-language-core/02-numbers/README.md
pos=3 label="03 · Strings"  docs/python/pages/phase-1-language-core/03-strings/README.md
pos=4 label="04 · bytes vs str"  docs/python/pages/phase-1-language-core/04-bytes-and-encoding/README.md
pos=5 label="05 · Truthiness"  docs/python/pages/phase-1-language-core/05-truthiness/README.md
pos=6 label="06 · Comparisons"  docs/python/pages/phase-1-language-core/06-comparisons/README.md
pos=7 label="07 · Assignment and aliasing"  docs/python/pages/phase-1-language-core/07-assignment-and-aliasing/README.md
pos=8 label="08 · Control flow"  docs/python/pages/phase-1-language-core/08-control-flow/README.md
pos=9 label="09 · Comprehensions"  docs/python/pages/phase-1-language-core/09-comprehensions/README.md
pos=10 label="10 · `match`"  docs/python/pages/phase-1-language-core/10-match-pattern-matching/README.md
pos=11 label="11 · Exceptions"  docs/python/pages/phase-1-language-core/11-exceptions/README.md
pos=12 label="12 · EAFP vs LBYL"  docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/README.md
pos=13 label="13 · Unpacking"  docs/python/pages/phase-1-language-core/13-unpacking/README.md
pos=14 label="14 · `None` and no-result"  docs/python/pages/phase-1-language-core/14-none-and-no-result/README.md
pos=15 label="15 · PEP 8 and idiom"  docs/python/pages/phase-1-language-core/15-pep8-and-idiom/README.md
pos=16 label="16 · `del`, `pass`, `Ellipsis`"  docs/python/pages/phase-1-language-core/16-del-pass-ellipsis/README.md
pos=1 label="Overview"  docs/python/pages/phase-2-functions/01-def-and-return/README.md
pos=2 label="Overview"  docs/python/pages/phase-2-functions/02-parameters-in-full/README.md
pos=3 label="Overview"  docs/python/pages/phase-2-functions/03-scope-and-closures/README.md
pos=4 label="Overview"  docs/python/pages/phase-2-functions/04-lambda/README.md
pos=5 label="Overview"  docs/python/pages/phase-2-functions/05-decorators/README.md
pos=6 label="Overview"  docs/python/pages/phase-2-functions/06-functools/README.md
pos=7 label="Overview"  docs/python/pages/phase-2-functions/07-callables-beyond-functions/README.md
pos=8 label="Overview"  docs/python/pages/phase-2-functions/08-docstrings/README.md
pos=9 label="Overview"  docs/python/pages/phase-2-functions/09-annotations-at-runtime/README.md
pos=10 label="Overview"  docs/python/pages/phase-2-functions/10-recursion-and-the-limit/README.md
```

