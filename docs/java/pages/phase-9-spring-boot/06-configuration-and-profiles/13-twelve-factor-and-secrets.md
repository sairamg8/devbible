---
title: "Twelve-factor configuration and secrets"
sidebar_label: "13 · Twelve-factor and secrets"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference *Externalized
> Configuration* — `SPRING_APPLICATION_JSON`, the `optional:` prefix, and
> *Configuration Trees* (`spring.config.import=optional:configtree:…`, the
> Kubernetes Secrets and `/run/secrets/` examples, the wildcard
> `configtree:/etc/config/*/` form and its alphabetical ordering, narrowing the
> import to skip a parent folder, and binding tree values to `String` or
> `byte[]`) — and the Actuator reference for `env` / `configprops` value
> sanitisation via `management.endpoint.env.show-values`. The twelve-factor
> statement of factor III is from 12factor.net. Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**Factor III says one thing — configuration is what varies between deploys, and
it belongs in the environment rather than in the code. Boot's whole externalised
configuration stack is an implementation of that sentence, and the twelve chunks
before this one are its mechanics. What is left is the part the mechanics cannot
decide for you: which values are configuration at all, why secrets are a
different category from configuration, and the honest list of what Boot does not
do about them.**

## The test that decides what is configuration

Factor III's own test is the useful one: **could this repository be made public
right now without leaking a credential?** If not, something that varies between
deploys is inside the artifact.

The corollary is the part people skip. Configuration is *what varies between
deploys* — not "everything in `application.yml`". A thread-pool size that is the
same everywhere is not configuration, it is a decision, and moving it into the
environment makes it a decision nobody can find. **The default belongs in the
artifact; only the deviation belongs outside it.**

That is exactly the shape of the precedence stack from
[chunk 1](01-the-environment-and-precedence.md): the packaged file holds the
general case, the environment holds what this deployment does differently, and
the command line holds what this *run* does differently.

## One artifact, many environments

The rule that makes the rest work: **the same bytes are promoted from CI to
staging to production.** Not rebuilt per environment, not repackaged with a
different properties file.

Boot supports this without ceremony — packaged defaults, external overrides,
environment variables, profile groups — but it does not enforce it, and the two
ways teams break it are worth naming. Building a `-prod` artifact makes the
thing you tested in staging a different thing. And baking environment-specific
values into the image at build time makes a rollback to yesterday's image a
rollback of configuration nobody intended to change.

## `SPRING_APPLICATION_JSON`

When the environment has to carry *structure* that variable names cannot express
— a map with punctuated keys, a nested block on a platform that only offers flat
variables — Boot accepts an entire JSON document in one variable:

```bash
SPRING_APPLICATION_JSON='{"my":{"service":{"limits":{"api.reads":100}}}}'
```

It sits at position 10 in the precedence order, above ordinary environment
variables and system properties and below command-line arguments. It is the
right tool for the cases in [chunk 4](04-relaxed-binding-and-env-vars.md) that
relaxed binding cannot reach, and a poor default: everything it carries is
coupled into one value, so a single misplaced brace removes every key at once
and no diff tool will show you which.

## Why secrets do not belong in `application.yml`

Not because it is untidy — because a properties file has none of the properties
a secret needs.

- **It is in the image.** Anyone who can pull the image can read it, which is a
  much larger set of people than those who can reach production.
- **It is in git history.** Removing a committed secret in a later commit
  removes nothing; the value has to be rotated, and rotating it is the step
  that gets skipped.
- **It is on every laptop** that cloned the repository, and in every CI cache.
- **There is no audit.** Nothing records who read it, which is the first
  question asked after an incident.
- **There is no rotation.** Changing it means a rebuild and a redeploy, so it
  never changes.

Environment variables are better and still not good: they are visible in a
process's `/proc/<pid>/environ`, they are inherited by every child process the
application spawns, and they routinely end up in crash dumps and in logs that
print the environment on startup.

## Configuration trees

The mechanism Boot provides for mounted secrets. A **configuration tree** maps a
directory of single-value files onto property names:

```
/run/secrets/
  ├── myapp.username
  └── myapp.password
```

