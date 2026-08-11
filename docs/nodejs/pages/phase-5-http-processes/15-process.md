---
title: "The process object and exit codes"
sidebar_label: "15 · The process object"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`process` is the boundary between your code and the operating system: the
arguments it was started with, the environment it inherited, the streams it writes
to, and the number it leaves behind. That number is the only thing an orchestrator
reads.**

## What you get

```console
$ node proc.mjs --port 8080 -v extra
argv[0]: node
argv[1]: proc.mjs
argv[2+]: ["--port","8080","-v","extra"]
cwd: p5
pid: number | ppid: number
env.PATH is a string? string
env coerces to string: "42"
missing env: undefined
stdout.isTTY: undefined
```

| | |
|---|---|
| `process.argv` | Always `[execPath, scriptPath, ...yourArgs]`. **`slice(2)`** is not optional — parse with [page 22](22-parseargs.md) |
| `process.env` | Every value is a **string**; assigning `42` stores `"42"`. Missing keys are `undefined`, never `null` |
| `process.cwd()` | Where the process was *started*, not where the script lives. For the script's own directory use `import.meta.dirname` |
| `process.pid` / `ppid` | Own and parent pid |
| `process.execPath` / `execArgv` | The Node binary, and the flags it was given ([Phase 0](../phase-0-runtime-model/08-running-node.md)) |
| `process.uptime()` / `memoryUsage()` / `resourceUsage()` | Health-endpoint material |

Config comes from `env`, and every value needs validating at boot rather than at
first use:

```js
const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
function required(name) {
  const v = process.env[name];
  if (!v) { console.error(`missing required env var ${name}`); process.exit(78); }
  return v;
}
```

Failing at boot turns a misconfiguration into a crash-loop the orchestrator
reports immediately, instead of a `TypeError` three hours later on an uncommon
code path. `process.env` reads are also surprisingly slow — it is a native call
into the environment block, not a plain object — so read once into a config object.

## `process.exitCode` versus `process.exit()`

```console
$ node exit1.mjs                                  $ node exit2.mjs
set exitCode = 3, letting the loop drain          calling process.exit(3) now
timer ran                                         exit event, code 3
exit event, code 3                                exit2 status=3
exit1 status=3
```

Same exit status, different amount of work finished. **`process.exit()` terminates
immediately** — the pending timer never ran. `process.exitCode = 3` records the
status and lets the event loop drain naturally.

It gets worse than a skipped timer, because writes to a pipe are asynchronous:

```console
$ node trunc3.mjs 2>/dev/null | wc -c      # writes 10 MB, then exit(0)
bytes actually received: 65536
$ node trunc3.mjs 2>&1 >/dev/null
write() returned, calling exit immediately
```

10 MB written, **65 536 bytes delivered** — one pipe buffer — and the write
callback never fired. Logs vanish exactly when you need them, and only when
stdout is a pipe, which is to say only in production.

Interestingly, a loop of many *small* writes does survive: 200 000 lines through a
pipe all arrived. It is the single large pending write that gets cut. So "it
worked when I tested it" proves nothing here.

**Set `process.exitCode` and return.** Reserve `process.exit()` for the moment
after a deliberate shutdown has finished, or for a startup failure where nothing
is buffered yet.

## Exit codes an orchestrator reads

| Code | Meaning |
|---|---|
| `0` | Success. The only code that means "do not restart me" |
| `1` | Uncaught exception — Node's default for a fatal error |
| `2` | Reserved by bash for shell misuse; avoid |
| `3`–`125` | Yours. `78` (`EX_CONFIG`) for a config error is a useful convention |
| `126` / `127` | Not executable / not found — from the shell, not from Node |
| `128 + n` | Killed by signal *n* |

```console
$ node nosig.mjs & kill -TERM $!     -> status=143      # 128 + 15
$ node nosig.mjs & kill -KILL $!     -> status=137      # 128 + 9
```

