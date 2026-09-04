---
title: "There are two GraalVM distributions with different licences and different native-image capabilities — G1, PGO, ML profile inference and the build report are Oracle GraalVM only — so 'we'll use GraalVM' is not yet a decision"
sidebar_label: "01b · Distribution and licence"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM FAQ**, "How is GraalVM Licensed?" ([graalvm.org](https://www.graalvm.org/faq/));
> the **GraalVM Downloads** page ([graalvm.org](https://www.graalvm.org/downloads/)); the **GraalVM Release Calendar**
> ([graalvm.org](https://www.graalvm.org/release-calendar/)); the **Native Image reference**, "Memory Management"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/MemoryManagement/))
> and "Optimizations and Performance"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run**.

**"GraalVM" names two products with the same command-line tools and materially different behaviour. Oracle GraalVM is licensed under the GraalVM Free Terms and Conditions; GraalVM Community Edition is GPLv2 with the Classpath Exception. The features that decide whether a native image can compete with a warmed JVM on throughput — profile-guided optimisation, the G1 collector, ML-based profile inference and the `-O3` level — are documented as *not available in GraalVM Community Edition*. If you benchmark CE and conclude native image is slow, you benchmarked the wrong product; if you deploy Oracle GraalVM without reading the licence, you may have made a redistribution decision nobody signed off.**

## The two products

| | **Oracle GraalVM** | **GraalVM Community Edition** |
|---|---|---|
| Licence | GraalVM Free Terms and Conditions (GFTC), *including License for Early Adopter Versions* | GNU General Public License v2 **with the Classpath Exception** |
| Native Image G1 GC | ✅ (Linux AMD64 and AArch64 only) | ❌ |
| Profile-Guided Optimization (`--pgo`) | ✅ | ❌ |
| ML profile inference (GraalNN, `-O3`) | ✅ | ❌ — *"`-O3` and `-O2` are identical"* |
| `-O1` | Documented as *"somewhat comparable to `-O2` in GraalVM Community Edition"* | baseline |
| `--emit build-report` | ✅ | ❌ |
| Serial GC, Epsilon GC | ✅ | ✅ |
| Reachability metadata, agent, `jcmd`, JFR, heap dumps | ✅ | ✅ |

Every ❌ in that table is a verbatim *"Not available in GraalVM Community Edition"* note in the reference manual, on the page named in the `> Verified:` line — not an inference.

## The licence, quoted

The GraalVM FAQ is the primary statement, and it is short enough to quote in full where it matters:

> *"Oracle GraalVM is licensed under GraalVM Free Terms and Conditions (GFTC) including License for Early Adopter Versions."*

> *"Subject to the conditions in the license, including the License for Early Adopter Versions, the GFTC is intended to permit use by any user including commercial and production use."*

> *"GraalVM Community Edition is distributed under version 2 of the GNU General Public License with the “Classpath” Exception."*

On what the GFTC actually permits:

> *"The GFTC is intended to permit use of the Program, including runtime image output produced by the jlink tool or GraalVM Native Image feature, by any user, including in commercial and production use. Hosted use, including allowing use by third parties who do not obtain a copy of the Program or runtime images, is generally considered use for your internal business operations, and you may charge fees for your service. **Redistribution is permitted as long as it is not for a fee.**"*

🔴 **"Free for all uses" is the wrong summary.** The two clauses that decide real cases are: *hosted use is fine and you may charge for the service*, and *redistribution is permitted **as long as it is not for a fee***. A SaaS built on Oracle GraalVM is squarely inside the licence. **Shipping a native executable built with Oracle GraalVM as part of a paid, downloadable product is the case to take to a lawyer, not to a blog post.** CE, being GPLv2 with the Classpath Exception, is the conventional open-source position and the Classpath Exception is what stops the GPL propagating into your application code.

## ⚠️ A licence can change at a patch boundary

The downloads page carries a notice that is worth internalising as a *pattern*, not just a fact:

> *"CPU releases of GraalVM for JDK 17.0.13 and later are released under the GraalVM OTN license"*

> *"Updates for Oracle GraalVM for JDK 21 and Oracle GraalVM 25.0 and 25.3 continue to be available under the GraalVM Free Terms and Conditions license."*

So the JDK 17 line moved off GFTC at a *patch* boundary while the 21 and 25 lines did not. The lesson is not "avoid GraalVM"; it is that **the licence is a property of the release you pull, not of the product name**, and a dependency-update bot that bumps a base image tag can move it. If your build pins `ghcr.io/graalvm/...` or an SDKMAN identifier, the licence check belongs in the same review as the version bump.

## Version numbering changed in September 2025 — and again in mid-2026

Old material will say "GraalVM for JDK 21". The release calendar states the change:

> *"Prior to September 2025, releases were labeled “GraalVM for JDK `<version>`” (for example, GraalVM for JDK 21); since then they use the simpler “GraalVM `<version>`” format."*

and the scheme itself:

> *"GraalVM follows the JDK version numbering scheme described in JEP 223 (MAJOR.MINOR.SECURITY). The MAJOR number indicates the Java language specification baseline. The MINOR number indicates the feature release train, such as 25.1, 25.2, and so on. The SECURITY number indicates the CPU level of the underlying JDK update."*

So **GraalVM 25.3.4.1** means: Java 25 language baseline, third feature train, fourth CPU level of the underlying JDK update. The cadence changed too:

> *"Starting with the 25.1 release line, GraalVM Community Edition and Oracle GraalVM provide innovation (feature) releases on a monthly cadence with quarterly CPUs incorporated when available."*

> *"The most recent feature release supersedes all previous feature releases."*

⚠️ **A monthly feature train with "the most recent supersedes all previous" is a fast-moving base for a production toolchain.** Plan a monthly bump or an explicit decision to sit on a CPU line, and expect neither to be free.

⚠️ **What the calendar table shows about CE and the quarterly CPU line, stated carefully.** In the "Previous Releases" table, the CPU rows of 2026-04-21 and 2026-07-21 list Oracle GraalVM values (`17.0.19, 21.0.11, 25.0.3` and `17.0.20, 21.0.12, 25.0.4`) with a dash in the GraalVM Community Edition column, whereas the CPU rows of 2025-10-21 and 2026-01-20 list `25.0.1` and `25.0.2` for CE. **The table is what I can verify; I could not find a sentence stating the policy behind it.** Read it as: if you are on CE, plan on the monthly feature train (25.1 → 25.2 → 25.3) as your update path and verify against the calendar before assuming a CPU-only CE build exists for your line.

## Which one to build with

- **Build and test on the distribution you will ship.** A CE build and an Oracle GraalVM build of the same application are not performance-equivalent artefacts, because `-O2`/`-O3`, PGO and the collector all differ. A throughput benchmark that does not name the distribution is not a result.
- **CE is the right default for learning, for CI correctness checks, and for anything where the closed-world *behaviour* is what you are testing.** Correctness is identical; the metadata, the agent, the build failures and the run-time errors are all the same.
- **Oracle GraalVM is what you need if throughput matters** — G1, `--pgo`, `-O3`/GraalNN and `--emit build-report` are all on that side of the line, and **07c · Getting throughput back** *(not written yet)* is the argument for why that is not a small difference.
- **Liberica Native Image Kit** is what Spring Boot's own how-to installs (`sdk install java 25.r25-nik`). It is a third-party distribution with its own licence and its own support terms; do not assume it inherits either of the two positions above. **I did not verify Liberica NIK's licence for this page** — check it yourself before adopting it, and treat Boot's documentation as an installation convenience rather than a licensing endorsement.

## Gotchas

**★ Symptom: a native build is measurably slower under load than the JVM it replaced, and PGO "doesn't work".** Cause: you are on GraalVM Community Edition, where PGO, GraalNN and `-O3` are documented as unavailable and `-O3` is *"identical"* to `-O2`. Fix: repeat the measurement on Oracle GraalVM before drawing any conclusion about native image as a technology. If CE is a hard requirement, then the throughput ceiling you measured **is** your ceiling, and **09 · When it pays** *(not written yet)* is the conversation to have.

**★ Symptom: `--gc=G1` fails or is ignored.** Cause: the reference states G1 in Native Image is *"Currently … used with Native Image on the Linux AMD64 and AArch64 architectures. (Not available in GraalVM Community Edition.)"* — so it fails on CE anywhere, and on macOS and Windows regardless of distribution. Fix: on CE, or on a non-Linux target, Serial GC is the collector and you tune it as [07](07-runtime-characteristics.md) describes; do not carry G1 flags across from your JVM deployment.

**★ Symptom: legal asks "which licence is this binary under" three days before release.** Cause: nobody recorded the distribution, and the toolchain is pulled by a base-image tag. Fix: pin the distribution and version explicitly in the build (a named base image digest, or an SDKMAN identifier in the Dockerfile), print it in CI, and record it in the release notes. The GFTC's redistribution clause — *"permitted as long as it is not for a fee"* — is answerable in five minutes if you know what you built with, and a scramble if you do not.

**★ Symptom: a document says "GraalVM for JDK 25" and a build file says "GraalVM 25.3.4.1", and someone thinks they are different products.** Cause: the naming change of September 2025. Fix: they are the same product line. `MAJOR` is the Java baseline, `MINOR` is the feature train, `SECURITY` is the CPU level of the underlying JDK update. `25.3.4.1` is a Java 25 GraalVM.

**★ Symptom: an upgrade to the newest GraalVM changes measured throughput and nobody can explain it.** Cause: with monthly feature releases and *"the most recent feature release supersedes all previous feature releases"*, you may have moved compiler versions, not just patch levels. Fix: treat a GraalVM minor bump as a compiler upgrade — re-run whatever benchmark you actually trust, and regenerate PGO profiles, which are tied to the build they were collected with.

**★ Symptom: CE is chosen for licence comfort and then the same team asks for a build report to explain image size.** Cause: `--emit build-report` is documented as *"not available in GraalVM Community Edition"*. Fix: on CE, use `-H:+GenerateEmbeddedResourcesFile` for the resource inventory and the ordinary build output's reachability counts for size analysis; both are available. The interactive report is not.

## Interview questions

**★ Is GraalVM free? Answer precisely.**
Two products, two answers. GraalVM Community Edition is *"distributed under version 2 of the GNU General Public License with the “Classpath” Exception"* — conventional open source, and the Classpath Exception is what prevents the GPL reaching your application code. Oracle GraalVM is under the GraalVM Free Terms and Conditions, which the FAQ describes as *"intended to permit use by any user including commercial and production use"*, with hosted/SaaS use explicitly fine and *"Redistribution … permitted as long as it is not for a fee."* So: free to run, including commercially; free to redistribute only if you are not charging for the redistribution. And the licence attaches to the release, not the product name — the JDK 17 CPU line moved to the OTN licence at 17.0.13.

**★ Which native-image capabilities differ between the two distributions, and why does it matter for a throughput decision?**
G1 (Linux only, Oracle only), profile-guided optimisation via `--pgo`, ML profile inference via GraalNN at `-O3`, and `--emit build-report`. It matters because those are precisely the mechanisms that close the gap between an AOT compiler's static guesses and a JIT's measured profile. On CE, `-O3` is documented as identical to `-O2` and there is no PGO, so the compiler is working from heuristics and the Graal Static Profiler alone. A "native image is slower" result from CE is a result about CE.

**★ What does GraalVM 25.3.4.1 mean, digit by digit?**
Per the release calendar, GraalVM follows JEP 223's `MAJOR.MINOR.SECURITY`. MAJOR 25 is the Java language specification baseline — a Java 25 GraalVM. MINOR 3 is the third feature release train of that baseline. SECURITY 4 is the CPU level of the underlying JDK update. The trailing `.1` is a further build of that release. Since September 2025 the label dropped the "for JDK" form, so "GraalVM for JDK 25" and "GraalVM 25.x" refer to the same line.

**★ Your platform standardises on quarterly patching. How does GraalVM's release model fit?**
Awkwardly, and you should say so. Since 25.1, both editions ship *"innovation (feature) releases on a monthly cadence with quarterly CPUs incorporated when available"*, and *"the most recent feature release supersedes all previous feature releases."* Oracle GraalVM continues to publish quarterly CPU builds on the 25.0.x line; the calendar's Community Edition column shows dashes on the CPU-only rows from April 2026 onward, which is why a CE consumer's realistic update path is the monthly feature train. Either you accept monthly compiler bumps with a benchmark gate, or you buy into the CPU line, which means Oracle GraalVM and the GFTC.

**★ Does the licence of the build tool affect the licence of the binary it produces?**
For the GFTC, the FAQ addresses this directly: the licence *"is intended to permit use of the Program, **including runtime image output produced by the jlink tool or GraalVM Native Image feature**, by any user, including in commercial and production use."* So the output is covered by the same permission — including the redistribution-not-for-a-fee limit. That last clause is the one that bites a vendor shipping a downloadable paid product, and it is the reason the distribution choice is a legal decision as well as a performance one.

{/* FOOTER */}
