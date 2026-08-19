---
title: "Internal proxies, settings.xml and dependency confusion"
sidebar_label: "02 · Proxies, settings, confusion"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Maven settings reference
> (maven.apache.org/settings.html), the Maven guide to mirror settings and the
> password-encryption guide, Sonatype Nexus Repository documentation on
> routing rules, and JFrog Artifactory documentation on remote-repository
> include/exclude patterns.

**A repository manager is two products wearing one URL — a cache of the
outside world and a host for artifacts that must not leave the company — and
the aggregation that makes it convenient is also what creates the
dependency-confusion exposure. The mitigation is routing configuration, not
developer vigilance.**

## Internal proxies do exactly two jobs

Nexus Repository and JFrog Artifactory are usually described as "our Maven
repo", which hides that they are doing two unrelated things:

1. **Proxying and caching the outside world.** Central goes down, or
   rate-limits, or an upstream author yanks something — your builds keep
   working because the bytes are already on your side of the wire. It also
   gives you a single egress point, so build agents need no direct internet
   access at all, and one place to answer "does anything we ship contain
   log4j 2.14?".
2. **Hosting internal artifacts.** Your own `shared-domain` jar,
   `billing-api` client, the platform BOM — things that must never be public.

The two are then aggregated into a *group* repository so builds have one URL
to configure. That aggregation is the convenience, and it is also the attack
surface.

## `settings.xml`: mirrors, servers, profiles

`~/.m2/settings.xml` holds what must **not** travel with the project —
credentials, mirror routing, the local repository path, proxies. The POM holds
what must. Two files exist and are merged, with the user file
(`~/.m2/settings.xml`) taking precedence over the global one
(`$MAVEN_HOME/conf/settings.xml`).

```xml
<settings>
  <mirrors>
    <mirror>
      <id>internal</id>
      <url>https://nexus.example.com/repository/maven-public/</url>
      <mirrorOf>*</mirrorOf>
    </mirror>
  </mirrors>
  <servers>
    <server>
      <id>internal</id>            <!-- matches the mirror/repository id -->
      <username>${env.NEXUS_USER}</username>
      <password>${env.NEXUS_TOKEN}</password>
    </server>
  </servers>
</settings>
```

`<mirrorOf>` is a small pattern language:

| Pattern | Meaning |
|---|---|
| `central` | mirror just Central |
| `repo1,repo2` | mirror these ids |
| `*` | mirror every repository, wherever declared |
| `*,!inhouse` | mirror everything except `inhouse` |
| `external:*` | mirror everything that is not `localhost` or a `file://` URL |

`<server>`'s `id` matches a **repository or mirror id**, never a username. An
id typo is not an error — Maven simply sends no credentials, and you get a
401 that looks like a permissions problem.

**Credentials do not belong in the repository.** Maven does support encrypted
passwords (`mvn --encrypt-password`, a master key in
`~/.m2/settings-security.xml`), but that only moves the secret; the honest
modern answer is a short-lived token injected as an environment variable and
read with `${env.VAR}`, with CI materialising its own `settings.xml` from a
secret store at job start. A `settings.xml` in git is a credential leak with
extra steps, and it is the exact artifact that leaks internal coordinates
into public view.

`<profiles>` in `settings.xml` are truncated POM profiles — they may carry
only `activation`, `properties`, `repositories` and `pluginRepositories` —
activated by `<activeProfiles>`, `-P`, or an `<activation>` condition. They
are how you swap repository sets per environment. They are also how "works on
my machine" is born: a profile that activates on one developer's JDK or OS
means that developer's build resolves from somewhere nobody else does.
`mvn help:active-profiles` is the first thing to run when two machines
disagree.

## Dependency confusion — and Java's honest version of it

The attack: an adversary learns an internal coordinate (from a leaked POM, a
CI log, a stack trace, a public `settings.xml`) and publishes an artifact
with those coordinates to a public repository. A build that consults both the
internal repository and a public one can then resolve the attacker's jar —
which executes arbitrary code, because a dependency *is* code, and a build
plugin is code that runs immediately.

Be precise about the Java mechanics, because the widely-repeated npm version
of the story does not transfer cleanly. Maven resolves a **fixed version**
from the **first repository that has it** — it does not compare versions
across sources, so there is no "attacker publishes `999.0.0` and wins" step.
The exposure in a Maven or Gradle shop is narrower and still real:

- a POM (or a Gradle `repositories {}` block) that lists a public repository
  **before** the internal one;
