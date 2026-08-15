---
title: "Writing the units"
sidebar_label: "02 · Writing the units"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman-systemd.unit(5) — Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html),
> [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
> and [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html).
> **No sandbox** — no console output on this page.

[The previous chunk](01-what-quadlet-is.md) established the model. This one is
the file itself, the dependency trick that is Quadlet's best feature, and the
rootless details that decide whether any of it survives a reboot.

## A `.container` file, annotated

```ini
[Unit]
Description=Orders API
After=network-online.target

[Container]
Image=registry.example.com/orders/api:1.4.2
ContainerName=orders-api
PublishPort=8080:8080
Volume=orders-data.volume:/var/lib/orders
Network=orders.network
Environment=NODE_ENV=production
EnvironmentFile=/etc/orders/api.env
Secret=orders-db-password,type=env,target=DB_PASSWORD
User=10001:10001
HealthCmd=/usr/bin/curl -fsS http://localhost:8080/healthz
Notify=true
AutoUpdate=registry

[Service]
Restart=on-failure
TimeoutStartSec=900

[Install]
WantedBy=default.target
```

The keys that carry weight:

- **`Image=`** is required, and the documentation is explicit that "it is
  recommended to use a **fully qualified image name** rather than a short name" —
  short names resolve through registry search order, which is a different answer
  on a different host.
- **`Exec=`** appends arguments, with "exactly the same effect as passing more
  arguments after a `podman run <image> <arguments>` invocation". It is the
  container's command, not a shell line.
- **`ContainerName=`** defaults to `systemd-%N`; set it when something else
  addresses this container by name.
- **`PublishPort=`**, **`Volume=`**, **`Network=`**, **`Environment=`**,
  **`Secret=`**, **`User=`** map onto the `podman run` flags you already know
  from [Phase 1](../../phase-1-running-containers/01-docker-run-anatomy.md), and
  most may be listed more than once.
- **`Notify=true`** wires up `--sdnotify` so the application reports readiness to
  systemd — the signal path Docker has no equivalent for
  ([topic 01](../01-daemonless/02-restart-logs-and-systemctl.md)).
- **`AutoUpdate=registry`** marks the container for `podman auto-update`
  (**Phase 11 · 10** *(not written yet)*).

## The dependency trick

This is the feature that justifies the whole design. When a unit **references
another Quadlet unit by name** — `Volume=orders-data.volume`,
`Network=orders.network`, `Pod=stack.pod` — "the generated systemd service
contains a dependency on the" corresponding service unit.

So given three files:

```ini
# orders-data.volume
[Volume]
```

```ini
# orders.network
[Network]
```

```ini
# orders-api.container
[Container]
Image=registry.example.com/orders/api:1.4.2
Volume=orders-data.volume:/var/lib/orders
Network=orders.network
```

…you have declared, and systemd will enforce, that the volume and the network
exist before the API starts. **You wrote no ordering.**

🔴 **Compare that with `depends_on` in Compose**
([Phase 8 · 05](../../phase-8-compose/05-depends-on.md)): Compose's ordering is
Compose's, understood only by Compose. Quadlet's ordering is systemd's, and it
composes with everything else on the machine — a mount unit, a VPN, a database
that is not in a container at all.

⚠️ **Reference the unit, not the resource.** `Volume=orders-data:/var/lib/orders`
uses a plain named volume and creates **no dependency**;
`Volume=orders-data.volume:/var/lib/orders` references the unit and does. One
character of difference, entirely different behaviour.

## `[Service]` and `[Install]`, which are yours

Quadlet passes these sections through, and two settings deserve to be deliberate:

- **`Restart=`** defaults to `no` in systemd
  ([`systemd.service(5)`](https://man7.org/linux/man-pages/man5/systemd.service.5.html)),
  so a unit without it supervises nothing. `on-failure` or `always`, with a
  `RestartSec=` above the default 100 ms, is the honest pair.
- 🔴 **`TimeoutStartSec=900` is the documented recommendation**, and the reason is
  the image pull: a first start on a cold host may pull hundreds of megabytes,
  and the systemd default is far too short for that. This is the single most
  common "my Quadlet unit times out on a new machine" cause.
- **`WantedBy=default.target`** is what makes it start at boot. Without an
  `[Install]` section there is nothing to `systemctl enable`.

⚠️ **Do not also set a Podman restart policy.** [Phase 10 ·
14](../../phase-10-production/14-under-systemd.md) quotes Docker's rule — do not
combine an engine restart policy with a host process manager — and it applies
identically here. Under Quadlet, systemd is the supervisor. Full stop.

## Rootless: two extra steps, both mandatory

Everything above works rootless, in `~/.config/containers/systemd/`, with
`systemctl --user`. Two things are easy to forget and both produce "it works
until it doesn't":

1. **`loginctl enable-linger $USER`.** Without it the user manager stops at
   logout, taking every unit with it — the session-scope mechanism from
   [topic 01](../01-daemonless/02-restart-logs-and-systemctl.md). A rootless
   Quadlet service without lingering does not survive a reboot no matter how
   correct the unit is.
2. **`WantedBy=default.target`**, not `multi-user.target`. `default.target` is
   the user manager's target; `multi-user.target` is the system's and means
   nothing to `systemctl --user`.

Beyond that, the rootless caveats are the phase's usual ones: no ports below
1024, and — per Podman's own shortcomings list — "some systemd unit configuration
options do not work in the rootless container"
([topic 02](../02-rootless-by-default/02-what-it-costs.md)).

## A pod, declared

```ini
# stack.pod
[Pod]
PublishPort=8080:8080
```

```ini
# api.container
[Container]
Image=registry.example.com/orders/api:1.4.2
Pod=stack.pod
```

Ports are published by the **pod**, never by a member ([topic 03](../03-pods.md)),
and `Pod=` creates the dependency so the pod exists first. That is the Quadlet
expression of the pod model, and it is markedly cleaner than the equivalent shell
script.

## Debugging: it is a systemd problem now

Once generation succeeds, every tool is the ordinary one — which is the payoff:

- **`systemctl --user daemon-reload`** after every file change. Always first.
- **`systemctl status foo`** and **`journalctl -u foo`** — the container's logs
  are there too, because Podman's default log driver is `journald`
  ([topic 01](../01-daemonless/02-restart-logs-and-systemctl.md)).
- **`systemctl list-dependencies foo`** to confirm the volume and network units
  really were derived.
- **A generation error shows up as a missing unit**, not as an error message in
  the service — because the generator ran before there was any service to log to.
  When `daemon-reload` leaves you with no unit, the file is wrong.

## Gotchas

**Symptom:** The unit works, but after a reboot the container is gone and
`systemctl --user status` says the manager is not running.
**Cause:** No lingering for that user, so the user manager does not start at
boot.
**Fix:** `loginctl enable-linger $USER`. The unit was never the problem.

**Symptom:** `systemctl --user enable foo` reports the unit has no install
information.
**Cause:** No `[Install]` section in the `.container` file.
**Fix:** Add `[Install]` with `WantedBy=default.target` — and note that a *user*
unit wants `default.target`, not `multi-user.target`.

**Symptom:** The unit times out on first start on a new machine, and works
afterwards.
**Cause:** The image pull exceeded the start timeout.
**Fix:** `TimeoutStartSec=900`, as the documentation recommends — or make the
image an `.image` unit the container depends on, so the pull is a separate step.

**Symptom:** The volume unit exists but the container starts before it and fails.
**Cause:** The container referenced the plain volume name, not the unit
(`Volume=data:/path` rather than `Volume=data.volume:/path`), so no dependency
was generated.
**Fix:** Reference the unit. The `.volume` suffix is what creates the ordering.

**Symptom:** The container is restarted twice after a failure, or comes back
after `systemctl stop`.
**Cause:** A Podman restart policy and systemd both supervising it.
**Fix:** One supervisor. Under Quadlet that is systemd — set `Restart=` in
`[Service]` and no restart policy on the container.

## Interview questions

**★ How does Quadlet know a container needs its volume started first?**
By the reference. If a `.container` file names another Quadlet unit — a
`.volume`, `.network` or `.pod` — the generated service contains a dependency on
that unit's service. The trap is that referencing the *plain* volume name instead
of the `.volume` unit creates no dependency at all.

**★ Why is `TimeoutStartSec=900` in the documented example?**
Because a first start on a cold host includes the image pull, which can easily
exceed systemd's default start timeout. Without it, a unit that is perfectly
correct fails on every new machine and succeeds on every machine that has already
pulled the image.

**★ What two things does a rootless Quadlet service need that a root one does
not?**
`loginctl enable-linger` for the user, so the user manager runs at boot and
survives logout; and `WantedBy=default.target` rather than `multi-user.target`,
because it is a user unit. Without the first it does not survive a reboot; without
the second it cannot be enabled meaningfully.

**How do Quadlet dependencies compare with Compose's `depends_on`?**
`depends_on` is understood only by Compose and orders only Compose services.
Quadlet's dependencies are ordinary systemd dependencies, so they compose with
mount units, network targets, VPNs and services that are not containers at all.
That is the reason to reach for Quadlet on a single production host.

**Do you still set a Podman restart policy under Quadlet?**
No. Two supervisors with two opinions is the failure Docker's documentation warns
about, and it applies unchanged here. `Restart=` in the unit's `[Service]`
section, nothing on the container.

**What does `Notify=true` buy you?**
It wires up `--sdnotify` so the application inside the container can report
readiness to the systemd unit outside it — so `systemctl start` returning means
the service is actually serving, not merely that a process was forked. Docker has
no equivalent path for that signal.

---

← Prev: [What Quadlet is](01-what-quadlet-is.md) · Index: [Phase 11](../README.md) · Next → [05 · Where Podman will bite you](../05-where-podman-bites/README.md)
