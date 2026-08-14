---
title: "Installing an engine"
sidebar_label: "14 · Installing an engine"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Docker Engine install](https://docs.docker.com/engine/install/),
> [Docker Desktop licence terms](https://docs.docker.com/subscription/desktop-license/),
> [Podman installation](https://podman.io/docs/installation) and
> [Podman Desktop](https://podman-desktop.io/).
> **No sandbox** — no console output on this page.

**Three different things are called "installing Docker", and choosing the wrong
one is how teams end up with an unexpected licence obligation or a VM they did
not know they were running.**

## The four options

| | What it is | Runs on | Notes |
|---|---|---|---|
| **Docker Engine** | The daemon + CLI, natively | **Linux only** | The real thing. Free, Apache-2.0 |
| **Docker Desktop** | Engine **inside a managed VM**, plus a GUI | macOS, Windows, Linux | Convenient; **licence terms apply** |
| **Podman** | Daemonless engine + CLI | Linux natively; macOS/Windows via `podman machine` | Default on Fedora/RHEL |
| **Podman Desktop** | GUI over Podman (and Docker) | macOS, Windows, Linux | Apache-2.0 |

Two facts collapse most of the confusion:

1. **On macOS and Windows there is always a Linux VM.** Containers are a Linux
   kernel feature; there is no way around it. Docker Desktop hides one,
   `podman machine` creates one you can see. Anyone who says "Docker runs
   natively on my Mac" is describing a well-hidden VM.
2. **On Linux you do not need Desktop at all.** Docker Engine or Podman install
   from your distribution's repositories and run natively.

## The licence question, stated plainly

Docker Desktop is **free** for personal use, education, non-commercial open
source, and **small businesses with fewer than 250 employees AND less than
$10 million in annual revenue**. Professional use in organisations above either
threshold — and government entities — requires a paid subscription.

Two things follow that are worth getting right the first time:

- **Docker Engine on Linux is not affected.** It is open source and free
  regardless of company size. The licence applies to **Desktop**, not to the
  engine.
- **The thresholds are AND, not OR.** A 300-person company is over the line even
  with modest revenue.

This is the single most common reason organisations evaluate Podman, and it is a
legitimate reason — but note that the technical arguments (no root daemon,
rootless by default, systemd integration) stand on their own.

## Installing, briefly

**Docker Engine on Linux** — use the official repository, not the distribution's
often-outdated `docker.io` package:

```bash
# Docker's convenience script (read it before piping anything to a shell)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Then, so you are not typing sudo forever:
sudo usermod -aG docker $USER   # ⚠️ see the warning below
```

⚠️ **Adding yourself to the `docker` group is granting passwordless root.**
The daemon's socket is a root-equivalent API — see
[The runtime stack, Docker](05-runtime-stack-docker.md). Make it a conscious
decision. On a shared or production host, prefer rootless Docker or Podman.

**Podman on Linux** — it is packaged everywhere:

```bash
sudo dnf install podman        # Fedora, RHEL, CentOS
sudo apt install podman        # Debian, Ubuntu
sudo pacman -S podman          # Arch
```

Nothing to enable and no group to join, because there is no daemon and no
socket. If you want the Docker-API socket for tools that need it, that is an
opt-in user service — Phase 11.

**macOS and Windows** — Docker Desktop, Podman Desktop, or `podman machine
init && podman machine start`. On Windows, WSL2 is the substrate underneath
either.

## Verifying what you have

```bash
docker version        # client AND server versions - they can differ
docker info           # storage driver, cgroup version, rootless or not
podman version
podman info           # graph driver, rootless, network backend
```

`docker info` is the more useful of the two: it tells you the storage driver, the
cgroup driver and version, whether rootless mode is active, and the security
options in force. When a colleague's machine behaves differently from yours, this
is the output to compare.

## Which should you learn?

**Both, and it is less work than it sounds.** The commands are near-identical,
the image format is standardised, and 95% of this track applies to either engine.
The differences are collected in
[The runtime stack, Podman](06-runtime-stack-podman.md) and Phase 11.

Practically: use whichever your machine and workplace already have, and read the
Podman notes when they appear — they are marked throughout.

## Gotchas

**Symptom:** `docker: command not found` after installing Docker Desktop on
Linux.
**Cause:** Desktop installs its own context; the CLI may not be on `PATH` for
your shell, or the Desktop engine is not running.
**Fix:** Start Desktop, then check `docker context ls` — Desktop adds a context
and switching between it and a native engine is a frequent source of "my
container disappeared".

**Symptom:** Containers vanish after a reboot on macOS or Windows.
**Cause:** The VM was not started. No VM, no containers.
**Fix:** Start Desktop, or `podman machine start`. Set the VM to start at login
if that is what you want.

**Symptom:** A legal or procurement review appears months after everyone
installed Desktop.
**Cause:** The employee/revenue thresholds were crossed, or were never checked.
**Fix:** On Linux, move to Docker Engine or Podman — no licence obligation. This
is easier to do early than after tooling has grown around Desktop.

**Symptom:** Two engines installed, and images "keep disappearing".
**Cause:** Docker and Podman have **separate image stores**. An image pulled with
one is invisible to the other.
**Fix:** Expected, not a bug. Pick one per project, or move images explicitly
with `skopeo copy`.

## Interview questions

**★ What is the difference between Docker Engine and Docker Desktop?**
Engine is the daemon and CLI running natively on Linux, open source and free.
Desktop is a product that bundles the engine inside a managed VM with a GUI and
extras, runs on macOS, Windows and Linux, and is subject to licence terms above
certain company thresholds.

**★ Does Docker run natively on macOS?**
No. Containers are a Linux kernel feature, so a Linux VM is always involved.
Docker Desktop manages one for you; Podman does it explicitly with
`podman machine`.

**★ When does Docker Desktop require a paid subscription?**
For professional use in organisations with 250 or more employees **or** $10
million or more in annual revenue, and for government entities. It is free for
personal use, education, non-commercial open source, and businesses below both
thresholds.

**What does adding a user to the `docker` group actually grant?**
Effective passwordless root on the host, because the daemon socket is a
root-equivalent API and any member can start a privileged container that mounts
the host filesystem.

**Can Docker and Podman coexist on one machine?**
Yes, with separate image and container stores. Images pulled by one are not
visible to the other; `skopeo copy` moves them if needed.

---

← Prev: [Containers vs VMs vs serverless](13-containers-vs-vms.md) · Index: [Phase 0](README.md) · Start Phase 1 → **Running containers** *(not written yet)*
