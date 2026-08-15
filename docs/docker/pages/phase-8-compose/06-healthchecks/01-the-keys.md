---
title: "The keys, and why the defaults are wrong"
sidebar_label: "01 · The keys"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `healthcheck` attribute](https://docs.docker.com/reference/compose-file/services/) and
> [the Dockerfile `HEALTHCHECK` reference](https://docs.docker.com/reference/dockerfile/#healthcheck).
> **No sandbox** — no console output on this page.

**The Compose `healthcheck` attribute "operates identically to the `HEALTHCHECK`
Dockerfile instruction with customizable overrides" — including inheriting its
defaults, which are wrong for almost every service you will write.**

## The shape

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost"]
  interval: 1m30s
  timeout: 10s
  retries: 3
  start_period: 40s
  start_interval: 5s
```

| Key | What it controls |
|---|---|
| `test` | The command that decides healthy (exit 0) or unhealthy (exit 1) |
| `interval` | Time between successive checks |
| `timeout` | How long a single check may take before it counts as failed |
| `retries` | Consecutive failures before the container is marked unhealthy |
| `start_period` | Grace period after launch before failures count |
| `start_interval` | How often to check *during* the start period |
| `disable` | `true` turns off a healthcheck inherited from the image |

## The four forms of `test`

| Form | Meaning |
|---|---|
| `NONE` | Disables the healthcheck |
| `["CMD", ...]` | Executes the command directly — no shell |
| `["CMD-SHELL", "..."]` | Runs the command through the container's default shell (`/bin/sh` on Linux) |
| `"a string"` | Treated as equivalent to `CMD-SHELL` |

**Use `CMD` when you can and `CMD-SHELL` when you need shell features.** Anything
with a pipe, a `$VARIABLE`, `&&` or a redirect needs `CMD-SHELL`; a plain binary
invocation does not, and `CMD` avoids spawning a shell every interval.

⚠️ **`CMD` means "no shell", which means no `$PGUSER`, no globbing and no `||`.**
A check written as `["CMD", "pg_isready -U postgres"]` — one string containing a
space — tries to execute a binary whose name contains a space, and fails
permanently. Either split the arguments into separate list items, or use
`CMD-SHELL`.

## Why the inherited defaults are wrong

From the Dockerfile reference, and unchanged when Compose inherits them:

| Setting | Default | Why it hurts |
|---|---|---|
| `interval` | **30s** | Up to 30 seconds of not noticing, and up to 30 seconds of extra boot time on every `condition: service_healthy` gate |
| `timeout` | **30s** | A hung service stays "healthy" while the check sits waiting. Combined with 3 retries that is roughly **90 seconds** of serving traffic while wedged |
| `start_period` | **0s** | Failures count from the first instant, so a service that takes 20 seconds to warm up is marked unhealthy before it ever gets going |
| `retries` | **3** | Reasonable, and the only default that usually is |

The exit-code contract is the same as Phase 3's: **0 is healthy, 1 is unhealthy,
and 2 is reserved** — do not use it.

## `start_period` and `start_interval` together

This pair is the single most useful thing on the page, because it removes the
trade-off people usually make badly.

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -h 127.0.0.1"]
  interval: 10s
  timeout: 3s
  retries: 5
  start_period: 60s
  start_interval: 2s
```

- **`start_period: 60s`** — for the first minute, a failing check does not count
  against `retries`. A slow first boot (an empty data directory, a cold JIT, a
  migration) is expected, not a failure.
- **`start_interval: 2s`** — but during that minute, check every **two** seconds
  rather than every ten.

The result: the service is marked healthy within about two seconds of actually
being ready, while still tolerating a minute of startup. Without `start_interval`
you are choosing between a fast `interval` that hammers a running service forever,
and a slow one that adds a fixed delay to every boot. With it, you do not choose.

**This matters most under `depends_on: condition: service_healthy`**, where the gap
between "ready" and "detected as ready" is added directly to every developer's
`up` ([page 05](../05-depends-on.md)).

## Overriding and disabling an image's healthcheck

Many official images ship their own `HEALTHCHECK`. The Compose block overrides it:

```yaml
services:
  db:
    image: postgres:18
    healthcheck:                       # replaces whatever the image declared
      test: ["CMD-SHELL", "pg_isready -U postgres -h 127.0.0.1"]
      start_period: 60s
      start_interval: 2s
```

To switch one off rather than replace it:

```yaml
healthcheck:
  disable: true          # preferred
```

or `test: ["NONE"]`, which is equivalent. The documentation notes you should prefer
`disable: true` over rewriting `test` to something meaningless — and `test: ["CMD",
"true"]` is worse than either, because it reports *healthy* rather than reporting
nothing, and `condition: service_healthy` will believe it.

## Reading the result

```bash
docker compose ps                       # the health column
docker inspect --format '{{json .State.Health}}' <container>
```

`inspect` gives the last few check results including their output and exit codes,
which is what you need when a check fails for a reason the container logs never
show — the check's own stdout does not go to `docker compose logs`.

## Podman

🔴 **Podman drives healthchecks from systemd timers**, not from a long-lived daemon
([Phase 3, page 11](../../phase-3-dockerfile/11-healthcheck.md)). Two practical
consequences:

- **A rootless container without linger can stop being checked** when the user's
  session ends, so a container's health can silently freeze at its last value.
- **`podman healthcheck run <container>`** exists to trigger a check by hand, which
  is the debugging entry point Docker has no direct equivalent for.

Whether `condition: service_healthy` is honoured at all depends on the compose
provider ([page 15](../15-podman-compose.md)), not on Podman's healthcheck support.

## Gotchas

**Symptom:** A service sits `unhealthy` from the moment it starts, then recovers.
**Cause:** `start_period` defaults to 0, so warm-up failures counted against
`retries` immediately.
**Fix:** Set a `start_period` that covers a realistic cold boot, and pair it with a
short `start_interval` so readiness is still detected quickly.

**Symptom:** The check never runs and the container is immediately unhealthy.
**Cause:** `CMD` form with all the arguments in one string, so the exec finds no such
binary — or a binary that is not in the image at all (`curl` is absent from most
slim and Alpine images).
**Fix:** Split `CMD` arguments into separate list items, or use `CMD-SHELL`. Verify
the binary exists in *that* image; `wget --spider` is often available where `curl`
is not, and a language-native one-liner needs nothing extra.

**Symptom:** A wedged service stays healthy for a minute and a half.
**Cause:** The default 30s `timeout` with 3 retries — the check blocks rather than
failing fast.
**Fix:** A `timeout` of a few seconds. A readiness check that legitimately takes
more than a second or two is testing too much.

**Symptom:** Every replica of the API went unhealthy at the same moment.
**Cause:** The API's healthcheck queries the database, so a database blip fails
every replica simultaneously.
**Fix:** Check only what this container itself must serve. Dependency health is
`depends_on`'s job at startup and the application's job at runtime.

## Interview questions

**★ What are the healthcheck defaults, and why are they bad?**
`interval` 30s, `timeout` 30s, `start_period` 0s, `retries` 3. The `timeout` is the
worst: a hung service can keep serving for roughly 90 seconds before it is marked
unhealthy. The `start_period` of 0 is the second worst, because warm-up failures
count immediately, so slow-starting services flap on boot.

**★ What do `start_period` and `start_interval` do together?**
`start_period` is a grace window in which failures do not count toward `retries`;
`start_interval` is how often checks run *inside* that window. Setting a generous
period with a short interval means a service is detected as healthy within seconds
of actually being ready, while still tolerating a slow cold start — which removes
the usual trade-off between fast detection and a check that hammers a healthy
service forever.

**★ What is the difference between `CMD` and `CMD-SHELL` in `test`?**
`CMD` executes the command directly with no shell, so each argument must be a
separate list item and there are no pipes, variables or `&&`. `CMD-SHELL` runs the
string through `/bin/sh`. A bare string is treated as `CMD-SHELL`. The classic
failure is `["CMD", "pg_isready -U postgres"]`, which looks for a binary whose name
contains spaces.

**How do you turn off a healthcheck an image ships with?**
`healthcheck: {disable: true}`, or equivalently `test: ["NONE"]`. What you must not
do is replace it with something that always succeeds — that reports healthy rather
than reporting nothing, and anything gating on `condition: service_healthy` will
act on the lie.

**Where do you see why a healthcheck failed?**
`docker compose ps` shows the state; `docker inspect` on the container shows
`.State.Health` including the last checks' output and exit codes. The check's own
output does not appear in `docker compose logs`, which is why a failing check often
looks like it produced nothing.

**Should an API's healthcheck test the database connection?**
No. If it does, a single database blip marks every API replica unhealthy at once —
you have coupled a dependency failure into a fleet-wide one. Check that this
container can serve; let `depends_on` handle startup order and the application
handle runtime reconnection.

---

← Topic index: [Healthchecks in Compose](README.md) · Next → [Checks that are actually true](02-checks-that-are-true.md)
