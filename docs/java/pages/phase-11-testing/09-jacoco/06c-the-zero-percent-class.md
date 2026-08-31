---
title: "The class that reads 0%: six different situations render identically in the report, JaCoCo's FAQ says outright that it cannot distinguish two of them, and the Sessions page is the documented way to tell one of the worst apart from the rest"
sidebar_label: "06c · The class that reads 0%"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/classids.html` (quoted on CRC64 class
> ids, the mismatch behaviour and the Sessions-page diagnosis) and `doc/faq.html` (quoted on
> missing execution data). Version spine from `spring-boot-dependencies:4.1.0`: JDK 25,
> Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No build and no test runs on this machine** — documented behaviour and configuration only,
> never report output.

**A class showing 0% is the report's most actionable finding and its most ambiguous one. Six
distinct situations produce that same red bar, they range from "write a test" to "your build is
broken and every number on this page is wrong", and the report offers no way to tell most of them
apart. This chunk is the diagnostic order — cheapest check first — and the one documented
technique that separates the worst case from the rest.**

## The six causes

| # | Cause | Scope | Fix |
|---|---|---|---|
| 1 | No test reaches it | one class or package | Write a test — the finding you wanted |
| 2 | Class never loaded | one class or package | Often the same as 1; sometimes a config/profile issue |
| 3 | Excluded at the **agent** rather than the report | whatever was excluded | Move the exclusion to the report |
| 4 | **Class id mismatch** — class files changed between run and report | often everything | Report against the same classes the tests ran on |
| 5 | Agent never attached | **everything** | The argLine trap, or a missing exec file |
| 6 | Code ran in a **different JVM** | a coherent subsystem | Nothing — document the limitation |

Note the scope column. **It is the fastest discriminator you have**, and it costs nothing:

- **Everything at 0%** → cause 5 almost always, cause 4 sometimes. Not a testing problem.
- **A coherent subsystem at 0%** → cause 6 (a container, a forked process) or cause 3.
- **Scattered individual classes at 0%** → cause 1 or 2. The real finding.

## The diagnostic order

### Step 1 · Does `target/jacoco.exec` exist and have size?

One `ls`. If it is missing or near-zero after a test run, the agent never attached — **cause 5**,
and nothing else in the report means anything. Go to [chunk 02b](02b-the-argline-trap.md).

This is first because it is the cheapest check and it rules out the cause that invalidates
everything else.

### Step 2 · Open the report's Sessions page

This is the documented technique, and it is the only way to identify cause 4 from inside the
report. From `doc/classids.html`:

> *"If the entry is not linked this means there is a class id mismatch between the class used at
> runtime and the class provided to create the report."*

The Sessions page lists the classes seen during the run. A class that appears there but is **not
linked** to a coverage page has a class id mismatch: it was loaded and instrumented, but the class
file handed to the report generator is not byte-identical to the one that ran.

Why it must be byte-identical is in [chunk 01b](01b-how-jacoco-works.md): the id is a **CRC64 of
the raw class file**, and JaCoCo refuses a near-match because probes are *"stored in a plain
boolean array"* with no metadata, so pairing them with a differently-laid-out class would produce
*"random coverage results"*. Refusing is the safe failure; the visible consequence is that
affected classes are, in its words, *"reported with 0% coverage"*.

**What causes a mismatch in practice:**

- Spring Boot repackaging, or a shade/shadow step, running before the report.
- An AspectJ post-compile weave, or any bytecode post-processor.
- An obfuscator or shrinker — which also destroys line numbers, so you get two symptoms
  ([chunk 03c](03c-line-coverage-needs-debug-info.md)).
- **A different compiler between the run and the report.** A CI image whose JDK differs by a patch
  release from the one that produced cached class files is enough. This is the cause of "coverage
  broke and nothing changed".
- Generating the report against a different directory than the tests ran against.

### Step 3 · Check the exclusion configuration

**Cause 3.** JaCoCo's FAQ is explicit:

> *"If execution data is missing for a particular class, this class is shown as not covered because
> the report generator cannot distinguish whether the class was excluded from instrumentation or
> not executed."*

So an agent-level exclusion produces a class at 0% that looks exactly like an untested one. If the
classes at 0% match an `excludes` pattern in `prepare-agent`, that is your answer — and the fix is
to move the exclusion to the report ([chunk 05](05-exclusions.md)).

### Step 4 · Ask where the code runs

**Cause 6.** Anything executing outside the test JVM is invisible: a Testcontainers container, a
forked process, a `@SpringBootTest` against a packaged image, a scheduled job in another service.
The classes are genuinely exercised and genuinely unmeasured, and there is no configuration that
fixes it short of instrumenting that JVM too ([chunk 02d](02d-integration-tests-and-failsafe.md)).

### Step 5 · Only now, is it untested?

**Causes 1 and 2**, and the distinction between them is worth one more question: *could* a test
reach this class as the suite is configured? A class behind a profile the tests never activate,
behind a `@ConditionalOnProperty` that is false in test configuration, or only constructed by a
framework in a context the tests do not build, is not reached — but writing a unit test for it
will not change the report, because the report is telling you about the *suite's* configuration.

Only after all five steps is "nobody tested this" the conclusion — and it is a good conclusion,
worth acting on.

## The one you must not skip

**Do not delete a class because it reads 0%.** Four of the six causes have nothing to do with the
class being unused, and the report cannot tell you which one you have. Before deleting, confirm at
minimum that nothing references it statically, and that it is not wired by configuration,
reflection, a service loader, or a framework annotation — none of which a coverage report knows
about and none of which show up as a compile error when you remove the class.

## Where this connects

- **[01b · How JaCoCo works](01b-how-jacoco-works.md)** — class ids, probes, and why the matching
  is byte-exact.
- **[02b · The argLine trap](02b-the-argline-trap.md)** — cause 5, in full.
- **[05 · Exclusions](05-exclusions.md)** — cause 3, and the right place to exclude.
- **[02d · Integration tests](02d-integration-tests-and-failsafe.md)** — cause 6.
- **[06 · What the number cannot say](06-what-the-number-cannot-say.md)** — this as question 6 of
  seven.

## Gotchas

**★ The scope of the zeroes is the cheapest diagnostic and nobody uses it.**
Everything at 0% is a broken pipeline, not a testing problem. A coherent subsystem at 0% is a
different JVM or an exclusion. Scattered individual classes are the real finding. Looking at the
shape before looking at any class saves most of the investigation.

**★ JaCoCo's FAQ says outright that it cannot distinguish an agent-excluded class from an unexecuted one.**
Both render as not covered. This is documented behaviour, not a limitation to work around, and it
is the reason excluding at the agent to improve a number makes it worse instead.

**★ The Sessions page is the only in-report way to spot a class id mismatch.**
An unlinked entry means the class was loaded at runtime but the class file given to the report is
not byte-identical. From the main report the mismatch is indistinguishable from an untested class.
Almost nobody knows the Sessions page exists, and it is the documented diagnostic.

**★ A JDK patch-version difference between the build that compiled and the build that reports is enough to break class ids.**
The id is a CRC64 over the raw class file bytes, not a semantic identity. A CI image change, a
cached `target/classes` from a different toolchain, or a toolchain misconfiguration produces a
report of zeroes with no other symptom and no error message.

**★ Spring Boot repackaging between the test run and the report will do it.**
So will shading, AspectJ weaving, or any bytecode post-processor. The rule is simple and worth
stating in a build: generate the report against the same class directory the tests ran against,
never against a packaged or post-processed artifact.

**★ An obfuscator produces two symptoms from one cause, and they get diagnosed as two problems.**
It changes the bytes — so class ids mismatch and classes read 0% — and it strips or rewrites the
line-number table — so the line column disappears. Two investigations, one root cause.

**★ A class behind a profile or a `@ConditionalOnProperty` the tests never enable is unreachable, not untested.**
Writing a unit test for it may not change the report, because the class is never loaded in the
suite's configuration. The finding is about the test configuration, not about the class, and
treating it as "someone forgot a test" leads to a test that does not move the number.

**★ Deleting a class because it reads 0% is how an incident starts.**
Reflection, service loaders, `@ConditionalOn*` wiring, and configuration-driven instantiation are
all invisible to both the coverage report and the compiler. The class disappears, the build is
green, and the failure arrives in the environment where that configuration is active.

**★ A test JVM killed by a timeout or an OOM kill writes no execution data.**
The agent writes on shutdown. A suite that was terminated rather than exited produces a report of
zeroes that looks exactly like cause 5, but `target/jacoco.exec` may exist from an earlier run and
mislead the first diagnostic step. Check the file's timestamp, not just its existence.

**★ Everything at 0% with a green build is worth an explicit CI assertion.**
A coverage report over zero covered instructions is a broken pipeline, and no threshold reliably
catches it — some rule formulations pass vacuously with no data. Assert that the exec file exists
and that total covered instructions are non-zero, as a separate step.

## Interview questions

**★ A class reports 0% coverage. Walk through your diagnosis.**
First look at the scope: everything at 0% means the agent never attached or class ids do not
match, a whole subsystem means a different JVM or an exclusion, and scattered classes are the real
finding. Then check `target/jacoco.exec` exists and is recent — if not, the agent never attached.
Then the report's Sessions page: an entry present but unlinked means a class id mismatch, which
JaCoCo documents as producing 0% coverage. Then check whether the classes match an agent-level
`excludes` pattern, since the FAQ says the generator cannot distinguish exclusion from
non-execution. Then ask whether the code runs in another JVM. Only then is it untested.

**★ What is a class id mismatch and how do you confirm one?**
JaCoCo identifies classes in execution data by a CRC64 checksum of the raw class file, so the match
between recorded probes and analysed classes is byte-exact. If the class files differ between the
run and the report — a different compiler or version, different settings, or any post-processing
like repackaging, shading or weaving — the data cannot be related and the classes are reported at
0%. You confirm it on the report's Sessions page: the class appears as having been seen at runtime,
but its entry is not linked to a coverage page.

**★ Why is the matching byte-exact rather than by class name?**
Because the execution data is a bare boolean array of probes with no metadata about which probe
corresponds to which instruction. Matching by name would allow probe data recorded against one
instruction layout to be applied to a different layout, which JaCoCo's documentation says would
produce random coverage results. Refusing to match and reporting 0% is the safe failure: visibly
wrong rather than invisibly wrong.

**★ Your whole coverage report is zeroes but the build is green and the tests passed. What is it?**
Almost certainly that the agent never reached the test JVM — in Maven, a Surefire `<argLine>` in
plugin configuration overwriting the property `prepare-agent` set. Check whether `target/jacoco.exec`
exists; if it is absent, that is confirmed. If the file is there and populated, the collection side
worked and the problem is on the report side: class ids not matching because the report was
generated against post-processed class files.

**★ Can you delete code that shows 0% coverage?**
Not on that evidence. Four of the six causes of a 0% reading have nothing to do with the code being
unused — agent exclusion, class id mismatch, a missing agent, and execution in another JVM. And even
when it genuinely was not reached, the class may be wired by reflection, a service loader, or
conditional configuration that the test suite never activates, none of which the coverage report or
the compiler knows about. 0% tells you where to start looking; it is not the finding itself.

{/* FOOTER */}
