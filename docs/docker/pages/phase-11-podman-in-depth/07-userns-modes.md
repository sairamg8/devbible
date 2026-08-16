---
title: "--userns: keep-id, nomap, auto"
sidebar_label: "07 · --userns modes"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [podman-run(1) `--userns`](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and its source [`options/userns.container.md`](https://github.com/containers/podman/blob/main/docs/source/markdown/options/userns.container.md),
> [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html),
> [Docker — isolate containers with a user namespace](https://docs.docker.com/engine/security/userns-remap/)
> and [Docker — rootless mode](https://docs.docker.com/engine/security/rootless/).
> **No sandbox** — no console output on this page.

[Phase 11 · 02](02-rootless-by-default/README.md) explains the mapping you get.
**`--userns` is how you choose a different one.** Almost every ownership
argument in this track ends here: you can fight the map with `chown`, or you can
pick a mode where the numbers already line up.

There are six modes and only three of them come up in practice. The value of
learning all six is that it makes clear what the flag *is* — a choice of
namespace, not a permission switch.

## First: what you get when you do not set it

The resolution order is documented and worth knowing, because two of its rules
are things people set elsewhere and forget:

1. **If `--pod` is set, the pod's user namespace is used** and `--userns` is
   ignored entirely.
2. Otherwise the **`PODMAN_USERNS`** environment variable, if set.
3. Otherwise **`userns` in `containers.conf`**.
4. Otherwise **`--userns=host`**.

🔴 **Rule 1 is the one that bites.** Adding a container to a pod
([Phase 11 · 03](03-pods.md)) silently discards the `--userns` you wrote — the
namespace belongs to the pod. There is no warning, because it is not an error.

## The six modes

| Mode | What it does | When |
|---|---|---|
| **`host`** or **`""`** | Runs in the caller's user namespace. "The processes running in the container have the same privileges on the host as any other process launched by the calling user" | The default when nothing else is set |
| **`keep-id`** | Your UID and GID appear as themselves inside the container | Rootless development with bind mounts |
| **`nomap`** | "Creates a user namespace where the current rootless user's UID:GID are not mapped into the container" | Rootless, when the container should have no way to act as *you* |
| **`auto`** | "Podman allocates unique ranges of UIDs and GIDs from the `containers` subordinate user IDs" — a different range per container | Rootful, when containers must not share an ID space |
| **`container:id`** | Joins the user namespace of another container | Debugging, sidecars |
| **`ns:namespace`** | Joins an existing namespace by path | Scripting, unusual setups |

## `keep-id` — the one you will actually use

```bash
podman run --userns=keep-id -v "$(pwd)":/app:z node:22 npm test
```

Your host UID and GID map to the same numbers inside, so a bind mount round-trips
and files come out owned by you on both sides. It takes `uid=`, `gid=` and
`size=` sub-options when the image expects a specific account, and it is
**rootless-only in the sense that matters** — the documentation notes that for
containers created by root, "the current mapping is created into a new user
namespace", which is not the identity-preserving behaviour the name promises.

⚠️ **It overrides the image's `USER`.** The init process runs as your UID unless
you name one explicitly, which is usually what you wanted and occasionally
breaks an image that reads its own user's home directory.

The full argument — why `--user 1000` is not a substitute, what it costs, and
where it sits among the other seven fixes — is
[Phase 6 · 09](../phase-6-storage/09-userns-keep-id.md) and
[Phase 6 · 05 · The fixes](../phase-6-storage/05-uid-mismatch/03-the-fixes.md).
This page is the map of the modes; that one is the depth on this mode.

## `nomap` — the security mode nobody knows about

The default rootless mapping puts **your** UID at container UID 0. That is
convenient and it is also a real exposure: a process that escapes the container's
filesystem is acting as you, and everything you own is in reach.

`nomap` removes your UID from the map entirely. Container UID 0 becomes the
first ID of your *subordinate* range instead of you, so there is no ID inside
the container that corresponds to your account at all. Nothing in the container
can produce a file you own, and nothing in it can touch one.

```bash
podman run --userns=nomap -v data:/var/lib/app postgres:17
```

The trade is exactly the one you would expect: **bind mounts stop working the
easy way**, because no ID inside now maps to the owner of your files. That is
why it pairs with named volumes and not with `-v "$(pwd)":/app`. It is also
"not permitted for root-created containers" — like `keep-id`, it is a statement
about a rootless mapping and there is nothing for it to mean rootful.

🔴 **The rule of thumb:** `keep-id` for code you are editing, `nomap` for a
service holding data you do not want a container process to be able to reach as
you. They are opposite answers to the same question.

## `auto` — one range per container

`auto` asks Podman to allocate a unique range per container rather than reusing
one. Rootful it needs a subordinate range for the `containers` user in
`/etc/subuid` and `/etc/subgid`; rootless it draws from your own ranges.

```bash
podman run --userns=auto:size=65536 myimage
podman run --userns=auto:uidmapping=0:100000:1000 myimage
```

`size=`, `uidmapping=CONTAINER_UID:HOST_UID:SIZE` and `gidmapping=` shape the
allocation. The point is **isolation between containers**, not between the
container and the host: with the default rootful mapping, two containers running
as UID 0 are the same UID on disk, so a shared volume gives each one full access
to the other's files. `auto` makes them different real users.

⚠️ **It costs you predictability.** The host UIDs change per container, so
anything that depends on stable ownership — a bind mount, a backup script, an
audit rule — has to stop depending on it first.

## `host`, and why the default is not "no namespace"

`host` runs the container in the caller's user namespace, with "the same
privileges on the host as any other process launched by the calling user".

Read that sentence twice, because it means two different things:

- **Rootful**, the caller is root, so the container's root **is** the host's
  root. There is no user-namespace boundary at all.
- **Rootless**, the caller is you inside the namespace rootless Podman already
  set up, so you still get the subordinate-ID mapping
  [Phase 11 · 02](02-rootless-by-default/README.md) derives. "Host" here means
  *the namespace I am already in*, not *no namespace*.

That asymmetry is why the same command has such different security properties on
the two engines, and it is the honest answer to "is `--userns=host` dangerous?"
— rootful, yes; rootless, it is the status quo.

## `container:` and `ns:`

`container:id` joins another container's user namespace, and `ns:namespace`
joins one by path. Both are for the case where two processes must agree on ID
mapping — a debugging sidecar that needs to read the target's files as the
target sees them, closest in spirit to the namespace-sharing routes in
[Phase 10 · 12](../phase-10-production/12-debugging-without-a-shell.md).

If you find yourself reaching for them in an application, a **pod** is almost
certainly the construct you wanted ([Phase 11 · 03](03-pods.md)).

## Docker's version of this flag, which is not the same flag

Docker has `--userns=host` too, and it means something narrower. Docker's user
namespaces are configured **on the daemon** with `userns-remap`, which re-maps
container root "to a less-privileged user on the Docker host" so that, in their
example, "UID 231072 is mapped within the namespace as UID 0 (root)" with "no
privileges on the host machine itself". When that is enabled, "all containers
are started with user namespaces enabled by default", and `--userns=host` exists
to **disable** it for one container — the documented case being privileged
containers, since `--privileged` is not allowed "without also specifying
`--userns=host`".

The differences that matter:

| | Docker `userns-remap` | Podman `--userns` |
|---|---|---|
| Scope | Daemon-wide, one mapping for everything | Per container |
| Default | Off — containers run unmapped unless configured | Rootless, mapping is the normal state |
| Per-container choice | Only `host` (opt **out**) | Six modes (opt **in** to a specific one) |
| Also disables | PID/NET namespace sharing with the host, unaware volume drivers | — |

Rootless Docker is a different feature again — the daemon itself runs inside a
namespace — and it needs "at least 65,536 subordinate UIDs/GIDs for the user",
the same arithmetic from the same files.

## Gotchas

**Symptom:** `--userns=keep-id` appears to do nothing; files are still owned by
a high-numbered UID.
**Cause:** The container is in a pod. When `--pod` is set, the pod's user
namespace is used and `--userns` is ignored.
**Fix:** Set the namespace on `podman pod create`, or run the container outside
the pod.

**Symptom:** `--userns=nomap` broke a bind mount that worked yesterday.
**Cause:** That is the mode working. Your UID is deliberately not mapped, so no
ID inside the container owns your files.
**Fix:** Use a named volume with `nomap`, or use `keep-id` if the bind mount is
the point.

**Symptom:** A command that works on your machine fails on a colleague's with a
different mapping entirely.
**Cause:** `PODMAN_USERNS` or `containers.conf` is setting a default one of you
has and the other does not — both sit above `host` in the resolution order and
neither is visible in the command line.
**Fix:** Check `PODMAN_USERNS` and `containers.conf` before debugging the flag.
Being explicit in scripts costs nothing.

**Symptom:** `--userns=auto` works as root and fails rootless with a subordinate
ID error.
**Cause:** `auto` allocates out of subordinate ranges — rootful, out of the
`containers` user's entry in `/etc/subuid` and `/etc/subgid`, which may not
exist.
**Fix:** Configure that entry, or use a mode that draws on the invoking user's
existing ranges.

## Interview questions

**★ What does `--userns=keep-id` actually change?**
It maps your host UID and GID to the same numbers inside the container instead of
to the default rootless mapping, so files written through a bind mount are owned
by you on both sides. It also overrides the image's `USER` for the init process
unless you name a UID explicitly. It is the standard answer for rootless
development bind mounts.

**★ What is `nomap` for, and how is it the opposite of `keep-id`?**
`nomap` creates a namespace where the current rootless user's UID and GID are not
mapped into the container at all — so nothing inside can act as you or produce a
file you own. `keep-id` deliberately makes the container able to act as you.
Choose `keep-id` for code you are editing and `nomap` for a service whose
process should have no route to your files; pair `nomap` with named volumes,
because bind mounts stop lining up by design.

**★ What decides the mapping when `--userns` is not given?**
In order: the pod's namespace if `--pod` is set — which ignores `--userns`
entirely — then `PODMAN_USERNS`, then `userns` in `containers.conf`, then
`host`. The first rule is the one that surprises people, because adding a
container to a pod silently discards the flag.

**Is `--userns=host` dangerous?**
It depends on who is running it. Rootful it means there is no user-namespace
boundary and the container's root is the host's root. Rootless it means the
namespace you were already in, so you still have the subordinate-ID mapping and
it is simply the default. The documented behaviour — the same privileges as any
other process launched by the calling user — reads very differently when the
calling user is root.

**When would you use `auto`?**
When containers must not share an ID space with each other — typically rootful,
where every container's root would otherwise be host UID 0 and a shared volume
gives each full access to the other's files. `auto` allocates a unique
subordinate range per container. The cost is that host ownership is no longer
predictable, so anything relying on stable UIDs has to stop.

**How is Docker's `--userns` different?**
Docker's user-namespace support is a daemon-wide `userns-remap` setting: enable
it and every container is remapped with one mapping, and `--userns=host` is the
per-container way to opt back out — required if you want `--privileged`. Podman
makes it a per-container choice with six modes, and rootless it is on by default
rather than something you configure.

---

← Prev: [`podman unshare`](06-podman-unshare.md) · Index: [Phase 11](README.md) · Next → [08 · `podman pod create`, `ps`, `rm`](08-pod-commands.md)
