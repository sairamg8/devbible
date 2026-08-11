---
title: "child_process"
sidebar_label: "19 · child_process"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Four functions that look interchangeable and are not. `spawn` streams,
`exec` runs a shell and buffers, `execFile` skips the shell, `fork` starts another
Node process with a message channel. Picking wrong gives you either a memory limit
you did not know about or a shell injection.**

| | Shell? | Output | Use for |
|---|---|---|---|
| `spawn` | ❌ | **Streams** | Long-running or large output — ffmpeg, tar, a log tail |
| `exec` | ✅ | Buffered, `maxBuffer` **1 MB** | Never with untrusted input. Only when you genuinely need pipes or globs |
| `execFile` | ❌ | Buffered, `maxBuffer` 1 MB | Running one binary with arguments — **the default choice** |
| `fork` | ❌ | Streams + **IPC** | Another Node script you want to talk to ([page 21](21-ipc.md)) |

## `spawn` — streams, no limits

```js
const child = spawn('node', ['-e', 'for(let i=0;i<3;i++) console.log("line",i); console.error("to stderr")']);
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => process.stdout.write(`stderr: ${d}`));
child.on('close', (code, signal) => log({ code, signal }));
```

```console
$ node cp.mjs
  spawn stderr: to stderr
  spawn: code=0 signal=null stdout="line 0\nline 1\nline 2\n"
```

`stdout` and `stderr` are readable streams, so output is bounded by what you do
with it, not by a buffer size. Everything from
[Phase 3](../phase-3-buffers-streams/10-pipeline.md) applies — including that the
child blocks once a pipe fills if nobody reads it.

Use `spawn` when output can be large or when you want it as it happens.

## `exec` — a shell, and a 1 MB cliff

```console
$ node cp.mjs
  exec: "shell features work: 42\nagent.mjs\nbody.mjs\n"
  exec 2MB output -> ERR_CHILD_PROCESS_STDIO_MAXBUFFER | stdout maxBuffer length exceeded
  exec with maxBuffer:10e6 -> got 2000000 bytes
```

`exec` runs the string through `/bin/sh -c`, so pipes, globs, `&&` and `$(…)` all
work — and the child is killed the moment output passes `maxBuffer`, **1 MB by
default**. That is a command which works on your machine and fails in production
when the log file gets bigger.

Two consequences: raise `maxBuffer` if you know the ceiling, and use `spawn` if
you do not. And never interpolate user input into the string
([page 20](20-shell-injection.md)).

## `execFile` — the one to reach for

```js
const { stdout } = await promisify(execFile)('node', ['-e', 'console.log("execFile ran node directly")']);
```

No shell process, so nothing interprets metacharacters and there is one less
process in the tree. Arguments are passed as an array straight to `execve`. Unless
you specifically need shell features, this is the correct default.

## Exit codes and signals

```console
$ node cp.mjs
  child exit 3 -> err.code = 3 | killed = false
  killed child -> code=null signal=SIGKILL
```

The promisified forms **reject on a non-zero exit**, with `err.code` carrying the
exit status and `err.stdout` / `err.stderr` carrying whatever was produced — read
them, since the diagnostic is usually in stderr.

On `'close'`, exactly one of `code` and `signal` is non-null: a normal exit gives
`(3, null)`, a killed process gives `(null, 'SIGKILL')`. Code that only checks
`code === 0` treats a killed child as a failure with no explanation.

## Running one safely

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function thumbnail(inputPath, outputPath) {
  const { stdout, stderr } = await run(
    'ffmpeg',
    ['-i', inputPath, '-vf', 'scale=320:-1', '-frames:v', '1', outputPath],
    {
      timeout: 30_000,             // kills the child if it overruns
      killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024,
      cwd: workDir,
      env: { PATH: '/usr/bin:/bin' },        // do NOT inherit the whole environment
      windowsHide: true,
    },
  );
  return { stdout, stderr };
}
```

`timeout` is the option people forget: without it a hung child holds a handle
forever. And a child **inherits `process.env` by default**, which hands your
database URL and API keys to an image converter — pass an explicit minimal `env`
for anything you did not write.

## Cost, and the alternative

Spawning is expensive: a fork, an exec, and a whole new V8 instance if it is Node
— measured at a **median 56 ms to ready and ~49 MB RSS** per process. Per HTTP
request that is not a rounding error. If you are shelling out to do CPU work in
JavaScript, use a **worker thread** instead ([page 24](24-worker-threads.md)):
startup is comparable, but four threads cost ~23 MB against ~196 MB for four
processes, and they can share memory. Child processes earn their keep when the
work is *another program*, or when crash isolation is the point.

Also bound how many run at once. Unbounded `spawn` per request is a fork bomb with
extra steps; the same bounded-concurrency pattern from
[Phase 2](../phase-2-async/14-concurrency-control.md) applies.

## Gotchas

**Symptom:** `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`
**Cause:** Output exceeded `exec`'s 1 MB default.
**Fix:** Raise `maxBuffer`, or switch to `spawn`.

**Symptom:** A child hangs and the parent never resolves
**Cause:** No `timeout`, or a full stdout pipe nobody is reading.
**Fix:** Set `timeout`; consume the streams.

**Symptom:** Secrets appear in a subprocess's environment
**Cause:** `env` is inherited by default.
**Fix:** Pass an explicit minimal `env`.

**Symptom:** A command works in the terminal and fails from Node
**Cause:** `execFile`/`spawn` do not use a shell, so `PATH` lookup, globs and `~`
behave differently.
**Fix:** Absolute paths and explicit arguments — not `shell: true`.

**Symptom:** A killed child is reported as a plain failure
**Cause:** Only `code` was checked; it is `null` when a signal ended the process.
**Fix:** Check `signal` too.

**Symptom:** Memory and CPU spike under load in a service that shells out
**Cause:** One process spawned per request, unbounded.
**Fix:** Bound concurrency, or use a worker pool.

## Interview questions

**★ `exec` versus `execFile` versus `spawn`?**
`exec` runs the command string through a shell and buffers the output with a 1 MB
default limit. `execFile` runs a binary directly with an argument array — no shell,
so no injection — and buffers the same way. `spawn` also skips the shell and gives
you streams instead of buffers, so output size is unbounded. Default to
`execFile`; use `spawn` for large or streaming output.

**★ What is `maxBuffer` and how does it fail?**
The cap on buffered stdout/stderr for `exec` and `execFile`, 1 MB by default.
Exceeding it kills the child and rejects with
`ERR_CHILD_PROCESS_STDIO_MAXBUFFER` — a failure that appears only once real data
gets large.

**★ Why pass an explicit `env`?**
Children inherit the parent's entire environment, so every secret in
`process.env` is handed to whatever you spawn. A minimal `env` with just `PATH`
limits the blast radius of a compromised or misbehaving binary.

**★ When is a child process the wrong tool?**
When the work is JavaScript. Each one is a fork plus a fresh V8 instance — about
49 MB RSS and ~56 ms to ready. Worker threads reach ready in about the same time
but cost roughly 6 MB each and can share memory, so for in-process CPU work they
win on every axis. Child processes are for running other programs, or for crash
isolation.

**How do you tell a normal exit from a killed child?**
On `'close'`, `code` is the exit status and `signal` is null for a normal exit;
for a killed process `code` is null and `signal` names the signal. Checking only
`code` misreports a kill.

**Why can a child hang even after its work is done?**
If nobody reads its stdout, the pipe fills and the child blocks on `write`. With
`spawn` you must consume the streams.

---

← Prev: [Crash handlers](18-crash-handlers.md) · Next → [Shell injection](20-shell-injection.md)
