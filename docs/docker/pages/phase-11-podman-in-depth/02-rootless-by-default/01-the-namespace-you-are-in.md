---
title: "The namespace you are always in"
sidebar_label: "01 · The namespace you are in"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html),
> [subuid(5)](https://man7.org/linux/man-pages/man5/subuid.5.html),
> [podman-unshare(1)](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html)
> and [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html).
> **No sandbox** — no console output on this page.

Rootless is not a hardening flag Podman happens to support. It is the default
path, and `podman(1)` states the mechanism plainly: "when Podman runs in rootless
mode, a user namespace is automatically created for the user, defined in
`/etc/subuid` and `/etc/subgid`."

🔴 **Every rootless surprise — the file owned by 165535, the port that will not
bind, the resource limit that is ignored — is one kernel sentence applied in a
different place.** This chunk is that sentence and the arithmetic that follows
from it. [The next one](02-what-it-costs.md) is the list of places it lands.

## The one kernel sentence

From `user_namespaces(7)`:

> "A process can have a normal unprivileged user ID outside a user namespace
> while at the same time having a user ID of 0 inside the namespace; in other
> words, **the process has full privileges for operations inside the user
> namespace, but is unprivileged for operations outside the namespace.**"

That is the whole deal. Inside the container you are root and can do root things
*to things the namespace owns*. Outside it — the host's ports, the host's
devices, the host's mounts, files whose UIDs are not in your map — you are
exactly the ordinary user you logged in as, and no flag inside the container
changes that.

What a user namespace covers is also documented, and it is wider than UIDs: it
"isolate[s] security-related identifiers and attributes, in particular, user IDs
and group IDs …, the root directory, keys …, and capabilities". So the
capability set the container sees
([Phase 0 · 09](../../phase-0-what-a-container-is/09-capabilities.md)) is a
capability set *within your namespace* — `CAP_NET_BIND_SERVICE` in there does not
let you take port 80 out here.

Unprivileged creation is what makes any of this possible without a daemon:
"since Linux 3.8, unprivileged processes can create user namespaces".

## The map is three numbers

The kernel expresses the mapping in `/proc/[pid]/uid_map` and `gid_map`, and
`user_namespaces(7)` defines the three fields exactly:

1. "The start of the range of user IDs **in** the user namespace of the process
   pid."
2. "The start of the range of user IDs **to which** the user IDs specified by
   field one map."
3. "The size of the range of user IDs that is mapped between the two user
   namespaces."

**Inside-start, outside-start, length.** Read every ownership question as a
lookup in that table and it stops being mysterious.

## Where the numbers come from: `/etc/subuid`

One line per user, "a user name and a range of subordinate user ids that user is
allowed to use", in "three fields delimited by colons" — login name, first
subordinate UID, and the count. Its purpose is stated outright:

> "This file specifies the user IDs that ordinary users can use, with the
> `newuidmap` command, to configure uid mapping in a user namespace."

`/etc/subgid` is the identical file for groups. These are an **administrative
delegation**: the machine's administrator has said *this user may hand out these
IDs*. They are normally written once by the tooling that created your account,
and a user with no line in them cannot map anything.

## The arithmetic, done once

`podman-unshare(1)` states the shape Podman builds:

> "The user namespace is configured so that the invoking user's UID and primary
> GID appear to be **UID 0 and GID 0**, respectively. Any ranges which match that
> user and group in `/etc/subuid` and `/etc/subgid` are **also mapped in as
> themselves** with the help of the `newuidmap(1)` and `newgidmap(1)` helpers."

So with your UID at `1000` and a subuid line of `you:100000:65536`, the map has
two rows:

| Inside | Outside | Length | Meaning |
|---|---|---|---|
| `0` | `1000` | `1` | Container root **is you** |
| `1` | `100000` | `65536` | Every other container UID lands in your subordinate range |

Which gives the formula worth memorising:

- **Container UID 0 → your own host UID.** Root in the container writes files
  owned by *you*. This is why rootless Podman feels friendlier than rootful
  Docker on a bind mount, where root in the container writes files owned by real
  root.
- **Container UID *n* (for *n* ≥ 1) → `subuid_start + n − 1`.** With the line
  above, container UID 1000 lands on host **100999**, and the top of the range,
  container UID 65536, lands on host **165535**.

🔴 **That single subtraction explains the enormous host UIDs.** A file owned by
`100999` is not corruption and not a bug — it is container UID 1000 seen from
outside, and it is owned by a subordinate ID that belongs to you.

⚠️ **Anything outside the map is not yours at all**, and the kernel says what
happens: "in most such cases, an unmapped user ID is converted to the overflow
user ID (group ID); the default value for the overflow user ID (group ID) is
**65534**". That is the `nobody`/`nogroup` you see on host files inside a
rootless container — a *rendering* of "not in your map", not an ownership change.

## Reading it on a real host

Three files answer nearly every question, and none of them require running a
container:

- **`/etc/subuid` and `/etc/subgid`** — what you were delegated. No line here is
  the root cause of a surprising number of "podman just fails" reports.
- **`/proc/self/uid_map`** — the map of whatever you are currently in. Run it
  inside `podman unshare` and you are looking at the container's map (that
  command is [Phase 11 · 06 · `podman unshare`](../06-podman-unshare.md)).
