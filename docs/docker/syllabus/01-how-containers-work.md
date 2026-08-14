---
title: "Part 1 — How containers work"
sidebar_label: "1 · How containers work"
sidebar_position: 1
---

> Phases 0–2 · Kernel primitives, running containers, images and registries

This is the part that decides whether containers ever stop feeling like magic.
A container is not a lightweight VM and it is not a program — it is **an ordinary
Linux process that has been lied to about what it can see**. Everything
downstream is a consequence of that sentence.

---

## Phase 0 — What a container actually is

The mental model everything else hangs off. Skip it and you will spend years
pattern-matching commands instead of predicting behaviour.

| Topic | Tier |
|---|---|
| **A container is a process** — namespaces (what it sees) + cgroups (what it may use) + a root filesystem. There is no "container" object in the kernel | <span className="db-tier t-master">Master</span> |
| **Namespaces**: `mnt`, `pid`, `net`, `uts`, `ipc`, `user`, `cgroup`, `time` — what each one hides, and which one explains which symptom | <span className="db-tier t-master">Master</span> |
| **cgroups v2**: CPU, memory and pids limits; why the container "sees" host RAM unless you look at the cgroup. Podman 6 dropped cgroups v1 entirely | <span className="db-tier t-master">Master</span> |
| **The image is not the container** — read-only layers plus one writable layer, thrown away on `rm` | <span className="db-tier t-master">Master</span> |
| **The runtime stack, Docker**: CLI → `dockerd` → `containerd` → shim → `runc`. Which piece dies when what breaks | <span className="db-tier t-understand">Understand</span> |
| **The runtime stack, Podman**: no daemon — `podman` forks `conmon`, which execs `crun`, and your container is a child of your shell's session | <span className="db-tier t-understand">Understand</span> |
| **OverlayFS**: `lowerdir` / `upperdir` / `merged`, and **copy-up** — why writing 1 byte to a 2 GB file costs 2 GB | <span className="db-tier t-understand">Understand</span> |
| The **OCI specifications**: image spec, runtime spec, distribution spec — the reason Docker and Podman are interchangeable at all | <span className="db-tier t-understand">Understand</span> |
| **Capabilities** — the default dropped set, `--cap-add` / `--cap-drop`, and what `--privileged` actually switches off | <span className="db-tier t-understand">Understand</span> |
| **seccomp, AppArmor and SELinux** — the second confinement layer, and the one that produces "permission denied" on a file you can see | <span className="db-tier t-understand">Understand</span> |
| **Rootless containers**: user namespaces, `/etc/subuid` and `/etc/subgid`, and why UID 0 inside is UID 100000-ish outside | <span className="db-tier t-understand">Understand</span> |
| Why "works on my machine" stops being a sentence — the image ships the filesystem *and* the config | <span className="db-tier t-know">Know</span> |
| Containers vs VMs vs serverless — the honest trade: isolation strength, boot time, density, blast radius | <span className="db-tier t-know">Know</span> |
| Getting one installed: Docker Engine vs Docker Desktop vs Podman, and the Desktop licence question | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why `ps aux` inside a container shows
three processes, why `free -h` shows the host's memory, and why those two
answers come from *different* kernel features.

---

## Phase 1 — Running containers

The commands you will type ten thousand times. The goal of this phase is not
memorising flags — it is being able to predict what a container will do before
you press enter.