```yaml
spring.config.import: "optional:configtree:/run/secrets/"
```

gives you `myapp.username` and `myapp.password` in the `Environment`. The file
name is the property name and the file content is the value, which is precisely
the shape Kubernetes Secrets and Docker secrets are mounted in — no glue code
and no secret-manager SDK on the classpath.

**Nested directories become nested property names**, so
`/etc/config/myapp/username` binds `myapp.username`. If you would rather not
carry the parent folder in the name, import one level deeper:

```yaml
spring.config.import: "optional:configtree:/etc/config/myapp"    # → username, password
```

**The wildcard form imports each immediate child directory**, which is how
several independently-mounted volumes are picked up without naming any of them:

```yaml
spring.config.import: "optional:configtree:/etc/config/*/"
```

⚠️ Directories loaded through a wildcard are processed **alphabetically**. When
two of them define the same key, the order is the sorted order and not the order
you listed the mounts — list the locations separately if you need a different
one.

Tree values bind to `String` or to `byte[]`, so a mounted certificate or keystore
is reachable as bytes rather than needing to be base64'd through a variable.

## `optional:` is the safety switch, not a formality

`optional:` marks a location as allowed to be absent. On a secrets mount, think
carefully before using it: a volume that failed to mount should usually be a
**startup failure**, because the alternative is an application that starts,
serves traffic, and fails to authenticate on the first request that needs the
credential.

The pattern that gets this right is `optional:` on the developer-machine paths
and mandatory on the deployed ones — which falls out naturally if the deployed
import lives in a profile-specific file and the local one does not.

## What Boot does not give you

Stated plainly, because it is where the mechanism ends:

- **No rotation.** A configuration tree is read at startup. Changing the mounted
  file does not change the `Environment`, and a constructor-bound properties
  object could not observe it if it did ([chunk 5](05-constructor-binding-and-validation.md)).
  Rotation means a restart, or a mechanism built for it.
- **No encryption at rest.** The file on the volume is plaintext to anyone who
  can read the volume. Boot consumes a secret; it does not protect one.
- **No access audit.** Nothing records that the value was read.
- **No secret lifecycle at all** — issuance, expiry, revocation. Those belong to
  a secrets manager, and Boot's part is to consume what it mounts or exposes.

What Boot *does* give you is one useful piece of hygiene: **the `env` and
`configprops` Actuator endpoints mask values by default**, controlled by
`management.endpoint.env.show-values`. Turning that off to debug a binding
problem publishes every credential the application holds to whoever can reach
the endpoint.

## The trade-off

Twelve-factor configuration buys deployability: one artifact, promoted
unchanged, configured by whoever runs it. The cost is that **no single place
describes a running system** — the answer is the artifact's defaults, plus the
platform's variables, plus the mounted trees, plus the active profiles, resolved
by rules this topic spent twelve chunks on. Teams that dislike Boot's
configuration usually dislike that dispersion, and the answer is not to
re-centralise it into the artifact but to keep the number of layers small and to
use the endpoints that report the resolved view.

## Gotchas

**Symptom:** a secret was removed from `application.yml` in a later commit and the incident report still calls it exposed
**Cause:** git history retains it; deleting a value from the current revision does not unpublish it
**Fix:** rotate the credential — that is the only remediation — and move it to a mounted secret so the next one never enters the repository

**Symptom:** an application starts without its secrets and fails on the first authenticated request
**Cause:** the secrets location was imported with `optional:`, so a volume that failed to mount produced silence
**Fix:** make deployed secret locations mandatory and keep `optional:` for developer machines:
```yaml
spring.config.import: "configtree:/run/secrets/"
```

**Symptom:** two mounted configuration trees define the same key and the wrong one wins
**Cause:** wildcard locations are processed in alphabetical order, not in the order the mounts were created
**Fix:** list the locations explicitly, in the order you want them applied, instead of relying on the wildcard

**Symptom:** a rotated secret has no effect until the pod is restarted
**Cause:** configuration trees are read at startup; nothing re-reads the file, and a constructor-bound object could not observe a change anyway
**Fix:** treat rotation as a restart — trigger a rolling restart when the secret changes — or adopt a mechanism designed for dynamic refresh

