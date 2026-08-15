---
title: "Phase 0 — What a container actually is"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Podman 6.1.0.** Every page here is
> **documentation-validated** against the Linux man pages, the OCI
> specifications and the two engines' own documentation, with the sources named
> per page. **No sandbox** — nothing was run, so no page carries a console
> output block. Commands are shown as commands.

The mental model everything else hangs off. Almost every "Docker is confusing"
complaint — why the memory limit looks ignored, why `localhost` does not reach
the database, why files are owned by user 100999, why the container exited with
137 — traces back to skipping this phase.

Fourteen pages. **The first four are the load-bearing ones**; if you read
nothing else, read those.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[A container is a process](01-a-container-is-a-process.md)** | <span className="db-tier t-master">Master</span> | Namespaces + cgroups + a root filesystem. The kernel has no container object |
| 02 | **[Namespaces](02-namespaces.md)** | <span className="db-tier t-master">Master</span> | Eight of them, and each one explains a specific confusing symptom |
| 03 | **[cgroups v2](03-cgroups.md)** | <span className="db-tier t-master">Master</span> | The limits, the files that hold them, and where exit code 137 comes from |
| 04 | **[The image is not the container](04-image-vs-container.md)** | <span className="db-tier t-master">Master</span> | Read-only layers plus one writable layer that dies with the container |
| 05 | **[The runtime stack, Docker](05-runtime-stack-docker.md)** | <span className="db-tier t-understand">Understand</span> | CLI → dockerd → containerd → shim → runc, and which layer an error came from |
| 06 | **[The runtime stack, Podman](06-runtime-stack-podman.md)** | <span className="db-tier t-understand">Understand</span> | No daemon at all: fork/exec, conmon per container, and what that costs |
| 07 | **[OverlayFS and copy-up](07-overlayfs.md)** | <span className="db-tier t-understand">Understand</span> | Whole-file copy on first write, and why deleting a secret does not remove it |
| 08 | **[The OCI specifications](08-oci-specs.md)** | <span className="db-tier t-understand">Understand</span> | Runtime, image, distribution — why two engines are interchangeable |
| 09 | **[Capabilities](09-capabilities.md)** | <span className="db-tier t-understand">Understand</span> | Root split into 14 defaults, and what `--privileged` really removes |
| 10 | **[seccomp, AppArmor and SELinux](10-seccomp-apparmor-selinux.md)** | <span className="db-tier t-understand">Understand</span> | Three layers, three questions, and the `:z`/`:Z` fix you will need on Fedora |
| 11 | **[Rootless containers](11-rootless.md)** | <span className="db-tier t-understand">Understand</span> | The subuid arithmetic, and why your files are owned by 100999 |
| 12 | **[Why "works on my machine" stops](12-works-on-my-machine.md)** | <span className="db-tier t-know">Know</span> | The image ships the filesystem *and* the config — and what still varies |
| 13 | **[Containers vs VMs vs serverless](13-containers-vs-vms.md)** | <span className="db-tier t-know">Know</span> | The honest trade, and how to get VM-grade isolation without changing images |
| 14 | **[Installing an engine](14-installing.md)** | <span className="db-tier t-know">Know</span> | Engine vs Desktop vs Podman, and the licence thresholds in plain numbers |

## Coverage

The syllabus lists fourteen topics for this phase and there are fourteen pages —
one to one, nothing merged and nothing dropped.

| Syllabus topic | Page |
|---|---|
| A container is a process — namespaces + cgroups + rootfs | 01 |
| Namespaces: mnt, pid, net, uts, ipc, user, cgroup, time | 02 |
| cgroups v2: CPU, memory, pids; Podman 6 dropped v1 | 03 |
| The image is not the container | 04 |
| The runtime stack, Docker | 05 |
| The runtime stack, Podman | 06 |
| OverlayFS: lowerdir/upperdir/merged, copy-up | 07 |
| The OCI specifications | 08 |
| Capabilities, `--cap-add`/`--cap-drop`, `--privileged` | 09 |
| seccomp, AppArmor and SELinux | 10 |
| Rootless containers: user namespaces, subuid/subgid | 11 |
| Why "works on my machine" stops being a sentence | 12 |
| Containers vs VMs vs serverless | 13 |
| Installing: Engine vs Desktop vs Podman, the licence question | 14 |

## Phase gate

Move on to Phase 1 when you can explain, out loud:

- why `ps aux` inside a container shows three processes while `free -h` shows
  the **host's** memory — and why those two answers come from **different**
  kernel features;
- what happens to a file written inside a container after `docker rm`;
- and what exit code 137 means, in at least two different ways.

If any of those is fuzzy, reread pages 01–04. Everything in Phases 6, 7 and 10
assumes them.

## Where this connects

- **Phase 1 — Running containers** turns this model into the commands you type
  every day. The exit-code table there is page 03's cgroups material seen from
  the outside.
- **Phase 6 — Storage** is page 04 and page 07 made practical: volumes exist
  because the writable layer is disposable and copy-up is expensive.
- **Phase 7 — Networking** is the network namespace from page 02, in full.
- **Phase 10 — Production** is where PID 1, OOM kills and resource limits stop
  being trivia and start being incidents.
- **Phase 11 — Podman in depth** continues pages 06 and 11: rootless internals,
  pods and Quadlet.

---

← Syllabus: [Part 1 — How containers work](../../syllabus/01-how-containers-work.md) · Start → [A container is a process](01-a-container-is-a-process.md)
