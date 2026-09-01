---
title: "GC log writes are synchronous and happen inside the safepoint, so a stalled disk becomes a GC pause — and the rotation defaults mean an unconfigured file output silently keeps only the last hundred megabytes, which is usually not the hundred megabytes containing the incident"
sidebar_label: "07d · Rotating and shipping GC logs"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference**, "Enable Logging with the JVM
> Unified Logging Framework" — `-Xlog` Output, `-Xlog` Output Mode, `output-options` and
> `-XX:AsyncLogBufferSize`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> the **JDK 25 `jcmd` tool reference** for `VM.log`'s `rotate` option
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html));
> and the **HotSpot Virtual Machine Garbage Collection Tuning Guide, Release 25**, "Garbage-First
> Garbage Collector Tuning → Unusual System or Real-Time Usage", which names log writing as a
> cause of high system time and recommends `-Xlog:async`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A GC log is only useful if it still exists when you go looking for it, and if writing it did
not itself cause the problem you are investigating. Both of those are configuration, both have
non-obvious defaults, and the legacy `-Xloggc:` path can express neither. This page is the
output field, the rotation options and their defaults, the asynchronous mode the tuning guide
recommends for latency-sensitive services, and the one-line configuration worth putting in
every deployment.**

## Outputs, and the filename expansions

> *"The `-Xlog` option supports the following types of outputs: `stdout` — Sends output to
> stdout. `stderr` — Sends output to stderr. `file=filename` — Sends output to text file(s)."*
>
> *"When using `file=filename`, specifying `%p`, `%t` and/or `%hn` in the file name expands to the
> JVM's PID, startup timestamp and host name, respectively."*

**`%p` is the one that matters.** Without it, every restart of a crash-looping container writes
to the same path, and the log of the process you want to post-mortem is gone. With it, each JVM
writes its own file:

```
-Xlog:gc*:file=/var/log/gc-%p.log
```

`%t` gives a startup timestamp, which is useful when PIDs are reused (in a container, the PID is
frequently 1). `%hn` matters only if several hosts share a volume.

## Rotation, and the default nobody knows

> *"You can also configure text files to handle file rotation based on file size and a number of
> files to rotate. For example, to rotate the log file every 10 MB and keep 5 files in rotation,
> specify the options `filesize=10M, filecount=5`. **The target size of the files isn't guaranteed
> to be exact, it's just an approximate value. Files are rotated by default with up to 5 rotated
> files of target size 20 MB, unless configured otherwise.** Specifying `filecount=0` means that
> the log file shouldn't be rotated. **There's a possibility of the pre-existing log file getting
> overwritten.**"*

Three facts in one paragraph, all of them surprising:

1. **Rotation is on by default for file outputs** — 5 files of about 20 MB, so roughly 100 MB of
   history and no more. On a service producing `gc*=debug` that can be minutes.
2. **`filecount=0` disables rotation**, which is what you want if an external log shipper is
   handling the file — but it comes with the warning that a pre-existing file may be
   overwritten, so a restart can destroy the previous run's log.
3. **The size is approximate.** Do not size a volume assuming `filecount × filesize` is a hard
   ceiling.

There is one more output option, for tools rather than humans:

> *"`foldmultilines=<true|false>` — When `foldmultilines` is true, a log event that consists of
> multiple lines will be folded into a single line by replacing newline characters with the
> sequence '\' and 'n' in the output. Existing single backslash characters will also be replaced
> with a sequence of two backslashes so that the conversion can be reversed. This option is safe
> to use with UTF-8 character encodings, but other encodings may not work. For example, it may
> incorrectly convert multi-byte sequences in Shift JIS and BIG5."*

That is the option to reach for when a log aggregator treats every newline as a new event and
your multi-line GC records arrive shredded.

## Asynchronous logging: the log write is inside the pause

By default, every log write is synchronous:

> *"By default logging messages are output synchronously - each log message is written to the
> designated output when the logging call is made."*

