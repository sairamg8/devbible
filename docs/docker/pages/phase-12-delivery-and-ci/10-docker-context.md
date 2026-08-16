---
title: "docker context"
sidebar_label: "10 · docker context"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [docker context](https://docs.docker.com/reference/cli/docker/context/),
> [docker context create](https://docs.docker.com/reference/cli/docker/context/create/)
> and [podman-system-connection(1)](https://docs.podman.io/en/latest/markdown/podman-system-connection.1.html).
> **No sandbox** — no console output on this page.

`docker context` "manage[s] contexts", and creating one "lets you switch the
daemon your `docker` CLI connects to". It turns "run this on the server" into
"run this, with the CLI pointed somewhere else".

**Which makes it genuinely useful and genuinely dangerous, for the same reason:
nothing about the command you type changes.**

## The commands

| | |
|---|---|
| `create` | "Create a context" — `--docker host=…` sets the endpoint; `--from` creates it "from a named context", defaulting to the current one |
| `use` | "Set the default docker context" |
| `ls` | "List contexts" |
| `show` | **"Print the name of the current context"** — the one to put in your prompt |
| `inspect` | "Display detailed information on one or more contexts" |
| `update` / `rm` | Change or remove one |
| `export` / `import` | A context as a tar archive, for sharing a setup |

```bash
docker context create --docker host=unix:///var/run/docker.sock my-context
docker context use my-context
docker ps                      # whichever engine my-context points at
```

⚠️ **The reference's examples all use a local socket** — remote endpoints are the
obvious use and the page does not spell one out, so check your platform's own
documentation for the endpoint scheme rather than copying one from memory.

## The foot-gun

🔴 **`docker context use` is persistent and invisible.** It changes the default
for every subsequent command in every shell, and the commands look identical
afterwards. `docker compose down`, typed out of habit, does what it says — on
production.

The defences, in order of how much they help:

1. **Put `docker context show` in your shell prompt.** If the current context is
   on screen at all times, the whole class of mistake mostly disappears.
2. **Prefer per-command over persistent.** `docker --context prod ps` affects one
   command; `docker context use prod` affects everything until you remember to
   change it back.
3. **Never point a context at production from a developer machine at all.**
   Deployment belongs in a pipeline that has its own credentials and leaves a
   record ([topic 04](04-registry-auth-in-ci.md)). A context makes a manual
   production change *easy*, which is not the same as making it *good*.

⚠️ **A remote context is remote-control access to a container engine.** Whoever
holds it can run anything on that host — [Phase 11 · 13](../phase-11-podman-in-depth/13-docker-cli-compatibility.md)
makes the same point about the API socket, and it applies exactly as much here.

## Where it earns its place

- **Reading production, not writing it.** `--context prod logs` and `ps` are
  legitimately convenient during an incident, and read-only habits are much safer
  than deploy-from-laptop habits.
- **Multiple local engines.** A `podman machine`, a remote build host, a VM — one
  CLI, several endpoints, no environment-variable juggling.
- **A shared build machine.** Point a context at a beefier host and build there
  while the source stays local.
- **Sharing a setup.** `export`/`import` moves a context definition between
  machines without everyone hand-writing endpoints.

## Podman's version

Podman calls it **`podman system connection`** — "manage the destination(s) for
Podman service(s)" — with `add` ("record destination for the Podman service"),
`default` ("set named destination as default"), `list`, `remove` and `rename`.
Same idea, different noun, and it is what makes `podman --remote` and the
macOS/Windows machine work at all ([Phase 11 · 15](../phase-11-podman-in-depth/15-podman-machine.md)).

⚠️ **The two are not the same registry of endpoints.** A `docker context` is not
visible to `podman`, and vice versa — the credential-file asymmetry from
[topic 04](04-registry-auth-in-ci.md) has a sibling here. Setting `DOCKER_HOST`
is the portable way to point either CLI at a socket for one command.

## Gotchas

**Symptom:** A command intended for your laptop ran on a server.
**Cause:** `docker context use` is persistent, and nothing in the command line
shows which context is active.
**Fix:** `docker context show` in your prompt, and prefer `--context` per command
over switching the default. Then think about whether that context should exist on
a laptop at all.

**Symptom:** `docker ps` shows nothing after switching contexts.
**Cause:** The remote endpoint is unreachable, or you are pointed at an engine
that genuinely has nothing running.
**Fix:** `docker context inspect` to see the endpoint, and check connectivity to
it before assuming the containers are gone.

**Symptom:** A `docker context` set up for a colleague does not work on their
machine.
**Cause:** The endpoint depends on local access — an SSH key, a socket path, a
VPN — that the context definition does not carry.
**Fix:** `export`/`import` moves the definition; the access still has to exist
independently. A context is a pointer, not a credential.

**Symptom:** `podman` cannot see a context that `docker` uses.
**Cause:** They keep separate lists — Podman's equivalent is
`podman system connection`.
**Fix:** Configure the connection on the Podman side, or set `DOCKER_HOST` for
the single command.

## Interview questions

**★ What is `docker context` for?**
Switching the daemon your CLI talks to. A context bundles an endpoint under a
name, so `docker --context prod ps` or `docker context use prod` runs the same
commands against another engine — a remote host, a VM, a build machine — with no
change to the commands themselves.

**★ Why is it dangerous?**
Because `use` is persistent and invisible: it changes the default for every
subsequent command, and the commands look identical afterwards. A destructive
command typed from habit runs wherever the context points. Keep `docker context
show` in your prompt, prefer per-command `--context`, and question whether a
production context belongs on a laptop rather than in a pipeline.

**When would you use one legitimately?**
Reading a production system during an incident, driving several local engines
from one CLI, or building on a larger remote host while the source stays local.
Deployment is better done by a pipeline with its own credentials and an audit
trail — a context makes manual production changes easy, not good.

**What is the Podman equivalent?**
`podman system connection`, with `add`, `default`, `list`, `remove` and `rename`.
Same concept, separate list — a `docker context` is invisible to Podman and vice
versa. `DOCKER_HOST` is the portable one-command way to point either at a socket.

**Does exporting a context give someone access?**
No. It moves the pointer, not the credential — the SSH key, socket permission or
network path still has to exist on the other machine. Which is also the reason a
context that *does* work is exactly as sensitive as the engine it points at.

---

← Prev: [Rolling updates and rollback by hand](09-rolling-updates-by-hand.md) · Index: [Phase 12](README.md) · Next → [11 · Cost realities](11-cost-realities.md)
