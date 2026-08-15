---
title: "Exec form versus shell form"
sidebar_label: "06 · Exec versus shell form"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the [Dockerfile reference — shell and exec form](https://docs.docker.com/reference/dockerfile/#shell-and-exec-form),
> [Dockerfile reference — ENTRYPOINT](https://docs.docker.com/reference/dockerfile/#entrypoint) and
> [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html).
> **No sandbox** — no console output on this page.

**Exec form runs your binary directly. Shell form wraps it in `/bin/sh -c`.**
The difference is not cosmetic: it decides which process is PID 1, and therefore
whether your application ever receives `SIGTERM`.

## The two forms

```dockerfile
CMD ["node", "server.js"]     # exec form — a JSON array
CMD node server.js            # shell form — a bare string
```

| | Exec form | Shell form |
|---|---|---|
| Runs | Your binary, directly | `/bin/sh -c "your command"` |
| PID 1 is | **Your process** | **`sh`**; your process is its child |
| Receives `SIGTERM` | **Yes** | **No** — `sh` does not forward it |
| Variable expansion | No | Yes (`$HOME`, `$PATH`) |
| Pipes, `&&`, redirection | No | Yes |
| Needs a shell in the image | No | **Yes** — fails on distroless |

## Why this is the difference that matters

`docker stop` sends `SIGTERM` to **PID 1**
([Phase 1, page 08](../phase-1-running-containers/08-stop-is-two-signals.md)).

With shell form, PID 1 is `sh`. It receives the signal, does not forward it to
its child, and — as PID 1 with no handler installed — is not killed by it either
([Phase 0, page 02](../phase-0-what-a-container-is/02-namespaces.md)). So:

1. `docker stop` sends `SIGTERM`. Nothing happens.
2. The grace period elapses — **ten seconds by default**.
3. `SIGKILL` terminates everything, uncleanly.

**Every stop takes exactly ten seconds, and in-flight requests are dropped on
every deploy.** That round number is the tell.

With exec form, your process is PID 1 and gets the signal directly — at which
point your `SIGTERM` handler runs, connections drain, and the container exits in
milliseconds with code 0.

## When you genuinely need a shell

Sometimes you want expansion or a pipeline. Two ways to have it without giving up
PID 1:

```dockerfile
# Explicit: sh -c, but exec inside it so the real process takes over PID 1
CMD ["sh", "-c", "exec node server.js --port=${PORT:-3000}"]

# Better: let the application read the environment itself
CMD ["node", "server.js"]
```

The second is nearly always the right answer. Environment variables are readable
from inside any language; needing the *shell* to expand them into a command line
is usually a sign the configuration should be read by the program instead.

## `RUN` is the exception

**`RUN` wants shell form.** It needs `&&`, pipes and expansion, and PID 1 is
irrelevant at build time because nothing is being signalled
(page 02).

So the rule, stated as a pair worth memorising:

> **Shell form for `RUN`. Exec form for `CMD` and `ENTRYPOINT`.**

## JSON array syntax is strict

Exec form is parsed as JSON, so:

```dockerfile
CMD ["node", "server.js"]      # ✅
CMD ['node', 'server.js']      # ❌ single quotes are not JSON
CMD ["npm start"]              # ❌ one binary literally named "npm start"
CMD ["npm", "start"]           # ✅
```

The `["npm start"]` mistake produces `exec: "npm start": executable file not
found` — exit code 127
([Phase 1, page 09](../phase-1-running-containers/09-exit-codes.md)) — and reads
as if npm were missing.

## Podman

Identical parsing and identical signal behaviour. Under Podman the signal comes
from your CLI invocation or from systemd rather than a daemon, but PID 1 inside
the container behaves the same way, so exec form matters just as much.

## Gotchas

**Symptom:** `docker stop` always takes ten seconds.
**Cause:** Shell form put `sh` at PID 1, so `SIGTERM` was never delivered to your
application.
**Fix:** Exec form. This is the fastest-to-verify fix in the whole track — the
stop becomes immediate.

**Symptom:** An environment variable is not expanded in `CMD`.
**Cause:** Exec form does not invoke a shell, so `$VAR` is a literal string.
**Fix:** Read the variable inside the application, or use
`CMD ["sh", "-c", "exec …"]` if you truly need shell expansion.

**Symptom:** A distroless image fails with "no such file or directory" on start.
**Cause:** Shell form needs `/bin/sh`, which distroless images do not have.
**Fix:** Exec form. Distroless makes the mistake fail loudly instead of silently,
which is arguably a feature.

**Symptom:** `CMD ["npm start"]` gives exit 127 although npm is installed.
**Cause:** Exec form executes one binary whose name contains a space.
**Fix:** One array element per argument: `["npm", "start"]`.

## Interview questions

**★ What is the difference between exec form and shell form?**
Exec form (`["node","server.js"]`) runs the binary directly, making it PID 1.
Shell form (`node server.js`) runs `/bin/sh -c`, making `sh` PID 1 and your
process its child. Only exec form delivers signals to your application.

**★ Why does shell form break graceful shutdown?**
`docker stop` signals PID 1, which is `sh`. It does not forward `SIGTERM` and, as
PID 1 with no handler, is not terminated by it either. The full grace period
elapses and everything is `SIGKILL`ed — dropping in-flight work on every deploy.

**★ When is shell form the right choice?**
For `RUN`, where you need `&&`, pipes and expansion and PID 1 is irrelevant. For
`CMD`/`ENTRYPOINT`, only via an explicit `["sh","-c","exec …"]` when shell
expansion is genuinely required — and `exec` there restores PID 1 to the real
process.

**Why does `CMD ["npm start"]` fail?**
Exec form is a JSON array where each element is a separate argument. A single
element containing a space asks the kernel to execute a binary literally named
`npm start`, which does not exist — exit 127.

**How would you spot this problem in an unfamiliar service?**
Time a `docker stop`. A consistent ten seconds means `SIGTERM` is going nowhere —
either shell form, or an entrypoint script missing `exec "$@"`.

---

← Prev: [CMD versus ENTRYPOINT](05-cmd-vs-entrypoint.md) · Index: [Phase 3](README.md) · Next → [ENV versus ARG](07-env-vs-arg.md)
