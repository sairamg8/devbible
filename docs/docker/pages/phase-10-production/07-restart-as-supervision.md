---
title: "Restart policies as supervision"
sidebar_label: "07 · Restart policies as supervision"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — start containers automatically](https://docs.docker.com/engine/containers/start-containers-automatically/)
> (*"A restart policy only takes effect after a container starts successfully … up for at
> least 10 seconds"*; *"If you manually stop a container, the restart policy is ignored until
> the Docker daemon restarts or the container is manually restarted"*),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> the [Compose file reference](https://docs.docker.com/reference/compose-file/services/),
> [podman-run(1) — `--restart`](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).
> **No sandbox** — no console output on this page.

**A restart policy restarts. That is the whole of what it does, and it is much
less than supervision.** It does not decide whether restarting is a good idea,
does not order startup against dependencies, does not escalate, and — the part
that costs people most — **does not tell anyone**.

[Phase 1](../phase-1-running-containers/12-restart-policies.md) covered the flags.
This page is about what to do with them once real traffic depends on the answer.

## The four policies

```bash
docker run --restart=unless-stopped myimage
docker run --restart=on-failure:5 myjob
```

| Policy | Behaviour |
|---|---|
| `no` | **Default.** Never restarted automatically |
| `on-failure[:max]` | Restart only on a **non-zero** exit; optionally give up after `max` attempts |
| `always` | Always restart when it stops — **including after the daemon restarts** |
| `unless-stopped` | Like `always`, except a container **you stopped stays stopped** across a daemon restart |

Two documented details decide most real behaviour:

- **A policy only takes effect after the container has started successfully**,
  which means being *"up for at least 10 seconds"*. A container that dies in two
  seconds every time is failing before the policy considers it started — which is
  why a container in a fast crash loop can behave differently from one that fails
  after a minute.
- **A manual stop suspends the policy** until the daemon restarts or you start
  the container yourself. That is what makes `docker stop` usable during an
  incident without fighting the engine.

### `always` versus `unless-stopped`

They are identical until the one moment they are not: you stop a container
deliberately, then the daemon restarts (a host reboot, an engine upgrade).
`always` brings it back; `unless-stopped` respects your decision.

**Prefer `unless-stopped` for long-running services** — it is the one that treats
an operator's action as intent. Keep `always` for things that genuinely must
exist whenever the engine does.

### `on-failure` is for work with an end

`on-failure` is the right choice for a job, a migration or a batch task, because
those exit 0 when they succeed and should not be restarted for succeeding. For a
server, a zero exit is nearly always a bug or a shutdown you requested — so
`on-failure` and `unless-stopped` differ mainly in whether a clean exit brings the
service back, and for a server you usually want it back.

⚠️ **`--restart` cannot be combined with `--rm`.** They are contradictory
instructions, and the engine rejects the pair rather than choosing.

## What restarting covers, and what it merely hides

| Covers well | Hides badly |
|---|---|
| A genuine one-off crash — a bad input, a transient panic | A **deterministic** crash, restarted forever |
| A host reboot, with `always`/`unless-stopped` and the engine enabled at boot | A **dependency race**, where the app crashes until the database is ready |
| A dependency that is briefly unavailable at startup | A **memory leak**, which now looks like periodic "self-healing" |

The middle row is the one that turns into an outage later. A container that
crash-loops until Postgres accepts connections *works* — the stack comes up, the
restart count is high and nobody looks — right until a slower start, a bigger
dataset or a cold cache extends the window past the point where retries end. The
honest fix is dependency handling in the application (retry with backoff, health
gates), not a restart policy that makes the race invisible.

🔴 **The engine backs off between attempts, so a crash loop gets quieter over
time rather than louder** — the opposite of what you want from a signal. Do not
quote specific backoff figures: the current documentation states the 10-second
stability rule but not the delay schedule, so treat the direction as the fact and
the numbers as unspecified.

## The half that is actually missing: nobody is told

This is the practical gap between a restart policy and supervision. `RestartCount`
climbs, backoff smooths the shape, logs from the failing run are replaced by logs
from the current one, and the dashboard is green because the container is `Up`.

What to put in place instead, none of which the engine does for you:

- **Alert on `RestartCount` increasing**, not on a container being down. Down is
  rare and brief; restarting forever is the real state.
- **Consume `docker events`** — `die`, `restart`, `oom` and `health_status` are
  emitted whether or not anything listens.
- **Ship logs off the host**, so the run that died survives being replaced
  ([04 · Logs](04-logs-to-stdout/README.md)).
- **Cap the retries for jobs** with `on-failure:N`, so a broken migration stops
  rather than hammering a database indefinitely.

## In Compose, and under systemd

```yaml
services:
  api:
    restart: unless-stopped        # the plain, single-host form
```

⚠️ **`restart:` and `deploy.restart_policy:` are different fields.** The short
`restart:` is what a plain `docker compose up` honours; `deploy.restart_policy`
belongs to the deploy section and is intended for swarm-style orchestration. Using
the second and expecting the first is a quiet way to end up with no policy at all.

Under systemd — which is where a single host usually ends up — supervision is the
unit's job and the engine's policy becomes redundant or actively confusing, since
two supervisors will both try to own the container's lifecycle. Pick one. That
argument is **14 · Running containers under systemd** *(not written yet)* and,
for Podman, Quadlet in Phase 11.

## Podman

`--restart` accepts the same values, and then the daemonless design changes what
it can promise:

- **There is no daemon to re-assert policies after a reboot or after you log
  out.** A `--restart=always` container does not come back on boot by itself.
- Podman ships **`podman-restart.service`**, a systemd unit that restarts
  containers after a reboot — the missing piece, made explicit.
- For anything that matters, the supported answer is **Quadlet**: a `.container`
  unit whose `[Service] Restart=` is systemd's, with proper ordering,
  dependencies and journal integration. `podman generate systemd` still exists,
  is deprecated, and should not appear in new work.
- **Rootless containers also need `loginctl enable-linger`**, or the user's
  session — and its containers — end at logout.

🔴 **"It did not come back after the reboot" is the single most common Podman
surprise**, and it is not a bug: it is the daemonless design telling you that
boot-time supervision belongs to systemd.

## Gotchas

**Symptom:** A container restarted thousands of times and nobody noticed.
**Cause:** The policy restarts and does not alert, and backoff makes the loop
progressively quieter.
**Fix:** Alert on `RestartCount` and on `docker events`. "Container is up" is not
a health signal.

**Symptom:** A stopped container came back after a host reboot.
**Cause:** `--restart=always` reapplies after the daemon restarts, regardless of
your having stopped it.
**Fix:** `unless-stopped`, which treats a manual stop as intent.

**Symptom:** A batch job ran repeatedly and corrupted its output.
**Cause:** `always` on something that exits 0 when finished — succeeding was read
as stopping.
**Fix:** `on-failure:N` for anything with an end.

**Symptom:** Under Podman, containers with `--restart=always` are gone after a
reboot.
**Cause:** No daemon re-asserts the policy.
**Fix:** `podman-restart.service`, or a Quadlet unit — plus
`loginctl enable-linger` for rootless.

## Interview questions

**★ What is the difference between `always` and `unless-stopped`?**
Only what happens after a daemon restart to a container you stopped by hand:
`always` starts it again, `unless-stopped` leaves it stopped. For long-running
services `unless-stopped` is usually right, because it treats an operator's stop
as a decision.

**★ Why is a restart policy not supervision?**
Because it restarts and does nothing else — no dependency ordering, no
escalation, no notification. `RestartCount` climbs silently, backoff makes the
loop quieter, and the container's status stays `Up`, so a deterministic crash can
run for weeks without anyone being told.

**★ When would you use `on-failure` rather than `unless-stopped`?**
For work that has an end — a job, a migration, a batch task — because those exit
0 on success and must not be restarted for succeeding. `:max-retries` also stops
a broken job from hammering its dependencies indefinitely.

**Why might a restart policy appear not to apply at all?**
Because it takes effect only after the container has started successfully, meaning
up for at least ten seconds — so a container failing in two seconds is failing
before the policy considers it started. A manual stop also suspends the policy
until the daemon restarts.

**What breaks about restart policies under Podman?**
There is no daemon to re-assert them, so containers do not come back after a
reboot or after logout. `podman-restart.service` covers the reboot case, Quadlet
is the supported general answer, and rootless additionally needs
`loginctl enable-linger`.

**A service crash-loops until its database is ready, then runs fine. Is that
acceptable?**
It works and it hides a dependency race. When startup slows — a bigger dataset, a
cold cache, a slower host — the window can outlast the retries and the failure
appears suddenly and inexplicably. The fix belongs in the application's
connection handling, not in the restart policy.

---

← Prev: [The production failure catalogue](06-failure-catalogue/README.md) · Index: [Phase 10](README.md) · Next → **Log drivers and rotation** *(not written yet)*
