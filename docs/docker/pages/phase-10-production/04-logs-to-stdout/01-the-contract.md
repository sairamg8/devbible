---
title: "The contract"
sidebar_label: "01 · The contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — configure logging drivers](https://docs.docker.com/engine/logging/configure/)
> (*"As a default, Docker uses the `json-file` logging driver"*; *"the `local` logging driver
> is recommended as it performs log-rotation by default"*), [Docker — dual logging](https://docs.docker.com/engine/logging/dual-logging/),
> [docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/) and
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> (`--log-driver` default **journald**; `json-file` is an alias for `k8s-file`).
> **No sandbox** — no console output on this page.

**A container's log interface is two file descriptors, and that is the entire
contract.** Write to stdout and stderr; something outside the container collects,
stores, rotates and ships. A log file written inside a container is not a
different way of doing the same thing — it is a bug, and this page is the list of
reasons.

## What actually happens to a write

Your process writes to fd 1 or fd 2. Those are not a terminal — they are pipes
held by the container's supervising process (`containerd-shim` under Docker,
`conmon` under Podman), which hands each line to the configured **logging
driver**. The driver decides where it lands and whether anyone can read it back.

```bash
docker logs -f --tail 100 --since 10m -t api
podman logs -f --tail 100 api
```

That indirection is the whole benefit. The application does not know or care
whether the destination is a file on the host, the journal, or a log aggregator
three networks away; changing the destination is a run-time flag, not a code
change or a rebuild.

## The drivers you will actually meet

| Driver | Engine | Notes |
|---|---|---|
| `json-file` | **Docker default** | One JSON object per line on the host. ⚠️ **No rotation by default** |
| `local` | Docker | **Recommended** — rotates by default, more efficient format |
| `journald` | **Podman default** | Into the systemd journal; queryable with `journalctl` |
| `k8s-file` | Podman | Podman's file format; `json-file` is an **alias** for it |
| `syslog`, `fluentd`, `splunk`, `gelf`, … | Docker | Ship elsewhere; see dual logging below |
| `none` | both | Discards. `docker logs` returns nothing |

Set it per container or as a daemon default:

```bash
docker run --log-driver local --log-opt max-size=10m --log-opt max-file=3 myimage
podman run --log-driver k8s-file myimage
podman info --format '{{ .Host.LogDriver }}'     # what this machine defaults to
```

🔴 **`json-file` performing no rotation by default is the single most common way
a container host runs out of disk.** A chatty service writes until the partition
is full and then everything on the box fails at once. The `local` driver, or
explicit `max-size`/`max-file`, is the fix — the full treatment is
**08 · Log drivers and rotation** *(not written yet)*.

## `docker logs` does not always work

Only drivers that can *read back* support it — `local`, `json-file` and
`journald`. For remote drivers, Docker keeps a local cache using the `local`
driver so `docker logs` still answers; this is **dual logging**, and it is
configured with `cache-` options (`cache-disabled`, `cache-max-size` default
`20m`, `cache-max-file` default `5`, `cache-compress` default `true`).

Two things follow:

- **`docker logs` returning nothing does not mean the application is silent.** It
  may mean the driver cannot be read, the cache is disabled, or the driver is
  `none`. Check the driver before you go debugging the application:
  `docker inspect --format '{{.HostConfig.LogConfig.Type}}' api`.
- **The cache is a second copy on disk.** Disabling it saves space when logs are
  genuinely only read through the remote system — and costs you the ability to
  look at a container locally when that system is the thing that is broken.

## The two ways applications break the contract

### 1. Writing to a file inside the container

Every reason this fails is structural, not stylistic:

- **The file dies with the container.** The writable layer is discarded on
  removal ([Phase 0 — image versus container](../../phase-0-what-a-container-is/04-image-vs-container.md)),
  so the logs from the run that crashed are gone at exactly the moment you want
  them.
- **`docker logs` is empty**, and so is everything downstream of it. The log
  pipeline never sees a byte.
- **It grows the writable layer**, which is the least observable disk consumer on
  the host ([13 · Disk growth](../13-disk-growth.md)).
- **Rotation is now your problem**, inside a container that has no cron and no
  logrotate.

When a library or vendored binary insists on a file path, the standard idiom is
to point that path at the stream — the official nginx images do exactly this:

```dockerfile
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
 && ln -sf /dev/stderr /var/log/nginx/error.log
```

Treat it as a compatibility shim for software you cannot change, not as a
pattern. ⚠️ It only works for processes that share the container's stdout —
which is one more reason the one-process container is the shape everything else
assumes.

### 2. Buffering, which loses the logs you needed most

**stdout to a pipe is not line-buffered.** A terminal gets line buffering; a pipe
usually gets a 4–8 KB block buffer. So a container that logs happily in an
interactive `docker run -it` can, when detached, emit nothing for minutes — and
lose the buffer entirely if the process is `SIGKILL`ed.

