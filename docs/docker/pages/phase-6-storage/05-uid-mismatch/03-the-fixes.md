---
title: "The fixes, and when to use each"
sidebar_label: "03 · The fixes"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [Podman — troubleshooting](https://github.com/containers/podman/blob/main/troubleshooting.md),
> [Podman — podman-run `--userns` and `--volume`](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [Podman — podman-unshare](https://docs.podman.io/en/latest/markdown/podman-unshare.1.html),
> [docker container run — user](https://docs.docker.com/reference/cli/docker/container/run/) and
> [Dockerfile reference — USER](https://docs.docker.com/reference/dockerfile/#user).
> **No sandbox** — no console output on this page.

**Seven fixes, and the choice is decided by two questions: which engine, and
whose files are they.** Trying them in random order is how a twenty-minute
problem becomes an afternoon, so this page is ordered by how often each is the
right answer.

## The decision, first

| Situation | Reach for |
|---|---|
| Rootless Podman, bind-mounted source you edit | **`--userns=keep-id`** |
| Rootless Podman, existing files with the wrong owner | **`podman unshare chown`** |
| Rootless Podman, a directory the container must own outright | **`:U`** on the mount |
| Rootful Docker, generated output in a bind mount | **`--user "$(id -u):$(id -g)"`** |
| Rootful Docker, an image whose user must exist properly | **a build-arg UID** |
| A database or anything the container owns end to end | **a named volume** — no host identity involved |
| An official image that must start as root and drop | **the entrypoint-`chown` pattern** |

## 1 · `--user` (Docker)

Run the process as your own numeric identity, so files land owned by you:

```bash
docker run --user "$(id -u):$(id -g)" -v "$(pwd)":/app node:22 npm test
```

```yaml
services:
  api:
    user: "${UID:-1000}:${GID:-1000}"     # export UID/GID in your shell or .env
```

It works, it is one flag, and it has a specific rough edge: **the UID you pass
may not exist in the image's `/etc/passwd`.** Then

- `whoami` fails with "cannot find name for user ID",
- `$HOME` may be unset or `/`, so tools that write to `~/.cache` or `~/.npm`
  fail in ways that read like network errors,
- and anything that calls `getpwuid()` — some Python, Git, SSH — may error
  outright.

Mitigations, in increasing order of effort: set `HOME` explicitly
(`-e HOME=/tmp`), pass `--group-add` for what you need, or build the user into
the image properly, which is fix 5.

## 2 · `--userns=keep-id` (Podman, rootless)

The flag that means what people think `--user` means: **keep your host UID and
GID inside the container**, so a bind mount round-trips cleanly with no shift.

```bash
podman run --userns=keep-id -v "$(pwd)":/app:z node:22 npm test
podman run --userns=keep-id:uid=1000,gid=1000 -v "$(pwd)":/app node:22
```

Podman's troubleshooting guide gives exactly this as the answer to files landing
in the subordinate range:

> `podman run --userns keep-id:uid=$uid,gid=$gid`

The `uid=`/`gid=` sub-options say *which* UID inside the container your host
identity should appear as, which matters when the image's software insists on
running as a particular user. Page 09 is the full treatment, including what it
costs — the mapping is more complex, and `keep-id` is rootless-only.

## 3 · `podman unshare chown` (Podman, for files that already exist)

Fixes are for future files; this repairs the ones already on disk. Enter the
user namespace, where you are UID 0 and your subordinate range is mapped, then
act normally:

```bash
podman unshare chown -R 0:0 ./data      # make it "root" inside == you outside
podman unshare ls -ln ./data
podman unshare less dir1/a
```

⚠️ **`sudo chown` is the wrong tool here** and will make things worse: it sets a
host-side number without regard to the mapping, so the container then sees
`nobody`. Do the arithmetic inside the namespace, not outside it.

`podman unshare` is also the right way to *read* container-written files from
the host — a backup script, a `grep`, a `du` — because it is the only context in
which those UIDs have meaning.

## 4 · The `:U` mount suffix (Podman)

Podman's `-v` option field accepts `U` (or `chown`), which

> *"Recursively change the owner and group of the source volume based on the UID
> and GID of the container"*

```bash
podman run -v ./data:/data:U,z myapp
```

One character, and the container can write. Two warnings, both real:

- **It is recursive and it mutates your host directory.** Pointing `:U` at a
  large or shared tree rewrites ownership across all of it, and there is no
  undo.
- **It is Podman-only.** The same command fails on Docker (page 03).

Right for a dedicated data directory the container owns. Wrong for your source
tree.

## 5 · Build the user in, with a build arg

The durable fix for a team whose UIDs differ, and the only one that leaves the
image self-consistent:

```dockerfile
ARG UID=1000
ARG GID=1000
RUN groupadd -g "$GID" app && useradd -u "$UID" -g "$GID" -m app
USER app
```

```bash
docker build --build-arg UID="$(id -u)" --build-arg GID="$(id -g)" -t myapp:dev .
```

The user exists in `/etc/passwd`, so `whoami`, `$HOME` and `getpwuid()` all
work — everything fix 1 breaks. The cost is that the image is now
developer-specific, so it belongs to a **dev** build target and never to the
image you push
([Phase 3, page 07](../../phase-3-dockerfile/07-env-vs-arg.md) on `ARG`).

## 6 · Use a named volume instead

The fix that removes the problem rather than solving it. A volume is
pre-populated with the image's ownership (topic 02), so the container can write
from the first second and no host identity is ever consulted.

```yaml
volumes:
  - pgdata:/var/lib/postgresql/data     # not ./pgdata
```

**Anything the container owns end to end — database files, caches, search
indexes, uploads — should be a volume, and then none of this page applies to
it.** Bind mounts are for files you edit; that is the whole of the rule.

## 7 · The entrypoint-`chown` pattern

What the official database images do, and the right answer when the container
must start as root to fix permissions and then must not stay root:

```bash
#!/bin/sh
set -e
chown -R postgres:postgres /var/lib/postgresql/data
exec gosu postgres "$@"        # or su-exec on Alpine; setpriv on modern util-linux
```

```dockerfile
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["postgres"]
```

Two details decide whether this is safe or a mess:

- **`exec`** replaces the shell so the real process becomes PID 1 and receives
  `SIGTERM` — the ten-second stop from
  [Phase 3, page 06](../../phase-3-dockerfile/06-exec-vs-shell-form.md), and
  Phase 10 revisits it.
- **`gosu`/`su-exec`/`setpriv`, not `sudo` or `su`.** Those fork, leaving an
  extra process between PID 1 and your application, and signal handling breaks
  again.

⚠️ **This requires the container to start as root**, which is exactly what a
hardened deployment forbids. It is a pattern for images that must be tolerant of
any mount, not a default.

## What does *not* work

- **`chmod 777`.** It papers over the symptom, is a genuine security problem in
  any shared context, and does nothing at all for the cases where the container
  cannot even traverse a parent directory.
- **`sudo chown` on rootless-written files** — see fix 3. Wrong side of the
  mapping.
- **`--privileged`.** It grants capabilities; it does not change UID mapping, so
  the ownership is identical and you have removed your isolation for nothing.
- **Assuming Docker Desktop's behaviour is the truth.** Its file sharing
  presents host files as yours regardless of UID, so the whole class of bug is
  invisible on a Mac and waiting on the Linux host.

## Gotchas

**Symptom:** `--user` fixed the ownership and broke the application, which now
reports a home-directory or user-lookup error.
**Cause:** The UID has no entry in the image's `/etc/passwd`, so `getpwuid()`
fails and `$HOME` is unset.
**Fix:** Set `HOME` explicitly for a quick unblock; build the user in with a
build-arg UID for a real one.

**Symptom:** `podman unshare chown` says the operation is not permitted.
**Cause:** The target UID or GID is outside your mapped subordinate range — you
can only assign ownership the namespace can represent.
**Fix:** Check `podman unshare cat /proc/self/uid_map` and choose an ID inside
the range. `0:0` inside the namespace is your own host identity and is almost
always what you want.

**Symptom:** `:U` fixed the container and broke your repository, with thousands
of files now owned differently.
**Cause:** `U` is recursive over the mount source.
**Fix:** Restore ownership with `podman unshare chown -R`, and point `:U` only
at directories the container owns outright.

**Symptom:** The entrypoint chowns a large data volume and start-up takes
minutes.
**Cause:** A recursive `chown` over every file, on every start.
**Fix:** Guard it — chown only when the ownership is actually wrong (check the
data directory's owner first), which is what the official images do.

## Interview questions

**★ A rootless container wrote files owned by 166535 into your project. What do
you do?**
Two separate actions. Fix the existing files with `podman unshare chown -R 0:0
<path>` — inside the namespace, `0:0` is your own host identity, and `sudo
chown` would be wrong because it ignores the mapping. Then stop it recurring
with `--userns=keep-id`, so your host UID is what the container runs as.

**★ Why is `--user "$(id -u):$(id -g)"` a good first move on Docker and a bad
one on rootless Podman?**
On rootful Docker it sets the real, unshifted UID the process writes with, so
files land owned by you. On rootless Podman the UID is still mapped through the
user namespace, so container 1000 becomes `subuid_start + 999` — a different
wrong number. There, `--userns=keep-id` is the flag that expresses the intent.

**★ What breaks when you pass a UID that has no user in the image?**
`getpwuid()` lookups fail, so `whoami` errors, `$HOME` may be unset or `/`, and
tools that write into the home directory — npm, pip, git, ssh — fail with
messages that do not mention permissions at all. Building the user into the
image with a build-arg UID avoids all of it.

**Why is `chmod 777` never the answer?**
It treats the symptom, opens the files to every process on the host, and does
not help with the common case where the container cannot traverse a parent
directory. The problem is an identity mismatch, and permissions are the wrong
axis to fix it on.

**When does none of this apply?**
When the data is in a named volume. The volume is pre-populated with the image's
ownership, so the container owns its files from the first second and no host
identity is involved. Bind mounts are for what you edit; volumes are for what
the container owns.

**Why `gosu` rather than `sudo` in an entrypoint?**
Because `gosu` (or `su-exec`, or `setpriv`) `exec`s into the target process,
keeping it as PID 1 so it receives `SIGTERM` directly. `sudo` and `su` fork,
leaving a supervisor between PID 1 and the application, and signals stop being
delivered to the process that needs them — the ten-second-stop problem again.

---

← Prev: [Rootless, and the UID shift](02-rootless-and-the-shift.md) · Index: [File ownership and UID mismatch](README.md) · Next → **Volume lifecycle** *(not written yet)*
