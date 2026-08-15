---
title: "profiles"
sidebar_label: "12 · profiles"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [Use service profiles](https://docs.docker.com/compose/how-tos/profiles/),
> [the `services` element](https://docs.docker.com/reference/compose-file/services/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**Profiles answer "should this service exist at all", which is a different question
from "how should it be configured".** Override files answer the second
([page 11](11-override-files.md)); using them for the first means fighting the merge
rules.

## The rule

**"Services without a `profiles` attribute are always enabled."** Add the attribute
and the service is opt-in.

```yaml
services:
  api:
    build: .                    # no profiles — always starts

  db:
    image: postgres:18          # no profiles — always starts

  adminer:
    image: adminer:5
    profiles: [tools]           # only when the tools profile is on

  otel-collector:
    image: otel/opentelemetry-collector:latest
    profiles: [debug, tracing]  # either profile enables it
```

```bash
docker compose up -d                                  # api, db
docker compose --profile tools up -d                  # api, db, adminer
COMPOSE_PROFILES=debug,tools docker compose up -d     # everything above
docker compose --profile frontend --profile debug up  # several flags also work
```

A service listing several profiles starts when **any** of them is active.

## Targeting a service enables its profile

> "When you explicitly target a service on the command line that has one or more
> profiles assigned, you do not need to enable the profile manually as Compose runs
> that service regardless of whether its profile is activated."

```bash
docker compose up -d adminer      # works with no --profile flag
```

This is the ergonomic bit that makes profiles pleasant: a one-off tool is one command
away without remembering which profile it lives in.

When you target a profiled service, "only the targeted service (and any of its
declared dependencies via `depends_on`) is started" — not the rest of the stack.

## The dependency rule that bites

If a profiled service depends on another service, the dependency must **share the
same profile, be unassigned, or be started separately**. A dependency sitting in a
*different* profile that is not enabled does not get pulled in.

```yaml
services:
  migrate:
    build: .
    profiles: [tools]
    depends_on:
      db:
        condition: service_healthy    # db has no profile → always available ✅
```

That works because `db` is unassigned. Move `db` into `profiles: [core]` and
`docker compose --profile tools up` breaks, because nothing enables `core`.

**The practical rule: keep infrastructure unassigned and put only optional things in
profiles.** A profile should be a leaf, not a layer.

## What profiles are actually for

| Case | Profile |
|---|---|
| Database GUI (adminer, pgAdmin, Mongo Express) | `tools` |
| Seed and migration one-shots | `tools` or `setup` |
| Load generator, tracing collector, profiler | `debug` |
| An integration-test runner service | `test` |
| A second app that only some developers need | its own name |

The value is not merely convenience — it is that `docker compose up` stays fast and
its memory footprint stays small for the common case, while the extras remain *in
the same file* rather than in a second file somebody forgets to update.

## Teardown

```bash
docker compose --profile tools down
COMPOSE_PROFILES=tools docker compose down
```

Passing the profile on `down` "stops both profiled and non-profiled services
together". Plain `docker compose down` removes the always-on services; a container
from an unlisted profile can be left behind, which then shows up as an orphan on the
next `up`. `--remove-orphans` clears it, or simply name the profile
([page 03](03-up-and-down/01-up.md)).

## Seeing what is enabled

```bash
docker compose config --services                    # services in the default run
docker compose --profile tools config --services    # with the profile on
docker compose --profile tools config               # the whole resolved file
```

Since profiles change *which services exist*, `config` is the honest way to check
before an `up` that might not start what you expect
([page 02](02-compose-yaml-and-the-spec/02-yaml-that-bites.md)).

## Podman

Profiles are resolved by the compose provider before anything reaches the engine
([page 15](15-podman-compose.md)). With `docker-compose` as the provider they behave
as documented; `podman-compose` implements a subset of the Specification, and
profiles are a reasonable thing to verify with `config` rather than assume. Nothing
about profiles is engine-specific.

## Gotchas

**Symptom:** `docker compose --profile tools up` fails on a missing dependency.
**Cause:** The dependency lives in a different, un-enabled profile. A dependency must
share the profile, be unassigned, or be started separately.
**Fix:** Leave infrastructure services unassigned. Profiles work best on leaves.

**Symptom:** A service you meant to be optional starts every time.
**Cause:** No `profiles` attribute — services without one are always enabled.
**Fix:** Add `profiles: [name]`. There is no "disabled by default" flag other than
this.

**Symptom:** Containers from a profile survive `docker compose down`.
**Cause:** `down` without the profile does not target its services.
**Fix:** `--profile <name> down`, or `down --remove-orphans`.

**Symptom:** A teammate cannot start the debugging tool and there is no
documentation.
**Cause:** Profiles are invisible in `docker compose ps` and easy to forget.
**Fix:** List the profiles and what they contain in the project README — or rely on
targeting the service by name, which needs no flag.

## Interview questions

**★ What does `profiles:` do, and what happens to a service without it?**
It makes a service opt-in: it starts only when one of its profiles is enabled with
`--profile` or `COMPOSE_PROFILES`. Services with no `profiles` attribute are always
enabled. A service listing several profiles starts if any one of them is active.

**★ When would you use a profile instead of a second compose file?**
When the question is whether a service should exist at all — a database GUI, a seed
job, a tracing collector. Override files are for configuring the *same* services
differently per environment; using one to remove a service means fighting the merge
rules with `!reset`, where a profile expresses it directly.

**What happens if you run `docker compose up adminer` and `adminer` is in a
profile?**
It starts. Targeting a profiled service by name enables its profile implicitly, and
only that service plus its `depends_on` dependencies are started — not the whole
stack.

**A service in a profile depends on one in another profile. What happens?**
It fails unless that profile is also enabled. A dependency must share the profile, be
unassigned, or be started separately. The habit that avoids it entirely is keeping
infrastructure unassigned and putting only optional leaves in profiles.

**Why might `docker compose down` leave containers behind?**
Because it only targets the services enabled in that invocation. A container from a
profile you did not name survives and reappears as an orphan. Pass the profile, or
use `--remove-orphans`.

---

← Prev: [Override files](11-override-files.md) · Index: [Phase 8](README.md) · Next → [develop.watch](13-develop-watch.md)
