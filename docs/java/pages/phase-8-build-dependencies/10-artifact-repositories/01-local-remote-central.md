---
title: "The local cache, remote repositories and Maven Central"
sidebar_label: "01 · Local, remote, Central"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Maven settings and POM references
> (maven.apache.org), and the Maven Central documentation at
> central.sonatype.org — Requirements, "Can I change, modify, delete… a
> component on Central?", the OSSRH Sunset announcement (EOL 30 June 2025),
> Register a Namespace, and Publishing Portal Snapshots.

**Resolution has exactly two layers: a local directory that is a cache with
no integrity story, and an ordered list of remote repositories where the
first one holding the artifact wins. Knowing which layer answered a given
request explains nearly every "Maven is being weird" report.**

## The local repository is a cache, and `rm -rf ~/.m2` is a superstition

Every artifact Maven resolves lands under `~/.m2/repository` in a path built
from the coordinates: `com.fasterxml.jackson.core:jackson-databind:2.17.0`
becomes `~/.m2/repository/com/fasterxml/jackson/core/jackson-databind/2.17.0/`.
Alongside the jar you get its `.pom`, checksum files, and two pieces of
bookkeeping that explain most of the folklore:

| File | What it means |
|---|---|
| `_remote.repositories` | which repository id served each file — Maven re-resolves if you later ask from a different repository |
| `*.lastUpdated` | a **failed** lookup was recorded here; Maven will not retry until the update policy expires |

That second file is the whole story. A build that failed while your VPN was
down writes `jackson-databind-2.17.0.jar.lastUpdated`, and the next build
still fails with *"was cached in the local repository, resolution will not be
reattempted until the update interval has elapsed"* long after the network is
fine. Deleting `~/.m2` "fixes" it — and so does deleting that one marker
file, or running `mvn -U` (force an update check), or
`mvn dependency:purge-local-repository` scoped to the artifact. Blowing away
the whole cache re-downloads gigabytes to repair a zero-byte file, and on a
shared CI agent it destroys every other job's cache too.

There is no signature verification on the way in. Maven checks the published
SHA-1/MD5 checksums, which prove the download was not truncated — not that
the bytes are the ones the author signed. Anything stronger (PGP verification
via `pgpverify-maven-plugin`, or a repository manager that enforces it) is
something you add.

**When deleting the cache genuinely is the fix:** a corrupt or truncated
download, or a snapshot whose local copy diverged after a repository was
rebuilt. Even then, delete the *group directory*, not the root. Gradle keeps
the equivalent cache in `~/.gradle/caches/modules-2` with the same
properties and the same folklore.

## Remote repositories, and why plugins have their own list

The POM declares two independent lists:

```xml
<repositories>
  <repository>
    <id>internal</id>
    <url>https://nexus.example.com/repository/maven-public/</url>
    <releases><enabled>true</enabled></releases>
    <snapshots><enabled>false</enabled></snapshots>
  </repository>
</repositories>

<pluginRepositories>
  <pluginRepository>
    <id>internal</id>
    <url>https://nexus.example.com/repository/maven-public/</url>
  </pluginRepository>
</pluginRepositories>
```

`<repositories>` is searched for **dependencies**; `<pluginRepositories>` for
**build plugins**. They are separate because a plugin is code that runs
*inside* your build, with your credentials and your source tree — a far more
privileged position than a jar on a classpath — so Maven makes you grant that
capability explicitly. The practical consequence: adding a repository for a
dependency and then finding a plugin still unresolvable is not a bug, it is
the second list you did not fill in.

Both default to Central (`https://repo.maven.apache.org/maven2`), which is why
an empty POM resolves anything at all. Repositories are consulted in order and
the **first one that has the artifact wins** — Maven does not compare versions
across repositories the way npm does. Hold on to that; it is what makes the
dependency-confusion story in
[the next chunk](02-proxies-settings-confusion.md) different in Java.

Per-repository `<releases>`/`<snapshots>` blocks let you say "releases only
from here", and each carries an `<updatePolicy>` (`daily` by default, plus
`always`, `never`, `interval:N`) and a `<checksumPolicy>`.

## Maven Central: the default, and permanent

Central is the default remote repository for effectively every Maven and
Gradle build, which gives it two properties worth internalising.

**Publishing is gated on namespace ownership.** You publish through the
**Sonatype Central Portal** (`central.sonatype.com`). OSSRH — the old
`oss.sonatype.org` "Nexus staging" flow that every tutorial written before
2025 describes — **reached end of life on 30 June 2025**; its endpoints are
gone, and instructions naming `oss.sonatype.org` staging URLs are dead. You
register a **namespace** (your `groupId`) and prove you own it: a DNS TXT
record for `com.example`, or, if you sign in with GitHub,
`io.github.<username>` is verified automatically. Once verified, nobody else
can publish under it.

