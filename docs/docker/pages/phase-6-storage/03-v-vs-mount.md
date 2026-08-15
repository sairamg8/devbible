---
title: "-v short syntax vs --mount"
sidebar_label: "03 · -v vs --mount"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
> [Docker — volumes](https://docs.docker.com/engine/storage/volumes/),
> [docker container run](https://docs.docker.com/reference/cli/docker/container/run/) and
> [Podman — podman-run](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**`-v` and `--mount` do the same job, and one of them fails loudly when you are
wrong.** The short form guesses what you meant from the shape of a string; the
long form makes you say it. That is the entire difference, and it is worth a
page because the guess is silent.

## The two forms

```bash
# short — three colon-separated fields
docker run -v pgdata:/var/lib/postgresql/data postgres:17
docker run -v "$(pwd)":/app:ro node:22

# long — comma-separated key=value pairs
docker run --mount type=volume,src=pgdata,dst=/var/lib/postgresql/data postgres:17
docker run --mount type=bind,src="$(pwd)",dst=/app,readonly node:22
```

`-v` has three fields: **source**, **destination**, **options**. `--mount` names
everything, and the first thing it makes you name is the one thing `-v` infers.

## How `-v` decides what you meant

There is one rule, and everything on this page follows from it:

> **If the source field contains a `/`, it is a bind mount. Otherwise it is a
> named volume.**

So:

| You wrote | `-v` does |
|---|---|
| `-v pgdata:/data` | named volume `pgdata` |
| `-v /home/me/data:/data` | bind mount from that host path |
| `-v ./data:/data` | bind mount (Compose resolves it; `docker run` historically rejected it) |
| `-v /data` | **anonymous** volume at `/data` |
| `-v pgdta:/data` — a typo | a **new, empty, silently created** volume called `pgdta` |

That last row is the failure this page exists for. Nothing is wrong from the
engine's point of view: volumes are created on demand, so a mistyped name is a
perfectly valid request for a volume that happens not to exist yet. Your service
comes up against an empty database, the old volume is still sitting there under
the right name, and there is no error anywhere to lead you to it.

## The other half of the trap: `-v` creates host directories

For bind mounts, Docker's documentation is explicit about what happens when the
source path does not exist:

> *"With `-v`: Docker automatically creates the directory on the host for you.
> It's always created as a directory."*

> *"With `--mount`: It produces an error if the source path doesn't exist"* —
> unless you pass `bind-create-src`.

Two ways that hurts, both common:

**A typo in a host path.** `-v /home/me/projcts:/app` does not fail — it creates
`/home/me/projcts`, mounts the empty directory, and your container starts with
no source code. You then spend twenty minutes reading Dockerfiles.

**A file that should have been a file.** *"It's always created as a directory."*
Mount a config file whose path is slightly wrong —
`-v ./nginx.con:/etc/nginx/nginx.conf` — and you get a **directory** at
`/etc/nginx/nginx.conf` inside the container. The error you then get is from
nginx, complaining about something that reads like a parse problem, and it is
nowhere near the actual mistake.

⚠️ **Podman's `podman run` documentation does not state the create-on-missing
behaviour for `-v` either way**, so do not rely on knowing it. That uncertainty
is itself an argument for `--mount`: with the long form, the answer is the same
on both engines because the missing path is an error.

## What `--mount` buys

**1. It fails on the thing you got wrong.** A missing bind source is an error, a
missing `type=` is an error, and an unknown key is an error rather than a
silently ignored string.

**2. It says the type out loud.** `type=volume` and `type=bind` cannot be
confused by a reader six months later, and `type=tmpfs` has no `-v` equivalent
at all — the short form for that is the separate `--tmpfs` flag.

**3. It reaches options the short form does not have.** `volume-nocopy`,
`volume-subpath`, `volume-driver`, `volume-opt`, `tmpfs-size`, `tmpfs-mode` and
`bind-create-src` are `--mount`-only on Docker.

**4. It is the same shape as the Compose long syntax**, so moving a `run`
command into a Compose file is mechanical rather than a translation.

```bash
docker run \
  --mount type=volume,src=pgdata,dst=/var/lib/postgresql/data \
  --mount type=bind,src="$(pwd)/init.sql",dst=/docker-entrypoint-initdb.d/init.sql,readonly \
  --mount type=tmpfs,dst=/tmp,tmpfs-size=64m \
  postgres:17
```

## When `-v` is still the right call

This is not a rule against `-v`. It is a rule about where the risk is.

- **Typing an interactive one-off**, where you will see immediately if it is
  wrong: `-v` is shorter and fine.
- **Named volume, no options**: `-v pgdata:/data` has almost no room to go
  wrong — the only failure is a typo in the name, and that one is real.
- **In Compose**, the short syntax is idiomatic and relative paths work
  properly. Use the long syntax there when you need an option the short form
  cannot express, and for anything a reader might misread.

**Anything scripted, committed or in CI should use `--mount`** — that is where a
silent empty directory survives long enough to be believed.

## The option field, and where the engines differ

`-v`'s third field is a comma-separated list of suffixes. Docker's set is small;
**Podman's is much larger**, and several of its entries solve problems that come
up later in this phase:

| Suffix | Engine | What it does |
|---|---|---|
| `ro` / `rw` | both | read-only or read-write |
| `z` / `Z` | Podman (and Docker on SELinux hosts) | relabel the source shared / private — page 07 |
| `U` or `chown` | **Podman only** | *"Recursively change the owner and group of the source volume based on the UID and GID of the container"* — page 05 |
| `idmap` | **Podman only** | create an idmapped mount into the container's user namespace — page 09 |
| `O` | **Podman only** | mount the directory through an overlay, so container writes do not touch the host copy |
| `copy` / `nocopy` | Podman | the pre-population behaviour, explicitly on or off |
| `exec` / `noexec`, `nosuid`, `nodev`, `dev`, `suid` | Podman | standard mount flags |

Podman's `--mount` also accepts more types than Docker's — *"artifact, bind,
devpts, glob, image, ramfs, tmpfs and volume"* — and states the source rule
crisply: *"Mandatory for artifact, bind, glob, and image. Optional for volume;
if omitted, an anonymous volume is created."*

⚠️ **The Podman-only suffixes are not portable.** `-v ./data:/data:U` is exactly
the right answer to a rootless ownership problem and will fail on Docker. If a
command has to run on both, keep the suffixes to `ro`/`rw`/`z`/`Z`.

## Compose: short and long

```yaml
services:
  db:
    volumes:
      - pgdata:/var/lib/postgresql/data          # short — a named volume
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro   # short — a bind mount
      - type: volume                             # long — the --mount shape
        source: pgdata
        target: /var/lib/postgresql/data
        volume:
          nocopy: true
```

Compose applies the same inference: a first field with `/` or `.` is a bind
mount, anything else is a named volume. It is one character between
`- pgdata:/data` and `- ./pgdata:/data`, and they are entirely different things —
an engine-managed volume, or a directory in your repository that git will
happily start tracking.

## Gotchas

**Symptom:** A service starts against an empty database after a rename or a typo
in the volume name.
**Cause:** Volumes are created on demand, so `-v pgdta:/data` is a valid request
for a new empty volume rather than an error.
**Fix:** `docker volume ls` to find the original name and re-point at it. In
scripted commands use `--mount type=volume,src=…`, which does not make missing
volumes any less silent but does make the intent readable in review.

**Symptom:** The container starts with an empty `/app` and none of your source.
**Cause:** A typo in the host path. `-v` created the missing directory and
mounted the empty result.
**Fix:** `--mount type=bind,...`, which errors on a missing source. Use
`bind-create-src` only where creating it is genuinely intended.

**Symptom:** An application complains that its config file is invalid, and the
path inside the container is a **directory**.
**Cause:** A bind mount of a non-existent host file. `-v` always creates the
missing source as a directory.
**Fix:** Check the host path exists as a file, and switch that mount to
`--mount type=bind`.

**Symptom:** `-v ./data:/data:U` works locally under Podman and fails in CI
under Docker.
**Cause:** `U`, `idmap`, `O` and the rest are Podman extensions to the option
field.
**Fix:** Keep cross-engine commands to `ro`, `rw`, `z` and `Z`; solve ownership
with a matching `--user` or an entrypoint `chown` instead (page 05).

## Interview questions

**★ What is the practical difference between `-v` and `--mount`?**
They express the same mounts, but `-v` infers the type from the shape of the
source string and creates missing bind sources as empty directories, while
`--mount` makes you name `type=` and errors on a missing source. `--mount` also
reaches options the short form has no field for — `volume-nocopy`,
`volume-subpath`, `tmpfs-size`, `bind-create-src`. Use `-v` interactively, and
`--mount` in anything scripted or committed.

**★ How does `-v` decide whether the source is a volume or a host path?**
By whether the source field contains a `/`. With one, it is a bind mount;
without one, it is a named volume — created on demand if it does not exist. So a
typo in a volume name silently gives you a new empty volume, and a typo in a
host path silently gives you a new empty directory.

**★ Why does a slightly wrong config-file mount produce such a confusing
error?**
Because `-v` creates the missing host source *"always … as a directory"*. You
end up with a directory where the application expected a file, so the failure is
reported by the application as a malformed or missing configuration, several
layers away from the actual typo.

**Are the mount options the same on Docker and Podman?**
No. `ro`, `rw`, `z` and `Z` are common ground. Podman adds `U`/`chown`
(recursively chown the source to the container's UID/GID), `idmap`, `O` for an
overlay, `copy`/`nocopy` and the standard mount flags, and its `--mount`
supports extra types including `image` and `glob`. Podman-only suffixes fail on
Docker, so cross-engine commands should stay in the common set.

**Does `--mount` prevent every silent mistake?**
No — a missing *volume* is still created on demand, because that is what volumes
do. What it prevents is the bind-mount class: a missing or misspelled host path
becomes an error instead of an empty directory, and the mount type is stated
rather than inferred.

---

← Prev: [Volumes, bind mounts and tmpfs](02-volumes-bind-mounts-tmpfs/README.md) · Index: [Phase 6](README.md) · Next → **Bind mounts in development** *(not written yet)*
