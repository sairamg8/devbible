---
title: "down, and the command that deletes your database"
sidebar_label: "02 · down"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [`docker compose down`](https://docs.docker.com/reference/cli/docker/compose/down/),
> [`docker compose stop`](https://docs.docker.com/reference/cli/docker/compose/stop/) and
> [`docker compose restart`](https://docs.docker.com/reference/cli/docker/compose/restart/).
> **No sandbox** — no console output on this page.

**`down` removes containers and networks. `down -v` removes your data, and there
is no undo.** One character separates a routine teardown from the loss of a
development database that somebody spent an afternoon seeding.

## What `down` removes by default

Per the documentation, `down` removes:

- "Containers for services defined in the Compose file"
- "Networks defined in the networks section of the Compose file"
- "The default network, if one is used"

And what it leaves alone:

- **Named volumes** — not removed without `-v`.
- **Anonymous volumes** — "Anonymous volumes are not removed by default".
- **Images** — not removed without `--rmi`.
- **Anything marked `external`** — "Networks and volumes defined as external are
  never removed", regardless of flags. Compose did not create them, so it does not
  destroy them.

⚠️ **The command's own one-line blurb is misleading and worth knowing about.** It
reads "Stops containers and removes containers, networks, volumes, and images
created by `up`" — which sounds like volumes and images go by default. They do not;
the option table is the authority, and `-v` and `--rmi` exist precisely because
those two are opt-in. Read the flags, not the summary.

## The options

| Flag | Documented meaning |
|---|---|
| `-v`, `--volumes` | "Remove named volumes declared in the `volumes` section of the Compose file and anonymous volumes attached to containers" |
| `--rmi` | "Remove images used by services. `local` remove only images that don't have a custom tag" |
| `--remove-orphans` | "Remove containers for services not defined in the Compose file" |
| `-t`, `--timeout` | "Specify a shutdown timeout in seconds" |

Read `-v`'s wording carefully, because it is broader than people expect: **named
volumes declared in the file, *and* anonymous volumes attached to containers.** So
`down -v` takes the database volume you declared *and* the incidental ones you
never named.

```bash
docker compose down                    # containers + networks. Data survives
docker compose down -v                 # ⛔ and the data is gone
docker compose down --rmi local        # also remove untagged images it built
docker compose down --remove-orphans   # also remove containers of deleted services
```

## Why `down -v` is worth a habit, not a rule

The honest position is that `down -v` is a **good** command — it is how you get a
guaranteed-clean stack, and being unable to rebuild your development data from
nothing is itself a defect. What makes it dangerous is running it reflexively while
debugging something unrelated.

Three habits that cost nothing:

1. **Never put `down -v` in a shared script** without the word `reset` in the
   script's name. `make reset` is fine; `make stop` running `down -v` is a trap.
2. **Keep seeding reproducible** — a migration and a seed service
   ([Phase 9 · Migrations and seeds](../../phase-9-mern-pern-stack/10-migrations-and-seeds.md)
   covers the shape), so
   `down -v && up -d` is a fifteen-second inconvenience rather than a loss.
3. **Use named volumes for anything you would miss.** A named volume at least
   survives `down`; an anonymous one is already halfway to being garbage
   ([page 08](../08-volumes.md)).

There is no confirmation prompt and no recycle bin. The engine deletes the volume.

## `stop`, `start`, `restart` — the ones that are not `down`

`down` is destruction. Most of the time you wanted something gentler:

| Command | What it does |
|---|---|
| `docker compose stop` | "Stops running containers without removing them. They can be started again with `docker compose start`" |
| `docker compose start` | Starts the previously stopped containers |
| `docker compose restart` | "Restarts all stopped and running services, or the specified services only" |
| `docker compose kill` | Force-stops the containers (SIGKILL by default) |
| `docker compose rm` | Removes stopped service containers, leaving networks and volumes |

🔴 **The `restart` trap, in the documentation's own words:** "If you make changes to
your `compose.yml` configuration, these changes are not reflected after running this
command." Environment variables are the example it gives — they are applied when
the container is created, and `restart` does not create a new container.

So the rule is worth memorising as a pair:

- **Changed the file or the code → `up -d` (add `--build` if the image must be
  rebuilt).** Reconciliation is what applies changes.
- **Want the process bounced with the same config → `restart`.**

Using `restart` to apply a change is the single most common Compose mistake, and it
fails silently — the container comes back, so it looks like it worked.

## The lifecycle in one table

| You want | Command | Containers | Networks | Named volumes | Data |
|---|---|---|---|---|---|
| Pause work for the day | `stop` | kept, stopped | kept | kept | ✅ safe |
| Resume | `start` | started | kept | kept | ✅ safe |
| Bounce a wedged process | `restart` | same containers | kept | kept | ✅ safe |
| Apply a config or code change | `up -d [--build]` | recreated as needed | kept | kept | ✅ safe |
| Tear the stack down | `down` | removed | removed | **kept** | ✅ safe |
| Start completely fresh | `down -v` | removed | removed | **removed** | ⛔ **gone** |

This mirrors the single-container distinction exactly: stopping ends the process,
removing destroys the container, and the volume is a third thing with its own
lifetime
([Phase 1, page 07](../../phase-1-running-containers/07-lifecycle.md)).

## Podman

`podman compose down` delegates like everything else
([page 01](../01-what-compose-is.md)), and the destructive semantics of `-v` are the
provider's to implement. Two Podman-side notes that matter:

- **Volumes live in your home directory when rootless**
  ([Phase 2, page 13](../../phase-2-images-and-registries/13-storage-on-disk.md)), so
  `down -v` frees space against your user's quota rather than a system-wide
  location.
- **There is no daemon holding restart policies**, so "the containers came back
  after a reboot" is not something to expect from Compose under rootless Podman
  without linger and a systemd unit
  ([Phase 1, page 12](../../phase-1-running-containers/12-restart-policies.md)).

## Gotchas

**Symptom:** The development database is empty after a teardown.
**Cause:** `down -v` — it removes named volumes declared in the file *and* anonymous
volumes attached to containers.
**Fix:** There is no recovery. Prevent it: keep seeds reproducible, and keep `-v` out
of any script that is not explicitly named as a reset.

**Symptom:** `down` did not free the disk space you expected.
**Cause:** Volumes and images are not removed by default; only containers and
networks are.
**Fix:** `down -v` for the data (deliberately), `--rmi local` for images, and
`docker system df` to see where the space actually went
([Phase 1, page 13](../../phase-1-running-containers/13-reclaiming-disk.md)).

**Symptom:** A volume survived `down -v`.
**Cause:** It is declared `external`, and "networks and volumes defined as external
are never removed".
**Fix:** Nothing to fix — that is the protection `external` buys. Remove it by hand
with `docker volume rm` if you truly mean to.

**Symptom:** An environment variable change did not take effect after
`docker compose restart`.
**Cause:** `restart` reuses the existing container, and configuration changes are not
reflected by it.
**Fix:** `docker compose up -d`. The container is recreated and the new configuration
applies.

## Interview questions

**★ What does `docker compose down` remove, and what does it keep?**
It removes the containers for the services in the file, the networks declared in the
file, and the default network. It keeps named volumes, anonymous volumes and images
— those need `-v` and `--rmi`. Anything declared `external` is never removed at all,
because Compose did not create it.

**★ What exactly does `down -v` delete?**
Named volumes declared in the `volumes` section of the Compose file, *and* anonymous
volumes attached to containers. That is broader than most people assume, there is no
prompt, and there is no undo. It is the command that deletes a development database.

**★ Why does `docker compose restart` not apply a change you made to
`compose.yaml`?**
Because it restarts existing containers rather than creating new ones, and
configuration such as environment variables is applied at container creation. The
documentation says the changes "are not reflected after running this command". To
apply a change you need `up -d`, which recreates the affected containers — and
`--build` too if the image itself must change.

**What is the difference between `stop` and `down`?**
`stop` stops the containers and keeps them, so `start` brings the same containers
back. `down` removes them along with the project's networks. Data in named volumes
survives both.

**How do you get a completely clean stack, and what should be true before you do?**
`docker compose down -v` followed by `up -d --build`. Before that is a routine
move, seeding has to be reproducible — a migration step and a seed service — so that
throwing the data away costs seconds rather than an afternoon.

---

← Prev: [`up` and what it recreates](01-up.md) · Topic index: [up, down and the lifecycle](README.md) · Next → [The services block](../04-services-block/README.md)
