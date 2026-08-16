---
title: "The failures that leave it running"
sidebar_label: "02 · Still running, and useless"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — configure logging drivers](https://docs.docker.com/engine/logging/configure/)
> (`json-file` performs no rotation by default), [docker system df / prune](https://docs.docker.com/reference/cli/docker/system/df/),
> [Docker — container networking and embedded DNS](https://docs.docker.com/engine/network/),
> [Dockerfile `HEALTHCHECK`](https://docs.docker.com/reference/dockerfile/#healthcheck),
> [time_namespaces(7)](https://man7.org/linux/man-pages/man7/time_namespaces.7.html)
> (*"time namespaces do not virtualize the `CLOCK_REALTIME` clock"*),
> [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.html) and
> [podman-network(1)](https://docs.podman.io/en/latest/markdown/podman-network.1.html).
> **No sandbox** — no console output on this page.

**The container is `Up`, the health check is green, the restart count is zero,
and the service is broken.** These are the failures with no exit code to read,
which is why they take longer to find than the ones in the
[previous chunk](01-triage-and-the-container-died.md) — and why each has a
distinctive signature worth memorising.

## 7 · The disk filled, and everything failed at once

**Signature:** unrelated containers fail simultaneously; writes error with "no
space left on device"; the engine itself may stop responding.

This is the highest-blast-radius entry in the catalogue, because `/var/lib/docker`
is shared by everything on the host. Four contributors, roughly in order of how
often they are the cause:

| Consumer | Why it grows | Check |
|---|---|---|
| **Container logs** | `json-file` performs **no rotation by default** | the driver's files under `/var/lib/docker/containers/` |
| **Build cache** | Every build adds to it and nothing prunes it | `docker system df` |
| **Images** | Old tags nobody removed; each deploy adds one | `docker images` |
| **Volumes** | Anonymous volumes accumulate silently | `docker volume ls -f dangling=true` |

```bash
docker system df -v                      # the breakdown, per kind
docker system prune                      # images, containers, networks, build cache
docker system prune --volumes            # ⛔ also deletes unused volumes — data
```

⛔ **`--volumes` is the flag that deletes data**, and "unused" means "not attached
to a running container right now", which includes the database volume of a stack
that happens to be down. Never reach for it during an incident.

**The fix is preventive:** set log rotation at the daemon level so no container
can opt out by omission, and prune images and build cache on a schedule rather
than at 3am. The detail is
[08 · Log drivers and rotation](../08-log-drivers-and-rotation.md) and
[13 · Disk growth](../13-disk-growth.md).

## 8 · DNS

**Signature:** intermittent "getaddrinfo ENOTFOUND" or connection timeouts to a
service that exists; works from one container and not another; works after a
restart, then stops.

Three distinct causes get called "DNS":

- **The wrong network.** Containers on the **default bridge** get no name
  resolution between them; only a **user-defined network** provides the engine's
  embedded DNS resolving service names. A container that cannot find `db` is
  usually a container on the wrong network, not a resolver fault.
- **Resolution of *external* names** inside the container comes from the
  `/etc/resolv.conf` the engine writes, derived from the host's. A host whose
  resolver changed — VPN, DHCP, a laptop moving networks — leaves running
  containers pointed at a nameserver that no longer answers, which is exactly the
  "worked this morning" shape.
- **Search domains and short names.** A short name that resolves on the host may
  resolve differently, slowly, or not at all inside the container, because the
  search list is not the same.

**Test from inside the container, not from the host** — they are different
resolvers with different views:

```bash
docker exec api getent hosts db          # embedded DNS: service name
docker exec api cat /etc/resolv.conf     # what it was actually told to use
```

⚠️ **Under rootless Podman, name resolution is `aardvark-dns` with `netavark`**,
a different implementation with different error strings. A message you have never
seen from Docker is not a new class of failure — it is the same failure spelled
differently, and Phase 11 collects the differences.

## 9 · Clock skew

**Signature:** TLS handshakes fail with "certificate is not yet valid"; JWTs are
rejected as expired or not-yet-valid; signed requests to a cloud API are refused;
log timelines across services do not line up.

**A container cannot have its own wall clock.** `time_namespaces(7)` virtualises
`CLOCK_MONOTONIC` and `CLOCK_BOOTTIME` and explicitly *does not* virtualise
**`CLOCK_REALTIME`** — so the container's idea of "now" is the host's, always.
Two consequences that settle most confusion:

- **`TZ` changes the display, not the time.** Setting `TZ=Europe/London` affects
  formatting inside the container; the underlying instant is identical
  ([15 · Time, timezones and locales](../15-time-and-timezones.md)).
- **You cannot fix skew inside the container**, and should not be able to:
  setting the clock needs `CAP_SYS_TIME`, which is dropped by default precisely
  because doing so would change the **host's** clock and every other container
  with it. The fix is NTP on the host.

So "the container's clock is wrong" is always a host problem, and it is worth
recognising because the symptoms — expired-looking certificates and tokens —
point convincingly at authentication instead.

## 10 · Healthy but not serving, and its opposite

**Signature (a):** the health check is green; users get errors. **Signature (b):**
a dependency has a two-second blip and every replica is marked unhealthy at once.

Both come from checking the wrong thing, in opposite directions.

| Check | Answers | Fails when |
|---|---|---|
| `GET /` returning 200 from the framework | "the process is up" | The pool is exhausted, the queue consumer is wedged, the disk is full — **all still 200** |
| A check that queries the database | "the whole stack is up" | The database blips and **every replica** goes unhealthy together — a shared dependency turned into correlated failure |

The distinction that resolves it is **liveness versus readiness**: *should I be
restarted* is a different question from *should I be sent traffic*, and one
endpoint cannot answer both well. That is
[09 · Healthchecks in production](../09-healthchecks-in-production.md).

🔴 **And the fact this whole catalogue keeps returning to: Docker reports health;
it does not act on it.** `HEALTHCHECK` sets a status and emits a
`health_status` event, and nothing removes an unhealthy container from anything
— there is no built-in load balancer to remove it from. Something else must
consume the status
([Phase 3 — HEALTHCHECK](../../phase-3-dockerfile/11-healthcheck.md)).

## 11 · Throttled, not slow

**Signature:** p99 latency has a cliff at a suspiciously regular value; average
CPU looks healthy; adding replicas does not help.

The CFS quota is spent early in each period and every thread waits for the next
one ([03 · Resource limits](../03-resource-limits/02-cpu-and-pids.md)). It is in
this catalogue because it is the failure most often misread as an application
performance problem, and because the usual response — scaling out — multiplies
the number of throttled containers without changing any of them.

**The evidence is `nr_throttled` in the cgroup's `cpu.stat`, not `docker
stats`.**

## 12 · File descriptors and connections

**Signature:** "EMFILE: too many open files", or new connections refused while the
process is otherwise fine.

Every socket is a file descriptor, and the default per-process limit is easy to
cross with a connection-heavy service. `--ulimit nofile=…` raises it. The related
shape is **connections leaking** — a client library that never closes, a pool
without a maximum — where the limit is doing its job by making a leak visible.

⚠️ **Do not simply raise the limit and move on.** A limit that is hit twice a day
after being raised is a leak, and the next ceiling is the host's.

## What to have in place before you need it

The catalogue is only useful if the evidence survives the incident:

- **Log rotation at the daemon level**, so a full disk cannot be the first
  symptom.
- **Logs shipped off the host**, so a dead container's output outlives it
  ([04 · Logs](../04-logs-to-stdout/README.md)).
- **Alerting on restarts and on `health_status` events**, because the engine will
  restart forever without telling anyone.
- **Authenticated pulls and a local cache**, so recovery does not depend on a
  registry quota.
- **Limits set deliberately** — memory, PIDs, CPU — so failures are bounded and
  legible instead of host-wide.

## Gotchas

**Symptom:** Several unrelated services fail within a minute of each other.
**Cause:** The host, not the services — disk, memory or the engine itself. Shared
fate is the signature.
**Fix:** `df -h /var/lib/docker` and `docker system df` before touching any
individual container.

**Symptom:** A container reaches `db` from one host and not another, with the
same Compose file.
**Cause:** Default bridge versus user-defined network. Only the latter has the
embedded DNS that resolves service names.
**Fix:** An explicit user-defined network. Compose creates one by default, which
is why the failure usually appears in hand-rolled `docker run` commands.

**Symptom:** TLS and JWT failures across every service at once, all pointing at
authentication.
**Cause:** Host clock skew. The container's `CLOCK_REALTIME` is the host's, and
cannot differ.
**Fix:** NTP on the host. Nothing inside the container can help, and
`CAP_SYS_TIME` would be a much worse answer.

**Symptom:** The dashboard is green throughout an outage.
**Cause:** A health check answering "the process is up" for a service whose
dependencies are down.
**Fix:** Check the thing the request actually needs for readiness — and keep
liveness cheap, so a dependency blip does not restart everything at once.

## Interview questions

**★ A container is `Up`, healthy, and the service is broken. Where do you look?**
At what the health check actually asserts. A framework endpoint returning 200
proves the process is up and nothing else — the pool can be exhausted, the
consumer wedged, the disk full. Then at throttling, DNS and clock skew, none of
which produce an exit code.

**★ Why can a container's clock never be wrong on its own?**
Because time namespaces virtualise `CLOCK_MONOTONIC` and `CLOCK_BOOTTIME` but
explicitly not `CLOCK_REALTIME`, so wall-clock time is the host's. `TZ` changes
formatting only, and setting the clock would need `CAP_SYS_TIME` — dropped by
default because it would move the host's clock for everyone.

**★ The host ran out of disk. What filled it, and what do you run?**
Container logs first — `json-file` does not rotate by default — then build cache,
old images and dangling volumes. `docker system df -v` breaks it down and
`docker system prune` reclaims safely; **`--volumes` deletes data** and must not
be reflexive during an incident.

**Why does a health check that queries the database cause correlated failures?**
Because a shared dependency's blip marks every replica unhealthy simultaneously,
turning a brief degradation into a full outage. Liveness should be cheap and
local; only readiness should consider dependencies, and even then with hysteresis.

**Two containers cannot resolve each other by name. What is the most likely
cause?**
They are on the default bridge, which has no name resolution between containers.
The engine's embedded DNS only serves user-defined networks — which is why the
problem shows up in hand-written `docker run` commands and rarely under Compose.

**Latency has a hard p99 cliff and CPU looks fine. What is your first hypothesis?**
CFS throttling. The quota is consumed early in each period and threads wait for
the next one, so averages look healthy while the tail is dominated by waiting.
Check `nr_throttled`; adding replicas will not help.

---

← [01 · Triage, and the container died](01-triage-and-the-container-died.md) · [Topic index](README.md)
