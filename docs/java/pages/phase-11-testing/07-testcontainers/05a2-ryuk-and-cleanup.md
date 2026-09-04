---
title: "A singleton container is never stopped by anything in your code, which is only safe because a sidecar called Ryuk holds an open socket to your test JVM and deletes everything carrying that JVM's session label the moment the connection drops — and the two environments that force you to disable it change the cleanup story completely"
sidebar_label: "05a2 · Ryuk and cleanup"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) — read directly:
> `core/src/main/java/org/testcontainers/utility/ResourceReaper.java`,
> `RyukResourceReaper.java`, `RyukContainer.java`, `JVMHookResourceReaper.java`,
> `TestcontainersConfiguration.java`, `core/src/main/java/org/testcontainers/DockerClientFactory.java`
> and `core/src/main/java/org/testcontainers/containers/GenericContainer.java`; plus
> `docs/features/configuration.md` and `docs/supported_docker_environment/index.md` at the same tag.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**The singleton pattern of [05](05-the-singleton-pattern.md) deliberately never calls `stop()`. That
is only defensible because something else removes the container, and that something is a companion
container the library starts behind your back. This chunk is what Ryuk actually is, what it keys
on, when it runs, and the two situations — rootless Podman and a runtime that forbids privileged
containers — where you are told to turn it off and inherit a weaker guarantee.**

## What Ryuk is

`RyukContainer` is an ordinary `GenericContainer`, and its whole definition fits on a screen:

```java
class RyukContainer extends GenericContainer<RyukContainer> {

    RyukContainer() {
        super("testcontainers/ryuk:0.14.0");
        withExposedPorts(8080);
        withCreateContainerCmdModifier(cmd -> {
            cmd.withName("testcontainers-ryuk-" + DockerClientFactory.SESSION_ID);
            cmd.withHostConfig(cmd.getHostConfig()
                .withAutoRemove(true)
                .withPrivileged(TestcontainersConfiguration.getInstance().isRyukPrivileged())
                .withBinds(new Bind(
                    DockerClientFactory.instance().getRemoteDockerUnixSocketPath(),
                    new Volume("/var/run/docker.sock"))));
        });
        waitingFor(Wait.forLogMessage(".*Started.*", 1));
    }
}
```

Four facts to take from that: it is **`testcontainers/ryuk:0.14.0`** at Testcontainers 2.0.5; it is
named `testcontainers-ryuk-<sessionId>`; it mounts the host's Docker socket, which is how it can
delete things; and it is created with auto-remove, so it disposes of itself.

⚠️ `docs/features/configuration.md` at this same tag still documents the default as
`ryuk.container.image = testcontainers/ryuk:0.3.3`. **The documentation is stale; the source is
0.14.0.** The property name is correct — you can still override the image with it.

## How it knows which containers are yours

Every container Testcontainers creates *and registers* carries four labels:

| Label | Value | Set by |
|---|---|---|
| `org.testcontainers` | `true` | `DockerClientFactory.DEFAULT_LABELS` |
| `org.testcontainers.lang` | `java` | `DockerClientFactory.DEFAULT_LABELS` |
| `org.testcontainers.version` | the Testcontainers version | `DockerClientFactory.DEFAULT_LABELS` |
| `org.testcontainers.sessionId` | `UUID.randomUUID()`, generated once per JVM | `ResourceReaper.register` |

The registration is a single branch in `GenericContainer.tryStart()`:

```java
if (!reusable) {
    createCommand = ResourceReaper.instance().register(this, createCommand);
}
```

and `register` does nothing but merge in the session-id label. **That `if` is the entire reason a
reusable container survives your JVM** — it is never registered, so it never gets the session label,
so Ryuk's filters never match it. That is [05b](05b-reuse.md)'s subject.

## The dead-man's switch

`RyukResourceReaper.maybeStart()` starts the sidecar, then opens a plain TCP socket from your JVM to
Ryuk's mapped port 8080 on a daemon thread named `testcontainers-ryuk`, writes the label filters —
the source calls the list `DEATH_NOTE` — and waits for the string `ACK`:

```java
if (!ryukScheduledLatch.await(TestcontainersConfiguration.getInstance().getRyukTimeout(),
                             TimeUnit.SECONDS)) {
    log.error("Timed out waiting for Ryuk container to start. Ryuk's logs:\n{}", ryukContainer.getLogs());
    throw new IllegalStateException(String.format("Could not connect to Ryuk at %s:%s", host, ryukPort));
}
```

Note the comment in the source above that block: *"We need to wait before we can start any
containers to make sure that we delete them."* Registration is synchronous and blocking on purpose —
Testcontainers refuses to create your container until it knows something will clean it up.

**Ryuk's contract is the socket, not a timer.** While the connection is open it does nothing. When
the connection drops — the JVM exited normally, was killed, ran out of memory, or the CI job was
cancelled — it deletes everything matching the filters it was given. This is why "started in a
static block and never stopped" is not a leak: the process holding the socket is your test JVM, and
when the suite ends the JVM ends.

Two knobs, both resolved through `TestcontainersConfiguration`:

