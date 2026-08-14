---
title: "The runtime stack, Docker"
sidebar_label: "05 · The Docker stack"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [containerd — Runtime v2](https://containerd.io/docs/main/runtime-v2/),
> [Docker — alternative container runtimes](https://docs.docker.com/engine/daemon/alternative-runtimes/),
> [dockerd reference](https://docs.docker.com/reference/cli/dockerd/) and
> [Docker security](https://docs.docker.com/engine/security/).
> **No sandbox** — no console output on this page.

**`docker` is a CLI that talks to a daemon over a socket. The daemon does not
start containers either — it delegates down a chain that ends in a small program
that calls the kernel.** Knowing the chain tells you which piece to blame when
something breaks.

## The chain

```
docker (CLI)
   │  HTTP over /var/run/docker.sock
   ▼
dockerd  ─────────── builds, networks, volumes, the API
   │  gRPC
   ▼
containerd ───────── image pull, snapshots, container lifecycle
   │  spawns one per container
   ▼
containerd-shim-runc-v2
   │  fork/exec
   ▼
runc ─────────────── sets up namespaces + cgroups, execs your process, exits
   │
   ▼
your process
```

| Piece | Job | Lives for |
|---|---|---|
| **`docker`** | A client. Formats your flags into an HTTP request | One command |
| **`dockerd`** | The engine: API, image management, networking, volumes, builds | As long as the service runs |
| **`containerd`** | Container lifecycle and image/snapshot management | As long as the service runs |
| **shim** | Keeps the container alive independently of the daemons; holds stdio and the exit code | The container's lifetime |
| **`runc`** | Applies the OCI runtime spec — namespaces, cgroups, capabilities — then `execve()`s | **Milliseconds.** It exits immediately |

## The two things worth actually remembering

### `runc` is not running your container

This is the counter-intuitive one. `runc` is a **setup program**. It creates the
namespaces, applies the cgroup limits, drops capabilities, pivots the root
filesystem, and then replaces itself with your process via `execve()`. Then it is
gone.

So when you list processes on the host you will see your application, and you
will see a shim — but no `runc`. Nothing is "running the container", because a
container is not a thing that needs running. It is a process with attributes.

### The shim exists so the daemon can die

Each container gets its own `containerd-shim-runc-v2` process, and it is the
container's parent. That means:

- **You can restart `dockerd` without killing running containers.** The shim
  keeps them alive and reconnects.
- The shim owns the container's stdout/stderr, which is where `docker logs` gets
  its data.
- The shim reaps the process and reports the exit code, so nothing is lost if the
  daemon was briefly unavailable.

Per containerd's own documentation, the shim listens for ttRPC commands, invokes
the runtime engine by fork/exec, and is also responsible for mounting and
unmounting the container's root filesystem.

## Where the pieces fail, and what it looks like

| Symptom | Layer at fault |
|---|---|
| `Cannot connect to the Docker daemon at unix:///var/run/docker.sock` | The **CLI** cannot reach `dockerd`. The daemon is stopped, or you are not in the `docker` group |
| `permission denied while trying to connect to the Docker daemon socket` | Socket permissions — you are not in the `docker` group |
| Pull fails, timeouts, TLS errors | **`containerd`**, which does the pulling |
| `OCI runtime create failed: ... executable file not found` | **`runc`** — the `ENTRYPOINT`/`CMD` binary does not exist in the image |
| `OCI runtime create failed: ... permission denied` | **`runc`** — usually the entrypoint is not executable, or a security profile blocked it |
| Container exits instantly with no logs | Your **process** — it ran and returned |

That table is most of container triage. The prefix `OCI runtime create failed`
is the tell that you have reached the bottom of the stack: the image, the
command or the permissions are wrong, and no amount of daemon restarting helps.

## The daemon is root, and that is the point of Podman

`dockerd` runs as **root**. The socket it listens on is therefore a root-level
API:

> **Anyone who can talk to the Docker socket can become root on the host.** They
> can run a container with `--privileged` and the host's `/` bind-mounted.

This is not a vulnerability, it is the architecture — Docker's own security
documentation is direct about the daemon's attack surface. The consequences are
practical:

- Adding a user to the `docker` group is equivalent to giving them passwordless
  root. Treat it as that decision, not as a convenience.
- Mounting `/var/run/docker.sock` into a container (a common CI pattern) hands
  that container root on the host.
- **Rootless Docker** exists and moves the daemon into a user namespace.
  **Podman** takes the more direct route and removes the daemon entirely — which
  is the next page.

## Talking to the layers directly

Rarely needed, occasionally decisive:

```bash
# The API the CLI uses, by hand
curl --unix-socket /var/run/docker.sock http://localhost/v1.47/containers/json

# containerd's own CLI, one level below dockerd
sudo ctr --namespace moby containers list

# Where a container's OCI bundle and config live
docker inspect --format '{{.State.Pid}}' myapp
```

`ctr` is a debugging tool, not a user interface — containerd's namespaces are
not Docker's, and Docker's containers live in the `moby` namespace. Reach for it
when you suspect `dockerd` and `containerd` disagree.

## Gotchas

**Symptom:** Restarting the Docker service kills every running container.
**Cause:** `live-restore` is not enabled, so the daemon stops the containers it
manages on shutdown.
**Fix:** Set `"live-restore": true` in `/etc/docker/daemon.json`. The shims are
what make this possible; without the option, the daemon still tears down on
purpose.

**Symptom:** `OCI runtime create failed: exec: "npm start": no such file or
directory` — but `npm` is definitely installed.
**Cause:** Shell form versus exec form. `CMD ["npm start"]` asks the kernel to
execute a **single binary literally named** `npm start`, spaces included, with no
shell involved.
**Fix:** `CMD ["npm", "start"]`, or the shell form `CMD npm start`. Phase 3
covers the four combinations; this specific error is almost always this mistake.

**Symptom:** A CI job with `/var/run/docker.sock` mounted is flagged in a
security review.
**Cause:** Correctly. That container can start a privileged container and own
the host.
**Fix:** Use a rootless builder, buildx with its own driver, or Podman. If the
socket must be mounted, treat that CI runner as a root-equivalent trust boundary
and scope it accordingly.

**Symptom:** `docker` commands hang with no error.
**Cause:** `dockerd` is alive but wedged — often a stuck image pull or an
exhausted file-descriptor limit.
**Fix:** Look at the daemon's own logs (`journalctl -u docker`), not at the CLI.
The CLI is a thin client and has nothing useful to say about a daemon problem.

## Interview questions

**★ Walk me through what happens when you run `docker run nginx`.**
The CLI serialises the request to `dockerd` over the Unix socket. `dockerd`
resolves the image, asking `containerd` to pull it if needed. `containerd`
prepares a snapshot and starts a shim; the shim fork/execs `runc`, which creates
the namespaces and cgroups, applies security settings, pivots the root, and
`execve()`s nginx. `runc` exits; the shim stays as the container's parent, owning
its stdio and exit code.

**★ Why is the Docker daemon a security concern?**
It runs as root and exposes a root-equivalent API on a socket. Access to that
socket — via the `docker` group or a bind mount — is access to root on the host,
because you can start a privileged container that mounts the host filesystem.

**★ What does the shim do, and why is there one per container?**
It decouples the container from the daemon: it parents the container process,
holds its stdio, records the exit code, and mounts and unmounts the rootfs. One
per container means restarting or crashing `dockerd` does not take running
containers with it.

**Is `runc` running while my container runs?**
No. `runc` performs setup and then `execve()`s your process, replacing itself.
It lives for milliseconds. What persists is your process and the shim.

**What does an `OCI runtime create failed` error tell you?**
That the failure is at the bottom of the stack — `runc` could not start the
process. In practice: the entrypoint binary does not exist in the image, is not
executable, or was blocked by a security profile. It is not a daemon or network
problem.

**What is containerd's role, given that dockerd already exists?**
containerd owns image pull and storage (snapshots) and the container lifecycle;
`dockerd` owns the user-facing API, networking, volumes and builds. The split
exists so other systems — Kubernetes among them — can use containerd without
Docker.

---

← Prev: [The image is not the container](04-image-vs-container.md) · Index: [Phase 0](README.md) · Next → [The runtime stack, Podman](06-runtime-stack-podman.md)
