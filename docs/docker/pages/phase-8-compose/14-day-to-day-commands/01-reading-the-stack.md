---
title: "Reading a running stack"
sidebar_label: "01 · Reading the stack"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [`docker compose ps`](https://docs.docker.com/reference/cli/docker/compose/ps/),
> [`docker compose logs`](https://docs.docker.com/reference/cli/docker/compose/logs/),
> [`docker compose top`](https://docs.docker.com/reference/cli/docker/compose/top/) and
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/).
> **No sandbox** — no console output on this page.

**Three commands observe the stack from outside, and two of the three have a
default that hides exactly what you are looking for.** Knowing the defaults is
most of the value here.

## `ps` — what exists

> "List containers"

```bash
docker compose ps                 # running containers in this project
docker compose ps -a              # ...including exited ones
docker compose ps --status=exited # only the dead
docker compose ps --services      # just the service names
docker compose ps --format json   # machine-readable, for scripts
```

| Option | Default | What it does |
|---|---|---|
| `-a`, `--all` | off | Show stopped containers too |
| `--status` | — | Filter by status |
| `--filter` | — | Filter by property (status is supported) |
| `--services` | off | Print service names only |
| `-q`, `--quiet` | off | Print IDs only |
| `--format` | `table` | `table`, `json`, or a Go template |
| `--no-trunc` | off | Do not truncate |
| `--orphans` | **`true`** | Include orphaned containers |

🔴 **The default hides exited containers**, which is exactly the case you are
usually investigating. A service that crashed on boot is invisible to a plain
`docker compose ps`: the table looks healthy, minus one row nobody counts.
**Make `-a` the habit.**

Then read the `STATUS` column rather than the presence of the row:

| What you see | What it means |
|---|---|
| `Up 4 minutes` | The process is running. It says nothing about whether it works |
| `Up 4 minutes (healthy)` | The healthcheck is passing ([page 06](../06-healthchecks/README.md)) |
| `Up 4 minutes (unhealthy)` | The check fails — **and Compose is still routing traffic to it**; Docker reports, it does not act |
| `Up 30 seconds (health: starting)` | Inside `start_period`; no verdict yet |
| `Exited (1) 2 minutes ago` | It died. `logs` is the next command |
| `Restarting (1) 5 seconds ago` | A crash loop wearing a mask — the restart policy is hiding a repeated failure ([Phase 1, page 03](../../phase-1-running-containers/03-ps-inspect-logs-stats.md)) |

`--orphans` defaults to **true**, so containers left over from a service you
deleted from the file — or from a profile you did not enable
([page 12](../12-profiles.md)) — appear here rather than staying invisible until
the next `up` complains about them.

**`docker compose ls` is the wider view**: "List running compose projects", which
is the honest answer to *what did I leave running in the other checkout*.

## `logs` — what it said

> "View output from containers"

```bash
docker compose logs                        # everything, interleaved, prefixed
docker compose logs -f api                 # follow one service
docker compose logs --tail=100 api db      # the last 100 lines of two services
docker compose logs --since=15m api        # only the recent past
docker compose logs -t --no-color api > api.log
```

| Option | Default | What it does |
|---|---|---|
| `-f`, `--follow` | off | Follow log output |
| `--tail`, `-n` | **`all`** | Lines from the end, **per container** |
| `--since` / `--until` | — | Timestamp (`2013-01-02T13:23:37Z`) or relative (`42m`) |
| `-t`, `--timestamps` | off | Show timestamps |
| `--no-color` | off | Monochrome — use it when redirecting to a file |
| `--no-log-prefix` | off | Drop the `service |` prefix |
| `--index` | — | Which replica, when a service has several ([page 17](../17-scale-and-limits.md)) |

**`--tail` defaults to `all`, and it is per container.** On a six-service stack a
bare `docker compose logs` is every line every container has ever written,
interleaved and prefixed. `--tail=100 <service>` is the readable form;
`--since=15m` is better still when you know roughly when it broke.

Three facts inherited from the engine, restated because Compose does not change
them and each one produces a confident wrong conclusion:

- **`logs` shows PID 1's stdout and stderr, and nothing else.** An application
  that writes to a log file inside the container produces empty output here — the
  logs exist, they are just not where the engine looks
  ([Phase 10 · Logs go to stdout and stderr](../../phase-10-production/04-logs-to-stdout/README.md)).
- **`logs` reads what the log driver kept.** The default `json-file` driver does
  no rotation, so the file grows without limit; a rotating configuration means
  early boot output may already be gone.
- **A missing timestamp is not a missing event.** Add `-t` before comparing two
  services' output, because the interleaved order is the order Compose read the
  streams in, not necessarily the order things happened.

⚠️ **Following the logs is not the same as attaching.** `up` without `-d` attaches,
so `Ctrl-C` stops the stack; `logs -f` is a reader and `Ctrl-C` stops only the
reader ([page 03](../03-up-and-down/README.md)).

## `top` — processes inside the containers

> "Display the running processes"

```bash
docker compose top          # every service
docker compose top api      # one of them
```

It answers one question well: **is PID 1 what I think it is?** A `sh` at PID 1
with your process as its child is the shell-form signature, and the reason a stop
takes the full grace period every single time
([Phase 3, page 06](../../phase-3-dockerfile/06-exec-vs-shell-form.md)). It is
also how you notice that a container is running two processes when you designed
it to run one.

For live resource usage rather than a process list, `docker compose stats` is
"a live stream of container(s) resource usage statistics".

## Gotchas

**Symptom:** `docker compose ps` shows a healthy-looking stack, but the app is
broken.
**Cause:** The default listing hides exited containers, so the service that
crashed on boot is simply absent from the table.
**Fix:** `docker compose ps -a`, then read `STATUS` — `Exited (1)` and
`Restarting (n)` are the two rows that matter.

**Symptom:** A service is `Up` and `(unhealthy)`, and traffic is still reaching
it.
**Cause:** A healthcheck reports; it does not act. Nothing in Compose removes an
unhealthy container from service.
**Fix:** Treat `(unhealthy)` as a signal to investigate, and put the actual
reaction — restart, replace, drain — where reactions belong, in production
supervision rather than in the check.

**Symptom:** `docker compose logs` shows nothing for a service you know is
working.
**Cause:** The application writes to a file inside the container instead of to
stdout and stderr, so PID 1 has produced no output.
**Fix:** Configure the application to log to stdout. Redirecting a file into the
console is a workaround; the contract is that the process logs to its streams.

**Symptom:** Reading logs is unmanageable — thousands of interleaved lines.
**Cause:** `--tail` defaults to `all`, and applies per container.
**Fix:** Name the service and pass `--tail=100` or `--since=15m`. Use
`--no-log-prefix` and `-t` when you are diffing two services by hand.

## Interview questions

**★ Something in your stack is broken. What do you run first, and why not
`logs`?**
`docker compose ps -a`. The default listing hides exited containers, so the
service that crashed on boot does not appear at all — and if you go straight to
`logs` you will be reading the healthy services. `ps -a` tells you *which*
service to ask about, and its `STATUS` distinguishes a clean exit from a crash
loop from an unhealthy-but-serving container.

**★ Why is `--tail` almost always worth passing?**
Because it defaults to `all` and applies per container, so a plain
`docker compose logs` on a six-service stack is the complete history of
everything, interleaved. `--tail=100 <service>` is the readable version, and
`--since=15m` is better when you know roughly when the failure started.

**A service is `Up (unhealthy)`. What does Compose do about it?**
Nothing. The healthcheck sets a status and `depends_on` consults it at startup
only. An unhealthy container keeps its place on the network and keeps receiving
traffic. That is the recurring rule of this track: the engine reports, something
else must act.

**What does `docker compose top` tell you that `ps` does not?**
The processes *inside* the container. Its main use is confirming what is at PID 1
— a shell there instead of your application is the shell-form signature and
explains a stop that always takes the full grace period.

---

← Prev: [Day-to-day commands](README.md) · Index: [Phase 8](../README.md) · Next → [Getting inside, and asking the file](02-getting-inside.md)
