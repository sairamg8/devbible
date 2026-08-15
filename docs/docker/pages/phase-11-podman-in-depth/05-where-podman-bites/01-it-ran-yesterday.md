---
title: "It ran yesterday"
sidebar_label: "01 · It ran yesterday"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [podman-healthcheck-run(1)](https://docs.podman.io/en/latest/markdown/podman-healthcheck-run.1.html),
> [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html),
> [logind.conf(5)](https://man7.org/linux/man-pages/man5/logind.conf.5.html),
> [podman-systemd.unit(5)](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
> and [Shortcomings of Rootless Podman](https://github.com/containers/podman/blob/main/rootless.md).
> **No sandbox** — no console output on this page.

This topic is Podman's version of
[Phase 10 · 06 · The production failure catalogue](../../phase-10-production/06-failure-catalogue/README.md):
a triage list, not new mechanism. **Everything here is explained somewhere else in
the phase — the value is recognising the symptom fast.**

This chunk covers the bites where **something that worked stops working over
time**. [The next one](02-it-works-on-docker.md) covers the ones where something
that works on Docker never worked here.

## The triage table

| Symptom | It is | Where the fix is |
|---|---|---|
| Container dies when you log out | `logind` killing the session scope | [Lingering](#the-logout-and-reboot-family) |
| Nothing comes back after a reboot | No daemon re-asserts policies | [Lingering](#the-logout-and-reboot-family) |
| `--restart=always` brought back something you stopped | Documented policy difference | [Restart](#the-logout-and-reboot-family) |
| Health status never changes | Nothing is firing the check | [Healthchecks](#healthchecks-that-never-run) |
| Memory limit ignored | cgroups v1 | [Limits](#limits-and-accounting-that-quietly-do-nothing) |
| `podman stats` shows no network figures | Rootless networking | [Limits](#limits-and-accounting-that-quietly-do-nothing) |
| Worked as you, fails under `sudo` | Per-user store | [Two worlds](#the-two-worlds-problem) |
| Disk full but the system disk is fine | Store lives in `$HOME` | [Two worlds](#the-two-worlds-problem) |

## The logout-and-reboot family

🔴 **This is the single biggest source of "Podman is unreliable" reports, and none
of it is Podman.**

`logind.conf(5)` documents `KillUserProcesses=` — "if true, the scope unit
corresponding to the session and all processes inside that scope will be
terminated" — with a documented default of `yes`. Your container started inside
your login session's scope. You log out. It is terminated.

The reboot half is the daemonless consequence from
[topic 01](../01-daemonless/02-restart-logs-and-systemctl.md): there is no daemon
to re-assert restart policies at boot, so "Podman provides a systemd unit file,
`podman-restart.service`, which restarts containers after a system reboot" —
and it must be enabled.

⚠️ **The restart policies also differ from Docker's across a reboot**, and the
difference goes the surprising way: `unless-stopped` containers are restarted by
`podman-restart.service` "only if they were not explicitly stopped by the user
before the reboot", which "differs from **always**, which restarts containers
after a system reboot regardless of whether they were user-stopped". So `always`
resurrects something you deliberately stopped.

**The fix is one thing, not three:**

```bash
loginctl enable-linger "$USER"     # a user manager at boot, kept after logout
```

then run the service as a [Quadlet unit](../04-quadlet/README.md) rather than a
process you left in a shell. Lingering alone rescues a container you started by
hand; lingering plus a unit is the actual answer, and it is the phase gate.

## Healthchecks that never run

Under Docker the daemon polls. Under Podman something outside the engine has to
fire each check — `podman-run(1)` refers to it only as "automatic timer setup",
which `--health-interval disable` turns off.

⚠️ **The reference does not name what provides that timer**, so do not assert a
mechanism you cannot cite. What matters operationally is the failure shape:

🔴 **On a host where nothing is firing the checks, the status simply never
changes** — and "never marked unhealthy" reads exactly like "healthy" on every
dashboard you own. Under Docker a stuck status means the check passed; here it may
mean nothing ran.

Two habits close it:

- **`podman healthcheck run <container>`** "runs the healthcheck command defined
  in a running container manually" — the honest way to confirm a check works at
  all, independent of scheduling.
- **Alert on staleness, not just on `unhealthy`.** A health status whose timestamp
  has not moved is the signal; the state alone is not.

⚠️ And when the container is under a unit, `--health-on-failure` should use `kill`
or `stop` rather than `restart`: the documentation says "do not combine the
`restart` action with the `--restart` flag. When running inside of a systemd unit,
consider using the `kill` or `stop` action instead to make use of systemd's
restart policy." One supervisor, again
([Phase 10 · 07](../../phase-10-production/07-restart-as-supervision.md)).

## Limits and accounting that quietly do nothing

The worst failures are the ones that succeed. Two of them here:

- 🔴 **Rootless resource limits need cgroups v2.** "No support for setting
  resource limits on systems using cgroups v1" — and the flag is *accepted*, so
  a `--memory` that is never enforced looks identical to one that is until the
  host runs out of memory. Podman 6 removing cgroups v1 support is partly this
  problem being retired.
- **`podman stats --interval` defaults to 5 seconds**, and "rootless environments
  are not able to report statistics about their networking usage" — so a rootless
  container's network counters are absent rather than zero. Do not build a
  dashboard panel that reads them as traffic.

Both are [topic 02 · What rootless costs](../02-rootless-by-default/02-what-it-costs.md)
in production clothing, and both are worth checking *before* an incident rather
than during one.

## The two-worlds problem

Everything is per user ([topic 01](../01-daemonless/01-what-runs-instead.md)), and
the symptoms are all the same root cause wearing different clothes:

- **`sudo podman …` cannot find your image.** Different store, not a permission
  problem.
- **A cron job or CI runner sees none of your containers.** It is a different
  user, or the same user with no `$XDG_RUNTIME_DIR` because there is no session.
- **The disk fills in `$HOME`**, not on `/var`. Quotas and small home partitions
  become pull failures.
- **Images cannot be shared** — the shortcomings list says so outright: "container
  images cannot easily be shared with other users" and it is "difficult to use
  additional stores for sharing content".

⚠️ **The cron case is the one that costs a day.** A rootless Podman command in a
crontab often runs without the user manager or runtime directory it expects. Run
it as a systemd **timer unit** under the lingering user manager instead — same
user, same environment, and the same supervision as everything else.

## Gotchas

**Symptom:** Everything works interactively and nothing works from cron.
**Cause:** No user session, so no `$XDG_RUNTIME_DIR` and no user manager.
**Fix:** `loginctl enable-linger`, then a systemd timer unit under that user
manager rather than a crontab line.

**Symptom:** A service was fine for weeks, then vanished after a reboot.
**Cause:** It was a container started by hand in a session, kept alive only
because nobody logged out. The reboot removed the accident.
**Fix:** Quadlet unit plus lingering. If it matters after a reboot, it has to be
a unit.

**Symptom:** A dashboard shows every container healthy and one is serving errors.
**Cause:** The health status never changed because nothing fired the check.
**Fix:** Test with `podman healthcheck run`, and alert on the *age* of the health
status rather than only its value.

**Symptom:** `--memory=512m` had no effect at all.
**Cause:** Rootless on a cgroups v1 host — unsupported, and the flag is still
accepted.
**Fix:** Check the cgroup version before trusting any limit. On v1, rootless
limits are decoration.

## Interview questions

**★ A rootless Podman service disappears after a reboot. Walk through the
diagnosis.**
First, was it a unit or a process someone left running? A process in a session
dies at logout because `logind` terminates the session scope. Second, does that
user have lingering enabled — without it the user manager does not start at boot.
Third, was `podman-restart.service` enabled, since no daemon re-asserts restart
policies. The real fix is a Quadlet unit plus `loginctl enable-linger`.

**★ Why is "no container has ever been marked unhealthy" a warning sign on
Podman?**
Because there is no daemon polling. The engine sets up a timer — an interval of
`disable` "results in no automatic timer setup" — but on a host where nothing
fires the checks, the status never changes, which is indistinguishable from
healthy. Test with `podman healthcheck run` and alert on the status's age.

**★ Which Podman failures succeed silently?**
Rootless resource limits on cgroups v1 — unsupported, but the flag is accepted.
Rootless network statistics — absent rather than zero. And `--log-driver
json-file`, which is an alias for `k8s-file`. All three run clean and do something
other than what was intended.

**Why does `sudo podman ps` show nothing of yours?**
Different store. Root reads `/var/lib/containers/storage`, you read
`$HOME/.local/share/containers/storage`. Elevating switches worlds rather than
widening a view.

**What is the right way to run a rootless container from cron?**
Don't. Use a systemd timer unit under the user's lingering user manager, so it
runs with the same runtime directory, environment and supervision as the rest of
that user's services.

---

← Prev: [Overview](README.md) · Index: [Phase 11](../README.md) · Next → [It works on Docker](02-it-works-on-docker.md)
