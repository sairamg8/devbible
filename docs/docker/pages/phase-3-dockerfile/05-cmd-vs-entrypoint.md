---
title: "CMD versus ENTRYPOINT"
sidebar_label: "05 · CMD versus ENTRYPOINT"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the [Dockerfile reference — CMD](https://docs.docker.com/reference/dockerfile/#cmd),
> [Dockerfile reference — ENTRYPOINT](https://docs.docker.com/reference/dockerfile/#entrypoint) and
> [Docker — understand how CMD and ENTRYPOINT interact](https://docs.docker.com/reference/dockerfile/#understand-how-cmd-and-entrypoint-interact).
> **No sandbox** — no console output on this page.

**`ENTRYPOINT` is the program. `CMD` is its default arguments.** Hold that one
sentence and every combination follows, including the ones that look like bugs.

[Phase 1, page 11](../phase-1-running-containers/11-overriding-entrypoint.md)
covered overriding these at run time. This page is about **authoring** them.

## The four combinations

| `ENTRYPOINT` | `CMD` | Container runs |
|---|---|---|
| — | `["node","server.js"]` | `node server.js` |
| `["node"]` | `["server.js"]` | `node server.js` |
| `["node","server.js"]` | — | `node server.js` |
| `["node","server.js"]` | `["--verbose"]` | `node server.js --verbose` |

All four produce the same process in the simple case. They differ entirely in
**what a user can override**:

| Author writes | User types | Result |
|---|---|---|
| `CMD` only | `docker run img sh` | `sh` — fully replaceable |
| `ENTRYPOINT` only | `docker run img sh` | `node server.js sh` — `sh` became an argument |
| Both | `docker run img --port=4000` | `node server.js --port=4000` |

## Which to choose

**`CMD` alone** — for an application image where a user may legitimately want to
run something else: a shell, a migration, a one-off script.

```dockerfile
CMD ["node", "server.js"]
```

Most official language images do this, and it is why `docker run node:24 sh`
works. **Default to it.**

**`ENTRYPOINT` + `CMD`** — for a tool image that *is* a command, where trailing
arguments should go to that command:

```dockerfile
ENTRYPOINT ["curl"]
CMD ["--help"]
# docker run mycurl https://example.com  →  curl https://example.com
```

The image behaves like the binary. `--entrypoint` is still available for anyone
who needs to escape it.

**`ENTRYPOINT` as a script** — for setup that must happen before the real
command, whatever that command is:

```dockerfile
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

```bash
#!/bin/sh
set -e
# ... setup: wait for a dependency, render config, fix permissions ...
exec "$@"          # ← hand PID 1 to the real command
```

🔴 **`exec "$@"` is the last line of every correct entrypoint script.** Without
`exec`, the shell stays PID 1, does not forward `SIGTERM`, and every `docker
stop` waits out the full grace period before `SIGKILL`
([Phase 1, page 08](../phase-1-running-containers/08-stop-is-two-signals.md)).
This is the most common bug in hand-written entrypoint scripts, and its symptom
is a suspiciously round ten-second stop.

## Always exec form for both

```dockerfile
CMD ["node", "server.js"]          # ✅ your process is PID 1
CMD node server.js                 # ❌ /bin/sh -c "node server.js"
```

Shell form wraps the command in `/bin/sh -c`, so `sh` becomes PID 1 and your
process is its child. `sh` does not forward signals. The consequences —
`SIGTERM` never reaching your application, ten-second stops, dropped in-flight
requests — are page 06's subject, and they are the reason this rule is absolute
for `CMD` and `ENTRYPOINT` even though `RUN` is the opposite.

## Overriding an inherited `ENTRYPOINT`

A base image's `ENTRYPOINT` is inherited (page 01). To clear it:

```dockerfile
ENTRYPOINT []
CMD ["node", "server.js"]
```

Without the empty `ENTRYPOINT`, your `CMD` becomes arguments to the base's
entrypoint — the cause of "my `CMD` is being ignored".

## Podman

Identical semantics and inheritance. `podman run --entrypoint` behaves the same
way, including the empty-string form for clearing it.

## Gotchas

**Symptom:** `docker run myimage sh` prints your application's usage message.
**Cause:** The image sets `ENTRYPOINT`, so `sh` was passed to it as an argument.
**Fix:** Use `--entrypoint sh` to debug. If users need this often, the image
should be using `CMD` instead.

**Symptom:** Every stop takes exactly ten seconds.
**Cause:** Shell form, or an entrypoint script without `exec`. `sh` is PID 1 and
swallows `SIGTERM`.
**Fix:** Exec form, and `exec "$@"` at the end of the script.

**Symptom:** Your `CMD` appears to be ignored.
**Cause:** The base image sets an `ENTRYPOINT`, so `CMD` became its arguments.
**Fix:** `ENTRYPOINT []` before your `CMD`, or set your own `ENTRYPOINT`.

**Symptom:** `CMD ["npm start"]` fails with "not found" although npm is
installed.
**Cause:** Exec form executes one binary named literally `npm start`, spaces
included.
**Fix:** `CMD ["npm", "start"]`. Each argument is its own array element.

## Interview questions

**★ What is the difference between `CMD` and `ENTRYPOINT`?**
`ENTRYPOINT` is the program, `CMD` its default arguments. Trailing arguments at
run time replace `CMD`; `--entrypoint` replaces `ENTRYPOINT`. With `CMD` alone an
image is easy to override; with `ENTRYPOINT` it behaves like a command.

**★ When would you use both together?**
For a tool image that *is* a command, so trailing arguments flow to it
(`ENTRYPOINT ["curl"]`, `CMD ["--help"]`), or for an entrypoint script that does
setup and then `exec "$@"` to run whatever `CMD` — or the user — supplied.

**★ Why must `CMD` and `ENTRYPOINT` use exec form?**
Shell form wraps the command in `/bin/sh -c`, making `sh` PID 1. It does not
forward `SIGTERM`, so the application never receives it and every stop waits out
the grace period before `SIGKILL`.

**Why is `exec "$@"` required at the end of an entrypoint script?**
So the real command replaces the shell as PID 1 and receives signals directly.
Without it the shell remains PID 1 and swallows `SIGTERM` — the ten-second-stop
symptom.

**How do you clear an `ENTRYPOINT` inherited from a base image?**
`ENTRYPOINT []` in your Dockerfile, or `--entrypoint ""` at run time. Otherwise
your `CMD` is passed to the base's entrypoint as arguments.

---

← Prev: [WORKDIR](04-workdir.md) · Index: [Phase 3](README.md) · Next → [Exec form versus shell form](06-exec-vs-shell-form.md)
