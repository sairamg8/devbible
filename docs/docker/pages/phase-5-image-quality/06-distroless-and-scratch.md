---
title: "Distroless and scratch"
sidebar_label: "06 · Distroless and scratch"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against
> [Docker — create a base image](https://docs.docker.com/build/building/base-images/),
> [the GoogleContainerTools/distroless project](https://github.com/GoogleContainerTools/distroless),
> [Docker — multi-stage builds](https://docs.docker.com/build/building/multi-stage/) and
> [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/).
> **No sandbox** — no console output on this page.

**The end of the size argument is an image with no distribution in it at all —
no shell, no package manager, no `ls`.** You gain a very small image and a very
small attack surface, and you give up every debugging habit that starts with
`docker exec … sh`.

## `scratch` — genuinely nothing

> "The reserved, minimal `scratch` image serves as a starting point for building
> containers."
>
> "Using the `scratch` image signals to the build process that you want the next
> command in the Dockerfile to be the first filesystem layer in your image."

So `FROM scratch` is not a base image being pulled — it is a declaration that
there is no base. It is also special-cased in the registry:

> "While `scratch` appears in Docker's repository on Docker Hub, you can't pull
> it, run it, or tag any image with the name `scratch`."

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.26 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/app ./cmd/app

FROM scratch
COPY --from=build /bin/app /bin/app
USER 65532:65532
ENTRYPOINT ["/bin/app"]
```

The image is that one binary. Nothing else exists in it.

And the documentation is candid about the limit:

> Building a base image from scratch "can be difficult, for anything other than
> small, simple programs"

because executables usually depend on runtimes, libraries or certificates that
must then be supplied by hand. Which brings the practical list of what `scratch`
does **not** give you:

| Missing | Consequence |
|---|---|
| A libc | The binary must be statically linked — hence `CGO_ENABLED=0` above |
| CA certificates | **Every outbound TLS call fails** until you copy a bundle in |
| `/etc/passwd`, `/etc/group` | `USER appuser` cannot resolve; use a numeric uid |
| Timezone data | `TZ` handling and local-time formatting misbehave |
| `/tmp` | Anything expecting a temp directory fails |
| A shell | `docker exec … sh` is impossible, and shell-form `CMD` cannot work |

The CA certificate one catches almost everybody, and it is one line:

```dockerfile
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
```

Shell form is worth restating: with no `/bin/sh`, only the exec form of
`ENTRYPOINT`/`CMD` can run at all
([Phase 3 · exec versus shell form](../phase-3-dockerfile/06-exec-vs-shell-form.md)).
That is a small bonus — your process is PID 1 and receives `SIGTERM` — arrived at
by force rather than by choice.

## Distroless — the pragmatic middle

Distroless images fill in exactly the gaps above without adding a distribution:

> "Distroless images contain only your application and its runtime
> dependencies."
>
> They "do not contain package managers, shells or any other programs you would
> expect to find in a standard Linux distribution."

So you get CA certificates, timezone data, `/etc/passwd` entries and — for the
language variants — a runtime, and you still have no shell and no package
manager. The project publishes a **static** variant (the smallest, around 2 MiB),
**base** and **base-nossl**, and language images for **Java, Python3, Node.js and
C++**.

The tag suffixes are the part worth memorising:

| Tag | What it adds |
|---|---|
| `latest` | The standard variant |
| **`nonroot`** | Runs as an unprivileged user |
| **`debug`** | **Includes a busybox shell** for troubleshooting |
| `debug-nonroot` | Both |

```dockerfile
FROM gcr.io/distroless/static:nonroot
COPY --from=build /bin/app /bin/app
USER 65532:65532
ENTRYPOINT ["/bin/app"]
```

The intended usage is exactly the Phase 4 pattern: build the artefact in a full
environment, then copy only the compiled output into the distroless base
([Phase 4 · multi-stage builds](../phase-4-build-strategy/04-multi-stage-builds.md)).
Distroless is a *runtime* stage and nothing else.

## How you debug afterwards

This is the real cost, and it needs an answer before you adopt either.

**1. The `debug` tag.** The most direct route: rebuild or redeploy with
`gcr.io/distroless/…:debug`, which "includes busybox shell", get your shell, and
switch back. It requires being able to redeploy, which in production may be
exactly what you cannot do quickly.

**2. A sidecar sharing namespaces.** Run a second container in the target's
namespaces and use *its* tooling on the target's processes and network:

```bash
docker run --rm -it \
  --pid=container:<target> \
  --network=container:<target> \
  nicolaka/netshoot
```

The debugging container has the shell; the distroless container stays clean. On
Kubernetes the same idea is `kubectl debug` with an ephemeral container. This is
the technique to know, because it works for **any** minimal image and does not
require changing what is deployed.

**3. Do not need a shell.** Structured logs to stdout, a metrics endpoint, and a
health endpoint answer most of what people actually `exec` in for. A distroless
image is a forcing function for observability you should have had anyway.

**4. Copy in a static tool at build time.** A single statically linked binary can
be `COPY --from`'d into the image if you genuinely need it
([Phase 4 · `COPY --from`](../phase-4-build-strategy/07-copy-from.md)) — at the
cost of putting back part of what you removed.

## Choosing between the three

| Base | Use when |
|---|---|
| **`scratch`** | A single static binary with no runtime needs beyond what you copy in — Go, Rust, C with static linking |
| **Distroless** | You want minimal *and* a working runtime — a JVM, Python or Node service, or a static binary that needs certificates and timezone data |
| **Alpine / `-slim`** | You need a package manager, a shell, or dependencies with no minimal-base story ([page 05](05-alpine-and-musl.md)) |

**Node on distroless is possible and is not the same as Go on `scratch`.** The
`nodejs` variant ships the runtime, so it works — but a Node application with
native modules still needs those modules built against a compatible base, and the
image is not tiny. The size ceiling here is set by the runtime, not by the
distribution
(**page 10 · static binaries**, *not written yet*).

## What it does and does not do for security

**Does:** removes a large amount of software you were not using, so there is less
to be vulnerable and less for an attacker to pick up after a compromise. It also
makes a vulnerability report much shorter and more meaningful, which is
**page 07 · Vulnerability scanning** *(not written yet)*.

**Does not:** fix your application's own vulnerabilities, or your dependencies'.
A distroless image running a vulnerable web framework is a vulnerable web
framework with fewer utilities around it. Minimal bases reduce the *blast radius*
and the *noise*; they do not reduce the *entry point*.

## Podman

Both approaches are ordinary OCI images, so `podman build` and `podman run`
handle them identically. The namespace-sharing debug trick is spelled
`--pid=container:<name>` and `--network=container:<name>` under Podman too;
Podman also has `podman pod` for grouping, which is a Phase 11 subject (another
chunk's phase, *not written yet*).

Fully qualify distroless references (`gcr.io/distroless/static:nonroot` already
is) because short-name resolution differs.

## Gotchas

**Symptom:** A `scratch` image fails every HTTPS request with a certificate
error.
**Cause:** No CA bundle — `scratch` contains nothing at all.
**Fix:** `COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/`.

**Symptom:** The container exits immediately with "no such file or directory",
though the binary is definitely there.
**Cause:** A dynamically linked binary on `scratch`, so the loader or a shared
library is missing. The message names the *interpreter*, not your binary.
**Fix:** Build statically (`CGO_ENABLED=0` for Go), or use distroless `base`
instead.

**Symptom:** `USER appuser` fails on a minimal base.
**Cause:** No `/etc/passwd` entry to resolve the name.
**Fix:** A numeric uid — `USER 65532:65532` — or the distroless `nonroot` tag
([page 03](03-least-privilege.md)).

**Symptom:** `docker exec -it <container> sh` fails with "executable file not
found".
**Cause:** There is no shell. That is the design.
**Fix:** A namespace-sharing debug container, or the `debug` tag if you can
redeploy.

## Interview questions

**★ What is `FROM scratch`, and what does an image built on it lack?**
It is the reserved, minimal image — a signal that "the next command in the
Dockerfile [is] the first filesystem layer", not a base being pulled, and it
cannot be pulled, run or tagged. The image then lacks a libc, CA certificates,
`/etc/passwd`, timezone data, `/tmp` and any shell — so the binary must be static
and anything it needs must be copied in.

**★ How do distroless images differ from `scratch`?**
They "contain only your application and its runtime dependencies" — certificates,
timezone data, user entries, and a language runtime for the language variants —
while still having no package manager and no shell. `scratch` is empty;
distroless is the smallest thing that actually works.

**★ You cannot `exec` into a distroless container. How do you debug it?**
Run a debugging container in the target's namespaces —
`--pid=container:<target> --network=container:<target>` with a tooling image, or
`kubectl debug` on Kubernetes — so the tooling is outside and the image stays
clean. The `debug` tag with its busybox shell is the alternative when you can
redeploy.

**What do the distroless tag suffixes mean?**
`nonroot` runs as an unprivileged user, `debug` includes a busybox shell for
troubleshooting, and `debug-nonroot` combines both. Plain `latest` is the
standard variant.

**Does a minimal base make your application secure?**
No. It removes software you were not using, so there is less to be vulnerable and
less for an attacker to use after a compromise — and it makes scan reports much
shorter. Your own code and dependencies are unaffected.

---

← Prev: [Alpine and musl](05-alpine-and-musl.md) · Index: [Phase 5](README.md) · Next → **Vulnerability scanning** *(not written yet)*
