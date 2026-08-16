---
title: "01 · Daemonless"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [podman-system-service(1)](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html),
> [podman-logs(1)](https://docs.podman.io/en/latest/markdown/podman-logs.1.html),
> [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html),
> [logind.conf(5)](https://man7.org/linux/man-pages/man5/logind.conf.5.html)
> and [containers/conmon](https://github.com/containers/conmon).
> **No sandbox** — no console output on this page.

The syllabus row is *no `dockerd`, no root socket, containers are children of
your session; what that changes for restart, for logs, and for `systemctl`.*

🔴 **Daemonless is not "Docker minus a background service". It moves the
ownership of a running container from a machine-wide root daemon to your own
login session** — and restart, logs and supervision all follow ownership.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What runs instead of a daemon](01-what-runs-instead.md)** | `docker run` is an RPC, `podman run` is the container's parent; the `conmon` per container that survives your CLI; state on disk instead of in memory, and therefore per user — two users, two container worlds; why `sudo podman ps` is a different store rather than a wider view; and the API socket as an opt-in front door with a 5-second default timeout, not the architecture |
| 02 | **[What it changes: restart, logs and `systemctl`](02-restart-logs-and-systemctl.md)** | Restart policies with no daemon to enforce them, `podman-restart.service`, and `always` versus `unless-stopped` across a reboot; the session scope that logind terminates at logout and why `enable-linger` is the real fix; `journald` as the default log driver and `json-file` being an alias for `k8s-file`; and the payoff — systemd supervising the container itself rather than a client |

## Four facts worth carrying out of this topic

- **`podman run` is the container's parent process, not a client.** Every other
  difference in this phase is downstream of that sentence.
- **The state is files, and the files are per user.** `sudo podman ps` is a
  different world, not a bigger one.
- **A restart policy needs something running to enforce it.** Across a reboot
  that something is `podman-restart.service`, and it has to be enabled.
- **A container dying at logout is `logind` doing its documented job.** The fix
  is lingering plus a unit, not a container flag.

## Phase gate

You can explain what holds a Podman container's exit code, say where a rootless
image actually lives on disk, predict whether a given container survives a logout
and a reboot, and state why a systemd unit is a better fit under Podman than
under Docker.

## Where this connects

- [Phase 0 · 05 · The runtime stack, Docker](../../phase-0-what-a-container-is/05-runtime-stack-docker.md)
  and [06 · The runtime stack, Podman](../../phase-0-what-a-container-is/06-runtime-stack-podman.md)
  — the two chains this page argues the consequences of
- [Phase 0 · 11 · Rootless](../../phase-0-what-a-container-is/11-rootless.md) —
  the other half of Podman's default posture
- [Phase 1 · 12 · Restart policies](../../phase-1-running-containers/12-restart-policies.md)
  — the engine-neutral version of the policy table
- [Phase 10 · 07 · Restart policies as supervision](../../phase-10-production/07-restart-as-supervision.md)
  — what a policy covers and what it hides
- [Phase 10 · 08 · Log drivers and rotation](../../phase-10-production/08-log-drivers-and-rotation.md)
  — the Docker defaults this page contrasts with
- [Phase 10 · 14 · Running containers under systemd](../../phase-10-production/14-under-systemd.md)
  — the unit that supervises a client, and why Podman does not need the workaround
- [02 · Rootless by default](../02-rootless-by-default/README.md) — the
  user-namespace arithmetic
- [04 · Quadlet](../04-quadlet/README.md) — where "let systemd own the container"
  becomes a file you write
- [13 · Docker CLI compatibility](../13-docker-cli-compatibility.md) — the API
  socket in anger, for Testcontainers and friends

---

Start → [01 · What runs instead of a daemon](01-what-runs-instead.md)
