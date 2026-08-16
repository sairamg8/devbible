---
title: "02 · Rootless by default"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html),
> [subuid(5)](https://man7.org/linux/man-pages/man5/subuid.5.html),
> [podman-unshare(1)](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html),
> [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and [Shortcomings of Rootless Podman](https://github.com/containers/podman/blob/main/rootless.md).
> **No sandbox** — no console output on this page.

The syllabus row is *user namespaces, `/etc/subuid` and `/etc/subgid`, and the UID
arithmetic that explains every ownership surprise.*

🔴 **One kernel sentence generates this entire topic:** a process in a user
namespace "has full privileges for operations inside the user namespace, but is
unprivileged for operations outside the namespace." The arithmetic explains the
ownership surprises; the same sentence explains every limitation.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The namespace you are always in](01-the-namespace-you-are-in.md)** | The kernel rule and what a user namespace isolates; `uid_map` as three numbers — inside-start, outside-start, length; `/etc/subuid` and `/etc/subgid` as an administrative delegation; Podman's two-row map, so container UID 0 is *you* and container UID *n* is `subuid_start + n − 1`; the overflow UID 65534 behind every `nobody`; and how Docker's rootless mode is the same mechanism with a different default |
| 02 | **[What rootless costs](02-what-it-costs.md)** | The documented shortcomings, each traced back to *unprivileged outside the namespace*: ports below 1024, `rootlessport` not preserving client source IPs, pasta and the host's own address, resource limits needing cgroups v2, the home-directory requirements and the VFS fallback, the finite ID range, device nodes failing even privileged — and the table of cases where running one container rootful is the right call |

## Four facts worth carrying out of this topic

- **Container UID 0 maps to your own UID.** Root in a rootless container writes
  files owned by you, not by host root.
- **Container UID *n* maps to `subuid_start + n − 1`.** That subtraction is the
  whole explanation for host UIDs like 100999.
- **`nobody` means "not in your map"**, rendered as the overflow ID 65534. It is
  not an ownership change.
- **`--privileged` does not lift any of the limitations**, because it grants
  privilege only inside a namespace you already own.

## Phase gate

Shown a host file owned by a six-figure UID, you can say which container UID wrote
it and why; and shown a rootless failure — a port, a limit, a slow build — you can
name which documented shortcoming it is before reading the error message.

## Where this connects

- [Phase 0 · 11 · Rootless](../../phase-0-what-a-container-is/11-rootless.md) —
  the introduction this topic supplies the mechanism for
- [Phase 0 · 09 · Capabilities](../../phase-0-what-a-container-is/09-capabilities.md)
  — capabilities are namespaced, which is why they buy nothing outside
- [Phase 6 · 05 · File ownership and UID mismatch](../../phase-6-storage/05-uid-mismatch/README.md)
  — the same arithmetic applied to bind mounts, and
  [the fixes](../../phase-6-storage/05-uid-mismatch/03-the-fixes.md) ranked
- [Phase 6 · 09 · `--userns=keep-id`](../../phase-6-storage/09-userns-keep-id.md)
  — the commonest of those fixes
- [Phase 7 · 08 · Rootless networking](../../phase-7-networking/08-rootless-networking.md)
  and [09 · Privileged ports rootless](../../phase-7-networking/09-privileged-ports-rootless.md)
  — the network half of the same story
- [Phase 10 · 03 · Resource limits](../../phase-10-production/03-resource-limits/README.md)
  — written assuming limits are enforced, which rootless on cgroups v1 breaks
- [01 · Daemonless](../01-daemonless/README.md) — the other half of Podman's
  default posture; the store being per user is why images cannot be shared
- [06 · `podman unshare`](../06-podman-unshare.md) and
  [07 · `--userns` modes](../07-userns-modes.md) — choosing the mapping instead
  of fighting it
- [14 · Podman 6 breaking changes](../14-podman-6-breaking-changes.md) — why
  dropping cgroups v1 was possible

---

Start → [01 · The namespace you are always in](01-the-namespace-you-are-in.md)
