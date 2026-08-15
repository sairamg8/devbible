---
title: "What Quadlet is"
sidebar_label: "01 · What Quadlet is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html),
> [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html)
> and [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html).
> **No sandbox** — no console output on this page.

[Phase 10 · 14](../../phase-10-production/14-under-systemd.md) ended on a
promise: on Podman you should not be hand-writing the unit at all. This is why.

🔴 **Quadlet is a systemd generator, not a Podman feature that talks to systemd.**
That distinction decides everything about how you use it, debug it and think
about it.

## The mechanism, in the documentation's own words

> Podman "supports building and starting containers (and creating volumes) via
> systemd by using a **systemd generator**. These files are read **during boot
> (and when `systemctl daemon-reload` is run)** and **generate corresponding
> regular systemd service unit files**."

Read that carefully, because three consequences follow:

1. **You write a declaration, not a script.** A `.container` file describes the
   container. No `ExecStart=`, no `ExecStop=`, no `podman rm -f` cleanup line —
   the awkward shape a Docker unit needs
   ([Phase 10 · 14](../../phase-10-production/14-under-systemd.md)) is generated
   for you, correctly, every time.
2. **The output is an ordinary systemd unit.** Nothing in systemd knows or cares
   that a generator produced it. `systemctl`, `journalctl`, dependencies,
   ordering, `systemd-analyze` — all of it behaves normally.
3. **Generation happens at boot and at `daemon-reload`.** A file you drop in is
   invisible until one of those two things happens. This is the single most
   common "my Quadlet unit does not exist" report, and it is not a bug.

## The eight unit types

| Extension | What it declares |
|---|---|
| `.container` | A container run as a service — the one you will write most |
| `.pod` | A pod ([topic 03](../03-pods.md)) that containers join |
| `.volume` | A named volume, created if missing |
| `.network` | A user-defined network, created if missing |
| `.image` | "Pulls and caches a container image" as a one-time operation |
| `.build` | An image built from a Containerfile |
| `.kube` | A Kubernetes YAML file run with `kube play` |
| `.artifact` | An OCI artifact |

The first four cover almost every real deployment. `.image` is the useful
sleeper: it makes "the image is present" an explicit unit that other units can
depend on, instead of a pull that happens implicitly at start-up and turns a
network hiccup into a service failure.

## Where the files go

Quadlet searches fixed directories, and **which one you use is a statement about
who owns the file**.

**Root**, in precedence order:

- `/run/containers/systemd/` — temporary, for the current boot
- `/etc/containers/systemd/` — **administrator-defined**, where your units go
- `/usr/share/containers/systemd/` — **distribution-defined**, packaged units

**Rootless**, in precedence order:

- `$XDG_RUNTIME_DIR/containers/systemd/`
- `$XDG_CONFIG_HOME/containers/systemd/`, i.e. `~/.config/containers/systemd/` —
  **where your own units go**
- `/etc/containers/systemd/users/${UID}` and `/etc/containers/systemd/users/`
- `/usr/share/containers/systemd/users/${UID}` and
  `/usr/share/containers/systemd/users/`

⚠️ **`/usr/share/…` is the distribution's, not yours.** Editing a file there gets
it replaced on the next package update, and the split exists precisely so that
does not surprise anyone. `/etc/…` for root, `~/.config/…` for you.

🔴 **The rootless paths under `/etc` and `/usr/share` let an administrator ship
units for a specific user by UID** — which is how you deploy a rootless service on
a machine whose users do not log in to configure it, paired with
`loginctl enable-linger` ([topic 01](../01-daemonless/02-restart-logs-and-systemctl.md)).

## The naming rule, and the one that saves you an hour

**`foo.container` generates `foo.service`.** You manage it as `foo.service` —
`systemctl start foo`, `systemctl status foo`, `journalctl -u foo`. There is no
`systemctl start foo.container`.

The *container's* name is separate: if `ContainerName=` is not set, the default is
**`systemd-%N`** — so `foo.container` produces a container called `systemd-foo`.
The documentation's reason is worth keeping: the prefix prevents collisions with
containers a user created by hand.

⚠️ **That is why `podman ps` shows `systemd-api` when your unit is `api.service`
and your `.container` file is `api.container`.** Three names for one thing, and
they are all deliberate.

## Never edit the generated unit

The generator writes real unit files, and they are **outputs**. Editing one works
until the next boot or `daemon-reload` regenerates it and silently discards your
change — the worst failure shape there is, because it works when you test it.

