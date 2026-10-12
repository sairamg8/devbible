---
title: "The services block"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `services` top-level element](https://docs.docker.com/reference/compose-file/services/),
> [the `build` section](https://docs.docker.com/reference/compose-file/build/) and
> [the Compose application model](https://docs.docker.com/compose/intro/compose-application-model/).
> **No sandbox** — no console output on this page.

**Almost every key in a service is a `docker run` flag with a nicer name — but a
handful are not, and those are where the surprises live.** This topic is the
working vocabulary: what runs, and how it is wired up.

A service is "an abstract concept implemented on platforms by running the same
container image, and configuration, one or more times". Everything below describes
that image and that configuration.

| Chunk | What it covers |
|---|---|
| **[01 · What runs: `image`, `build`, `command`, `entrypoint`](01-what-runs.md)** | Where the image comes from, `build` and its sub-keys, `pull_policy` when both are set, and the override rules for the command — including the one that silently discards your `CMD` |
| **[02 · How it is wired: `environment`, `ports`, `volumes`, `restart`](02-how-it-is-wired.md)** | `environment` versus `env_file` and their precedence, port publishing and its long syntax, the two kinds of `volumes` entry, and the four restart policies |

## The service keys at a glance

| Key | One line |
|---|---|
| `image` | The image to run, or the name to give one you build |
| `build` | Build from source instead of (or as well as) pulling |
| `command` | Overrides the image's `CMD` |
| `entrypoint` | Overrides the image's `ENTRYPOINT` — **and discards its `CMD`** |
| `environment` | Environment variables, map or list form |
| `env_file` | Files of environment variables, overridden by `environment` |
| `ports` | Publish to the host. Not needed between services |
| `volumes` | Named volumes, bind mounts and tmpfs |
| `restart` | `no` · `always` · `on-failure[:n]` · `unless-stopped` |
| `depends_on` | Start order, and optionally readiness ([page 05](../05-depends-on.md)) |
| `healthcheck` | What "ready" means ([page 06](../06-healthchecks/README.md)) |
| `networks` | Which networks to attach to ([page 07](../07-networks.md)) |

## Where this connects

- **[Phase 3 — The Dockerfile](../../phase-3-dockerfile/README.md)** defines what
  `command` and `entrypoint` are overriding. The four-combination table in
  [CMD versus ENTRYPOINT](../../phase-3-dockerfile/05-cmd-vs-entrypoint.md) is the
  prerequisite for chunk 01.
- **[Phase 1 — Running containers](../../phase-1-running-containers/README.md)** is
  the same set of decisions as flags: `-e`, `-p`, `-v`, `--restart`.
- **[03 · up and down](../03-up-and-down/README.md)** is what applies a change to
  any of these keys — `up -d`, never `restart`.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [Services top-level element](https://docs.docker.com/reference/compose-file/services/) — docs.docker.com: every attribute (`image`, `build`, `command`, `environment`, `ports`, `volumes`, `restart`, `healthcheck` and more); modified 2026-08-16 (*headings only*; `container_name`, `healthcheck` and `depends_on` passages *read*)
- **Also good:** [Compose Application Model](https://docs.docker.com/compose/intro/compose-application-model/) — docs.docker.com: services as computing components, with networks and volumes beside them (*read*)

{/* LINKMAP:END */}

---

← Prev: [up, down and the lifecycle](../03-up-and-down/README.md) · Index: [Phase 8](../README.md) · Start → [What runs](01-what-runs.md)
