---
title: "Phase 1 — Running containers"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Docker Engine 29.7.2 · Podman 6.1.0.** Every page is
> **documentation-validated** against the two engines' CLI references and the
> relevant man pages, with sources named per page. **No sandbox** — nothing was
> run, so no page carries a console output block.

The commands you will type ten thousand times. The goal of this phase is not
memorising flags — it is being able to **predict what a container will do before
you press enter**, and to know which command answers which question when it does
something else.

Sixteen pages. Pages 01–06 are the daily set; 07–09 are the triage set that turns
"it broke" into a specific diagnosis.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The anatomy of docker run](01-docker-run-anatomy.md)** | <span className="db-tier t-master">Master</span> | Flags before the image are Docker's; everything after belongs to your process |
| 02 | **[Foreground, detached and cleanup](02-detached-and-cleanup.md)** | <span className="db-tier t-master">Master</span> | `-d`, `--rm`, `--name`, and why stopped containers keep their names |
| 03 | **[ps, inspect, logs and stats](03-ps-inspect-logs-stats.md)** | <span className="db-tier t-master">Master</span> | Four commands, four questions, and the order to ask them in |
| 04 | **[exec versus run](04-exec-vs-run.md)** | <span className="db-tier t-master">Master</span> | The distinction behind "my changes disappeared" |
| 05 | **[Publishing ports](05-publishing-ports.md)** | <span className="db-tier t-master">Master</span> | The container port is last, `-p` binds every interface, and `ufw` will not save you |
| 06 | **[Environment variables](06-environment.md)** | <span className="db-tier t-master">Master</span> | Run time beats the image, `--env-file` is not a shell script, and env is not secret |
| 07 | **[The container lifecycle](07-lifecycle.md)** | <span className="db-tier t-understand">Understand</span> | The states, and why containers exit the instant they start |
| 08 | **[Stop is two signals](08-stop-is-two-signals.md)** | <span className="db-tier t-understand">Understand</span> | `SIGTERM`, ten seconds, `SIGKILL` — and the two traps that swallow the first |
| 09 | **[Exit codes](09-exit-codes.md)** | <span className="db-tier t-understand">Understand</span> | 125/126/127 from the engine, 128+N from a signal, and how to disambiguate 137 |
| 10 | **[Interactive and TTY](10-interactive-and-tty.md)** | <span className="db-tier t-understand">Understand</span> | `-i` and `-t` are independent, and a missing TTY block-buffers your logs |
| 11 | **[Overriding ENTRYPOINT and CMD](11-overriding-entrypoint.md)** | <span className="db-tier t-understand">Understand</span> | How to get a shell in anything, and why `exec "$@"` ends every entrypoint script |
| 12 | **[Restart policies](12-restart-policies.md)** | <span className="db-tier t-understand">Understand</span> | `always` vs `unless-stopped`, and why neither survives a Podman reboot alone |
| 13 | **[Reclaiming disk space](13-reclaiming-disk.md)** | <span className="db-tier t-understand">Understand</span> | Four things grow independently, and one flag deletes your database |
| 14 | **[user, workdir, hostname and add-host](14-user-workdir-hostname.md)** | <span className="db-tier t-know">Know</span> | Four small overrides, and why `--hostname` is not DNS |
| 15 | **[docker cp](15-docker-cp.md)** | <span className="db-tier t-know">Know</span> | Excellent for a post-mortem, a smell in a deploy script |
| 16 | **[attach versus logs -f](16-attach-vs-logs.md)** | <span className="db-tier t-when">When Needed</span> | One of them can stop the container with `Ctrl-C`; the other cannot |

## Coverage

Sixteen syllabus topics, sixteen pages — one to one, nothing merged or dropped.

| Syllabus topic | Page |
|---|---|
| `docker run` anatomy | 01 |
| Foreground vs detached, `--rm`, `--name` | 02 |
| `ps` / `inspect` / `logs` / `stats` | 03 |
| `exec` into a running container vs `run` a new one | 04 |
| Publishing ports and interface binding | 05 |
| Environment: `-e`, `--env-file`, precedence | 06 |
| The lifecycle: created/running/paused/exited | 07 |
| Stop is two signals; `STOPSIGNAL` | 08 |
| Exit codes that mean something | 09 |
| `-i`, `-t` and `-it` | 10 |
| Overriding `ENTRYPOINT` and `CMD` at run time | 11 |
| `--restart` policies | 12 |
| Reclaiming disk: `rm`, prune, `system df` | 13 |
| `--user`, `--workdir`, `--hostname`, `--add-host` | 14 |
| `docker cp` | 15 |
| `attach` vs `logs -f`, detach keys | 16 |

## Phase gate

Move on to Phase 2 when:

- a container exits immediately and you can **name three likely causes without
  searching**, and say which exit code each would produce;
- you can get a shell inside an image whose entrypoint is a binary;
- and you can explain why a published port refuses connections while the
  application is definitely running.

## Where this connects

- **Phase 0** is the mechanism under all of this: exit 137 is
  [cgroups](../phase-0-what-a-container-is/03-cgroups.md), PID 1's signal
  behaviour is [namespaces](../phase-0-what-a-container-is/02-namespaces.md), and
  the disposable writable layer is
  [image vs container](../phase-0-what-a-container-is/04-image-vs-container.md).
- **Phase 3 — The Dockerfile** turns the run-time overrides here into image
  defaults: `ENTRYPOINT`/`CMD`, `USER`, `WORKDIR`, `STOPSIGNAL`.
- **Phase 6 — Storage** picks up `--rm` and anonymous volumes, and the ownership
  problems `--user` half-solves.
- **Phase 7 — Networking** explains why containers do not need published ports to
  reach each other.
- **Phase 8 — Compose** replaces almost every flag here with a line of YAML, and
  is much calmer for it.
- **Phase 10 — Production** takes pages 08, 09 and 12 seriously: graceful
  shutdown, OOM kills, and supervision that reacts to health rather than exit.

---

← Syllabus: [Part 1 — How containers work](../../syllabus/01-how-containers-work.md) · Prev phase: [Phase 0](../phase-0-what-a-container-is/README.md) · Start → [The anatomy of docker run](01-docker-run-anatomy.md)
