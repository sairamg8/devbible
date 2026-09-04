---
title: "Profile-guided optimization is the only lever that gives an AOT compiler what a JIT gets for free — and it costs you two builds, a representative workload, a versioned .iprof artefact and a standing answer to 'how stale is this profile?', which is why it is a pipeline design problem rather than a flag"
sidebar_label: "07ca · Profile-guided optimization"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Profile-Guided Optimization"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/PGO/)),
> "Basic Usage of Profile-Guided Optimization"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/PGO/basic-usage/)),
> "Tracking Profile Quality"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/PGO/profile-quality/)),
> "Merging Profiles from Multiple Sources", "PGO Frequently Asked Questions" and "Build Options";
> all read from `docs/reference-manual/native-image/` on the **`release/graal-vm/25.3`** branch of
> [`oracle/graal`](https://github.com/oracle/graal/tree/release/graal-vm/25.3/docs/reference-manual/native-image).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.1 / Spring Framework 7.0.9**.
> Documentation-validated; **no sandbox run**. 🔴 **The reference's own PGO guide contains measured
> elapsed times and file sizes for a toy "Game of Life" program. None of them are reproduced here** —
> they are a demonstration on a 120-line single-class program with a CPU clock pinned at 2.5 GHz, and the
> reference itself says the improvement *"is not representative of the PGO gains for real world applications."*

> ⚠️ **Not available in GraalVM Community Edition.** The reference states this three separate times, on
> the PGO overview, in the optimisation-level discussion and in the basic-usage guide: *"PGO is not
> available in GraalVM Community Edition."* Everything on this page presumes Oracle GraalVM
> ([01b](01b-the-distribution-and-the-licence.md)).

**A JIT compiler earns its advantage by watching the program run. PGO is the mechanism that hands an ahead-of-time compiler the same information, and the reference frames it exactly that way: without a profile *"an AOT compiler sees each branch of every `if` statement as equally likely to occur at run time; each method is as likely to be invoked as any other; and each loop repeats the same number of times."* The flags are trivial — `--pgo-instrument`, run, `--pgo`. What is not trivial is that you now own a build artefact that decays, whose quality is a function of how representative your workload was, and which will silently make the binary *worse* if you feed it the wrong one. This page is about owning that artefact.**

## The mechanism, in the reference's terms

> *"One advantage that a just-in-time (JIT) compiler has over an ahead-of-time (AOT) compiler is its ability to analyze the run-time behavior of an application. … Profile-Guided Optimization (PGO) is a technique that brings profile information to an AOT compiler to improve the quality of its output in terms of performance and size."*

A profile is not a flame graph. It is a counter log, and the reference lists the questions it answers:

> *"How many times was this method called? How many times did this `if` statement take the `true` branch? How many times did it take the `false` branch? How many times did this method allocate an object? How many times was a `String` value passed to a particular `instanceof` check?"*

The way it "guides" is by breaking ties the static view cannot break. The reference's worked example is an inliner with a size budget looking at two calls that are *"pretty much indistinguishable"* statically — a happy path and an argument-validation failure path — and picking the wrong one because it has no way to know which runs. **That framing matters operationally: PGO does not make code faster, it stops the compiler spending its budget on code that never runs.**

## The three steps

> 1. *"Build your application with `--pgo-instrument`."*
> 2. *"Run your instrumented application with a representative workload to generate profiling information. Profiles collected from this run are stored by default in the `default.iprof` file."*
> 3. *"Rebuild your application with the `--pgo` option. You can pass a custom `.iprof` file with `--pgo=<your>.iprof`, otherwise `default.iprof` is used."*

```bash
# 1 · instrumented build — a second, throwaway binary
native-image --pgo-instrument -cp . com.example.BillingApplication -o billing-instrumented

# 2 · run it under a workload that looks like production, naming the profile explicitly
./billing-instrumented -XX:ProfilesDumpFile=billing-2026-09.iprof

# 3 · the real build, fed the profile
native-image --pgo=billing-2026-09.iprof -cp . com.example.BillingApplication -o billing
```

Four details the three-step summary leaves out:

- **`-XX:ProfilesDumpFile` is a run-time option on the instrumented binary**, and it is how you avoid every profile in your pipeline being called `default.iprof`. The reference: *"By default, just before exiting, it generates a file with the default name `default.iprof` in the current working directory, but you can specify a different name and path for the profile by passing the `-XX:ProfilesDumpFile` option when running the instrumented binary."*
- 🔴 **The profile is written at exit.** *"just before exiting"* — so an instrumented run that is killed rather than shut down produces no profile. In a containerised load test that means the workload must end by the application terminating normally, which for a web application means a shutdown path that actually runs ([12 · Graceful shutdown](../12-graceful-shutdown/README.md)).
- **`--pgo` takes a list.** The Build Options table: *"a comma-separated list of files from which to read the data collected for profile-guided optimization of AOT compiled code (reads from `default.iprof` if nothing is specified). Each file must contain a single `PGOProfiles` object, serialized in JSON format, optionally compressed by gzip."* So the profile is inspectable JSON, and gzip is supported — useful, because these are build artefacts you will be storing.
- ⚠️ **The option name is spelled two ways in the reference itself.** The Build Options table and the step list both use **`--pgo-instrument`**; one sentence in the basic-usage guide says *"by adding the `--pgo-instrumented` option"* while the command directly beneath it uses `--pgo-instrument`. **`--pgo-instrument` is the one in the generated option table**, which is the stronger source. I did not run either, so I state the divergence rather than resolving it by assertion.

There is a third acquisition mode the summary never mentions, listed in the Build Options table:

> `--pgo-sampling` — *"perform profiling by sampling the AOT compiled code to collect data for profile-guided optimization."*

⚠️ **I found no prose documentation for `--pgo-sampling` on the 25.3 reference pages** — it appears in the generated option table and nowhere else that I read. Its trade-off against instrumentation (lower overhead, presumably lower fidelity) is not documented, so **do not design a pipeline around it on the strength of its name.**

## The workload is the whole game

Everything that goes wrong with PGO goes wrong here. The reference is unusually blunt:

> *"Providing a counter-productive profile (a profile that records the exact opposite of the actual runtime behavior of the application) will be counter-productive."*

> *"Hence, the goal is to gather profiles on workload that match the production workloads as much as possible. The gold standard for this is to run the exact same workloads you expect to run in production on the instrumented binary."*

And the flat warning that PGO is not a free bet:

> *"An incorrect profile can result in worse performance than no profile. This is because an incorrect profile can lead the compiler to spend optimization resources on the wrong elements of the application and deprioritize the important elements."*

### 🔴 Do not profile with your unit tests

This is the mistake with the strongest gravitational pull, because a test suite is the one repeatable workload every project already has. The FAQ answers it directly — *"Yes, it is possible, but usually not recommended"* — and gives three reasons:

> *"Unit tests are designed to test all the corner-cases of the components, many of which are uncommon in practice (in other words, while they need to be tested and work correctly, corner-cases in your code usually do not need to be fast)."*

> *"Different components of your code are not always represented with the same number of unit tests. A profile based on a unit-test suite may over-represent the importance of one component, and under-represent the importance of others."*

> *"Unit-test suites evolve over time as more and more tests get added. What might accurately represent your application's behavior today, might not accurately represent it tomorrow."*

The recommended alternatives, verbatim:

> *"Identify a subset of end-to-end tests that represent important production workloads. An end-to-end test simulates what your application does in production, and is more likely to correctly portray how and where the time is spent in your code."*

> *"Or, create a benchmark workload that represents what your application does in production. A good benchmark would incorporate characteristics of a typical workload."*

For a web service the reference is concrete about who generates the load and for how long:

> *"GraalVM itself does not generate a workload for profiling a web application that was compiled with Native Image. Instead, you need to use a load-testing tool to generate the workload. … For a simple web application, duration of 1 minute is typically sufficient to produce profiles of good quality (but this depends on your particular application)."*

And it explicitly blesses the approach most teams assume is off-limits:

> *"Why not collect profile in the production environment for a while? … Yes, that is a good way to collect profiles. An instrumented binary has a certain overhead … However, if only one instance uses the instrumented binary during a particular period, and all other instances of your service use a normal or PGO-optimized build, then this is generally acceptable in practice."*

🔴 **One canary instance running the instrumented binary is the highest-fidelity profile source available, and the vendor recommends it.** If you have the deployment machinery to run one pod on a different image, that beats every synthetic benchmark you could write.

## Profile staleness, and the two metrics that measure it

The question every team asks in month two — *"how long can I keep using this profile?"* — has a documentation page of its own, and it names three strategies.

**Reuse indefinitely.** Permitted and safe from a correctness standpoint: *"providing an out-of-date profile for your application (or even a profile for a completely different application) should not stop Native Image from producing a native executable."* But: *"reusing a single profile indefinitely for an evolving application will sooner or later turn counterproductive."*

**Recollect periodically.** The reference's example is a daily job that builds an instrumented binary from the tip of the main branch, runs a workload, and publishes the `.iprof`. Its two pieces of advice are worth lifting into your own pipeline design:

> *"Align your profiling schedule with the application-release schedule, to avoid building an application with a stale profile."*

> *"Ideally, convert the production workload into a reproducible workload, collect the profiles as part of your build, and then create an optimized native executable with profiles that are always fresh."*

**Measure the staleness.** Two metrics exist and are printed on request:

```bash
native-image -cp . com.example.BillingApplication -o billing \
  --pgo=billing-2026-09.iprof -H:+PGOPrintProfileQuality
```

⚠️ *"(This option is experimental.)"* — and on a build that already needs `-H:+UnlockExperimentalVMOptions` for other reasons, remember that experimental options are gated ([06](06-building-one.md)).

| Metric | The question it answers | Moves when |
|---|---|---|
| **Applicability** | *"How applicable is this profile to the application's methods?"* — the ratio `S / N` of code locations where a profile was available to locations that needed one, as a percentage | you **add** code without re-profiling: *"more code means more requests for profiles"* while `S` stays fixed |
| **Relevance** | *"To what extent do the profile contents match the application methods?"* — the percentage of profile data *not* dropped when loading, since entries that match no method are discarded | you **remove** or rename code: *"removing code from the application (and not from the profile) should result in the profile relevance reduction"*. Adding code does not move it |

🔴 **Neither number means anything on its own, and the reference says so twice.**

> *"It is wrong to expect a profile applicability of 100%. A good workload will, in almost all cases, differentiate between the hot and the cold parts of the application, and will not execute some of the cold parts of the code."*

> *"It is wrong to expect that building an optimized binary of exactly the same application as the one used to gather the profile will result in the profile relevance of 100%. This is not the case because the methods of the instrumented binary and the optimized binary differ in subtle ways."*

> *"These numbers also make little sense or have little utility when observed in one single build. Their utility comes from observing the metrics change when re-using profile across builds."*

And the caveat that stops you turning them into an SLO:

> *"Note that these metrics are a measure of the relationship between the provided profile and the set of methods in the application, and are not in any way a measurement or prediction of any performance impact."*

**So the correct use is a trend, not a threshold.** Record both numbers per build alongside the profile's collection date; when they drift, that is your signal to re-profile — not a gate that fails the build.

## Merging profiles

A service with several distinct traffic shapes does not have one representative workload. The tooling supports combining them:

> *"The PGO infrastructure enables you to combine multiple profiles into a single one using the Native Image Utils Tool. Merging profiles implies that the resulting profile will contain the union of all types, methods, and profile entries from the provided profiles."*

```bash
# merge two named profiles
native-image-utils merge-pgo-profiles \
  --input-file=billing-checkout.iprof \
  --input-file=billing-reporting.iprof \
  --output-file=billing-merged.iprof

# or merge every profile in a directory (non-recursive)
native-image-utils merge-pgo-profiles \
  --input-dir=profiles/ \
  --output-file=billing-merged.iprof
```

⚠️ **`--input-dir` does not recurse** — *"it only searches for profiles in the given directory, excluding subdirectories."* A per-scenario directory tree will silently merge nothing.

## Cross-platform profiles

The FAQ settles a question that otherwise doubles your pipeline:

> *"Yes, in most cases, the PGO profiles are sufficiently cross-platform. You can collect the profiles by running an instrumented binary on one platform, but then use those profiles to build an optimized native executable on a different platform."*

With the exception named:

> *"There are some cases in which Native Image uses different classes and methods depending on the platform for which the binary was built. … In these cases, the profile will contain entries for one platform, but the optimized native build will not find profile entries for its platform-specific code. These corner-cases are rare and typically do not result in a performance impact."*

> *"In conclusion, the best practice is always to collect the profiles on the same platform that is the target for the optimized native executable. However, using the profiles collected on a different platform should typically work well."*

**Read as: a macOS developer laptop can produce a usable profile for a Linux container image**, and if you can profile on the target platform you should.

## Where it goes in the pipeline

[06b](06b-the-build-that-takes-ten-minutes.md) already argues that the native build does not belong on every commit. PGO makes that argument stronger, because the workflow is **two** native builds plus a workload run, and the instrumented build is one of the two cases the reference singles out as memory-hungry:

> *"Native Image compilation is memory-intensive, particularly when building large projects or when using `-H:Preserve=all` or `--pgo-instrument`."*

A shape that works:

| Trigger | What runs | Profile |
|---|---|---|
| Every commit | JVM tests, plus a JVM run with `-Dspring.aot.enabled=true` | none |
| Nightly / pre-release | instrumented native build → load test → publish `.iprof` as a versioned build artefact | **produced** |
| Release candidate | `--pgo=<published profile>` optimised build, `-H:+PGOPrintProfileQuality` recorded | **consumed** |
| Continuously, optional | one canary instance on the instrumented binary | **produced, highest fidelity** |

🔴 **Version the `.iprof` file like a dependency, not like a cache.** It is an input to a reproducible build: given the same source and the same profile you get the same binary, and given a different profile you do not. Storing it as a CI cache — evictable, unversioned, silently absent — turns your release build into a coin flip between `user-provided` and `ML-inferred` ([07c](07c-getting-throughput-back.md)).

## Gotchas

**★ Symptom: `--pgo-instrument` or `--pgo` is rejected, or has no effect.** Cause: *"PGO is not available in GraalVM Community Edition."* Fix: establish the distribution before designing the pipeline ([01b](01b-the-distribution-and-the-licence.md)). On CE there is no profile-guided path and the throughput ceiling is `-O2` with GraalSP.

**★ Symptom: the instrumented run finished and there is no `.iprof` file.** Cause: the profile is written *"just before exiting"*, so a run terminated by SIGKILL, a container OOM kill, or a load test that tears the pod down rather than stopping the process produces nothing. Fix: end the profiling run by shutting the application down cleanly, and name the destination so you can assert on it:

```bash
./billing-instrumented -XX:ProfilesDumpFile=/artifacts/billing.iprof &
PID=$!
run-load-test --duration 60s
kill -TERM "$PID" && wait "$PID"
test -s /artifacts/billing.iprof || { echo "no profile produced"; exit 1; }
```

**★ Symptom: PGO was adopted and the binary got slower.** Cause: the profile misrepresents production — *"An incorrect profile can result in worse performance than no profile."* Fix: check what the workload actually exercised. The classic version of this is profiling with the unit-test suite, which the FAQ recommends against because corner-case tests *"over-represent the importance of one component, and under-represent the importance of others."* Replace it with end-to-end tests chosen to mirror production, a load test with a production-shaped request mix, or a canary instance.

**★ Symptom: the team wants to profile with the existing test suite because it is the only repeatable workload.** Cause: reasonable instinct, documented as wrong. Fix: the reference names two substitutes and both are buildable — *"Identify a subset of end-to-end tests that represent important production workloads"*, or *"create a benchmark workload that represents what your application does in production."* For an HTTP service, drive it with a load tester such as `wrk` for around a minute; that is the reference's own worked recommendation.

**★ Symptom: CI time roughly doubles after adopting PGO.** Cause: the workflow is two native builds plus a workload run, and `--pgo-instrument` is explicitly called out as memory-intensive. Fix: move profile *production* to a nightly or pre-release job, publish the `.iprof` as a versioned artefact, and have the release build only *consume* it. Per-commit CI keeps the cheap JVM check with `-Dspring.aot.enabled=true` ([06b](06b-the-build-that-takes-ten-minutes.md)).

**★ Symptom: nobody can say whether the release binary used the profile.** Cause: `--pgo` with a missing file falls back rather than failing loudly, and the difference is invisible in the artefact. Fix: read the `Graal Compiler` line in the build output, where PGO reports as `off`, `instrument`, `user-provided` or `ML-inferred`, and fail the pipeline on anything other than `user-provided` for a release build ([07c](07c-getting-throughput-back.md)).

**★ Symptom: profile applicability is 22% and someone has opened an incident.** Cause: treating an absolute value as a health metric. Fix: *"It is wrong to expect a profile applicability of 100%"* — a good workload leaves cold code such as exception handlers unprofiled, and the reference's own example application sits in that range. Track the *change* across builds that share a profile; a drop means code was added since collection, not that anything is broken.

**★ Symptom: profile relevance dropped after a refactor that added no code.** Cause: relevance is the percentage of profile data *not* discarded at load, so removing or renaming methods drops entries — the reference's worked example is a single method rename. Fix: expected behaviour. Re-profile if the renamed code was hot; ignore it if the change was in cold code, which the reference notes *"should not impact performance."*

**★ Symptom: `-H:+PGOPrintProfileQuality` is rejected.** Cause: it is documented as experimental. Fix: unlock experimental options for that build ([06](06-building-one.md)), and keep the metric collection on the release-candidate build rather than every build, so an experimental option is not load-bearing in your normal path.

**★ Symptom: `merge-pgo-profiles --input-dir` produced an output with far less data than expected.** Cause: *"it only searches for profiles in the given directory, excluding subdirectories."* Fix: flatten the profiles into one directory, or list them individually with repeated `--input-file` arguments.

**★ Symptom: a service with two very different traffic shapes gets worse under PGO whichever workload is used.** Cause: one profile cannot represent two disjoint behaviours; whichever you pick, the compiler deprioritises the other. Fix: collect one profile per shape and merge them — the merge produces *"the union of all types, methods, and profile entries from the provided profiles"* — or, if the shapes are genuinely separate services sharing a codebase, build separate binaries with separate profiles.

**★ Symptom: the pipeline maintains a separate profiling job per target platform.** Cause: assuming profiles are platform-bound. Fix: they largely are not — *"You can collect the profiles by running an instrumented binary on one platform, but then use those profiles to build an optimized native executable on a different platform."* Collect on the target platform when it is convenient, but do not build a matrix for it.

**★ Symptom: `--pgo` and `-O3` are both configured "to be safe".** Cause: reasonable-looking redundancy. Fix: `-O3` is *"Used automatically by Oracle GraalVM for PGO builds"*, and supplying a profile disables ML inference anyway — *"if the user provides a PGO profile using the `--pgo` option, additional ML inference is unnecessary and therefore disabled automatically."* Pass `--pgo` alone.

**★ Symptom: the profile artefact was stored in the CI cache and one release build came out slower than its predecessor with no source change.** Cause: cache eviction. `--pgo` with the file absent does not fail the build; it falls back to inference. Fix: store the profile as a versioned build artefact with an immutable coordinate, resolve it explicitly, and assert the file exists before invoking `native-image`.

**★ Symptom: someone proposes running the instrumented binary in production for everyone, "since profiles help".** Cause: conflating the instrumented binary with the optimised one. Fix: *"an instrumented binary of the application is not as performant as a default binary due to the overhead of the instrumentation code, so it is not recommended to run it in production."* The documented production-profiling pattern is **one instance**, with the rest of the fleet on the normal or PGO-optimised build.

## Interview questions

**★ Why does an AOT compiler need PGO when a JIT does not?**
Because the JIT already has the information PGO supplies. The reference puts it plainly: a JIT *"keeps track of how many times each branch of an `if` statement is executed"* and hands that to the optimising tier, while an AOT compiler *"is usually limited to a static view of the code"* in which *"each branch of every `if` statement"* looks equally likely, every method looks equally hot, and every loop looks the same length. PGO is the mechanism for moving that measurement to build time: instrument, run a representative workload, feed the resulting profile back into a second compilation. The trade is that the profiling overhead is paid once at build time by a throwaway binary instead of continuously in production, which is exactly the trade native image makes everywhere else.

**★ Walk through the PGO workflow and name the artefact it produces.**
Three steps. Build with `--pgo-instrument`, which produces an instrumented binary containing counters. Run that binary under a workload that resembles production; on exit it writes an `.iprof` file, `default.iprof` by default or wherever `-XX:ProfilesDumpFile` points. Rebuild with `--pgo=<file>.iprof`. The artefact is that `.iprof` — JSON, optionally gzipped, containing a single `PGOProfiles` object — and treating it as a first-class versioned build input rather than a scratch file is the difference between a reproducible optimised build and an accidental one. Note that the profile is written just before exit, so the profiling run has to terminate cleanly.

**★ Why should you not use your unit-test suite as the profiling workload?**
Three documented reasons. Unit tests deliberately concentrate on corner cases, and *"corner-cases in your code usually do not need to be fast"*. Test density does not track code importance, so a profile from tests *"may over-represent the importance of one component, and under-represent the importance of others."* And test suites grow, so a profile that represents the application today drifts as tests are added for reasons unrelated to production behaviour. Since an incorrect profile *"can result in worse performance than no profile"*, a misleading workload is not a neutral choice. The recommended replacements are a selected subset of end-to-end tests, a production-shaped benchmark, or — the highest-fidelity option and one the vendor explicitly endorses — a single canary instance in production running the instrumented binary while the rest of the fleet runs the normal build.

**★ What are profile applicability and profile relevance, and how would you use them?**
Applicability is the fraction of code locations that wanted a profile and got one, expressed as a percentage: it falls when you add code without re-profiling, because the denominator grows. Relevance is the fraction of the profile's data that survived loading — entries referring to methods that no longer exist are dropped — so it falls when you remove or rename code, and is unaffected by additions. Both are printed by the experimental `-H:+PGOPrintProfileQuality` option. The critical usage rule is that neither absolute value means anything: 100% applicability would mean even the cold paths were profiled, which a good workload deliberately avoids, and 100% relevance is unreachable even against the identical application because the instrumented binary contains counter and serialisation code the optimised one does not. They are a drift signal across builds that share a profile, and the reference is explicit that they are *"not in any way a measurement or prediction of any performance impact."*

**★ How stale can a profile get?**
There is no documented expiry, and the reference offers three strategies rather than a number. Reuse indefinitely is safe for correctness — an out-of-date profile, or even a profile from a different application, still produces a working binary — but *"will sooner or later turn counterproductive."* Recollect on a schedule, with the advice to *"align your profiling schedule with the application-release schedule"* and, better, to make the workload reproducible enough that profiling becomes part of the build so profiles are *"always fresh"*. Or track applicability and relevance over time and re-profile when they drift. In practice, tie profile collection to the release cadence and record the two metrics per build: that gives you both a floor on staleness and evidence when it matters.

**★ Your service serves two very different traffic patterns. How do you profile it?**
Collect one profile per pattern and merge them with `native-image-utils merge-pgo-profiles`, which produces *"the union of all types, methods, and profile entries from the provided profiles."* Pass the inputs individually with repeated `--input-file`, or point `--input-dir` at a flat directory — remembering that it does not recurse into subdirectories. If the two patterns are really separate workloads that happen to share a codebase, the alternative is two binaries with two profiles, which also gives each one a smaller image. What you must not do is pick one pattern and hope, because the compiler will then deprioritise the other, and a profile that is actively wrong about the hot path is worse than no profile.

**★ Can you collect a profile on one platform and build on another?**
Yes, in most cases — *"You can collect the profiles by running an instrumented binary on one platform, but then use those profiles to build an optimized native executable on a different platform."* The exception is code selected by platform, such as the POSIX and Windows process-properties implementations, where the profile will simply have no entries for the target's platform-specific classes; the reference calls these cases rare and says they *"typically do not result in a performance impact."* The stated best practice remains to profile on the target platform when you can. Practically this means a developer on macOS or a build agent on a different architecture can still produce a usable profile for a Linux container image, and you do not need a profiling matrix.

**★ Where does PGO belong in a CI pipeline, and why not on every commit?**
It is two native builds plus a workload run, and the instrumented build is one of the cases the reference names as memory-intensive alongside `-H:Preserve=all`. So profile *production* goes on a nightly or pre-release job that publishes the `.iprof` as a versioned artefact, and the release build only *consumes* it with `--pgo`. Per-commit CI stays on the cheap signals: JVM tests, and a JVM run with `-Dspring.aot.enabled=true` to prove the AOT-generated context is valid. The failure mode to guard against is a missing profile silently falling back to ML inference, which is why the release job should assert the file exists and check that the build output's `Graal Compiler` line says `user-provided` rather than `ML-inferred`.

{/* FOOTER */}
