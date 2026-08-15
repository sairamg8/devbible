---
title: "Containers vs VMs vs serverless"
sidebar_label: "13 · Containers vs VMs"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [Docker security](https://docs.docker.com/engine/security/),
> [Kata Containers](https://katacontainers.io/) and
> [gVisor](https://gvisor.dev/docs/). **No sandbox** — no console output on this
> page.

**A VM virtualises hardware and runs its own kernel. A container virtualises the
operating system's view of itself and shares the host kernel. Serverless hides
both and bills you per invocation.** The choice is a trade between isolation
strength, startup time, density and how much you want to operate.

## The comparison that matters

| | **Virtual machine** | **Container** | **Serverless** |
|---|---|---|---|
| Kernel | Its own | **Shared with the host** | Provider's, hidden |
| Boots in | Tens of seconds | Milliseconds | Milliseconds, plus cold starts |
| Overhead per instance | Hundreds of MB to GB | Megabytes | None visible |
| Density per host | Tens | Hundreds to thousands | Not your problem |
| Isolation strength | **Strong** — hardware-assisted | Moderate — kernel-enforced | Strong (VM underneath, usually) |
| What you patch | Guest OS + app | Image + host kernel | App only |
| Long-running work | Fine | Fine | Poorly suited — execution limits |
| State | Yours to manage | Ephemeral by default | Stateless by design |
| Portability | Image formats vary | **One image, everywhere** | Provider-shaped |

## The one-line decision rule

- **Container** — you are running a service you wrote, you want it to start
  fast, run identically everywhere, and pack densely. This is the default for
  application code, and the whole subject of this track.
- **VM** — you need a different kernel, kernel-level features, or a hard
  security boundary between tenants you do not trust. Also: any legacy system
  that assumes it owns a machine.
- **Serverless** — the work is spiky, short and stateless, and you would rather
  pay per invocation than operate anything. Image cold starts and execution
  limits are the constraints to check first.

**They are not exclusive.** The overwhelmingly common production shape is
**containers running inside VMs**: the cloud provider gives you VM-level
isolation between tenants, and you get container density and speed inside your
own VM. Kubernetes nodes are VMs almost everywhere.

## The isolation argument, precisely

The honest statement is the one from
[A container is a process](01-a-container-is-a-process.md): a container is a
**real** isolation boundary and a **weaker** one than a VM's, because the kernel
is shared. A kernel vulnerability reachable from inside a container is a
potential escape; the equivalent in a VM has to get through the hypervisor
first, which is a much smaller and more scrutinised surface.

That does not mean containers are insecure — it means the defence is layered
rather than architectural:

- non-root `USER`, and rootless where possible
- `--cap-drop=ALL` with the minimum added back
- the default seccomp profile left on
- AppArmor or SELinux enforcing
- `--read-only` root filesystem
- a patched **host** kernel, which matters more than it would for VMs

## When you want both: sandboxed runtimes

Because the OCI runtime is a replaceable component (see
[The OCI specifications](08-oci-specs.md)), you can keep the container workflow
and change the isolation mechanism:

| Runtime | Approach |
|---|---|
| **Kata Containers** | Runs each container in a lightweight VM, with its own kernel |
| **gVisor** | Interposes a user-space kernel that services syscalls instead of the host kernel |
| **Firecracker** | Minimal VMM built for exactly this, underneath several serverless platforms |

Your Dockerfile, your image and your Compose file are unchanged. You pay startup
time and some performance for a stronger boundary. This is the answer to "we
need to run untrusted user code" — not `--privileged` and hope.

## What containers are genuinely bad at

Worth stating, because the enthusiasm often skips it:

- **Different kernel or kernel modules.** Not possible. Use a VM.
- **GUI and desktop workloads.** Possible, awkward, rarely worth it.
- **Hard multi-tenant isolation of untrusted code.** Use a VM or a sandboxed
  runtime.
- **Very stateful, very write-heavy systems** *without* careful volume design —
  the union filesystem is the wrong place for that traffic
  ([OverlayFS](07-overlayfs.md)).
- **Anything assuming it owns the machine** — reads `/proc/meminfo`, counts
  CPUs, writes to `/etc` at runtime, expects an init system. It will run, and it
  will behave strangely ([cgroups](03-cgroups.md)).

## Gotchas

**Symptom:** "We containerised it and it uses more memory than the VM did."
**Cause:** Usually the application sizing itself from host figures — heap,
thread pools, worker counts — because CPU and memory are not namespaced.
**Fix:** Pass the intended limits explicitly. See
[cgroups v2](03-cgroups.md); this is the single most common containerisation
regression.

**Symptom:** A security review rejects containers for a multi-tenant product.
**Cause:** Shared kernel, correctly identified.
**Fix:** VM-per-tenant, or a sandboxed runtime such as Kata or gVisor. Arguing
that containers are "secure enough" is the wrong move; changing the isolation
mechanism keeps the workflow and answers the objection.

**Symptom:** Serverless was chosen for a long-running worker and it keeps being
killed.
**Cause:** Execution time limits.
**Fix:** Long-running work belongs in a container. Serverless suits short,
spiky, stateless work; a queue consumer that runs for hours does not qualify.

## Interview questions

**★ What is the fundamental difference between a container and a VM?**
A VM virtualises hardware and runs its own kernel under a hypervisor. A container
is a process on the host kernel with a virtualised *view* of the system —
namespaces for visibility, cgroups for limits. Hence milliseconds versus tens of
seconds to start, and megabytes versus gigabytes of overhead.

**★ Are containers less secure than VMs?**
The isolation boundary is weaker because the kernel is shared, so a kernel
vulnerability is a potential escape. They are still a real boundary, defended in
layers — non-root, dropped capabilities, seccomp, MAC, rootless. For untrusted
code, use VM-backed isolation such as Kata or gVisor.

**★ When would you choose a VM over a container?**
A different kernel or kernel modules, a hard boundary between untrusted tenants,
or legacy software that assumes it owns a machine. Also anywhere compliance
demands hardware-level separation.

**Do containers replace VMs?**
No — they compose. Containers usually run inside VMs in production: the VM
provides the tenant boundary, the containers provide density and fast deploys.

**How do you get VM-grade isolation without giving up container workflow?**
Swap the OCI runtime for Kata Containers or gVisor. The image, Dockerfile and
Compose file are unchanged, because the runtime is a replaceable component behind
the OCI runtime specification.

---

← Prev: [Why "works on my machine" stops](12-works-on-my-machine.md) · Index: [Phase 0](README.md) · Next → [Installing an engine](14-installing.md)
