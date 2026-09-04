---
title: "Kubernetes gives you two numbers per resource and the JVM can only see one of them, which makes the gap between request and limit a place where memory you were never guaranteed gets handed to the heap"
sidebar_label: "06 · Requests, limits and the JVM"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Kubernetes documentation** — "Resource Management for Pods
> and Containers"
> ([kubernetes.io](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/))
> and "Pod Quality of Service Classes"
> ([kubernetes.io](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/)); and the JDK 25
> HotSpot source at tag `jdk-25+36`,
> [`os/linux/os_linux.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/linux/os_linux.cpp).
> Container mechanics beyond what the JVM reads belong to the Docker and Kubernetes sections of
> this site; this page covers only the interaction.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A request is a promise from the scheduler; a limit is a threat from the kernel. The JVM has no
concept of the first and sizes itself entirely against the second. That asymmetry is the reason
the most common Kubernetes resource pattern — a modest request with a generous limit, so the pod
can "burst" — is actively hostile to a JVM: it hands the heap memory the cluster never guaranteed
it, on a node that may not have it when it is needed.**

## The two numbers

> *"If the node where a Pod is running has enough of a resource available, it's possible (and
> allowed) for a container to use more resource than its request for that resource specifies."*

> *"Both `cpu` and `memory` limits are applied by the kubelet (and container runtime), and are
> ultimately enforced by the kernel. On Linux nodes, the Linux kernel enforces limits with
> cgroups."*

The request is used by the scheduler to decide where the pod fits, and by the kernel as a
proportional weight under contention. The limit becomes the cgroup's `memory.max` and `cpu.max`.

**The JVM reads the cgroup.** `os::physical_memory()` returns `memory_limit_in_bytes()`; the
processor count comes from the CPU quota. There is no cgroup file that carries the memory request
at all in the ordinary configuration, so the JVM literally cannot see it.

## The consequence for memory

Suppose `requests.memory: 1Gi` and `limits.memory: 4Gi`, with `MaxRAMPercentage=70`.

- The scheduler places the pod on a node with 1 GiB free. That is the promise.
- The JVM sees a 4 GiB limit and takes a **2.8 GiB heap ceiling**.
- The heap grows into memory that was never reserved for this pod, on a node the scheduler filled
  on the assumption that this pod would use 1 GiB.
- When the node fills, the kubelet evicts by QoS class, and — the documentation again — *"only Pods
  exceeding resource requests are candidates for eviction."* This pod is 1.8 GiB over its request.
  It is the candidate.

**For a JVM, `requests.memory` should equal `limits.memory`.** Not because Guaranteed QoS is a
prize, but because the JVM will size itself to the limit whatever you write in the request, so any
gap is memory the JVM will use and the cluster has not set aside.

## The consequence for CPU

The mirror image, and it goes the other way. `requests.cpu` maps to `cpu.weight`, which the JVM
has ignored since JDK 19 — [05](05-cpu-limits-and-ergonomics.md). So:

- **A CPU limit** produces a quota, which the JVM reads, so the pools are sized for the
  entitlement. It also means throttling, which is a real cost.
- **No CPU limit** produces no quota, so the JVM sizes for the whole node. No throttling, badly
  sized pools.

Unlike memory, there is a genuine debate here, and both positions are defensible. What is not
defensible is picking "no CPU limit" and then not setting `-XX:ActiveProcessorCount`.

## QoS classes, and which one a JVM wants

The criteria, from the QoS documentation:

**Guaranteed** — *"Every Container in the Pod must have a memory limit and a memory request, both
greater than zero. For every Container in the Pod, the memory limit must equal the memory request.
Every Container in the Pod must have a CPU limit and a CPU request, both greater than zero. For
every Container in the Pod, the CPU limit must equal the CPU request."*

**Burstable** — *"The Pod does not meet the criteria for QoS class Guaranteed. At least one
Container in the Pod has a memory or CPU request or limit."*

**BestEffort** — neither of the above.

And the ordering that matters at 3 a.m.:

> *"When a Node runs out of resources, Kubernetes will first evict BestEffort Pods running on that
> Node, followed by Burstable and finally Guaranteed Pods."*

```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1"
  limits:
    memory: "2Gi"     # equal to the request: the JVM sizes against a number you own
    cpu: "1"          # gives the JVM a quota to read
```

That is `Guaranteed`, and for a JVM it is the default worth deviating from deliberately rather
than the exotic option.

## Gotchas

**★ A limit with no request silently becomes a request.**
The documentation: *"If you specify a limit for a resource, but do not specify any request, and no
admission-time mechanism has applied a default request for that resource, then Kubernetes copies
the limit you specified and uses it as the requested value."* So `limits` alone gives you
`Guaranteed`. `requests` alone gives you `Burstable` and a JVM that sees the node.

**★ A LimitRange or a mutating admission webhook can rewrite what you wrote.**
Namespace defaults are applied at admission, so the manifest in git is not necessarily the
resource spec that ran. Read the resolved pod spec, not the template, before concluding the JVM
was given the wrong numbers.

**★ Guaranteed does not mean immune.**
Guaranteed pods are evicted last, not never — the documentation says they are guaranteed not to be
killed *"until they exceed their limits or there are no lower-priority Pods that can be preempted
from the Node."* And Guaranteed says nothing about the OOM killer: exceeding your own limit gets
you killed regardless of QoS class.

**★ Eviction and OOMKill produce different evidence and need different fixes.**
Eviction is the kubelet acting on node pressure and shows as `Evicted` with the pod rescheduled
elsewhere; an OOMKill is the kernel acting on your cgroup and shows as `Reason: OOMKilled` with an
in-place restart. Fixing an eviction means requests and node capacity; fixing an OOMKill means the
limit and the process. [01 · The OOMKilled loop](01-the-oomkilled-loop.md).

**★ In a multi-container pod, the JVM sees the *container's* limit, not the pod's.**
Per-container limits become per-container cgroups. A sidecar's memory does not appear in the JVM's
view, but it does appear in the pod's total consumption and in the node's. Budget the sidecar
separately and remember the JVM will not leave room for it.

**★ Pod-level resources change the picture and are recent.**
The QoS documentation now describes Pod-level requests and limits — *"Beta since Kubernetes v1.34;
enabled by default"* — with their own Guaranteed criteria. Where a pod-level memory limit is
lower than the container's, the JVM's hierarchy walk will find it
([02b](02b-cgroup-v1-v2-and-the-hierarchy.md)). Check which mechanism your cluster uses before
reasoning about which number the JVM read.

**★ Setting a memory request below the limit is how a cluster gets overcommitted.**
The scheduler packs nodes against requests. If every JVM on a node is using its limit rather than
its request, the node's real usage exceeds what the scheduler believed and *something* gets
evicted — quite possibly a different, innocent pod. This is the mechanism by which one badly
specified Java service degrades a whole node.

**★ Memory is incompressible; CPU is not.**
This is the reason the two resources deserve opposite advice. A pod over its CPU limit is
throttled and survives; a pod over its memory limit is killed. Bursting is a coherent strategy for
a resource that degrades gracefully and an incoherent one for a resource that kills you.

**★ `container_memory_working_set_bytes` is what the kubelet compares against the limit-ish
threshold, and it is not RSS.**
It includes page cache attributable to the cgroup. Alert on it, because it is closest to what
drives the kill decision — but compare `-Xmx` against RSS, not against it, or you will chase page
cache as though it were heap.

## Interview questions

**★ What is the difference between a Kubernetes request and a limit, and which one does the JVM
see?**
The request is what the scheduler reserves when placing the pod and what the kernel uses as a
proportional weight under contention; the limit is the cgroup ceiling the kernel enforces —
throttling for CPU, an OOM kill for memory. The JVM sees only the limit, because that is what
appears in `memory.max` and `cpu.max`, and there is no cgroup file carrying the request. So
`MaxRAMPercentage` is a percentage of the limit, and the processor count comes from the CPU quota.
Anything you express only as a request is invisible to JVM sizing.

**★ Why should a Java pod's memory request equal its memory limit?**
Because the JVM will size its heap against the limit regardless of what the request says, so any
gap between them is memory the JVM is going to use and the scheduler has not reserved. That pod is
then, by definition, exceeding its request, which makes it a preferred eviction candidate under
node pressure, and it contributes to node-level overcommit that can get *other* pods evicted. When
request equals limit the pod is `Guaranteed`, the scheduler has actually set aside what the JVM
will take, and the heap sizing calculation is against a number the cluster owns.

**★ Is it acceptable to run a JVM with no CPU limit?**
Yes, if you compensate. Omitting the CPU limit avoids CFS throttling, which is a real latency
source, and lets the pod use idle node capacity. The cost is that the JVM sees no quota and sizes
GC workers, compiler threads, the common ForkJoinPool and virtual-thread carriers for the entire
node. The compensation is `-XX:ActiveProcessorCount` set to the CPU request. Without it the
configuration is a trap: the pod is entitled to a fraction of a CPU under contention and behaves
as though it owns sixty-four.

**★ What is the difference between your pod being evicted and being OOMKilled, in terms of what
you change afterwards?**
An OOMKill means your container exceeded its own memory limit; the kernel sent `SIGKILL`, the pod
restarted in place, and `Last State` reads `Reason: OOMKilled`. You fix it by re-deriving the
memory budget or raising the limit. An eviction means the *node* was under pressure and the
kubelet chose your pod because it was in a lower QoS class or exceeding its request; the pod is
marked `Evicted` and rescheduled. You fix that with requests, QoS class and node capacity, and no
JVM flag helps. The two are routinely conflated because both show up as "the pod went away".

**★ Your platform team applies a LimitRange that sets memory limits to twice the request. What do
you do about your JVM?**
Recognise that every JVM in that namespace is sizing its heap against twice what the cluster
reserved, and that the whole namespace is systematically overcommitted. The immediate mitigation
is to lower `MaxRAMPercentage` so that the heap fits within the *request* rather than the limit —
that is, if the ratio is 2:1 and you wanted 70 percent of the request, set roughly 35 percent of
the limit. The proper fix is to make request equal limit for JVM workloads, and the argument to
make is that the JVM cannot see the request, so the LimitRange is not creating burst headroom, it
is creating a permanently over-sized heap.

{/* FOOTER */}
