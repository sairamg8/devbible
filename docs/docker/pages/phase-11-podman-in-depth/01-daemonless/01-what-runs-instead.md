---
title: "What runs instead of a daemon"
sidebar_label: "01 · What runs instead"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [podman-system-service(1)](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html)
> and [containers/conmon](https://github.com/containers/conmon).
> **No sandbox** — no console output on this page.

Podman's documentation calls it "a fully featured container engine that is a
simple **daemonless** tool". That word is doing more work than it looks like it
is. It does not mean "Docker without the background service" — it means the
**ownership of a running container moves from a machine-wide service to your
own login session**, and everything downstream of ownership moves with it.

## The one sentence that explains the whole phase

🔴 **`docker run` is a remote procedure call. `podman run` is the container's
parent process.**

When you type `docker run`, the CLI serialises your request, sends it to
`dockerd` over a socket, and the daemon creates the container. The container is
**the daemon's child**. Your terminal is attached to a stream, nothing more —
this is exactly why
[Phase 10 · 14](../../phase-10-production/14-under-systemd.md) had to work
around a systemd unit supervising the client instead of the container.

When you type `podman run`, there is nobody to send the request to. The `podman`
process does the work itself — pulls, unpacks, sets up the namespaces, and
`execve()`s your entrypoint — then gets out of the way. Nothing on the machine
was running before you typed the command, and nothing machine-wide is running
after it exits.

[Phase 0 · 06](../../phase-0-what-a-container-is/06-runtime-stack-podman.md) drew
the two chains side by side. This page is about what that costs and buys.

## What is left behind: `conmon`

Something has to survive your CLI invocation, because your CLI invocation is
going to exit. That something is **`conmon`** — one per container.

Per its own repository, `conmon` is the monitoring program and communication
channel between the container manager and the OCI runtime, for a single
container. It double-forks to detach from whatever launched it, then launches
the runtime as its child, and from then on it:

1. holds the container's standard streams open and forwards them,
2. writes those streams somewhere durable so they can be read after the
   container dies, and
3. records the exit time and exit code.

That is the same job containerd's shim does under Docker. The design reason is
identical in both engines: **the thing that launched the container is allowed to
die.** The difference is that under Podman the launcher *always* dies,
immediately, because it was only ever your command line.

```
podman run -d nginx
  │
  ├── podman        ← does all the work, then exits
  │
  └── conmon        ← double-forks, survives, holds stdio + exit code
        │
        └── crun    ← sets up namespaces/cgroups, execve()s, exits
              │
              └── nginx   ← PID 1 in its own PID namespace
```

`--detach` is documented as "run the container in the background and print the
new container ID", defaulting to `false` — but notice that under Podman
**foreground and detached differ only in whether `podman` waits.** In both cases
`conmon` is the container's real supervisor. Under Docker the equivalent
distinction is whether the CLI stays attached to a daemon-owned stream, which is
a much weaker relationship.

## No daemon means the state is on disk, and the disk is per user

A daemon holds state in memory: what containers exist, which are running, what
networks are defined. Podman has no process to hold it, so **all of it lives in
files**, and — this is the part people trip over — those files are *per user*.

| | Root | Rootless |
|---|---|---|
| Image and container storage | `/var/lib/containers/storage` | `$HOME/.local/share/containers/storage` |
| Runtime state | `/run/containers/storage` | `$XDG_RUNTIME_DIR/libpod/tmp` |
| Configuration | `/etc/containers/` | `$HOME/.config/containers/` |

The documentation is explicit about the config override: "When Podman runs in
rootless mode, the file `$HOME/.config/containers/storage.conf` is used instead
of the system defaults."

🔴 **Two users on one machine have two entirely separate container worlds**, with
separate images, separate volumes, separate networks and separate names. Under
Docker there is one daemon and therefore one world, and group membership decides
who can talk to it.

The practical consequences are immediate and catch everyone once:

- **`sudo podman ps` does not show your containers.** It shows root's. It is not
  "elevated permission to see more" — it is a different store entirely.
- **Building an image as your user and running it under `sudo` fails to find
  it.** The image is in your home directory.
- **`$XDG_RUNTIME_DIR` is normally `/run/user/$UID`**, which is created for your
  login and is exactly why the next page's discussion of logging out matters.
- **Disk usage lands in `$HOME`**, so a user quota or a small home partition
  becomes an image-pull failure with a confusing message.

## The socket that is not there

Docker's socket is the classic finding in every container security review:
membership of the `docker` group is root-equivalent, because the daemon runs as
root and will happily be asked to bind-mount `/` into a privileged container.

Podman does not have that socket, and the removal is structural rather than a
hardening option you switch on. There is no privileged service to ask.

⚠️ **But the socket can be brought back deliberately, and it is worth knowing
what you are turning on.** `podman system service` "creates a listening service
that answers API calls for Podman", on `unix:///run/podman/podman.sock` for root
or `unix://$XDG_RUNTIME_DIR/podman/podman.sock` rootless. That API "is split into
two parts: a compatibility layer offering support for the Docker v1.40 API, and a
Podman-native Libpod layer" — which is what makes Testcontainers, IDE plugins and
CI runners work against Podman at all.

Three things about it are load-bearing:

- **It is opt-in.** Nothing needs it for `podman run`, `podman build` or
  `podman ps`. The engine is not a client of it; it is an extra front door.
- **Rootless, it runs as you.** A compromise of that socket gets your user, not
  the machine. The Docker equivalent gets root. This is the difference worth
  saying out loud in a review.
- **It is short-lived by default.** The inactivity timeout `--time` has a default
  of 5 seconds, and "a value of `0` means no timeout" — so a socket-activated
  service exits again once the tool stops calling it. A long-running API service
  is something you asked for explicitly.

The companion flag is `--remote`, documented as "when true, access to the Podman
service is remote. Defaults to false." That default is the honest summary of the
architecture: **remote is a mode, not the design.**

## What you actually gain

Strip out the marketing and four things are genuinely different:

- **No root-equivalent socket by default**, because no privileged service exists
  to hold one.
- **Nothing to start at boot, wedge, or restart after an upgrade.** There is no
  "the daemon is down" failure mode, and no daemon restart that takes every
  container with it.
- **Containers are ordinary processes in your session**, so `ps`, `kill`,
  `systemd-cgls` and cgroup accounting see them the way they see everything else
  ([Phase 0 · 03 · cgroups](../../phase-0-what-a-container-is/03-cgroups.md)).
- **Rootless is the default path, not a mode you enable** — a user namespace "is
  automatically created for the user, defined in `/etc/subuid` and
  `/etc/subgid`". That is
  [02 · Rootless by default](../02-rootless-by-default/README.md).

The bill for all of this arrives in [the next chunk](02-restart-logs-and-systemctl.md):
if the container belongs to your session, what happens when your session ends?

## Gotchas

**Symptom:** `podman ps` shows nothing, but a container is definitely running —
`ps aux` proves it.
**Cause:** It was started by a different user, most often by `sudo` or by root's
Quadlet units. Each user has an independent store.
**Fix:** Run the query as the owning user. `sudo podman ps` for root's
containers, your own shell for yours. There is no combined view because there is
no shared daemon to provide one.

**Symptom:** An image you just built cannot be found when you run it with
`sudo podman run`.
**Cause:** The build wrote to `$HOME/.local/share/containers/storage`; root reads
`/var/lib/containers/storage`.
**Fix:** Stay in one user's world. If root really needs it, transfer it
explicitly — `podman save`/`podman load`, or push to a registry — rather than
expecting the two stores to be the same one.

**Symptom:** Testcontainers or an IDE integration reports that it cannot reach
the Docker daemon.
**Cause:** The tool speaks the Docker API over a socket, and no socket exists
until you ask for one.
**Fix:** Enable the rootless API service and point `DOCKER_HOST` at
`$XDG_RUNTIME_DIR/podman/podman.sock`. Detail in [Phase 11 · 13 · Docker CLI compatibility](../13-docker-cli-compatibility.md).

**Symptom:** Pulling a large image fails with a disk-space error although the
system disk has plenty free.
**Cause:** Rootless storage lives in `$HOME`, which may be a separate filesystem
or under a user quota.
**Fix:** Check the home filesystem specifically, and if the layout is wrong,
move the graph root with `$HOME/.config/containers/storage.conf` — the file the
documentation names as the rootless override.

## Interview questions

**★ What does "daemonless" actually change?**
Ownership. Under Docker the container is a child of a machine-wide root daemon
and your CLI is a client of it; under Podman the CLI does the work directly and
the container ends up a process in your own session, monitored by a per-container
`conmon`. Everything else — the missing root socket, the per-user image store,
the way systemd can supervise the container itself — follows from that one change.

**★ If there is no daemon, what keeps a Podman container running and what
records its exit code?**
`conmon`, one process per container. It double-forks to survive the CLI that
launched it, holds the container's stdio open and forwards it, writes the stream
somewhere readable after death, and records the exit time and code. It is the
same role as containerd's shim under Docker.

**★ Why is `sudo podman ps` not "podman ps but with more visibility"?**
Because the state is not in a shared service, it is in files, and the file
locations differ per user: `/var/lib/containers/storage` for root against
`$HOME/.local/share/containers/storage` for you. Root and you have separate
images, containers, volumes and networks. Elevating does not widen a view; it
switches to a different store.

**Does Podman have a socket at all?**
Only if you ask for one. `podman system service` creates a listening service
answering API calls, on `/run/podman/podman.sock` as root or
`$XDG_RUNTIME_DIR/podman/podman.sock` rootless, exposing a Docker v1.40
compatibility layer alongside the native Libpod API. It defaults to a 5-second
inactivity timeout, and nothing in ordinary Podman usage needs it.

**Is the Podman socket as dangerous as the Docker socket?**
Not in the rootless case, and that is the whole point. The Docker socket is
root-equivalent because the daemon behind it is root. A rootless Podman socket is
answered by a service running as you, so compromising it gets that user's
containers and files — bad, but not the machine. A *rootful* Podman socket is
back in the same risk class as Docker's.

**Where does rootless Podman keep its state, and why does it matter?**
Images and containers in `$HOME/.local/share/containers/storage`, runtime state
under `$XDG_RUNTIME_DIR`, configuration in `$HOME/.config/containers/`. It
matters because it makes disk usage a home-directory problem, makes the store
non-shareable between users, and ties the runtime state to a directory that
exists because you logged in.

---

← Prev: [Overview](README.md) · Index: [Phase 11](../README.md) · Next → [What it changes: restart, logs and `systemctl`](02-restart-logs-and-systemctl.md)
