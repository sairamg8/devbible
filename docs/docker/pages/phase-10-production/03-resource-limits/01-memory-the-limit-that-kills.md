---
title: "Memory — the limit that kills"
sidebar_label: "01 · Memory — the limit that kills"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Docker — resource constraints](https://docs.docker.com/engine/containers/resource_constraints/),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [docker inspect](https://docs.docker.com/reference/cli/docker/inspect/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.html) and the Node.js
> [`os`](https://nodejs.org/api/os.html) documentation. **No sandbox** — no console
> output on this page.

**A memory limit is enforced by killing your process. A CPU limit is enforced by
slowing it down.** That asymmetry is the whole of this topic: it decides which
symptom you get, which evidence exists afterwards, and how much headroom each
limit needs.

This chunk is the killing one.

## What the limit actually is

`--memory` writes a number into the container's memory cgroup
([Phase 0 — cgroups](../../phase-0-what-a-container-is/03-cgroups.md)) — `memory.max`
under cgroup v2. When the processes in that cgroup need more than the limit and
the kernel cannot reclaim enough (page cache it can drop, pages it can swap), it
invokes the **OOM killer scoped to that cgroup** and `SIGKILL`s a process inside
it.

Three consequences follow immediately, and each is a thing people find
surprising:

- **The victim is chosen by the kernel, not by you**, and it is usually the
  largest consumer — which in a one-process container is your application, which
  is PID 1. PID 1 dying takes the namespace with it
  ([topic 01, rule 3](../01-pid-1/01-what-the-kernel-does.md)), so the container
  is over.
- **`SIGKILL` cannot be caught.** No handler, no stack trace, no shutdown log, no
  final flush. Your logs simply stop mid-sentence. That is the literal answer to
  "the process just vanished".
- **It is a container-local event.** The host is not out of memory; this cgroup
  is. `free -m` on the host looks fine and tells you nothing.

## The evidence, and how to tell 137 apart from 137

Exit **137** is `128 + 9` — killed by `SIGKILL`
([Phase 1 — exit codes](../../phase-1-running-containers/09-exit-codes.md)) — and
at least three unrelated things produce it. One field separates them:

```bash
docker inspect --format '{{.State.ExitCode}} oom={{.State.OOMKilled}}' api
docker events --filter 'event=oom'          # while it is happening
```

| Evidence | Cause |
|---|---|
| Exit 137, `OOMKilled=true` | The cgroup hit its memory limit |
| Exit 137, `OOMKilled=false`, after a `stop` | The grace period expired ([topic 02](../02-graceful-shutdown/README.md)) |
| Exit 137, `OOMKilled=false`, no stop | Someone ran `docker kill`, or a supervisor did |

On the host, the kernel also logs the kill — `dmesg` or the journal carries an
OOM report naming the cgroup and the task it chose. That is the authoritative
record when `OOMKilled` is ambiguous, and it is on the **host**, not in
`docker logs`, because the container was killed rather than asked to leave.

⚠️ **A container that gets OOM-killed and then restarts looks like a crash loop
with no cause.** With `restart: always` the evidence is the *previous* exit, and
`docker inspect` shows only the latest. Check the exit of the run that failed —
`docker events`, or your log pipeline — before concluding the application is
crashing on its own.

## The flags

```bash
docker run -m 512m --memory-swap 512m --memory-reservation 256m myimage
podman run -m 512m --memory-swap 512m myimage
```

| Flag | What it does |
|---|---|
| `-m` / `--memory` | The hard limit. **Minimum allowed is `6m`** |
| `--memory-swap` | Memory **plus** swap combined — not swap on its own |
| `--memory-reservation` | A **soft** limit, applied when the host is under memory pressure |
| `--oom-kill-disable` | Stops the kernel killing — see the warning below |

### `--memory-swap` is the one that reads wrong

It sets the **combined** total, which makes every value counter-intuitive until
you have the table:

| `--memory` | `--memory-swap` | Result |
|---|---|---|
| `300m` | `1g` | 300m memory + **700m** swap |
| `300m` | `300m` | **No swap at all** |
| `300m` | `-1` | Unlimited swap, up to what the host has |
| `300m` | unset | The container may use **as much swap again** — 300m + 300m |
| any | `0` | Treated as unset |

**Setting `--memory-swap` equal to `--memory` is usually what you want in
production.** Otherwise a leak does not fail fast — it swaps, and you get a
container that is technically alive and unusably slow, which is worse to diagnose
than a clean 137.

### `--memory-reservation` is a soft limit

It does not kill. It tells the kernel which cgroups to reclaim from first when
the **host** is under pressure, so it is a way of expressing "this container's
normal working set is 256m, even though its ceiling is 512m". Useful on a
packed host; irrelevant on an idle one.

### `--oom-kill-disable` is almost always the wrong answer

⛔ With the killer disabled, processes that hit the limit are **frozen** rather
than killed — the container neither serves nor exits, and no restart policy
fires because nothing died. You have converted a loud, diagnosable failure into a
silent hang. It exists for narrow cases where a hang is genuinely preferable and
someone is watching. It is not a fix for "the container keeps getting OOM-killed";
that is a sizing or leak problem.

## Sizing the limit: the runtime does not know

The limit is not the heap. It has to cover the heap **and** everything else the
process has mapped: native allocations, buffers, thread stacks, the runtime
itself, and anything the container writes to a `tmpfs`, which is charged to the
same cgroup.

The harder half is that language runtimes size themselves from what they believe
the machine has, and a container is not a machine:

- **Node** reports host figures through `os.totalmem()`, and its default heap
  ceiling comes from what the runtime detects as available memory. Detection of
  cgroup limits has been imperfect in practice — libuv's constrained-memory
  support has lagged cgroup v2 (nodejs/node#47259) — so **do not rely on
  autodetection**. Set the ceiling explicitly, and leave the container limit
  meaningfully above it:

  ```dockerfile
  ENV NODE_OPTIONS="--max-old-space-size=384"   # with -m 512m
  ```

  The gap is not slack. It is the non-heap memory that the flag does not govern,
  and a heap ceiling equal to the container limit guarantees the OOM killer wins
  the race against the garbage collector.

- **The JVM** has read cgroup limits since container support became the default
  in JDK 10; prefer `-XX:MaxRAMPercentage` over a fixed `-Xmx` so the same image
  is correct at any limit.

⚠️ **The pathological version is a heap ceiling above the container limit.** The
collector believes it has room, so it does not collect aggressively; the cgroup
disagrees, and the process is killed while the runtime still thinks everything is
fine. The application logs will contain nothing at all.

## Setting it where the container actually runs

```yaml
services:
  api:
    mem_limit: 512m               # Compose short form
    memswap_limit: 512m
    deploy:
      resources:
        limits:   {memory: 512M}
        reservations: {memory: 256M}
```

Under systemd — Quadlet or a unit wrapping the engine — the same limit is
`MemoryMax=`, with `MemoryHigh=` as the throttling soft limit (Phase 11). As with
the stop timeout, **the number has to be set in every place the image runs**, and
the bug is usually the mismatch rather than any single value.

## Podman

Identical flags and identical kernel behaviour, with one caveat that matters on a
developer machine: `--memory` and its relatives are **not supported on cgroups v1
rootless systems**, per `podman-run(1)`. Podman 6 removed cgroups v1 support
altogether, so on a current system the question is settled — but on an older
rootless host, a memory limit you set may simply not be in force, which is a far
worse failure than being refused.

## Gotchas

**Symptom:** The container dies with no log line, no stack trace and no shutdown
message. Exit 137.
**Cause:** OOM kill. `SIGKILL` is uncatchable, so nothing your code would have
logged ever ran.
**Fix:** Confirm with `.State.OOMKilled`, then either raise the limit or fix the
leak. Never conclude "the app crashed" from a silent 137.

**Symptom:** The container is alive, responds to nothing, and the host is
thrashing.
**Cause:** Swap. `--memory-swap` was left unset, so the container may use as much
swap again as its memory limit.
**Fix:** `--memory-swap` equal to `--memory`, so the failure is a fast kill
rather than a slow death.

**Symptom:** Node is killed at 512m while `--max-old-space-size=512` says the
heap is nowhere near full.
**Cause:** The flag caps the old space only. Buffers, native memory and thread
stacks are outside it, and all of them are charged to the cgroup.
**Fix:** Heap ceiling meaningfully below the container limit — and set it
explicitly rather than trusting detection.

**Symptom:** After adding `--oom-kill-disable`, containers stopped dying and
started hanging forever.
**Cause:** That is what the flag does — the processes are frozen at the limit
instead of killed, so nothing exits and no restart policy fires.
**Fix:** Remove it. A clean 137 with a restart is a better production outcome
than a wedged container.

## Interview questions

**★ What happens when a container exceeds its memory limit?**
The kernel's OOM killer, scoped to that container's cgroup, `SIGKILL`s a process
in it — usually the largest, which is normally your application at PID 1. PID 1
dying ends the namespace, so the container exits **137**. Nothing is catchable
and nothing is logged by the application.

**★ You see exit 137. Name three causes and how you distinguish them.**
An OOM kill, a stop timeout after an ignored `SIGTERM`, or an explicit
`docker kill`. `docker inspect`'s `.State.OOMKilled` identifies the first;
whether a stop was in progress distinguishes the other two. The host's kernel log
carries the OOM report as confirmation.

**★ Why must the container memory limit be larger than the runtime's heap
limit?**
Because the cgroup charges everything — native allocations, buffers, thread
stacks, the runtime itself, `tmpfs` writes — while the heap flag governs only the
managed heap. Setting them equal means the OOM killer fires before the collector
has any reason to work harder.

**What does `--memory-swap` control?**
Memory **plus** swap combined, not swap alone. Equal to `--memory` means no swap;
unset means the container may use as much swap again as its memory limit; `-1`
means unlimited. Equal is the usual production choice, because it makes a leak
fail fast instead of degrading.

**Is `--oom-kill-disable` a reasonable way to stop containers being killed?**
No. It freezes processes at the limit instead of killing them, so the container
neither serves nor exits and no restart policy fires. It replaces a loud failure
with a silent hang.

**Why does `free` on the host show plenty of memory while a container is being
OOM-killed?**
Because the limit is per-cgroup. The container hit *its* ceiling; the host has
not hit its own. Host-level metrics cannot detect a container-level OOM, which is
why `.State.OOMKilled` and the kernel log are the evidence.

---

[Topic index](README.md) · [02 · CPU and PIDs — the limits that throttle](02-cpu-and-pids.md) →
