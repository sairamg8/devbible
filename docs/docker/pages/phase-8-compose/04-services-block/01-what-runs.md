---
title: "What runs: image, build, command, entrypoint"
sidebar_label: "01 · What runs"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the `services` top-level element](https://docs.docker.com/reference/compose-file/services/) and
> [the `build` section](https://docs.docker.com/reference/compose-file/build/).
> **No sandbox** — no console output on this page.

**Two questions decide a service: where the image comes from, and what process the
container starts.** The second one has a rule that discards your `CMD` without
warning, and it catches people every time.

## `image` — the simple case

```yaml
services:
  db:
    image: postgres:18
  cache:
    image: redis:8-alpine
```

Reference rules are exactly Phase 2's: `postgres:18` means
`docker.io/library/postgres:18`, a tag is a subscription rather than a version, and
Podman resolves short names differently
([Phase 2, page 01](../../phase-2-images-and-registries/01-image-references.md)).
**Fully qualify in anything that has to work on both engines.**

`pull_policy` decides when Compose goes to the registry:

| Value | Meaning |
|---|---|
| `always` | Pull every time |
| `missing` | Pull only if the image is not present locally |
| `never` | Never pull; fail if it is absent |
| `build` | Build rather than pull |
| `daily`, `weekly`, `every_<duration>` | Pull if the local copy is older than that |

The `daily`/`weekly`/`every_<duration>` forms are the interesting ones — they are a
middle ground between "never notices upstream patches" and "hits the registry on
every `up`", which matters given Hub's pull limits
([Phase 2, page 08](../../phase-2-images-and-registries/08-registries.md)).

## `build` — from source

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
      args:
        NODE_VERSION: "24"
    image: myapp/api:dev
```

| Key | What it does |
|---|---|
| `context` | Directory or Git URL containing the build context. Defaults to the project directory |
| `dockerfile` | An alternate Dockerfile; relative paths resolve **from the build context** |
| `dockerfile_inline` | The Dockerfile as an inline string. Mutually exclusive with `dockerfile` |
| `args` | Values for the Dockerfile's `ARG` instructions |
| `target` | Which stage of a multi-stage build to stop at |
| `cache_from` | Where to look for cache |
| `pull` | Pull referenced images even when present locally |
| `platforms` | Target platforms to build for |
| `secrets` | Build-time secret access |
| `tags` | Extra tags beyond the service's `image` |

Two of these carry the phase's weight:

- **`target`** is how one Dockerfile serves development and production. The dev
  service builds `target: development` with dev dependencies and a watcher; the
  production build stops at a lean final stage. [Phase 4 · `--target` to stop at a stage](../../phase-4-build-strategy/06-target.md)
  is the same mechanism from the build side.
- **`args`** feeds `ARG`, and inherits `ARG`'s security property unchanged: it is
  **not a secret**, it is visible in `docker history`
  ([Phase 3, page 07](../../phase-3-dockerfile/07-env-vs-arg.md)). Use `secrets`
  under `build` for anything that must not ship.

The short form `build: .` is equivalent to `build: {context: .}` and is fine for
simple cases.

## When both `image` and `build` are set

This is the arrangement most real projects use, and its behaviour is documented
plainly: "When Compose is confronted with both a `build` subsection for a service
and an `image` attribute, it follows the rules defined by the `pull_policy`
attribute." The `image` value gives the built image its **name**, which is what
makes it pushable.

```yaml
services:
  api:
    build: .
    image: registry.example.com/myapp/api:dev
```

Read that as: `image` is not "pull this instead" — it is "call the thing you build
this". The practical benefit is that `docker compose push` then has somewhere to
send it.

## `command` overrides `CMD`

```yaml
services:
  api:
    image: myapp/api
    command: ["node", "server.js", "--port", "3000"]
```

"`command` overrides the default command declared by the container image, for
example by Dockerfile's `CMD`." A null value uses the image's default; an empty
list or string ignores the image's default entirely.

**Use the list (exec) form.** The string form goes through a shell, which puts `sh`
at PID 1 — and `sh` does not forward `SIGTERM`, so every `docker compose stop` takes
the full grace period
([Phase 3, page 06](../../phase-3-dockerfile/06-exec-vs-shell-form.md)). This is the
same ten-second-stop symptom that runs through the whole track, and Compose is a
very easy place to reintroduce it.

## 🔴 `entrypoint` discards the image's `CMD`

The rule that surprises people, in the documentation's words:

> "This overrides the `ENTRYPOINT` instruction from the service's Dockerfile."
>
> "If `entrypoint` is non-null, Compose ignores any default command from the image,
> for example the `CMD` instruction in the Dockerfile."

So this does **not** do what it looks like:

```yaml
services:
  api:
    image: myapp/api          # ENTRYPOINT ["docker-entrypoint.sh"], CMD ["node","server.js"]
    entrypoint: ["/bin/sh", "-c"]     # ⚠️ the image's CMD is now gone
```

Setting `entrypoint` alone leaves the container with no command to run. If you
override the entrypoint, **you must supply `command` too**:

```yaml
services:
  api:
    image: myapp/api
    entrypoint: ["/bin/sh", "-c"]
    command: ["node server.js"]
```

This matches the Dockerfile-side rule exactly — an `ENTRYPOINT` in a child image
clears an inherited `CMD`
([Phase 3, page 05](../../phase-3-dockerfile/05-cmd-vs-entrypoint.md)) — and it is
worth carrying as one fact rather than two.

## Podman

The service keys themselves are the provider's business
([page 01](../01-what-compose-is.md)), and both providers cover `image`, `build`,
`command` and `entrypoint`. The two things to watch:

- **Short names.** `image: postgres:18` resolves via
  `unqualified-search-registries` under Podman, so it can resolve somewhere other
  than Hub, or fail outright depending on `short-name-mode`
  ([Phase 2, page 12](../../phase-2-images-and-registries/12-podman-registries-conf.md)).
  Fully qualify.
- **Build frontends.** A Dockerfile with a `# syntax=` directive needs BuildKit;
  **Buildah does not fetch frontends**, so the directive is quietly ignored under
  Podman ([Phase 3, page 15](../../phase-3-dockerfile/15-syntax-directive.md)).

## Gotchas

**Symptom:** Overriding `entrypoint` produced a container that starts and
immediately exits, or complains that no command was specified.
**Cause:** A non-null `entrypoint` makes Compose ignore the image's `CMD`.
**Fix:** Supply `command` alongside `entrypoint`. Do not expect the image's default
command to survive.

**Symptom:** Every `docker compose stop` takes the full ten seconds.
**Cause:** `command` was written as a string, so a shell is PID 1 and does not
forward `SIGTERM`.
**Fix:** Use the list form — `command: ["node", "server.js"]`. Timing a stop is the
field diagnostic for this whole class of bug.

**Symptom:** A build argument holding a token showed up in `docker history`.
**Cause:** `build.args` feeds `ARG`, which is visible in the image history — it was
never a secret mechanism.
**Fix:** Use `build.secrets`, and **rotate the token**, because rebuilding does not
unpublish what was already pushed.

**Symptom:** `docker compose push` fails with a name that makes no sense.
**Cause:** The service has `build` but no `image`, so the built image has only a
generated project-scoped name.
**Fix:** Add `image:` with the registry-qualified name you intend to push. Both keys
together is the normal arrangement.

## Interview questions

**★ What happens if a service sets both `image` and `build`?**
It builds, and `image` supplies the **name** of the resulting image — which is what
makes it pushable. Whether Compose pulls instead is governed by `pull_policy`. The
common misreading is that `image` means "use this instead of building"; it does not.

**★ You set `entrypoint` on a service and the container stopped working. Why?**
Because a non-null `entrypoint` makes Compose ignore the image's default command —
the `CMD` in its Dockerfile is discarded. You have to provide `command` as well. It
is the same rule as a Dockerfile `ENTRYPOINT` clearing an inherited `CMD`.

**★ Why write `command` as a list rather than a string?**
The string form runs through a shell, which becomes PID 1 and does not forward
`SIGTERM`, so the container never shuts down cleanly and every stop burns the whole
grace period. The list form execs the process directly, so it is PID 1 and receives
the signal.

**What does `build.target` buy you?**
One Dockerfile serving several purposes. The development service stops at a stage
with dev dependencies and a file watcher; the production build continues to a lean
final stage. It is the Compose-side handle on multi-stage builds.

**Is `build.args` a safe place for a token?**
No. It feeds `ARG`, which is visible in `docker history`. Use `build.secrets`. And
if one has already been through a build that was pushed, rotate it — rebuilding
does not unpublish.

**What does `pull_policy: weekly` do, and why would you want it?**
It pulls only if the local image is older than a week. It sits between `never`
(which quietly runs a stale image for months) and `always` (which hits the registry
on every `up` and burns pull-rate limits), so it is a reasonable default for a
long-lived development stack.

---

← Topic index: [The services block](README.md) · Next → [How it is wired](02-how-it-is-wired.md)
