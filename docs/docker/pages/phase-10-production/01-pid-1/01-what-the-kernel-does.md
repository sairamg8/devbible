---
title: "What the kernel does to PID 1"
sidebar_label: "01 · What the kernel does to PID 1"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.html),
> [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html),
> [wait(2)](https://man7.org/linux/man-pages/man2/wait.2.html),
> [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/) and the
> [Node.js process — signal events](https://nodejs.org/api/process.html#signal-events)
> documentation. **No sandbox** — no console output on this page.

**The kernel gives PID 1 two special powers, and both of them are traps when the
process holding PID 1 is your web server.** It cannot be killed by a signal it
does not handle, and every orphaned process in the container becomes its child.
Neither is something an Express server was written to expect.

This is the mechanism under the ten-second stop you have already met twice — in
[stop is two signals](../../phase-1-running-containers/08-stop-is-two-signals.md)
and in [CMD versus ENTRYPOINT](../../phase-3-dockerfile/05-cmd-vs-entrypoint.md).
Those pages gave you the rule (exec form, `exec "$@"`). This one is why the rule
exists, which is what you need for the cases the rule does not cover.

## The container's PID namespace

Every container gets a new PID namespace
([Phase 0, namespaces](../../phase-0-what-a-container-is/02-namespaces.md)). The
first process created inside it is **PID 1 of that namespace** — not of the host,
where it has an ordinary four- or five-digit PID like anything else. The kernel
does not care that the process happens to be `node`. It applies the rules it
applies to `systemd` on a real machine, because from inside the namespace this
process *is* init.

There are three such rules, and all three show up in production.

## Rule 1 — an unhandled signal to PID 1 is discarded

For any process other than PID 1, a signal with no handler installed takes its
**default disposition**: `SIGTERM` terminates, `SIGINT` terminates, `SIGQUIT`
dumps core. For PID 1 in a namespace, `pid_namespaces(7)` removes exactly that:

> Only signals for which the "init" process has established a signal handler can
> be sent to the "init" process by other members of the PID namespace. […]
> Likewise, a process in an ancestor namespace can […] send signals to the
> "init" process of a child PID namespace only if the "init" process has
> established a handler for that signal. `SIGKILL` or `SIGSTOP` are treated
> exceptionally: these signals are forcibly delivered when sent from an ancestor
> PID namespace.

The daemon behind `docker stop` lives in an **ancestor** namespace, so it is the
second half that applies to you. Read it as a decision the kernel makes on every
stop:

| PID 1 has a `SIGTERM` handler? | `docker stop` sends `SIGTERM` | Result |
|---|---|---|
| Yes | Delivered, the handler runs | Exits when it chooses — usually milliseconds |
| No | **Discarded — nothing happens at all** | 10-second wait, then `SIGKILL`, exit **137** |

The kernel is not being obtuse. On a real machine this rule stops a stray
`kill -TERM 1` from taking the box down. Inside a container it hands that
protection to a process that never asked for it, and the `SIGKILL` exception is
the only reason `docker stop` is guaranteed to finish at all.

### Who actually has a handler

This table explains why the same `docker stop` is instant for one image and
always exactly ten seconds for another.

| PID 1 | `SIGTERM` handler? | `docker stop` behaviour |
|---|---|---|
| `node server.js` | **Yes** — Node installs default `SIGINT`/`SIGTERM` handlers on POSIX | Exits, code 143 |
| `python app.py` | **No** — CPython installs one for `SIGINT` only | Ten seconds, then 137 |
| `/bin/sh -c "…"` (shell form) | **No**, in a non-interactive shell | Ten seconds, then 137 |
| An entrypoint script without `exec` | **No** — the shell is still PID 1 | Ten seconds, then 137 |
| `tini` / `catatonit` (`--init`) | **Yes**, and it forwards | Depends on your app, not on PID 1 |

⚠️ **Node sitting on the good side of that table is the most misread fact in the
list.** Node's documented default handlers "reset the terminal mode before
exiting with code 128 + signal number", so a plain `CMD ["node", "server.js"]`
really does stop cleanly with no code of yours involved. But the same
documentation continues: *if one of these signals has a listener installed, its
default behavior will be removed (Node.js will no longer exit)*. The moment your
code does this —

```js
process.on('SIGTERM', () => { server.close(); });
```

— you have taken ownership of exiting. If `server.close()` never resolves because
a keep-alive connection is still open, you are back to ten seconds and exit 137,
with a handler that reads as correct in review. That is the whole subject of
[graceful shutdown](../02-graceful-shutdown/README.md).

## Rule 2 — orphans reparent to PID 1, and PID 1 must reap them

When a process exits, its entry stays in the process table as a **zombie** until
its parent calls `wait()` to collect the exit status. If the parent has already
died, the kernel reparents the orphan — on a normal system to `init`, and inside
a container **to PID 1 of that namespace**. Your web server.

A real init reaps in a loop for precisely this reason. `node`, `python`, `java`
and `nginx` do not: they reap the children *they* spawned and know nothing about
adopted ones. Every unreaped zombie holds a PID and a process-table slot forever.

The failure is slow and resembles nothing else you will be looking for:

- `ps` inside the container fills with `<defunct>` entries.
- Memory and CPU look fine — a zombie has released both.
- Eventually `fork()` returns `EAGAIN`, and the application starts reporting
  "resource temporarily unavailable" or "cannot allocate memory" while
  `docker stats` shows the container almost idle.
- With `--pids-limit` set ([resource limits](../03-resource-limits.md)) the wall
  arrives sooner and, mercifully, more legibly.

**You only meet this if something in the container forks and abandons children**:
a shell script that backgrounds work, a job runner spawning `ffmpeg` or a
converter, an application that shells out per request. A single-process Node API
never generates orphans, which is why the problem has a reputation for being
theoretical right up until the day it is not.

## Rule 3 — when PID 1 exits, the namespace dies

`pid_namespaces(7)` again: if the init process of a PID namespace terminates, the
kernel sends `SIGKILL` to **every** remaining process in that namespace.

Two consequences worth carrying:

- A container is over the moment PID 1 returns, whatever else is still running.
  Background work started by an entrypoint script is killed, not drained.
- Any "several processes in one container" design must make PID 1 the
  supervisor — because PID 1 exiting takes the rest down with it, and that
  supervisor then owns rules 1 and 2 as well.

## Who is PID 1 in *your* container

Trace it back to the Dockerfile. This table is the entire diagnosis.

| Dockerfile | PID 1 | Signals reach the app? |
|---|---|---|
| `CMD ["node", "server.js"]` | `node` | ✅ directly |
| `CMD node server.js` | `/bin/sh` | ❌ `sh` holds PID 1 and forwards nothing |
| `ENTRYPOINT ["./start.sh"]`, script ends `node server.js` | `/bin/sh` | ❌ the shell waits; the app is a child |
| `ENTRYPOINT ["./start.sh"]`, script ends `exec node server.js` | `node` | ✅ `exec` replaces the shell |
| `docker run --init …` | `docker-init` (tini) | ✅ forwarded to your process |

```bash
docker inspect --format '{{.Config.Entrypoint}} {{.Config.Cmd}}' myimage
docker exec api ps -o pid,ppid,stat,args      # PID 1 should be your process
docker inspect --format '{{.State.ExitCode}}' api
```

If PID 1 is `sh` or `/bin/sh -c`, stop and fix the Dockerfile — no run-time flag
repairs that as cleanly as exec form does.

## Podman

The kernel rules belong to the kernel, so they are identical: a rootless
container still gets its own PID namespace and its first process is still PID 1
in it. The one thing that changes is who sends the signal. With **no daemon**
([the Podman stack](../../phase-0-what-a-container-is/06-runtime-stack-podman.md)),
`podman stop` has `conmon` deliver `SIGTERM` — still from an ancestor namespace,
so the handler-or-nothing rule applies exactly as under Docker.

## Gotchas

**Symptom:** Every deploy takes exactly ten seconds per container, and the exit
code is 137.
**Cause:** PID 1 has no `SIGTERM` handler, so the kernel discarded the signal;
the engine waited out the grace period and sent `SIGKILL`.
**Fix:** Exec form, `exec "$@"` at the end of any entrypoint script, or `--init`.
Confirm with `docker exec … ps -o pid,args` that PID 1 is your application.

**Symptom:** After days of uptime the app fails every request with "resource
temporarily unavailable", while CPU and memory look idle.
**Cause:** Zombies. Something forks and abandons children, PID 1 never reaps
them, and the PID table filled.
**Fix:** Give PID 1 to an init — the [next chunk](02-giving-pid-1-to-an-init.md).
`ps` inside the container shows a wall of `<defunct>` before, and none after.

**Symptom:** A background job started by the entrypoint script dies the instant
the main process exits, with no log line explaining it.
**Cause:** Rule 3 — PID 1 exiting makes the kernel `SIGKILL` everything else in
the namespace.
**Fix:** Do not background work in an entrypoint. Give it its own container, or
make PID 1 a real supervisor that outlives both.

**Symptom:** `kill -TERM 1` inside the container via `docker exec` does nothing,
even as root.
**Cause:** The first half of the rule — members of the namespace can only signal
PID 1 for signals it has a handler for, and that restriction applies to
privileged processes too.
**Fix:** Nothing to fix; use `docker stop`, which can escalate to `SIGKILL` from
the ancestor namespace. It is also a useful test: if `docker stop` is slow and
`kill -TERM 1` is inert, you have confirmed there is no handler.

## Interview questions

**★ Why does `docker stop` take ten seconds on some containers and not others?**
`docker stop` sends `SIGTERM`, waits, then sends `SIGKILL`. If PID 1 has
established a handler for `SIGTERM` it exits promptly. If it has not, the kernel
discards the signal — PID 1 in a namespace does not get default signal
dispositions — so nothing happens until `SIGKILL` at ten seconds, and the exit
code is 137.

**★ What is special about PID 1 inside a container?**
Two things. Unhandled signals sent to it are discarded rather than taking their
default action, and every orphaned process in the namespace is reparented to it,
so it is responsible for reaping them. A third rule follows from being init: when
PID 1 exits, the kernel `SIGKILL`s everything else in the namespace.

**★ What is a zombie process, and why do containers make them more likely?**
A process that has exited but whose parent has not called `wait()` to collect its
status; it holds a PID and a process-table slot. Containers make it more likely
because orphans reparent to PID 1 of the namespace — an application process with
no reaping loop — instead of to a real init that has one.

**How do you tell whether your application is PID 1?**
`docker exec <container> ps -o pid,ppid,args` and look at PID 1. If it is
`/bin/sh -c` or your entrypoint script rather than your application, the
Dockerfile is using shell form or the script is missing its final `exec`.

**Node handles `SIGTERM` by default — so is PID 1 a non-issue for a Node API?**
For signals, largely yes, until you install your own listener: that removes the
default behaviour, and a handler that never exits reintroduces the ten-second
stop. For reaping it depends on whether anything forks; a single-process API
never orphans anything, an image that shells out per request does.

**Can you `kill` PID 1 from inside the container?**
Only with a signal it has a handler for. The namespace rule blocks the rest even
for root, which is what protects init on a normal machine. `SIGKILL` works only
from an ancestor namespace, which is what `docker kill` and the tail of
`docker stop` use.

---

[Topic index](README.md) · [02 · Giving PID 1 to an init](02-giving-pid-1-to-an-init.md) →
