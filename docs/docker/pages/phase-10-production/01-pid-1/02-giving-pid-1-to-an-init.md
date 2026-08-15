---
title: "Giving PID 1 to an init"
sidebar_label: "02 · Giving PID 1 to an init"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker run — `--init`](https://docs.docker.com/reference/cli/docker/container/run/#init),
> [dockerd — `--init-path`](https://docs.docker.com/reference/cli/dockerd/),
> [podman-run(1) — `--init`, `--init-path`](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [tini](https://github.com/krallin/tini), [catatonit](https://github.com/openSUSE/catatonit) and
> [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.html).
> **No sandbox** — no console output on this page.

**There are only three ways out of the previous chunk's rules: be a process that
handles signals and has no children, hand PID 1 to something that was written to
be init, or leave the PID namespace entirely.** This chunk is all three, in the
order you should try them.

## Option 1 — be the right kind of PID 1 (free)

The cheapest fix is almost always the Dockerfile, and it costs nothing at run
time:

```dockerfile
CMD ["node", "server.js"]              # ✅ exec form — node is PID 1
```

```bash
#!/bin/sh
set -e
# … setup: render config, wait for a dependency, fix permissions …
exec node server.js                    # ✅ replaces the shell; node becomes PID 1
```

`exec` replaces the shell process image rather than forking a child, so the
shell's PID — which is 1 — becomes your application's. Nothing is forwarded
because nothing is in the way. When the entrypoint script must pass through
whatever `CMD` or the user supplied, the last line is `exec "$@"`.

This is sufficient when the process handles `SIGTERM` **and** never leaves
orphans behind. For a single-process Node or Go service, that is the end of it.

## Option 2 — `--init`: rent an init rather than write one

```bash
docker run --init myimage
podman run --init myimage
```

The flag inserts a tiny init as PID 1 and makes your command its child. Docker
mounts its own `docker-init` binary — a build of **tini** — into the container
at `/sbin/docker-init`; the daemon's `--init-path` sets where it comes from.
Podman uses **catatonit** by default, with `--init-path` and `containers.conf`
choosing otherwise. Both do two jobs and no others:

1. **Forward signals** to the child, so `SIGTERM` reaches your application under
   the ordinary default disposition — the namespace exception no longer applies,
   because your application is no longer PID 1.
2. **Reap** everything reparented to them, in a loop, for as long as they run.

What `--init` does **not** do matters just as much: it does not restart
anything, does not order startup, does not check health, and does not turn a
crash into a retry. Restart belongs to the engine's
[restart policy](../../phase-1-running-containers/12-restart-policies.md), and
real supervision belongs to systemd
(**Phase 11 — Quadlet** *(not written yet)*).

### Do you need it?

| Situation | `--init` |
|---|---|
| Single process, exec form, handles `SIGTERM` | Not needed — but harmless |
| Anything that forks and abandons children | **Yes** |
| An entrypoint script you cannot convert to `exec` | **Yes**, as a stopgap |
| Runtime with no `SIGTERM` handler (CPython, plain shell) | **Yes**, or install a handler |
| You cannot pass run flags (Kubernetes, some PaaS) | Bake it in instead — below |

The cost is roughly one extra process and a few hundred kilobytes. The reason not
to reach for it reflexively is not overhead, it is honesty: `--init` papers over a
shell-form `CMD` well enough that nobody fixes the `CMD`, and the flag then has to
be remembered at every `docker run`, in Compose, and in whatever runs the image
next year.

## Option 3 — bake an init into the image

`--init` is a run-time flag, so it is invisible in the image and to anyone reading
the Dockerfile, and it does not exist at all in some platforms that run your
image. If the image genuinely needs an init, put it in the image:

```dockerfile
RUN apk add --no-cache tini            # Debian/Ubuntu: apt-get install -y tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

The `--` is not decoration. It ends tini's own option parsing, so flags in your
`CMD` — or arguments a user appends at `docker run` — are passed through to your
program instead of being read as tini's.

Two consequences of an image-level `ENTRYPOINT` you should expect, both already
covered in [CMD versus ENTRYPOINT](../../phase-3-dockerfile/05-cmd-vs-entrypoint.md):
anything downstream that sets its own `CMD` still gets tini, which is the point;
and anything that wants to bypass it needs `--entrypoint`, which is the escape
hatch.

## Option 4 — leave the PID namespace

```bash
docker run --pid=host myimage
```

With the host's PID namespace, your process is not PID 1 anywhere, every default
disposition is back, and orphans reparent to the host's real init, which reaps
them. It also lets the container see and signal **every process on the machine**,
which is why it belongs to debugging tools, monitoring agents and profilers, not
to application containers. The security trade is on
[hardening at run time](../10-hardening.md).

`--pid=container:<name>` joins another container's namespace instead — the same
mechanism a Podman pod uses when you ask for a shared PID namespace, and a
legitimate way for a sidecar to see its neighbour's processes.

## When one container really does run several processes

Sometimes the answer is a supervisor, and then PID 1 is that supervisor:
`s6-overlay`, `supervisord`, or systemd inside the container. The rules do not
soften — the supervisor is now responsible for forwarding signals and reaping,
which is exactly what those programs are written to do.

Before choosing it, be clear that you are giving up the things the one-process
model buys: per-process restart is now the supervisor's, not the engine's; logs
from several processes are interleaved into one stream
([logs go to stdout](../04-logs-to-stdout/README.md)); a crash of the important process
does not necessarily exit the container, so the engine's restart policy never
fires; and `docker stats` reports the sum, so no single process's memory is
visible. The usual right answer remains one process per container with the engine
or systemd supervising — this is the exception, not the pattern.

## Podman

| | Docker | Podman |
|---|---|---|
| `--init` binary | `docker-init` (tini), mounted at `/sbin/docker-init` | `catatonit`, typically from `/usr/libexec/podman/` |
| Path override | daemon flag `--init-path` | `--init-path`, or `init_path` in `containers.conf` |
| Who sends `SIGTERM` on stop | `dockerd` | `conmon`, per container |
| Under systemd | not applicable | the unit's stop drives `podman stop`; a missing handler shows up as a unit taking its full `TimeoutStopSec` |

That last row is worth carrying into Phase 11: under Quadlet the ten-second stop
does not disappear, it changes uniform. The symptom becomes `systemctl stop`
hanging until the unit's stop timeout, and the cause is the same missing handler.

## Gotchas

**Symptom:** You added `process.on('SIGTERM', …)` to shut down gracefully and
stops got *slower*.
**Cause:** Installing a listener removes Node's default exit behaviour. If the
handler never reaches `process.exit()` — `server.close()` blocked on keep-alive
sockets, a pending query — nothing exits.
**Fix:** Close the server, set a hard timer as a backstop, exit. That is
[the next topic](../02-graceful-shutdown/README.md).

**Symptom:** `--init` fixed the stop, but a crashed application still leaves the
container dead.
**Cause:** tini and catatonit forward and reap. They do not restart. When your
process exits, PID 1 exits with its status and the container is over.
**Fix:** A restart policy, or a systemd unit. `--init` is not supervision.

**Symptom:** With `ENTRYPOINT ["/sbin/tini"]` your `CMD` flags vanish or tini
complains about an unknown option.
**Cause:** The missing `--`. tini parsed your program's flags as its own.
**Fix:** `ENTRYPOINT ["/sbin/tini", "--"]`.

**Symptom:** The image behaves in Compose and misbehaves in Kubernetes, with the
same ten-second stop and zombie symptoms returning.
**Cause:** `--init` is a Docker/Podman run flag with no equivalent in a Pod spec,
so it silently was not applied.
**Fix:** Bake tini into the image with `ENTRYPOINT`. An image that needs an init
should carry it, not depend on being run correctly.

## Interview questions

**★ What does `--init` actually do, and when do you need it?**
It runs a minimal init — tini under Docker, catatonit under Podman — as PID 1
with your command as its child. It forwards signals and reaps orphans, and does
nothing else. You need it when something in the container forks and abandons
children, or when PID 1 is a runtime that installs no `SIGTERM` handler. A
single-process app in exec form that handles `SIGTERM` does not need it.

**★ Is `--init` a substitute for a restart policy or a supervisor?**
No. Signals and reaping only. Restarting a crashed container is the engine's
restart policy or systemd's job, and running several processes in one container
needs a real supervisor as PID 1 — which then inherits both PID 1 duties itself.

**★ Why is `exec "$@"` the last line of an entrypoint script?**
So the real command replaces the shell rather than running as its child, taking
over PID 1 and receiving signals directly. Without it, the shell stays PID 1,
has no `SIGTERM` handler, and every stop waits out the full grace period before
`SIGKILL`.

**Your image must run correctly on a platform where you cannot pass run flags.
How do you get an init?**
Install tini in the image and make it the `ENTRYPOINT`, with `--` so your `CMD`
is passed through. The requirement then travels with the image instead of
depending on whoever writes the run command.

**What does `--pid=host` change, and why is it not the default answer?**
The container shares the host's PID namespace, so nothing is PID 1, defaults
apply, and the host's init reaps orphans. It also exposes every process on the
machine to the container and lets it signal them, so it is for debugging and
monitoring tools, not for application containers.

**A container runs an app plus a cron-like helper and stops taking twenty
seconds. Where do you look?**
At PID 1. If it is a shell holding both, no signal is forwarded to either and the
stop is waiting for `SIGKILL`. Either split them into two containers — the usual
answer — or make PID 1 a supervisor that forwards `SIGTERM` to both and reaps.

---

← [01 · What the kernel does to PID 1](01-what-the-kernel-does.md) · [Topic index](README.md)
