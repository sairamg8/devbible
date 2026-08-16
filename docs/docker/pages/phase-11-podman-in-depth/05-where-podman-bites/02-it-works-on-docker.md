---
title: "It works on Docker"
sidebar_label: "02 · It works on Docker"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [containers-registries.conf(5)](https://github.com/containers/image/blob/main/docs/containers-registries.conf.5.md),
> [podman-run(1)](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
> [podman-system-service(1)](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html)
> and [Shortcomings of Rootless Podman](https://github.com/containers/podman/blob/main/rootless.md).
> **No sandbox** — no console output on this page.

[The previous chunk](01-it-ran-yesterday.md) covered things that stop working.
These are the ones that **never worked here**, usually discovered while porting a
Docker workflow, and they cluster into four areas: image names, DNS, Compose, and
the socket.

## Image names resolve differently, and that is a *config file*, not a bug

`docker pull nginx` works because Docker Hub is implied. Podman does not imply a
registry — resolution is governed by `containers-registries.conf`, and it has two
knobs that decide the behaviour:

- **`unqualified-search-registries`** is "an array of *host*[`:`*port*] registries
  to try when pulling an unqualified image, in order." Which registries are in
  that list is a **distribution decision**, so the same `podman pull nginx` can
  legitimately resolve differently on two machines.
- **`short-name-mode`** takes `enforcing`, `permissive` or `disabled`, and "if
  `short-name-mode` is not specified at all or left empty, default to the
  **`permissive`** mode."

🔴 **`enforcing` is where CI breaks, and the documentation explains exactly why.**
With more than one search registry and a program "running in a terminal (i.e.,
stdout & stdin are a TTY), prompt the user to select one of the specified search
registries. **If the program is not running in a terminal, the ambiguity cannot be
resolved which will lead to an error.**"

So the same command **prompts on a laptop and fails in a pipeline** — a genuinely
confusing bug report, and one you will never reproduce interactively.
`permissive` "behaves as enforcing but does not lead to an error if the program is
not running in a terminal. Instead, fallback to using all unqualified-search
registries", and `disabled` uses them all "without prompting".

**The fix is the same one [Quadlet's documentation recommends](../04-quadlet/02-writing-the-units.md):
fully qualified image names.** `registry.example.com/team/api:1.4.2` resolves
identically on every host, in every mode, in and out of a terminal. Short names
are a convenience for typing, not for files that are checked in.

⚠️ There is also an `[aliases]` table — "short-name aliases can be configured …
in the form of `"name"="value"`" — and "if a matching alias is found, it will be
used without further consulting the unqualified-search registries list." Useful,
and one more reason two machines disagree.

## DNS: a network you create behaves differently from the default

This one has cost more debugging hours than it deserves, and it is easy to state:

🔴 **Neither engine's *default* network resolves container names. A network you
create does** — and under Podman, `netavark` with `aardvark-dns` provides that
resolution ([Phase 7 · 12](../../phase-7-networking/12-netavark-and-aardvark.md)).
Podman's default network specifically does not do DNS, for Docker compatibility.

The practical rules:

- **Always create a network.** `podman network create` then attach; never rely on
  the default. This is true on Docker too
  ([Phase 7 · 01](../../phase-7-networking/01-default-vs-user-defined-bridge.md)),
  it is just more visible here.
- **The error messages name different components.** A `netavark` failure and an
  `aardvark-dns` failure are different layers, and knowing which is which is most
  of the diagnosis — [Phase 7 · 12](../../phase-7-networking/12-netavark-and-aardvark.md)
  splits them.
- **Rootless adds its own layer.** `rootlessport` "is a userspace proxy that does
  not preserve client source IPs", and with pasta "connections to that IP from
  containers do not work" because it "copies the IP address of the main
  interface" ([Phase 7 · 08](../../phase-7-networking/08-rootless-networking.md)).

## Compose is provided, not native

`docker compose` is a first-party plugin to a first-party engine. On Podman, three
different programs answer to the name — the `podman compose` wrapper, the separate
`podman-compose` Python project, and Docker's own Compose driven at a Podman
socket — and they do not behave identically
([Phase 8 · 15](../../phase-8-compose/15-podman-compose.md)).

What follows for a team:

- **Pin which one you mean** in the README and in CI. "Use Compose" is not an
  instruction on this engine.
- **Expect divergence at the edges**, not in the middle. Services, ports, volumes
  and healthchecks behave; the corners — `deploy`, some `develop.watch`
  behaviour, build features — are where they part.
- 🔴 **On a single production host, a Quadlet unit is the better target than
  making Compose work.** [Topic 04](../04-quadlet/README.md) gives you real
  systemd ordering against everything else on the machine, which is what you
  actually wanted from `depends_on`.

## The socket, for tools that demand a daemon

Testcontainers, IDE plugins and some CI runners speak the Docker API over a socket
and cannot be talked out of it. `podman system service` "creates a listening
service that answers API calls for Podman" and provides "a compatibility layer
offering support for the Docker v1.40 API" alongside the native Libpod API.

```bash
systemctl --user enable --now podman.socket
export DOCKER_HOST="unix://$XDG_RUNTIME_DIR/podman/podman.sock"
```

Three things bite here:

- **`DOCKER_HOST` must be set for the process that needs it** — a test runner
  launched by an IDE does not inherit your shell's environment.
- **The service is short-lived by default:** `--time` defaults to 5 seconds and
  "a value of `0` means no timeout". Socket activation handles that; a
  hand-started service may exit under you.
- ⚠️ **v1.40 compatibility is a compatibility layer, not the Docker daemon.** A
  tool reaching for a newer or unimplemented endpoint gets an error that looks
  like a Podman bug and is a scope boundary.

Detail in [Phase 11 · 13 · Docker CLI compatibility](../13-docker-cli-compatibility.md).

## The small divergences worth a note

These are individually minor and collectively responsible for a lot of confusion.
All are established elsewhere in the track:

| Divergence | Consequence |
|---|---|
| **`json-file` is an alias for `k8s-file`**, and the default driver is `journald` | A ported Docker logging config is accepted and does something else ([topic 01](../01-daemonless/02-restart-logs-and-systemctl.md)) |
| **Podman `--tmpfs` defaults to `rw,noexec,nosuid,nodev`** and `--read-only-tmpfs` defaults to true | A hardening posture differs from Docker's before you set anything ([Phase 10 · 10](../../phase-10-production/10-hardening/README.md)) |
| **`--tz` exists on Podman and not on Docker** | Cross-engine files must use `TZ` ([Phase 10 · 15](../../phase-10-production/15-time-and-timezones.md)) |
| **`podman network rm -f` removes the containers too** | More destructive than the Docker habit ([Phase 7 · 06](../../phase-7-networking/06-network-commands.md)) |
| **Podman `--volumes` on prune is broader**, covering named volumes | A prune script ported from Docker deletes more ([Phase 10 · 13](../../phase-10-production/13-disk-growth.md)) |

🔴 **The pattern across every row: the flag is accepted.** Podman's CLI
compatibility is good enough that a Docker command rarely errors — it runs, and
does the Podman thing. That is the real hazard of `alias docker=podman`, and the
reason to read this table before porting anything important.

## Gotchas

**Symptom:** `podman pull nginx` prompts locally and fails in CI.
**Cause:** `short-name-mode=enforcing` with more than one search registry — the
documentation says the ambiguity "cannot be resolved which will lead to an error"
when not on a TTY.
**Fix:** Fully qualified image names everywhere. Failing that, an `[aliases]`
entry, or `permissive` mode — but the qualified name is the real answer.

**Symptom:** Two machines pull different images for the same command.
**Cause:** Different `unqualified-search-registries`, or a short-name alias on
one of them.
**Fix:** Qualify the name. This is not a thing to standardise by configuring every
host identically.

**Symptom:** Containers cannot resolve each other by name.
**Cause:** They are on the default network, which does not provide DNS.
**Fix:** Create a network and attach both. Same rule on Docker; more visible here.

**Symptom:** Testcontainers reports it cannot find a Docker daemon, although
`podman ps` works.
**Cause:** No socket, or `DOCKER_HOST` not visible to the process that needs it.
**Fix:** Enable `podman.socket` for your user and set `DOCKER_HOST` where the test
runner will actually see it.

**Symptom:** A Docker command ran without error and did something unexpected.
**Cause:** One of the divergences above — the alias accepted it and applied
Podman's semantics.
**Fix:** Check the divergence table before assuming the two CLIs agree. Silence is
not agreement.

## Interview questions

**★ Why does the same `podman pull` work on a developer machine and fail in CI?**
Because of short-name resolution. With `short-name-mode=enforcing` and more than
one entry in `unqualified-search-registries`, Podman prompts on a TTY and errors
when there is no TTY — the documentation says the ambiguity "cannot be resolved
which will lead to an error". The fix is fully qualified image names, not a CI
workaround.

**★ Why can two containers not resolve each other by name?**
Because they are on the default network, which provides no DNS. Create a network
and attach them; under Podman that brings in `netavark` and `aardvark-dns`, whose
errors name different layers and are worth telling apart.

**★ What is the actual hazard of `alias docker=podman`?**
That it mostly works. Commands are accepted rather than rejected, so divergences
apply silently — `json-file` aliasing to `k8s-file`, a different `--tmpfs` default,
`network rm -f` also deleting containers, a broader `prune --volumes`. An error
would be safer than a silent difference.

**How do you make Testcontainers work with Podman?**
Enable the rootless `podman.socket` and point `DOCKER_HOST` at
`$XDG_RUNTIME_DIR/podman/podman.sock`. It serves a Docker v1.40 compatibility
layer alongside the native API, running as your user. Make sure the variable is
visible to the process that needs it, not just to your shell.

**Is Compose a solved problem on Podman?**
No, and it is worth saying plainly. Three different programs answer to the name
and diverge at the edges, so a team has to pin which one it means. On a single
production host, a Quadlet unit is usually the better target than making Compose
behave, because it gives real systemd ordering against the rest of the machine.

---

← Prev: [It ran yesterday](01-it-ran-yesterday.md) · Index: [Phase 11](../README.md) · Next → [06 · `podman unshare`](../06-podman-unshare.md)