- a repository-manager group whose member ordering puts the Central proxy
  ahead of the hosted internal repo;
- a coordinate that exists internally but not at the version requested, so
  the internal repo 404s and the next repository in the list answers;
- `-SNAPSHOT` metadata merged across repositories, where "newest timestamp"
  can come from the wrong side.

The mitigation is structural rather than a matter of being careful:

- **One URL, mirrored exclusively.** `<mirrorOf>*</mirrorOf>` pointing at the
  internal group means the client never contacts a public repository
  directly, so ordering is decided centrally instead of per POM. Gradle's
  equivalent is a settings-level `dependencyResolutionManagement` block with
  `repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)`, which stops
  individual builds adding their own.
- **Block your namespace on the public proxy.** Nexus **routing rules** and
  Artifactory **exclude patterns** make the Central proxy return a hard 404
  for `com/example/**`. Now an internal coordinate can *only* be served by
  the internal host — a backstop that holds even if someone adds a repository
  to a POM.
- **No direct egress from build agents**, so the mirror is not merely
  preferred, it is the only route out.
- **Own your namespace on Central**
  ([chunk 01](01-local-remote-central.md)) — a verified `com.example` means
  nobody else can publish those coordinates publicly at all.

Note the layering: the first three assume the attacker got the coordinates;
the last one removes the ability to squat them. Do all four and no single
misconfiguration is sufficient.

## When not to run a repository manager

For a small team with no private artifacts, a repository manager is a server
to patch, back up, monitor and be paged about — and when it is down,
*nothing* builds, including the project that would have built fine offline
from `~/.m2`. Central plus the local cache is genuinely fine. The trigger to
adopt one is the first private artifact shared between two repositories, or
the first compliance conversation about what your builds download. Adopting
it later is cheap; removing it once every POM assumes it is not.

The related trap is treating the proxy as a backup. A cache holds what it was
asked for, and a Central proxy that has never been asked for `foo:1.2.3` will
not have it when Central is unreachable. If offline reproducibility is the
requirement, that is a deliberate pre-seeding exercise, not a side effect of
having a proxy.

## Gotchas

**Symptom:** CI cannot authenticate to the internal repository; the same build works locally
**Cause:** the `<server>` id does not match the repository or mirror id being contacted — Maven silently sends no credentials rather than failing loudly
**Fix:** make `<server><id>` exactly equal the `<repository>`/`<mirror>` id; `mvn -X` prints which server entry was selected for each request

**Symptom:** an internal library name appears in a public repository, published by someone you do not recognise
**Cause:** your namespace is unclaimed and an internal coordinate leaked — the setup for dependency confusion
**Fix:** verify the namespace on Central so it cannot be squatted, add a routing rule or exclude pattern so the public proxy 404s that groupId, and mirror everything through the internal group

**Symptom:** two developers get different dependency versions from the same commit
**Cause:** a `settings.xml` profile activating on JDK/OS/property is adding a repository on one machine only
**Fix:** `mvn help:active-profiles` on both, then move the repository into the mirror so it is not a per-machine decision

**Symptom:** the security team asks for the list of external artifacts a service pulls in and nobody can produce it
**Cause:** build agents resolve straight from Central, so there is no chokepoint that ever saw the traffic
**Fix:** mirror everything through the repository manager and deny direct egress — the inventory is then a query, not an archaeology project

**Symptom:** the internal repository goes down and every build in the company fails, including ones that changed nothing
**Cause:** `<mirrorOf>*</mirrorOf>` makes the manager the only route; the local cache only helps for artifacts already fetched *and* not subject to an update check
**Fix:** treat it as production infrastructure — HA, monitoring, and an offline-friendly update policy for CI; the exclusivity that stops confusion attacks is the same property that makes it a single point of failure

**Symptom:** a `settings.xml` with credentials is found in the project repository
**Cause:** someone needed CI to authenticate and committed the easiest thing that worked
**Fix:** rotate the credential (it is public now, including in git history), inject a short-lived token via `${env.VAR}`, and have CI write its own settings file from a secret store

**Symptom:** after adding `<mirrorOf>*</mirrorOf>`, a build that needs a vendor-specific repository can no longer resolve it
**Cause:** the wildcard mirror intercepts *every* repository, including ones the POM declares for good reason — the request goes to the internal group, which has no such proxy member
**Fix:** add that upstream as a proxy member of the group (the right answer, since it keeps the single egress point), or scope the mirror with `*,!vendor-repo` if you deliberately want an exception

