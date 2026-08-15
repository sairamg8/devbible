---
title: "Part 4 — Production and depth"
sidebar_label: "4 · Production and depth"
sidebar_position: 4
---

> Phases 10–12 · Running in production, Podman in depth, delivery and CI

The last part is the difference between "it runs on my laptop" and "it runs, and
when it stops running at 2am somebody can find out why." Phase 11 is the Podman
half of the track pulled together in one place, because that is where the two
engines genuinely diverge.

---

## Phase 10 — Running containers in production

Most production container incidents are one of about a dozen things. This phase
is that list, with the fix for each.

| Topic | Tier |
|---|---|
| **PID 1 is not a normal process** — no default signal handlers, no zombie reaping. `--init` / `tini`, and why your app hangs for 10 seconds on every deploy | <span className="db-tier t-master">Master</span> |
| **Graceful shutdown** — handling `SIGTERM` in the application, draining connections, and the stop timeout that kills you mid-request | <span className="db-tier t-master">Master</span> |
| **Resource limits** — `--memory`, `--cpus`, `--pids-limit`; what an OOM kill looks like (exit 137) and why the process "just vanished" | <span className="db-tier t-master">Master</span> |
| **Logs go to stdout and stderr** — that is the contract. Log files inside a container are a bug | <span className="db-tier t-master">Master</span> |
| **Configuration and secrets at runtime** — environment variables, mounted files, and the difference between "not in the image" and "not in the process list" | <span className="db-tier t-understand">Understand</span> |
| **The production failure catalogue** — OOM kill, disk full from logs, image pull rate limit, clock skew, DNS, unhealthy-but-still-serving, zombie PID 1 | <span className="db-tier t-master">Master</span> |
| **Restart policies as supervision** — what they cover, what they hide, and the crash loop that restarts forever without alerting anyone | <span className="db-tier t-understand">Understand</span> |
| **Log drivers and rotation** — `json-file` with `max-size` and `max-file`, `journald`, and the 40 GB log file that filled the disk | <span className="db-tier t-understand">Understand</span> |
| **Healthchecks in production** — what an orchestrator does with them, liveness vs readiness as *concepts* even without Kubernetes | <span className="db-tier t-understand">Understand</span> |
| **Hardening at run time** — `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, non-root user | <span className="db-tier t-understand">Understand</span> |
| **Observing** — `stats`, cAdvisor, exporting container metrics, and the difference between host memory and cgroup memory | <span className="db-tier t-know">Know</span> |
| **Debugging a container you cannot shell into** — distroless and scratch images, `docker debug`-style ephemeral attach, `nsenter`, and copying a binary in | <span className="db-tier t-understand">Understand</span> |
| **Disk growth** — images, dangling layers, volumes, build cache; pruning safely on a production host, and the flag that deletes volumes | <span className="db-tier t-understand">Understand</span> |
| **Running containers under systemd** — the unit that supervises, restarts and orders your container against the rest of the machine | <span className="db-tier t-understand">Understand</span> |
| Time, timezones and locales — why the container thinks it is UTC and your logs disagree | <span className="db-tier t-know">Know</span> |
| Zero-downtime restarts without an orchestrator — start-new, health-check, switch, stop-old | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain exit code 137 three different ways, and
say which one applies from the evidence.

---

## Phase 11 — Podman in depth

Podman is not "Docker with a different name". The daemonless, rootless design
changes real things. This phase is where the differences live, so the rest of the
track can stay engine-neutral.

| Topic | Tier |
|---|---|
| **Daemonless** — no `dockerd`, no root socket, containers are children of your session; what that changes for restart, for logs, and for `systemctl` | <span className="db-tier t-master">Master</span> |
| **Rootless by default** — user namespaces, `/etc/subuid` and `/etc/subgid`, and the UID arithmetic that explains every ownership surprise | <span className="db-tier t-master">Master</span> |
| **Pods** — a shared network namespace plus an infra container; containers in a pod reach each other on `localhost`, which is the one place that sentence is true | <span className="db-tier t-understand">Understand</span> |
| **Quadlet** — `.container`, `.volume`, `.network`, `.pod`, `.kube` and `.build` units that a systemd generator turns into services. The supported way to run containers as system services | <span className="db-tier t-master">Master</span> |
| **Where Podman will bite you** — no daemon to apply restart policies while you are logged out (`loginctl enable-linger`), healthchecks driven by systemd timers, `netavark`/`aardvark-dns` error messages, and Compose gaps | <span className="db-tier t-master">Master</span> |
| **`podman unshare`** — run a command inside your user namespace, which is how you fix ownership on a rootless volume | <span className="db-tier t-understand">Understand</span> |
| **`--userns`**: `keep-id`, `nomap`, `auto` — choosing the mapping instead of fighting it | <span className="db-tier t-understand">Understand</span> |
| **`podman pod create` / `ps` / `rm`**, and when a pod is the right answer versus a user-defined network | <span className="db-tier t-understand">Understand</span> |
| **Quadlet vs the deprecated `podman generate systemd`** — the old command still exists, gets no new features, and should not be in new work | <span className="db-tier t-understand">Understand</span> |
| **`podman auto-update`** — image-driven rolling updates for Quadlet services, with rollback | <span className="db-tier t-know">Know</span> |
| **`podman kube play` / `generate kube`** — run Kubernetes YAML locally, and use it as a genuine on-ramp rather than a toy | <span className="db-tier t-understand">Understand</span> |
| **Buildah and Skopeo** — the build and the image-transfer tools split out of the engine, and the jobs they do better | <span className="db-tier t-know">Know</span> |
| **Docker CLI compatibility** — `alias docker=podman`, the `podman.socket` API service, and what `DOCKER_HOST` needs to point at for tools like Testcontainers | <span className="db-tier t-understand">Understand</span> |
| **Podman 6 breaking changes** — cgroups v1 removed, BoltDB dropped with automatic SQLite migration, Intel macOS and Windows 10 hosts dropped | <span className="db-tier t-understand">Understand</span> |
| `podman machine` — the Linux VM behind Podman on macOS and Windows, and the resources it quietly consumes | <span className="db-tier t-know">Know</span> |
| Podman Desktop as the GUI, and what it adds over the CLI | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** run one of your project's services rootless as a Quadlet
unit that survives a reboot, and explain the UID mapping of a file it wrote to a
bind-mounted directory.

---

## Phase 12 — Delivery, CI and the road to orchestration

How the image gets from your machine to somewhere that matters, and the honest
answer to "do I need Kubernetes?"

| Topic | Tier |
|---|---|
| **Tag strategy** — `latest` is a trap in deployment; immutable tags (git SHA), plus moving tags for humans | <span className="db-tier t-master">Master</span> |
| **Building images in CI** — the pipeline shape, layer-cache export/import between runs, and why a cold CI build takes 8 minutes | <span className="db-tier t-understand">Understand</span> |
| **One image, three environments** — build once, promote the same digest through dev, staging and prod; configuration comes from the environment | <span className="db-tier t-master">Master</span> |
| **Registry authentication in CI** — short-lived tokens, OIDC, and never a long-lived password in a repository secret | <span className="db-tier t-know">Know</span> |
| **Testing with containers** — Testcontainers against a real Postgres, CI service containers, and the tests you can finally stop mocking | <span className="db-tier t-understand">Understand</span> |
| **Deploying without an orchestrator** — Compose on a VM, Quadlet units, or a PaaS that takes your image; the trade each makes | <span className="db-tier t-understand">Understand</span> |
| **When Compose stops being enough** — the honest threshold: multiple hosts, rolling updates with health gates, autoscaling, or a team that needs isolation | <span className="db-tier t-understand">Understand</span> |
| **Kubernetes on-ramp** — what your image, your Compose services and your healthchecks map to (Pod, Deployment, Service, probes), and what has no equivalent | <span className="db-tier t-know">Know</span> |
| Rolling updates and rollback by hand — the four-step dance, and its failure modes | <span className="db-tier t-when">When Needed</span> |
| `docker context` and driving a remote engine — useful, and a foot-gun when you forget which context you are on | <span className="db-tier t-know">Know</span> |
| Cost realities: registry storage, egress on every pull, CI build minutes, and cache as a cost lever | <span className="db-tier t-when">When Needed</span> |
| Docker Swarm in 2026 — status, and whether it should be on your list at all | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** a pipeline that builds one image, tags it by commit,
pushes it, and deploys that exact digest — with a rollback you have actually
tested.

---

← Prev: [Part 3 — Running a real stack](03-running-a-stack.md) · Index: [Docker & Podman](../README.md)
