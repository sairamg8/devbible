---
title: "Getting inside, and asking the file"
sidebar_label: "02 · Getting inside"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [`docker compose exec`](https://docs.docker.com/reference/cli/docker/compose/exec/),
> [`docker compose run`](https://docs.docker.com/reference/cli/docker/compose/run/),
> [`docker compose config`](https://docs.docker.com/reference/cli/docker/compose/config/),
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/) and
> [`podman-compose(1)`](https://docs.podman.io/en/latest/markdown/podman-compose.1.html).
> **No sandbox** — no console output on this page.

**`exec` and `run` look interchangeable and are not: one enters the container
that is serving, the other creates a new one.** And `config` is the third
question nobody asks early enough — not *what is the stack doing*, but *what did
Compose actually read*.

## `exec` — inside a running container

> "Execute a command in a running container"

```bash
docker compose exec api sh                       # a shell in the running container
docker compose exec -u root api sh               # when the image runs as non-root
docker compose exec db psql -U postgres appdb    # the DB client, inside the DB container
docker compose exec -T api node -e 'console.log(1)'   # scripted, no TTY
docker compose exec --index=2 api hostname       # the second replica
```

🔴 **Unlike `docker exec`, `docker compose exec` allocates a TTY and goes
interactive by default** — there is no `-it` to remember. The consequence lands
in scripts and CI, where there is no terminal: pass **`-T` / `--no-tty`**, or the
command fails or hangs on a TTY it cannot get
([Phase 1, page 10](../../phase-1-running-containers/10-interactive-and-tty.md)).
The documentation notes the same for `--interactive=false`, "useful when used
within scripts".

The remaining options are `-d` (run in the background), `-e` (environment),
`--privileged`, `-u` / `--user`, `-w` / `--workdir` and `--index`.

**`exec` is the honest test of reachability.** Checking from your host whether
the API can reach the database proves nothing about the container's network — the
host is not on it ([page 07](../07-networks.md)). Running the check *inside* the
API container tests the path the application actually uses, with the same DNS,
the same aliases and the same environment.

⚠️ **Anything `exec` writes to the container filesystem dies with the container.**
Installing a debugging tool this way is fine for the next ten minutes and is not
a fix; it disappears on the next `up` that recreates the service.

## `run` — a one-off command

> "Run a one-off command on a service"

```bash
docker compose run --rm api npm run migrate      # a migration, then gone
docker compose run --rm api sh                   # a throwaway shell
docker compose run --rm --no-deps api npm test   # without starting the database
docker compose run --rm --service-ports api      # with the published ports, this once
```

`run` starts a **new** container from the service definition, with three
documented differences from `up`:

| | `up` | `run` |
|---|---|---|
| Published ports | as declared | 🔴 **none, by default** — "to avoid port collisions". `--service-ports` (`-P`) restores them all, `-p` maps one by hand |
| Dependencies | started | started, unless `--no-deps` |
| Command | the service's | the one you type |
| Cleanup | the container stays | **only with `--rm`** |

🔴 **`--rm` is not the default, and this is where stopped containers breed.** The
documentation notes it also *overrides any restart policy*. A CI job — or a habit
— of `compose run` without it leaves one container per invocation, each holding
its writable layer ([Phase 1, page 13](../../phase-1-running-containers/13-reclaiming-disk.md)).
`docker compose rm` clears the accumulated ones.

Other options worth knowing: `--build` (build first), `--entrypoint` (override
it, which is the ladder to a shell in an image whose entrypoint gets in the way),
`-e`, `-u`, `-w`, `-v`, `--name`, `-d`, and `--use-aliases` to apply the
service's network aliases.

### `run` versus `exec`

**It is a question about state, not about syntax.**

| | `exec` | `run` |
|---|---|---|
| Which container | the one already serving | a **new** one from the same definition |
| Sees the live environment | yes — real volumes, real network, real process | a fresh copy of the declared config |
| Right for | inspecting, debugging, "can it reach the DB *now*" | migrations, seeds, tests, one-off tasks |
| Wrong for | long-running work you expect to survive | observing what the running process is doing |
| Leaves anything behind | no | **a container, unless `--rm`** |

A migration through `exec` runs inside the API container that is serving traffic,
competing with it for the event loop and dying with it; the same migration
through `run --rm` gets its own container and a clean exit code
([Phase 1, page 04](../../phase-1-running-containers/04-exec-vs-run.md)).

## `config` — the file after Compose has read it

> "Parse, resolve and render compose file in canonical format"

This is the command that ends arguments. It merges every `-f`, applies the
override file, resolves interpolation, expands short syntax into canonical form,
and prints the result — the data model Compose will act on, not the text you
wrote.

```bash
docker compose config                       # the fully resolved YAML
docker compose config --services            # service names, one per line
docker compose config --volumes             # volume names
docker compose config --profiles            # profile names
docker compose config --images              # image names
docker compose config --hash                # per-service config hash
docker compose config --variables           # the model's variables, with defaults
docker compose config --no-interpolate      # the merge WITHOUT variable substitution
docker compose config --resolve-image-digests   # pin every tag to a digest
docker compose -q config                    # "only validate the configuration, don't print anything"
```

Four uses that earn it a place in the daily loop:

- **"The variable is empty."** `config` shows what it resolved to. Run it again
  with `--no-interpolate` and the difference tells you whether the problem is the
  *substitution* or the *merge*
  ([page 10](../10-environment-and-interpolation.md)).
- **"My override is not applying."** `config` shows the merged result — including
  the sequence concatenation that surprises everyone, where `ports` from two
  files append rather than replace ([page 11](../11-override-files.md)).
- **`-q` in CI.** Validating is a fast, free pre-flight check that catches a typo
  before a deploy, because every unrecognised key except `x-` is an error
  ([page 02](../02-compose-yaml-and-the-spec/README.md)).
- **`--resolve-image-digests`** turns a tag-based file into a digest-pinned one —
  the reproducibility argument of
  [Phase 2, page 02](../../phase-2-images-and-registries/02-tags-vs-digests.md)
  applied to a whole stack in one command.

⚠️ **`config` prints secrets.** It resolves interpolation, so every value from
your `.env` appears in the output in clear. It is not something to paste into an
issue or a chat.

## The rest of the surface

Worth knowing they exist; the six above are the daily ones.

| Command | Documented as |
|---|---|
| `ls` | "List running compose projects" |
| `cp` | "Copy files/folders between a service container and the local filesystem" |
| `restart` | "Restart service containers" — ⚠️ does **not** apply file changes ([page 03](../03-up-and-down/README.md)) |
| `stop` / `start` | "Stop services" / "Start services" — without destroying the containers |
| `kill` | "Force stop service containers" — no grace period |
| `rm` | "Removes stopped service containers" |
| `build` / `pull` / `push` | "Build or rebuild services" / "Pull service images" / "Push service images" |
| `images` | "List images used by the created containers" |
| `port` | "Print the public port for a port binding" |
| `events` | "Receive real time events from containers" |
| `stats` | "Display a live stream of container(s) resource usage statistics" |
| `wait` | "Block until containers of all (or specified) services stop" |
| `volumes` | "List volumes" |
| `watch` | "Watch build context for service and rebuild/refresh containers when files are updated" ([page 13](../13-develop-watch.md)) |

## The global options

They sit **before** the subcommand, and that position is not optional:

```bash
docker compose -f compose.yaml -f compose.prod.yaml -p staging up -d
docker compose --profile tools --progress plain up
docker compose --dry-run down -v          # see what it would do, change nothing
```

| Option | What it does |
|---|---|
| `-f`, `--file` | "Compose configuration files" — repeatable, applied left to right, and passing any of them suppresses the automatic override file |
| `-p`, `--project-name` | "Project name" — the top of the precedence chain ([page 09](../09-project-name.md)) |
| `--profile` | "Specify a profile to enable" ([page 12](../12-profiles.md)) |
| `--project-directory` | "Specify an alternate working directory" — what relative paths resolve against |
| `--env-file` | "Specify an alternate environment file" — for interpolation, not for the container |
| `--parallel` | "Control max parallelism, -1 for unlimited" |
| `--progress` | "Set type of progress output (auto, tty, plain, json, quiet)" — `plain` is the one to use in CI logs |
| `--dry-run` | "Execute command in dry run mode" |

🔴 **`--dry-run` before a destructive command is the cheapest habit on this
page.** It is the safe way to find out what `down -v` would remove *before* it
removes it — and `down -v` is the command that deletes your development database
([page 03](../03-up-and-down/README.md)).

## Podman

These are **client** commands, so what you get depends on the compose provider
rather than the engine. `podman compose` is *"a thin wrapper around an external
compose provider"* and prefers `docker-compose` when both are installed — with
that provider, everything on this page behaves as documented. `podman-compose`
implements a subset of the Specification: `up`, `down`, `logs`, `exec` and `ps`
are the safe core, and anything past it is worth confirming rather than assuming
([page 15](../15-podman-compose.md)).

## Gotchas

**Symptom:** `docker compose exec` works locally and hangs or errors in CI.
**Cause:** Compose allocates a TTY and goes interactive by default, and CI has no
terminal.
**Fix:** `-T` / `--no-tty` in every scripted `exec`. This is the exact inverse of
the `docker exec` habit, where you must remember to *add* `-it`.

**Symptom:** Dozens of stopped containers named `<project>-api-run-<hash>`.
**Cause:** `docker compose run` without `--rm` — the container is kept by
default, and the restart policy is overridden rather than the container removed.
**Fix:** Always `run --rm`. Clear the accumulated ones with `docker compose rm`.

**Symptom:** A `run` command is not reachable on the port the service declares.
**Cause:** `run` creates no published ports by default, deliberately, so a
one-off container cannot collide with the service already running.
**Fix:** `--service-ports` when you genuinely want all of them, `-p` for one.
Usually you need neither — talk to the service by name on the project network.

**Symptom:** You pasted `docker compose config` output into a ticket.
**Cause:** `config` resolves interpolation, so it prints every secret your `.env`
supplies.
**Fix:** Use `--services`, `--images` or `--no-interpolate` when you need to
share the shape of a file rather than its values, and rotate anything already
posted — publishing it is what leaked it, deleting the message does not unleak
it.

## Interview questions

**★ How does `docker compose exec` differ from `docker exec`?**
It addresses the container by service name within the project, and it allocates a
TTY and goes interactive by default where `docker exec` needs an explicit `-it`.
The trap is the mirror image of the engine's: a scripted `compose exec` needs
`-T` to *disable* the TTY it would otherwise try to allocate.

**★ When do you use `run` rather than `exec`?**
`run` starts a fresh container from the service definition — right for
migrations, seeds, test runs and throwaway shells, and it gives you a clean exit
code for the task itself. `exec` enters the container that is already serving,
which is the only way to observe real state. And `run` publishes no ports by
default and keeps its container unless you pass `--rm`, which is where a
directory full of stopped `-run-` containers comes from.

**★ What does `docker compose config` do that reading the file cannot?**
It prints the resolved data model: every `-f` merged, the override applied,
variables interpolated and short syntax expanded to canonical form. That is what
settles "the variable is set" and "my override is not applying" —
`--no-interpolate` separates a substitution problem from a merge problem, and
`-q` makes it a free validation step in CI. It prints secrets, so it is not
output to share.

**Why does `run` publish no ports by default?**
To avoid collisions. The service it is based on is usually already running and
already holding those host ports, so a one-off container that claimed them would
fail to start or steal traffic. `--service-ports` opts back in when you actually
want a temporary container reachable from the host.

**What does `--dry-run` give you?**
It executes the command in dry-run mode: Compose reports what it would create,
recreate or remove without touching anything. Before `down -v` it is the
difference between knowing and hoping.

**Where do the global options go, and which one matters most in CI?**
Before the subcommand — `docker compose -f a.yaml -p staging up -d`.
`--progress plain` is the one that improves CI logs, because the default TTY
progress rendering is unreadable once captured; `--dry-run` and `-q config` are
the two that prevent damage.

---

← Prev: [Reading a running stack](01-reading-the-stack.md) · Index: [Day-to-day commands](README.md) · Next → [`podman compose` and `podman-compose`](../15-podman-compose.md)
