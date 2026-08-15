---
title: "--userns=keep-id"
sidebar_label: "09 · --userns=keep-id"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Podman — podman-run `--userns`](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [Podman — podman-unshare](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html),
> [Podman — troubleshooting](https://github.com/containers/podman/blob/main/troubleshooting.md) and
> [Docker — rootless mode](https://docs.docker.com/engine/security/rootless/).
> **No sandbox** — no console output on this page.

**`--userns=keep-id` makes the container's user *be* your host user, so files
written through a bind mount come out owned by you.** It is the flag people
reach for `--user` expecting, and under rootless Podman it is the correct answer
to almost every development ownership problem.

## The problem, in one line

Under rootless Podman, container UID 0 maps to your host UID and container UID
`n ≥ 1` maps to `subuid_start + (n − 1)` (topic 05). So a container running as
its image's non-root user writes files owned on the host by a number nobody
recognises, and `--user 1000:1000` does not help — it sets the UID *inside* the
namespace, which is then mapped anyway.

## What `keep-id` does

```bash
podman run --userns=keep-id -v "$(pwd)":/app:z node:22 npm test
```

From the `--userns` documentation, for `keep-id`:

> *"The user is mapped to a non-root UID and GID on the host. The rest of the
> UIDs and GIDs range from 0 to the maximum UID and GID values used by the
> kernel (typically 65536)."*

Read practically: **your host UID appears inside the container as the same
number**, and the remaining IDs are filled in from your subordinate range around
it. Files you own on the host are owned by you inside; files the container
creates are owned by you outside. The bind mount round-trips.

> *"only supported in rootless mode"*

That sentence matters as much as the rest. `keep-id` is meaningless rootful —
there is no user namespace to keep an identity across — so a command carrying it
is a rootless-Podman command, not a portable one.

## Choosing the UID inside

The bare flag puts you at your own UID inside the container. That is not always
what the software wants: an image whose application is configured to run as
`node` (1000) or `postgres` (999) may look for that user's home directory,
config files or ownership.

```bash
podman run --userns=keep-id:uid=1000,gid=1000 -v "$(pwd)":/app:z node:22
```

Podman's troubleshooting guide gives exactly this form as the answer to
subordinate-range ownership:

> `podman run --userns keep-id:uid=$uid,gid=$gid`

Now **your host identity appears inside the container as UID 1000**, which is
the UID the image expects. Files still come out owned by you on the host,
because the mapping is what changed, not your identity.

⚠️ **The UID you pick must exist in the image** if the software resolves it by
name. Otherwise you are back to topic 05's `getpwuid()` failures — `whoami`
errors, an unset `$HOME`, and tools failing for reasons that mention neither.

## Where `keep-id` sits among the `--userns` modes

| Mode | What it does | Rootless only |
|---|---|---|
| *(default, rootless)* | container 0 → your UID; 1+ → your subuid range | — |
| **`keep-id`** | *"The user is mapped to a non-root UID and GID on the host"*, with `uid=`/`gid=` to choose the inside value | ✅ |
| **`nomap`** | the running user is not mapped into the container at all | ✅ |
| **`auto`** | a fresh, automatically allocated namespace; `size`, `uidmapping`, `gidmapping` tune it | — |
| **`host`** (or `""`) | *"Use the host's user namespace inside the container"* — no isolation of IDs | — |
| **`container:id`** | reuse another container's user namespace | — |
| **`ns:namespace`** | join the user namespace at a given path | — |

Two of those are worth a second look:

- **`nomap`** is the security-minded opposite of `keep-id`: your UID is
  deliberately *not* present inside the container, so a process there cannot
  act as you even if it escapes the mapping. Use it when the container has no
  business touching your files.
- **`host`** removes the ID isolation entirely. It is occasionally necessary
  and should be treated the way `--privileged` is — a documented exception, not
  a fix for a permissions error.

## The costs, honestly

`keep-id` is not free, and knowing why keeps you from being surprised.

**1. It builds a more complex mapping.** Instead of two ranges, the namespace
gets your UID pinned in place with the subordinate range split around it.
Container start-up does measurably more work, which is noticeable when you start
many short-lived containers.

**2. It can collide with the image's own user.** If the image expects to run as
UID 1000 and your host UID *is* 1000, plain `keep-id` is perfect. If your host
UID is 1001 and the image hard-codes 1000, you need the `uid=` sub-option, and
if the image's software resolves the name rather than the number you may need to
build the user in instead (topic 05, fix 5).

**3. It is Podman-only and rootless-only.** A Compose file or script carrying it
does not run under Docker. Where a command has to work on both, the portable
pair is `--user "$(id -u):$(id -g)"` on Docker and `--userns=keep-id` on Podman,
selected by whatever runs them.

**4. It does not change existing files.** Ownership already wrong stays wrong —
that is `podman unshare chown`'s job.

## Compose, and Docker's nearest equivalent

There is no Compose key for `keep-id`. Podman users reach for
`userns_mode: "keep-id"`, which `podman-compose` supports and the Compose
Specification does not — so a file using it is tied to that provider (topic 04,
chunk 03). The portable alternatives are the ones from topic 05: `user:` in the
service, a build-arg UID, or keeping the data in a named volume where none of
this applies.

Docker's rootless mode has no `keep-id`. Its answers are:

- **`--user "$(id -u):$(id -g)"`** on a rootful daemon, where the UID is not
  remapped at all and this simply works;
- **`userns-remap`** on the daemon, which produces the same shift as rootless
  Podman and the same need for care;
- and, for Docker Desktop users, the file-sharing layer that presents host files
  as yours anyway — which is why Mac developers never meet this flag and their
  Linux colleagues need it weekly.

## Gotchas

**Symptom:** `--userns=keep-id` fails with an error about rootless mode.
**Cause:** It was run rootful — `sudo podman`, or a root shell. The flag is
*"only supported in rootless mode"*.
**Fix:** Run it as your own user. Rootful containers already write as real host
UIDs; the flag has nothing to do there.

**Symptom:** `keep-id` fixed ownership and the application now complains it
cannot find its user or home directory.
**Cause:** Your host UID has no entry in the image's `/etc/passwd`.
**Fix:** `--userns=keep-id:uid=<the image's UID>,gid=<its GID>`, or build a user
with your UID into a development image.

**Symptom:** Files written *before* adding the flag are still owned by a
subordinate UID.
**Cause:** `keep-id` changes future writes only.
**Fix:** `podman unshare chown -R 0:0 <path>` — inside the namespace, `0:0` is
your host identity.

**Symptom:** Container start-up got noticeably slower after adding it across a
project.
**Cause:** The more complex mapping costs real work per container start.
**Fix:** Apply it to the services with bind-mounted source, not to every service
in the file. A database on a named volume does not need it.

## Interview questions

**★ What does `--userns=keep-id` do, and why is it not just `--user`?**
It maps your host UID and GID into the container as themselves, so bind-mounted
files round-trip with your ownership. `--user` sets the UID *inside* the
namespace, which rootless Podman then maps into your subordinate range — so
`--user 1000:1000` produces `subuid_start + 999` on the host, not host UID 1000.
`keep-id` changes the mapping; `--user` changes only the process.

**★ When is it not available?**
Rootful. The documentation states it is *"only supported in rootless mode"*,
because rootful containers already run as real host UIDs and there is no
namespace to preserve an identity across. It is also Podman-only — Docker has no
equivalent flag.

**★ What does the `uid=`/`gid=` sub-option add?**
It chooses which UID your host identity appears as *inside* the container, for
images whose software expects a particular user — `node` at 1000, `postgres` at
999. Ownership on the host is still yours; only the in-container number changes.
Podman's troubleshooting guide gives
`podman run --userns keep-id:uid=$uid,gid=$gid` as the standard fix.

**What is `nomap`, and when would you want it?**
The opposite intent: the running user is deliberately not mapped into the
container, so a process inside cannot act as you at all. It suits containers
with no legitimate interest in your files, where `keep-id` would hand them an
identity they do not need.

**What are the costs of using it everywhere?**
A more complex user-namespace mapping, so slower container start-up; possible
mismatch with the image's expected UID, needing the `uid=` sub-option; and
non-portability, since it exists only under rootless Podman. Apply it to
services with bind-mounted source, not to a database sitting on a named volume.

---

← Prev: [`--read-only` and `tmpfs`](08-read-only-rootfs.md) · Index: [Phase 6](README.md) · Next → **Backing up and restoring a volume** *(not written yet)*