And the tuning guide names the consequence in its list of causes of high system time in a GC
pause:

> *"Writing the log output may stall for some time because of some background task intermittently
> taking up all I/O bandwidth for the hard disk the log is written to. Consider using a separate
> disk for your logs or some other storage, for example memory-backed file system to avoid this.
> Another mitigation can be the use of asynchronous logging where the VM writes the log
> asynchronously using the `-Xlog:async` command line option."*

**A stalled `write()` inside a safepoint is a GC pause.** It will be attributed to garbage
collection, because that is what was running, and no amount of collector tuning will move it.
The `gc+cpu` line's `Sys` value is where it shows up
([07c2](07c2-the-other-gc-log-lines.md)).

The asynchronous mode:

> *"`-Xlog:async[:[stall|drop]]` — Write all logging asynchronously."*
>
> *"In asynchronous logging mode, log sites enqueue all logging messages to an intermediate buffer
> and a standalone thread is responsible for flushing them to the corresponding outputs. The
> intermediate buffer is bounded. On buffer exhaustion the enqueuing message is either discarded
> (`async:drop`), or logging threads are stalled until the flushing thread catches up
> (`async:stall`). **If no specific mode is chosen, then `async:drop` is chosen by default.** Log
> entry write operations are guaranteed to be non-blocking in the `async:drop` case."*
>
> *"The option `-XX:AsyncLogBufferSize=N` specifies the memory budget in bytes for the
> intermediate buffer. The default value should be big enough to cater for most cases. Users can
> provide a custom value to trade memory overhead for log accuracy if they need to."*

⚠️ **`-Xlog:async` defaults to `drop`, which means the JVM will silently discard log lines under
pressure.** That is the correct trade for a latency-sensitive service and the wrong one for a
forensic investigation, because the lines it drops are the ones produced when the most was
happening. `async:stall` gives you every line at the cost of reintroducing the blocking you were
avoiding. Choose deliberately, and note that `async` is a *directive* — it applies to all
outputs, not to one.

## Forcing a rotation before you collect

`jcmd`'s `VM.log` has a `rotate` option: *"Rotates all logs."* Use it before copying a log file
off a running container:

```
jcmd <pid> VM.log rotate
```

Copying a file the JVM is still appending to gives you whatever happened to be flushed, which
routinely ends mid-line. Forcing a rotation closes the current file, so what you collect is
complete. See [07b · Decorators and runtime control](07b-decorators-and-runtime-control.md).

## In a container: `stdout` or a file?

Both work; they fail differently.

**`stdout`** is the twelve-factor answer and it hands the whole problem to your platform's log
driver — rotation, shipping, retention. The costs are that GC lines are interleaved with
application output in whatever order the streams flush, that the container runtime's own log
buffer becomes part of the write path, and that a `stdout` write can block on the runtime just
as a file write can block on a disk.

**`file=`** keeps the GC log separate and parseable, and lets you use `%p` so a crash loop does
not overwrite its own evidence. The costs are that the file lives on the container filesystem
and dies with the container unless the path is a mounted volume, and that you now own rotation.

The failure mode nobody plans for is the intersection: a file output on the container's writable
layer, with `filecount=0` because "the shipper handles it", in a pod that gets OOMKilled. The
container is destroyed, the file goes with it, and the shipper never saw the last minutes.

## The configuration worth defaulting to

```
-Xlog:gc*:file=/var/log/gc-%p.log:time,uptime,level,tags:filecount=10,filesize=20M
```

Reading it as the four fields: everything under the `gc` tag; to a file whose name contains the
PID; with wall-clock time as well as uptime; keeping ten files of about 20 MB. For a
latency-sensitive service, add `-Xlog:async` and accept `drop`, or `-Xlog:async:stall` and accept
the blocking. For a service where the always-on cost matters more than the detail, narrow
`gc*` to `gc` — one line per collection is the setting nobody regrets.

