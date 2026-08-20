---
title: "`/info`, and why it returns an empty object"
sidebar_label: "16 · `/info` and build metadata"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.0 reference — *Actuator ·
> Endpoints · Application Information*
> (docs.spring.io/spring-boot/reference/actuator/endpoints.html: the
> auto-configured `InfoContributor` beans `build`, `env`, `git`, `java`, `os`,
> `process` and `ssl`, their prerequisites — `META-INF/build-info.properties`
> for `build`, a `git.properties` resource for `git`, an SSL bundle for `ssl` —
> which of them are enabled by default, the `management.info.<id>.enabled`
> properties, the `env` contributor exposing every `Environment` property whose
> name starts with `info.`, `management.info.git.mode: "full"`, and the
> statement that the Maven and Gradle plugins can both generate the build-info
> file). Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**`/info` is the smallest complete demonstration of how Actuator thinks. The
endpoint exists, it is accessible, and the first time you expose it, it returns
an empty object — because five of its seven contributors are off by default and
the two that are on need a file your build has to be told to generate. Nothing in
Actuator is simply "on". Understanding why `/info` is empty is understanding the
layered opt-in that the rest of this topic keeps running into.**

## Seven contributors, two enabled, both silent

| Contributor | Exposes | Needs | Enabled by default |
|---|---|---|---|
| `build` | build information | `META-INF/build-info.properties` | yes |
| `git` | git information | a `git.properties` resource | yes |
| `env` | every `Environment` property whose name starts with `info.` | nothing | **no** |
| `java` | Java runtime information | nothing | **no** |
| `os` | operating system information | nothing | **no** |
| `process` | process information | nothing | **no** |
| `ssl` | SSL certificate information | a configured SSL bundle | **no** |

The two enabled by default are exactly the two with a prerequisite, which is why
a default `/info` is empty rather than partially populated. Switch the others on
individually:

```properties
management.info.env.enabled=true
management.info.java.enabled=true
management.info.os.enabled=true
```

⚠️ **These are *contributor* properties and have nothing to do with the endpoint
access model of [chunk 02](02-exposure-access-and-ports.md).**
`management.info.env.enabled` is current and correct.
`management.endpoint.info.enabled` is the endpoint-level property that was
replaced by `access`, and it would not have governed contributors even when it
worked. Two properties, similar names, different subsystems — and reaching for
the wrong one is the single most common reason `/info` stays empty while the
configuration looks right.

## Getting real build metadata in there

The `build` contributor is enabled and silent until the build writes the file.
Maven, through the Spring Boot plugin's `build-info` goal:

```xml
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <executions>
    <execution><goals><goal>build-info</goal></goals></execution>
  </executions>
</plugin>
```

Gradle, through the same plugin's DSL:

```groovy
springBoot {
    buildInfo()
}
```

`git.properties` comes from a git-commit-id plugin rather than from Boot itself,
and once it exists `management.info.git.mode=full` switches the response from the
short form to everything the file contains.

For anything the build does not already know, the `env` contributor picks up
`info.*` properties — and with `spring-boot-starter-parent`, Maven's resource
filtering expands build coordinates into them:

```properties
management.info.env.enabled=true
info.app.name=@project.artifactId@
info.app.version=@project.version@
info.app.team=payments
```

And when the value has to be computed at runtime, an `InfoContributor` bean:

```java
@Component
class RegionInfoContributor implements InfoContributor {
    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("region", System.getenv("AWS_REGION"));
    }
}
```

## What it is genuinely for — and the argument against it

The one question `/info` answers better than anything else is **"which build is
actually running on this instance?"** That question appears in every rollback,
every "it works on the other pod", and every disagreement about whether a fix has
shipped. A commit hash returned by the running process settles it in a way a CI
dashboard cannot, because the dashboard describes what was built and the endpoint
describes what is running — and the gap between those two is exactly the thing
being argued about.

Against that: the same response is a precise fingerprint. Version plus commit
plus Java version tells a reader which published advisories apply to you, and
`management.info.git.mode=full` adds the branch name, the commit message and the
committer's email address — internal naming and internal work, published.

The resolution is not to disable `/info` but to put it where your own tooling
reaches it and the internet does not, which is
[chunk 18](18-locking-it-down.md). Boot exposes only `health` by default, so
`/info` is not public until somebody makes it so; the point is to be deliberate
at that moment rather than adding it to an `include` list out of habit.

## Gotchas

