---
title: "The recommended way to run Testcontainers in CI is to hand your build container the host's Docker socket so the containers it starts are siblings rather than children — and the reason the pattern insists on identical paths inside and out is that every bind mount is resolved by the host's daemon, not yours"
sidebar_label: "09b · CI and alternative runtimes"
sidebar_position: 82
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Testcontainers **CI · Docker-in-Docker patterns**
> ([java.testcontainers.org](https://java.testcontainers.org/supported_docker_environment/continuous_integration/dind_patterns/))
> and **Supported container runtimes**
> ([java.testcontainers.org](https://java.testcontainers.org/supported_docker_environment/))
> documentation, from which every quoted sentence is taken.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries documented configuration only.

**[09](09-the-cost.md) was about the costs and which of them you can move. This is about the
machines that pay them. Two questions decide whether a Testcontainers suite is pleasant or
miserable to operate: how the CI agent gives your build access to a container runtime, and what
happens on the developer machines that do not run Docker Desktop. Both have documented answers, and
both have a setting that quietly disables something you wanted.**

## 1 · CI: mount the socket, do not nest Docker

The recommended pattern is **sibling containers**, not Docker-in-Docker. The mechanism is that your
CI job runs inside a container which is given the host's Docker socket, so the containers it starts
are siblings on the host rather than children inside it:

```
-v $PWD:$PWD -w $PWD -v /var/run/docker.sock:/var/run/docker.sock
```

Two details make it work, and both are easy to miss:

- **Mount the source at the same path inside and outside.** That is what `-v $PWD:$PWD -w $PWD`
  achieves. Because the containers are siblings on the host, any bind mount your test asks for is
  resolved by the *host's* daemon — so a path that exists only inside your CI container does not
  exist for the container being started.
- Testcontainers copes with the addressing itself: *"Testcontainers will automatically detect if
  it's inside a container and instead of 'localhost' will use the default gateway's IP."* On Docker
  Desktop, set `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal`.

On Docker-in-Docker the documentation is unenthusiastic and specific:

> *"While Docker-in-Docker (DinD) is generally considered an instrument of last resort, it is
> necessary for some CI environments."*

Use it when the platform leaves no choice, and expect the layer cache not to survive between runs —
which puts you straight back into the image-pull cost above.

## 2 · Alternative runtimes: supported, second-class, and fiddly

The project's own scoping, quoted:

> *"Alternative container runtimes are not actively tested in the main development workflow, so not
> all Testcontainers features might be available."*

**Podman on Linux:**

```bash
export DOCKER_HOST=unix://${XDG_RUNTIME_DIR}/podman/podman.sock
```

**Podman on macOS** additionally needs the socket override:

```bash
export DOCKER_HOST=unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}')
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
```

🔴 **Rootless Podman requires Ryuk to be disabled** — *"ensure to include the following line to
disable Ryuk: `export TESTCONTAINERS_RYUK_DISABLED=true`"*. Understand what that costs before you
paste it: Ryuk is the companion container that reaps what the run created **even if the JVM dies**.
Without it, a killed test run leaves its containers behind, and the developer who did that
discovers it as a machine slowly filling up. ⚠️ It is also historical baggage worth knowing: prior
to 1.19.0 rootful mode needed `TESTCONTAINERS_RYUK_PRIVILEGED=true`, and *"Starting with 1.19.0,
this is no longer required"* — so any guide that still tells you to set it is out of date.

**Colima** needs three variables, including `TESTCONTAINERS_HOST_OVERRIDE`. **Rancher Desktop**'s
requirements vary by administrator access, architecture and emulation backend. The general shape:
these all work, and each one is a support burden the team carries.


## Gotchas

**★ Rootless Podman needs `TESTCONTAINERS_RYUK_DISABLED=true`, which turns off cleanup.**
Ryuk is what reaps containers when the JVM dies. Disabled, a killed run leaks containers, and the
machine degrades over days rather than failing visibly.

**★ `TESTCONTAINERS_RYUK_PRIVILEGED=true` is stale advice.**
It was required for rootful mode before 1.19.0 and *"Starting with 1.19.0, this is no longer
required"*. Any guide still specifying it predates that and should be distrusted generally.

**★ Docker-in-Docker usually loses the image cache between runs.**
Which puts the full pull cost on every build. The socket-mount pattern is the recommendation
precisely because the host's layer store persists — DinD is *"an instrument of last resort"*.

**★ Under socket mounting, bind-mount paths are resolved by the host daemon, not your CI container.**
That is why the pattern insists on `-v $PWD:$PWD -w $PWD`: a path that exists only inside the CI
container does not exist for the sibling container being started, and the failure is a confusing
"file not found" for a file you can see.

**★ Docker Hub rate limits surface as a mid-build pull failure, not as a login error.**
Configure registry authentication deliberately — `DOCKER_AUTH_CONFIG`, `DOCKER_CONFIG`, or
`{HOME}/.docker/config.json`, tried in that order — before the limit finds you.

## Interview questions

**★ How should Testcontainers be run in CI?**
Sibling containers via the mounted Docker socket — `-v /var/run/docker.sock:/var/run/docker.sock`
with the source mounted at the same path inside and out. Docker-in-Docker is *"an instrument of last
resort"* for platforms that make socket mounting impossible, and it usually costs you the image
cache.

**★ Why must the source be mounted at the same path inside and outside the CI container?**
Because the containers your test starts are siblings on the host, so any bind mount is resolved by
the host's daemon. A path that only exists inside your CI container is not a path the sibling can
see.

**★ Can you use Podman instead of Docker, and what changes?**
Yes — the project supports it while stating that *"alternative container runtimes are not actively
tested in the main development workflow, so not all Testcontainers features might be available"*.
On Linux you point `DOCKER_HOST` at the Podman socket; on macOS you also set
`TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`. Rootless additionally requires
`TESTCONTAINERS_RYUK_DISABLED=true`.

**★ What do you lose by disabling Ryuk?**
Automatic cleanup of everything the run created, including when the JVM dies. A cancelled or
crashed run leaks its containers, and the cost accumulates on a developer machine rather than
failing loudly.

{/* FOOTER */}
