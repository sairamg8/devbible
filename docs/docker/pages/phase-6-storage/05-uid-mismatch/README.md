---
title: "File ownership and UID mismatch"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Podman — troubleshooting](https://github.com/containers/podman/blob/main/troubleshooting.md),
> [Podman — podman-unshare](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html),
> [Podman — podman-run `--userns`](https://docs.podman.io/en/latest/markdown/podman-run.1.html) and
> [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).
> **No sandbox** — no console output on this page.

**A user ID is a number, and the kernel is the only thing that agrees on what it
means.** The container resolves it against the image's `/etc/passwd`, the host
resolves the same number against the host's, and a rootless engine shifts it
through a user namespace on the way. Files written into a bind mount carry the
number, not the name — which is why a file your container just created is owned
on the host by nobody you have ever heard of.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[A UID is just a number](01-a-uid-is-just-a-number.md)** | The model, rootful Docker's root-owned files, and why UID 1000 works by coincidence |
| 02 | **[Rootless, and the UID shift](02-rootless-and-the-shift.md)** | User namespaces, `/etc/subuid`, the mapping formula, and how to diagnose it in three commands |
| 03 | **[The fixes, and when to use each](03-the-fixes.md)** | `--user`, `--userns=keep-id`, `:U`, `podman unshare chown`, named volumes, and the entrypoint-chown pattern |

## Phase gate

You are done with this topic when, shown a file owned by `166535` on the host,
you can say which container UID wrote it, why the number is what it is, and pick
the right fix without trying three.

## Where this connects

- **[Phase 0 · rootless](../../phase-0-what-a-container-is/11-rootless.md)** is
  the mechanism this topic applies to storage.
- **[Phase 3 · `USER`](../../phase-3-dockerfile/09-user.md)** is where the
  container's UID is decided in the first place.
- **[04 · Bind mounts in development](../04-bind-mounts-in-development/README.md)**
  is where this hurts daily.
- **07 · SELinux `:z` and `:Z`** *(not written yet)* is the *other* "permission
  denied" — different cause, same symptom, and they are constantly confused.
- **09 · `--userns=keep-id`** *(not written yet)* is chunk 03's second fix in
  full.

---

← Prev: [Bind mounts in development](../04-bind-mounts-in-development/README.md) · Index: [Phase 6](../README.md) · Start → [A UID is just a number](01-a-uid-is-just-a-number.md)
