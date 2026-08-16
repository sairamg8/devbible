---
title: "04 · Quadlet"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html),
> [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html).
> **No sandbox** — no console output on this page.

The syllabus row is *`.container`, `.volume`, `.network`, `.pod`, `.kube` and
`.build` units that a systemd generator turns into services — the supported way
to run containers as system services.*

🔴 **Quadlet is a systemd generator.** You write a declaration; it produces an
ordinary systemd unit at boot and at `daemon-reload`. Every question about
Quadlet — why the unit does not exist, why your edit vanished, why the container
has a different name — answers itself once that sentence is in place.

This is where [Phase 10 · 14](../../phase-10-production/14-under-systemd.md)'s
"on Podman you should not be hand-writing the unit at all" gets cashed.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What Quadlet is](01-what-quadlet-is.md)** | The generator model and its three consequences; the eight unit types including the underrated `.image`; every search path for root and rootless, and why `/usr/share/…` is not yours; `foo.container` → `foo.service` → container `systemd-foo`; why editing the generated unit works right up until it doesn't; and the table of what a hand-written `docker run` unit gets wrong |
| 02 | **[Writing the units](02-writing-the-units.md)** | An annotated `.container` file; the dependency trick — referencing `foo.volume` generates a real systemd dependency while referencing plain `foo` does not; `Restart=`, the documented `TimeoutStartSec=900` and why the image pull demands it; `WantedBy=default.target`; the two mandatory rootless steps; declaring a pod; and debugging, which is now an ordinary systemd problem |

## Four facts worth carrying out of this topic

- **Files are read at boot and at `systemctl daemon-reload`, and nowhere else.**
  A new `.container` file does not exist until you reload.
- **`foo.container` generates `foo.service`.** You never `systemctl start
  foo.container`, and the container itself defaults to `systemd-foo`.
- **Referencing `data.volume` creates a dependency; referencing `data` does
  not.** One suffix, entirely different behaviour.
- **Rootless needs lingering and `WantedBy=default.target`.** Neither is
  optional, and both fail silently until a reboot.

## Phase gate

You can write a `.container` unit for a real service — image, ports, a volume
unit it depends on, health, readiness and restart — enable it rootless so it
survives a reboot, and explain what the generator produced and when.

## Where this connects

- [Phase 10 · 14 · Running containers under systemd](../../phase-10-production/14-under-systemd.md)
  — the hand-written unit this replaces, and why a `docker run` unit supervises
  the wrong process
- [Phase 10 · 07 · Restart policies as supervision](../../phase-10-production/07-restart-as-supervision.md)
  — one supervisor, never two
- [Phase 10 · 09 · Healthchecks in production](../../phase-10-production/09-healthchecks-in-production.md)
  — what `HealthCmd=` is for, and what readiness means
- [01 · Daemonless](../01-daemonless/02-restart-logs-and-systemctl.md) — lingering,
  `journald` and `--sdnotify`, all of which land here
- [02 · Rootless by default](../02-rootless-by-default/02-what-it-costs.md) — the
  rootless caveats that still apply inside a unit
- [03 · Pods](../03-pods.md) — declared as a `.pod` unit, with ports on the pod
- [Phase 8 · 05 · `depends_on`](../../phase-8-compose/05-depends-on.md) — the
  Compose ordering this replaces with systemd's own
- [09 · Quadlet vs `podman generate systemd`](../09-quadlet-vs-generate-systemd.md)
  — why the old command is not the answer
- [10 · `podman auto-update`](../10-auto-update.md) — what `AutoUpdate=registry`
  turns on

---

Start → [01 · What Quadlet is](01-what-quadlet-is.md)