**137 is the one to recognise**: SIGKILL, and in Kubernetes that is almost always
the OOM killer or a shutdown that overran its grace period
([page 17](17-graceful-shutdown.md)). 143 is a normal SIGTERM shutdown that did
not install a handler.

`process.on('exit')` fires for both paths but is **synchronous only** — an
`await`, a timer or an I/O callback registered there never runs. It is for
last-gasp synchronous logging, nothing else.

## stdout and stderr

They are streams, and their blocking behaviour depends on what they point at —
which is why the truncation above only happens on a pipe:

| Destination | Behaviour |
|---|---|
| TTY | Synchronous |
| File | Synchronous |
| **Pipe** (`node app.js \| tee`, Docker, systemd) | **Asynchronous** |

`console.log` writes to stdout, `console.error` to stderr. Keep them separate:
stdout is for the program's output, stderr for diagnostics, so `app > data.json`
still shows you the errors. In a container both are collected, so the real reason
to care is that a structured logger (`pino`) writes stdout while a crash trace goes
to stderr.

`console.log` also serialises objects with `util.inspect`, which walks the whole
structure — cheap in a script, measurable in a hot path. That is one of the
reasons production logging goes through a real logger rather than `console`.

## Gotchas

**Symptom:** Logs are truncated when the process exits
**Cause:** `process.exit()` with a large pending write to a pipe.
**Fix:** `process.exitCode` and let the loop drain.

**Symptom:** Cleanup registered in `process.on('exit')` never runs
**Cause:** The handler is synchronous-only.
**Fix:** Do cleanup in the signal handler ([page 16](16-signals.md)).

**Symptom:** `process.argv[0]` is the Node binary, not your first argument
**Cause:** The array always starts with execPath and script path.
**Fix:** `process.argv.slice(2)`.

**Symptom:** A numeric env var compares wrong — `PORT > 1024` is false
**Cause:** Every `process.env` value is a string.
**Fix:** Coerce explicitly, and validate at boot.

**Symptom:** Relative paths break when the app is started from another directory
**Cause:** `process.cwd()` is the launch directory, not the script's.
**Fix:** `import.meta.dirname` ([Phase 4](../phase-4-filesystem/03-path.md)).

**Symptom:** A pod restarts with exit code 137
**Cause:** SIGKILL — OOM, or a grace period that expired mid-shutdown.
**Fix:** Check memory limits first, then shutdown timing.

## Interview questions

**★ `process.exit()` or `process.exitCode`?**
`exitCode` in almost every case. `exit()` terminates immediately: pending timers,
I/O callbacks and — critically — buffered writes to a pipe are discarded.
Measured: a 10 MB write followed by `exit(0)` delivered 65 536 bytes and the write
callback never fired.

**★ What does exit code 137 tell you?**
The process was killed by signal 9 (128 + 9). In a container that is the OOM
killer, or the runtime escalating after the SIGTERM grace period expired. It is
never something the application chose.

**★ Why is `process.env` not just an object?**
Each access reads the real process environment through a native call, so it is far
slower than a property read and the values are always strings. Read the variables
once at startup into a validated config object.

**★ Why does `process.on('exit')` fail to flush anything asynchronous?**
Because the event loop is already finished. Only synchronous work in that handler
runs; anything scheduled is discarded. Asynchronous cleanup belongs in the signal
handler, before you decide to exit.

**Why does stdout behave differently in Docker than on your terminal?**
On a TTY it is synchronous; through a pipe — which is what a container runtime,
systemd or `| tee` gives you — it is asynchronous and can be lost on an abrupt
exit.

**What exit code should a missing environment variable produce?**
Any non-zero one, chosen deliberately and failing at boot. `78` (`EX_CONFIG`) is a
common convention, and the value matters less than crashing immediately rather
than failing later on an uncommon path.

---

← Prev: [node:http2](14-http2.md) · Next → [Signals](16-signals.md)
