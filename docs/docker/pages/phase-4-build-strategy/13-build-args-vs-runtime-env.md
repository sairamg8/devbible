---
title: "Build args versus runtime env"
sidebar_label: "13 · Build args vs runtime env"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [the Dockerfile reference — `ARG`](https://docs.docker.com/reference/dockerfile/#arg),
> [the Dockerfile reference — `ENV`](https://docs.docker.com/reference/dockerfile/#env),
> [Docker — build secrets](https://docs.docker.com/build/building/secrets/) and
> [Docker — build cache invalidation](https://docs.docker.com/build/cache/invalidation/).
> **No sandbox** — no console output on this page.

**A build argument is decided when the image is built and can never change
afterwards; an environment variable is decided when the container starts.**
Choosing the first for something that belongs to the second is how one image
turns into four, one per environment, and how "deploy to staging" becomes
"rebuild for staging".

[Phase 3 · ENV versus ARG](../phase-3-dockerfile/07-env-vs-arg.md) covers the two
instructions. This page is about the **decision** — and the one case where it is
genuinely hard.

## The distinction

| | `ARG` / `--build-arg` | `ENV` / `docker run -e` |
|---|---|---|
| Decided at | Build time | Container start |
| Changing it requires | A rebuild | A restart |
| Visible in `docker history` | **Yes** | Yes |
| Present in a running container | No — unless copied to `ENV` | Yes |
| Same image across environments | ✗ | ✓ |

Two documented details that decide arguments:

> "Environment variables defined using the `ENV` instruction always override an
> `ARG` instruction of the same name."

> "It isn't recommended to use build arguments for passing secrets such as user
> credentials, API tokens, etc. Build arguments are visible in the `docker
> history` command."

Secrets are neither — that is [page 05](05-mount-type-secret.md). The proxy
arguments (`HTTP_PROXY`, `NO_PROXY` and friends) are predefined and, by default,
excluded from `docker history` output; nothing else you pass gets that treatment.

## The default is runtime, and the reason is one image

**One image should be promoted unchanged from CI through staging to
production.** That is what makes the thing you tested the thing you ran. Every
value baked at build time breaks the property: a database URL in a build argument
means the staging image and the production image are different artefacts, built
at different times, from possibly different dependency resolutions.

So the rule is: **if the value differs per environment, it is runtime
configuration.** Database URLs, API endpoints, log levels, feature flags, cache
sizes, credentials — all runtime.

## Where a build argument is genuinely right

| Use | Why it must be build-time |
|---|---|
| `GIT_SHA` / build number in a `LABEL` | It describes *this build*; it cannot come later |
| Base image or version selection (`ARG NODE_VERSION`) | It is consumed by `FROM` |
| `TARGETARCH` and friends | The build result differs per architecture ([page 11](11-buildx-and-platforms.md)) |
| Compile-time feature toggles | The artefact genuinely differs |
| `CACHEBUST` to force a miss | Its only job is to change the cache key ([page 01](01-how-the-cache-decides.md)) |

The pattern in all five: the *artefact itself* differs. If the artefact would be
byte-identical either way, the value did not belong at build time.

## The hard case: front-end bundles

This is the one that defeats the rule honestly. A Vite or Create-React-App build
**inlines** environment variables into the JavaScript bundle at build time —
`import.meta.env.VITE_API_URL` becomes a string literal in the output. There is
no runtime environment in a browser to read.

The naive fix reintroduces the problem:

```dockerfile
ARG VITE_API_URL                 # ✗ one image per environment
RUN VITE_API_URL=$VITE_API_URL npm run build
```

Three ways out, in increasing order of effort:

**1. Serve configuration as a file.** Build the bundle with no environment
baked in; have the app fetch `/config.json` at startup, and let the container
mount or generate that file from its own environment. One image, configuration
arrives over HTTP.

**2. Substitute at container start.** Build with a placeholder, and have the
image's entrypoint rewrite it into the served files before the server starts —
`envsubst` over a template, or a `sed` across `dist/`. One image, configuration
arrives as `-e`.

**3. Inject a global.** Serve an `index.html` whose `<script>` sets
`window.__ENV__` from a file the container writes at startup, and read that in
the app instead of `import.meta.env`.

All three trade a little startup machinery for the property that matters: the
artefact you tested is the artefact you ship. If you genuinely cannot, then
build per environment and **know** you are doing it — the failure is shipping an
untested rebuild while believing you promoted one.

## Scope rules that catch people

The two that produce "the variable is empty and I do not know why":

- **An `ARG` declared before the first `FROM` is global and cannot be used after
  that `FROM` unless it is redeclared** in the stage. To use one argument in
  several unrelated stages, declare it in each.
- **`ARG` values do not reach a running container.** If the runtime needs the
  value, promote it explicitly:

  ```dockerfile
  ARG APP_VERSION=0.0.0
  ENV APP_VERSION=$APP_VERSION
  ```

  Note that this is exactly the pattern that puts a build-time value in the
  image, so use it for things that describe the build (a version), not for
  configuration.

An `ARG` declared within a stage "is automatically inherited by other stages
based on that stage" — inheritance follows `FROM`, not file order.

## The cache consequence

A build argument that an instruction actually uses is substituted before the
cache comparison, so **changing it invalidates that instruction and everything
below it** ([page 02](02-instruction-ordering.md)). Two practical rules follow:

- Consume version- and commit-derived arguments **as late as possible** in the
  stage.
- A widely-used `ARG` near the top is a rebuild of the whole file every time it
  changes — which is fine for `CACHEBUST`, whose entire purpose that is, and bad
  for anything else.

## Podman

`podman build --build-arg` behaves the same way, and the `ARG`/`ENV` semantics
come from the Dockerfile language rather than the builder, so the distinction on
this page carries over unchanged. Runtime injection is `podman run -e` /
`--env-file`, matching Docker.

## Gotchas

**Symptom:** Staging and production run different images although "nothing
changed".
**Cause:** Environment-specific values passed as build arguments, so each
environment needs its own build.
**Fix:** Move them to runtime environment variables and promote one artefact.

**Symptom:** A token passed with `--build-arg` shows up in `docker history`.
**Cause:** Build arguments are recorded in the image configuration; only the
predefined proxy arguments are excluded by default.
**Fix:** Rotate the credential, then use `RUN --mount=type=secret`
([page 05](05-mount-type-secret.md)).

**Symptom:** An `ARG` is empty inside a stage although it was declared at the top
of the file.
**Cause:** A global `ARG` cannot be used after a `FROM` without being redeclared
in that stage.
**Fix:** Redeclare it: `ARG MY_VALUE` after the `FROM`.

**Symptom:** An `ENV` in the Dockerfile does not take the value of the `ARG` with
the same name.
**Cause:** "Environment variables defined using the `ENV` instruction always
override an `ARG` instruction of the same name."
**Fix:** Give them different names, or assign explicitly — `ENV FOO=$FOO_ARG`.

## Interview questions

**★ When is a build argument the right choice, and when is an environment
variable?**
Build argument when the artefact itself differs — a version label, a base image
selection, a target architecture, a compile-time toggle. Environment variable
whenever the value differs per environment, so one image can be promoted
unchanged from CI to production.

**★ Why is baking an API URL into the image a problem?**
It makes staging and production different artefacts, so what you tested is not
what you run, and any change needs a rebuild rather than a restart. It also means
one image per environment, multiplying build time and drift.

**★ Front-end bundlers inline configuration at build time. How do you keep one
image?**
Do not bake it: serve a `/config.json` the app fetches at startup, substitute
placeholders in the built files from the entrypoint, or inject a `window.__ENV__`
global written at container start. All three move the decision to container
start, at the cost of a little startup machinery.

**Why might an `ARG` be empty inside a build stage?**
Because it was declared before the first `FROM`. A global `ARG` must be
redeclared inside a stage to be used there; an `ARG` declared in a stage is
inherited by stages based on it.

**Do build arguments affect the cache?**
Yes — values are substituted before the instruction is compared, so changing one
invalidates that instruction and everything after it. Consume commit- and
version-derived arguments late in the file.

---

← Prev: [Cache import and export](12-cache-import-export.md) · Index: [Phase 4](README.md) · Next → **`docker build` vs `podman build` vs `buildah`** *(not written yet)*
