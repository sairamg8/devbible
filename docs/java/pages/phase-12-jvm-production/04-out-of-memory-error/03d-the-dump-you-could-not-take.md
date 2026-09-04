---
title: "The four ways a heap dump fails are the pause, the disk, the analysis machine and the lawyer — and three of them are decided before you type the command, which is why the dump you need is so often the dump you did not get"
sidebar_label: "03d · The dump you could not take"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference** — `GC.heap_dump`'s documented
> impact and options
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), the
> **Eclipse Memory Analyzer documentation** — "Batch mode" and "Export Heap Dump", for
> `ParseHeapDump.sh`, `-keep_unreachable_objects`, the `discard_*` options and the `redact`
> levels ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/tasks/batch.html)),
> and the **JDK 25 HotSpot source at tag `jdk-25+36`**, `services/heapDumper.cpp`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/services/heapDumper.cpp)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A heap dump is the most expensive diagnostic in this phase and the one most likely to fail
halfway. It stops the world for the length of a full-heap walk, it writes a file roughly the size
of the live set to whatever filesystem you pointed at, it needs a second machine with enough
memory to index it, and it contains every string your process was holding — which is every
customer name, token and session identifier that happened to be in flight. Each of those four
constraints has a mitigation, and all four mitigations have to be arranged before the incident.**

## 1 · The pause

The `jcmd` reference rates `GC.heap_dump` *"Impact: High --- depends on the Java heap size and
content"*. The walk happens with the application stopped. On a multi-gigabyte heap that is long
enough to fail a default liveness probe, and the resulting restart kills the dump partway, leaving
a truncated file and an incident that is now two incidents.

Three mitigations, in order of value:

```bash
# 1. take the dump from a replica that is not serving
kubectl label pod <pod> serving=false          # or whatever removes it from the endpoints

# 2. raise or disable the probe timeout FIRST
#    (a dump of a 20 GB heap will exceed any sane probe window)

# 3. shorten the pause with threads, shrink the file with compression
jcmd 1 GC.heap_dump -parallel=8 -gz=1 /var/dumps/x_%p.hprof.gz
```

⚠️ `-parallel` defaults to **1**. The crash-time dump the JVM writes for itself uses about
three-eighths of the available CPUs; the command you type uses one writer unless you ask. This is
the single cheapest improvement available and it is skipped in almost every runbook.

## 2 · The disk

The file is approximately the size of the live set before compression, and `-gz` typically shrinks
it a great deal because HPROF is highly repetitive. Two failure modes:

**The path is ephemeral.** `-XX:HeapDumpPath`'s default is the current working directory, which in
a container image is a writable overlay layer that vanishes with the container. The dump is
written, the pod restarts, the evidence goes with it.

**The path has a smaller limit than the heap.** A Kubernetes `ephemeral-storage` limit smaller
than the live set means the write fills the limit and the pod is **evicted** — a second, unrelated
outage caused by investigating the first.

```yaml
volumeMounts:
  - name: dumps
    mountPath: /var/dumps
volumes:
  - name: dumps
    persistentVolumeClaim:
      claimName: heap-dumps         # sized for the largest heap in the deployment
```

```
-XX:HeapDumpPath=/var/dumps        # a directory: the JVM appends java_pid<pid>.hprof itself
```

## 3 · The analysis machine

This is the constraint people meet last and it ends more investigations than the other three
combined: **the tool that opens the dump is itself a JVM with its own `-Xmx`**, and it has to
build several index files over the object graph. "The dump is too big to open" is the usual
outcome of a 20 GB file on a laptop.

Memory Analyzer has a headless mode for exactly this, and it is the correct answer:

```bash
# parse on a large machine, produce the report, then read the HTML anywhere
./mat/ParseHeapDump.sh /var/dumps/x.hprof org.eclipse.mat.api:suspects
./mat/ParseHeapDump.sh /var/dumps/x.hprof org.eclipse.mat.api:overview
./mat/ParseHeapDump.sh /var/dumps/x.hprof -command=histogram org.eclipse.mat.api:query
```

Raise the parser's own heap in `MemoryAnalyzer.ini` before running it — the indexes it writes
(`.idx.index`, `.inbound.index`, `.outbound.index`, `.o2c.index`, `.a2s.index`, `.o2hprof.index`)
live next to the dump and add meaningfully to the disk requirement as well.

Two options exist for genuinely unmanageable files, both marked **Experimental** in MAT's own
documentation and both to be used knowingly:

```
-discard_ratio=<percentage>    # discard a fraction of the objects from huge dumps
-discard_pattern=<regex>       # class names of objects to be discarded
```

They make the file openable by making it incomplete. Retained sizes computed from a discarded
dump are not the retained sizes of your process.