**Everything belongs in the `.container` file**, which is why Quadlet lets you
write `[Unit]`, `[Service]` and `[Install]` sections there directly: they are
passed through to the generated unit. If you need `Restart=`, `After=` or
`WantedBy=`, you write them in the source file, not the output.

## Why this beats a hand-written unit, concretely

| | Hand-written `docker run` unit | Quadlet `.container` |
|---|---|---|
| What systemd supervises | The CLI; the container belongs to the daemon | The container itself |
| Stop | Needs an explicit `ExecStop=` performing a real `docker stop` | Generated correctly |
| Stale container from a crash | Needs a defensive `ExecStartPre=-docker rm -f` | Handled |
| Dependencies on volumes and networks | You order them by hand, if you remember | Derived from the references |
| Correctness after an upgrade | Frozen at whatever you wrote | Regenerated by the current Podman |

🔴 **The last row is the argument people miss.** A hand-written unit encodes your
understanding of the engine on the day you wrote it. A generated one is rewritten
by the engine on every reload, so it stays correct as Podman changes.

## Gotchas

**Symptom:** A `.container` file is in the right directory and
`systemctl start foo` reports no such unit.
**Cause:** The generator has not run. Files are read at boot and at
`systemctl daemon-reload`.
**Fix:** `systemctl daemon-reload` — `systemctl --user daemon-reload` for a
rootless unit. Nothing else is needed.

**Symptom:** `systemctl start foo.container` fails.
**Cause:** `.container` is the *source*. The generated service is `foo.service`.
**Fix:** `systemctl start foo`. Use the `.container` name only when editing the
file.

**Symptom:** `podman ps` shows a container named `systemd-foo` that nobody
created.
**Cause:** That is the default container name, `systemd-%N`, chosen so
generated containers cannot collide with hand-made ones.
**Fix:** Nothing, or set `ContainerName=` if a fixed name matters — for example
because another container addresses it.

**Symptom:** An edit to the generated unit keeps disappearing.
**Cause:** It is regenerated at every boot and `daemon-reload`.
**Fix:** Put the setting in the `.container` file, which accepts `[Unit]`,
`[Service]` and `[Install]` sections and passes them through.

**Symptom:** A unit edited under `/usr/share/containers/systemd/` reverted after
a system update.
**Cause:** That path is distribution-defined. Administrator files belong in
`/etc/containers/systemd/`.
**Fix:** Copy it to `/etc/containers/systemd/` and edit there; that path takes
precedence.

## Interview questions

**★ What is Quadlet?**
A systemd generator. You write declarative unit files — `.container`, `.pod`,
`.volume`, `.network` and four more — and they are "read during boot (and when
`systemctl daemon-reload` is run)" to "generate corresponding regular systemd
service unit files". The output is an ordinary unit; systemd does not know a
generator was involved.

**★ Why is Quadlet better than a hand-written unit that runs `podman run`?**
Because the generated unit is correct by construction and stays correct. A
hand-written one freezes your understanding of the engine at the moment you wrote
it, and every Docker version of it also supervises the wrong process — the CLI
rather than the container. Quadlet also derives dependencies on volumes and
networks from the references in the file.

**★ You dropped a `.container` file in and `systemctl start` says there is no
such unit. What happened?**
The generator has not run. Files are read at boot and on `systemctl
daemon-reload`, so run `daemon-reload` — with `--user` for a rootless unit. Also
check you are starting `foo`, not `foo.container`: the source file generates
`foo.service`.

**Where do Quadlet files live, and why are there so many directories?**
Root: `/run/containers/systemd/` (transient), `/etc/containers/systemd/`
(administrator), `/usr/share/containers/systemd/` (distribution). Rootless:
`$XDG_RUNTIME_DIR/…`, `~/.config/containers/systemd/`, plus per-UID paths under
`/etc` and `/usr/share`. The split separates what you own from what your
distribution ships, so a package update cannot silently overwrite your work.

**Why is my container called `systemd-something`?**
Because `ContainerName=` defaults to `systemd-%N`. The prefix exists so
generated containers cannot collide with containers a user created by hand.

**Can you edit the generated unit file?**
You can, and it will be thrown away at the next boot or reload. Put `[Unit]`,
`[Service]` and `[Install]` settings in the `.container` file instead — Quadlet
passes those sections through to the generated unit.

---

← Prev: [Overview](README.md) · Index: [Phase 11](../README.md) · Next → [Writing the units](02-writing-the-units.md)
