---
title: "Namespaces — what the container can see"
sidebar_label: "02 · Namespaces"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html),
> [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html),
> [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html)
> and [Docker security](https://docs.docker.com/engine/security/). **No sandbox** —
> no console output on this page.

**A namespace wraps a global kernel resource so that the processes inside it see
their own private copy of it.** Eight kinds exist. A container is mostly a
process with a fresh set of them.

The reason this is worth memorising rather than skimming: **every confusing
container symptom maps to exactly one namespace.** Once you can name which, the
fix stops being guesswork.

## The eight namespaces

| Namespace | `CLONE_` flag | Isolates | The symptom it explains |
|---|---|---|---|
| **Mount** | `CLONE_NEWNS` | Mount points | The container's `/` is the image, not the host's |
| **PID** | `CLONE_NEWPID` | Process IDs | Your app is PID 1 inside, something else outside |
| **Network** | `CLONE_NEWNET` | Network devices, stacks, ports | Two containers both bind `:3000`; `localhost` is not your laptop |
| **UTS** | `CLONE_NEWUTS` | Hostname and NIS domain name | `hostname` inside returns the container ID |
| **IPC** | `CLONE_NEWIPC` | System V IPC, POSIX message queues | Shared-memory IPC does not cross the boundary |
| **User** | `CLONE_NEWUSER` | User and group IDs | Root inside is not root outside — the basis of rootless |
| **Cgroup** | `CLONE_NEWCGROUP` | The cgroup root directory | The container cannot see the host's cgroup layout |
| **Time** | `CLONE_NEWTIME` | Boot and monotonic clocks | Uptime inside can differ from the host's |

The `CLONE_NEW*` flags are what a runtime passes to `clone()` or `unshare()`.
`CLONE_NEWNS` is named for "new namespace" rather than "new mount" because it was
the **first** one to exist and the name predates there being others — a small
piece of history that shows up whenever you read kernel source.

The kernel exposes each one as a magic symlink under `/proc/<pid>/ns/`. Two
processes are in the same namespace if those links point at the same inode:

```bash
# Compare the host's namespaces with a container's
ls -l /proc/self/ns/
ls -l /proc/<container-host-pid>/ns/
```

Per namespaces(7), those `/proc/<pid>/ns/` handles arrived over several kernel
releases: IPC, network and UTS in Linux 3.0; mount, PID and user in 3.8; cgroup
in 4.6; time in 5.6. (The man page documents when the *handles* appeared, not
when each namespace type was first implemented — so treat those dates as "you
can inspect it from here onward", which is what matters in practice.)

## The four that do most of the work

### PID — your app is PID 1

Inside a new PID namespace, the first process gets PID 1 and can see only its own
descendants. The same process has a different, ordinary PID on the host.

Two consequences you will meet:

1. **PID 1 has special kernel semantics.** It does not get default signal
   handlers, so a process that ignores `SIGTERM` because it never installed a
   handler will simply *not stop* — and the engine kills it after the timeout.
   It is also expected to reap orphaned children. This is a whole topic in
   Phase 10.
2. **When PID 1 exits, the namespace dies** and every other process in it is
   killed. That is why "the container exited even though my worker was still
   running" — the worker was not PID 1.

### Network — its own everything

A new network namespace starts with nothing but a loopback interface: no
addresses, no routes, no ports. The engine then creates a `veth` pair, puts one
end inside, attaches the other to a bridge on the host, and hands out an IP.

This is the mechanism behind the single most common container bug, worth stating
plainly: **`localhost` inside a container means that container.** An API
configured with `DB_HOST=localhost` is looking for a database inside its own
network namespace, and there is not one there. Phase 7 is the full treatment.

### Mount — its own filesystem tree

The container gets a private mount table, so mounting or unmounting inside it
does not affect the host, and the host's mounts are invisible unless explicitly
passed in. Bind mounts and volumes are precisely the act of punching a hole in
this isolation on purpose.

### User — root that is not root

The user namespace maps UIDs inside to a different range outside. UID 0 in the
container can be UID 165536 on the host, so a process that believes it is root —
and behaves like it, inside — has the privileges of an unprivileged host user
outside.

This is what makes **rootless containers** possible, and it is also the source of
every "why is this file owned by 165536?" question. It gets its own page:
[Rootless containers](11-rootless.md).

## What is *not* namespaced — and why it bites

This list matters more than it looks:

- **The kernel itself.** One kernel, shared by every container. `uname -r`
  inside reports the host's kernel version, always.
- **`/proc/meminfo`, `/proc/cpuinfo`, load average.** Not namespaced. `free`,
  `top`, `nproc` and `os.cpus()` inside a container report **host** figures.
  Limits live in cgroups, and tools that do not read cgroups will mislead you.
- **The system clock.** The time namespace covers *boot and monotonic* clocks,
  not the wall clock. Containers share the host's wall-clock time.
- **Kernel parameters (`sysctl`).** Mostly global. A few are network-namespaced,
  which is why some `net.*` values can be set per container and most cannot.

The pattern: **namespaces virtualise names and tables, not hardware and not
numbers.** When something reports a host-level figure inside a container, ask
whether it reads a namespaced table (`/proc/<pid>`, network interfaces) or a
global one (`/proc/meminfo`).

## Seeing and entering a namespace

`nsenter` runs a command inside another process's namespaces — the tool behind
"debug a container that has no shell":

```bash
# Get the host-side PID of the container's main process
docker inspect --format '{{.State.Pid}}' myapp

# Enter its network namespace with the HOST's tools
sudo nsenter -t <pid> -n ip addr
sudo nsenter -t <pid> -n ss -tlnp
```

The flags select which namespaces to join: `-n` network, `-m` mount, `-p` PID,
`-u` UTS, `-i` IPC, `-U` user. Joining only the network namespace is the useful
default — you keep the host's binaries and see the container's network, which is
exactly what you want when the container image has no `ss`, no `curl` and no
shell.

Podman offers `podman unshare` for the mirror-image job: run a command inside
*your own* rootless user namespace, which is how you fix file ownership on a
rootless volume.

## Gotchas

**Symptom:** `nproc` inside the container returns 32 on a machine where you gave
the container 2 CPUs, and your thread pool sizes itself to 32.
**Cause:** CPU count is not namespaced. The application read the host's CPU
count.
**Fix:** Read the cgroup quota, or pass the intended concurrency explicitly via
an environment variable. Modern JVMs and some runtimes are container-aware and
read the cgroup; most libraries are not. This one silently wrecks performance
rather than failing loudly.

**Symptom:** Two containers cannot see each other's shared memory even though
both mount `/dev/shm`.
**Cause:** Separate IPC namespaces, and `/dev/shm` is per-container by default.
**Fix:** Share the IPC namespace deliberately (`--ipc=container:<name>` or
`--ipc=host`), or use a network protocol instead. Podman **pods** share IPC by
design, which is often the cleaner answer.

**Symptom:** A container "exits successfully" the moment it starts, even though
it launched a background daemon.
**Cause:** The foreground process — PID 1 — finished. The namespace was torn
down with it, taking the daemon with it.
**Fix:** Run the long-lived process in the foreground as PID 1. A container is
not a machine you start services on; it is one process you keep alive.

**Symptom:** `hostname` inside a container returns a random hex string and your
application logs are unreadable.
**Cause:** UTS namespace — the engine sets the hostname to the container ID by
default.
**Fix:** Pass `--hostname`, or in Compose set `hostname:`. Better, log a service
name you control rather than depending on the hostname.

## Interview questions

**★ Name the Linux namespaces and what each isolates.**
Mount (mount points), PID (process IDs), Network (interfaces, routes, ports),
UTS (hostname), IPC (System V IPC and POSIX message queues), User (UID/GID
mapping), Cgroup (the cgroup root), Time (boot and monotonic clocks).

**★ Why does `localhost` not work between two containers?**
Each has its own network namespace, so each has its own loopback interface.
`localhost` resolves inside the container, where the other service is not. Put
them on a user-defined network and use the service name, which resolves via the
engine's DNS.

**★ What is special about PID 1 in a container?**
The kernel treats it specially: no default signal handlers, so unhandled signals
are discarded rather than terminating the process, and it is expected to reap
orphans. In practice this means a process that never installed a `SIGTERM`
handler will not stop on `docker stop`, and will be `SIGKILL`ed after the
timeout.

**Why does `free -h` inside a container show the host's memory?**
`/proc/meminfo` is not namespaced. Memory limiting is a cgroups feature, not a
namespace feature, so the two are simply different mechanisms. Read
`/sys/fs/cgroup/memory.max` for the container's actual ceiling.

**How would you inspect a container's network when the image has no shell?**
`nsenter -t <host-pid> -n <command>` — join only the network namespace and use
the host's tooling. Get the host PID from
`docker inspect --format '{{.State.Pid}}'`. Alternatively attach a debug
container that shares the target's network namespace.

**What does the user namespace buy you?**
UID mapping: root inside maps to an unprivileged UID outside. It is the
foundation of rootless containers, and it means a container escape lands as a
normal user rather than as root — a genuine reduction in blast radius.

---

← Prev: [A container is a process](01-a-container-is-a-process.md) · Index: [Phase 0](README.md) · Next → [cgroups v2](03-cgroups.md)
