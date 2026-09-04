---
title: "Once Native Memory Tracking comes back flat and the process is still growing, every remaining tool is an operating-system tool — and the order you run them in matters more than any single one of them"
sidebar_label: "11d · Finding it outside the JVM"
sidebar_position: 45
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 Troubleshooting Guide**
> ([docs.oracle.com/en/java/javase/25/troubleshoot/](https://docs.oracle.com/en/java/javase/25/troubleshoot/))
> for NMT's scope, and the Linux `proc(5)`, `pmap(1)` and `mallopt(3)` manual pages for the
> operating-system side. JDK 25 · Spring Boot 4.1.1 · Linux containers assumed.
> **No sandbox and no container here** — commands and their documented behaviour only.
> **No captured `pmap`, `smaps` or NMT output**, and no invented byte counts.

**[11c](11c-the-footprint-that-is-not-in-any-region.md) named what can be in the gap between
NMT's committed total and the kernel's RSS. This chunk is how you actually go and look — and the
important part is not the commands, which are four, but the order, because the two cheapest steps
are the ones that most often end the investigation and the one everybody starts with is near the
end.**

## The commands, and what each one adds

None of these are JVM tools, which is the point:

```bash
# Total resident, and the breakdown by mapping type — the fastest first look
cat /proc/<pid>/smaps_rollup

# Every mapping, with sizes and what backs it (file, heap, anonymous)
pmap -X <pid>

# The coarse numbers: VmRSS, VmSize, threads
grep -E 'VmRSS|VmSize|Threads' /proc/<pid>/status

# What the cgroup thinks — this is the number that gets you killed
cat /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.max     # cgroup v2
```

The order is deliberate. `smaps_rollup` gives the totals in one read. `pmap -X` is where you find
a mapping backed by a `.so` you did not know was loaded, or a very large anonymous region that
belongs to an allocator arena, or a mapped file. And the cgroup files are the arbiter, because
**the number that decides whether your container survives is the cgroup's, not the JVM's and not
`top`'s.**

🔴 **Compare like with like.** NMT reports committed bytes from the JVM's perspective; RSS reports
resident pages from the kernel's; the cgroup counts its own set including page cache in some
configurations. Three tools, three definitions. A "discrepancy" between them is usually a
definitional difference, and the discipline is to pick the number that corresponds to the failure
you are chasing — for an OOMKill, that is the cgroup's.

## An ordered plan for the unexplained gap

1. **Confirm it is this process.** Which PID did the kernel kill, and what else is in the
   container? One command, and it ends a surprising fraction of these investigations.
2. **Confirm the limit.** Read `memory.max` rather than the manifest. Requests and limits get
   edited, defaulted and overridden.
3. **Rule the JVM in or out.** NMT `summary`, and a `baseline`/`summary.diff` over a meaningful
   interval — [11b](11b-the-nmt-baseline-workflow.md). If a category is growing, this chapter is
   the wrong one and the growth is inside the JVM after all.
4. **Check `Other` specifically** before concluding "native". Direct byte buffers are the most
   common "native" growth that is actually visible to NMT.
5. **Look at the mappings.** `pmap -X` and `smaps_rollup`. A large anonymous region points at the
   allocator; a file-backed one points at a mapping; an unexpected `.so` points at a library.
6. **Ask whether it plateaus.** Allocator retention plateaus; a leak does not. This takes time and
   is worth the time, because the two have completely different fixes.
7. **Then, and only then, change something.** `MALLOC_ARENA_MAX`, or a different allocator, or —
   if jemalloc's profiling named a call stack — the library that owns it.

The reason for the order is that steps 1–2 are free and frequently decisive, while step 7 is the
one everybody wants to start with.

## Gotchas

**★ The cgroup's number is the one that kills you.** Not `top`, not the JVM's, not NMT's. When
diagnosing an OOMKill, read `memory.current` and `memory.max` and reason from those.

**★ Something else in the container shares the limit.** A sidecar, a log shipper, an init process,
a shell someone left open. The JVM is the largest process, so it is assumed to be the guilty one,
and it frequently is not.

**★ `jcmd` may not be present in your image.** A JRE-only or distroless base image can leave you
with a production incident and no JVM tooling at all. That is a packaging decision made months
earlier — **topic 10** *(not written yet)* weighs it — and it is felt exactly here.

**★ A native agent allocates outside NMT.** Profilers, APM agents and security agents attach and
allocate. If the gap appeared when an agent was rolled out fleet-wide, that correlation is the
investigation.

**★ Thread stacks are committed lazily.** Reserved stack size is not resident until the thread
actually touches the pages, so a thousand mostly-idle threads cost far less RSS than
`threads × -Xss` suggests. Sizing from the reserved figure over-provisions;
[06 · Thread stacks](06-thread-stacks.md) has the real arithmetic.

**★ Restarting "fixes" all of these, which is why they persist.** Allocator retention, a slow
native leak and a genuine JVM leak all disappear on restart and all come back. A restart schedule
is a way of not knowing which one you have.

**★ `smaps_rollup` and `pmap` disagree with `top`, and all three are right.** They count
different things — resident anonymous pages, every mapping including file-backed ones, and the
kernel's own summary. Pick the one that matches the failure you are chasing; for an OOMKill that
is the cgroup's counter, not any of these.

**★ A mapping backed by a `.so` you do not recognise is a finding, not noise.** `pmap -X` naming
a library nobody knew was loaded — an APM agent, a native crypto provider pulled in transitively —
is often the whole answer, and it is invisible from inside the JVM.

## Interview questions

**★ How do you find out what is actually in a process's memory when the JVM's own tools have run
out?**
Leave the JVM's tools behind. `/proc/<pid>/smaps_rollup` gives the resident total and its
breakdown in one read. `pmap -X <pid>` enumerates every mapping with its size and what backs it,
which is where an unexpected shared library, a large file mapping, or a very large anonymous
region belonging to an allocator arena becomes visible. `/proc/<pid>/status` gives VmRSS and the
thread count. And the cgroup files — `memory.current` and `memory.max` — give the number that
actually decides whether the container is killed. If the gap is still unattributed after that,
switching to jemalloc with allocation profiling enabled is the tool that can name a call stack.

**★ Why is "the JVM is using too much memory" often the wrong first hypothesis in a container?**
Because a cgroup limit covers the whole container, not the JVM, and the JVM is merely the most
conspicuous process in it. Sidecars, log shippers, init processes and a forgotten debug shell all
draw on the same limit. Establishing which process the kernel actually killed, and what else is
resident, costs one command and settles it. The second reason is that the limit itself is often
not what the manifest says — defaults, overrides and edits happen — so reading `memory.max`
directly is worth doing before any analysis at all.

**★ Your image is distroless and the incident is a native memory gap. What is your position?**
That the packaging decision is now costing more than it saved. Distroless removes the shell and
the JDK tools, so `jcmd`, `pmap` and even `cat /proc/...` may all be unavailable inside the
container — which means NMT, thread dumps and mapping inspection are unavailable exactly when
they are needed. The immediate move is an ephemeral debug container sharing the process
namespace, if the platform supports it. The longer-term position is that "smaller image" and
"debuggable in production" are a real trade-off that should be made deliberately, and a service
whose failure modes are native-memory-shaped is a poor candidate for the smallest possible image.

**★ How would you tell a slow native leak from allocator retention from a slow Java heap leak,
given a memory graph that looks the same for all three?**
By narrowing with the tools in order rather than by looking harder at the graph. A Java heap leak
shows in the live set after a full collection, which rises across cycles — the GC log answers
that, and a heap dump names it. If the heap is flat, NMT with a baseline and a diff over a long
enough interval separates "the JVM is growing somewhere non-heap" from "the JVM is not growing".
If NMT is flat too, the growth is outside the JVM, and then the question is retention versus leak,
which is a shape question: retention plateaus at peak demand, a leak does not. Only at that point
is it worth reaching for allocator profiling to name the call stack.

**★ Why is the order of these commands more important than the commands themselves?**
Because the two cheapest steps eliminate the most. Confirming which process the kernel actually
killed, and reading the cgroup's real limit rather than the manifest's, cost one command each and
end a large share of these investigations outright — the JVM is frequently not the process that
died, and the limit is frequently not the number anyone believed. Everything after that is
progressively more expensive and more specific, so running it first means doing costly analysis
on a question you have not yet established is the right one.

**★ You have `pmap` output showing a 900 MB anonymous region and nothing else unusual. What is
your leading hypothesis?**
The C allocator's arenas. A large anonymous mapping that is not the Java heap and not a mapped
file is characteristically glibc holding freed memory it has not returned to the kernel, and a
highly threaded JVM creates many arenas by design. The confirming evidence is behavioural rather
than structural: allocator retention plateaus at the high-water mark of demand while a genuine
leak keeps climbing, so watching across more than one load cycle distinguishes them. If it is
retention, `MALLOC_ARENA_MAX` or switching to jemalloc are the levers — and jemalloc's allocation
profiling is what names a call stack if it turns out to be a real native leak after all.

{/* FOOTER */}

**★ Why is the order of these commands more important than the commands themselves?**
Because the two cheapest steps eliminate the most. Confirming which process the kernel actually
killed, and reading the cgroup's real limit rather than the manifest's, cost one command each and
end a large share of these investigations outright — the JVM is frequently not the process that
died, and the limit is frequently not the number anyone believed. Everything after that is
progressively more expensive and more specific, so running it first means doing costly analysis
on a question you have not yet established is the right one.

**★ You have `pmap` output showing a 900 MB anonymous region and nothing else unusual. What is
your leading hypothesis?**
The C allocator's arenas. A large anonymous mapping that is not the Java heap and not a mapped
file is characteristically glibc holding freed memory it has not returned to the kernel, and a
highly threaded JVM creates many arenas by design. The confirming evidence is behavioural rather
than structural: allocator retention plateaus at the high-water mark of demand while a genuine
leak keeps climbing, so watching across more than one load cycle distinguishes them. If it is
retention, `MALLOC_ARENA_MAX` or switching to jemalloc are the levers — and jemalloc's allocation
profiling is what names a call stack if it turns out to be a real native leak after all.

{/* FOOTER */}
