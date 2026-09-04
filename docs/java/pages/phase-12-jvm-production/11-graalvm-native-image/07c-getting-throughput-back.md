---
title: "The compiler's static guess is a knob, not a fate — but three of the four levers that raise a native image's throughput ceiling (-O3, GraalNN and PGO) are documented as unavailable in GraalVM Community Edition, which makes 'is native image slow?' a question about your licence before it is a question about your code"
sidebar_label: "07c · Getting throughput back"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Optimizations and Performance"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/)),
> "Build Options"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/)) and
> "Build Output"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOutput/));
> all three read from `docs/reference-manual/native-image/` on the **`release/graal-vm/25.3`** branch of
> [`oracle/graal`](https://github.com/oracle/graal/tree/release/graal-vm/25.3/docs/reference-manual/native-image).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run** — there is not a single throughput, size or build-time
> measurement on this page, and every option below is transcribed from documentation rather than exercised.

**[07b](07b-no-jit-no-jfr-no-jstack.md) established that a throughput regression in a native image is always a *build* regression, because nothing at run time makes a compilation decision. This page is the other half of that: if the build decides everything, the build is where every remedy lives. There are four levers — the optimisation level, the static profile inference model, the target instruction set, and profile-guided optimisation — and the honest headline is that `-O3`, the GraalNN profiler and PGO are all documented with the same sentence: *"Not available in GraalVM Community Edition."* On CE your levers are `-O2`, `-march`, and whatever you can do to the code.**

## The optimisation levels, and what each is actually for

The `-O` option is modelled on `gcc` and `clang`, and **the default is `-O2`**:

> *"Similar to `gcc` and `clang`, users can control the optimization level using the `-O` option. By default, `-O2` is used which aims for a good tradeoff between performance, file size, and build time."*

The reference's own table, transcribed:

| Level | Optimizations | What it is for |
|---|---|---|
| `-Ob` | Reduced | *"Quick build mode: Speeds up builds during development by avoiding time-consuming optimizations. This can also reduce file size sometimes."* |
| `-Os` | Reduced | *"Optimize for size: `-Os` enables all `-O2` optimizations except those that can increase code or image size significantly. Typically creates the smallest possible images at the cost of reduced performance."* |
| `-O0` | None | *"Typically used together with `-g` to improve the debugging experience."* |
| `-O1` | Basic | *"Trades performance for reduced file size and build time. Oracle GraalVM's `-O1` is somewhat comparable to `-O2` in GraalVM Community Edition."* |
| `-O2` | Advanced | **Default.** *"Aims for good performance at a reasonable file size."* |
| `-O3` | All | *"Aims for the best performance at the cost of longer build times. Used automatically by Oracle GraalVM for PGO builds (`--pgo` option). `-O3` and `-O2` are identical in GraalVM Community Edition."* |

Four sentences in that table carry the whole argument and are easy to skim past:

- 🔴 **`-O3` and `-O2` are *identical* in Community Edition.** Passing `-O3` on CE is not a small win; it is documented as no win at all. A benchmark that "tried `-O3` and saw nothing" on CE has confirmed the documentation, not disproved the option.
- 🔴 **Oracle's `-O1` is "somewhat comparable" to CE's `-O2`.** That is the distributions' relative position stated by the vendor: the *reduced* Oracle level is in the neighbourhood of the *default* CE level. Read it as an admission that the gap between the two compilers is not marginal.
- ⚠️ **`-O3` is applied automatically by Oracle GraalVM when you pass `--pgo`.** You do not stack them; asking for PGO already asks for `-O3`.
- ⚠️ **`-Ob` costs peak throughput and the Build Output page says so plainly** — *"the overall peak throughput of the executable may be lower due to the reduced number of optimizations."* It is a development-loop setting. It appears in CI templates because it makes the build faster, and that is exactly the wrong reason to have it in a release pipeline.

```xml
<!-- native-maven-plugin: a development profile and a release profile that differ only in -O -->
<buildArgs>
  <buildArg>-Ob</buildArg>
</buildArgs>
```

⚠️ The Native Build Tools plugin also exposes quick build mode as `<quickBuild>true</quickBuild>`, or the environment variable `GRAALVM_QUICK_BUILD=true`. **Three spellings of the same switch is three places a release build can pick it up by accident** — check all three before concluding that your production binary was built the way you think it was.

## GraalSP and GraalNN — the compiler is already guessing, and there are two guessers

An AOT compiler with no profile has to invent branch probabilities. GraalVM does not leave that to fixed heuristics; it ships two static profile-inference models, and **which one you get is a side effect of the `-O` level you chose**:

> *"Native Image supports machine learning-driven static profiling, as a built-in capability. By default, GraalVM runs at the `-O2` optimization level, which uses the simple and fast **Graal Static Profiler (GraalSP)** for profile inference. This model is optimized for a wide range of applications."*

> *"As of GraalVM for JDK 24, the new **Graal Neural Network (GraalNN)** static profiler can be used for ML-powered profile inference, offering even better performance. Enable it by passing the `-O3` option to Native Image."*

> Note: *"Not available in GraalVM Community Edition."*

The reference reduces it to two bullets:

> *"**GraalSP** (simple model) is used with `-O2` by default."*
> *"**GraalNN** (advanced model) is used with `-O3` by default."*

And the interaction with a real profile, which is the sentence that saves you a wasted experiment:

> *"Note that if the user provides a PGO profile using the `--pgo` option, additional ML inference is unnecessary and therefore disabled automatically."*

🔴 **So `-O3` is not "more inlining". On Oracle GraalVM it is a different profile-inference model.** That reframes the option: it is a *guess quality* lever, and the moment you have a measured profile the guess is discarded entirely. The ordering that follows is: a real profile beats GraalNN, GraalNN beats GraalSP, and on Community Edition you have GraalSP and nothing else.

The Build Output's `Graal Compiler` line reports which of these is in force, and it is worth reading on every release build. The documented values:

> *"On Oracle GraalVM, the line also shows information about Profile-Guided Optimization (PGO)"* — `off`, `instrument`, `user-provided`, or `ML-inferred` (*"A machine learning (ML) model is used to infer profiles for control split branches statically."*)

**`ML-inferred` in the build log means you are not using a real profile.** That single word is the cheapest audit available for "did our PGO pipeline actually feed a profile into this build".

## `-march` — the fastest lever you are probably not using, and the portability bill it hands you

`-march` controls which instructions the compiler may emit:

> *"Native Image provides a `-march` option that works similarly to the ones in `gcc` and `clang`: it enables users to control the set of instructions that the Graal compiler can use when compiling code to native."*

The values:

| Value | Meaning, in the reference's words |
|---|---|
| *(default)* | *"By default, Native Image uses `x86-64-v3` on x64 and `armv8-a` on AArch64."* |
| `native` | *"If the generated binary is built on the same or similar machine type that it is also deployed on, use `-march=native`. This option instructs the compiler to use all instructions that it finds available on the machine the binary is generated on."* |
| `compatibility` | *"If the generated binary … is distributed to users with many different, and potentially very old machines, use `-march=compatibility`. This reduces the set of instructions used by the compiler to a minimum and thus improves the compatibility of the generated binary."* |
| `list` | *"Use `-march=list` to list all available machine types."* |

**The builder will nag you about this itself.** The Build Output page documents a `CPU` recommendation in the build summary:

> *"The Native Image build process has determined that your CPU supports more features, such as AES or LSE, than currently enabled. If you deploy your application on the same machine or a similar machine with support for the same CPU features, consider using `-march=native` at build time. This option allows the Graal compiler to use all CPU features available, which in turn can significantly improve the performance of your application."*

🔴 **`-march=native` and a container registry are a bad pair, and the conditional in that sentence is the reason.** The recommendation is guarded by *"If you deploy your application on the same machine or a similar machine with support for the same CPU features"* — a condition that a build agent producing an image for a heterogeneous fleet cannot assert. A CI runner on a recent instance type and a production node on an older one are not "the same or similar machine".

⚠️ **What the documentation does not say, and I will not invent:** none of the three pages states what happens at run time when a binary built with a given `-march` lands on a CPU that lacks those instructions. There is no documented diagnostic, exit code or error message for that case. **I could not confirm the failure mode**, so the safe framing is the one the docs support: `-march` is a compatibility contract you are choosing, and if your fleet is not homogeneous, `compatibility` is the value that keeps the contract wide.

The practical policy, then:

```xml
<!-- release build for a heterogeneous fleet or a published artefact -->
<buildArgs>
  <buildArg>-march=compatibility</buildArg>
</buildArgs>
```

```xml
<!-- release build pinned to one instance family, built on that family -->
<buildArgs>
  <buildArg>-march=x86-64-v3</buildArg>
</buildArgs>
```

**Prefer naming the level explicitly over `native`.** `-march=native` makes the artefact a function of the build agent, which is the one input to a build that nobody version-controls and that a cloud provider can change under you. Naming `x86-64-v3` (or whatever `-march=list` offers that your fleet guarantees) gives you the same instruction set with a reproducible build.

### 🔴 An upstream divergence in the `-march` default — recorded, not reconciled

**Two GraalVM 25.3 pages state different AArch64 defaults.** "Optimizations and Performance" and "Build Output" both say `armv8-a`; the generated option table in "Build Options" says:

> *"generate instructions for a specific machine type. Defaults to `'x86-64-v3'` on AMD64 and `'armv8.1-a'` on AArch64."*

The x64 default (`x86-64-v3`) is consistent across all three. The AArch64 default is not. **Do not "fix" one page's number to match the other in your notes** — the divergence is upstream, and the option table is generated from the source while the prose pages are hand-written, so they can drift. If the AArch64 baseline matters to your deployment, read it off `-march=list` on the exact GraalVM build you ship with rather than off either page.

## Position-independent code and relative code pointers

This is the lever you will not touch and should still recognise, because it explains a class of "why is my binary like this" question.

> *"Native Image generally builds executables as position-independent executables (PIE). On most platforms, this is already the default for the system toolchain that Native Image uses. On Linux systems, Native Image also requests PIE explicitly. Shared library images (`-shared`) are always position-independent. The operating system can use address space layout randomization (ASLR) on position-independent code to make its location in memory less predictable, which improves security."*

PIE is not free, and the reference is explicit about the bill:

> *"Typically, position-independent code introduces many additional relocations for pointers that must be adjusted at runtime based on where the code was loaded. The dynamic linker needs to process these relocations, which increases startup time, memory usage, and file size."*

🔴 **Read that sentence next to [01](01-what-problem-it-solves.md).** Startup time is the entire reason this topic exists, and PIE relocations are a documented startup cost. GraalVM's answer is a mitigation, on by default:

> *"Native Image substantially reduces this cost by using relative code pointers by default. Instead of storing absolute code addresses that need adjustment, relative code pointers store offsets from the code base, the start of the code area. At runtime, Native Image keeps the code base address in a dedicated register and computes absolute code addresses by adding that base address to the stored offset."*

And its own cost, stated honestly by the vendor:

> *"The overhead of relative code pointers is typically negligible. However, code with unusually many indirect calls or code that is especially sensitive to register pressure might see small slowdowns."*

Two escape hatches exist and both are the wrong default:

```bash
# give up relative code pointers (keeps PIE, restores absolute addresses)
native-image -H:-RelativeCodePointers -jar app.jar

# give up PIE itself on Linux — and with it, ASLR
native-image -H:NativeLinkerOption=-no-pie -jar app.jar
```

⚠️ **`-no-pie` trades a security property for a startup property.** ASLR is the thing PIE buys; turning PIE off makes the code's location in memory predictable. That is a security review conversation, not a performance tweak, and it belongs next to [04b](04b-the-secret-baked-into-the-image.md) rather than in a `<buildArgs>` block someone copied from a forum.

## The lever this page does not own

Profile-guided optimisation is the fourth lever and it is a workflow rather than a flag — two builds, a representative run, a profile artefact and a staleness problem. It has its own chunk: [07ca · Profile-guided optimization](07ca-profile-guided-optimization.md).

Three levers this page also does not own, because earlier chunks do:

- **The collector.** `--gc=G1` is a throughput and latency lever and it is Oracle-GraalVM-and-Linux only — [07](07-runtime-characteristics.md).
- **Build-time initialisation.** *"Loading application configuration during the image build can speed up application startup"* — [04](04-build-time-vs-run-time-initialisation.md).
- **Compressed references**, the footprint lever with the 32 GB ceiling — [07](07-runtime-characteristics.md).

## Gotchas

**★ Symptom: `-O3` was added and nothing changed.** Cause: you are on GraalVM Community Edition, where *"`-O3` and `-O2` are identical"* and GraalNN is *"Not available"*. Fix: confirm the distribution first ([01b](01b-the-distribution-and-the-licence.md)). If CE is fixed, the level lever does not exist for you and `-march` plus code changes are what remains.

**★ Symptom: a release binary is slower than expected and the build log says `ML-inferred`.** Cause: the build used static ML profile inference, meaning no `.iprof` file was supplied — the PGO pipeline either did not run or did not deliver its artefact to the release build. Fix: check the `Graal Compiler` line on every release build and treat anything other than `user-provided` as a pipeline failure when PGO is supposed to be in use ([07ca](07ca-profile-guided-optimization.md)).

**★ Symptom: `-Ob` is in the production build arguments.** Cause: it was added to make CI faster and never removed, or it arrived through `<quickBuild>` or the `GRAALVM_QUICK_BUILD` environment variable rather than through `-O`. Fix: grep all three spellings, and put quick build mode behind a development-only Maven profile so a release build cannot inherit it:

```xml
<profile>
  <id>fast-native</id>
  <build><plugins><plugin>
    <groupId>org.graalvm.buildtools</groupId>
    <artifactId>native-maven-plugin</artifactId>
    <configuration><quickBuild>true</quickBuild></configuration>
  </plugin></plugins></build>
</profile>
```

**★ Symptom: the binary is bigger than the team will accept and `-Ob` was the first idea.** Cause: `-Ob` reduces size only *"sometimes"* per the reference; the documented size lever is `-Os`, which *"enables all `-O2` optimizations except those that can increase code or image size significantly"*. Fix: use `-Os` and accept its stated cost — *"the smallest possible images at the cost of reduced performance"* — rather than reaching for a mode designed for build latency.

**★ Symptom: a debug build is unreadable — inlined frames, missing variables.** Cause: the default `-O2` optimises aggressively and debug information describes optimised code. Fix: the documented pairing is `-O0` with `-g` — *"Typically used together with `-g` to improve the debugging experience."* Build a separate diagnostic binary; do not ship `-O0`.

**★ Symptom: the same source produces different-performing binaries on two CI runners.** Cause: `-march=native` — *"use all instructions that it finds available on the machine the binary is generated on"* — makes the artefact a function of the agent's CPU. Fix: name the machine type explicitly (`-march=x86-64-v3`, or a level from `-march=list` that your fleet guarantees), so the build is reproducible and the instruction contract is written down.

**★ Symptom: the build summary keeps recommending `-march=native` and someone wants to just do it.** Cause: the `CPU` recommendation fires whenever the *build* machine has features the default level does not enable; it knows nothing about your deployment fleet. Fix: read the condition attached to it — *"If you deploy your application on the same machine or a similar machine with support for the same CPU features"* — and only take the advice when that is actually true. For a container image shipped to a mixed fleet it is not.

**★ Symptom: a `-march` decision has to be justified and nobody can say what happens on an unsupported CPU.** Cause: the documentation does not state it. Fix: do not guess a failure mode into a design document. State what is documented — `compatibility` *"reduces the set of instructions used by the compiler to a minimum and thus improves the compatibility of the generated binary"* — and choose `compatibility` when the fleet is not known, which is the conservative reading and the only one the sources support.

**★ Symptom: someone proposes `-H:NativeLinkerOption=-no-pie` for startup.** Cause: PIE relocations genuinely cost startup, so the idea is not stupid. Fix: it is already mitigated — relative code pointers are on by default and their overhead is *"typically negligible"* — so the marginal gain from dropping PIE is small while the loss is ASLR. Reject it unless a security owner has signed off, and measure the mitigation-on case first.

**★ Symptom: a workload with very many indirect calls is slower than an equivalent JVM build by more than the topic predicts.** Cause: one documented candidate is relative code pointers — *"code with unusually many indirect calls or code that is especially sensitive to register pressure might see small slowdowns."* Fix: `-H:-RelativeCodePointers` is the switch that isolates it. Treat this as a diagnosis step, not a default: it re-introduces the relocation cost the mitigation exists to remove.

**★ Symptom: `--pgo` and `-O3` are both being passed and the build takes even longer.** Cause: redundancy, not a bug — `-O3` is *"Used automatically by Oracle GraalVM for PGO builds (`--pgo` option)"*, and supplying a profile disables ML inference anyway. Fix: pass `--pgo` alone. The level is implied.

**★ Symptom: the throughput conversation has run for two weeks without anyone naming the distribution.** Cause: three of the four levers on this page carry the same footnote and it is the first thing to establish. Fix: settle the distribution before the benchmark ([01b](01b-the-distribution-and-the-licence.md)). On Community Edition, `-O2` with GraalSP *is* the ceiling, and the honest next question is [09 · When it pays](09-when-it-pays.md), not another flag.

## Interview questions

**★ What does `-O3` actually change, and when does it change nothing?**
On Oracle GraalVM it selects a different static profile-inference model: `-O2` uses the Graal Static Profiler (GraalSP), described as *"the simple and fast"* model, and `-O3` uses the Graal Neural Network (GraalNN), *"the new … static profiler … for ML-powered profile inference"*, available since GraalVM for JDK 24. It also means "all optimizations" at the cost of longer builds. On GraalVM Community Edition it changes nothing at all — the reference says *"`-O3` and `-O2` are identical in GraalVM Community Edition"*, and GraalNN is separately marked *"Not available in GraalVM Community Edition."* And on Oracle GraalVM with `--pgo`, `-O3` is already applied for you, and the ML inference is disabled because a real profile supersedes an inferred one.

**★ Rank the profile sources a native image build can use.**
Best is a real profile from `--pgo`, because it is measured behaviour rather than inference, and it explicitly switches off ML inference when present. Next is GraalNN at `-O3` on Oracle GraalVM — machine-learned inference over the static code. Next is GraalSP at `-O2`, the simple fast model that is the default and the only one available on Community Edition. There is no fourth tier described in the reference; there is no "no profile" mode, because inference is a built-in capability rather than an opt-in. The practical consequence is that the profile-quality axis and the licence axis are the same axis for two of the three tiers.

**★ Why is `-march=native` a bad default for a containerised service, given that the builder itself recommends it?**
The recommendation is conditional and the condition is usually false. `-march=native` instructs the compiler *"to use all instructions that it finds available on the machine the binary is generated on"*, and the build-output recommendation is prefixed with *"If you deploy your application on the same machine or a similar machine with support for the same CPU features."* A container image built on a CI runner and scheduled across a heterogeneous node pool violates that condition, and it also makes the artefact non-reproducible: the same commit built on a different agent produces a differently-compiled binary. The reproducible way to get the same benefit is to name a machine type explicitly — a level from `-march=list` that every node in the fleet guarantees. For a widely-distributed binary the reference's own answer is `-march=compatibility`, which *"reduces the set of instructions used by the compiler to a minimum."*

**★ What is quick build mode, and why is it a defect in a release pipeline?**
`-Ob` is *"Quick build mode: Speeds up builds during development by avoiding time-consuming optimizations."* It exists because the native build is the slowest step in the loop ([06b](06b-the-build-that-takes-ten-minutes.md)), and it trades peak throughput for build latency — the Build Output page says *"the overall peak throughput of the executable may be lower due to the reduced number of optimizations."* It is a defect in a release pipeline because it silently lowers the ceiling of the artefact you ship, and because it has three spellings — `-Ob`, the plugin's `<quickBuild>`, and `GRAALVM_QUICK_BUILD=true` — so it can be inherited from a parent POM or a CI environment without appearing in the build arguments anyone reads.

**★ Native image builds position-independent executables. What does that cost, and what does GraalVM do about it?**
PIE lets the operating system apply ASLR, *"which improves security"*, and it is the default from the system toolchain with Linux additionally requesting it explicitly. The cost is relocations: *"position-independent code introduces many additional relocations for pointers that must be adjusted at runtime … The dynamic linker needs to process these relocations, which increases startup time, memory usage, and file size"* — all three of which are the metrics this whole topic exists to optimise. GraalVM mitigates it with relative code pointers, on by default, storing offsets from a code base address held in a dedicated register instead of absolute addresses. The mitigation's own overhead is *"typically negligible"*, with a named exception for *"code with unusually many indirect calls or code that is especially sensitive to register pressure."* The switches are `-H:-RelativeCodePointers` and, to disable PIE outright on Linux, `-H:NativeLinkerOption=-no-pie` — the second of which gives back ASLR and should be treated as a security decision.

**★ A native service is slower than the JVM it replaced. Walk the build inputs in order.**
Distribution first, because it gates three levers: on Community Edition, PGO, GraalNN and a meaningful `-O3` do not exist, and the conversation is about whether native image is the right shape at all. Then the optimisation level actually in force, including the three spellings of quick build mode. Then the `Graal Compiler` line in the build output: `ML-inferred` when you expected `user-provided` means the profile never reached the build. Then the collector, since Serial GC is the default and G1 is Oracle-and-Linux only ([07](07-runtime-characteristics.md)). Then `-march`, since the default `x86-64-v3` leaves newer CPU features unused and the builder's own `CPU` recommendation will say so. Only after all five is it worth looking at the application code — and unlike a JVM, there is no run-time explanation available, because there is nothing at run time that makes a compilation decision ([07b](07b-no-jit-no-jfr-no-jstack.md)).

**★ Why does the reference tell you the relationship between Oracle's `-O1` and Community Edition's `-O2`?**
Because it is the only place the documentation quantifies the gap between the two compilers, and it does so in the direction people do not expect: *"Oracle GraalVM's `-O1` is somewhat comparable to `-O2` in GraalVM Community Edition."* `-O1` is described as trading performance for smaller files and faster builds, so the vendor is saying that its *reduced* level lands near CE's *default* level. It is a licence statement wearing an optimisation-table costume, and it is worth quoting in any build-versus-buy discussion, because it is the vendor's own characterisation rather than a third-party benchmark.

{/* FOOTER */}