| Topic | Tier |
|---|---|
| **`docker run` anatomy** — `run [flags] IMAGE [command] [args]`, and why flags after the image name are the app's, not Docker's | <span className="db-tier t-master">Master</span> |
| **Foreground vs detached** — `-d`, `--rm`, `--name`, and what happens to a container you forgot to name | <span className="db-tier t-master">Master</span> |
| **`ps` / `ps -a` / `inspect` / `logs` / `stats`** — the four questions you ask about a running thing, and which command answers each | <span className="db-tier t-master">Master</span> |
| **`exec` into a running container** vs `run` a second one — the distinction that fixes "my changes disappeared" | <span className="db-tier t-master">Master</span> |
| **Publishing ports**: `-p 8080:3000`, `-p 127.0.0.1:8080:3000`, and the security difference between the two | <span className="db-tier t-master">Master</span> |
| **Environment**: `-e`, `--env-file`, and precedence against the image's own `ENV` | <span className="db-tier t-master">Master</span> |
| **The lifecycle**: created → running → paused → exited, and `start` / `stop` / `restart` / `kill` / `pause` | <span className="db-tier t-understand">Understand</span> |
| **Stop is two signals** — `SIGTERM`, then `SIGKILL` after the timeout (`-t`). `STOPSIGNAL` changes the first one | <span className="db-tier t-understand">Understand</span> |
| **Exit codes that mean something**: 125 (daemon/CLI), 126 (not executable), 127 (not found), 137 (SIGKILL / OOM), 143 (SIGTERM) | <span className="db-tier t-understand">Understand</span> |
| **`-i`, `-t` and `-it`** — what a TTY actually allocates, and why `-it` hangs a CI job | <span className="db-tier t-understand">Understand</span> |
| **Overriding `ENTRYPOINT` and `CMD` at run time** — `--entrypoint`, trailing args, and how to get a shell in an image that has no shell entrypoint | <span className="db-tier t-understand">Understand</span> |
| **`--restart` policies**: `no`, `on-failure[:n]`, `always`, `unless-stopped` — and that Podman implements them without a daemon | <span className="db-tier t-understand">Understand</span> |
| **Reclaiming disk**: `rm`, `image prune`, `system prune`, `system df` — and the one that deletes your volumes | <span className="db-tier t-understand">Understand</span> |
| `--user`, `--workdir`, `--hostname`, `--add-host` | <span className="db-tier t-know">Know</span> |
| `docker cp` in and out of a container — useful, and a smell if it is load-bearing | <span className="db-tier t-know">Know</span> |
| `attach` vs `logs -f`, and the detach key sequence that saves you from killing production | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** a container exits immediately and you can name the
three likely causes without searching, and you can get a shell inside an image
whose entrypoint is a binary.

---

## Phase 2 — Images, layers and registries

Where images come from, what they are made of, and how to refer to one such that
you get the same bytes tomorrow.

| Topic | Tier |
|---|---|
| **Image references**: `registry/namespace/repository:tag@digest`, and everything that is implicit when you type `node:24` | <span className="db-tier t-master">Master</span> |
| **Tags move, digests do not** — `@sha256:…` is the only reference that means one exact image | <span className="db-tier t-master">Master</span> |
| **`pull` / `push` / `images` / `tag` / `rmi`** and what "dangling" means | <span className="db-tier t-master">Master</span> |
| **Layers**: each instruction produces one, layers are shared between images, and identical layers are stored once | <span className="db-tier t-master">Master</span> |
| **Choosing a base image**: full distro vs `-slim` vs Alpine vs distroless vs `scratch` — the size/debuggability/compatibility triangle | <span className="db-tier t-understand">Understand</span> |
| **`history`** — reading how an image was built, and spotting the layer that added 400 MB | <span className="db-tier t-understand">Understand</span> |
| **The image config**: `Env`, `Entrypoint`, `Cmd`, `User`, `WorkingDir`, `Labels`, `ExposedPorts` — the JSON that `inspect` shows you | <span className="db-tier t-understand">Understand</span> |
| **Registries**: Docker Hub, GHCR, Quay, ECR/GAR/ACR — and Hub's anonymous **pull rate limits**, which is what breaks your CI at 3pm | <span className="db-tier t-understand">Understand</span> |
| **Authentication**: `login`, credential helpers, and the base64 blob in `~/.docker/config.json` that is not encryption | <span className="db-tier t-understand">Understand</span> |
| **Multi-arch images and the manifest list** — one tag, many platforms; the `exec format error` you get on arm64 | <span className="db-tier t-understand">Understand</span> |
| **`save`/`load` vs `export`/`import`** — images with layers versus a flattened filesystem, and why the second loses your `ENTRYPOINT` | <span className="db-tier t-know">Know</span> |
| **Podman's `registries.conf`** — unqualified search registries and why `podman run nginx` can ask you *which* nginx | <span className="db-tier t-know">Know</span> |
| Where layers live on disk: the storage driver, `overlay2` for Docker, `containers/storage` for Podman | <span className="db-tier t-know">Know</span> |
| Running your own registry, and when a pull-through cache pays for itself | <span className="db-tier t-know">Know</span> |
| Image signing: Sigstore / cosign, and what a signature does and does not prove | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** pin one of your project's base images by digest, explain
what breaks when the upstream tag moves, and describe how you would find out
that it moved.

---

← Index: [Docker & Podman](../README.md) · Next → [Part 2 — Building images](02-building-images.md)
