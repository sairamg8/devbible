---
title: "podman compose and podman-compose"
sidebar_label: "15 · podman compose"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [`podman-compose(1)`](https://docs.podman.io/en/latest/markdown/podman-compose.1.html),
> [`containers.conf(5)`](https://github.com/containers/common/blob/main/docs/containers.conf.5.md),
> the [containers/podman-compose README](https://github.com/containers/podman-compose),
> [the `docker compose` CLI reference](https://docs.docker.com/reference/cli/docker/compose/) and
> [the Compose Specification](https://compose-spec.io/).
> **No sandbox** — no console output on this page.

**`podman compose` is not a Compose implementation. It is a dispatcher that runs
somebody else's.** Three different programs share this name, and almost every
"does Compose work on Podman" argument is two people talking about two of them.

## The three things

| | What it is | Who wrote it |
|---|---|---|
| **`docker compose`** | The reference implementation of the Compose Specification, a Go plugin to the Docker CLI ([page 01](01-what-compose-is.md)) | Docker |
| **`podman compose`** (a space) | *"a thin wrapper around an external compose provider such as docker-compose or podman-compose"* — it runs one of the other two | Podman |
| **`podman-compose`** (a hyphen) | *"An implementation of Compose Spec with Podman backend"* — a Python script that executes `podman` directly | the containers project |

🔴 **The space-versus-hyphen distinction is load-bearing.** `podman compose up`
may well be running `docker-compose` under the hood, and that is the *documented
default*, not an accident.

## How the provider is chosen

The default providers are `docker-compose` and `podman-compose`, and when both
are installed **`docker-compose` wins** — the documentation's reason is that it
*"is the original implementation of the Compose specification and is widely used
on the supported platforms"*.

To decide for yourself, either edit `containers.conf(5)`:

```toml
[engine]
compose_providers = ["/usr/bin/podman-compose"]
compose_warning_logs = false
```

or set the environment variable:

```bash
export PODMAN_COMPOSE_PROVIDER=/usr/bin/podman-compose
export PODMAN_COMPOSE_WARNING_LOGS=false
```

By default the wrapper emits a warning saying that it executes an external
command; `compose_warning_logs` / `PODMAN_COMPOSE_WARNING_LOGS` silences it.
**Do not silence it before you have read it once** — it names the provider, which
is the single fact you need.

⚠️ **Pin the provider in any project a team shares.** Two developers on the same
`compose.yaml` can be running two different implementations with different
feature sets, and the failure mode is a key that works on one machine and is
ignored on the other.

## How the wrapper connects the provider to Podman

`podman compose` *"sets up the environment to let the compose provider
communicate transparently with the local Podman socket"*. That is the whole
trick: `docker-compose` speaks the Docker Engine API, and Podman offers a
compatible socket, so the wrapper points the provider at it and gets out of the
way.

The two providers therefore work in **fundamentally different ways**:

| | `docker-compose` over the Podman socket | `podman-compose` |
|---|---|---|
| How containers are created | API calls to the socket | forks and executes `podman` |
| Process model | client/server, as with a daemon | daemonless, the Podman model ([Phase 0, page 06](../phase-0-what-a-container-is/06-runtime-stack-podman.md)) |
| Build | sends the build context to the socket — the README's words are *"you lose the process-model (ex. `docker-compose build` will send a possibly large context tarball to the daemon)"* | `podman build`, directly |
| Compose coverage | the reference implementation, so everything | an independent implementation of the Spec |

Neither is wrong. The first gives you complete Compose behaviour at the cost of
routing everything through a socket; the second keeps Podman's daemonless model
at the cost of being a separate implementation you must verify against.

### Running `docker-compose` without the wrapper

Nothing stops you invoking `docker-compose` directly — you just have to do the
part `podman compose` was doing for you, which is telling it where the socket is:

```bash
systemctl --user enable --now podman.socket
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock
docker-compose up -d
```

> ⚠️ These two lines are the community-documented setup
> ([containers/podman discussion #10644](https://github.com/containers/podman/discussions/10644)),
> not text from the `podman compose` man page. The man page's own claim is only
> that the wrapper sets up that environment for you — which is the argument for
> using the wrapper rather than reproducing it by hand.

## What still differs, whichever provider you pick

Compose is a client. It cannot paper over the engine underneath, and these are
the divergences this track has already established — none of them are Compose
bugs:

- **Rootless means ports below 1024 are refused** unless the sysctl is lowered.
  A `"80:80"` mapping that works under Docker fails rootless
  ([Phase 0, page 11](../phase-0-what-a-container-is/11-rootless.md)).
- **Healthchecks are driven by systemd timers under Podman**, not by a daemon
  loop, so without a running systemd user session a check may simply never run —
  and "never marked unhealthy" is not the same as healthy
  ([page 06](06-healthchecks/README.md)).
- **There is no daemon to re-assert restart policies after a reboot.** Rootless
  Podman needs `loginctl enable-linger` plus Quadlet or
  `podman-restart.service`; a `restart: always` in the file is not enough
  ([Phase 1, page 12](../phase-1-running-containers/12-restart-policies.md)).
- **Short image names resolve through `unqualified-search-registries`**, so
  `image: postgres:18` can mean a different registry on a different machine.
  Fully qualify in any file that travels
  ([Phase 2, page 12](../phase-2-images-and-registries/12-podman-registries-conf.md)).
- **SELinux relabelling is a real concern on Fedora and RHEL** — bind mounts want
  `:z` or `:Z`, and the Compose long syntax has no shorthand for it
  ([page 08](08-volumes.md)).
- **File ownership under a user namespace** is the other rootless surprise: root
  inside the container is you outside it, and UID 1000 inside is something in the
  100000 range on the host.

**Podman in depth is Phase 11** *(not written yet)* — this page is the Compose
half only.

## Which to use

| If you… | Use |
|---|---|
| Want documented Compose behaviour, including `develop.watch` and `profiles` | `docker-compose` — as the provider under `podman compose`, or directly with `DOCKER_HOST` |
| Want to keep the daemonless model, no socket at all | `podman-compose` |
| Are writing a file other people will run on Docker | Target the Specification, and test on both |
| Are deploying to a Linux host you control | Consider not using Compose in production at all — Quadlet units are Podman's own answer *(Phase 11, not written yet)* |

**The practical default:** develop with whichever is installed, keep the file to
the Specification, and treat anything beyond it — `develop.watch`
([page 13](13-develop-watch.md)), `include`, `!reset` tags
([page 11](11-override-files.md)) — as something to confirm rather than assume.
`docker compose config` is the confirmation
([page 14](14-day-to-day-commands/02-getting-inside.md)): if the provider cannot
parse the file, that is where it says so.

## Gotchas

**Symptom:** `podman compose up` behaves exactly like Docker, and a colleague
insists Podman does not support some feature.
**Cause:** You are both right about different programs. Your `podman compose` is
dispatching to `docker-compose`; theirs is dispatching to `podman-compose`.
**Fix:** Read the warning line, or check `compose_providers` in
`containers.conf` and `PODMAN_COMPOSE_PROVIDER`. Pin it per project.

**Symptom:** A Compose key is silently ignored under Podman.
**Cause:** `podman-compose` is an independent implementation of the
Specification, so its coverage of any given key is its own.
**Fix:** Verify with `config` before relying on the key, or switch the provider
to `docker-compose` for that project. Do not conclude "Podman cannot do it" —
the engine is usually not the limitation.

**Symptom:** `"80:80"` fails rootless with a permissions error.
**Cause:** Rootless containers cannot bind privileged ports; this is a kernel
rule, not Compose.
**Fix:** Publish a high port (`"8080:80"`) and put a reverse proxy or a firewall
redirect in front — or lower `net.ipv4.ip_unprivileged_port_start` deliberately,
knowing what it opens up.

**Symptom:** `docker-compose` run directly cannot reach any engine.
**Cause:** No `DOCKER_HOST`, and the rootless Podman socket is not running.
**Fix:** Enable the user socket and export `DOCKER_HOST` — or just use
`podman compose`, whose entire job is doing that for you.

## Interview questions

**★ What actually happens when you run `podman compose up`?**
Podman does not implement Compose. `podman compose` is a thin wrapper that
selects an external provider — `docker-compose` or `podman-compose` — sets up the
environment so that provider can talk to the local Podman socket, and hands the
command over. When both are installed, `docker-compose` takes precedence, because
it is the original implementation of the Specification.

**★ What is the difference between `podman compose` and `podman-compose`?**
A space versus a hyphen, and they are different programs. `podman compose` is the
dispatcher shipped with Podman. `podman-compose` is a separate Python
implementation of the Compose Spec that executes `podman` directly and keeps the
daemonless process model. The dispatcher may well be running the *other* one,
`docker-compose`, which is what confuses the conversation.

**★ Name three things that behave differently under Podman regardless of the
Compose provider.**
Ports below 1024 are refused rootless. Healthchecks are driven by systemd timers
rather than by a daemon loop, so they can fail to run at all without a systemd
session. And there is no daemon to re-assert restart policies after a reboot, so
`restart: always` needs lingering plus Quadlet. Short-name image resolution is a
fourth: `postgres:18` can resolve to a different registry per machine.

**Why might `docker-compose build` be slower against Podman than `podman build`?**
Because over the socket it behaves like a client to a daemon and sends the build
context across — the podman-compose README's phrasing is that you lose the
process model, and `docker-compose build` "will send a possibly large context
tarball to the daemon". `podman-compose` forks and executes `podman build`
instead, with no transfer.

**How do you pin the provider, and why does it matter on a team?**
`compose_providers` in the `[engine]` table of `containers.conf`, or the
`PODMAN_COMPOSE_PROVIDER` environment variable. It matters because two
developers on one `compose.yaml` can otherwise be running two implementations
with different coverage — and the symptom is a key that works on one laptop and
is ignored on the other, which reads as a mystery rather than as a configuration
difference.

**Should a Compose file be portable between Docker and Podman?**
Aim for it, and buy the portability by staying on the Specification: fully
qualified image names, non-privileged published ports, healthchecks that do not
assume a daemon-driven loop, and no reliance on extensions you have not verified
on both. The parts that will not port are engine-level, not file-level, which is
why the fix is usually in how the stack is deployed rather than in the YAML.

---

← Prev: [Day-to-day commands](14-day-to-day-commands/README.md) · Index: [Phase 8](README.md) · Next → [`include` and `extends`](16-include-and-extends.md)
