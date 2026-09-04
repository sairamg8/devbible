---
title: "A heap dump written into a container's own filesystem is deleted by the restart that made you want it, and the obvious fix — a memory-backed emptyDir — charges the dump against the very memory limit you were investigating"
sidebar_label: "08 · Getting a dump out"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Kubernetes documentation** — "Volumes"
> ([kubernetes.io](https://kubernetes.io/docs/concepts/storage/volumes/)), "Resource Management
> for Pods and Containers"
> ([kubernetes.io](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/))
> and `kubectl cp`
> ([kubernetes.io](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_cp/)); the
> **JDK 25 `java` tool reference** for `-XX:+HeapDumpOnOutOfMemoryError`, `-XX:HeapDumpPath`,
> `-XX:+ExitOnOutOfMemoryError`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> **JDK 25 `jcmd` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> Taking a dump and reading it is **04 · `OutOfMemoryError`** *(not written yet)* and
> [01d · Taking a heap dump on purpose](../01-memory-layout/01d-taking-a-heap-dump-on-purpose.md);
> this page is only about getting the file off a container alive.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Every part of the standard heap-dump advice assumes a machine you can log into and a disk that
persists. A container has neither. The default dump path is a directory that ceases to exist at
the next restart, the flag that triggers the dump does not fire for most container memory
failures, and the volume type that first suggests itself makes the problem worse. Deciding where
the file goes is a design decision you make *before* the incident, because there is no way to make
it afterwards.**

## Why the default path is useless here

`-XX:HeapDumpPath` defaults to the current working directory, with the file named
`java_pid<pid>.hprof`. That directory is in the container's writable layer, and the Kubernetes
documentation is unambiguous about what happens to it:

> *"One problem occurs when a container crashes or is stopped; the container state is not saved,
> so all of the files that were created or modified during the lifetime of the container are lost.
> **After a crash, kubelet restarts the container with a clean state.**"*

So the sequence is: the JVM throws, writes a multi-gigabyte dump, the process exits, the kubelet
restarts the container, and the dump is gone. You get a restart count and nothing else.

Worse, in the interval the dump existed it counted against the container's `ephemeral-storage`
limit and against the node's disk. A dump the size of the live heap, written on a node already
under disk pressure, can trigger a node-pressure eviction of *other* pods.

## `emptyDir`, and the trap inside it

An `emptyDir` volume survives a container restart, which is exactly the property needed:

> *"When a Pod is removed from a node for any reason, the data in the `emptyDir` is deleted
> permanently."* … *"**Note:** A container crashing does not remove a Pod from a node. The data in
> an `emptyDir` volume is safe across container crashes."*

That is the right primitive. Then comes the trap:

> *"If you set the `emptyDir.medium` field to `"Memory"`, Kubernetes mounts a tmpfs (RAM-backed
> filesystem) for you instead. While tmpfs is very fast, be aware that, unlike disks, **files you
> write count against the memory limit of the container that wrote them.**"*

🔴 **Writing a heap dump to a memory-backed `emptyDir` charges the entire dump against the memory
limit you are investigating.** A 2 GiB dump in a 4 GiB container is a guaranteed OOMKill, taken
at the exact moment you were trying to collect evidence, and it destroys the evidence in the
process. `medium: Memory` is right for a scratch cache and catastrophic for a dump.

```yaml
volumes:
  - name: dumps
    emptyDir:
      sizeLimit: 4Gi        # NOT medium: Memory
volumeMounts:
  - name: dumps
    mountPath: /dumps
```

```bash
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/dumps/heap-%p.hprof
-XX:+ExitOnOutOfMemoryError
```

`%p` expands to the PID and is the only expansion `HeapDumpPath` supports, which matters because
without it a restart overwrites the previous dump with a less interesting one.

## What that configuration does *not* cover

The man page, verbatim, on `-XX:+HeapDumpOnOutOfMemoryError`:

> *"This applies only to `OutOfMemoryError` exceptions caused by Java Heap exhaustion; it does not
> apply to `OutOfMemoryError` exceptions thrown directly from Java code, nor by the JVM for other
> types of resource exhaustion (such as native thread creation errors)."*

So the volume, the path and the flag together buy you a dump for `Java heap space` and nothing
else. No dump for metaspace, compressed class space, direct buffers, native threads or swap — and
above all **no dump for an OOMKill**, because `SIGKILL` runs no code.
[01c · The OOM flags and what they cover](../01-memory-layout/01c-the-oom-flags-and-what-they-cover.md)
is the full accounting.

For the failures that flag does not cover, the evidence you want is Native Memory Tracking output,
which is small enough to go to stdout and be shipped by the normal log path — no volume required.
That is [11 · Native Memory Tracking](../01-memory-layout/11-native-memory-tracking.md) and
[11b · The NMT baseline workflow](../01-memory-layout/11b-the-nmt-baseline-workflow.md).

## Taking a dump deliberately, from outside

```bash
# a dump, compressed, into the mounted volume
kubectl exec <pod> -- jcmd 1 GC.heap_dump -gz=1 /dumps/heap.hprof.gz

# the native side instead, which is far smaller and often the right answer
kubectl exec <pod> -- jcmd 1 VM.native_memory summary
kubectl exec <pod> -- jcmd 1 VM.info
```

`jcmd` documents `GC.heap_dump` with `-gz` where *"1 (recommended) is the fastest, 9 the strongest
compression"*, plus `-parallel` and `-overwrite`. Note that `jcmd` *"Request[s] a full GC unless
the `-all` option is specified"* — a full collection inside a container that is already under
memory pressure is not free.

Getting the file out:

```bash
# needs tar in the image
kubectl cp <namespace>/<pod>:/dumps/heap.hprof.gz ./heap.hprof.gz

# works on a distroless image, which has no tar
kubectl exec <pod> -- cat /dumps/heap.hprof.gz > ./heap.hprof.gz
```

`kubectl cp`'s own documentation carries the warning in capitals: *"Requires that the 'tar' binary
is present in your container image. If 'tar' is not present, 'kubectl cp' will fail."* A JRE base
image or a distroless image very often has no `tar`, so the second form is the one that works when
it matters.

## The durable option

`emptyDir` dies with the pod. If the pod is deleted — a rollout, a node drain, a scale-down — the
dump goes with it, and a service that is crash-looping is quite likely to be rolled back by
someone before you have copied anything.

The durable arrangements, in increasing order of effort:

1. **A `PersistentVolumeClaim`** mounted at the dump path. Survives the pod. Needs a
   `ReadWriteMany` class if more than one replica might dump at once, or a per-pod volume via a
   StatefulSet.
2. **A sidecar sharing the `emptyDir`** that watches for new `.hprof` files and uploads them to
   object storage. The dump survives the pod without a cluster storage dependency, and the sidecar
   needs its own memory limit that you have budgeted for.
3. **A `preStop` hook plus a longer `terminationGracePeriodSeconds`**, so a deliberately
   terminated pod has time to finish an upload. This does nothing for a `SIGKILL`.

## Gotchas

**★ `medium: Memory` on the dump volume converts an investigation into an outage.**
It is the single most damaging mistake on this page. The documentation says the files count
against the container's memory limit; a heap dump is roughly the size of the live heap. Use a
disk-backed `emptyDir` or a PVC.

**★ A dump needs disk at least the size of the live heap, and there may not be any.**
`ephemeral-storage` limits and node disk pressure both apply. A dump that fails half-written gives
you a corrupt file *and* a disk-pressure eviction. Set `sizeLimit` on the `emptyDir` deliberately,
and prefer `-gz`.

**★ Taking the dump can cause the second incident.**
`GC.heap_dump` requests a full GC by default and serialises the whole heap; in a tightly-sized
container that is a long pause, a burst of I/O and additional memory pressure. If liveness probes
are aggressive, the pod is restarted mid-dump. Raise or temporarily disable the liveness probe
before dumping a large heap.

**★ `jcmd` inside the container starts a second JVM.**
Small, but not free, and it comes out of the same limit. In a container already at 95 percent of
its limit, running `jcmd` can be what tips it over. Prefer an attach from a debug container where
your platform supports ephemeral containers sharing the process namespace.

**★ The PID is usually 1, and the tool may still not find it.**
`jcmd 1` works when the JVM is PID 1. If your entrypoint is a shell wrapper without `exec`, the
JVM is a child and PID 1 is `sh` — `jcmd` will not attach to it and `jcmd -l` is how you find the
real one. That shell wrapper is the same one that breaks graceful shutdown.

**★ Attach requires the same UID and a writable `/tmp`.**
The HotSpot attach mechanism uses a socket file under the temporary directory. A read-only root
filesystem without a writable `/tmp`, or an `exec` running as a different user from the JVM, makes
`jcmd` fail in ways that look like the JVM is unresponsive.

**★ A dump reveals everything in memory.**
Credentials, tokens, personal data, whole request bodies. A `.hprof` file is a data-protection
artefact: encrypt it in transit, control who can read the bucket, and delete it when the
investigation ends. This is a real reason not to leave dumps sitting in a shared PVC.

**★ For most container memory incidents the dump is the wrong artefact anyway.**
If the heap was flat and the pod was OOMKilled, a heap dump photographs the region you already
ruled out. NMT output is kilobytes, needs no volume, and answers the question the dump cannot.
Configure both; reach for NMT first.

**★ `-XX:+ExitOnOutOfMemoryError` and heap dumping cooperate, and the order matters.**
The dump is written by the `HeapDumpOnOutOfMemoryError` handler before the exit takes effect, so
using both gets you the file *and* a clean restart. Without the exit flag, an `Error` swallowed by
a framework leaves a half-broken process passing its liveness probe.

## Interview questions

**★ Your pod OOMKills nightly. Where do you put `-XX:HeapDumpPath`, and will it help?**
On a disk-backed volume that outlives the container — an `emptyDir` at minimum, a PVC or a
sidecar-uploaded object if the pod itself might be replaced — and explicitly **not** an
`emptyDir` with `medium: Memory`, because the Kubernetes documentation states that files written
to a tmpfs count against the writing container's memory limit, so the dump would itself cause the
kill. Will it help? For an OOMKill, no: `SIGKILL` cannot be handled, so no dump is ever written.
The configuration is worth having for the day the failure is `OutOfMemoryError: Java heap space`
instead, but for the nightly OOMKill the artefact I actually need is periodic NMT output.

**★ How do you get a 3 GiB heap dump out of a distroless container?**
First check there is somewhere to put it — a mounted volume with `sizeLimit` at least the size of
the live heap, since the container's own layer is both ephemeral and charged against
`ephemeral-storage`. Then `kubectl exec <pod> -- jcmd 1 GC.heap_dump -gz=1 /dumps/heap.hprof.gz`,
accepting that this triggers a full GC and a long pause, so I would relax the liveness probe first.
To retrieve it, not `kubectl cp` — distroless images have no `tar` and the documentation says
`kubectl cp` fails without it — but `kubectl exec <pod> -- cat /dumps/heap.hprof.gz` redirected to
a local file.

**★ What is wrong with `emptyDir` as the permanent answer?**
It is scoped to the pod, not to the container. It survives a crash and a restart, which is the
common case, but the documentation is explicit that when the pod is removed from the node for any
reason the data is deleted permanently — and a crash-looping pod is very likely to be deleted by a
rollback, a rollout, a node drain or a scale-down before anyone has copied the file. For an
artefact you need to keep, it has to reach a PersistentVolume or object storage, which in practice
means a sidecar that uploads or a volume that outlives the pod.

**★ Why might you deliberately choose not to configure heap dumps in a small container?**
Because the cost is concentrated at the worst moment. A dump is roughly the size of the live heap
in disk and I/O, it triggers a full GC, it can push the container over its `ephemeral-storage`
limit and it can be interrupted by the liveness probe — all while the service is already failing.
In a small container with a modest heap none of that is prohibitive, but if the dominant failure
mode is a native OOMKill, for which no dump is produced anyway, the configuration is pure downside.
The proportionate setup is NMT always on in the diagnostic sense, `-XX:+ExitOnOutOfMemoryError`
always, and heap dumping enabled when the heap is a live suspect.

{/* FOOTER */}