**Symptom:** an internal artifact resolves to a stale or unexpected copy from inside the repository manager itself
**Cause:** in the aggregating group, a proxy of a public repository is ordered ahead of the hosted internal repository, so a coordinate present in both is served from the public side
**Fix:** put hosted repositories first in the group's member order, and add the routing rule/exclude pattern so the public proxy cannot serve your namespace at all

## Interview questions

**★ What two distinct jobs does Nexus or Artifactory do, and what does each buy?**
Proxying the public world — availability when Central is down or
rate-limiting, a single audited egress point, and one place to answer "what
do we depend on?" — and hosting internal artifacts that must not leave the
company. A group repository aggregates both so builds configure one URL. The
cost is a new single point of failure: when it is down, nothing builds, and
the local caches only cover what has already been fetched.

**★ Explain dependency confusion in a Maven shop, and the mitigation you would actually implement.**
An attacker publishes your internal coordinates publicly and a build resolves
theirs instead of yours. Maven is less exposed than npm because it resolves a
fixed version from the first repository that has it rather than the highest
version across sources — but the exposure is real when a POM lists a public
repository ahead of the internal one, when the group's member ordering puts
the Central proxy first, or when the internal repo 404s a version and the
next repository answers. The fix is structural: mirror everything through the
internal group (`<mirrorOf>*</mirrorOf>`), add a routing rule or exclude
pattern so the public proxy returns 404 for your groupId, deny build agents
direct egress, and claim the namespace on Central so the coordinates cannot
be squatted at all.

**★ What belongs in `settings.xml` and what belongs in the POM?**
`settings.xml` holds machine- and user-specific configuration that must not
travel with the project: credentials, mirror routing, proxy settings, the
local repository path. The POM holds everything that defines the project and
must be identical for everyone who builds it. The test is simple — if
checking it into the project repository would either leak a secret or make
the build behave differently for someone else, it is a settings concern.

**★ Why is a mirror a stronger control than "just declare the internal repository first"?**
Because ordering declared in a POM is a per-project decision that anyone can
change, and any new module or dependency-supplied POM can add its own
repositories. A mirror in `settings.xml` intercepts every lookup regardless of
where the repository was declared, so routing becomes a property of the
machine rather than of the code. It also means one place to change when the
internal host moves, instead of every POM in the estate.

**★ Your repository manager is down and every build in the company has stopped. What went wrong architecturally, and what would you change?**
Nothing "went wrong" — an exclusive mirror deliberately makes the manager the
only route to every artifact, which is what stops confusion attacks and gives
you the dependency inventory. The consequence is that it is production
infrastructure and must be treated as such: HA or at least fast restore,
monitoring, and an update policy that lets CI proceed from cache when the
manager is unreachable for read-only resolution. The wrong reaction is to
loosen the mirror so builds can fall back to Central, because that reinstates
exactly the ordering ambiguity the mirror removed.

**★ What does a repository manager give you that a `<mirror>` entry alone does not?**
A mirror is client-side routing — it only says *where to send a request*. It
cannot cache, it cannot host, and it cannot enforce anything, because it is a
line in a file on each developer's machine. The manager is the server on the
other end: it caches upstream artifacts so you survive Central being down or
rate-limiting, it hosts internal artifacts that have nowhere else to live, it
holds routing rules and exclude patterns that no client can bypass, and it is
the single place that has seen every artifact your organisation resolved. The
two are complementary — the mirror makes the manager unavoidable, the manager
makes that worth doing.

**★ A POM declares its own `<repositories>` and you have `<mirrorOf>*</mirrorOf>` configured. What happens, and why is that the intended behaviour?**
The mirror intercepts it: the request goes to the internal group regardless of
what the POM asked for, and if the group has no proxy for that upstream, it
fails. That looks hostile and is the point — a repository declared in a POM
(including a POM you inherited from a *dependency*) is an untrusted party
choosing where your build downloads code from. Routing must be an organisation
decision, not a per-project one. The correct response to the failure is to add
that upstream as a proxy member of the group, which keeps the single egress
point and the audit trail; scoping the mirror with `*,!vendor-repo` is the
deliberate exception, not the default fix.

---

← Prev: [The local cache, remote repositories and Maven Central](01-local-remote-central.md) · Index: [Artifact repositories](README.md) · Next → [`javac` flags that matter](../11-javac-flags/README.md)
