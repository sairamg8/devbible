---
title: "Bind-mount performance on macOS and Windows"
sidebar_label: "12 · Bind-mount performance"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Docker Desktop — settings (file sharing)](https://docs.docker.com/desktop/settings-and-maintenance/settings/),
> [Docker Desktop — WSL 2 best practices](https://docs.docker.com/desktop/features/wsl/best-practices/),
> [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) and
> [Podman — podman-machine](https://docs.podman.io/en/latest/markdown/podman-machine.1.html).
> **No sandbox** — no console output on this page. The numbers quoted below are
> Docker's own published claims, not measurements taken here.

**On Linux a bind mount is free, because it is the same filesystem. On macOS
and Windows it crosses into a virtual machine, and that crossing is the single
biggest performance difference between your laptop and your server.** Everything
practical about this page follows from noticing where the boundary is.

## Why there is a boundary at all

Containers are a Linux kernel feature
([Phase 0, page 13](../phase-0-what-a-container-is/13-containers-vs-vms.md)). On
macOS and Windows there is no Linux kernel, so Docker Desktop and
`podman machine` run one **in a virtual machine**. Your files are on the host;
the container is in the VM; every read and write between them goes through a
file-sharing protocol.

| Host | What a bind mount really is |
|---|---|
| **Linux** | the same filesystem, mounted twice — no translation, native speed |
| **macOS** | host filesystem shared into a Linux VM (VirtioFS or gRPC-FUSE) |
| **Windows + WSL 2, files in the Linux filesystem** | native — fast |
| **Windows + WSL 2, files on `C:`** | cross-OS access from the VM to Windows — slow |

**A named volume never crosses that boundary.** It lives inside the VM's own
disk, which is why "put the database on a volume, not a bind mount" is a
performance rule on a Mac as much as a correctness one.

## macOS: what VirtioFS changed

Docker Desktop's file-sharing implementation is a setting, and the choice is now
between two:

> *"Choose whether you want to share files using **VirtioFS**, or **gRPC
> FUSE**"*

VirtioFS is the default, and Docker's published claim for it is specific:

> *"Use VirtioFS for speedy file sharing. VirtioFS has reduced the time taken to
> complete filesystem operations by up to 98%."*

⚠️ That figure is **Docker's own**, for filesystem operations, and it is quoted
here as a documented claim rather than something measured on this machine (this
track runs no benchmarks — see the note under the page title). Treat it as
"this changed the situation substantially", not as a number to plan capacity
with.

One requirement is easy to miss:

> *"This option is only available if you have selected **Apple Virtualization
> framework** as the Virtual Machine Manager"*

and *"VirtioFS is the only file sharing implementation supported by Docker
VMM"*. So a Desktop still configured for an older virtualisation backend may be
on gRPC-FUSE without anyone having chosen it. **Check the setting before
concluding that Docker on macOS is slow** — it is a genuine possibility that the
answer is one dropdown.

**The historical shape, since you will meet it in old advice:** the original
`osxfs` was slow enough that the `:cached`, `:delegated` and `:consistent` mount
suffixes existed to trade consistency for speed. Those suffixes are legacy — the
modern implementations do not need them, and copying them out of a 2019 blog
post today achieves nothing. If you see them in a Compose file, they are a
fossil.

## Windows: the rule is where the files live

Under WSL 2 the guidance is unusually clear-cut, and it is about **location**,
not settings:

> *"store source code and other data that is bind-mounted into Linux
> containers … in the Linux file system, rather than the Windows file system"*

> *"Performance is much higher when files are bind-mounted from the Linux
> filesystem, rather than accessed from the Windows host filesystem."*

In practice: a project under `\\wsl$\Ubuntu\home\you\project` (or
`~/project` from inside WSL) is fast, and the same project at `C:\Users\you\project`
mounted through `/mnt/c` is slow — every access crosses from the Linux VM back
out to Windows. The same guidance notes the other benefit: **`inotify` events
work properly** on the Linux side, which is chunk 01 of topic 04's "my watcher
does not fire".

**Clone into WSL, edit with an editor that connects into WSL** (VS Code's WSL
integration, JetBrains' remote development), and the problem does not exist.

## What actually gets slow

The cost is per filesystem *operation*, not per byte, so it is invisible until
something does many small operations at once:

| Workload | Feels |
|---|---|
| Serving a few files | fine |
| Streaming one large file | fine — throughput is not the problem |
| `npm ci`, `pip install`, `composer install` over a mount | **very slow** — tens of thousands of small files |
| A test suite that touches many files | slow |
| A bundler or type-checker scanning a large tree | slow |
| A database on a bind mount | **slow and risky** — many small synchronous writes |

That table is also the fix list, because each row has an obvious alternative:

- **Dependencies belong in the image**, installed by the build inside the
  container — which is topic 04's `node_modules` rule arriving again from a
  completely different direction. Install once at build time in the VM, rather
  than repeatedly across the boundary.
- **Databases belong on named volumes.** Inside the VM's own disk, no crossing.
- **Caches and build output belong on volumes too** — `.next/`, `target/`,
  `__pycache__/`, `.gradle/`. A named volume mounted at the cache path keeps the
  churn off the shared filesystem and often halves a rebuild.
- **Mount narrowly.** Fewer files across the boundary is less work at every
  level.

```yaml
services:
  web:
    volumes:
      - ./src:/app/src            # the code you edit — small, crosses the boundary
      - next_cache:/app/.next     # the churn — stays inside the VM
volumes:
  next_cache:
```

## Podman machine

`podman machine` on macOS and Windows has the same architecture and therefore
the same boundary: a Linux VM, with your host directories shared in. Recent
versions use the same class of mechanism (`virtiofs` on macOS with Apple's
virtualisation framework; WSL 2 on Windows), and the same advice applies —
volumes for data, narrow mounts for source, Linux-side files on Windows.

**On a Linux host, none of this exists for either engine.** A bind mount is the
same filesystem and there is nothing to tune, which is worth saying explicitly
because a Mac-shaped optimisation habit does not need to travel to the server.

## Gotchas

**Symptom:** `npm ci` takes minutes in the container and seconds on the host.
**Cause:** Tens of thousands of small file operations crossing the VM boundary.
**Fix:** Install dependencies during the image build, inside the container, and
keep `node_modules` off the mount entirely (topic 04).

**Symptom:** Docker on macOS is slow, and everyone says VirtioFS fixed that.
**Cause:** VirtioFS is only available with the Apple Virtualization framework
backend, so a Desktop on another VM manager is still on gRPC-FUSE.
**Fix:** Check Settings → General for the Virtual Machine Manager, then the file
sharing implementation.

**Symptom:** A Windows colleague's containers are far slower than everyone
else's.
**Cause:** The project lives on `C:` and is mounted through `/mnt/c`, crossing
from the Linux VM back to Windows.
**Fix:** Move the repository into the WSL 2 Linux filesystem and use an editor
that connects into WSL. File watching improves at the same time.

**Symptom:** A Compose file carries `:cached` and `:delegated` suffixes and they
appear to do nothing.
**Cause:** They are `osxfs`-era consistency hints; the current implementations
do not use them.
**Fix:** Remove them. They are noise, and they mislead the next reader into
thinking there is a tuning knob there.

## Interview questions

**★ Why is a bind mount slower on macOS than on Linux?**
Because there is no Linux kernel on macOS, so Docker Desktop runs one in a VM.
Your files are on the host and the container is in the VM, so every filesystem
operation crosses a sharing protocol — VirtioFS or gRPC-FUSE. On Linux the bind
mount is the same filesystem mounted twice, with no translation at all.

**★ What is the practical advice for Windows?**
Keep the code in the WSL 2 Linux filesystem, not on `C:`. Docker's own guidance
is that files bind-mounted into Linux containers should live in the Linux
filesystem, and that *"performance is much higher"* that way — a project accessed
through `/mnt/c` crosses back out to Windows on every operation. `inotify` also
works properly on the Linux side.

**★ Which workloads actually notice, and what do you do about them?**
Anything doing many small operations: dependency installs, test suites,
bundlers, and databases with their many small synchronous writes. The fixes are
all "stop crossing the boundary" — install dependencies in the image, put
databases and build caches on named volumes, and mount only the source you edit.

**What are `:cached` and `:delegated`, and should you use them?**
Legacy `osxfs` consistency hints from when Docker Desktop's file sharing was
much slower. The current implementations do not need them; they are noise in a
modern Compose file and should be removed rather than copied forward.

**Does a named volume have the same problem?**
No — a volume lives inside the VM's own disk, so it never crosses the sharing
boundary. That is why "database on a volume, source on a narrow bind mount" is a
performance rule on macOS and Windows as much as a correctness one on Linux.

---

← Prev: [Volume drivers and network storage](11-volume-drivers.md) · Index: [Phase 6](README.md) · Next phase → [Phase 7 · Networking](../phase-7-networking/README.md)