⚠️ **The legacy path can express none of this.** `-Xloggc:/var/log/gc.log` is translated to
`-Xlog:gc:/var/log/gc.log` — the *what* and *output* fields only, with no decorators and no
output options, therefore no rotation, no `%p` and no async. It starts, it produces a file, and
it silently forfeits everything on this page.
[02c2 · Flags that still work](02c2-flags-that-still-work.md).

## Gotchas

**★ File outputs rotate by default: 5 files of about 20 MB.**
*"Files are rotated by default with up to 5 rotated files of target size 20 MB, unless configured
otherwise."* So an unconfigured file output keeps roughly the last 100 MB, and on a service
running `gc*=debug` that can be a very short window. The incident you are investigating may have
rotated away before you logged in.

**★ `filecount=0` disables rotation *and* risks overwriting the previous file.**
The man page pairs the two statements: *"Specifying `filecount=0` means that the log file
shouldn't be rotated. There's a possibility of the pre-existing log file getting overwritten."*
So the setting people choose to hand rotation to an external shipper is the one that can destroy
the previous run's log at startup.

**★ `filesize` is approximate.**
*"The target size of the files isn't guaranteed to be exact, it's just an approximate value."*
Sizing a volume as exactly `filecount × filesize` leaves no margin.

**★ Without `%p`, a crash loop overwrites its own evidence.**
Every restart opens the same path. In a container the PID is usually 1, so `%p` alone may not
disambiguate across restarts — pair it with `%t`, the startup timestamp, when the process is
PID 1.

**★ Log writes are synchronous by default and happen inside the safepoint.**
The tuning guide lists log writing among the causes of high system time in a pause, and
recommends `-Xlog:async`. A slow or contended volume turns your diagnostic into the problem it
is diagnosing.

**★ `-Xlog:async` defaults to `drop` and will silently discard lines.**
*"If no specific mode is chosen, then `async:drop` is chosen by default."* The lines it drops
are the ones produced when the most was happening, which is exactly the interval you will want
to read. `async:stall` keeps everything at the cost of blocking the logging thread.

**★ `async` is a directive, not a per-output option.**
`-Xlog:async` applies to all logging. You cannot make the GC log asynchronous and leave another
output synchronous.

**★ A file on the container's writable layer dies with the container.**
An OOMKilled pod takes its filesystem with it. If the GC log matters after the fact, it needs to
be on a mounted volume, or on `stdout` where the platform's log driver has already shipped it,
or shipped continuously by a sidecar.

**★ `stdout` is not free of the same failure.**
A write to `stdout` can block on the container runtime's log pipeline exactly as a file write
can block on a disk, and it is inside the safepoint either way. `stdout` moves the risk, it does
not remove it; `-Xlog:async` is what removes it.

**★ `foldmultilines=true` exists for log aggregators that split on newlines.**
Multi-line GC records otherwise arrive as several unrelated events. The option is documented as
safe for UTF-8 and explicitly *not* safe for some other encodings — *"it may incorrectly convert
multi-byte sequences in Shift JIS and BIG5"*.

**★ Force a rotation before copying a log off a live JVM.**
`jcmd <pid> VM.log rotate` closes the current file. Copying a file being appended to gives you a
truncated one, which is a confusing way to lose an afternoon.

**★ The legacy `-Xloggc:` path has no rotation at all and cannot be given any.**
It maps to the `what` and `output` fields only, and the flags that used to provide rotation —
`UseGCLogFileRotation`, `NumberOfGCLogFiles`, `GCLogFileSize` — were removed. An unbounded log
on a small volume is the eventual outcome.

## Interview questions

