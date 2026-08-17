---
title: "The release model: 6-month majors, LTS every 2 years"
sidebar_label: "03 · The release model"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the
> [Oracle Java SE support roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html),
> [openjdk.org/projects/jdk/26](https://openjdk.org/projects/jdk/26/) and
> [/27](https://openjdk.org/projects/jdk/27/),
> [endoflife.date/oracle-jdk](https://endoflife.date/oracle-jdk), and the JEP
> index at [openjdk.org/jeps](https://openjdk.org/jeps/0).

**Java ships a major release every six months, on schedule, whether features
are ready or not — features that miss the train catch the next one. Every two
years one of those releases is designated LTS (long-term support): 17 → 21 →
25 → 29. Almost every production team builds on the LTS line and treats the
releases between as a preview of what the next LTS will contain. Knowing this
model is knowing how to answer "which Java are you on?" — a question that
spans 8 to 26 in real production fleets.**

## The facts, as of this writing

| | |
|---|---|
| Current LTS | **Java 25** — GA September 2025; the build target of this syllabus |
| Latest release | **JDK 26** — GA 17 March 2026, non-LTS; its support ends when 27 ships |
| Next release | **JDK 27** — GA 15 September 2026, non-LTS |
| LTS cadence | Every 2 years: 17 (2021) → 21 (2023) → 25 (2025) → 29 (2027) |
| Older LTS lines | 8 (2014), 11 (2018), 17, 21 — all still in production somewhere, with vendor support windows of varying length |

Two clarifications the table hides:

- **"LTS" is a vendor promise, not an OpenJDK one.** The OpenJDK project
  maintains each release for six months, period. What makes 25 "long-term" is
  that vendors (Temurin, Corretto, Oracle, …) commit to backporting security
  patches to it for years. LTS is a support-contract concept.
- **Non-LTS releases are fully production-quality.** 26 is not a beta; it
  passed the same TCK. What it lacks is a *future*: when 27 ships, 26's
  patches stop. Running non-LTS means committing to upgrade every six months
  — some teams (notably large tech shops) do exactly that.

## How the cadence changed Java

Before 2017, majors shipped when ready: Java 8 (2014) to Java 9 (2017) was a
three-year gap, and features slipped for years. The six-month train (since 10)
inverted the dynamics:

- **Features arrive incrementally as previews.** A feature ships as a
  *preview* (`--enable-preview` required, can change or vanish), iterates a
  release or two, then finalizes. Records previewed in 14/15 and finalized in
  **16**; pattern matching for `switch` previewed across 17–20 and finalized
  in **21**.
- **A feature can be withdrawn.** String templates previewed in 21/22 and
  were *removed* in 23 for redesign — code that bet on a preview lost that
  bet. Previews are for evaluation, never for production.
- **The language evolves fast now.** The features that define modern Java:
  `var` (10), switch expressions (14), text blocks (15), records (16), sealed
  types (17), virtual threads (**21**), ScopedValue (**25**), compact source
  files + instance `main` (**25**). An interviewer's "which version added
  records?" is really asking whether you've watched the train at all.

## Why "we're on Java 8" is still a real sentence

A decade-old release survives in production for reasons worth understanding,
because you may inherit them:

1. **The 8 → 9 chasm.** Java 9's module system removed internal APIs
   (`sun.misc.*` access patterns), split the JDK, and broke a generation of
   libraries and app servers. The single hardest jump in Java history sits
   right after 8 — so risk-averse codebases parked before it.
2. **The 2019 licensing scare** (topic 02) froze upgrade budgets at exactly
   the wrong moment.
3. **If it runs, it runs.** The JVM's backward compatibility is excellent, so
   an unpatched-but-working 8 service generates no urgency until an audit,
   a CVE, or a dependency forces the issue.

The forcing function arrived anyway: **the ecosystem moved its baseline.**
Spring Boot 3 requires Java 17; successive majors of Hibernate, Kafka clients
and most active libraries now baseline 17 or 21. A Java 8 codebase is
increasingly pinned to EOL dependency versions — which is a security problem
wearing a compatibility costume.

The practical migration path, if you inherit the situation: 8 → 11 is the
hard hop (modules fallout, removed `javax.*` EE modules like JAXB that must
become explicit dependencies); 11 → 17 → 21 → 25 are progressively routine.

## The strategy this syllabus assumes

- **Build new services on the current LTS** — 25 — with `--release 25` in the
  build (topic 01 chunk 1 for why `--release`).
- **Read the 26/27 release notes anyway.** Six months of features preview
  what 29 will make standard; structured concurrency's progress toward final
  is the current headline worth tracking.
- **Never ship `--enable-preview` to production.** Preview bytecode is
  version-locked (it refuses to run on the next release's JVM) — the flag is
  a lab key, not a feature toggle.
- **Upgrade LTS-to-LTS deliberately**: read the release notes of every major
  in between — behaviour changes (like JEP 400's charset default in 18) land
  in the majors you're skipping *through*.

## Gotchas

**Symptom:** "26 isn't LTS so it must be unstable — let's wait"
**Cause:** conflating support length with quality; non-LTS releases pass the same certification
**Fix:** 26 is production-grade; what it lacks is patches after 27 ships. The real question is whether you'll upgrade every six months. If not, stay on 25

**Symptom:** code built with `--enable-preview` on 25 refuses to run on a 26 JVM
**Cause:** preview class files are pinned to the exact release that compiled them — by design, so previews can change incompatibly
**Fix:** previews never ship to production. Rebuild without the flag using finalized features, or stay on the pinned JDK in the lab only

**Symptom:** a feature the team used in preview vanished after a JDK upgrade
**Cause:** previews can be withdrawn — string templates (previewed 21/22) were removed in 23 for redesign
**Fix:** the cost of betting on previews, paid as planned rework. Track the JEP's status, not the blog posts about it

**Symptom:** upgrading 8 → 11 breaks with `ClassNotFoundException` for `javax.xml.bind` classes
**Cause:** Java 11 removed the bundled EE modules (JAXB, JAX-WS, activation) from the JDK
**Fix:** add them as ordinary Maven dependencies (`jakarta.xml.bind` + an implementation) — the standard first casualty of the 8 → 11 hop

**Symptom:** an LTS-to-LTS upgrade (17 → 25) changes runtime behaviour nobody's code touched
**Cause:** behaviour changes land in the intermediate majors you skipped through — default charset to UTF-8 (18), stricter encapsulation, deprecated-flag removals
**Fix:** read the release notes for every major between the two LTS versions; run the test suite on the new JDK before committing the fleet

**Symptom:** dependency upgrades are blocked and the changelogs say "requires Java 17"
**Cause:** the ecosystem baseline moved — Spring Boot 3, modern Hibernate and friends require 17+
**Fix:** this is the actual cost of staying on 8/11: you're pinned to EOL library versions with their unpatched CVEs. Budget the platform upgrade as security work, because it is

**Symptom:** "which Java should this new service use?" answered with last year's LTS
**Cause:** stale habit — teams remember "17" or "21" as *the* LTS long after the next one shipped
**Fix:** check the roadmap: 25 has been the LTS since September 2025. New work starts on the current LTS unless a named dependency blocks it

## Interview questions

**★ Explain Java's release cadence and what LTS actually means.**
A major every six months; features ride the next train when ready rather than
delaying the release. Every two years (17 → 21 → 25 → 29) a release is
designated LTS — meaning *vendors* commit to multi-year security backports.
OpenJDK itself supports every release for only six months; LTS is a support
promise, not a quality tier.

**★ Is it safe to run a non-LTS release like 26 in production?**
Quality-wise, yes — same TCK, same rigor. Operationally it commits you to
upgrading within six months, because its patch stream ends when 27 ships.
Teams with strong CI and fast upgrade muscle do it to get features two years
early; everyone else rides the LTS line.

**★ Why are so many codebases still on Java 8, and what finally forces them off?**
The 9 chasm (module system, removed internals) made the next hop expensive;
the 2019 licensing scare froze budgets; and working systems create no
urgency. The forcing function is the ecosystem: modern library majors
baseline 17+, so staying on 8 means running EOL dependencies — a security
cost that eventually outweighs the migration cost.

**★ What is a preview feature and what are its rules?**
A complete-but-not-final feature shipped for feedback: requires
`--enable-preview` to compile and run, may change incompatibly or be
withdrawn (string templates were), and its class files run only on the exact
JDK release that produced them. Evaluate in labs; never ship it.

**Which release finalized records, sealed types, virtual threads, ScopedValue?**
Records **16**, sealed types **17**, virtual threads **21**, ScopedValue
**25** (with compact source files and instance `main` also finalizing in 25).
Knowing the map matters when you inherit an older JDK and need to know what
exists there.

**What would you check before an LTS-to-LTS upgrade?**
The release notes of every intermediate major (behaviour changes like the
UTF-8 default in 18 land there), dependency compatibility with the new
baseline, removed/deprecated JVM flags in the startup scripts, and a full
test run on the new JDK — before any production traffic sees it.

**Your team is on 21. What's the argument for and against moving to 25 now?**
For: it's the current LTS with the freshest feature set (ScopedValue, compact
sources) and the longest patch runway; 21 → 25 is a routine hop. Against:
nothing structural — only scheduling. The anti-pattern is skipping *two* LTS
lines later under CVE pressure instead of one now under calm.

---

← Prev: [JDK vs JRE vs JVM](02-jdk-jre-jvm.md) · Index: [Phase 0 — The platform and the JVM](README.md)
