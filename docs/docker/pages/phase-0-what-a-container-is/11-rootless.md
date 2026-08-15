---
title: "Rootless containers"
sidebar_label: "11 · Rootless containers"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the
> [Podman rootless tutorial](https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md),
> [Docker — rootless mode](https://docs.docker.com/engine/security/rootless/),
> [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
> and [subuid(5)](https://man7.org/linux/man-pages/man5/subuid.5.html).
> **No sandbox** — no console output on this page.

**Rootless means the engine and the container run as your ordinary user, while
processes inside still believe they are root.** The trick is the user namespace,
and once you understand its arithmetic, every strange file-ownership problem in
containers becomes obvious.

## The arithmetic

An administrator allocates each user a block of **subordinate** UIDs and GIDs in
`/etc/subuid` and `/etc/subgid`. The format is `USERNAME:UID:RANGE`:

```
johndoe:100000:65536
```

That reads: the user `johndoe` may use 65,536 UIDs starting at 100000. The
number 65536 is the conventional allocation — one full 16-bit range per user.

Podman then builds a user namespace that maps:

| Inside the container | Outside, on the host |
|---|---|
| UID **0** (root) | **your** UID — e.g. 1000 |
| UID **1** | 100000 |
| UID **2** | 100001 |
| UID **n** (n ≥ 1) | 100000 + n − 1 |

Two consequences fall straight out of the table, and they are the two things
people actually hit:

1. **Root inside is you outside.** A container process running as root writes
   files owned by *your* UID on the host. That is usually what you want.
2. **Any other UID inside maps into the 100000+ block.** A container running as
   UID 1000 internally (very common — `node`, `postgres`, `nginx` images all use
   a non-root UID) writes files owned by **100999** on the host. That is the
   famous "who is 100999 and why do they own my files" moment.

The mapping is performed by the setuid helpers **`newuidmap`** and
**`newgidmap`** from the `uidmap` package. Rootless Podman is not itself setuid;
it delegates the mapping to those helpers.

## Fixing ownership: `podman unshare`

The natural instinct — `chown` the directory on the host — fixes the wrong side
of the mapping. The correct tool runs the command *inside* your user namespace,
where the container's UIDs are the ones that exist:

```bash
# "Make this directory owned by UID 1000 AS THE CONTAINER SEES IT"
podman unshare chown -R 1000:1000 ./appdata

# Inspect the mapping your namespace uses
podman unshare cat /proc/self/uid_map
```

The alternative is to sidestep the mapping altogether:

```bash
# Make the container's user BE your host user
podman run --userns=keep-id -v ./appdata:/data:Z myimage
```

`keep-id` maps your host UID to the same UID inside, so bind-mounted files have
ownership that makes sense on both sides. It is the usual answer for development
bind mounts. Phase 6 covers the full set of `--userns` modes.

## Rootless Docker

Docker supports rootless too, and the mechanism is the same kernel feature. Per
Docker's documentation, rootless mode runs **the daemon and the containers**
inside a user namespace, and uses the same `newuidmap`/`newgidmap` binaries. It
needs the `uidmap` package and at least 65,536 subordinate IDs configured, and
is installed with `dockerd-rootless-setuptool.sh install`.

It is explicitly distinguished from **`userns-remap`**, an older mode where
containers are remapped but the **daemon still runs as root**. Rootless mode
moves both.

The difference in emphasis is what matters:

| | Docker | Podman |
|---|---|---|
| Rootless is | A mode you install and opt into | The default way it runs |
| Daemon | A rootless daemon still exists | No daemon at all |
| Typical use | Chosen for a hardened host | What you get by typing `podman` |

## What rootless costs

Honest limitations, all of which have workarounds covered later:

- **Ports below 1024 are refused.** Binding a privileged port needs privilege
  the process does not have. Publish a high port, or lower
  `net.ipv4.ip_unprivileged_port_start`. Phase 7.
- **Networking goes through a userspace helper** — `pasta` (or previously
  `slirp4netns`) rather than a kernel bridge. Throughput is lower and the source
  IP seen by containers can differ from what you expect.
- **File ownership needs thought**, as above.
- **Some workloads genuinely need privilege** — anything mounting filesystems,
  loading modules, or manipulating host networking.
- **Overlay on some kernels/filesystems.** The Podman manual notes OverlayFS is
  not supported rootless on kernels before 5.12.9, and network filesystems such
  as NFS bring their own problems. On a current distribution this is a non-issue.

## Why it is worth the friction

The security argument is simple and strong: **a container escape from a rootless
container lands as an unprivileged user, not as root.** With a rootful daemon,
access to the socket is access to root on the host — the whole class of
"mounted `/var/run/docker.sock` in CI" findings. Rootless removes that class
entirely.

For a development laptop and for most application workloads, that is a large
reduction in blast radius for a small amount of learning.

## Gotchas

**Symptom:** Files created by the container are owned by `100999` (or similar) on
the host and you cannot delete them.
**Cause:** Subordinate UID mapping — the container's UID 1000 is 100999 outside.
**Fix:** `podman unshare rm -rf ./that-directory`, or `podman unshare chown` to
set ownership as the container sees it. Do **not** `sudo chown` on the host: it
fixes the host view and breaks the container's.

**Symptom:** `docker run -p 80:80` works but `podman run -p 80:80` fails as your
user.
**Cause:** Privileged port, unprivileged process.
**Fix:** Publish 8080 and proxy, or set
`net.ipv4.ip_unprivileged_port_start=80` via sysctl if the host policy allows.
Running the container as root to get port 80 gives up the benefit you came for.

**Symptom:** A rootless container cannot write to a bind mount even as root
inside.
**Cause:** Two things at once, usually — UID mapping *and*, on Fedora/RHEL,
SELinux labels.
**Fix:** `--userns=keep-id` for the mapping and `:Z` on the mount for the label.
Solve them separately or you will not know which one worked.

**Symptom:** `podman` complains there are no subuid ranges for your user.
**Cause:** `/etc/subuid` and `/etc/subgid` have no entry for you — common on
hand-built or minimal systems.
**Fix:** `sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535
$USER`, then `podman system migrate`. This is administrator setup, not something
the engine can do for itself.

## Interview questions

**★ What makes rootless containers possible?**
The user namespace. It maps UIDs inside the container to a different, subordinate
range on the host, so a process can be UID 0 inside while being an unprivileged
UID outside. The ranges come from `/etc/subuid` and `/etc/subgid` and are applied
by `newuidmap`/`newgidmap`.

**★ Why do files created by a rootless container have strange owners?**
Because container UIDs above 0 map into the subordinate block. UID 1000 inside
becomes 100999 outside when the block starts at 100000. Root inside maps to your
own UID, which is why root-owned container files look normal and non-root ones do
not.

**★ How do you fix ownership on a rootless volume?**
`podman unshare chown …` — it runs inside your user namespace, so the UIDs you
type are the ones the container sees. Or avoid the problem with
`--userns=keep-id` so your host UID is preserved inside.

**Why can't a rootless container bind port 80?**
Binding below 1024 requires privilege the process does not have — that is a
kernel rule, not a container one. Publish a high port and proxy, or lower
`net.ipv4.ip_unprivileged_port_start`.

**What is the security benefit, concretely?**
An escape lands as an unprivileged user rather than root, and there is no
root-equivalent daemon socket to steal. It removes the "access to the Docker
socket is root on the host" problem rather than mitigating it.

**How does rootless Docker differ from `userns-remap`?**
`userns-remap` remaps containers but leaves the daemon running as root. Rootless
mode puts the daemon *and* the containers in a user namespace, so there is no
root daemon at all.

---

← Prev: [seccomp, AppArmor and SELinux](10-seccomp-apparmor-selinux.md) · Index: [Phase 0](README.md) · Next → [Why "works on my machine" stops](12-works-on-my-machine.md)
