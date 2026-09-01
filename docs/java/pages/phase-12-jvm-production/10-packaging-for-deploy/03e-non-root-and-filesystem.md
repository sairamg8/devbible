---
title: "Running as a non-root user with a read-only root filesystem is two lines of YAML and it silently disables the JVM's heap dump, its fatal error log, its JFR repository and its own process discovery — unless you decide, in advance, where each of those is allowed to write"
sidebar_label: "03e · Non-root and the filesystem"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** for `-XX:ErrorFile`,
> `-XX:HeapDumpPath`, `-XX:LogFile`, `-XX:+UsePerfData` and `-XX:FlightRecorderOptions`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); the
> **Kubernetes API reference** for `PodSecurityContext` and `SecurityContext`
> ([kubernetes.io](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/pod-v1/))
> and the **"Configure a Security Context"** task page
> ([kubernetes.io](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/));
> the **Eclipse Temurin official-image documentation**
> ([docker-library/docs](https://github.com/docker-library/docs/blob/master/eclipse-temurin/content.md));
> and `common/variables.bzl` in **distroless**
> ([github.com](https://github.com/GoogleContainerTools/distroless)).
> 🔴 **No sandbox** — no pod was created and no dump was written. Every default path below is
> quoted from the `java` tool reference. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Hardening a container is easy to *specify* and easy to get subtly wrong: `runAsNonRoot: true`
and `readOnlyRootFilesystem: true` are two lines, the application keeps serving traffic, and
every check passes. What breaks is invisible until the incident, because everything the JVM
writes for *you* — the heap dump, the fatal error log, the JFR repository, the performance data
that lets `jps` see the process — is written to a path that the two lines just made read-only.
This chunk is the list of those paths and the decision to make about each one.**

## The two settings, quoted

The Kubernetes API reference defines `runAsNonRoot` as a **validation**, not an assignment:

> *"Indicates that the container must run as a non-root user. If true, the Kubelet will validate
> the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the
> container if it does. If unset or false, no such validation will be performed."*

and `runAsUser` as the thing that actually chooses:

> *"The UID to run the entrypoint of the container process. Defaults to user specified in image
> metadata if unspecified."*

🔴 **So `runAsNonRoot: true` alone does not make anything run as a different user.** It refuses to
start a container whose image would have run as UID 0. The user is decided by your Dockerfile's
`USER` instruction or by `runAsUser`. Because the validation is expressed in terms of *UID 0*,
put a **numeric** UID in the Dockerfile — `USER 1000` rather than `USER appuser` — so there is a
UID to validate rather than a name that has to be resolved out of `/etc/passwd` in an image that
may not have one.

`readOnlyRootFilesystem` is exactly what it says:

> *"Whether this container has a read-only root filesystem. Default is false."*

And `fsGroup` is how mounted volumes become writable by a non-root process. From the task page:

> *"Since fsGroup field is specified, all processes of the container are also part of the
> supplementary group ID 2000. The owner for volume /data/demo and any files created in that
> volume will be Group ID 2000."*

## Everything the JVM writes, and where it writes it by default

This is the table to keep. Every default is quoted from the JDK 25 `java` tool reference.

| What | Flag | Documented default location |
|---|---|---|
| Fatal error log | `-XX:ErrorFile` | *"created in the current working directory and named `hs_err_pidpid.log`"* |
| OOM heap dump | `-XX:HeapDumpPath` | *"the file is created in the current working directory, and it's named `java_pid<pid>.hprof`"* |
| HotSpot log | `-XX:LogFile` | *"created in the current working directory, and it's named `hotspot.log`"* |
| JFR disk repository | `-XX:FlightRecorderOptions=repository=` | *"Specifies the repository (a directory) for temporary disk storage. By default, the system's temporary directory is used."* |
| Performance data | `-XX:+UsePerfData` | *"Enables the perfdata feature. This option is enabled by default… Disabling it suppresses the creation of the `hsperfdata_userid` directories."* |
| Application temp files | `-Djava.io.tmpdir` | `/tmp` on Linux — Tomcat's work directory, multipart upload spooling, and anything using `Files.createTempFile` |

🔴 **Three of those default to the *current working directory*, which in a
[02c](02c-a-real-layered-dockerfile.md)-shaped image is `/application` — part of the read-only
root filesystem.**

There is one crucial asymmetry, and it is documented. The fatal error log has a fallback:

> *"If the file exists, and is writeable, then it will be overwritten. Otherwise, if the file
> can't be created in the specified directory (due to insufficient space, permission problem, or
> another issue), then the file is created in the temporary directory for the operating system…
> Non-Windows: The temporary directory is `/tmp`."*

**The heap dump has no such documented fallback.** The `-XX:HeapDumpPath` entry says where the
file is created and says nothing about what happens when it cannot be. So the failure you must
plan for is: the process dies of `OutOfMemoryError`, `-XX:+HeapDumpOnOutOfMemoryError` fires, the
directory is read-only, and the single artefact that would have told you *why* does not exist. You
restart, the leak resumes, and you have learned nothing.

## The shape that works

Give the JVM exactly two writable places and point everything at them explicitly.

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
volumeMounts:
  - name: tmp
    mountPath: /tmp
  - name: dumps
    mountPath: /dumps
volumes:
  - name: tmp
    emptyDir: {}
  - name: dumps
    emptyDir: {}
```

```dockerfile
USER 1000:1000
ENV JDK_JAVA_OPTIONS="-XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/dumps \
  -XX:ErrorFile=/dumps/hs_err_pid%p.log"
ENTRYPOINT ["java", "-jar", "application.jar"]
```

Three things about that pair are deliberate:

1. **`/tmp` is a mount, not the image's `/tmp`.** The JFR repository, `java.io.tmpdir`, Tomcat's
   work directory and the `hsperfdata` directories all land there without further configuration.
2. **Dumps go somewhere separate from `/tmp`.** An `emptyDir` at `/tmp` disappears when the pod
   does, and a heap dump you cannot retrieve is a heap dump you did not take. For dumps that must
   survive the pod, that volume is a PVC or an object-store sidecar, not an `emptyDir` — and
   `fsGroup` is what makes it writable by UID 1000.
3. **`%p` expands to the PID**, which the tool reference documents for both `ErrorFile` and
   `HeapDumpPath`. Without it, a container that OOMs twice overwrites the first dump.

⚠️ **Size the dump volume against the heap, not against a guess.** A heap dump is the live heap,
so a pod with a multi-gigabyte heap needs a multi-gigabyte volume, and an `emptyDir` without a
`sizeLimit` consumes node ephemeral storage — which can get the pod evicted while it is dying,
turning one incident into two. Topic 04 owns dump analysis; this is the packaging half of it.

## The certificate trap, documented by the image publisher

Eclipse Temurin's official-image documentation describes what happens to its CA-certificate
handling under exactly these two settings, and it is worth reading as a general warning about
what "read-only" breaks:

> *"**Your containers are run with a non-`root` UID**: Since neither the default JVM truststore
> nor the system CA store can be written to by a non-`root` user, the system CA store will not be
> updated, while a separate truststore will be provided to the JVM. Your certificates will get
> added to that truststore and the `JAVA_TOOL_OPTIONS` environment variable will be automatically
> extended to switch the JVM over to this new truststore."*

> *"**Your containers are run with a read-only filesystem**: The same restrictions apply as with
> running containers with a non-`root` UID. In addition, a writable volume is required at `/tmp`
> to be able to create the new truststore."*

Two things to take from that. First, a mainstream Java base image ships an entrypoint script that
**mutates `JAVA_TOOL_OPTIONS` behind your back** — benign here, but it is the reason a JVM can be
running with options that appear in no manifest you control. Second, the publisher's own answer to
a read-only root filesystem is *"a writable volume is required at `/tmp`"*. That mount is not
optional decoration; it is load-bearing for an image you did not write.

## Ownership: `COPY --chown`, and what the AOT cache needs

The extracted layers from [02b](02b-extracting-layers-and-the-image-cache.md) are copied while the
build runs as root. Under a numeric `USER`, the process needs to **read** them — which is normally
satisfied by default permissions — but any directory the application writes into must be owned by
the runtime UID, and `COPY --chown=1000:1000` is how you say so at build time rather than with a
`RUN chown` that duplicates the whole layer.

The AOT cache and CDS archive from [02d](02d-the-cache-variants-of-the-dockerfile.md) are
**read-only at runtime**: the training run happens in the builder stage, and the production run
loads the file. That is one of the underrated advantages of build-time training — a read-only root
filesystem cannot break it. ⚠️ The exception is `-XX:+AutoCreateSharedArchive`, which the tool
reference describes as creating the archive on the fly so that *"it's no longer necessary to have a
separate trial run"*. Convenient on a laptop; it needs a writable path, so it is the wrong choice
inside a hardened image.

## Gotchas

**★ `runAsNonRoot: true` does not choose a user.** It is a validation that the image *"does not
run as UID 0"* and it fails the container start if it would. Without a `USER` in the Dockerfile or
a `runAsUser` in the manifest, you have added a gate, not a user.

**★ Put a numeric UID in `USER`.** The validation is expressed in terms of UID 0, and a name has
to be resolved through `/etc/passwd` — a file a distroless or `jlink`ed image may not usefully
contain. `USER 1000:1000` is unambiguous everywhere.

**★ A read-only root filesystem silently disables the OOM heap dump.** `-XX:HeapDumpPath` defaults
to the current working directory and the tool reference documents **no fallback** when the file
cannot be created — unlike `-XX:ErrorFile`, which explicitly falls back to `/tmp`. Set
`-XX:HeapDumpPath` to a mounted volume, always.

**★ Without `%p`, the second dump overwrites the first.** The tool reference documents `%p` as the
process identifier for both `HeapDumpPath` and `ErrorFile`. A crash-looping pod produces exactly
one artefact without it, and it is the least interesting one.

**★ A dump on an `emptyDir` dies with the pod.** If the container OOMs and Kubernetes restarts it
in place, the volume survives; if the pod is rescheduled, it does not. Decide which of those you
are protecting against before you choose the volume type.

**★ An `emptyDir` without a `sizeLimit` can get you evicted mid-incident.** A heap dump is the
size of the live heap. Writing several gigabytes into node ephemeral storage while the process is
already failing is how one outage becomes two.

**★ JFR writes to the system temporary directory by default.** *"Specifies the repository (a
directory) for temporary disk storage. By default, the system's temporary directory is used."* No
writable `/tmp`, no continuous recording — and topic 06's always-on-JFR strategy quietly does not
apply to your hardened pod.

**★ No writable `/tmp` also means no `hsperfdata`, and `jps`/`jstat` stop seeing the process.**
`-XX:+UsePerfData` is on by default and creates *"the `hsperfdata_userid` directories"*. If those
cannot be created, the tools that enumerate "instrumented JVMs" have nothing to enumerate. `jcmd`
against a known PID is the fallback — and in a container the JVM is usually PID 1 anyway.

**★ Tomcat and multipart uploads need `java.io.tmpdir` to be writable.** This is the one that
shows up as a user-visible 500 rather than a missing artefact, on the first request that uploads a
file. It is the same `/tmp` mount; it is listed separately because it fails in production traffic
rather than during diagnosis.

**★ `fsGroup` is what makes a mounted volume writable by a non-root process.** Mounting a volume
does not grant your UID permission to write to it. The task page is explicit: with `fsGroup` set,
*"The owner for volume /data/demo and any files created in that volume will be Group ID 2000."*

**★ A base image may rewrite `JAVA_TOOL_OPTIONS` for you.** Temurin's images do it for the CA
truststore under exactly these settings. If you also set `JAVA_TOOL_OPTIONS`, understand whether
you are appending to or replacing the publisher's value — and prefer `JDK_JAVA_OPTIONS` for your
own flags, which the `java` launcher treats separately.

**★ `-XX:+AutoCreateSharedArchive` needs a writable path.** It exists so that *"it's no longer
necessary to have a separate trial run"*, which is precisely the trial run you already did in the
builder stage. Inside a hardened image, train at build time and load read-only.

**★ Running as non-root does not make the container's root filesystem read-only, and vice
versa.** They are independent settings that fail in different ways, and a checklist that ticks one
and assumes the other is how a "hardened" template ships with a writable `/`.

## Interview questions

**★ What does `runAsNonRoot: true` actually do?**
It is a validation, not an assignment. The API reference says the kubelet *"will validate the
image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if
it does."* The user is chosen by the image's `USER` instruction or by `runAsUser`. Setting only
`runAsNonRoot` on an image whose `USER` is root produces a container that will not start — which
is the intended behaviour and surprises people who expected it to *make* the process non-root.

**★ You set `readOnlyRootFilesystem: true` and the service works fine. What have you broken?**
Everything the JVM writes for diagnosis. The heap dump and the fatal error log default to the
current working directory; the JFR repository and the `hsperfdata` directories default to the
system temporary directory; `java.io.tmpdir` is where Tomcat and multipart uploads spool. The
fatal error log has a documented fallback to `/tmp`; the heap dump does **not**. So the first
`OutOfMemoryError` in production produces no artefact at all.

**★ Which single mount matters most, and why?**
A writable `/tmp`. It covers the JFR repository, `java.io.tmpdir`, the `hsperfdata` directories
and — for Temurin's images — the CA truststore the entrypoint script builds, which its own
documentation says requires *"a writable volume … at `/tmp`"*. Dumps deserve a second, separate
volume because they must outlive the pod and are sized by the heap.

**★ Why put `%p` in `-XX:HeapDumpPath`?**
Because it expands to the process identifier, and without it a restarting container writes every
dump to the same filename. A pod in a crash loop then leaves you with one file, most likely from
the least informative run. The `java` tool reference documents `%p` for both `HeapDumpPath` and
`ErrorFile`.

**★ Does a read-only root filesystem break the AOT cache or the CDS archive?**
No, provided the cache was created during the build, which is what
[02d](02d-the-cache-variants-of-the-dockerfile.md) does. At run time the JVM only reads the file.
That is an underrated argument for build-time training. The exception is
`-XX:+AutoCreateSharedArchive`, which creates the archive at runtime and therefore needs a
writable path — the wrong tool for a hardened image.

**★ Your image runs as UID 1000 and a mounted PVC is not writable. What is missing?**
`fsGroup`. Mounting a volume does not confer write permission on an arbitrary UID; the task page
states that with `fsGroup` set, the owner of the volume and of files created in it is that group
ID, and the container's processes are added to it as a supplementary group. Without it, the
directory belongs to root and your process cannot write.

**★ Why prefer a numeric `USER` over a named one?**
Because the container runtime and the kubelet reason about UIDs. A minimal image — distroless, or
a `jlink`ed runtime on a scratch-like base — may have no useful `/etc/passwd` for a name to be
resolved against, and `runAsNonRoot`'s check is defined against UID 0. `USER 1000:1000` removes an
entire class of "cannot verify user is non-root" start-up failure.

**★ A JVM in production is clearly running with an option nobody can find in the manifest or the
Dockerfile. Where do you look?**
The environment. `JDK_JAVA_OPTIONS` is documented as prepending its content to the launcher's
command line, `JAVA_TOOL_OPTIONS` is the JVMTI-defined equivalent, and mainstream base images
modify the latter themselves — Temurin's documentation says the variable *"will be automatically
extended to switch the JVM over to this new truststore"* when the container runs non-root. Print
the full command line and the environment from inside the container before assuming someone
changed a file.

{/* FOOTER */}