## 4 · The lawyer

🔴 **An HPROF file contains every `String` your process was holding.** Customer names, email
addresses, bearer tokens, session identifiers, decrypted payloads, the contents of any request in
flight, and — since `BigInteger` is backed by an `int[]` — potentially private key material. A
heap dump is a data-protection artefact with the same handling requirements as a database export,
and copying one to a laptop to "have a quick look" is a data transfer.

Memory Analyzer can produce a redacted copy, and this is the part of the tooling almost nobody
knows exists:

```bash
./mat/ParseHeapDump.sh original.hprof \
    -output=redacted.hprof \
    -redact=BASIC \
    -map=names.map \
    org.eclipse.mat.hprof:export
```

The documented levels:

> *"**NONE** — No redaction - all data is available in the new HPROF file."*
>
> *"**NAMES** — `char` and `byte` arrays which match a class or field name which is to be
> obfuscated get changed to the obfuscated name."*
>
> *"**BASIC** — `char` arrays, `byte` arrays, `int` arrays, `char` fields and `byte` fields are
> redacted. This removes some sensitive data, such as passwords and the majority of `BigInteger`
> object contents, which might hold private keys. It leaves other data such as `int` fields, and
> `boolean`, `long`, `float`, `double` fields and arrays. which might also contain sensitive
> information such as personal ID numbers or financial information."*
>
> *"**FULL** — All fields and arrays are set to zero or false values… **Object reference fields and
> arrays are preserved, together with array sizes, as these are necessary to identify causes of
> out of memory errors.**"*

That last clause is the important one: **`FULL` redaction does not destroy the analysis.** The
dominator tree, retained sizes and paths to GC roots are all functions of the reference graph and
array lengths, which `FULL` preserves. You can hand a fully redacted dump to a vendor and they can
still find your leak.

The `-map` file records the original-to-obfuscated class-name mapping so you can translate the
findings back, and MAT's own warning is worth repeating verbatim:

> *"Incorrect use of these options may leave sensitive data in the new dump… Examine the newly
> generated HPROF file, for example with Memory Analyzer, to confirm that no sensitive data is
> visible."*

## When you cannot take one at all

Three situations where the answer is a different tool, not a better dump:

- **A distroless or JRE-only image with no `jcmd`.** Packaging decision, felt here.
  **Topic 10 · Packaging for deploy** *(not written yet)* owns the trade.
- **A pod that is already in a restart loop.** The process you would dump has none of the state
  that caused the problem. You need the dump from the instance that is *currently* growing, which
  means having the RSS graph open and picking a live victim rather than reacting after the restart.
- **A leak that is not on the heap.** Metaspace, the code cache, thread stacks, direct buffers and
  native allocations are not in the file. `jcmd VM.native_memory summary.diff` is the tool —
  [`../01-memory-layout/11b`](../01-memory-layout/11b-the-nmt-baseline-workflow.md).

And one alternative that avoids the whole problem: JFR's `OldObjectSample` event records leak
candidates *with their allocation stack and path to GC root*, continuously, at under one percent
overhead, with no pause and no multi-gigabyte file —
[04d](04d-old-object-sample-instead-of-a-dump.md).

## Gotchas

**★ Writing a heap dump can cause the outage you are investigating.**
A stop-the-world walk rated *Impact: High*, a file the size of the live set, and a liveness probe
that was never configured for either. Raise the probe timeout before you type the command, not
after the pod restarts mid-dump.

**★ The default `HeapDumpPath` is the container's ephemeral filesystem.**
The dump is written and then deleted by the container runtime when the pod restarts. Every
"we had `HeapDumpOnOutOfMemoryError` enabled and there was no file" story ends here.

**★ An ephemeral-storage limit smaller than the heap turns a dump into an eviction.**
The write fills the limit, the kubelet evicts the pod for exceeding ephemeral storage, and the
post-mortem now contains two unrelated failures. Mount a volume sized for the live set.

**★ `-parallel` defaults to 1 and the crash-time dump does not.**
`GC.heap_dump`'s documented default is `(INT, 1)`; `HeapDumper::default_num_of_dump_threads()` is
`max(1, cpus * 3 / 8)`. The dump you take by hand is slower than the one the JVM writes for itself
unless you pass the option.

**★ The analysis tool needs more memory than you expect, and it is a separate JVM.**
Indexing a large HPROF file is not free, and MAT's own `-Xmx` in `MemoryAnalyzer.ini` is the limit
that will stop you. Parse headlessly with `ParseHeapDump.sh` on a machine sized for it and read the
HTML report anywhere.

**★ Parsing writes several index files next to the dump.**
`.idx.index`, `.inbound.index`, `.outbound.index` and friends. Budget disk for them as well as for
the dump, in the same directory, or point the parser somewhere with room.

