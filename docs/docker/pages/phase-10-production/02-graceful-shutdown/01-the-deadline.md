---
title: "The deadline"
sidebar_label: "01 · The deadline"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/),
> [docker container run — `--stop-timeout`, `--stop-signal`](https://docs.docker.com/reference/cli/docker/container/run/),
> the [Compose file reference — `stop_grace_period`, `stop_signal`](https://docs.docker.com/reference/compose-file/services/),
> [Dockerfile `STOPSIGNAL`](https://docs.docker.com/reference/dockerfile/#stopsignal),
> [podman-stop(1)](https://docs.podman.io/en/latest/markdown/podman-stop.1.html) and
> [systemd-system.conf(5)](https://www.man7.org/linux/man-pages/man5/systemd-system.conf.5.html).
> **No sandbox** — no console output on this page.

**`SIGTERM` is not a request to stop. It is the start of a countdown, and
graceful shutdown is whatever you can finish before it runs out.** Every design
decision on this page follows from the fact that the deadline is fixed by
somebody else and `SIGKILL` at the end of it is not negotiable.

[Topic 01](../01-pid-1/README.md) was about the signal *arriving*. This one is
about what your process owes once it has.

## The budget, and who sets it

The grace period is not a property of your application. It is set by whatever
stops the container, and the four things that stop containers disagree about the
default:

| Stopper | Knob | Default |
|---|---|---|
| `docker stop` / `podman stop` | `-t` / `--timeout` | **10 s** (Linux; 30 s for Windows containers) |
| `docker run` at creation | `--stop-timeout` | none — falls back to the stopper's |
| Compose | `stop_grace_period` on the service | **10 s** |
| systemd (Quadlet, or a unit wrapping the engine) | `TimeoutStopSec` | **90 s** from `DefaultTimeoutStopSec` |

Two consequences worth internalising:

- **The same image gets a different budget depending on how it is run.** Ten
  seconds under Compose, ninety under systemd, and whatever your orchestrator
  says elsewhere. A shutdown routine that needs twelve seconds works in one place
  and truncates in the other, with no code change between them.
- **Raising the budget is a real option and an under-used one.** If draining
  genuinely takes twenty seconds, `stop_grace_period: 30s` is a legitimate answer.
  What is not legitimate is needing twenty and being given ten.

## Which signal you get

The default is `SIGTERM`, and three places can change it:

```dockerfile
STOPSIGNAL SIGQUIT              # baked into the image
```

```yaml
services:
  web:
    stop_signal: SIGQUIT        # Compose
    stop_grace_period: 30s
```

```bash
docker run --stop-signal=SIGQUIT nginx
```

The reason this exists is that "graceful" is spelled differently by different
software. nginx treats `SIGTERM` as *fast shutdown* and `SIGQUIT` as *graceful
shutdown*; sending the wrong one gives you an abrupt stop that looks like a
crash. Match the signal to what the program documents, then handle that signal.

⛔ **Nothing changes the `SIGKILL` at the end.** `STOPSIGNAL`, `--stop-signal`
and `stop_signal` choose the *first* signal only. That is exactly what makes
`stop` reliable, and it is why the deadline is real
([Phase 1 — stop is two signals](../../phase-1-running-containers/08-stop-is-two-signals.md)).

## The four steps, in this order

1. **Stop advertising yourself as ready.** Fail the readiness signal — the
   healthcheck endpoint an orchestrator or load balancer polls — *before* you
   stop accepting connections.
2. **Stop accepting new work.** Close the listening socket; stop pulling from the
   queue; stop the cron-ish timers.
3. **Finish what is in flight**, with a hard cap well inside the budget.
4. **Release, then exit 0.** Close database pools, flush logs and metrics, then
   let the process end.

### Why step 1 comes before step 2

This is the ordering people get wrong, and it is the reason "we do graceful
shutdown" and "deploys still produce a burst of 502s" are said by the same team.

Nothing tells your load balancer that a container is stopping. It finds out by
**failing to reach you**, or by a health check that has not run yet. So the
window between "you closed the listener" and "the balancer noticed" is a window
where traffic is still being routed to a socket that is gone — connection
refused, and a 502 for a request that never touched your code.

Failing readiness first closes that window from the other end: the balancer
removes you while you are still able to serve, and only then do you stop
listening. In a container that usually means a flag your health endpoint reads:

```js
let shuttingDown = false;
app.get('/healthz', (_req, res) =>
  res.status(shuttingDown ? 503 : 200).send(shuttingDown ? 'draining' : 'ok'));
```

Then wait long enough for at least one health-check interval before step 2. That
wait is dead time inside your budget, which is the other reason to know what the
budget is.

⚠️ **Docker's own `HEALTHCHECK` will not do this for you.** It reports; it does
not route ([Phase 3 — HEALTHCHECK](../../phase-3-dockerfile/11-healthcheck.md)),
and there is no built-in load balancer to remove you from. The pattern matters
because something in front of the container — nginx, a cloud load balancer, an
orchestrator — is doing the routing, and it is *that* thing which must be told.
The liveness-versus-readiness distinction is
**09 · Healthchecks in production** *(not written yet)*.

## What graceful shutdown is not

**It is not "finish everything".** It is bounded work inside a deadline that
someone else chose. Anything that cannot reliably finish in the budget must be
made *resumable* rather than made slower:

- A long job should be checkpointed, or acknowledged only on completion so the
  queue redelivers it.
- A multi-step write should be a transaction, so a `SIGKILL` mid-way leaves
  nothing half-applied.
- An in-progress upload is better restarted by the client than held onto for
  forty seconds by a container that is going to be killed anyway.

**It is not a substitute for being killable.** `SIGKILL` still arrives on a
timeout, an OOM kill (**03 · Resource limits** *(not written yet)*), a hardware
failure or a `docker kill`. Graceful shutdown reduces how often you lose
in-flight work; it never reduces it to zero. If losing that work is unacceptable,
the fix is at-least-once delivery and idempotent handlers, not a longer grace
period.

**It is not free of the PID 1 rules.** All of this assumes the signal reaches
your code at all. If PID 1 is a shell, none of the steps below ever run, and the
symptom is identical to having written no handler — see
[topic 01](../01-pid-1/01-what-the-kernel-does.md).

## Exit codes are your telemetry for this

You can tell whether shutdown works without instrumenting anything, because the
exit code already says
([Phase 1 — exit codes](../../phase-1-running-containers/09-exit-codes.md)):

| Exit code | What happened |
|---|---|
| **0** | Your handler ran and the process ended on its own terms |
| **143** | 128 + 15 — the process died *of* `SIGTERM` with no handler of yours |
| **137** | 128 + 9 — `SIGKILL`: the deadline expired, or an OOM kill |

**A fleet where every stop reports 0 has working shutdown. One reporting 143 has
none. One reporting 137 has a handler that does not finish** — and that third
case is the interesting one, because it is invisible in code review and obvious
in `docker inspect`.

```bash
docker inspect --format '{{.State.ExitCode}} oom={{.State.OOMKilled}}' api
```

## Podman

The mechanics are the same — `podman stop -t`, `--stop-signal`, `STOPSIGNAL` from
the image. The difference is who enforces the deadline and what the default is:
with no daemon, `conmon` sends the signal per container, and under **Quadlet**
(Phase 11) it is systemd's `TimeoutStopSec` that decides, defaulting to **90 s**
rather than 10. A shutdown routine tuned to Compose's ten seconds is not wrong
there, just no longer the binding constraint — and one tuned to ninety will be
truncated the moment the same image is run by `docker stop`.

## Gotchas

**Symptom:** Deploys are clean in staging (Compose) and produce 502s in
production (systemd/Quadlet), or the reverse.
**Cause:** Different grace periods — 10 s versus 90 s — for the same image.
**Fix:** Set the budget explicitly wherever the container runs, and size the
shutdown routine to the *smallest* one it will ever get.

**Symptom:** Graceful shutdown is implemented, and deploys still drop requests
with connection-refused.
**Cause:** The listener closed before anything upstream knew to stop routing.
**Fix:** Fail readiness first, wait at least one health-check interval, then
close the listener.

**Symptom:** `docker stop` on nginx returns instantly but in-flight requests are
cut off.
**Cause:** nginx reads `SIGTERM` as *fast* shutdown; its graceful signal is
`SIGQUIT`.
**Fix:** `STOPSIGNAL SIGQUIT` in the image, or `stop_signal: SIGQUIT` in Compose.

**Symptom:** Every container exits 137 on deploy, and the logs show the shutdown
routine starting but never finishing.
**Cause:** The routine needs longer than the grace period — usually a drain with
no cap, or a pool close that waits on an in-flight query.
**Fix:** Cap the drain with a timer well inside the budget, or raise the budget
deliberately with `stop_grace_period`. Not both by accident.

## Interview questions

**★ What does graceful shutdown mean for a containerised service?**
On `SIGTERM`: stop advertising readiness, stop accepting new work, finish what is
in flight under a hard cap, release resources, exit 0 — all inside a grace period
you do not control, after which `SIGKILL` is unconditional.

**★ Why fail the health check before closing the listening socket?**
Because nothing tells the load balancer you are stopping; it discovers it by
failing to connect. Failing readiness first lets it remove you while you can
still serve, closing the window in which it routes traffic to a socket that no
longer exists.

**★ How long do you have, and what sets it?**
Ten seconds by default for `docker stop` and Compose's `stop_grace_period`, and
90 s under systemd's `DefaultTimeoutStopSec` — so the same image gets different
budgets depending on how it is run. Size the routine to the smallest budget it
will ever see, or set the budget explicitly everywhere.

**Can you avoid `SIGKILL` entirely by handling `SIGTERM` properly?**
No. The kill after the timeout is unconditional, and OOM kills and `docker kill`
bypass the sequence entirely. Handling `SIGTERM` reduces how often you lose
in-flight work; only idempotent handlers and at-least-once delivery make losing
it survivable.

**A container exits 137 on every deploy. Name three causes and how you tell them
apart.**
The stop timeout expiring after an ignored or over-long `SIGTERM`, an OOM kill,
or an explicit `docker kill`. `.State.OOMKilled` in `docker inspect` separates
the OOM case; whether your shutdown logs appear at all separates "no handler"
from "handler too slow".

**Why would you change `STOPSIGNAL`?**
Because the program's graceful signal is not `SIGTERM` — nginx uses `SIGQUIT`
for graceful shutdown and treats `SIGTERM` as fast shutdown. Changing it only
changes the first signal; the `SIGKILL` at the end of the grace period is
unaffected.

---

[Topic index](README.md) · [02 · Doing it in a real service](02-doing-it-in-a-real-service.md) →
