---
title: "02 · Graceful shutdown"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/),
> the [Compose file reference](https://docs.docker.com/reference/compose-file/services/),
> [Dockerfile `STOPSIGNAL`](https://docs.docker.com/reference/dockerfile/#stopsignal),
> [systemd-system.conf(5)](https://www.man7.org/linux/man-pages/man5/systemd-system.conf.5.html),
> the Node.js [HTTP server API](https://nodejs.org/api/http.html) and
> [process signal events](https://nodejs.org/api/process.html#signal-events).
> **No sandbox** — no console output on this page.

The syllabus row is *handling `SIGTERM` in the application, draining connections,
and the stop timeout that kills you mid-request.*

🔴 **`SIGTERM` is not a request to stop — it is the start of a countdown, and
graceful shutdown is whatever you can finish before it runs out.** The deadline
belongs to whoever stopped the container, and the `SIGKILL` at the end of it is
not negotiable.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The deadline](01-the-deadline.md)** | Who sets the budget and why the same image gets 10 s under Compose and 90 s under systemd; changing the first signal with `STOPSIGNAL` and why nginx wants `SIGQUIT`; the four steps and why readiness must fail *before* the listener closes; what graceful shutdown is not — unbounded, or a substitute for being killable; and reading 0 / 143 / 137 as telemetry for whether any of it works |
| 02 | **[Doing it in a real service](02-doing-it-in-a-real-service.md)** | Why `server.close()` is not enough and what Node 18.2 and 19 changed about idle keep-alive sockets; the handler in full, with the re-entry guard, the `unref`'d backstop and the release order; everything else that holds the event loop open; the worker-with-no-HTTP-server variant; wiring `stop_grace_period` and `TimeoutStopSec`; and the three traps that are containers' rather than Node's |

## Four facts worth carrying out of this topic

- **The budget is set by the stopper, not the app** — 10 s for `docker stop` and
  Compose, 90 s for systemd. Size the routine to the smallest it will ever get.
- **Fail readiness before closing the listener.** Nothing upstream knows you are
  stopping; it finds out by failing to connect.
- **`server.close()` waits for idle keep-alive connections** — the ten-second
  stop with a correct-looking handler. Node 19 closes them; before that,
  `closeIdleConnections()` does.
- **Exit 0 means it worked, 143 means there was no handler, 137 means the handler
  did not finish.** That is free instrumentation.

## Phase gate

You can write a shutdown handler that drains inside a stated budget, say what
each `await` in it is waiting for, and explain from an exit code alone whether a
deploy shut down cleanly, ignored the signal, or ran out of time.

## Where this connects

- [01 · PID 1 is not a normal process](../01-pid-1/README.md) — whether the
  signal reaches your code at all, and the Node listener that removes the default
  exit
- [Phase 1 · 08 · Stop is two signals](../../phase-1-running-containers/08-stop-is-two-signals.md)
  — the sequence this topic fits inside
- [Phase 1 · 09 · Exit codes](../../phase-1-running-containers/09-exit-codes.md) —
  0, 143 and 137
- [Phase 3 · 11 · HEALTHCHECK](../../phase-3-dockerfile/11-healthcheck.md) —
  reports, does not route; readiness needs something in front
- [Phase 3 · 16 · STOPSIGNAL and SHELL](../../phase-3-dockerfile/16-stopsignal-and-shell.md)
  — choosing the first signal in the image
- [03 · Resource limits](../03-resource-limits/README.md) ·
  [04 · Logs go to stdout](../04-logs-to-stdout/README.md) ·
  [09 · Healthchecks in production](../09-healthchecks-in-production.md) ·
  [16 · Zero-downtime restarts](../16-zero-downtime-restarts.md)

---

Start → [01 · The deadline](01-the-deadline.md)