**★ MAT's `discard_ratio` and `discard_pattern` are marked Experimental and change the answer.**
They make a huge dump openable by leaving objects out. Every retained size computed afterwards is
a lower bound on a population that is not your process's. Use them to get a first look, never to
justify a conclusion.

**★ A heap dump is production data leaving production.**
Names, tokens, session ids, payloads, and `BigInteger` contents that may be key material. It needs
the same approval and the same handling as a database export. `-redact=FULL` preserves reference
fields and array sizes, so a fully redacted dump is still analysable — which means there is rarely
a good reason to move an unredacted one.

**★ `-redact` alone does not hide class and field names.**
MAT's own advice is to combine `-map` with at least `NAMES` or `BASIC`, because *"class names,
field names and method names can hold sensitive information about the nature of the
application"* and are sometimes present inside `char` and `byte` arrays as well as in the class
metadata.

**★ Redaction is not verified for you.**
MAT says to open the redacted file and check. It is an obfuscation pass over a format it does not
fully control, not a guarantee. Treat "we redacted it" as a claim requiring evidence.

## Interview questions

**★ Your service has a 30 GB heap and you need to know what is retaining it. Walk me through
acquiring the dump without causing a second incident.**
First, decide whether the heap is even implicated — `jcmd GC.heap_info` and the GC log's
live-set-after-full-GC cost seconds and frequently end the investigation. If the heap is the
suspect, pick a replica and remove it from the load balancer, because the dump is representative
even if that instance is not serving. Raise or disable its liveness-probe timeout before anything
else, since a 30 GB walk will exceed any normal probe window and a restart mid-dump gives you a
truncated file and a lost instance. Then `jcmd <pid> GC.heap_dump -parallel=<n> -gz=1` onto a
mounted volume with room for the live set — not the working directory, which is ephemeral. Finally,
confirm before you start that you have a machine with enough memory to parse the result, or plan to
run `ParseHeapDump.sh` headlessly, because "we took the dump and cannot open it" is the most common
way this ends.

**★ Legal will not let the dump leave the production network. Can you still get help from a
vendor?** Yes. Memory Analyzer's export query writes a redacted copy, and the `FULL` level is
documented as zeroing all fields and arrays while explicitly preserving *"object reference fields
and arrays … together with array sizes, as these are necessary to identify causes of out of memory
errors."* Everything the analysis depends on — the dominator tree, retained sizes, paths to GC
roots — is computed from the reference graph and array lengths, so a fully redacted dump is still
diagnosable. Combine it with `-map` to obfuscate class and field names and keep the mapping file
inside the network so you can translate findings back. MAT's own documentation insists you then
open the redacted file and verify, which is the step that turns the claim into evidence.

**★ Why might a heap dump be the wrong tool even when the process is clearly using too much
memory?** Because the HPROF format contains only the Java heap. Metaspace contents, the code
cache, thread stacks, GC data structures and the native bytes behind a `DirectByteBuffer` are all
absent — you see the `DirectByteBuffer` object and its capacity field, not the buffer. So for six
of the nine `OutOfMemoryError` messages the file physically cannot hold the answer, and for an
OOMKill there is no dump at all. The tool for those is Native Memory Tracking with a baseline and
a diff, and the decision between them is made by reading the detail message first.

**★ What is `ParseHeapDump.sh` and when do you reach for it?**
It is Memory Analyzer's batch entry point: it parses a dump and produces a report without a UI, so
the indexing — which is the memory-hungry part — can run on a machine sized for it while you read
the resulting HTML anywhere. `org.eclipse.mat.api:suspects` gives the leak-suspects report,
`org.eclipse.mat.api:overview` gives heap overview, system properties, thread overview, top
consumers and a class histogram, and `-baseline=<other.hprof> org.eclipse.mat.api:suspects2`
compares two dumps. It is also the only practical route for dumps large enough that a desktop
cannot index them, and it fits naturally into a script that runs the moment a dump lands on the
volume.

**★ You have two dumps taken twenty minutes apart. What can you do with the pair that you cannot
do with either alone?** Separate growth from size. A single dump shows what is large, which on a
big application is mostly legitimate; the difference between two shows what *grew*, which is
almost always the leak. MAT compares them directly —
`ParseHeapDump.sh later.hprof -baseline=earlier.hprof org.eclipse.mat.api:suspects2` — and reports
suspects by delta rather than by absolute size. The same logic is why `-XX:+HeapDumpBeforeFullGC`
and `-XX:+HeapDumpAfterFullGC` are useful as a pair: they bracket one collection, so the second
file is by definition the live set.

{/* FOOTER */}
