---
title: "A container is a process"
sidebar_label: "01 · A container is a process"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html),
> [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.7.html), the
> [OCI Runtime Specification](https://github.com/opencontainers/runtime-spec/blob/main/spec.md)
> and [Docker security](https://docs.docker.com/engine/security/).
> **No sandbox** — commands are shown as commands, and this page carries no
> console output.

**A container is an ordinary Linux process that has been lied to about what it
can see, and limited in what it can use.** That is the whole idea. Everything
else in this track is a consequence of that sentence.

## There is no "container" in the kernel

This is the part that surprises people, so it is worth being blunt about:

**The Linux kernel has no container object.** There is no `struct container`, no
`create_container()` system call, no container ID that the kernel knows about.
If you go looking for the thing your container "is", you will not find it.

What the kernel has is three older, independent features:

| Feature | Question it answers | What it gives a container |
|---|---|---|
| **Namespaces** | *What can this process see?* | Its own process list, its own network stack, its own hostname, its own mounts |
| **cgroups** | *What may this process use?* | A memory ceiling, a CPU share, a limit on how many processes it can spawn |
| **A root filesystem** | *What files exist?* | The image's contents, made the process's `/` |

A container is what you get when you start a process with all three applied at
once. Docker and Podman are, at bottom, programs that assemble those three
things correctly and then call `execve()`.

The proof is that the process is visible from the host like any other:

```bash
# On the host, while a container is running
ps -ef | grep -v grep | grep nginx
```

You will find the containerised process in the host's process table, with a
normal host PID. It is not hiding inside anything. It is *right there*, running
next to your text editor — it simply cannot see your text editor, because it is
in a different PID namespace.

## The three ingredients, one level down

### Namespaces — what it sees

A namespace is a wrapper around a global kernel resource that makes the
processes inside it believe they have their own private copy. There are eight,
and a container typically gets most of them:

- **PID** — the container's first process is PID 1 *inside*, while the host sees
  some other number. `ps aux` inside shows only the container's own processes.
- **Network** — its own interfaces, routing table, iptables rules and port
  space. This is why two containers can both listen on port 3000.
- **Mount** — its own view of the filesystem tree.
- **UTS** — its own hostname.
- **IPC** — its own System V IPC and POSIX message queues.
- **User** — its own UID/GID mapping. This is the one that makes rootless work.
- **Cgroup** — its own view of the cgroup hierarchy root.
- **Time** — its own boot and monotonic clocks.

Full detail in [Namespaces](02-namespaces.md).

### cgroups — what it may use

Namespaces isolate; they do not limit. A process in its own PID namespace can
still eat all the RAM on the machine. **cgroups v2** is the accounting and
limiting layer: memory ceilings, CPU weights and quotas, a PID count cap, and
I/O throttling. When a container is "killed for no reason" with exit code 137,
this is usually the mechanism.

Full detail in [cgroups v2](03-cgroups.md).

### The root filesystem — what files exist

The image is unpacked into a directory, and the process's root is switched to it
(`pivot_root`, roughly the modern `chroot`). From then on, `/usr/bin/node`
inside the container means the image's Node, not the host's — and the host may
not have Node installed at all.

That directory is not a copy. It is an **overlay**: read-only image layers with
one thin writable layer on top. See
[The image is not the container](04-image-vs-container.md) and
[OverlayFS and copy-up](07-overlayfs.md).

## What this explains immediately

Once you hold the model, a set of unrelated-looking behaviours collapse into one
answer each:

| Behaviour | Why |
|---|---|
| `ps aux` inside shows 2 processes | PID namespace |
| `free -h` inside shows the **host's** RAM | Memory limits are cgroups, and `free` reads `/proc/meminfo`, which is not namespaced |
| Two containers both bind port 3000 | Network namespace — separate port spaces |
| `localhost` inside is not your laptop | Network namespace — the container's own loopback |
| Killing the container's PID 1 stops everything | PID namespace — when PID 1 dies, the namespace is torn down |
| Files written by the container are owned by a strange UID | User namespace — see [Rootless containers](11-rootless.md) |
| A container starts in under a second | There is no OS to boot. It is one `execve()` with extra setup |

That last row is the practical headline. **A container does not boot.** A
virtual machine starts a kernel, init, systemd, and a login stack. A container
starts *your process* — the kernel is already running, and it is the host's.

## The parts a container does not have

Being clear about the absences prevents a lot of wasted debugging:

- **No kernel of its own.** Every container on a host shares the host kernel. An
  Alpine container on a Fedora host runs the Fedora kernel; only userspace comes
  from the image. This is why you cannot run a Windows container on a Linux host,
  and why a kernel-version-sensitive workload is sensitive to the *host*.
- **No init system, by default.** No systemd, no service manager, nothing to
  reap orphaned children. This is why PID 1 is a topic in its own right — see
  Phase 10.
- **No hardware isolation.** Namespaces are a kernel feature, and a kernel
  vulnerability is a container escape. Containers are an isolation boundary, but
  a weaker one than a VM's. That trade is the whole of
  [Containers vs VMs vs serverless](13-containers-vs-vms.md).

## Gotchas

**Symptom:** "The container is using 8 GB of RAM — I set a 512 MB limit and it is
being ignored."
**Cause:** You are reading `free`, `top` or `os.totalmem()` *inside* the
container, which report the host's memory because `/proc/meminfo` is not
namespaced. The limit is almost certainly being applied.
**Fix:** Read the cgroup instead — `/sys/fs/cgroup/memory.max` and
`memory.current` inside the container — or `docker stats` / `podman stats` from
the host. Runtimes that are cgroup-aware (modern JVMs, Node with
`--max-old-space-size` set from the cgroup) get this right; naive code does not.

**Symptom:** "I need to upgrade the kernel, so I will use a newer base image."
**Cause:** Treating the image as if it contained an operating system.
**Fix:** The image contains userspace only. Upgrading the base image gets you a
newer libc, newer utilities and newer packages — never a newer kernel. The
kernel comes from the host, and upgrading it means upgrading the host.

**Symptom:** A process is running in the container but `ps` on the host cannot
find it by that PID.
**Cause:** The PID inside and the PID outside are different numbers for the same
process.
**Fix:** Ask the engine for the host-side PID:
`docker inspect --format '{{.State.Pid}}' <container>` (or `podman inspect`).
That number is the one the host's `ps`, `strace` and `nsenter` want.

**Symptom:** "Containers are secure, so untrusted code is fine in one."
**Cause:** Mistaking a namespace for a hypervisor.
**Fix:** Treat a container as a strong *isolation* boundary and a weaker
*security* boundary. For genuinely untrusted code you want a VM, or a
VM-per-container runtime such as Kata or Firecracker. Inside a normal container,
the shared kernel is a shared attack surface.

## Interview questions

**★ What is a container, in one sentence?**
A process running in its own set of Linux namespaces, constrained by cgroups,
with an image's filesystem as its root. Not a VM, not an emulator, and not a
kernel-level object — the kernel has no concept of a container at all.

**★ Why does a container start in milliseconds when a VM takes 30 seconds?**
A VM boots a kernel and an init system. A container starts a single process on a
kernel that is already running; the "start" is namespace and cgroup setup
followed by `execve()`.

**★ Namespaces and cgroups — which does what?**
Namespaces control **visibility** (what the process can see: processes, network,
mounts, hostname, users). cgroups control **consumption** (how much CPU, memory,
PIDs and I/O it may use). Isolation without limits is a denial-of-service
waiting to happen; limits without isolation is not a container.

**Can a container run a different kernel from its host?**
No. All containers on a host share that host's kernel. The image supplies
userspace only — libc, utilities, your application. A "Ubuntu container on a
Fedora host" is Ubuntu's userspace on Fedora's kernel.

**Why does `free` inside a container show the host's memory?**
Because `/proc/meminfo` is not namespaced, and `free` reads it. Memory limiting
happens in cgroups, which is a different mechanism entirely. Read
`/sys/fs/cgroup/memory.max` for the truth.

**Is a container a security boundary?**
It is a real one, but weaker than a VM's, because the kernel is shared. The
defence is layered: drop capabilities, enable seccomp, run non-root, run
rootless, and keep the host kernel patched. For genuinely hostile workloads,
reach for hardware-backed isolation instead.

---

← Index: [Phase 0](README.md) · Next → [Namespaces](02-namespaces.md)
