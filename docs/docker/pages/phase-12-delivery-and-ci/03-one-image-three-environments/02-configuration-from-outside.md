---
title: "Configuration from outside"
sidebar_label: "02 · Configuration from outside"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [The Twelve-Factor App — Config](https://12factor.net/config),
> [Compose — environment variables precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/)
> and [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

If one image runs everywhere, then everything that differs has to arrive from
outside it. This chunk is where those differences live, and — just as
importantly — **what must not differ at all**.

## The definition worth borrowing

The Twelve-Factor App defines config as **"everything that is likely to vary
between deploys"**: database credentials, external service keys, per-deploy
values. Not your log format, not your route table, not anything that is the same
in every environment.

Its litmus test is the sharpest one-line version of the rule:

> **"Whether the codebase could be made open source at any moment, without
> compromising any credentials."**

If the answer is no, configuration is in the wrong place — and by extension, if
your *image* would compromise credentials when pulled, it is in the wrong place
too.

The methodology's reason for environment variables is practical rather than
aesthetic: they are a "language- and OS-agnostic standard" and they are not
accidentally committed to a repository the way a config file is.

## The catalogue

What legitimately varies, and how it should arrive:

| Kind | Example | Mechanism |
|---|---|---|
| **Connection details** | Database host, Redis URL, queue endpoint | Environment variables |
| **Credentials** | Database password, API key, signing key | **A mounted secret**, not an environment variable |
| **Behaviour switches** | Log level, feature flag, sampling rate | Environment variables |
| **Scale and limits** | Replica count, memory limit, pool size | Deployment definition, not the image |
| **Endpoints of others** | The public URL of this service, allowed origins | Environment variables |

And what must **not** vary between environments, because varying it is how
staging stops being a test of anything:

- **The application code and its dependencies.** That is the digest.
- **The entrypoint and command.** If production runs a different command, you
  tested a different program.
- **The base image.** Same digest, so this is automatic — unless somebody
  reintroduced a per-environment build.
- **Healthcheck definitions.** Different checks per environment means production
  is the first place the real check runs
  ([Phase 10 · 09](../../phase-10-production/09-healthchecks-in-production.md)).

## Secrets are not just sensitive configuration

Environment variables are visible to anything that can inspect the container, and
they leak into logs, crash dumps and error trackers with depressing reliability.
The distinction that matters:

- **Configuration** → environment variables. Non-sensitive, and convenient.
- **Secrets** → a **file mounted at run time**. Compose mounts a secret at
  `/run/secrets/<secret_name>`, and Podman's `--secret` defaults to
  `type=mount` at the same path
  ([Phase 10 · 05](../../phase-10-production/05-config-and-secrets.md)).

⚠️ **A mounted secret is still readable by the process** — the win is that it is
not in the environment block, not in `docker inspect`, and not in a stack trace.
That is a meaningful reduction in exposure, not encryption.

🔴 **Neither one belongs in the image.** If a credential is baked into a layer,
rebuilding does not unpublish it — rotate it. That rule has appeared in every
phase that touches secrets, and it is the one people learn the hard way.

## Precedence, and why it causes so much confusion

When the same variable is set in several places, the winner is defined. Compose
documents the order from highest to lowest as:

1. `docker compose run -e` on the command line
2. `environment` or `env_file` with values interpolated from the shell or
   environment files
3. the `environment` attribute in the Compose file
4. the `env_file` attribute in the Compose file
5. the image's own `ENV` directive

🔴 **The image's `ENV` loses to everything**, which is exactly the property this
topic depends on: the image can carry sensible defaults and every environment can
override them. Ship defaults, not decisions.

⚠️ **`.env` and `env_file:` are unrelated and constantly confused.** `.env`
interpolates values *into the Compose file*; `env_file:` puts variables *into the
container*. [Phase 8 · 10](../../phase-8-compose/10-environment-and-interpolation.md)
is the full treatment.

## Making the defaults safe

A container that starts happily with a missing configuration value is a container
that will run in production with a development default, and nobody will notice
until it matters.

The pattern that avoids it:

- **Validate configuration at start-up and exit non-zero if it is missing.**
  Failing to start is loud; running with a wrong value is silent. This is worth
  more than any amount of documentation about which variables exist.
- **Default only what is genuinely safe to default** — a log level, a port, a
  pool size. Never a hostname, never a credential, never a feature flag whose
  wrong value costs money.
- **List every variable the service reads in one place**, and make the start-up
  check read from that list, so the two cannot drift.

⚠️ **A crash loop from a missing variable looks alarming and is the correct
behaviour.** [Phase 10 · 06](../../phase-10-production/06-failure-catalogue/README.md)
puts it plainly: a container that dies immediately is a much better failure than
one that runs and is wrong.

## Where the environment definition itself lives

The configuration has to be written down somewhere, and the choices are the same
whichever engine you use:

| Where | Fits |
|---|---|
| A Compose override file per environment | Compose deployments — the run varies, the image does not ([Phase 8 · 11](../../phase-8-compose/11-override-files.md)) |
| A Quadlet unit's `Environment=` / `EnvironmentFile=` / `Secret=` | Podman under systemd ([Phase 11 · 04](../../phase-11-podman-in-depth/04-quadlet/README.md)) |
| The platform's own configuration store | A PaaS or an orchestrator |

🔴 **Whichever it is, it is version-controlled and reviewable — minus the
secrets.** The twelve-factor warning applies here too: batching config into named
groups such as "development", "production", "staging" gets brittle as a project
grows and people add their own — a "combinatorial explosion" of environments that
becomes fragile to manage. Prefer *per-deploy values* over *named environment
profiles* where you can.

## Gotchas

**Symptom:** A service ran in production with a development database URL.
**Cause:** The image carried a default via `ENV` and the environment did not
override it — and nothing checked at start-up.
**Fix:** Validate required configuration at boot and exit non-zero when it is
absent. Only default what is safe to get wrong.

**Symptom:** A password appeared in an error-tracker payload.
**Cause:** It was an environment variable, and the reporter serialised the
environment on crash.
**Fix:** Deliver secrets as mounted files at `/run/secrets/<name>` instead. Then
rotate the exposed credential — it is already out.

**Symptom:** A variable set in the Compose file is being ignored.
**Cause:** Something higher in the precedence order is setting it — a `run -e`
flag, or an interpolated value from the shell.
**Fix:** Read the documented order top-down. It is defined, not arbitrary, and
the image's `ENV` is the weakest source of all.

**Symptom:** Staging behaves differently from production for reasons nobody can
identify.
**Cause:** Something is varying that should not — a different command, a
different healthcheck, or a per-environment build.
**Fix:** Diff the deployment definitions, not the code. Everything except
configuration should be identical, and the digest proves the image half.

## Interview questions

**★ What belongs in configuration and what does not?**
Configuration is "everything that is likely to vary between deploys" —
connection details, credentials, behaviour switches, scale. What must *not* vary
is the code and dependencies (the digest), the entrypoint and command, and the
healthcheck definition. If production runs a different command or a different
check, staging tested a different program.

**★ Why are environment variables the wrong home for secrets?**
Because they are visible to anything that can inspect the container and they leak
into logs, crash reports and error trackers. Secrets should arrive as files
mounted at run time — `/run/secrets/<name>` under both Compose and Podman. That
is not encryption; it is removing them from the places that accidentally publish
them. And nothing sensitive goes in the image, because rebuilding does not
unpublish a layer.

**★ What is the twelve-factor litmus test, and why is it a good one?**
"Whether the codebase could be made open source at any moment, without
compromising any credentials." It is good because it is binary and needs no
judgement — and it extends naturally to images: if pulling your image would
compromise a credential, the configuration is in the wrong place.

**What is the precedence order for environment variables under Compose?**
Highest to lowest: `docker compose run -e`, then `environment`/`env_file` with
interpolated values, then the `environment` attribute, then the `env_file`
attribute, then the image's `ENV`. The image losing to everything is the property
that makes one-image-everywhere work — the image ships defaults, the environment
makes decisions.

**Why validate configuration at start-up?**
Because the alternative is running with a wrong default and finding out later. A
container that exits non-zero on a missing variable is a loud, immediate failure
that a healthcheck and a restart policy will surface; a container that starts
with a development database URL is silent until it is expensive.

**What is wrong with named environment profiles?**
They multiply. Twelve-factor's objection is that batching config into groups like
"development", "staging" and "production" gets brittle as people add their own
variants — a combinatorial explosion that becomes fragile to manage. Per-deploy
values scale better than per-environment profiles.

---

← Prev: [Build once, promote the digest](01-build-once-promote.md) · Index: [Phase 12](../README.md) · Next → **04 · Registry authentication in CI** *(not written yet)*