**A release is immutable.** Central will not change or replace a published
version — not the jar, not the POM, not five minutes after you spotted the
typo. The documented answer to a bad release is to publish a **new version**.
That is not bureaucracy: hundreds of thousands of builds pin exact versions
and cache them locally, so a mutable coordinate would mean two machines
building "the same" artifact from different bytes. It is also why you see
version numbers in the wild jump `1.4.0 → 1.4.1` an hour apart.

Meeting the publish requirements is mechanical, and all of it is validated at
upload time:

- **POM metadata**: `groupId`, `artifactId`, `version`, plus `name`,
  `description`, `url`, `licenses`, `developers` and `scm`.
- **`-sources.jar` and `-javadoc.jar`** for any non-`pom` packaging.
- **PGP/GPG signatures** (`.asc`) on every artifact including the POM, with
  the public key published to a keyserver — normally `maven-gpg-plugin` bound
  to the `verify` phase.

The signing key is the part teams get wrong: it is a long-lived secret that
must exist on CI and must not exist in the repository, and losing it means
future releases are signed by a key consumers have never seen.

## Snapshots behave differently on purpose

`1.4.0-SNAPSHOT` is a **mutable** coordinate. On a remote repository each
deploy is stored under a *timestamped* filename
(`myapp-1.4.0-20260819.101500-7.jar`) with a `maven-metadata.xml` naming the
newest; clients resolve through that metadata according to the repository's
`<updatePolicy>`. So two developers building the same commit against
`-SNAPSHOT` dependencies can genuinely get different bytes — which is exactly
why a **release build must never depend on a snapshot**.

Central's release repository accepts releases only. The Portal does run a
separate snapshot host (`central.sonatype.com/repository/maven-snapshots/`)
where uploads are unvalidated and cleaned up after a retention window —
documented as 90 days at time of writing. Treat it as a channel for sharing
work in progress, not as an archive.

## The honest downside of caching everything locally

The local cache is per-user and unversioned, so it is also the largest
untracked input to your build. Two machines with different cache contents can
behave differently — most visibly with snapshots, but also when one has a
half-downloaded artifact the checksum policy waved through. That is the
argument for `-U` in CI, for a fresh cache in release pipelines, and for
resisting the urge to "fix" a colleague's build by copying jars into their
`~/.m2` by hand: an artifact placed there without its `_remote.repositories`
record is invisible to every reproducibility check you have.

## Gotchas

**Symptom:** a dependency that resolved yesterday now fails with "resolution will not be reattempted until the update interval has elapsed"
**Cause:** a transient failure wrote a `.lastUpdated` marker next to the artifact and the update policy has not expired
**Fix:** `mvn -U` to force the check, or delete just that `*.lastUpdated` file — deleting all of `~/.m2` works for the same reason and costs a full re-download

**Symptom:** the dependency resolves from the internal server but a plugin from the same server does not
**Cause:** the server was declared under `<repositories>` only; plugins resolve from `<pluginRepositories>`, a separate list
**Fix:** declare it in both lists — or configure a mirror in `settings.xml`, which covers every lookup at once

**Symptom:** a release build is reproducible on one machine and not another, from the same git tag
**Cause:** it depends on a `-SNAPSHOT`, whose timestamped remote build differs by resolution time and `<updatePolicy>`
**Fix:** ban snapshots from release builds — `maven-enforcer-plugin`'s `requireReleaseDeps` rule fails the build instead of shipping the ambiguity

**Symptom:** a bad artifact was published to Central and you need it gone
**Cause:** Central releases are immutable by design; there is no delete and no overwrite
**Fix:** publish a fixed **new version** immediately, and if the old one is dangerous add a relocation/deprecation notice — plan releases assuming you cannot take one back

**Symptom:** publishing scripts copied from a 2023 tutorial fail with 404 or unknown host against `oss.sonatype.org`
**Cause:** OSSRH reached end of life on 30 June 2025; those staging endpoints no longer exist
**Fix:** migrate to the Central Portal flow with a Portal token — your OSSRH namespaces were already migrated to the same account

**Symptom:** a jar copied by hand into `~/.m2/repository` works locally and fails everywhere else
**Cause:** the local repository is a cache, not a source of truth — nothing else in the world has that file
**Fix:** deploy it to an internal repository under real coordinates; if it is a third-party jar with no coordinates, `install:install-file` is the documented escape hatch and should be recorded in the build, not in someone's shell history

**Symptom:** a colleague deployed a fix to the internal snapshot an hour ago and your build still gets yesterday's
**Cause:** the repository's `<updatePolicy>` is `daily`, so Maven does not re-check the snapshot metadata until tomorrow
**Fix:** `mvn -U` for a one-off, or set `<updatePolicy>always</updatePolicy>` on the snapshot repository if the latency actually matters — and accept the extra round trip per build

