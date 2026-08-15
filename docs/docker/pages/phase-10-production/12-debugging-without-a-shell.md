---
title: "Debugging a container you cannot shell into"
sidebar_label: "12 · Debugging without a shell"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker debug](https://docs.docker.com/reference/cli/docker/debug/),
> [docker container cp](https://docs.docker.com/reference/cli/docker/container/cp/),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [Docker — networking](https://docs.docker.com/engine/network/),
> [nsenter(1)](https://man7.org/linux/man-pages/man1/nsenter.1.html) and
> [podman-exec(1)](https://docs.podman.io/en/latest/markdown/podman-exec.1.html).
> **No sandbox** — no console output on this page.

**The image you cannot shell into is usually the image you should be running.** A
distroless or `scratch` image has no shell because a shell is attack surface and
weight ([phase 5 · Distroless and
scratch](../phase-5-image-quality/06-distroless-and-scratch.md)), and a hardened
container has no package manager to install one with. The mistake is to conclude
that debuggability requires a fat image. It does not: **you bring the tools to the
container instead of building them in.**

## Why `exec` fails, and what the error means

`docker exec` runs a command **inside the container's own filesystem**, so it can
only run binaries the image actually contains
([phase 1 · exec versus run](../phase-1-running-containers/04-exec-vs-run.md)).
On a distroless image `docker exec -it web sh` fails because there is no `/bin/sh`
to execute — the runtime reports that the executable was not found, not that the
container is unhealthy or that permissions are wrong.

🔴 **Read the error as inventory, not as failure.** "No such file or directory"
naming a shell means the image is small, which was the point. The four routes
below all work without one.

## Route 1 — `docker debug`

> "Get a shell into any container or image", "an alternative to debugging with
> `docker exec`"

It attaches a toolbox rather than using the image's own filesystem, which is
exactly the right shape for this problem:

- **It works on running, paused and stopped containers, and on images.** For images
  and stopped containers "all changes are discarded when leaving the shell"; when
  "accessing running or paused containers, all filesystem changes are directly
  visible to the container".
- **"At no point, do changes affect the actual image or container."** The toolbox
  lives in its own `/nix` directory, invisible to the container.
- **The toolbox "comes with many standard Linux tools pre-installed, such as
  `vim`, `nano`, `htop`, and `curl`"**, with `bash`, `fish` and `zsh` available and
  auto-detected, plus builtins including `install`, `uninstall` and `entrypoint`.

⚠️ **It is a Docker CLI command, so it is not part of the engine-neutral toolkit
this track otherwise teaches.** Check that your installation has it before you need
it at 2am; routes 2–4 work on any engine.

## Route 2 — a sidecar that joins the container's namespaces

The most portable technique, and the documentation's own debugging example:

```console
$ docker run --rm -it --pid=container:my-nginx \
  --cap-add SYS_PTRACE \
  --security-opt seccomp=unconfined \
  alpine
```

> `--pid` — `'container:<name|id>': joins another container's PID namespace`

The debug container has its own filesystem — with a shell, `ps`, `strace`,
whatever you put in it — while **seeing the target's processes as if they were its
own**. `SYS_PTRACE` is what lets `strace` and `gdb` attach across the boundary, and
`seccomp=unconfined` is what lets those syscalls through; both are in the
documented example, and both are why this is a debugging tool and not a deployment
pattern.

For network problems the equivalent is the network namespace:

> "you can attach a container to another container's networking stack directly,
> using the `--network container:<name|id>` flag format"

The debug container then has the target's interfaces, routes, resolver and
`localhost` — so `curl`, `dig` and `ss` are answering questions about the
container under investigation, not about a different one that happens to be on the
same network. That is the technique
[phase 7 · Debugging the network](../phase-7-networking/11-debugging-the-network.md)
builds on.

🔴 **What the sidecar does *not* give you is the target's filesystem.** PID and
network namespaces are separate from the mount namespace; joining them shows you
processes and packets, not files. For files, route 3 or route 4.

## Route 3 — `nsenter` from the host

When you have host access, the kernel's own tool does all of it:

> "**nsenter** executes _program_ in the namespace(s) that are specified in the
> command-line options."

```bash
nsenter -t <pid> -a          # every namespace of that process
nsenter -t <pid> -m -p       # mount + PID: the container's filesystem and processes
nsenter -t <pid> -n ss -tlnp # just the network namespace, one command
```

- `-t, --target PID` names the process whose namespaces you are entering — the
  container's PID **on the host**, which `docker inspect` reports.
- The namespace flags are `-m` mount, `-u` UTS, `-i` IPC, `-n` net, `-p` PID,
  `-U` user, `-C` cgroup, `-T` time, and **`-a, --all`** enters all of them.
- **With `-m` you are inside the container's filesystem**, so `nsenter` alone still
  needs binaries that exist there. The useful combination is entering the *network*
  or *PID* namespace while keeping the host's mount namespace — then you run the
  host's `ss`, `tcpdump` or `ps` against the container's namespace.
- If no program is given, "the shell from the user's `passwd(5)` entry is used",
  falling back to `/bin/sh`.

⚠️ This is a **host-level** tool: it needs access to the host and generally root.
On a managed platform you may not have it, which is the argument for routes 1 and 2
being in the runbook as well.

## Route 4 — copy the evidence out, or the tool in

> "Copy files/folders between a container and the local filesystem", and "the
> CONTAINER can be a running or stopped container"

```bash
docker cp web:/app/config.json ./config.json    # evidence out — works on a stopped container
docker cp ./busybox web:/tmp/busybox            # a static tool in
```

**Copying out of a stopped container is the underrated one** — a container that
crashed still has its filesystem until it is removed, so the config it actually
read and the file it half-wrote are both recoverable
([phase 1 · docker cp](../phase-1-running-containers/15-docker-cp.md)).

Four documented traps:

- **"Files copied to a container are created with UID:GID of the root user"** —
  so a tool copied in may be unreadable by a non-root container process unless you
  fix the mode, and `-a` preserves the source's ownership instead.
- **"`docker cp` doesn't create parent directories for DEST_PATH if they don't
  exist"** — the failure looks like a permission problem and is not.
- **"It isn't possible to copy certain system files such as resources under
  `/proc`, `/sys`, `/dev`, tmpfs, and mounts created by the user in the
  container."** The interesting runtime state is exactly what you cannot copy.
- **Symbolic links are copied as links**, not as their targets, unless `-L`.

⚠️ **A `--read-only` container refuses the copy in**, which is the hardening from
[topic 10](10-hardening/README.md) doing its job. Copy *out*, or use route 2.

## Route 5 — build the debuggable variant instead

The cleanest answer is often not to debug the production image at all:

- **A debug stage in the same Dockerfile.** Multi-stage builds let a `debug` target
  add a shell and tools on top of the same application layers
  ([phase 4 · `--target`](../phase-4-build-strategy/06-target.md)), so the binary
  under investigation is the same binary — only the surroundings differ.
- **The same image with a different entrypoint**, if it has any executable at all:
  `docker run --entrypoint /myapp web --version`.

🔴 **Both preserve the property that matters — the artefact is unchanged.**
Installing a shell into a running production container does not.

## The real fix is not needing a shell

Every question people open a shell for has a better answer that works when the
container is already gone:

| The question | Without a shell |
|---|---|
| "What is it doing?" | Logs on stdout/stderr ([topic 04](04-logs-to-stdout/README.md)) |
| "How was it configured?" | `docker inspect` — env, mounts, limits, the effective command |
| "Is it resource-starved?" | The cgroup numbers ([topic 11](11-observing.md)) |
| "Did it ever come up?" | The health status and `docker events` ([topic 09](09-healthchecks-in-production.md)) |
| "What changed?" | The image digest and the tag it was deployed from |

**A container you cannot answer those questions about has an observability
problem, not a shell problem** — and adding a shell would not have helped, because
the container that mattered has already exited.

## Podman

`podman exec` "execute[s] a command in a running container" with the same options
(`-i`, `-t`, `--user`, `--workdir`, `--env`, `--detach`), so it inherits the same
limitation: the binary must exist in the image.

- **`podman run --pid=container:<id>` and `--network container:<id>` work the same
  way**, so route 2 is fully portable.
- **`nsenter` is if anything easier under rootless Podman**, because the container
  processes are children of your session rather than of a daemon — but rootless
  namespaces are entered as your own user, and a mapped uid inside is not the uid
  you see outside ([phase 6 · `--userns=keep-id`](../phase-6-storage/09-userns-keep-id.md)).
- `podman cp` mirrors `docker cp`, including the copy-from-a-stopped-container
  case.

## Gotchas

**Symptom:** `docker exec -it web sh` fails with "no such file or directory" and
the container is plainly running.
**Cause:** The image has no shell — it is distroless or `scratch`. `exec` runs
binaries from the image's filesystem.
**Fix:** A namespace-sharing sidecar, `nsenter` from the host, or `docker debug`.
Do not add a shell to the production image.

**Symptom:** A sidecar joined with `--pid=container:app` and the target's files are
not there.
**Cause:** PID and mount namespaces are independent; joining one does not join the
other.
**Fix:** Use it for processes and syscalls. For files, `docker cp` out, or
`nsenter -m` from the host.

**Symptom:** A static binary was copied in and the container process cannot run it.
**Cause:** Files copied in are created owned by root, and the container runs as a
non-root user.
**Fix:** Fix the mode after copying, use `-a` to preserve ownership, or attach a
sidecar that brings its own filesystem.

**Symptom:** The container crashed and there is nothing left to inspect.
**Cause:** It was removed — by `--rm`, by a restart policy recreating it, or by a
cleanup job.
**Fix:** Keep the exited container until the investigation is done, and collect
`docker cp` evidence before removing it. Logs and metrics have to have been
shipped *before* the crash to survive it.

## Interview questions

**★ How do you debug a distroless container in production?**
Not by shelling into it, because there is no shell. Run a debug container that
joins its namespaces — `--pid=container:<id>` for processes, `--network
container:<id>` for the network — so your tools run from *your* filesystem against
*its* namespaces. From the host, `nsenter -t <pid>` does the same thing. `docker
cp` gets files out, including from a stopped container. The production image stays
as it is.

**★ Why does joining the PID namespace not give you the container's files?**
Because namespaces are independent. The PID namespace controls which processes you
can see, the mount namespace controls which filesystem you see. A sidecar joining
`--pid=container:app` keeps its own mount namespace, so it sees the target's
processes through its own `/proc` but its own root filesystem. Files need
`nsenter -m` or a copy.

**★ What is wrong with installing a shell into a running container to debug it?**
It changes the artefact you are investigating, so what you observe afterwards is a
different container from the one that failed; the change disappears on the next
restart, so it is not a fix; and if it is done by editing the image instead, the
security posture that removed the shell is gone permanently. The tools should come
from outside — a sidecar, `nsenter`, or a debug build target from the same
Dockerfile.

**What can `docker cp` not copy, and why does it matter here?**
Resources under `/proc`, `/sys`, `/dev`, tmpfs and user-created mounts — which is
most of the live runtime state you would want. It also creates files in the
container owned by root and does not create missing parent directories. It is a
tool for application files and evidence, not for runtime introspection.

**Which of these techniques survive the container having already exited?**
`docker cp` from the stopped container, `docker inspect`, `docker logs` for the
last run, and `docker debug` on the stopped container or the image. Everything
namespace-based needs a live process, so a sidecar and `nsenter` are both
unavailable — which is why the evidence has to be shipped continuously rather than
gathered on demand.

**When would you build a separate debug image?**
When the investigation needs tools repeatedly rather than once. A `debug` target in
the same multi-stage Dockerfile adds a shell and tooling on top of the identical
application layers, so the binary is unchanged and only its surroundings differ.
That is safer than a fat production image and more repeatable than a one-off
sidecar.

---

← Prev: [Observing](11-observing.md) · Index: [Phase 10](README.md) · Next → [Disk growth](13-disk-growth.md)
