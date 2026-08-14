---
title: "Exit codes"
sidebar_label: "09 · Exit codes"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — running containers](https://docs.docker.com/engine/containers/run/),
> the moby PR that introduced the 125/126/127 convention
> ([moby#14012](https://github.com/moby/moby/pull/14012), shipped in Docker 1.10.0),
> [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) and
> [docker inspect](https://docs.docker.com/reference/cli/docker/inspect/).
> **No sandbox** — no console output on this page.

**The exit code tells you which layer failed, before you read a single log
line.** Two small ranges carry almost all the information: the 12x codes come
from the engine, and codes above 128 mean a signal killed the process.

## The table worth memorising

| Code | Meaning | Where the fault is |
|---|---|---|
| **0** | Success — the process finished | Nothing wrong |
| **1** | Generic application error | Your code |
| **125** | **`docker run` itself failed** | Your flags, or the engine |
| **126** | Command found but **could not be invoked** | Not executable, or wrong interpreter |
| **127** | Command **not found** | Wrong path, or missing from the image |
| **128+N** | Killed by **signal N** | See below |
| **137** | 128 + 9 → `SIGKILL` | OOM kill, `docker kill`, or stop timeout |
| **139** | 128 + 11 → `SIGSEGV` | Segfault — native crash |
| **143** | 128 + 15 → `SIGTERM` | Clean-ish stop that did not handle the signal |

The 125/126/127 convention follows the `chroot` precedent and exists precisely so
you can distinguish **Docker's** failures from the **contained command's** —
introduced in Docker 1.10.0.

```bash
docker ps -a                                              # STATUS shows it
docker inspect --format '{{.State.ExitCode}}' api
docker inspect --format '{{.State.OOMKilled}}' api        # the 137 disambiguator
docker wait api                                           # blocks, then prints it
```

## The three that matter most

### 125 — the engine refused

Nothing inside the container ran. The command line, a port conflict, a missing
volume, a bad flag, or the daemon itself is the problem. Read the CLI's error
message — at this stage there is one, because your process never started and
`docker logs` is empty.

### 127 — the command does not exist

By far the most common startup failure, and it usually means one of:

- The path is wrong: `CMD ["/app/server"]` when the binary is at
  `/usr/src/app/server`.
- The binary is not in the image at all — a multi-stage build that did not copy
  it.
- **Shell form quoting:** `CMD ["npm start"]` asks to execute one binary literally
  named `npm start`, spaces included. It must be `CMD ["npm", "start"]`.
- **Missing interpreter:** a script with `#!/bin/bash` in an Alpine image, which
  has `/bin/sh` but no bash. The kernel reports "not found" for the *interpreter*,
  which reads as if your script is missing.

That last one is genuinely misleading and costs people an hour the first time.

### 137 — killed, and the reason is ambiguous

`137` means `SIGKILL`, and there are three quite different causes:

1. **The kernel OOM killer** — the cgroup hit `memory.max`
   ([Phase 0, page 03](../phase-0-what-a-container-is/03-cgroups.md)).
2. **`docker kill`**, or `docker rm -f`.
3. **`docker stop` whose grace period expired** — the application ignored
   `SIGTERM` (page 08).

Disambiguate with one command:

```bash
docker inspect --format '{{.State.OOMKilled}}' api
```

`true` means the kernel did it. `false` with a `stop` in the history means the
grace period expired — the fix is a `SIGTERM` handler, not more memory. Getting
this wrong leads to raising the memory limit on a container that never had a
memory problem.

## 143 is usually fine, and a little sad

`143` means the process was terminated by `SIGTERM` and exited via the signal's
default disposition rather than a clean shutdown path. It is not a crash. It does
suggest the application did not handle the signal deliberately — a well-behaved
service catches `SIGTERM`, drains and exits **0**.

So: `0` after a stop means graceful shutdown implemented; `143` means it worked
by default; `137` means it did not work at all.

## Podman

Identical semantics — `podman inspect --format '{{.State.ExitCode}}'` and
`.State.OOMKilled` both exist. The 125/126/127 convention was aligned
deliberately (containers/podman#378), so scripts that branch on exit codes
transfer between engines.

## Gotchas

**Symptom:** `Exited (127)` and the binary is definitely in the image — you can
`ls` it.
**Cause:** The **interpreter** is missing, not the script. `#!/bin/bash` on
Alpine, or a dynamically-linked binary in a `scratch` image missing its loader.
**Fix:** Install bash, use `#!/bin/sh`, or build a static binary. Check with
`ldd` in a debug image.

**Symptom:** `Exited (126)`, and the file exists and is the right thing.
**Cause:** It is not executable, or has the wrong architecture.
**Fix:** `chmod +x` in the Dockerfile — `COPY` preserves the source's mode, so a
file that was not executable in your repo is not executable in the image. For
architecture, see the multi-arch material in Phase 2.

**Symptom:** Memory was doubled and the container still exits 137.
**Cause:** It was never an OOM kill — the stop grace period was expiring.
**Fix:** Check `.State.OOMKilled` **first**. If `false`, fix `SIGTERM` handling
(page 08). Adding memory to a signal-handling problem changes nothing.

**Symptom:** `docker run` prints an error and returns 125, and `docker logs` is
empty.
**Cause:** Correct — the container never started, so there is nothing to log.
**Fix:** Read the CLI's error text. It is the only place the information exists
at that stage.

## Interview questions

**★ What does exit code 137 mean, and how do you find the actual cause?**
128 + 9, so `SIGKILL`. It could be the kernel OOM killer, an explicit
`docker kill`, or a `docker stop` whose grace period expired. Check
`docker inspect --format '{{.State.OOMKilled}}'` — `true` means the kernel,
`false` after a stop means the application ignored `SIGTERM`.

**★ What is the difference between exit codes 125, 126 and 127?**
125 means `docker run` itself failed, so nothing inside ran. 126 means the
command was found but could not be invoked — not executable, or wrong
architecture. 127 means the command was not found, which includes a missing
interpreter for a script.

**★ A container exits 127 but you can see the binary in the image. Why?**
Almost always the interpreter: a `#!/bin/bash` shebang on an image that only has
`/bin/sh`, or a dynamically-linked binary whose loader is absent. The kernel
reports "not found" for the interpreter, which reads as if the script itself were
missing.

**What does exit code 143 tell you?**
The process was terminated by `SIGTERM` via the default disposition rather than a
deliberate shutdown path. Not a crash, but a sign that graceful shutdown is not
implemented — a well-behaved service catches `SIGTERM` and exits 0.

**Why is `docker logs` empty when the exit code is 125?**
Because the container never started. 125 is the engine refusing — bad flags, port
conflict, missing volume — so there was no process to produce output. The CLI's
error message is the whole story.

---

← Prev: [Stop is two signals](08-stop-is-two-signals.md) · Index: [Phase 1](README.md) · Next → [Interactive and TTY](10-interactive-and-tty.md)
