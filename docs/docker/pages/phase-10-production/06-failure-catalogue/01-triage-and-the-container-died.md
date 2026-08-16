---
title: "Triage, and the failures that kill the container"
sidebar_label: "01 · Triage, and the container died"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker inspect](https://docs.docker.com/reference/cli/docker/inspect/),
> [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/),
> [docker system events](https://docs.docker.com/reference/cli/docker/system/events/),
> [Docker Hub — usage and pull limits](https://docs.docker.com/docker-hub/usage/pulls/)
> (**100 pulls per 6 hours** unauthenticated *"per IPv4 address or IPv6 /64 subnet"*, **200**
> for an authenticated Personal account, unlimited on paid plans, HTTP **429** on refusal),
> [Docker — restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/)
> and [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.html).
> **No sandbox** — no console output on this page.

**Almost every production container incident is one of about a dozen things, and
the evidence identifying which is already on disk before you start guessing.**
This topic is that list. This chunk covers the half where the container is dead;
the [next](02-still-running-and-useless.md) covers the half where it is running
and useless, which is harder.

## Triage, in order, before any hypothesis

```bash
docker ps -a --filter name=api                                        # state, and how many restarts
docker inspect --format '{{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} restarts={{.RestartCount}}' api
docker logs --tail 200 --timestamps api
docker events --since 30m --filter container=api                      # oom, die, health_status, kill
df -h /var/lib/docker && docker system df                             # the host, not the container
```

Four fields answer most of it before you have opened a log:

| Field | Reads as |
|---|---|
| `ExitCode` | **Which layer failed** — 125/126/127 engine or command, 137/143 signal |
| `OOMKilled` | Memory limit, or not |
| `RestartCount` | Whether this has been happening quietly for hours |
| `Status` | `exited`, `restarting` (a live crash loop) or `running` |

🔴 **`RestartCount` is the field people skip and it is the one that reframes the
incident.** A container that "just started failing" with a restart count of 4,000
has been failing since the deploy; you are looking at the tail of a long problem,
not the start of a new one.

## 1 · The OOM kill

**Signature:** exit **137**, `OOMKilled=true`, no shutdown log lines, host memory
looks fine.

The cgroup hit its limit and the kernel `SIGKILL`ed the largest process in it —
your application, at PID 1, so the container ended
([03 · Resource limits](../03-resource-limits/01-memory-the-limit-that-kills.md)).
Nothing is catchable, so the application logs nothing.

**Distinguish a leak from a bad limit by the shape:** a leak climbs over hours and
dies at a predictable uptime; an undersized limit dies under a particular request
or at a particular concurrency, often within minutes of a traffic change. The
restart count with timestamps tells you which.

## 2 · Zombie PID exhaustion

**Signature:** the container is *alive*, then everything fails with "resource
temporarily unavailable"; CPU and memory are idle; `ps` inside shows a wall of
`<defunct>`.

Orphans reparented to a PID 1 that does not reap them
([01 · PID 1](../01-pid-1/01-what-the-kernel-does.md)). It only happens when
something inside forks and abandons children, which is why it is rare and
therefore unfamiliar when it arrives.

**The fix is `--init` or a baked-in tini**; the *diagnostic* is `--pids-limit`,
which converts a slow host-wide leak into a bounded, obvious container-local
failure.

## 3 · The ignored `SIGTERM`

**Signature:** exit **137**, `OOMKilled=false`, exactly ten seconds per container
on every deploy, and in-flight requests dropped each time.

PID 1 has no handler, so the kernel discarded the signal and the engine escalated
([02 · Graceful shutdown](../02-graceful-shutdown/01-the-deadline.md)). This one
is not an incident — it is a permanent tax that only becomes an incident when a
deploy coincides with load.

**Exit 143 is the near miss:** the process died *of* `SIGTERM` rather than
handling it. Cleaner than 137, still no draining.

## 4 · The silent crash loop

**Signature:** `Status=restarting`, a large `RestartCount`, the service mostly
works, and nothing alerted.

`restart: always` does exactly what it promises and nothing more: it restarts.
It does not tell anyone, and Docker's exponential backoff makes a loop look
calmer over time rather than louder
([Phase 1 — restart policies](../../phase-1-running-containers/12-restart-policies.md);
[07 · Restart policies as supervision](../07-restart-as-supervision.md)).

⚠️ **`docker logs` shows the current run.** In a loop that is the one that has not
failed yet, which is why the loop looks unexplained. `docker logs` on the exited
container id, `docker events`, or your log pipeline hold the run that actually
died.

## 5 · The image pull that fails at the worst moment

**Signature:** the container never starts; the engine reports `toomanyrequests`
with HTTP **429**, or an authentication or not-found error.

Docker Hub's limits are the common case, and they are per source address:

| Who | Limit |
|---|---|
| Unauthenticated | **100 pulls / 6 hours**, per IPv4 address **or IPv6 /64 subnet** |
| Authenticated, Personal | **200 pulls / 6 hours** |
| Paid plans | Unlimited |

The trap is the phrase *per IP address*. A CI fleet, a NAT gateway or an office
all share one, so your limit is consumed by builds and colleagues you never see —
and it is exhausted precisely when you scale out, replace a node or run a big
pipeline, which is to say during an incident or a deploy.

**What actually fixes it**, in order of leverage:

- **Authenticate the engine**, everywhere including CI, so pulls count against an
  account rather than an address.
- **Run a pull-through cache or mirror** so a fleet pulls a layer once.
- **Do not pull on every start.** `pull_policy: missing` in Compose, and an image
  the host already has, mean a restart during an incident does not depend on a
  registry being reachable.
- **Reference by digest** for anything that must be reproducible
  ([Phase 2 — tags versus digests](../../phase-2-images-and-registries/02-tags-vs-digests.md)).

⚠️ **The registry is a run-time dependency of every container start**, not just of
your build. Any design where recovery requires a fresh pull has made an external
service part of your availability.

## 6 · It never ran at all — 125, 126, 127

**Signature:** the container exits immediately, `docker logs` is empty, and there
is a message from the CLI rather than from your application.

| Code | Meaning |
|---|---|
| **125** | The engine refused — bad flag, port conflict, missing mount |
| **126** | The command was found but is not executable |
| **127** | The command does not exist in the image |

`docker logs` being empty is itself the signal: your process never started, so it
never wrote anything. **127 in particular is usually a multi-stage build that did
not copy the binary, or a path that differs from the developer's machine**
([Phase 1 — exit codes](../../phase-1-running-containers/09-exit-codes.md)).

## Podman

The catalogue is the same; two of the readings differ:

- **No daemon**, so there is no `dockerd` log to consult and no daemon-wide
  event stream. Under Quadlet (Phase 11) the equivalent evidence is
  `journalctl -u <unit>`, and a crash loop appears as systemd restarting the unit
  with its own backoff.
- **Restart policies are not re-asserted by a daemon after logout or reboot** —
  `loginctl enable-linger` and a systemd unit are what make "it comes back" true,
  which is why a rootless container that vanished overnight is a Podman-specific
  entry in this catalogue rather than a bug.

## Gotchas

**Symptom:** The service was fine yesterday and is failing today, with no deploy.
**Cause:** Frequently a limit that was always marginal — memory, PIDs, or a pull
quota — crossed by a change in traffic rather than in code.
**Fix:** Read `RestartCount` and the timestamps first. "Nothing changed" almost
always means nothing *in the repository* changed.

**Symptom:** `docker logs` shows a healthy start-up and nothing about the crash.
**Cause:** You are reading the current run of a restarting container.
**Fix:** Inspect the exited container, or read `docker events`. The failing run is
not the one you are looking at.

**Symptom:** Deploys fail intermittently with `toomanyrequests`.
**Cause:** Unauthenticated pulls sharing a public address with CI or an office
network.
**Fix:** Authenticate the engine, add a pull-through cache, and stop pulling on
every start.

**Symptom:** Exit 137 and everyone assumes memory.
**Cause:** 137 is `SIGKILL`, and a stop timeout produces it just as readily as an
OOM kill.
**Fix:** `OOMKilled` settles it in one command. Assuming memory sends you to
tune a limit that was never the problem.

## Interview questions

**★ Walk me through diagnosing a container that keeps dying.**
State, exit code, `OOMKilled` and `RestartCount` from `docker inspect` first —
those four separate memory from signals from engine-level start failures and tell
you whether it is new. Then the logs of the **exited** run, not the current one,
then `docker events`, then the host's disk and memory. The evidence is on disk
before any hypothesis.

**★ Why is a crash loop dangerous even when the service appears to work?**
Because `restart: always` restarts and does not alert, and backoff makes the loop
quieter over time rather than louder. It can run for weeks, hiding a bug and
dropping every in-flight request at each restart, until something else makes it
visible.

**★ What are Docker Hub's pull limits and why do they bite in production?**
100 pulls per 6 hours unauthenticated, counted per IPv4 address or IPv6 /64
subnet, and 200 for an authenticated Personal account; over that the registry
returns 429. It bites because the limit is shared by everyone behind an address
and is exhausted exactly when you scale out or replace a node — so the registry
becomes a run-time dependency of recovery.

**`docker logs` is empty and the container exited immediately. What does that tell
you?**
That the process never ran. That points at 125 (the engine refused — bad flag,
port conflict, missing mount), 126 (found but not executable) or 127 (not in the
image at all), and the CLI's own error message is the evidence rather than the
container's.

**How do you tell a memory leak from an undersized memory limit?**
By shape. A leak climbs over hours and dies at a fairly predictable uptime; an
undersized limit dies under a particular request or concurrency, close to a
traffic change. Restart timestamps distinguish them without any profiling.

**Which of these look different under Podman?**
The evidence, not the failures. There is no daemon log or daemon-wide event
stream — `journalctl -u <unit>` under Quadlet is the equivalent — and restart
policies are not re-asserted after logout or reboot without lingering and a
systemd unit, which adds "it did not come back" as its own entry.

---

[Topic index](README.md) · [02 · The failures that leave it running](02-still-running-and-useless.md) →
