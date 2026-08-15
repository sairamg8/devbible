---
title: "01 · PID 1 is not a normal process"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.html),
> [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html),
> [docker run — `--init`](https://docs.docker.com/reference/cli/docker/container/run/#init),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [tini](https://github.com/krallin/tini) and the
> [Node.js signal events](https://nodejs.org/api/process.html#signal-events) documentation.
> **No sandbox** — no console output on this page.

The syllabus row is *no default signal handlers, no zombie reaping; `--init` /
`tini`, and why your app hangs for 10 seconds on every deploy.*

🔴 **The kernel gives PID 1 two special powers, and both are traps when the
process holding PID 1 is your web server.** It cannot be killed by a signal it
does not handle, and every orphaned process in the container becomes its child.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What the kernel does to PID 1](01-what-the-kernel-does.md)** | The container's PID namespace; the three rules — unhandled signals are discarded, orphans reparent and must be reaped, and PID 1 exiting `SIGKILL`s the namespace; who has a `SIGTERM` handler and who does not, including the Node listener that removes its own default; how zombies exhaust PIDs; and the table that tells you who PID 1 is in your image |
| 02 | **[Giving PID 1 to an init](02-giving-pid-1-to-an-init.md)** | The four ways out, in the order to try them: exec form and `exec "$@"`; `--init` with tini and catatonit, and exactly what it does not do; baking tini in with `ENTRYPOINT ["/sbin/tini", "--"]` for platforms with no run flags; `--pid=host`; and what a real supervisor costs when one container must run several processes |

## Four facts worth carrying out of this topic

- **An unhandled signal to PID 1 is discarded, not defaulted.** That single kernel
  rule is the ten-second stop and exit 137.
- **Orphans reparent to PID 1 of the namespace** — your application — and nothing
  in `node` or `python` reaps them.
- **`--init` forwards and reaps. It does not restart, supervise or order
  anything.**
- **The free fix is exec form and `exec "$@"`.** Try that before any flag.

## Phase gate

You can look at a Dockerfile and say what PID 1 will be, predict whether
`docker stop` returns in milliseconds or ten seconds, and explain a container
that fails every request with "resource temporarily unavailable" while sitting
idle.

## Where this connects

- [Phase 1 · 08 · Stop is two signals](../../phase-1-running-containers/08-stop-is-two-signals.md)
  — the `SIGTERM` → grace → `SIGKILL` sequence this page explains the middle of
- [Phase 1 · 09 · Exit codes](../../phase-1-running-containers/09-exit-codes.md) —
  137 and 143, and how to tell them apart
- [Phase 1 · 12 · Restart policies](../../phase-1-running-containers/12-restart-policies.md)
  — the supervision `--init` deliberately does not provide
- [Phase 3 · 05 · CMD versus ENTRYPOINT](../../phase-3-dockerfile/05-cmd-vs-entrypoint.md)
  and [06 · Exec versus shell form](../../phase-3-dockerfile/06-exec-vs-shell-form.md)
  — where PID 1 is decided
- [Phase 0 · 02 · Namespaces](../../phase-0-what-a-container-is/02-namespaces.md) —
  the PID namespace itself
- [02 · Graceful shutdown](../02-graceful-shutdown/README.md) — what the application does
  once the signal finally arrives
- **Phase 11 · Quadlet** *(not written yet)* — the same stop, wearing systemd's
  clothes

---

Start → [01 · What the kernel does to PID 1](01-what-the-kernel-does.md)
