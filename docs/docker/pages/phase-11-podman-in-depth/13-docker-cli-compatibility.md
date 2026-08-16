---
title: "Docker CLI compatibility"
sidebar_label: "13 · Docker CLI compatibility"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against [podman-system-service(1)](https://docs.podman.io/en/latest/markdown/podman-system-service.1.html),
> [podman(1)](https://docs.podman.io/en/latest/markdown/podman.1.html) and the
> [`podman-docker` wrapper script](https://github.com/containers/podman/blob/main/docker/docker.in)
> in containers/podman.
> **No sandbox** — no console output on this page.

"Podman is Docker-compatible" is three separate claims, and they hold to
different degrees. Sorting them out is the difference between a migration that
works and one that fails on the first tool you did not think about.

| Level | What it covers | How compatible |
|---|---|---|
| **Artefacts** | Images, registries, `Dockerfile` | Effectively total |
| **CLI** | `docker run …` on the command line | Very high, via an alias or a wrapper |
| **API** | Tools that talk to `/var/run/docker.sock` | Good, and pinned to **Docker v1.40** |

## The artefacts were never the problem

Images are OCI, registries are the same registries, and a `Dockerfile` is a
`Containerfile` under another name
([Phase 4 · 14](../phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md)).
Nothing in this page is about them — the compatibility work is entirely about
*programs that expect Docker*.

## Level 1 — the command line

The Podman CLI deliberately mirrors Docker's, so `podman run -d -p 8080:80 nginx`
is the same command with a different first word. Two ways to make the first word
not matter:

```bash
alias docker=podman        # interactive shells only
```

⚠️ **An alias is a shell feature, so it is invisible to everything that is not
your interactive shell** — a Makefile, a CI script, a Node `child_process` call,
a `#!/bin/sh` deploy script. This is the commonest reason "I aliased it and it
still says docker: command not found".

The real answer is the **`podman-docker`** package, which installs an actual
`/usr/bin/docker`. It is a short wrapper that ends in `exec podman "$@"` — and it
prints a notice first:

> "Emulate Docker CLI using podman. Create `/etc/containers/nodocker` to quiet
> msg."

🔴 **That line goes to stderr on every invocation**, which is enough to break a
test that asserts on empty stderr or a script that parses output. Silence it by
creating the file — and note the wrapper also accepts a **per-user** marker at
`$XDG_CONFIG_HOME/containers/nodocker` (i.e. `~/.config/containers/nodocker`), so
you do not need root to quieten it on your own account.

## Level 2 — the API socket

This is the one that matters, because the interesting tools do not shell out to
`docker`; they open its socket. Podman does not run a daemon
([Phase 11 · 01](01-daemonless/README.md)), so the socket is something you
switch on:

```bash
systemctl --user enable --now podman.socket        # rootless
sudo systemctl enable --now podman.socket          # rootful
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock
```

The documentation names the units (`podman.socket` and `podman.service`, in both
the user and system directories) and states the purpose of the variable
directly: "configure `DOCKER_HOST` environment variable to point to the Podman
socket so that it can be used via Docker API tools like docker-compose". The
socket paths are `unix:///run/podman/podman.sock` for root and
`unix://$XDG_RUNTIME_DIR/podman/podman.sock` rootless.

**Socket activation is the point.** `podman system service` started by hand exits
after its idle timeout — `--time` defaults to **5 seconds**, with 0 meaning no
timeout. Under `podman.socket`, systemd holds the socket and starts the service
on demand, so there is still no long-running daemon: the process appears when a
tool connects and goes away afterwards. That is the daemonless model surviving
contact with Docker-shaped tooling.

### What the compatibility layer actually is

"The REST API provided by `podman system service` is split into two parts: a
compatibility layer offering support for the **Docker v1.40 API**, and a
Podman-native **Libpod** layer."

Two things follow, and both are practical:

- **A tool that requires a newer Docker API version than v1.40 will not be
  satisfied by it.** Most are not that demanding — the API version is negotiated
  and the common operations are old — but when a tool fails with a version
  complaint rather than a functional error, this is why.
- **The Libpod layer is where pods, `kube play` and the rest live.** Anything
  Podman-specific is not reachable through the Docker-compatible half, by design.

### The security line, and it is not optional

> "We strongly recommend against making the API socket available via the network
> without enabling mutual TLS to authenticate the client."

Access to the socket is control of the engine. Rootless, that is control of your
account — bad. Rootful, it is root on the host — the same exposure
`/var/run/docker.sock` has always had
([Phase 0 · 11](../phase-0-what-a-container-is/11-rootless.md)). Prefer the
rootless socket, and do not put either one on a network without mutual TLS.

## What compatibility does not cover

The CLI accepting a flag is not the same as the flag doing the same thing.
[Phase 11 · 05](05-where-podman-bites/README.md) is the catalogue; the short
version of what to expect when you point Docker tooling at Podman:

- **Short image names** resolve differently and can prompt or fail in a
  non-interactive context.
- **Privileged ports** are refused rootless, so `-p 80:80` needs a decision
  ([Phase 7 · 09](../phase-7-networking/09-privileged-ports-rootless.md)).
- **File ownership through bind mounts** goes through the user-namespace map
  ([Phase 11 · 07](07-userns-modes.md)).
- **Log drivers differ** — Podman's default is `journald`, and `json-file` is an
  alias for `k8s-file`.
- **`docker compose` against `DOCKER_HOST`** works and is not the only option;
  the three programs sharing that name are sorted out in
  [Phase 8 · 15](../phase-8-compose/15-podman-compose.md).

## Gotchas

**Symptom:** `alias docker=podman` works in the terminal and fails in a script.
**Cause:** Aliases exist only in interactive shells. Scripts, Makefiles and
anything spawning `/bin/sh` never see it.
**Fix:** Install `podman-docker`, which puts a real `/usr/bin/docker` on the
path.

**Symptom:** Test output is polluted with an "Emulate Docker CLI using podman"
line, or a script that parses stderr breaks.
**Cause:** The `podman-docker` wrapper prints that notice unless a marker file
exists.
**Fix:** Create `/etc/containers/nodocker`, or `~/.config/containers/nodocker`
for just your account.

**Symptom:** A Docker API tool cannot connect, though `podman` works fine.
**Cause:** There is no daemon and no socket until you enable one — that is the
design, not a fault.
**Fix:** `systemctl --user enable --now podman.socket` and set `DOCKER_HOST` to
`unix://$XDG_RUNTIME_DIR/podman/podman.sock`.

**Symptom:** A tool connects, works for a while, then fails on something
specific.
**Cause:** It reached past the Docker v1.40 compatibility layer, or hit a
behavioural difference rather than an API one — Podman-native features are on the
Libpod layer, not the compatible one.
**Fix:** Check whether the operation is Podman-specific, and read the failure as
a difference rather than a bug.

## Interview questions

**★ What are the three levels of Docker compatibility in Podman?**
Artefacts, CLI and API. Images, registries and Dockerfiles are effectively
identical, so nothing needs doing there. The CLI mirrors Docker's, made
transparent with an alias or the `podman-docker` wrapper. The API is a socket you
enable, offering "a compatibility layer offering support for the Docker v1.40
API" alongside a Podman-native Libpod layer. Most migration surprises are
behavioural rather than any of these.

**★ Why is `alias docker=podman` not enough?**
Because an alias only exists in an interactive shell. Every Makefile, CI step and
script that spawns a non-interactive shell will still look for a `docker`
binary. The `podman-docker` package installs a real one — a wrapper that execs
podman — which is why it is the correct answer for anything automated.

**★ How do Docker API tools talk to Podman if there is no daemon?**
Through a socket-activated service. `podman.socket` is a systemd socket unit;
systemd holds the socket and starts `podman system service` on demand, so nothing
runs between connections — the service's own idle timeout defaults to five
seconds. Point `DOCKER_HOST` at the socket and Docker API tools work.

**Is exposing the Podman socket safe because Podman is rootless?**
Safer, not safe. Access to the socket is control of the engine: rootless that is
control of your account and everything it owns; rootful it is root on the host.
The documentation strongly recommends against exposing it over the network
without mutual TLS, and that applies to both.

**Why does the "Emulate Docker CLI using podman" message matter?**
It goes to stderr on every wrapped invocation, so it can break tests that assert
on clean stderr and scripts that parse output. Create `/etc/containers/nodocker`,
or the per-user equivalent under `~/.config/containers/`.

**Which Podman features are not reachable over the Docker-compatible API?**
The Podman-native ones — pods, `kube play`, Quadlet-adjacent behaviour — which
live on the Libpod layer instead. The compatibility layer implements Docker's
v1.40 API and nothing beyond it, which is a deliberate boundary rather than a
gap.

---

← Prev: [Buildah and Skopeo](12-buildah-and-skopeo.md) · Index: [Phase 11](README.md) · Next → [14 · Podman 6 breaking changes](14-podman-6-breaking-changes.md)