- **The host `ls -n` of a bind mount** — numbers, not names, because the names
  come from whichever `/etc/passwd` did the lookup
  ([Phase 6 · 05 · A UID is just a number](../../phase-6-storage/05-uid-mismatch/01-a-uid-is-just-a-number.md)).

**The fixes belong elsewhere on purpose.**
[Phase 6 · 05 · The fixes](../../phase-6-storage/05-uid-mismatch/03-the-fixes.md)
ranks `--user`, `--userns=keep-id`, `:U`, `podman unshare chown`, named volumes
and the entrypoint chown; this page is the model that tells you which one you
need.

## Docker's rootless mode is the same mechanism, not the same posture

Docker has a rootless mode and it uses the same kernel machinery. The difference
is where the default sits, and defaults decide what your colleagues actually run:

| | Docker | Podman |
|---|---|---|
| Default install | Root daemon; rootless is an opt-in setup | Rootless is the ordinary path |
| Who owns the container | The daemon | Your session ([topic 01](../01-daemonless/README.md)) |
| Root in the container writes files as | Real host root, rootful | Your own UID |
| Map source | `/etc/subuid` for the daemon's user | `/etc/subuid` for you |

🔴 **Rootless Podman and rootless Docker share the shortcomings**, because the
shortcomings come from the kernel rule at the top of this page rather than from
either engine. That list is [the next chunk](02-what-it-costs.md).

## Gotchas

**Symptom:** `podman` fails immediately with an error about the user namespace,
on a freshly created account.
**Cause:** No line in `/etc/subuid` and `/etc/subgid`, so there is nothing to
map.
**Fix:** Have an administrator allocate a range for the user. Nothing inside
Podman can substitute for a delegation that was never made.

**Symptom:** Files in a bind mount are owned by a host UID like `100999`.
**Cause:** Expected. That is container UID 1000 through the map — `subuid_start`
plus `n − 1`.
**Fix:** Nothing, unless the ownership matters to a host process. Then pick a
fix from [Phase 6 · 05](../../phase-6-storage/05-uid-mismatch/03-the-fixes.md) —
usually `--userns=keep-id` or `podman unshare chown`.

**Symptom:** Inside the container, host files show as owned by `nobody`.
**Cause:** Their UID is not in your map, and an unmapped ID renders as the
overflow ID, 65534.
**Fix:** Map what you need, or stop reading it as an ownership problem. It is the
kernel saying "not yours".

**Symptom:** A container process is UID 0 and still cannot write to a host path.
**Cause:** It is root *inside the namespace*. Outside it, the credentials are
yours and the host's permissions apply unchanged.
**Fix:** Give your own user access on the host, or move the data into a named
volume that the engine owns.

## Interview questions

**★ What does "rootless" actually mean at the kernel level?**
The container runs in a user namespace where your UID is mapped to 0. The kernel
rule is that such a process "has full privileges for operations inside the user
namespace, but is unprivileged for operations outside" — so it is root over the
namespace's own objects and an ordinary user for everything else on the host.

**★ Explain the host UID of a file a rootless container wrote as UID 1000.**
Podman maps container UID 0 to your own UID, and your `/etc/subuid` range to
container UID 1 upwards. So container UID *n* lands on `subuid_start + n − 1`,
and with a range starting at 100000 that is host 100999. It is a subordinate ID
delegated to you, not a stray account.

**★ What are `/etc/subuid` and `/etc/subgid` for, and who writes them?**
They delegate ranges of subordinate IDs to a user — three colon-separated fields:
name, first ID, count. The man page says they specify "the user IDs that ordinary
users can use, with the `newuidmap` command, to configure uid mapping in a user
namespace". An administrator writes them, usually at account creation; a user
with no line cannot start a rootless container.

**Why do host files appear owned by `nobody` inside a rootless container?**
Because their UID is not in the container's map, and an unmapped ID is converted
to the overflow user ID, 65534 by default. It is a rendering of "outside your
map", not a change of ownership.

**How do you read a `uid_map` line?**
Three numbers: the start of the range inside the namespace, the start of the
range it maps to outside, and the length. Podman's rootless setup has two lines —
`0 → your UID` for one ID, then `1 → subuid_start` for the delegated count.

**Is rootless Podman more secure than rootless Docker?**
Not by this mechanism — both use the same user namespaces and the same
`/etc/subuid` delegation, and both inherit the same shortcomings. The difference
is the default: Podman's ordinary path is rootless and daemonless, so there is no
root daemon and no root-equivalent socket unless you deliberately create one.

---

← Prev: [Overview](README.md) · Index: [Phase 11](../README.md) · Next → [What rootless costs](02-what-it-costs.md)
