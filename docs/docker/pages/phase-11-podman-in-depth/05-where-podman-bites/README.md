---
title: "05 · Where Podman will bite you"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [podman-healthcheck-run(1)](https://docs.podman.io/en/latest/markdown/podman-healthcheck-run.1.html),
> [podman-system-service(1)](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html),
> [containers-registries.conf(5)](https://github.com/containers/image/blob/main/docs/containers-registries.conf.5.md),
> [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html),
> [logind.conf(5)](https://man7.org/linux/man-pages/man5/logind.conf.5.html)
> and [Shortcomings of Rootless Podman](https://github.com/containers/podman/blob/main/rootless.md).
> **No sandbox** — no console output on this page.

The syllabus row is *no daemon to apply restart policies while you are logged out
(`loginctl enable-linger`), healthchecks driven by timers, `netavark`/`aardvark-dns`
error messages, and Compose gaps.*

🔴 **This is a triage topic, not a mechanism topic** — Podman's answer to
[Phase 10 · 06 · The production failure catalogue](../../phase-10-production/06-failure-catalogue/README.md).
Everything in it is explained properly elsewhere in the phase; the value is
matching a symptom to a cause in seconds instead of an afternoon.

🔴 **The pattern that unifies almost every bite: the command is accepted.**
Podman rarely refuses a Docker habit — it runs it and applies Podman's semantics.
Silence is not agreement.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[It ran yesterday](01-it-ran-yesterday.md)** | The things that stop working: the logout-and-reboot family and why lingering plus a unit is one fix rather than three; `always` versus `unless-stopped` across a reboot; healthchecks whose status never changes because nothing fires them, and alerting on staleness; the failures that *succeed* — rootless limits on cgroups v1, absent rootless network stats; and the two-worlds problem, including why a rootless container in a crontab is the wrong shape |
| 02 | **[It works on Docker](02-it-works-on-docker.md)** | The things that never worked here: short-name resolution and the `enforcing` mode that prompts on a laptop and errors in CI; the default network having no DNS and which layer `netavark` versus `aardvark-dns` errors come from; Compose being three programs rather than one; `podman.socket` and `DOCKER_HOST` for tools that demand a daemon; and the table of small silent divergences |

## Four facts worth carrying out of this topic

- **"It died when I logged out" is `logind`, not Podman.** The fix is lingering
  plus a unit, and nothing else.
- **A health status that never changes is not evidence of health** on this engine.
  Alert on its age.
- **Short names resolve per host and per TTY.** Fully qualified image names remove
  a whole class of "works on my machine".
- **Podman accepts Docker commands and applies Podman semantics.** The divergences
  are silent by design.

## Phase gate

Given a Podman incident report — a service that vanished, a health status that
never moved, a pull that fails only in CI, a container that cannot resolve its
neighbour — you can name the cause and the page it is argued on without
reproducing it.

## Where this connects

- [01 · Daemonless](../01-daemonless/02-restart-logs-and-systemctl.md) — lingering,
  `podman-restart.service`, the log-driver default and the alias
- [02 · Rootless by default](../02-rootless-by-default/02-what-it-costs.md) — the
  documented shortcomings this topic triages
- [04 · Quadlet](../04-quadlet/README.md) — the fix for most of chunk 01
- [Phase 7 · 12 · netavark and aardvark-dns](../../phase-7-networking/12-netavark-and-aardvark.md)
  — which component owns which error
- [Phase 7 · 08 · Rootless networking](../../phase-7-networking/08-rootless-networking.md)
  — `rootlessport`, pasta, and the source-IP problem
- [Phase 8 · 15 · `podman compose` and `podman-compose`](../../phase-8-compose/15-podman-compose.md)
  — the three programs that share a name
- [Phase 10 · 06 · The production failure catalogue](../../phase-10-production/06-failure-catalogue/README.md)
  — the engine-neutral catalogue this one parallels
- [Phase 10 · 09 · Healthchecks in production](../../phase-10-production/09-healthchecks-in-production.md)
  — what a check is for, before the question of what fires it
- [13 · Docker CLI compatibility](../13-docker-cli-compatibility.md) — the
  socket and `DOCKER_HOST` in detail

---

Start → [01 · It ran yesterday](01-it-ran-yesterday.md)
