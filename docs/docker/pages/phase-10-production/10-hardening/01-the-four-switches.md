---
title: "The four switches"
sidebar_label: "01 · The four switches"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [Docker Engine security](https://docs.docker.com/engine/security/),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html) and
> [PR_SET_NO_NEW_PRIVS(2const)](https://man7.org/linux/man-pages/man2/PR_SET_NO_NEW_PRIVS.2const.html).
> **No sandbox** — no console output on this page.

**Run-time hardening is four independent switches, and the image cannot set any of
them.** [Phase 5 · Least privilege](../../phase-5-image-quality/03-least-privilege.md)
argued the image's half — build something that *can* run without root and without
writing to its own filesystem. This chunk is the other half: the flags that make it
so, on the command that actually starts the container.

The four are worth separating because they close different doors, and because
three of them are free on an image that was built for them:

| Switch | What it closes | What it costs |
|---|---|---|
| `--user` / a non-root `USER` | The process is not uid 0, so file writes and privileged operations fail at the source | Ownership must be right in the image |
| `--cap-drop=ALL` | Root's remaining special powers, if the process *is* root | Nothing, unless the app binds a port below 1024 |
| `--security-opt=no-new-privileges` | The escalation *path* — setuid binaries stop working | Nothing, unless you deliberately use `sudo`/setuid |
| `--read-only` | Persistence — a compromise cannot drop a binary or edit a config | Writable paths must be declared |

🔴 **They compose, and none of them substitutes for another.** Non-root without
`no-new-privileges` leaves a setuid binary as a route back to root. `--cap-drop=ALL`
on a container still running as uid 0 leaves every file in the image writable.

## The baseline stanza

```bash
docker run -d \
  --user 10001:10001 \
  --cap-drop=ALL \
  --security-opt=no-new-privileges=true \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -v appdata:/data \
  myapp:1.4.2
```

That is the shape to copy. Everything below is why each line is there, and what to
do when one of them breaks the service.

## `--cap-drop=ALL`

> `--cap-drop` — "Drop Linux capabilities"

Docker does not hand a container full root to begin with: **"By default Docker
drops all capabilities except those needed, an allowlist instead of a denylist
approach."** The remaining set is still wider than an application server needs,
and the documentation's own recommendation is to go further — **"remove all
capabilities except those explicitly required for their processes."**

[Phase 0 · Capabilities](../../phase-0-what-a-container-is/09-capabilities.md) has
the default set and what each entry permits. In production the decision is nearly
always the same one:

```bash
docker run --cap-drop=ALL myapp:1.4.2                             # the default answer
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myapp:1.4.2  # only if it must bind :80
```

**And the second form is usually avoidable.** Listen on 8080 inside the container
and publish it as 80 outside — the capability disappears and nothing about the
deployment changes. `--cap-add` is the flag that should require an explanation in
review; Podman's manual says as much, warning that added capabilities increase
privilege and the risk of escaping confinement, and naming `CAP_SYS_ADMIN` and
`CAP_SYS_PTRACE` as the dangerous ones.

⚠️ **Dropping capabilities does not make the process non-root.** uid 0 with no
capabilities still owns every file in the image and can still overwrite the
application it is running. That is what `--user` and `--read-only` are for.

## `no-new-privileges` — the switch nobody sets

> `no-new-privileges=true` — "Disable container processes from gaining new
> privileges"

The flag sets the kernel's `no_new_privs` attribute, and the man page is the
clearest statement of what that means: with it set, **`execve(2)` "promises not to
grant privileges to do anything that could not have been done without the
`execve(2)` call"**. Concretely it renders **"the set-user-ID and set-group-ID mode
bits, and file capabilities non-functional"**.

So the scenario it defends against is precise. Your container runs as uid 10001.
An attacker gets code execution — a deserialisation bug, a template injection,
anything — and looks for a setuid-root binary left in the image by the base
distribution. Running one is the standard way from *some user* to *root inside the
container*, and from there capabilities and kernel surface are in play.
`no-new-privileges` removes that step: the setuid bit stops elevating.

Two properties make it safe to set by default:

- **"Once set, the `no_new_privs` attribute cannot be unset."** There is no window
  in which a compromised process turns it off.
- **The setting "is inherited by children created by `fork(2)` and `clone(2)`, and
  preserved across `execve(2)`."** Everything the container spawns inherits it —
  no per-process bookkeeping.

🔴 **The only thing it breaks is deliberate escalation** — a container that runs
`sudo`, `su`, or a setuid helper as part of its normal operation. In an
application image that is a design smell already, which is why this is the
cheapest of the four switches and the most often forgotten.

## Non-root at run time

> `--user` — "Username or UID (format: `<name|uid>[:<group|gid>]`)"

`USER` in the Dockerfile ([phase 3 · USER](../../phase-3-dockerfile/09-user.md)) is
a **default**, and `docker run --user 0` overrides it. The run-time flag is what a
platform can *enforce* — a Compose template, a Quadlet unit or an admission policy
everyone inherits, rather than a line a future Dockerfile edit can drop.

Prefer a **numeric** uid and gid in the flag. A name has to exist in the image's
`/etc/passwd` to resolve, which distroless and scratch images do not have; a number
always works. The trade is that a uid with no matching passwd entry has no *name*,
so code that looks one up may report an error or an empty user — cosmetic in most
services, and worth knowing before it appears in a log.

Two things the flag cannot fix, both of which live in the image:

- **Ownership.** Files copied in before a `USER` switch belong to uid 0, so the
  application cannot write them. `COPY --chown` at build time is the fix, not a
  run-time `chown`, which a read-only filesystem will refuse anyway.
- **Where the application writes.** An app that writes into its own directory
  cannot be run as a foreign uid at all. Writes belong in a volume or a `tmpfs`,
  which is the same conclusion `--read-only` forces.

Where several containers share one volume as different users, the documented tool
is `--group-add` / Compose's `group_add`: *"multiple containers (running as
different users) need to all read or write the same file on a shared volume. That
file can be owned by a group shared by all the containers."*

## `--read-only`

> `--read-only` — "Mount the container's root filesystem as read only prohibiting
> writes to locations other than the specified volumes for the container."

The storage side of this — what breaks first, how to find the writes in advance,
sizing the `tmpfs` — is [phase 6 · A read-only root
filesystem](../../phase-6-storage/08-read-only-rootfs.md), and it is the one switch
of the four that needs a rehearsal rather than a decision. Two points belong here
because they are about the security posture rather than the storage:

- **It is what turns a compromise from persistent into transient.** Without a
  writable filesystem, a payload cannot be dropped, a cron entry cannot be added,
  and a config cannot be edited to survive the next restart. What remains is a
  process an attacker has to hold on to; a restart takes it away.
- **Give the writable paths the same treatment as everything else.** A `tmpfs`
  mounted `noexec,nosuid` cannot be used to stage and run a binary:
  `--tmpfs /tmp:rw,noexec,nosuid,size=64m`. Docker takes options "identical to the
  Linux `mount -t tmpfs -o` command"; Podman applies `rw,noexec,nosuid,nodev` by
  default when none are given, so **the same command is stricter under Podman
  unless you spell the options out**.

An unsized `tmpfs` is its own hazard — it is host memory, and the default is a
share of it. Size every one.

## Gotchas

**Symptom:** The container runs as a non-root user, and an attacker still reached
root inside it.
**Cause:** A setuid binary from the base image, which elevates regardless of the
starting uid.
**Fix:** `--security-opt=no-new-privileges=true`, which makes set-user-ID bits and
file capabilities non-functional for everything in the container.

**Symptom:** `--cap-drop=ALL` and the service fails to start with a permission
error binding its port.
**Cause:** A port below 1024 needs `CAP_NET_BIND_SERVICE`.
**Fix:** Listen on 8080 inside and publish `80:8080` — the capability is not
needed at all. Add `--cap-add=NET_BIND_SERVICE` only if the port is fixed by
something outside your control.

**Symptom:** Adding `--user` makes a previously working image fail with `EACCES`
during startup.
**Cause:** The application writes into directories the image left owned by uid 0 —
a cache, a pid file, a build artefact next to the code.
**Fix:** `COPY --chown` for what it must own, and move genuine writes to a volume
or a `tmpfs`. Do not solve it by dropping back to root.

**Symptom:** After `--cap-drop=ALL`, a health check that uses `ping` reports the
container as unreachable.
**Cause:** Raw sockets need `CAP_NET_RAW`, which `ALL` removed. The network is
fine; the probe is not.
**Fix:** Check the thing that matters — a TCP connect or an HTTP request to the
application's own port — rather than ICMP.

## Interview questions

**★ What does `no-new-privileges` actually prevent, and why is it cheap?**
It sets the kernel's `no_new_privs` attribute, so `execve` cannot grant privileges
the caller did not already have — set-user-ID and set-group-ID bits and file
capabilities stop working. It closes the standard route from "code execution as an
unprivileged user" to "root inside the container". It is cheap because it cannot be
unset once set and is inherited across `fork` and `execve`, and the only thing it
breaks is deliberate escalation such as `sudo`, which an application image should
not be doing.

**★ Running as a non-root user and dropping all capabilities overlap. Why do both?**
They act on different things. `--user` changes who the process is, so file
permissions and ownership apply to it. `--cap-drop=ALL` removes root's special
powers, which matters when the process *is* uid 0 — and a container running as root
with no capabilities still owns and can overwrite every file in the image. Neither
one implies the other.

**★ Which of these four can the image enforce on its own?**
None. `USER` is a default that `--user` overrides; `--read-only`, `--cap-drop` and
`--security-opt` are run-time flags an image cannot require. The image's job is to
make them *possible* — correct ownership, no writes to its own filesystem, no port
below 1024. Making them mandatory is the platform's job.

**Why prefer a numeric uid over a username in `--user`?**
Because a name must resolve in the image's `/etc/passwd`, and distroless and
scratch images have none — the container fails to start. A number always works. The
cost is that a uid with no passwd entry has no name, so anything that looks one up
reports an error or an empty user.

**Your service needs to bind port 80. What is the right answer?**
Usually not `--cap-add=NET_BIND_SERVICE`. Listen on 8080 inside the container and
publish it as `80:8080`; the published port is a host-side concern and the
capability is not needed at all. Add the capability only when something outside
your control fixes the in-container port.

**What does `--read-only` buy that a non-root user does not?**
It removes persistence. A non-root attacker can still write anywhere the uid has
permission — `/tmp`, a world-writable directory, sometimes the application's own
tree — and leave something behind that survives a restart. With a read-only root
filesystem and `noexec` temp mounts, there is nowhere to drop a payload and nothing
to survive.

---

[Topic index](README.md) · [02 · Enforcing it everywhere](02-enforcing-it.md) →
