---
title: "Running containers under systemd"
sidebar_label: "14 · Under systemd"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [Docker — start containers automatically](https://docs.docker.com/engine/containers/start-containers-automatically/),
> [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html),
> [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
> and [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html).
> **No sandbox** — no console output on this page.

**A restart policy supervises a container; a unit file supervises the machine.**
[Topic 07](07-restart-as-supervision.md) drew the line: the engine can restart a
container that exits, and that is all it can do. It cannot start your container
after the database that lives outside Docker, cannot express "this fails if that
fails", and cannot be inspected by an operator who does not know Docker is
involved. A systemd unit can do all three, and on a single production host that is
usually the difference between a deployment and an installation.

## The rule that comes first

> "Don't combine Docker restart policies with host-level process managers, as this
> creates conflicts."

🔴 **Pick one supervisor.** Under a unit, the container runs with no restart policy
at all — the engine must not resurrect something systemd believes it stopped, and
systemd must not race the engine to start it. The documentation's own framing is
that a process manager is what you use "when processes outside Docker depend on
Docker containers", which is exactly when the machine, not the engine, owns the
ordering.

## A Docker unit, and the trap inside it

```ini
[Unit]
Description=API service
Requires=docker.service
After=docker.service network-online.target

[Service]
Restart=always
RestartSec=5
TimeoutStopSec=30
ExecStartPre=-/usr/bin/docker rm -f api
ExecStart=/usr/bin/docker run --rm --name api \
  --user 10001:10001 --cap-drop=ALL --read-only --tmpfs /tmp \
  -p 8080:8080 myapp:1.4.2
ExecStop=/usr/bin/docker stop api

[Install]
WantedBy=multi-user.target
```

The directives, in `systemd.service(5)`'s words:

- **`Restart=`** takes "one of `no`, `on-success`, `on-failure`, `on-abnormal`,
  `on-watchdog`, `on-abort`, or `always`", and **"if set to `no` (the default), the
  service will not be restarted"** — so a unit without it supervises nothing.
- **`RestartSec=`** "configures the time to sleep before restarting a service" and
  **"defaults to 100ms"**, which is far too eager for a container that pulls an
  image or waits on a database. Set it.
- **`ExecStartPre=`** runs "before … `ExecStart=`"; the leading `-` makes a failure
  non-fatal, which is what you want for a `rm -f` of something that may not exist.
- **`ExecStop=`** are "commands to execute to stop the service", and
  **`TimeoutStopSec=`** bounds each of them — the container's stop grace period and
  the unit's stop timeout are two different budgets, as
  [topic 02](02-graceful-shutdown/01-the-deadline.md) established.
- **`RemainAfterExit=`** "specifies whether the service shall be considered active
  even when all its processes exited", defaulting to **no** — relevant for one-shot
  migration units, not for a server.

🔴 **The trap: `docker run` in the foreground is a client, not the container's
parent.** The container is a child of the daemon; the CLI merely streams to your
terminal. So systemd is supervising the *client process*, and the relationship it
thinks it has is not the one that exists. The consequences are practical:

- Killing the unit kills the client. `ExecStop=` doing a real `docker stop` is what
  actually stops the container, which is why the unit above has one.
- `--rm` plus an `ExecStartPre=-docker rm -f` is defensive cleanup for the case
  where the container outlived the client.
- A daemon restart takes every container with it regardless of what systemd thinks.

**This is the strongest structural argument for Podman on a systemd host**, below.

## Ordering against the rest of the machine

This is the capability a restart policy cannot express at all:

- **`Requires=` plus `After=`** — a hard dependency and an ordering. `Requires=`
  without `After=` says nothing about order, which is the commonest unit-file
  mistake.
- **`After=network-online.target`** for a service that must resolve or dial on
  start; `After=docker.service` because the engine has to exist first.
- **A one-shot migration unit** with `Type=oneshot` — the manager "will consider
  the unit up after the main process exits" — that the API unit orders itself
  after. That is the systemd expression of Compose's
  `condition: service_completed_successfully`.

**`Type=`** defaults to `simple`, where the unit is considered started "immediately
after the main service process has been forked off". For a container launched
through a client that is honest enough: nothing about the CLI's readiness tells you
the application is ready either, which is why the health check
([topic 09](09-healthchecks-in-production.md)) remains the real readiness signal.

## Podman: the container is the unit's own child

There is no daemon, so `podman run` in the foreground *is* the container's parent
process. Everything the Docker unit works around disappears: systemd's process
tracking, `Restart=`, `KillMode` and the stop timeout all apply to the actual
container.

That makes the hand-written unit far more honest — and Podman then goes further:

> Podman "supports building and starting containers (and creating volumes) via
> systemd by using a systemd generator"

**Quadlet** is that generator. You write a declarative `.container` file and it
"generates corresponding regular systemd service unit files" during boot and on
`systemctl daemon-reload`. The unit types are `.container`, `.pod`, `.volume`,
`.network`, `.kube`, `.build` and `.artifact`, and they live in
`/etc/containers/systemd/` for root or `~/.config/containers/systemd/` for a
rootless user. **Phase 11 · Quadlet** *(not written yet)* is the depth; the point
here is that on Podman you should not be hand-writing the unit at all.

Two more Podman-specific facts that decide whether a container survives a reboot:

- **`podman-restart.service`** restarts containers that were running before a
  reboot — the daemonless replacement for the engine re-asserting restart policies
  at start-up.
- ⚠️ **Rootless services stop when the user logs out** unless lingering is enabled
  for that user. A rootless container that "works until I disconnect" is this, not
  a container fault ([phase 0 · Rootless](../phase-0-what-a-container-is/11-rootless.md)).

## Logs, once you are under a unit

Anything the unit's process writes goes to the journal, and the engine is *also*
recording the container's stream through its log driver
([topic 08](08-log-drivers-and-rotation.md)). Under Docker that means the same
lines can be stored twice — once by the driver, once by the journal via the client.
Decide which one is authoritative:

- **Set the container's log driver to `journald`** so there is one destination and
  `journalctl -u api` is the whole story, or
- **Keep the driver and let the unit stay quiet**, reading logs with
  `docker logs`.

⚠️ Two stores means two rotation policies, and the one you forget is the one that
fills the disk ([topic 13](13-disk-growth.md)).

## Gotchas

**Symptom:** A container comes back after `systemctl stop`.
**Cause:** A Docker restart policy and a unit are both supervising it.
**Fix:** One supervisor. Under systemd the container runs with no restart policy;
the documentation explicitly warns against combining them.

**Symptom:** The unit restarts in a tight loop and the journal fills with attempts.
**Cause:** `RestartSec=` left at its default of 100ms, so a container that fails on
a missing dependency retries ten times a second.
**Fix:** Set `RestartSec=` to something matched to start-up cost, and fix the
dependency with `After=`/`Requires=`.

**Symptom:** `systemctl stop` returns immediately but the container keeps running.
**Cause:** Under Docker, systemd killed the *client*; the container is a child of
the daemon.
**Fix:** An explicit `ExecStop=` that runs `docker stop`, plus a defensive
`ExecStartPre=-docker rm -f`. Under Podman this does not arise.

**Symptom:** A rootless Podman service dies when the user's SSH session ends.
**Cause:** The user's systemd session ends with the login, taking the service with
it.
**Fix:** Enable lingering for that user, and prefer a Quadlet unit over a
hand-written one.

## Interview questions

**★ Why would you run a container under systemd rather than with a restart policy?**
Because a restart policy only reacts to a container exiting. A unit expresses
ordering and dependencies against everything else on the machine — the database
outside Docker, the mount that has to exist, the migration that must complete —
and it gives operators the same `systemctl`/`journalctl` interface as every other
service. Docker's own documentation points at a process manager for exactly the
case where processes outside Docker are involved.

**★ Why must you not combine both?**
Because they are two supervisors with two opinions: the engine restarts a container
systemd believes it stopped, and systemd restarts one the engine is already
recovering. The documentation says plainly not to combine them. Under a unit, the
container runs with no restart policy.

**★ What is structurally wrong with a `docker run` unit, and how does Podman fix
it?**
`docker run` in the foreground is a client; the container is a child of the daemon.
systemd therefore supervises the client, not the container, so process tracking,
the kill mode and the stop timeout all apply to the wrong process — hence the
explicit `ExecStop=`. Podman is daemonless, so the container really is the unit's
child, and Quadlet generates the unit from a declarative `.container` file instead
of you hand-writing one.

**Which systemd directives actually matter for a container unit?**
`Restart=` (default `no`, so a unit without it supervises nothing) and `RestartSec=`
(default 100ms, far too eager); `After=` and `Requires=` for ordering and
dependency; `ExecStartPre=` with a leading `-` for defensive cleanup; `ExecStop=`
for a real stop; and `TimeoutStopSec=`, which is a different budget from the
container's own stop grace period.

**How do you express "run migrations, then start the API" in units?**
A `Type=oneshot` migration unit — considered up once its main process exits — with
the API unit ordered `After=` it and `Requires=` it. That is the systemd equivalent
of Compose's `depends_on` with `condition: service_completed_successfully`.

**Where do container logs go once the container is a systemd service?**
Both places, unless you decide. The engine records the stream through its log
driver while the unit's own output goes to the journal, so the same lines can be
stored twice with two independent rotation policies. Either set the container's log
driver to `journald` and read everything with `journalctl -u`, or keep the driver
and read with `docker logs` — but pick one.

---

← Prev: [Disk growth](13-disk-growth.md) · Index: [Phase 10](README.md) · Next → [Time, timezones and locales](15-time-and-timezones.md)