**Symptom:** `/info` is exposed and returns `{}`
**Cause:** five contributors are disabled by default, and the two enabled ones need files the build has to generate
**Fix:** enable what you want *and* generate the file:
```properties
management.info.env.enabled=true
management.info.java.enabled=true
```
plus the `build-info` goal in Maven or `buildInfo()` in Gradle

**Symptom:** `management.endpoint.info.enabled=true` is set and nothing changes
**Cause:** endpoint-level `enabled` was replaced by the `access` model, and it never governed contributors in the first place
**Fix:** `management.info.<id>.enabled` for contributors; `management.endpoint.info.access` for the endpoint itself

**Symptom:** contributors are enabled, the build file exists, and `/info` still 404s
**Cause:** exposure is a separate gate from everything above — `health` is the only endpoint exposed over HTTP by default
**Fix:** add it to the exposure list; [chunk 02](02-exposure-access-and-ports.md) sets out all the gates in order

**Symptom:** `info.app.version` comes back as the literal string `@project.version@`
**Cause:** the `@...@` tokens are Maven resource filtering supplied by `spring-boot-starter-parent`; nothing expands them in a build without it
**Fix:** either inherit the starter parent, or set the value from the build another way — under Gradle, expand the token in `processResources`, or drop the token and let the `build` contributor supply the version from `build-info.properties`, which is the more robust route anyway

**Symptom:** `/info` publishes a branch name, a commit message and a committer email address
**Cause:** `management.info.git.mode=full` dumps everything `git.properties` contains
**Fix:** stay on the default short mode, or trim the generated `git.properties` in the build. Full mode is a debugging convenience, not a deployment setting

**Symptom:** the version in `/info` does not match the version that was deployed
**Cause:** `build-info.properties` is written at build time and baked into the artifact, so it describes the build the artifact came from — a re-tagged or re-pushed image still carries the original values
**Fix:** treat `/info` as authoritative about the *artifact* and your orchestrator as authoritative about *which artifact is running*; when they disagree, the interesting bug is in the promotion pipeline

## Interview questions

**★ You expose `/info` and get an empty object. Walk through why.**
Three independent things must be true and usually only one is. The contributor
must be enabled — five of the seven are off by default, including `env`, `java`
and `os`. The two that are on, `build` and `git`, need a file the build has to
generate: `META-INF/build-info.properties` from the Spring Boot Maven or Gradle
plugin, and `git.properties` from a git-commit-id plugin. And the endpoint must be
exposed, which is a separate gate again. The classic wrong turn is setting
`management.endpoint.info.enabled`, which is the replaced endpoint-level property
and never governed contributors anyway.

**★ What is `/info` actually good for?**
Answering "which build is running on this instance", from the running process
rather than from a deployment record. That question comes up in every rollback and
every "it works on the other pod", and the two sources disagreeing is often the
bug itself. The cost is that the same response is a precise fingerprint — version,
commit, Java version, and under `git.mode=full` the branch, commit message and
committer email — which is an argument about where it should be reachable from,
not an argument against having it.

**★ How would you populate `/info` for a service, concretely?**
Add the `build-info` goal or `buildInfo()` so the build contributor has a file;
add a git-commit-id plugin if the commit hash matters, which it usually does;
enable the `env` contributor and put a small number of `info.*` properties in
configuration for things the build does not know — owning team, service tier;
and add an `InfoContributor` bean for anything computed at runtime, such as the
region from an environment variable. Then expose it on the management port rather
than the public one.

**★ Why does `management.info.env.enabled` exist alongside `management.endpoint.info.access`?**
Because they control different layers. The contributor property decides what
*goes into* the response body — one contributor at a time, independently. The
access property decides whether the endpoint is reachable at all. Actuator
consistently separates "does this thing produce data", "may it be called" and
"is it routed over this technology", and `/info` is the clearest small example of
all three being independent, which is also why it is the endpoint people most
often misconfigure.

**★ `management.info.git.mode=full` — when would you actually set it?**
Locally, or in an environment where the response is unambiguously internal. It
returns everything in `git.properties`, which typically includes the branch, the
full commit message and the committer's name and email. That is useful when
someone is trying to work out precisely what is deployed, and it is internal
information you would not choose to publish, so the short mode is the right
default for anything long-lived.

---

← Prev: [Conventions and propagation](15-observation-conventions-and-propagation.md) · Index: [Actuator](README.md) · Next → [The endpoint catalogue](17-the-endpoint-catalogue.md)
