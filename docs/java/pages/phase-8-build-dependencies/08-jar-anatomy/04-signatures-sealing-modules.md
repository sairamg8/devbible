---
title: "Signatures, sealing and modules"
sidebar_label: "04 · Signatures, sealing, modules"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the JAR File Specification for JDK 25
> (signed JAR files, the `.SF` signature file and signature block,
> package sealing), the JDK 25 `jarsigner` reference, JEP 261
> (`Automatic-Module-Name`, split packages), and the Apache Maven Shade
> Plugin 3.6.x filter documentation.

**The last three collisions are not about your code at all — they are
about the archive's own metadata. A signature describes entries that a
merge has changed; a sealed package asserts something a merge has just
violated; a `module-info.class` describes a module that the merged jar is
not. All three fail loudly, which makes them the easiest of the fat-jar
problems, and all three are fixed by deleting a guarantee rather than by
restoring one.**

## Signed jars

A signed jar carries `META-INF/*.SF` (per-entry digests) and
`META-INF/*.DSA` / `*.RSA` / `*.EC` (the signature block). Those digests
are computed over that jar's entries and over the manifest's main
attributes. Merge the jar into another one and every digest is wrong, so
the JVM refuses to load from it:

`java.lang.SecurityException: Invalid signature file digest for Manifest
main attributes`

The mechanical fix is the shade `<excludes>` block — drop `*.SF`, `*.DSA`,
`*.RSA`, `*.EC`. Be honest about what that does: **you have stripped a
security property, not repaired one.** For some artifacts it is not
allowed at all. A signed JCE or FIPS cryptography provider is *validated
by its signature*; strip it and the provider will not load, by design.
Those jars have to stay whole on the classpath — which is one more
argument for nesting rather than flattening.

Two details worth knowing before you reach for the exclusion:

- **A jar can be partially signed.** Signing is per entry, so an archive
  may contain both signed and unsigned entries; `Package.isSealed()` and
  the code-source certificates a class carries come from the entry it was
  loaded from, not from the archive as a whole.
- **Re-signing the merged jar is a real option** for an artifact you own
  and distribute — `jarsigner` over the finished fat jar produces a
  coherently signed archive. It attests to *your* build, not to the
  upstream publishers, which is honest but is not the same guarantee.

## Package sealing

`Sealed: true` in a manifest's `Name:` section means every class in that
package must come from that jar. After a merge, classes from another jar
in the same package produce:

`java.lang.SecurityException: sealing violation: package com.acme.x is
sealed`

Sealing exists to stop a hostile or careless jar from injecting a class
into a package and gaining package-private access to it — the same threat
model that JPMS addresses more completely. Splitting a sealed package
across jars is the same mistake as a split package on the module path, and
it fails for the same reason. The difference is that the module path
rejects a split package at *resolution* time, loudly and early, while
sealing fails at *class load* time, in production, on whichever request
first touched the second half of the package.

The fix is never "turn sealing off" unless you own both halves. Relocate
one side, or reconsider why two artifacts are writing into one package at
all.

## `module-info.class`

Every modular dependency ships one, at the archive root, at the same path
— so a flat merge keeps one arbitrary module descriptor that describes the
wrong module entirely. Shade configurations routinely exclude it, which is
the right call and also an admission: **a fat jar is a classpath artifact,
not a module.** Its contents land in the unnamed module, split packages
and all.

The related casualty is `Automatic-Module-Name`. It lives in the manifest,
and the merged manifest is rebuilt from scratch, so unless you set it with
`ManifestResourceTransformer` it is gone. Without it, a consumer putting
your jar on the module path gets an automatic module named after the
*filename* — which changes with the version, so their `requires` clause
breaks on every upgrade. See
[the module system](../../phase-0-platform-jvm/11-module-system.md) for
why that name is a compatibility commitment.

## `Multi-Release` and the merged manifest

The fourth piece of archive metadata a merge destroys is the one from
[chunk 1](01-the-format.md): `Multi-Release: true`. It behaves differently
from the other three, and the difference is what makes it dangerous.

A signature mismatch throws. A sealing violation throws. A wrong
`module-info.class` fails resolution. **A lost `Multi-Release` attribute
does nothing at all** — `META-INF/versions/21/...` is just an inert
directory of entries the JVM never consults, so the base implementation
runs and the build, the tests and the smoke check all pass.

Two ways it goes wrong, and they need different fixes:

- **The attribute is dropped.** The shade plugin rebuilds the manifest, so
  unless a `ManifestResourceTransformer` carries `Multi-Release: true`
  across, the merged jar is a plain jar that happens to contain a
  `versions/` directory. Every multi-release dependency silently reverts to
  its oldest code path.