**Symptom:** an artifact downloads but the build warns about a checksum mismatch and continues
**Cause:** the default checksum policy is `warn`, not `fail` — a corrupted or tampered transfer is a log line
**Fix:** set `<checksumPolicy>fail</checksumPolicy>` on repositories you care about (or `-C` on the command line) so a mismatch stops the build instead of poisoning the local cache

**Symptom:** high-volume CI starts getting throttled or refused by Central
**Cause:** every agent is resolving directly from Central and the aggregate request rate is being treated as abuse
**Fix:** put a caching proxy in front of it so Central sees one client, and cache `~/.m2` between CI runs — this is one of the practical arguments for a repository manager

## Interview questions

**★ What actually lives in `~/.m2/repository`, and why is "delete it" the wrong first move?**
It is a cache keyed by GAV coordinates holding the jar, POM, checksums, a
`_remote.repositories` file recording which repository served each file, and
`*.lastUpdated` markers recording *failed* lookups. Almost every "corrupted
cache" report is one of those markers suppressing a retry, which `mvn -U` or
deleting a single file resolves. Deleting the whole tree re-downloads
everything to fix a zero-byte file, and on shared CI it wipes other jobs'
caches. The cases where deletion is right — a truncated artifact, a diverged
snapshot — are fixed by deleting one group directory.

**★ Why are `<repositories>` and `<pluginRepositories>` separate lists?**
Because a plugin executes inside the build JVM with your credentials and your
source tree, while a dependency is (usually) only on a classpath. Maven makes
you grant the more dangerous capability explicitly rather than have it
inherited from a repository you added for a jar. The tell that someone has
not met this is a dependency resolving from an internal server while a plugin
from the same server does not.

**★ Central releases are immutable. What follows for how you release?**
You cannot delete, replace or re-tag a published version, so every release is
a permanent public statement. Practically: automate releases so nobody ships
a hand-built jar; validate metadata and signatures before upload rather than
after; treat a bad release as a fast follow-up version rather than a
rollback; and never let a `-SNAPSHOT` dependency into something you release,
because the released artifact would then reference a coordinate whose
contents can change underneath consumers.

**★ How do snapshot repositories differ mechanically from release repositories?**
Snapshot deploys are stored under timestamped filenames with a
`maven-metadata.xml` pointing at the newest, and clients re-check that
metadata according to `<updatePolicy>` — daily by default. So the same
coordinate resolves to different bytes over time, by design, because the
point is sharing work in progress. Release repositories store one immutable
file per coordinate, checked once and then cached forever.

**★ What does Maven actually verify about a downloaded artifact?**
The published checksums, which detect a truncated or corrupted transfer.
Not authorship: the `.asc` signatures Central requires at *publish* time are
not checked at *consume* time by default. If you want that guarantee you add
it — signature verification in the build, or a repository manager configured
to enforce it — and you should know which of those two properties you
actually have before claiming supply-chain assurance.

**★ What is `_remote.repositories` for, and when does it change what a build does?**
It records which repository id served each cached file. Maven consults it so
that a coordinate cached from one repository is not silently reused when the
build is now configured to resolve from a different one — the artifact is
re-resolved instead. It matters exactly when repository configuration changes
underneath an existing cache: switching a team from Central to an internal
mirror, or moving a coordinate from a public repo to a hosted one. Without
that record, "it works on my machine" would mean "my cache still holds the
copy from the repository we stopped using". It is also why hand-copying a jar
into `~/.m2/repository` produces a file that behaves differently from a
downloaded one.

**★ Central requires a POM with `licenses`, `developers` and `scm`, plus `-sources`, `-javadoc` and GPG signatures. What is each actually for?**
The POM metadata exists because Central is a permanent public archive that
other tools consume mechanically: `licenses` drives every corporate licence
scanner, `scm` and `developers` are how a consumer finds the source and a
human when something is wrong. The sources and javadoc jars exist because IDEs
and debuggers fetch them by convention — without them, every consumer of your
library debugs decompiled bytecode. The GPG signature binds the artifact to a
key on a public keyserver, so a consumer *can* verify authorship even though
nothing forces them to. Note the asymmetry that trips people up: signatures
are mandatory at publish time and not checked at consume time by default.

**★ What does namespace verification prove, and what attack does it prevent?**
It proves control of the identifier, not of the code: a DNS TXT record for
`com.example`, or a GitHub account for `io.github.<user>`. Once verified,
nobody else can publish artifacts under that groupId on Central. That is the
one mitigation for coordinate squatting that works before anything else in
your build does — mirrors and routing rules protect *your* builds, but a
verified namespace stops the attacker publishing your internal coordinates
publicly in the first place, which protects everyone else who might resolve
them too. It is free, and it is the reason to register your organisation's
namespace even if you never publish anything.

---

Index: [Artifact repositories](README.md) · Next → [Internal proxies, `settings.xml` and dependency confusion](02-proxies-settings-confusion.md)