**★ What happens to a GC log file if you configure `-Xlog:gc*:file=/var/log/gc.log` and nothing
else?**
It rotates, whether or not you wanted it to. The man page states the default: *"Files are
rotated by default with up to 5 rotated files of target size 20 MB, unless configured
otherwise."* So you get roughly 100 MB of history, approximately — the size is explicitly not
exact — and everything older is gone. On a service logging `gc*` at debug on a busy heap, that
can be a window of minutes, which means the incident you are called about may already have
rotated out. It also has no PID in the filename, so a restart writes to the same path, and no
wall-clock timestamp in the decorators, so what survives cannot be aligned with anything else.

**★ Why would you add `-Xlog:async`, and what does it cost?**
Because log writes are synchronous by default and happen inside the safepoint, so a stalled disk
write becomes a GC pause — the tuning guide lists log writing among the environmental causes of
high system time in a pause and recommends asynchronous logging as the mitigation. What it costs
is completeness: the intermediate buffer is bounded, and the default mode is `async:drop`, which
*"discards"* messages on buffer exhaustion in exchange for non-blocking writes. Those dropped
messages are the ones emitted when the most was happening. `async:stall` keeps every line by
blocking the logging thread until the flusher catches up, which reintroduces part of the problem.
`-XX:AsyncLogBufferSize` trades memory for accuracy in between.

**★ Container logs to `stdout` or to a file — which for GC?**
Both are defensible and they fail differently. `stdout` hands rotation, shipping and retention to
the platform, which is usually correct, but it interleaves GC lines with application output and
still puts a potentially blocking write inside the safepoint — the runtime's log pipeline can
stall just as a disk can. A file gives you a separate, parseable stream and lets you use `%p` so
a crash loop does not overwrite its own evidence, but it lives on the container filesystem and
dies with an OOMKilled pod unless the path is a mounted volume. The worst combination, which is
common, is a file on the writable layer with `filecount=0` because "the shipper handles it" — the
container is destroyed and the last minutes were never shipped. Whichever you choose,
`-Xlog:async` is what removes the write from the pause.

**★ You need to collect a GC log from a running production container. What is the procedure?**
`jcmd <pid> VM.log rotate` first, then copy the closed file. Copying a file the JVM is still
appending to gives you whatever happened to be flushed at that instant, which routinely ends
mid-line and confuses both humans and parsers. If detailed logging was not enabled,
`jcmd <pid> VM.log what=gc*=debug` turns it on live at Low impact, and it can be turned back
down afterwards — see [07b](07b-decorators-and-runtime-control.md). What I would not do is
restart the process to "get better logging", because that destroys the state being
investigated.

**★ A service uses `-Xloggc:/var/log/gc.log -XX:+PrintGCDetails` on JDK 25. What is wrong with
it?**
It works, which is the problem. Both flags are deprecated rather than removed: HotSpot warns and
translates them into `-Xlog:gc:/var/log/gc.log` and `-Xlog:gc*` respectively. But the legacy
syntax can only populate the `what` and `output` fields of the `-Xlog` grammar, so the service
gets no decorators beyond the defaults (no wall-clock time), no `%p` in the filename (a restart
overwrites the previous log), no rotation at all (the flags that used to provide it were
removed), and no asynchronous mode (every write is inside the safepoint). It looks like GC
logging is configured, it appears on a checklist as done, and the file grows without bound until
it fills the volume. The fix is a single modern `-Xlog` argument.

**★ How would you make sure a GC log survives an OOMKill?**
By not depending on the container's filesystem or on a graceful shutdown. An OOMKilled pod
receives SIGKILL: no shutdown hooks, no `gc,heap,exit` summary, and the writable layer goes with
the container. That leaves three options, and the right answer is usually more than one of them.
Write to `stdout` so the platform's log driver has already shipped each line as it was produced.
Or write to a file on a mounted volume that outlives the pod. Or run a sidecar that tails the
file continuously. In all three cases `-Xlog:async` is worth having, because the write is
otherwise inside the safepoint — and `%p` in the filename, because a crash loop is precisely the
scenario where the previous process's log is the one you need.

{/* FOOTER */}
