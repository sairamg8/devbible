---
title: "Capabilities and --privileged"
sidebar_label: "09 · Capabilities"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker run — runtime privilege and Linux capabilities](https://docs.docker.com/engine/containers/run/),
> [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html) and
> [Docker security](https://docs.docker.com/engine/security/).
> **No sandbox** — no console output on this page.

**Linux capabilities split root's power into individual permissions, so a
process can have one of them without having all of them.** Containers use this
to run "as root" while holding a small fraction of what root can normally do.

## Root is not one thing

Historically a process was either UID 0 — able to do everything — or not, and
able to do almost nothing privileged. Capabilities break that binary into
roughly forty separate powers, each grantable on its own: bind a low port, change
file ownership, load a kernel module, use raw sockets, and so on.

A container's root therefore has a **specific, enumerable** set of powers. Not
"root", not "not root", but a list.

## The default set

Docker grants **14** capabilities by default:

| Capability | What it permits |
|---|---|
| `CHOWN` | Change file UIDs and GIDs arbitrarily |
| `DAC_OVERRIDE` | Bypass file read/write/execute permission checks |
| `FOWNER` | Bypass permission checks that require matching filesystem UID |
| `FSETID` | Keep setuid/setgid bits when a file is modified |
| `KILL` | Send signals regardless of ownership |
| `SETGID` / `SETUID` | Change group and user IDs — how a process drops to a non-root user |
| `SETPCAP` | Modify its own capability set |
| `SETFCAP` | Set file capabilities |
| `NET_BIND_SERVICE` | Bind to ports below 1024 |
| `NET_RAW` | Use RAW and PACKET sockets — ping, and packet crafting |
| `SYS_CHROOT` | Use `chroot(2)` |
| `MKNOD` | Create special files with `mknod(2)` |
| `AUDIT_WRITE` | Write records to the kernel audit log |

Docker's approach is an **allowlist**: everything else is dropped. Notably
absent, and worth knowing by name because their absence is what you hit:

- `SYS_ADMIN` — mounting, and a large share of privileged operations
- `SYS_MODULE` — loading kernel modules
- `SYS_TIME` — setting the system clock
- `SYS_PTRACE` — attaching a debugger to another process
- `NET_ADMIN` — configuring interfaces, routes, iptables

## Adjusting the set

```bash
# Add exactly what is needed
docker run --cap-add=NET_ADMIN myimage

# Drop everything, then re-add the minimum — the posture you want in production
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myimage

# Same flags on Podman
podman run --cap-drop=ALL --cap-add=CHOWN myimage
```

Both flags accept `ALL`, and the `CAP_` prefix is optional. The
**drop-all-then-add-back** pattern is the one to internalise: it makes the
container's privileges an explicit, reviewable list instead of an inherited
default.

Two capabilities are worth dropping deliberately even from the default set:

- **`NET_RAW`** — enables packet crafting and ARP spoofing from a compromised
  container. Very few applications need it; `ping` is usually the only casualty.
- **`DAC_OVERRIDE`** — lets root inside bypass all file permission checks, which
  substantially weakens any file-permission hardening you did in the image.

## `--privileged` is not "a bit more access"

`--privileged` gives the container access to all host devices and reconfigures
AppArmor or SELinux so it has nearly the same access as a process running outside
a container.

In practice that means: all capabilities, all devices under `/dev`, and the
security modules stood down. **A privileged container that can see the host
filesystem is a root shell on the host.** It is not a debugging convenience; it
is a decision to remove the boundary.

Legitimate uses exist — Docker-in-Docker, some storage and networking agents,
certain hardware access — and for each of them there is usually a narrower
alternative:

| Instead of `--privileged` | Try |
|---|---|
| Access one device | `--device=/dev/ttyUSB0` |
| Change network settings | `--cap-add=NET_ADMIN` |
| Mount filesystems | `--cap-add=SYS_ADMIN` (still broad — prefer avoiding) |
| Profile or debug a process | `--cap-add=SYS_PTRACE` |
| Build images in CI | A rootless builder, buildx, or Podman — not privileged DinD |

## The complementary flag

```bash
docker run --security-opt=no-new-privileges myimage
```

This sets the kernel's `no_new_privs` bit, which prevents a process from gaining
privileges through `execve()` — most importantly, it neutralises setuid binaries
inside the container. It is cheap, almost never breaks anything, and closes a
common privilege-escalation path. Turn it on by default.

## Gotchas

**Symptom:** `ping` fails inside a container with "operation not permitted".
**Cause:** `NET_RAW` was dropped, or the image's `ping` lacks file capabilities.
**Fix:** Usually leave it — `ping` is a diagnostic, not a dependency. If you
genuinely need it in a debug image, `--cap-add=NET_RAW` for that run only.

**Symptom:** A container needs to write to a bind-mounted directory and
"root inside" cannot, despite being root.
**Cause:** With a user namespace in play, root inside is an unprivileged UID
outside, and `DAC_OVERRIDE` does not apply to the host's view.
**Fix:** Fix the ownership on the host side, or run with `--userns=keep-id`
under Podman. Adding capabilities will not help — this is a mapping problem, not
a capability problem. Phase 6.

**Symptom:** Someone "fixed" a permission error by adding `--privileged`, and it
worked.
**Cause:** It always works, because it removes the boundary.
**Fix:** Find the actual missing capability or device and add only that.
`--privileged` in a Compose file is a finding in any security review, and the
error it silenced is still there.

**Symptom:** An application that mounts something (a FUSE filesystem, an
overlay) fails inside a container.
**Cause:** `SYS_ADMIN` is not in the default set.
**Fix:** Add `SYS_ADMIN` if it is genuinely required — and understand that it is
a very broad capability, close to privileged for many purposes. Prefer doing the
mount on the host and bind-mounting the result in.

## Interview questions

**★ What are Linux capabilities and why do containers care?**
They split root's authority into individual, separately-grantable powers.
Containers use them to run a process as UID 0 while holding only a small subset
of root's abilities — 14 by default in Docker — which sharply reduces what a
compromise can do.

**★ What does `--privileged` actually do?**
Grants all capabilities, exposes all host devices, and stands down AppArmor or
SELinux confinement. It is close to running the process directly on the host.
It should be a deliberate, justified choice, never a fix for a permission error.

**★ How do you harden a container's privileges?**
`--cap-drop=ALL` and add back only what is required; `--security-opt=no-new-privileges`;
a non-root `USER`; `--read-only` with `tmpfs` for the paths that need writing;
and rootless where possible. Each is one flag, and together they cover most of
the practical attack surface.

**Which default capabilities would you drop first?**
`NET_RAW`, because packet crafting from a compromised container is a real
lateral-movement tool and almost nothing needs it, and `DAC_OVERRIDE`, because it
bypasses the file permissions you set in the image.

**Does running as a non-root `USER` make capabilities irrelevant?**
No, but it helps a lot. A non-root process cannot use most capabilities anyway,
so the two controls reinforce each other — which is why the recommended posture
is both, not either.

**What does `no-new-privileges` prevent?**
A process gaining privileges through `execve()` — principally via setuid
binaries. It closes a standard escalation path inside the container at almost no
compatibility cost.

---

← Prev: [The OCI specifications](08-oci-specs.md) · Index: [Phase 0](README.md) · Next → [seccomp, AppArmor and SELinux](10-seccomp-apparmor-selinux.md)
