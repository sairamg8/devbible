---
title: "STOPSIGNAL and SHELL"
sidebar_label: "16 · STOPSIGNAL and SHELL"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the [Dockerfile reference — STOPSIGNAL](https://docs.docker.com/reference/dockerfile/#stopsignal),
> [Dockerfile reference — SHELL](https://docs.docker.com/reference/dockerfile/#shell),
> [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/) and
> [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html).
> **No sandbox** — no console output on this page.

**Two small instructions.** `STOPSIGNAL` changes which signal `docker stop`
sends first; `SHELL` changes which shell the shell form uses.

## `STOPSIGNAL`

```dockerfile
STOPSIGNAL SIGQUIT
STOPSIGNAL SIGTERM      # the default
STOPSIGNAL 3            # numeric also accepted
```

`docker stop` sends this signal, waits the grace period, then sends `SIGKILL`
([Phase 1, page 08](../phase-1-running-containers/08-stop-is-two-signals.md)).
**`STOPSIGNAL` changes the first signal only. The final `SIGKILL` is not
configurable**, which is what makes `stop` dependable.

### When to change it

Some software defines a graceful shutdown on a signal other than `SIGTERM`:

| Software | Graceful signal | `SIGTERM` does |
|---|---|---|
| **nginx** | `SIGQUIT` | Fast shutdown — drops in-flight connections |
| **Apache httpd** | `SIGWINCH` (graceful-stop) | Immediate stop |
| Most application runtimes | `SIGTERM` | The right thing |

For nginx that difference is real: `SIGQUIT` finishes serving current requests
and then exits, while `SIGTERM` terminates promptly. Official images generally
set this already — check with
`docker image inspect --format '{{.Config.StopSignal}}'` before adding your own.

### It does not create a handler

Setting `STOPSIGNAL SIGQUIT` on software that ignores `SIGQUIT` changes nothing
useful: the signal is sent, ignored, the grace period elapses, and `SIGKILL`
follows. **The instruction selects a signal; the application must still handle
it.**

Override at run time with `docker run --stop-signal`, and note that `docker kill
--signal` sends an arbitrary signal immediately without the stop sequence.

## `SHELL`

```dockerfile
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
```

Changes the command used for the **shell form** of `RUN`, `CMD` and `ENTRYPOINT`.
The default on Linux is `["/bin/sh", "-c"]`.

### The one genuinely useful case

```dockerfile
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN curl -fsSL https://example.com/list.txt | grep -c pattern > /count
```

Without `pipefail`, a pipeline's exit status is that of the **last** command. So
if `curl` fails and `grep` succeeds on empty input, the `RUN` succeeds and the
layer is committed with wrong content. `pipefail` makes the pipeline fail if any
element fails.

This is the same class of problem as heredocs needing `set -e`
(page 14): shell defaults are permissive, and a Dockerfile wants strictness.

The narrower alternative, without changing the shell globally:

```dockerfile
RUN set -o pipefail && curl -fsSL … | grep -c pattern > /count
```

which requires a shell that supports it — `/bin/sh` on Alpine (BusyBox `ash`)
does not reliably.

### Scope

`SHELL` applies to every subsequent shell-form instruction, and can be set more
than once. It has **no effect on exec form**, which does not use a shell at all
(page 06) — so it cannot rescue an exec-form `CMD`, and it does not change the
PID 1 story.

### `SHELL` on Windows

Its other purpose is switching between `cmd /S /C` and `powershell -Command` in
Windows containers. Out of scope here, but it is why the instruction exists in
the general form it does.

## Podman

Both instructions are supported identically. `podman stop` honours `StopSignal`
from the image config, and `podman run --stop-signal` overrides it. Under a
Quadlet unit, systemd's own `KillSignal=` and `TimeoutStopSec=` also participate,
and the shorter timeout wins — worth knowing when a service seems to be killed
earlier than the container's grace period suggests (Phase 11).

## Gotchas

**Symptom:** nginx drops in-flight connections on every deploy.
**Cause:** It received `SIGTERM`, which is a fast shutdown for nginx.
**Fix:** `STOPSIGNAL SIGQUIT`. Check whether the base image already sets it.

**Symptom:** `STOPSIGNAL` was set and stops still take the full grace period.
**Cause:** The application does not handle that signal either.
**Fix:** Check what the software documents for graceful shutdown, and confirm a
handler exists. `STOPSIGNAL` chooses a signal; it does not install a handler.

**Symptom:** A `RUN` with a pipeline succeeded but produced an empty or wrong
file.
**Cause:** The first command in the pipeline failed and the pipeline's status
came from the last one.
**Fix:** `SHELL ["/bin/bash", "-o", "pipefail", "-c"]`, and make sure bash is in
the image.

**Symptom:** `SHELL ["/bin/bash", …]` fails on Alpine.
**Cause:** No bash — Alpine ships BusyBox `ash`.
**Fix:** Install bash, or use `set -o pipefail` where supported, or restructure
to avoid the pipeline.

## Interview questions

**★ What does `STOPSIGNAL` change, and what does it not?**
It changes the signal `docker stop` sends first. It does not change the final
`SIGKILL` after the grace period, and it does not make the application handle the
signal — an unhandled `SIGQUIT` waits out the timeout exactly like an unhandled
`SIGTERM`.

**★ Why would you set `STOPSIGNAL SIGQUIT`?**
For software whose graceful shutdown is on that signal — nginx being the standard
example, where `SIGTERM` is a fast shutdown that drops in-flight connections and
`SIGQUIT` drains them first.

**★ What is `SHELL` most usefully for?**
`SHELL ["/bin/bash", "-o", "pipefail", "-c"]`, so a `RUN` containing a pipeline
fails when any element fails. Without `pipefail` the exit status comes from the
last command, and a failed download followed by a successful `grep` commits a
layer with wrong content.

**Does `SHELL` affect exec-form instructions?**
No. Exec form does not invoke a shell, so `SHELL` is irrelevant to it — including
to an exec-form `CMD`, which is why it has no bearing on PID 1 or signal
handling.

---

← Prev: [The syntax directive](15-syntax-directive.md) · Index: [Phase 3](README.md) · Next → [ONBUILD](17-onbuild.md)