- **`ryuk.container.privileged`, default `"true"`** at 2.0.5 (environment form
  `TESTCONTAINERS_RYUK_CONTAINER_PRIVILEGED`). The documentation's older
  `TESTCONTAINERS_RYUK_PRIVILEGED` name does not appear in `TestcontainersConfiguration` at this
  tag, which is consistent with its note that *"Previous to version 1.19.0, `export
  TESTCONTAINERS_RYUK_PRIVILEGED=true` was required for rootful mode. Starting with 1.19.0, this is
  no longer required."*
- **`ryuk.container.timeout`, default `30`** seconds — the `ACK` wait above.

## When Ryuk starts, which is not always at the same moment

`RyukResourceReaper.init()` has a branch that surprises people:

```java
@Override
public void init() {
    if (!TestcontainersConfiguration.getInstance().environmentSupportsReuse()) {
        log.debug("Ryuk is enabled");
        maybeStart();
        log.info("Ryuk started - will monitor and terminate Testcontainers containers on JVM exit");
    } else {
        log.debug("Ryuk is enabled but will be started on demand");
    }
}
```

With reuse **not** enabled on the machine, Ryuk starts eagerly during client initialisation. With
`testcontainers.reuse.enable=true` in your `~/.testcontainers.properties`, it does not — it starts
on demand, the first time a non-reusable container is registered. So a machine-level reuse opt-in
silently changes Ryuk's start timing for every project on that machine, and in a run where *every*
container is reusable, Ryuk never starts at all. `RyukResourceReaper.register` also short-circuits
for the sidecar itself, with the comment *"Do not register Ryuk container to avoid self-pruning"*.

## Turning it off, and what you get instead

Disabling Ryuk is not "no cleanup" — it is a different, weaker cleanup:

```java
boolean useRyuk = !Boolean.parseBoolean(System.getenv("TESTCONTAINERS_RYUK_DISABLED"));
if (useRyuk) {
    instance = new RyukResourceReaper();
} else {
    LOGGER.warn(ryukDisabledMessage);   // "Ryuk has been disabled. This can cause unexpected
                                        //  behavior in your environment."
    instance = new JVMHookResourceReaper();
}
```

`JVMHookResourceReaper` registers a `Runtime.addShutdownHook` and, at shutdown, prunes containers,
networks, volumes and images by label — for containers it lists and force-removes them itself, with
the source noting *"Docker only prunes stopped containers, so we have to do it manually"*. The
configuration documentation states the consequence exactly:

> *"Note that Testcontainers will continue doing the cleanup at JVM's shutdown, unless you `kill -9`
> your JVM process."*

So with Ryuk off you keep cleanup for orderly exits and lose it for `SIGKILL`, OOM kills, a hard
stop from the IDE, and a cancelled CI job — precisely the cases a never-stopped singleton most needs
covered.

Two environments make this your problem:

1. **Rootless Podman.** *"If you're running Podman in rootless mode, ensure to include the following
   line to disable Ryuk: `export TESTCONTAINERS_RYUK_DISABLED=true`"*.
2. **A runtime that forbids privileged containers**, which is the case the configuration
   documentation describes: *"If your environment already implements automatic cleanup of containers
   after the execution, but does not allow starting privileged containers, you can turn off the Ryuk
   container"*.

Note the conditional in that second sentence — *already implements automatic cleanup*. Disabling
Ryuk is safe when something else reaps; on a developer laptop, nothing else does.

🔴 **`TESTCONTAINERS_RYUK_DISABLED` is read with a bare `System.getenv` in `ResourceReaper.instance()`**,
not through `TestcontainersConfiguration`. It therefore cannot be set in
`~/.testcontainers.properties` or in a classpath `testcontainers.properties` — and the documentation
says so in bold: *"setting `TESTCONTAINERS_RYUK_DISABLED` **environment variable** to `true`"*.
Contrast `testcontainers.reuse.enable`, which does go through the configuration mechanism and does
work in the user file ([05b](05b-reuse.md)).

## The hooks that do not run

`GenericContainer` exposes `containerIsStopping` and `containerIsStopped`, and both javadocs carry
the same warning:

> *"Warning! This hook won't be executed if the container is terminated during the JVM's shutdown
> hook or by Ryuk."*

A singleton is terminated by exactly those two paths and by no other, so any teardown logic you hang
on those hooks in a container subclass will never run under the singleton pattern. If you need
something to happen at the end of a suite — dumping a log, exporting a coverage file from inside the
container — do it from a JUnit `LauncherSessionListener` or a `@AfterAll`, not from a container hook.

## Gotchas

**★ Disabling Ryuk and keeping a never-stopped singleton is the worst combination.**
The pattern relies on something reaping at JVM exit; with Ryuk off that something is a shutdown
hook, which `kill -9` skips. On rootless Podman you have no choice about disabling Ryuk, so budget
for `podman ps` becoming part of your routine.

**★ Expecting `containerIsStopping` / `containerIsStopped` to run.**
Their javadoc excludes the JVM shutdown hook and Ryuk — which are the only two paths a singleton
ever takes.

**★ Assuming the `--privileged` default is off.**
`isRyukPrivileged()` defaults to `"true"` at 2.0.5. In an environment that forbids privileged
containers, Ryuk itself fails to start and the run dies at the first container — which is the case
the documentation solves by disabling Ryuk, not by fighting the flag.

**★ Believing the configuration documentation's Ryuk version.**
`docs/features/configuration.md` still prints `testcontainers/ryuk:0.3.3`. `RyukContainer` at tag
2.0.5 is `testcontainers/ryuk:0.14.0`. Same for any blog post quoting an image digest.

**★ Trying to set `TESTCONTAINERS_RYUK_DISABLED` in `~/.testcontainers.properties`.**
It is read with `System.getenv` and never consults the properties files. There is no
`ryuk.disabled` property. It must be an environment variable, visible to the process that runs the
tests — which in an IDE means the run configuration, not your shell profile.

**★ One Ryuk per JVM, not per suite.**
`ResourceReaper` is a per-JVM singleton and `SESSION_ID` is generated once per JVM. Gradle's
`maxParallelForks = 4` therefore gives you four Ryuk sidecars and four independent sessions, each
reaping only its own containers.

**★ Enabling reuse machine-wide changes when Ryuk starts, for every project.**
`RyukResourceReaper.init()` skips the eager start when `environmentSupportsReuse()` is true. That is
a global setting in your home directory, so it affects repositories that never asked for reuse.

**★ Ryuk needs the container runtime's socket, which some CI setups do not expose.**
It mounts `getRemoteDockerUnixSocketPath()` at `/var/run/docker.sock`. In a sandbox that hides the
socket, Ryuk cannot function, the `ACK` never arrives, and the run fails with *"Could not connect to
Ryuk at …"* rather than with a message about the socket.

**★ Reading the `ACK` timeout as a container-start timeout.**
`ryuk.container.timeout` (default 30 seconds) bounds the wait for Ryuk's acknowledgement, which on a
cold machine includes pulling the Ryuk image. It has nothing to do with how long *your* container may
take to become ready — that is the wait strategy's job.

## Interview questions

**★ What is Ryuk and what exactly triggers it?**
A sidecar container — `testcontainers/ryuk:0.14.0` at Testcontainers 2.0.5 — started with the host's
Docker socket mounted. Your JVM opens a socket to it on a daemon thread and registers label filters
including `org.testcontainers.sessionId`, a UUID generated once per JVM. Ryuk holds that connection
open and does nothing while it lives; when the connection drops for any reason, including a crash or
a kill, it deletes everything matching those labels. It is a dead-man's switch, not a timer.

**★ Why does Testcontainers block until Ryuk acknowledges?**
Because it will not create a container it cannot guarantee to clean up. The source comment is *"We
need to wait before we can start any containers to make sure that we delete them"*, and the wait is
bounded by `ryuk.container.timeout` (30 seconds by default), after which it throws
`IllegalStateException("Could not connect to Ryuk at …")`.

**★ If you disable Ryuk, what cleans up?**
`ResourceReaper.instance()` falls back to `JVMHookResourceReaper`, which registers a
`Runtime.addShutdownHook` and prunes containers, networks, volumes and images by label at shutdown —
force-removing containers itself, because Docker's prune only touches stopped ones. The
documentation's phrasing is that cleanup continues at JVM shutdown *"unless you `kill -9` your JVM
process"*.

**★ Why does rootless Podman need Ryuk disabled, and what does that cost you?**
The Testcontainers documentation instructs rootless Podman users to `export
TESTCONTAINERS_RYUK_DISABLED=true`; Ryuk is created privileged by default and needs the runtime's
socket. The cost is that any container whose JVM is killed rather than exited is left running —
which for a never-stopped singleton is the common case, not an edge case.

**★ Can you set `TESTCONTAINERS_RYUK_DISABLED` in `~/.testcontainers.properties`?**
No. It is read with a bare `System.getenv` in `ResourceReaper.instance()` rather than through
`TestcontainersConfiguration`, and the documentation calls it out in bold as an environment
variable. Contrast `testcontainers.reuse.enable`, which does go through the configuration mechanism
and therefore does work in that file.

**★ How does Ryuk avoid deleting itself?**
`RyukResourceReaper.register` short-circuits when the container being registered is the Ryuk
container — *"Do not register Ryuk container to avoid self-pruning"* — so it never carries the
session label it is reaping on. It disappears anyway, because it is created with auto-remove.

**★ How many Ryuk containers does a build start?**
One per test JVM. `ResourceReaper` is a per-JVM singleton and `DockerClientFactory.SESSION_ID` is a
UUID generated once per JVM, so forked test workers each get their own sidecar and their own
session. Nothing is shared between them.

**★ Why does enabling container reuse change Ryuk's behaviour even for containers you did not mark reusable?**
Because `RyukResourceReaper.init()` checks `environmentSupportsReuse()` and, when it is true, skips
the eager start in favour of starting on demand. The flag is machine-level, so the timing change
applies to every project run on that machine, not just the one that wanted reuse.

{/* FOOTER */}