- **The attribute is kept but the merge is incoherent.** `Multi-Release`
  is a property of the *whole archive*, while the versioned entries came
  from several dependencies with different base versions and different
  ranges of `N`. One jar's JDK-11 override now sits in an archive that also
  claims JDK-21 overrides from another, and the runtime applies the rule
  per class path, not per originating jar. Nothing validates that the
  public API of each versioned class still matches its base.

There is no transformer that reconciles the second case, which is the
honest reason to stop: **a multi-release dependency is a dependency that
does not want to be flattened.** Keep it whole.

## Reading a suspect artifact

No output is reproduced here — these are the commands, run them against
your own jar:

```bash
jar tf app.jar | grep -c '\.class$'                 # how many classes ended up in there
unzip -l app.jar 'META-INF/services/*'              # which provider files survived
unzip -p app.jar META-INF/services/java.sql.Driver  # and what is in one of them
unzip -p app.jar META-INF/MANIFEST.MF               # Multi-Release? Main-Class? Start-Class?
unzip -l app.jar 'META-INF/*.SF'                    # signature files that should not be there
```

If a provider file lists one implementation where you expect three, you
have found the bug without attaching a debugger.

## The honest position

Everything on this page is fixed by deleting an assertion the archive was
making: strip the signature, drop the sealing attribute, exclude the
module descriptor. That works, and it should feel uncomfortable, because
none of those guarantees were pointless — they were somebody's answer to
tampering, to package injection, and to split packages respectively.

The trade is defensible for an internal CLI tool where the deployment
channel is trusted anyway. It is much weaker for a published library, and
it is close to indefensible for anything that handles credentials or
cryptography. When the artifact carries security-relevant dependencies,
the right answer is not a better shade configuration — it is not
flattening: keep the dependency jars intact, whether by Boot's nested
format, a `lib/` directory and a manifest `Class-Path`, or a container
image that holds a real classpath.


## Gotchas

**Symptom:** `SecurityException: Invalid signature file digest for Manifest main attributes` at startup
**Cause:** a signed dependency was merged into the fat jar, so its `META-INF/*.SF` digests no longer match the merged entries
**Fix:** exclude `META-INF/*.SF`, `*.DSA`, `*.RSA`, `*.EC` in a shade filter — and if the artifact is a JCE/FIPS provider validated by its signature, stop shading it and keep it whole on the classpath

**Symptom:** a cryptography provider that works on the classpath is silently absent inside the fat jar, or `NoSuchAlgorithmException` appears for an algorithm you know is installed
**Cause:** the provider's signature was stripped, and a JCE provider that cannot present a valid signature simply does not register
**Fix:** never merge a signed security provider; keep it as a separate jar and load it from the classpath or, for a Boot-format artifact, from `BOOT-INF/lib/`

**Symptom:** `SecurityException: sealing violation: package com.acme.x is sealed`
**Cause:** a dependency sealed that package in its own manifest, and the merge put classes from another jar into the same package
**Fix:** stop splitting the package — relocate one side, or drop the sealing attribute only if you own both halves and understand what it was asserting

**Symptom:** the fat jar refuses to load on the module path, or `jar --describe-module` reports a module name that belongs to a dependency
**Cause:** every modular dependency ships `module-info.class` at the archive root, so the merge kept one arbitrary descriptor
**Fix:** exclude `module-info.class` in a filter and accept that the artifact is a classpath jar; if you need a module, do not flatten — publish a modular jar and let consumers resolve dependencies normally

**Symptom:** consumers of your shaded library get a module named after the jar filename, and it changes when the version changes
**Cause:** the merged manifest lost `Automatic-Module-Name`, so JPMS derives the automatic module name from the filename
**Fix:** set `Automatic-Module-Name` explicitly with `ManifestResourceTransformer`; it is one line and it is the difference between a stable module name and one that breaks consumers on every release

**Symptom:** the shaded artifact ships someone else's `NOTICE` file, or none at all
**Cause:** `META-INF/NOTICE` and `META-INF/LICENSE` are per-library files at shared paths; the merge kept whichever was last
**Fix:** add `ApacheLicenseResourceTransformer` and `ApacheNoticeResourceTransformer`; attribution is a legal obligation that survives repackaging

## Interview questions

**★ Why must signature files be excluded when shading, and what have you given up?**
`META-INF/*.SF` holds digests of the original jar's entries and of the
manifest's main attributes; merging invalidates all of them, so the JVM
throws `SecurityException: Invalid signature file digest`. Excluding
`*.SF`/`*.DSA`/`*.RSA`/`*.EC` makes it start. What you gave up is the
integrity guarantee the publisher shipped — and for artifacts that are
*validated* by their signature, such as JCE/FIPS providers, stripping it
means they refuse to load at all, so those must never be merged.