**Symptom:** credentials appear in a support bundle taken from the `env` endpoint
**Cause:** value masking was disabled to debug a binding problem and never re-enabled
**Fix:** restore the default and debug with `configprops` names rather than values:
```properties
management.endpoint.env.show-values=NEVER
```

**Symptom:** a rollback to the previous image also rolls back configuration nobody meant to change
**Cause:** environment-specific values were baked into the image at build time, so image version and configuration version are the same thing
**Fix:** keep environment-specific values in the environment; the image should contain defaults only

**Symptom:** a value that is identical in every environment is set by the deployment pipeline
**Cause:** "externalise configuration" was applied to something that does not vary between deploys
**Fix:** move it back into `application.yml`, where a reader can find it and a reviewer can see it change

**Symptom:** a mounted certificate has to be base64-encoded into an environment variable
**Cause:** the binary was being carried through a mechanism that only holds text
**Fix:** mount it and import it as a configuration tree, whose values bind to `byte[]` directly

## Interview questions

**★ What does factor III actually require, and what does it not?**
That configuration — everything that varies between deploys — lives in the
environment rather than in the code, with the test being whether the repository
could be made public without leaking a credential. What it does not require is
that every setting move out of the artifact. A value that is the same in every
environment is not configuration, and externalising it makes a decision harder
to find without making anything more deployable. Defaults belong in the
artifact; deviations belong outside it.

**★ Why are secrets not just configuration with a scarier name?**
Because they need properties that configuration does not: rotation, an audit
trail, restricted read access, and a lifecycle independent of the deployment. A
value in `application.yml` has none of those — it ships inside the image, it
lives forever in git history, and changing it means a rebuild, which is why it
never changes. Environment variables improve the first problem and not the rest;
they remain readable from the process's own environment and are inherited by
every child process.

**★ How does Spring Boot consume a Kubernetes Secret?**
As a configuration tree. The secret is mounted as a directory of single-value
files, and
`spring.config.import=optional:configtree:/etc/config/` maps file names onto
property names and file contents onto values, so `/etc/config/myapp/password`
becomes `myapp.password`. There is no SDK and no glue code. The wildcard form
`configtree:/etc/config/*/` picks up each mounted volume without naming them,
processing them alphabetically, and tree values bind to `byte[]` as well as
`String`, which is how a mounted certificate is read without base64.

**★ Should a secrets import be `optional:`?**
On a developer machine, yes; on a deployed instance, usually not. `optional:`
converts a volume that failed to mount into silence, and the result is an
application that starts successfully and then fails to authenticate on the first
request that needs the credential — an incident rather than a failed deployment.
Making the deployed location mandatory turns a mount failure into a container
that will not start, which is the outcome you want.

**★ What does Boot not do for secrets?**
Rotation, encryption at rest, access auditing, and lifecycle. A configuration
tree is read once at startup, so changing the mounted file changes nothing until
a restart — and a constructor-bound properties object could not observe the
change even then. The file itself is plaintext to anyone who can read the
volume, and nothing records that it was read. Boot's role is to consume a secret
the platform provides; issuing, protecting and revoking it belongs to a secrets
manager.

**★ Someone disables Actuator value masking to debug a binding problem. What is wrong with that?**
It publishes every credential the application holds to anyone who can reach the
endpoint, and the change routinely outlives the debugging session — the next
support bundle taken from `env` then contains secrets. Boot masks values by
default for that reason, and the debugging can be done without them:
`configprops` shows which keys bound to which properties, and the property
*names* are almost always enough to find a relaxed-binding or precedence
mistake.

**★ What is the honest cost of twelve-factor configuration?**
That no single place describes a running system. The effective configuration is
the artifact's defaults plus the platform's variables plus the mounted trees
plus the active profiles, resolved by a precedence order that has to be known
rather than read. That dispersion is the price of promoting one artifact
unchanged through every environment, and the mitigations are to keep the number
of layers small, to keep active profiles few, and to use the `env` and
`configprops` endpoints, which report the resolved view that no file can.

---

← Prev: [Profile-specific files and the traps](12-profile-files-and-traps.md) · Index: [Configuration and profiles](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md)