That combination is precisely the worst case: **the crash that kills your process
also destroys the last buffer**, which is the part explaining the crash.

| Runtime | What to do |
|---|---|
| Python | `PYTHONUNBUFFERED=1`, or `python -u` |
| Shell scripts using `tee`/pipes | `stdbuf -oL`, or write directly |
| Node | Writes to a pipe are asynchronous — an immediate `process.exit()` can drop pending output; drain before exiting |
| Any runtime | Prefer a logger that flushes per record over one that batches |

This is also why the shutdown routine in
[topic 02](../02-graceful-shutdown/02-doing-it-in-a-real-service.md) flushes
before `process.exit(0)`: an unflushed buffer at exit is a log line that never
existed.

## stdout versus stderr

The engine captures both and records which stream each line came from, but
**nothing downstream treats stderr as "error"**. `docker logs` interleaves them,
and most aggregators flatten the distinction entirely.

So do not encode severity in the choice of stream. **Put the level in the log
record** — the next chunk's subject. The conventional split that is still worth
keeping is diagnostic output on stdout and genuine crash output (uncaught
exception traces, the runtime's own panics) on stderr, because that is where
runtimes write it anyway.

## Podman

Same contract, different defaults, and the difference is visible on day one:

| | Docker | Podman |
|---|---|---|
| Default driver | `json-file` (no rotation) | **`journald`** |
| Reading | `docker logs` | `podman logs`, **and** `journalctl` |
| Aliases | — | `json-file` is an alias for `k8s-file` |
| Rotation | your problem with `json-file` | the journal's own limits apply |

The journald default is a genuine advantage: rotation and disk limits are already
solved by the journal, and container output is queryable alongside the rest of
the machine's logs. Under Quadlet (Phase 11) that becomes the natural reading —
`journalctl -u <unit>` — rather than a container-specific command.

## Gotchas

**Symptom:** `docker logs` prints nothing, but the service is clearly working.
**Cause:** The driver cannot be read (`none`, or a remote driver with the cache
disabled), or the application writes to a file inside the container.
**Fix:** Check `.HostConfig.LogConfig.Type` first. Fix the destination, not the
application's verbosity.

**Symptom:** Logs appear in bursts, or the last few seconds before a crash are
always missing.
**Cause:** Block buffering on a pipe, and the buffer died with the process.
**Fix:** Unbuffer the runtime (`PYTHONUNBUFFERED=1`, `-u`, `stdbuf -oL`) and
flush during shutdown.

**Symptom:** The host filled its disk and every container on it failed at once.
**Cause:** `json-file` performs no rotation by default.
**Fix:** The `local` driver, or `max-size`/`max-file` on `json-file`, set at the
daemon level so no container can opt out by omission.

**Symptom:** Logs are fine interactively and absent in production.
**Cause:** A TTY line-buffers; a pipe does not. `docker run -it` and a detached
container are genuinely different environments for output.
**Fix:** Test log behaviour detached. Never conclude "logging works" from an
interactive run.

## Interview questions

**★ Why should a containerised application log to stdout instead of a file?**
Because the stream is the container's log interface: the engine captures it and a
driver decides where it goes, so the destination becomes configuration rather
than code. A file inside the container dies with the container, is invisible to
`docker logs` and the log pipeline, grows the writable layer, and makes rotation
the application's problem.

**★ What is Docker's default logging driver and what is wrong with it?**
`json-file`, which performs **no rotation by default** — a chatty container will
fill the host's disk and take every other container down with it. The `local`
driver rotates by default, or set `max-size` and `max-file` explicitly at the
daemon level.

**★ Why do logs sometimes vanish just before a crash?**
Because stdout to a pipe is block-buffered rather than line-buffered, and a
`SIGKILL` destroys the buffer. The lines explaining the failure are exactly the
ones lost. Unbuffer the runtime and flush during graceful shutdown.

**Does `docker logs` work with every logging driver?**
No — only drivers that support reading, such as `local`, `json-file` and
`journald`. Remote drivers rely on dual logging, where the engine keeps a `local`
cache so the command still answers; with that cache disabled, `docker logs`
returns nothing while the logs are shipping fine elsewhere.

**Is stderr for errors in a container?**
Not in any way anything downstream relies on. The engine records both streams and
readers interleave them, so severity belongs in the log record. In practice, use
stderr for crash output and stdout for everything else, and let the record carry
the level.

**A vendored binary insists on writing to `/var/log/app.log`. What now?**
Symlink that path to `/dev/stdout` in the image, as the official nginx images do
for their access and error logs. It is a shim for software you cannot change —
and it depends on the process sharing the container's stdout, which is another
argument for one process per container.

---

[Topic index](README.md) · [02 · Writing logs a machine can read](02-logs-a-machine-can-read.md) →
