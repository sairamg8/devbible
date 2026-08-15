---
title: "What rootless costs"
sidebar_label: "02 · What it costs"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Shortcomings of Rootless Podman](https://github.com/containers/podman/blob/main/rootless.md),
> [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html).
> **No sandbox** — no console output on this page.

Podman maintains a document called **Shortcomings of Rootless Podman**, and the
honest way to teach rootless is to read it rather than to discover it one
incident at a time. Almost every entry is the same kernel rule from
[the previous chunk](01-the-namespace-you-are-in.md) — *unprivileged for
operations outside the namespace* — landing somewhere specific.

🔴 **Nothing on this page is a bug, and nothing on it is fixed by adding
`--privileged`.** Privilege inside a namespace you already own buys nothing
outside it.

## Ports, and the one everyone hits first

> "Podman can not create containers that bind to ports < 1024."

Binding a low port is a host-level privileged operation, and you do not have it
outside your namespace. ⚠️ **It is the *host* side of the mapping that is
refused** — `-p 8080:80` is completely fine, because port 80 is inside the
container's own network namespace.

The routes out (raise the unprivileged port floor, put a proxy in front, or use a
socket-activated unit) are argued with their trades in
[Phase 7 · 09 · Privileged ports rootless](../../phase-7-networking/09-privileged-ports-rootless.md).

## Networking, and the two facts that reach production

Rootless networking has no real host interface to work with, so a userspace stack
does the job ([Phase 7 · 08](../../phase-7-networking/08-rootless-networking.md)).
Two documented consequences matter beyond development:

- **`rootlessport` "is a userspace proxy that does not preserve client source
  IPs."** Every connection appears to come from the proxy. Rate limiting, IP
  allowlists, geo logic and audit logs all read the wrong address — and they read
  it *correctly* in development, because in development everything is localhost
  anyway.
- **With pasta, "connections to that IP from containers do not work"**, because
  pasta "copies the IP address of the main interface". Reaching your own host by
  its primary address from inside a container is exactly the shape a
  half-migrated service has, so this one surfaces late.

## Resource limits need cgroups v2

> "No support for setting resource limits on systems using cgroups v1"

An unprivileged user cannot write to root's cgroup tree. Under cgroups v2, systemd
can *delegate* a subtree to your user manager, which is what makes rootless
`--memory` and `--cpus` work at all — and `podman-run(1)` notes `--cgroups`
"determines whether the container creates cgroups. Default is **enabled**".

🔴 **This is why "the memory limit did nothing" is a rootless report and not a
Docker one.** On a v1 host the flag is accepted and unenforced, which is the worst
combination: [Phase 10 · 03](../../phase-10-production/03-resource-limits/README.md)
teaches limits assuming they are real, and rootless on cgroups v1 is where that
assumption breaks. It is also the reason Podman 6 could simply drop v1 —
**Phase 11 · 14 · Podman 6 breaking changes** *(not written yet)*.

## Storage, and the home directory it lives in

The store is in `$HOME` ([topic 01](../01-daemonless/01-what-runs-instead.md)), so
the home filesystem's properties become the engine's properties:

- **"Does not work on NFS or parallel filesystem homedirs"** — the network-home
  setup common in universities and larger companies is simply not supported.
- **"Requires a writable home directory that is not mounted with `noexec` or
  `nodev`"** — hardened build agents mount home exactly like that, and the failure
  reads as a container problem.
- **"Only supported storage drivers are `overlay` and VFS"**, and unprivileged
  `overlayfs` "is only available for Podman version >= 3.1 on Linux kernel >=
  5.12, otherwise **fuse-overlayfs** will be used." VFS is the fallback that
  *works everywhere and copies whole layers*, so a host that quietly lands on it
  gets slow builds and large disk usage
  ([Phase 0 · 07 · OverlayFS](../../phase-0-what-a-container-is/07-overlayfs.md)).

## The map has edges

> "images with higher UIDs and GIDs cannot be used."

Your delegated range is finite — typically 65536 IDs. An image whose files are
owned by a UID beyond the end of your range cannot be represented, and the pull or
the run fails rather than silently truncating. It is uncommon, and when it happens
the fix is a larger `/etc/subuid` allocation, which only an administrator can make.

Two related entries follow from the store being per user:

- **"Container images cannot easily be shared with other users"**
- **"Difficult to use additional stores for sharing content"**

On a build machine where several users or CI runners want the same base images,
that is a real cost. The workaround — a shared read-only additional store — is
exactly what the document calls difficult, so plan for a registry pull instead.

## Devices, mounts and the commands that thin out

- **"Making device nodes within a container fails, even when using privileged
  containers"** — the clearest demonstration that `--privileged` is privilege
  *within your namespace*.
- **"A few commands do not work or have reduced functionality"**, checkpoint and
  restore among them.
- **"Some systemd unit configuration options do not work in the rootless
  container"** — worth knowing before **Phase 11 · 04 · Quadlet**
  *(not written yet)* rather than during it.

## Requirements, and the failure that looks like nothing

> "If `/etc/subuid` and `/etc/subgid` are not set up for a user, then podman
> commands can easily fail"

This is the single most common "Podman is broken" report on a freshly provisioned
account, and it is a two-line administrative fix
([the previous chunk](01-the-namespace-you-are-in.md) explains what those lines
are). Check them **first**, before reading any container error message closely.

## So when is rootless the wrong answer?

Being honest about the answer is the point of the topic. Rootless is the right
default, and these are the cases where it is not:

| Situation | Why rootless fails | What to do instead |
|---|---|---|
| Real source IPs required at the edge | `rootlessport` does not preserve them | Terminate at a host proxy and forward the address, or run that one container rootful |
| Enforced memory/CPU limits on a cgroups v1 host | Limits are accepted and not applied | Move to cgroups v2, or accept that the flag is decoration |
| NFS or `noexec` home directory | Store cannot live there | Relocate the graph root, or run rootful with a store on local disk |
| Shared base images across many users | Per-user stores, sharing is "difficult" | Pull from a registry per user; do not build a shared-store scheme |
| Device nodes, checkpoint/restore | Not available even privileged | Rootful, deliberately and narrowly |

🔴 **"Run it rootful" is a legitimate engineering decision, not a defeat** — but
it should be *one container with a written reason*, not the whole host reverting
to a root daemon because one service needed port 443.

## Gotchas

**Symptom:** Rate limiting and IP allowlists behave as if every client is the
same machine.
**Cause:** `rootlessport` is a userspace proxy that does not preserve client
source IPs.
**Fix:** Take the real address at a host-level proxy and pass it on, or move that
container to a rootful setup. Do not try to fix it inside the application.

**Symptom:** `--memory` has no effect; the container happily exceeds it.
**Cause:** A cgroups v1 host, where rootless resource limits are not supported.
**Fix:** Check the cgroup version first. On v2 the limits work through systemd
delegation; on v1 they are silently decorative, and Podman 6 removes v1 support
entirely.

**Symptom:** Builds are dramatically slower and the store is enormous.
**Cause:** The VFS driver was selected because `overlay` was unavailable —
kernel, Podman version, or the home filesystem.
**Fix:** Check which driver is in use and why. Getting to `overlay` or
`fuse-overlayfs` is worth more than any Dockerfile tuning.

**Symptom:** Everything fails on a new account with an obscure namespace error.
**Cause:** No `/etc/subuid` and `/etc/subgid` entries for the user.
**Fix:** Have them allocated. Read the two files before reading the error.

## Interview questions

**★ Why can a rootless container not bind port 80, even as root inside it?**
Because it is root only inside its user namespace, and binding a low port on the
host is an operation outside it. The refusal is on the *host* side of the
mapping — publishing to a high host port and listening on 80 inside the container
is unaffected.

**★ Name a rootless limitation that only shows up in production.**
`rootlessport` does not preserve client source IPs, so every connection looks like
it comes from the proxy. In development everything is localhost so nothing looks
wrong; in production rate limiting, allowlists and audit logging all quietly read
the wrong address.

**★ Why do resource limits need cgroups v2 under rootless Podman?**
Because an unprivileged user cannot write to the root cgroup hierarchy; v2 plus
systemd delegation gives your user manager a subtree it may control. On a
cgroups v1 host rootless resource limits are unsupported — the flag is accepted
and unenforced, which is worse than an error. Podman 6 dropped v1 support.

**Does `--privileged` fix rootless limitations?**
No, and that is the clearest illustration of the model. The documentation notes
that making device nodes fails "even when using privileged containers", because
`--privileged` grants privilege within a namespace you already own and grants
nothing outside it.

**What does rootless require of the home directory?**
That it is writable, not mounted `noexec` or `nodev`, and not on NFS or a parallel
filesystem — all documented shortcomings, and all common on managed workstations
and hardened build agents.

**When would you deliberately run a container rootful?**
When a documented shortcoming is load-bearing: real client source IPs at the edge,
enforced limits on a cgroups v1 host, device nodes, checkpoint/restore, or a store
that cannot live in `$HOME`. The right shape is one container with a written
reason, not a whole host reverting to a root daemon.

---

← Prev: [The namespace you are always in](01-the-namespace-you-are-in.md) · Index: [Phase 11](../README.md) · Next → [03 · Pods](../03-pods.md)
