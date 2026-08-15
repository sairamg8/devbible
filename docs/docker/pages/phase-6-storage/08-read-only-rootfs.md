---
title: "--read-only root filesystem, plus tmpfs"
sidebar_label: "08 · --read-only and tmpfs"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker container run](https://docs.docker.com/reference/cli/docker/container/run/),
> [Docker — tmpfs mounts](https://docs.docker.com/engine/storage/tmpfs/),
> [Compose file reference — services](https://docs.docker.com/reference/compose-file/services/) and
> [Podman — podman-run `--read-only` / `--read-only-tmpfs`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**`--read-only` mounts the container's root filesystem read-only, so the only
writable paths are the ones you deliberately provided.** It is the cheapest
hardening flag there is, it makes the container's data story explicit, and it
will break your application the first time you try it — in an informative way.

## What it does, and what it does not touch

```bash
docker run --read-only myapp
podman run --read-only myapp
```

Read-only applies to the **container's own filesystem** — the image layers plus
the writable layer from topic 01. Mounts are unaffected:

| Path | Under `--read-only` |
|---|---|
| Anything from the image | **read-only** |
| The writable layer | **effectively gone** — nothing new can be created |
| A named volume | writable, as declared |
| A bind mount | writable unless you added `readonly` |
| A `tmpfs` mount | writable, in RAM |

That is the whole design: **writes must go somewhere you named.** An attacker
who lands remote code execution cannot drop a binary in `/usr/local/bin`, and
you cannot accidentally accumulate 12 GB in a writable layer nobody backs up.

## What breaks first

Almost every image expects to write *somewhere*. In rough order of how often
they turn up:

| Path | Who wants it |
|---|---|
| `/tmp` | practically everything — language runtimes, image processing, uploads |
| `/run` or `/var/run` | PID files and sockets — nginx writes `/var/run/nginx.pid` |
| `/var/cache/nginx` | nginx's proxy and fastcgi caches |
| `/var/log` | anything not logging to stdout ([Phase 1, page 03](../phase-1-running-containers/03-ps-inspect-logs-stats.md)) |
| `~/.npm`, `~/.cache` | npm, pip, and most build tooling |
| `/var/lib/<app>` | any embedded state — SQLite, search indexes, sessions |
| `/etc/<app>/…` | entrypoints that template a config file at start-up |

**Find them before you argue with them.** Run the container normally for a while
and ask what it wrote:

```bash
docker diff mycontainer
```

Every `A` and `C` line outside your mounts is a path that needs one. That is
topic 01's diagnostic turned into a migration plan, and it takes a minute.

## Giving the writes somewhere to go

```bash
docker run --read-only \
  --mount type=tmpfs,dst=/tmp,tmpfs-size=64m \
  --mount type=tmpfs,dst=/var/run,tmpfs-size=1m \
  --mount type=volume,src=appdata,dst=/var/lib/myapp \
  myapp
```

```yaml
services:
  api:
    image: myapp:1.4
    read_only: true
    tmpfs:
      - /tmp
      - /run
    volumes:
      - appdata:/var/lib/myapp

volumes:
  appdata:
```

The choice per path is the same question as always: **scratch that may vanish →
`tmpfs`; state that must survive → a volume.** Do not reach for a bind mount
here; a read-only container writing into your host tree is the combination
neither flag was for.

⚠️ **Size the `tmpfs`.** Unset means up to 50% of host RAM (topic 02), and
`/tmp` under `--read-only` is exactly the path a large upload will fill. An
explicit `tmpfs-size` turns a host OOM into an application error.

## The Podman difference, and it is a real one

Podman ties a default to the flag that Docker does not. `--read-only-tmpfs`
**defaults to `true`**, and with `--read-only` set it mounts a `tmpfs` on
**`/dev`, `/dev/shm`, `/run`, `/tmp` and `/var/tmp`** automatically.

So `podman run --read-only myapp` often *just works* where
`docker run --read-only myapp` fails immediately on `/tmp`. Turning the default
off:

> with `--read-only-tmpfs=false`, `/dev` and `/dev/shm` become read-only, no
> temporary filesystems are mounted on `/tmp`, `/run` or `/var/tmp`, and *"the
> directories are exposed from the underlying image, meaning they are read-only
> by default"*

🔴 **This is a portability trap in both directions.** A container hardened and
tested under Podman can fail under Docker because the automatic `tmpfs` mounts
are not there; a container tuned under Docker gets extra writable memory-backed
paths under Podman that it was not audited for. **Declare the `tmpfs` mounts
explicitly** — then the behaviour is identical on both engines and legible in
the Compose file, which is the point.

## What this does not buy you

Be precise about the security claim, because it is often overstated.

- **It does not stop writes to your mounts.** A volume is writable by design; a
  compromised process writes to it exactly as the application would.
- **It does not stop `exec`ing whatever is already in the image.** A shell, a
  package manager and `curl` in the image are still there, still runnable.
- **It does not restrict syscalls or capabilities.** That is seccomp, AppArmor,
  SELinux and capability dropping
  ([Phase 0, pages 09 and 10](../phase-0-what-a-container-is/09-capabilities.md)).
- **It does not survive a `VOLUME` in the image.** A declared `VOLUME` mounts a
  writable anonymous volume at that path regardless
  ([Phase 3, page 13](../phase-3-dockerfile/13-volume.md)) — the hardening is
  quietly partial, and `docker image inspect --format '{{json .Config.Volumes}}'`
  is how you find out.

What it *does* buy is real and worth having: no persistence for a dropped
payload, no tampering with binaries or configuration in the image, and an
explicit, reviewable list of every path the container may write.

## Rolling it out without a bad afternoon

1. `docker diff` a normally running container to enumerate the writes.
2. Classify each path: scratch → `tmpfs`, state → volume, "why is it writing
   there at all" → fix the application or the entrypoint.
3. Turn on `read_only: true` in a non-production environment and watch it fail
   once or twice more; entrypoints that template config files are the usual
   late surprise.
4. Keep the `tmpfs` sizes explicit, and add the flag to the deployment only when
   a full start-up and a full request cycle have passed.

An entrypoint that renders a config file into `/etc` is the most common blocker,
and the fix is usually to render it into a `tmpfs` path instead and point the
application at that.

## Gotchas

**Symptom:** The container exits immediately under `--read-only` with an error
about `/tmp` or a PID file.
**Cause:** The root filesystem is read-only and no writable path was provided.
**Fix:** Add `tmpfs` mounts for `/tmp` and `/run`, sized explicitly. `docker
diff` on a normal run lists the rest.

**Symptom:** It works under Podman and fails under Docker with the same flags.
**Cause:** Podman's `--read-only-tmpfs` defaults to true and mounts `/dev`,
`/dev/shm`, `/run`, `/tmp` and `/var/tmp` automatically; Docker mounts nothing.
**Fix:** Declare the `tmpfs` mounts explicitly, so both engines behave the same
and the Compose file says what is writable.

**Symptom:** `--read-only` is set and the container still wrote to disk.
**Cause:** Either a mount (working as intended) or an inherited `VOLUME` in the
image, which mounts a writable anonymous volume regardless.
**Fix:** `docker image inspect --format '{{json .Config.Volumes}}'`. Mount
something deliberate at that path — a `tmpfs`, or a volume you actually want.

**Symptom:** The host ran out of memory under load, and the container is
read-only.
**Cause:** An unsized `tmpfs` on `/tmp`, which defaults to half of host RAM, and
a workload writing uploads into it.
**Fix:** `tmpfs-size` on every `tmpfs`, sized for peak concurrency.

## Interview questions

**★ What does `--read-only` actually make read-only?**
The container's own filesystem — the image layers and the writable layer — so
nothing new can be created outside a mount. Volumes, bind mounts and `tmpfs`
mounts stay writable as declared. The effect is that every writable path becomes
something you named on purpose.

**★ What breaks first, and how do you find out in advance?**
`/tmp`, then PID files and sockets under `/run` or `/var/run`, then caches like
`/var/cache/nginx` and `~/.npm`. You find them with `docker diff` on a normally
running container: every added or changed path outside your mounts is one that
needs a `tmpfs` or a volume before the flag goes on.

**★ Why can a read-only container behave differently on Docker and Podman?**
Because Podman's `--read-only-tmpfs` defaults to true and, with `--read-only`,
mounts `tmpfs` on `/dev`, `/dev/shm`, `/run`, `/tmp` and `/var/tmp` automatically.
Docker does not. Declaring the `tmpfs` mounts explicitly makes both engines
behave identically and puts the writable paths in the file where they can be
reviewed.

**How much security does it actually buy?**
It prevents persistence and tampering: a dropped payload has nowhere to live and
the image's binaries and configuration cannot be modified. It does not restrict
writes to your volumes, does not remove tools already in the image, and does not
constrain syscalls or capabilities — those need seccomp, SELinux/AppArmor and
capability dropping.

**Can an image defeat `--read-only`?**
Yes, quietly. A `VOLUME` declaration in the image mounts a writable anonymous
volume at that path in every container, so the hardening is partial and nothing
warns you. `docker image inspect --format '{{json .Config.Volumes}}'` shows the
declarations; mount something deliberate at each one.

---

← Prev: [SELinux `:z` and `:Z`](07-selinux-z-and-Z.md) · Index: [Phase 6](README.md) · Next → **`--userns=keep-id`** *(not written yet)*
