---
title: "Log drivers and rotation"
sidebar_label: "08 · Log drivers and rotation"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — configure logging drivers](https://docs.docker.com/engine/logging/configure/)
> (blocking is the **default** delivery mode; `max-buffer-size` defaults to `1m`),
> [json-file driver](https://docs.docker.com/engine/logging/drivers/json-file/)
> (`max-size` **defaults to `-1` — unlimited**, `max-file` **defaults to `1`**, `compress`
> **`false`**; *"Existing containers don't use the new logging configuration
> automatically"*), [local driver](https://docs.docker.com/engine/logging/drivers/local/)
> (`max-size` **`20m`**, `max-file` **`5`**, compression **enabled by default**),
> [journald driver](https://docs.docker.com/engine/logging/drivers/journald/) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**Docker's default logging driver does not rotate, and that is how a host runs
out of disk.** Not a chatty application, not an unusual workload — the default
configuration, running long enough. This page is the arithmetic and the two
config files that prevent it.

## The defaults, side by side

| Option | `json-file` (**Docker's default**) | `local` (**recommended**) |
|---|---|---|
| `max-size` | **`-1`** — unlimited | **`20m`** |
| `max-file` | **`1`** | **`5`** |
| `compress` | **`false`** | **enabled** |
| Readable by `docker logs` | yes | yes |
| Format | JSON per line, general-purpose | compact, for the daemon's own use |

Read the first column again: **one file, no size limit, no compression.** A
service logging a modest 50 MB a day fills 18 GB in a year, on a partition shared
with every image, volume and build cache on the host — and when it fills,
everything on that host fails at once, not just the container that wrote it
([06 · The failure catalogue](06-failure-catalogue/02-still-running-and-useless.md)).

## Fixing it in two places

**Per container**, which is explicit and easy to forget:

```bash
docker run --log-driver local --log-opt max-size=10m --log-opt max-file=3 myimage
```

```yaml
services:
  api:
    logging:
      driver: local
      options: {max-size: "10m", max-file: "3"}
```

**As the daemon default**, which is the one that actually protects a host,
because it applies to containers whose author never thought about logging:

```json
// /etc/docker/daemon.json
{
  "log-driver": "local",
  "log-opts": {"max-size": "10m", "max-file": "3"}
}
```

🔴 **A daemon default is the only version of this that works**, since a
per-container setting protects only the containers you remembered. Set it when
you build the host, not after the first incident.

⚠️ **Changing the daemon default does not touch containers that already exist** —
the documentation is explicit that *"existing containers don't use the new
logging configuration automatically"*. It takes effect for **newly created**
containers, so the fix is only real after a recreate. On a host that is already
close to full, that ordering matters: change the config, then recreate, then
reclaim the old files.

## The arithmetic worth doing once

Your worst case per container is `max-size × max-file`, and the host's budget is
that times the number of containers:

| Setting | Per container | 20 containers |
|---|---|---|
| `10m × 3` | 30 MB | 600 MB |
| `100m × 5` | 500 MB | 10 GB |
| `json-file` default | **unbounded** | **the whole partition** |

Then ask the question that actually decides the numbers: **how far back do you
need to look on the host?** If logs are shipped elsewhere
([04 · Logs](04-logs-to-stdout/README.md)), the local copy only has to cover the
gap between an incident and reaching the aggregator — small is fine. If the host
copy *is* your log retention, the numbers must reflect that, and you should
recognise that you have made a single disk your logging system.

## Delivery mode: your logs can slow your application down

By default the container's write goes **straight to the driver, blocking** —
Docker documents *"direct, blocking delivery from container to driver"* as the
default. If the driver is slow (a remote endpoint, a saturated disk), that
backpressure reaches your application's `console.log`.

```bash
docker run --log-opt mode=non-blocking --log-opt max-buffer-size=4m myimage
```

Non-blocking puts a per-container buffer in between — `max-buffer-size` defaults
to **`1m`** — and makes the trade explicit: **the application keeps running, and
messages are dropped when the buffer is full.**

| Mode | Under a slow driver |
|---|---|
| `blocking` (default) | The application stalls. Nothing is lost |
| `non-blocking` | The application continues. Logs are silently lost |

There is no right answer, only a decision. For a user-facing service, dropping
logs is usually better than stalling requests; for an audit trail, it is not. What
is not acceptable is discovering the default by having a logging endpoint slow
down and finding your API latency rose with it.

## journald, and the systemd answer

With the `journald` driver — **Podman's default** — rotation is the journal's
problem and is already solved:

```ini
# /etc/systemd/journald.conf
SystemMaxUse=2G
SystemMaxFileSize=200M
```

That is a host-wide budget rather than a per-container one, which is a genuinely
different model: no container can be individually capped, but no container can
consume the disk either, and container output is queryable alongside everything
else with `journalctl`. On a systemd host running a handful of services, this is
usually the lower-maintenance choice — and under Quadlet (Phase 11) it is simply
what you get.

## The remote drivers

`syslog`, `fluentd`, `gelf`, `splunk` and the rest ship elsewhere, and change the
failure mode rather than removing it:

- **They do not rotate anything locally** — there is usually nothing local, except
  the **dual-logging cache** the engine keeps so `docker logs` still answers
  (`cache-max-size` `20m`, `cache-max-file` `5` by default).
- **They make the log pipeline a run-time dependency.** In `blocking` mode, an
  unreachable collector is backpressure into every container on the host.
- **`docker logs` may return nothing** if the cache is disabled, at exactly the
  moment the remote system is the thing that is broken.

⚠️ **Test the failure**, not the happy path: point the driver at something
unreachable and see whether your application stalls, drops or continues. That
behaviour is the whole reason to choose a mode.

## Podman

| | Docker | Podman |
|---|---|---|
| Default driver | `json-file` (**no rotation**) | **`journald`** |
| Rotation config | `daemon.json` `log-opts` | `journald.conf`, or `--log-opt` with `k8s-file` |
| Aliases | — | `json-file` is an alias for **`k8s-file`** |
| Where set globally | `/etc/docker/daemon.json` | `containers.conf` |

Podman's default is the safer one out of the box, precisely because the journal
already has a disk budget. The trade is that per-container limits are not the
natural unit — if you need one container capped independently, `k8s-file` with
explicit options is the route.

## Gotchas

**Symptom:** A host filled its disk; one container's log file is tens of
gigabytes.
**Cause:** `json-file` with its defaults: unlimited size, one file, no
compression.
**Fix:** Daemon-level `local` with `max-size`/`max-file`, then **recreate** the
containers — the new default does not apply to existing ones.

**Symptom:** Rotation was configured and the file kept growing.
**Cause:** The change was made in `daemon.json` but the container was never
recreated.
**Fix:** Recreate it. `docker inspect --format '{{.HostConfig.LogConfig}}'`
shows what the running container actually has.

**Symptom:** API latency rose when the logging backend got slow.
**Cause:** Blocking delivery is the default, so driver backpressure reaches the
application.
**Fix:** Decide deliberately — `mode=non-blocking` with a sized buffer, accepting
dropped messages, or keep blocking and treat the log pipeline as a hard
dependency.

**Symptom:** `docker logs` is empty while logs arrive fine in the aggregator.
**Cause:** A remote driver with the dual-logging cache disabled.
**Fix:** Leave the cache enabled unless the disk saving is genuinely needed — it
is what lets you read a container when the remote system is down.

## Interview questions

**★ What happens if you leave Docker's default logging configuration alone?**
`json-file` runs with `max-size` `-1`, `max-file` `1` and no compression — so a
single unbounded file grows until the partition is full, and then every container
on the host fails, not just the one that wrote it.

**★ How do you fix log rotation properly, and what is the catch?**
Set `log-driver` and `log-opts` in `/etc/docker/daemon.json` so the default
protects containers whose authors never considered it — `local`, or `json-file`
with `max-size` and `max-file`. The catch is that existing containers keep their
old configuration; the fix is only in force after they are recreated.

**★ What is the difference between blocking and non-blocking log delivery?**
Blocking is the default: the write goes straight to the driver, so a slow driver
becomes backpressure on the application. Non-blocking inserts a per-container
buffer (`max-buffer-size`, default 1 MB) and drops messages when it is full. You
are choosing between stalling requests and losing logs.

**How much disk can container logs use?**
`max-size × max-file` per container, times the number of containers — so `10m × 3`
across twenty containers is 600 MB, and the `json-file` default is unbounded. Size
it against how far back you need to look *on the host*, which should be small if
logs are shipped elsewhere.

**How is rotation handled with the `journald` driver?**
By the journal, through `journald.conf` settings such as `SystemMaxUse` — a
host-wide budget rather than a per-container one. It is Podman's default, so
Podman does not ship with Docker's unbounded-log problem.

**What changes when you use a remote logging driver?**
Local rotation largely stops being the issue, and the log pipeline becomes a
run-time dependency: in blocking mode an unreachable collector applies
backpressure to every container. The engine's dual-logging cache keeps
`docker logs` working, and disabling it means losing local visibility exactly
when the remote system is what has failed.

---

← Prev: [Restart policies as supervision](07-restart-as-supervision.md) · Index: [Phase 10](README.md) · Next → **Healthchecks in production** *(not written yet)*
