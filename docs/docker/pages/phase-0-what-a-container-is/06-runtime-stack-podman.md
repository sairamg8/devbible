---
title: "The runtime stack, Podman"
sidebar_label: "06 · The Podman stack"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the [Podman documentation](https://docs.podman.io/en/latest/),
> [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html),
> [containers/conmon](https://github.com/containers/conmon) and the
> [Podman 6.0 release notes](https://github.com/containers/podman/releases).
> **No sandbox** — Podman 5.8.4 is installed on the machine this was written on and
> **was not run**; this page carries no console output.

**Podman has no daemon.** The Podman documentation describes it as "a daemonless,
open source, Linux native tool" that relies on "an OCI compliant Container
Runtime (runc, crun, runv, etc) to interface with the operating system and create
the running containers."

That single architectural difference is where nearly every Podman-versus-Docker
surprise comes from — the good ones and the annoying ones alike.

## The chain, compared

```
DOCKER                            PODMAN
docker (CLI)                      podman (CLI)
   │  socket                         │  no socket, no server
   ▼                                 │
dockerd  (root)                      │   ← this layer does not exist
   │                                 │
   ▼                                 │
containerd                           │   ← nor this one
   │                                 ▼
containerd-shim-runc-v2           conmon  (one per container)
   │                                 │
   ▼                                 ▼
runc                              crun (or runc)
   │                                 │
   ▼                                 ▼
your process                      your process
```

Podman is a **fork/exec** model. The `podman` command you type does the work
itself, then leaves behind a `conmon` per container and exits. There is no
long-running privileged service in the middle.

| Piece | Job |
|---|---|
| **`podman`** | Does everything `dockerd` would: images, networks, volumes, lifecycle. Then exits |
| **`conmon`** | The container monitor. One per container |
| **`crun` / `runc`** | The OCI runtime — namespaces, cgroups, `execve()`, exit. `crun` is C and faster to start; `runc` is Go |

### What `conmon` does

Per its own repository, `conmon` is the monitoring program and communication
channel between the container manager and the OCI runtime for a single
container. On launch it double-forks to detach from whatever started it, then
launches the runtime as its child. It:

1. provides a socket for attaching to the container and holds its standard
   streams open, forwarding them,
2. writes those streams to a log file or the systemd journal so they are
   readable after the container dies, and
3. records the exit time and code for the manager to read.

Functionally that is the same job as containerd's shim — and the design reason
is identical: **the thing that launched the container is allowed to die.** With
Podman, the thing that launched it *always* dies, immediately, because it was
just your CLI invocation.

## What you gain

- **No root daemon, so no root-equivalent socket.** The whole class of "access
  to the Docker socket is access to root" disappears.
- **Rootless is the default path, not a mode you enable.** Containers run as your
  user, inside your user namespace.
- **Containers are ordinary processes in your session**, so `systemd`, `ps`,
  `kill` and cgroup accounting see them the way they see everything else. This is
  what makes **Quadlet** (Phase 11) natural rather than bolted on.
- **Nothing to keep running.** No service to start on boot, nothing to restart
  after an upgrade, no daemon to wedge.

## What you must know, because it is genuinely different

This list is the honest cost, and it is the reason Phase 11 exists:

| Difference | Consequence |
|---|---|
| **No daemon means nobody supervises containers when you log out** | `--restart=always` does not resurrect containers after a reboot on its own. You want `loginctl enable-linger`, and for real services a **Quadlet** unit |
| **Healthchecks are driven by systemd timers**, not a daemon loop | Behaviour and failure modes differ from Docker's; check the timer if a healthcheck seems not to run |
| **Networking is `netavark` + `aardvark-dns`** (CNI in older versions) | Different error messages, and DNS behaviour to learn separately — Phase 7 |
| **Rootless by default** | UID mapping surprises on bind mounts; privileged ports blocked; `--userns=keep-id` becomes a tool you reach for — Phase 6 |
| **Compose is not native** | `podman compose` shells out to a provider; some Compose features diverge — Phase 8 |
| **Pods are first-class** | A genuine capability Docker has no equivalent of — Phase 11 |

🔴 **Podman 6.0 removed cgroups v1 support and dropped BoltDB** (databases are
migrated to SQLite automatically), and dropped Intel macOS and Windows 10 hosts.
On a modern Linux distribution none of this is felt; on an old host it is a
blocker worth checking before you upgrade.

## Docker compatibility, honestly

The `podman` CLI deliberately mirrors `docker`, to the point that the
documentation itself suggests `alias docker=podman`. For everyday commands —
`run`, `ps`, `build`, `logs`, `exec`, `pull`, `push` — the flags are the same and
the muscle memory transfers.

For tools that expect a **socket** rather than a CLI — Testcontainers, some IDE
integrations, CI runners — Podman can expose a Docker-compatible API:

```bash
# Rootless API socket, on demand
systemctl --user enable --now podman.socket

# Point Docker-API clients at it
export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock
```

That is a real socket serving the Docker API, but it is **your** socket, running
as **you** — which is the entire point. Detail in Phase 11.

## Gotchas

**Symptom:** A rootless container with `--restart=always` does not come back
after a reboot.
**Cause:** There is no daemon to restart it, and your user's services stop when
your session ends.
**Fix:** `loginctl enable-linger $USER` so your user manager runs without a
login, and prefer a **Quadlet** unit for anything that must survive a reboot.
Restart policies are not a supervision system under Podman.

**Symptom:** `podman` commands are slow the first time after boot, then fast.
**Cause:** There is no warm daemon holding state; the first invocation does
setup work a daemon would have done at start.
**Fix:** Nothing to fix — it is the trade. If a warm API matters (many rapid
calls from a tool), enable `podman.socket` so a service handles them.

**Symptom:** A tutorial's `docker run -p 80:80 …` fails under rootless Podman
with a permission error.
**Cause:** Binding a port below 1024 requires privilege, and rootless containers
do not have it.
**Fix:** Publish a high port and put a proxy in front, or lower
`net.ipv4.ip_unprivileged_port_start`. Phase 7 covers both, and the trade
between them.

**Symptom:** Files created by the container are owned by an enormous UID such as
`165536` on the host.
**Cause:** User-namespace mapping — expected, not broken.
**Fix:** `podman unshare chown …` to fix ownership from inside the mapping, or
run with `--userns=keep-id` so container UIDs match yours. Phase 6.

## Interview questions

**★ What is the main architectural difference between Docker and Podman?**
Docker is client–server: a CLI talking to a root daemon that owns everything.
Podman is daemonless and fork/exec: the CLI does the work directly and leaves a
`conmon` process per container. The removal of the root daemon removes the
root-equivalent socket with it.

**★ If there is no daemon, what keeps a Podman container running?**
The container process itself, monitored by `conmon`. `conmon` holds the stdio,
writes the logs, and records the exit code — the same job containerd's shim does
for Docker.

**★ What does Podman's design cost you?**
No daemon to supervise containers when you are logged out, so restart policies
need `enable-linger` or a Quadlet unit; healthchecks run on systemd timers;
networking is netavark/aardvark-dns with its own behaviour; and Compose support
is provided rather than native.

**Can Podman run Docker images?**
Yes. Both consume OCI images, and Podman pulls from the same registries. The
image format is a standard, which is precisely what the OCI specifications exist
to guarantee.

**How do you use a tool that requires the Docker socket with Podman?**
Enable the rootless `podman.socket` user service and point `DOCKER_HOST` at
`unix:///run/user/$UID/podman/podman.sock`. It serves the Docker API, but as your
user rather than as root.

**What changed in Podman 6.0 that could break an upgrade?**
cgroups v1 support was removed, BoltDB support was dropped in favour of SQLite
with automatic migration, and Intel macOS and Windows 10 hosts are no longer
supported. On a current Linux distribution the first two are invisible.

---

← Prev: [The runtime stack, Docker](05-runtime-stack-docker.md) · Index: [Phase 0](README.md) · Next → [OverlayFS and copy-up](07-overlayfs.md)
