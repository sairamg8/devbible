---
title: "Stop is two signals"
sidebar_label: "08 · Stop is two signals"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/),
> [docker container kill](https://docs.docker.com/reference/cli/docker/container/kill/),
> [Dockerfile STOPSIGNAL](https://docs.docker.com/reference/dockerfile/#stopsignal)
> and [podman-stop(1)](https://docs.podman.io/en/latest/markdown/podman-stop.1.html).
> **No sandbox** — no console output on this page.

**`docker stop` sends `SIGTERM`, waits, and then sends `SIGKILL`.** The gap
between them is your application's only chance to finish what it was doing.
Understanding it is the difference between a clean deploy and one that drops
in-flight requests every time.

## The sequence

1. The engine sends **`SIGTERM`** to PID 1 in the container.
2. It waits — **10 seconds by default** on Linux (30 on Windows).
3. If the process has not exited, it sends **`SIGKILL`**, which cannot be caught,
   blocked or ignored.

```bash
docker stop api                # SIGTERM, 10s grace, then SIGKILL
docker stop -t 30 api          # 30-second grace
docker stop -t 0 api           # effectively immediate SIGKILL
docker kill api                # SIGKILL now, no grace at all
docker kill --signal=HUP api   # send an arbitrary signal
```

The timeout can also be fixed per container at creation with `--stop-timeout`,
and `--timeout -1` waits indefinitely.

## The signal is configurable, the kill is not

`STOPSIGNAL` in the Dockerfile changes which signal step 1 sends — useful for
software that expects `SIGQUIT` or `SIGINT` for graceful shutdown (nginx's
graceful stop is `SIGQUIT`, for example).

```dockerfile
STOPSIGNAL SIGQUIT
```

Nothing changes step 3. `SIGKILL` after the timeout is not negotiable; that is
what makes `stop` reliable.

## Why your application often never sees it

Two container-specific traps swallow the signal before your code runs, and both
are Phase 3 material that you meet here first.

### Shell form wraps you in `/bin/sh -c`

```dockerfile
CMD npm start                 # ❌ shell form: /bin/sh -c "npm start"
CMD ["npm", "start"]          # ✅ exec form: your process IS PID 1
```

With the shell form, PID 1 is `sh`, and your application is its child. `sh` does
not forward `SIGTERM`. The engine signals `sh`, `sh` ignores it, ten seconds
pass, and everything is `SIGKILL`ed. The symptom is deceptively mild: **every
stop takes exactly ten seconds.** If your deploys pause for a suspiciously round
ten seconds, this is why.

### PID 1 has no default handlers

Even in exec form, PID 1 in a container gets no default signal dispositions from
the kernel ([Phase 0, page 02](../phase-0-what-a-container-is/02-namespaces.md)).
A process that never installs a `SIGTERM` handler does not die on `SIGTERM` — the
signal is simply discarded. Outside a container the kernel's default would
terminate it; as PID 1 it does not.

So a containerised service must **explicitly handle `SIGTERM`**:

```js
// Node: the minimum viable graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));   // stop accepting, finish in-flight
});
```

Every language has the equivalent. Without it you are relying on `SIGKILL`, which
means in-flight requests are dropped and buffers are not flushed on every single
deploy.

## Choosing the grace period

The default ten seconds is a guess, and often the wrong one:

- **Longer** for anything that must finish work: a queue consumer mid-job, a
  request handler with slow upstreams, a database flushing to disk.
- **Shorter** rarely helps. `-t 0` is `kill` with extra steps.
- **Match it to reality**: the grace period should exceed your longest expected
  in-flight operation, or you have chosen to cut those operations off.

In Compose this is `stop_grace_period:` (Phase 8); in production supervisors it
is usually a separate setting again, and mismatched values between layers are a
classic cause of "it shuts down cleanly locally but not in production".

## Podman

Same two-signal sequence, same default, same `STOPSIGNAL` support. `podman stop
-t` behaves identically. The difference is who sends it: with no daemon, the
signal comes from your `podman` invocation or from systemd when a Quadlet unit
stops — which means **systemd's own `TimeoutStopSec` also applies**, and the
shorter of the two wins. Phase 11.

## Gotchas

**Symptom:** Every `docker stop` takes exactly ten seconds.
**Cause:** Nothing is handling `SIGTERM` — either shell form put `sh` at PID 1,
or the application installs no handler. The full grace period elapses, then
`SIGKILL`.
**Fix:** Use exec form `CMD ["node", "server.js"]` and install a `SIGTERM`
handler. The ten-second pause is a reliable diagnostic.

**Symptom:** Deploys drop a handful of requests every time.
**Cause:** The process is killed while requests are in flight, because it never
stopped accepting and drained.
**Fix:** On `SIGTERM`, stop accepting new connections, finish outstanding ones,
then exit. Raise the grace period above the longest expected request.

**Symptom:** A database container's data is corrupted after a stop.
**Cause:** `docker rm -f`, `docker kill`, or a grace period too short for it to
flush.
**Fix:** `docker stop` with a generous `-t` for stateful services, and never
`rm -f` them. Databases need the `SIGTERM` path.

**Symptom:** `STOPSIGNAL SIGQUIT` was set and the process still dies hard.
**Cause:** It does not handle `SIGQUIT` either, so the timeout expires and
`SIGKILL` follows. `STOPSIGNAL` changes which signal is sent, not whether it is
handled.
**Fix:** Check what the software actually documents for graceful shutdown, and
verify the handler exists.

## Interview questions

**★ What happens when you run `docker stop`?**
`SIGTERM` to PID 1, a grace period (10 seconds by default on Linux), then
`SIGKILL` if it has not exited. `docker kill` skips straight to `SIGKILL`.

**★ Why does an application in a container often not receive `SIGTERM`?**
Either the shell form of `CMD` put `/bin/sh` at PID 1 and it does not forward
signals, or the application installed no handler — and PID 1 has no default
signal dispositions, so the signal is discarded rather than terminating it.

**★ Your deploys always pause for exactly ten seconds. What is happening?**
Nothing is handling `SIGTERM`, so the full default grace period elapses before
`SIGKILL`. Fix the exec form, add a handler, and the stop becomes immediate.

**How do you change which signal is sent?**
`STOPSIGNAL` in the Dockerfile, or `--stop-signal` at run time. The final
`SIGKILL` after the timeout cannot be changed — that is what makes `stop`
dependable.

**How long should the grace period be?**
Longer than your longest expected in-flight operation. Ten seconds is a default,
not an analysis; a queue worker processing minute-long jobs needs far more, and
setting it shorter simply chooses to cut work off.

---

← Prev: [The container lifecycle](07-lifecycle.md) · Index: [Phase 1](README.md) · Next → [Exit codes](09-exit-codes.md)