**★ Given the collision list, why is Spring Boot's nested format not just "a worse uber jar"?**
Because every failure on this page is a consequence of merging into one
namespace, and Boot does not merge. Duplicate classes stay in their own
jars, where normal class loader search order applies. Service files are
never overwritten because they never share a path. Signatures stay valid.
`module-info.class` and `Multi-Release` attributes stay with their jars.
The cost — a non-standard archive and a custom class loader — buys the
absence of an entire failure class, which is a good trade for an
application even though it is unavailable to a library.

**★ What happens to `module-info.class` and `Automatic-Module-Name` when you shade, and why does it matter?**
Every modular dependency has `module-info.class` at the archive root — one
path, many candidates — so the merge keeps an arbitrary one that describes
the wrong module. The usual answer is to exclude it, which makes the
artifact a plain classpath jar with no module descriptor. Separately, the
merged manifest is rebuilt, so `Automatic-Module-Name` is lost unless you
set it explicitly; without it JPMS derives an automatic module name from
the *filename*, which changes with the version and breaks every consumer's
`requires` clause. Setting `Automatic-Module-Name` on any published
artifact is cheap insurance.

**★ A dependency you must ship is signed. Strip, re-sign, or do not shade — how do you decide?**
Three questions in order. *Is the signature load-bearing?* A JCE or FIPS
provider is validated by its signature at registration, so stripping is not
an option — that jar cannot be merged at all, and the artifact has to keep
a real classpath. *Do you control distribution?* If the fat jar is your own
published artifact, `jarsigner` over the finished archive gives a coherent
signature again — but it attests to your build, not to the upstream
publishers, so say so rather than implying the original guarantee survived.
*Is the deployment channel already trusted?* An internal CLI pulled from
your own artifact store is the one case where stripping is a reasonable
trade. Anything else, do not flatten.

**★ Is excluding `META-INF/*.SF` a fix or a smell?**
Mechanically it is a fix — the jar starts. Architecturally it is a smell,
because the exclusion is not repairing the mismatch, it is deleting the
evidence of it. The useful test is what the exclusion is protecting you
from: if it is one incidentally-signed transitive dependency you do not
care about, fine; if it is a security provider, a licensing-enforcement
jar, or anything whose publisher signed it *because verification matters*,
the exclusion is silently changing the security posture of the deployment
and belongs in a review, not in a `<filter>` block someone copied.

**★ What does package sealing actually enforce, and when do you find out it was violated?**
`Sealed: true` in a manifest `Name:` section asserts that every class in
that package comes from that one jar. It exists to stop another artifact
injecting a class into the package and thereby gaining package-private
access to its internals. The enforcement point is **class loading**, not
packaging and not resolution: the JVM checks the seal when it loads a class
for a package that a previously-loaded class sealed, and throws
`SecurityException: sealing violation`. That timing is the problem — it
surfaces in production, on whichever request first touches the second half
of the split package, rather than at build time.

**★ Why do automatic modules exist, and what does flattening do to them?**
They are the migration bridge: a plain, non-modular jar placed on the
module path becomes an automatic module that reads every other module and
exports all its packages, so a modular application can depend on
not-yet-modularised libraries. Its name comes from
`Automatic-Module-Name` in the manifest if present, and otherwise is
derived from the *filename* — which is why the attribute matters. A fat jar
breaks both halves: `module-info.class` from every modular dependency
collides at the archive root so the real descriptors are excluded, and the
rebuilt manifest loses `Automatic-Module-Name` unless you set it. The
result is a single automatic module named after your jar file, containing
the packages of fifty libraries — with split packages that will fail the
moment anyone else puts one of those libraries on the module path too.

**★ Why is a lost `Multi-Release: true` more dangerous than a lost signature?**
Because it does not fail. A stripped or invalidated signature throws at
startup and a sealing violation throws at class load, so both are found
immediately. A missing `Multi-Release` attribute turns
`META-INF/versions/N/` into inert dead weight: the JVM never looks there,
the base implementation runs, and every test passes. The dependency has
quietly reverted to whatever code path it kept for its oldest supported
JDK — often reflection-based rather than using the newer API — and the only
symptom is that the packaged artifact behaves subtly differently from the
classpath it was built from.

---

← Prev: [When two libraries collide](03-the-collision.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Annotation processing](../09-annotation-processing/README.md)
