---
title: "`-Xlog` is a four-field grammar with an exact-match rule that silently produces nothing when you get it wrong, and every later `-Xlog` argument for the same output replaces the earlier one rather than adding to it — which is why the commonest GC logging bug is a configuration that looks right and logs nothing"
sidebar_label: "07 · Unified logging"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference**, "Enable Logging with the JVM
> Unified Logging Framework" — Synopsis, Description, Default Configuration, Controlling Logging
> at Runtime, `-Xlog` Tags and Levels, `-Xlog` Output, `-Xlog` Output Mode, Decorations, Convert
> GC Logging Flags to Xlog and Convert Runtime Logging Flags to Xlog
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> the **JDK 25 `jcmd` tool reference** for `VM.log`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html));
> and the **HotSpot Virtual Machine Garbage Collection Tuning Guide, Release 25** for the
> recommended GC tag selections
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Unified logging replaced every `-XX:+PrintGC…` flag with one option that has a grammar, and
the grammar has two rules that produce silent failure: tag selection is an *exact set* match
unless you add a wildcard, and a second `-Xlog` for the same output overrides the first instead
of adding to it. Both produce a JVM that starts cleanly, writes a log file, and does not contain
what you asked for. This page is the grammar, the tags and levels, the decorators, and how to
reconfigure logging on a JVM that is already running.**

## The grammar

> *"`-Xlog[:[what][:[output][:[decorators][:output-options[,...]]]]]`"*
>
> *"`-Xlog:directive`"*

Four colon-separated fields, all optional, and every one of them has a default:

> *"**what** — Specifies a combination of tags and levels of the form
> `tag1[+tag2...][*][=level][,...]`. Unless the wildcard (`*`) is specified, only log messages
> tagged with exactly the tags specified are matched."*
>
> *"**output** — Sets the type of output. Omitting the output type defaults to `stdout`."*
>
> *"**decorators** — Configures the output to use a custom set of decorators. Omitting decorators
> defaults to `uptime`, `level`, and `tags`."*
>
> *"**output-options** — Sets the `-Xlog` logging output options."*
>
> *"**directive** — A global option or subcommand: help, disable, async"*

and the tag-selection default:

> *"Omitting the tag-selection defaults to a tag-set of `all` and a level of `info`."*

So `-Xlog` on its own is not "log everything at info"; that is a common misreading. The bare
option means something else entirely:

> *"When the `-Xlog` option and nothing else is specified on the command line, the default
> configuration is used. The default configuration logs all messages with a level that matches
> either warning or error regardless of what tags the message is associated with. The default
> configuration is equivalent to entering the following on the command line:
> `-Xlog:all=warning:stdout:uptime,level,tags`"*

## The exact-match rule, which is the trap

> *"The `all` tag is a meta tag consisting of all tag-sets available. The asterisk `*` in a tag
> set definition denotes a wildcard tag match. Matching with a wildcard selects all tag sets that
> contain at least the specified tags. **Without the wildcard, only exact matches of the
> specified tag sets are selected.**"*

Read that with the fact that every log message carries a *set* of tags, not one tag. A message
about G1's pause phases is tagged `gc,phases`. A message about the heap is tagged `gc,heap`.

| Selection | Matches |
|---|---|
| `-Xlog:gc` | messages tagged **exactly** `gc` and nothing else |
| `-Xlog:gc*` | every message whose tag set **contains** `gc` — `gc,heap`, `gc,phases`, `gc,ergo,cset`, … |
| `-Xlog:gc+heap` | messages tagged **exactly** `gc,heap` |
| `-Xlog:gc+heap*` | every message containing at least `gc` and `heap` |
| `-Xlog:gc+phases=debug` | exactly `gc,phases`, at debug level |

**`-Xlog:gc` is not a quiet version of `-Xlog:gc*`; it is a different selection.** It gives you
the one-line-per-collection summary and nothing else — which is often exactly what you want, but
if you asked for `-Xlog:gc=debug` expecting detail you will get almost nothing, because the
detail lives on other tag sets.

The `+` is a set intersection, not a path separator. `gc+heap` means "tagged `gc` *and* `heap`",
which is why `gc+phases` and `gc+ergo+cset` read the way they do.

## Levels

> *"Available log levels: `off`, `trace`, `debug`, `info`, `warning`, `error`"*

and the enumeration problem:

> *"There are literally dozens of log tags, which in the right combinations, will enable a range
> of logging output. The full set of available log tags can be seen using `-Xlog:help`."*

**`java -Xlog:help` is the authoritative tag list for your JDK**, and it also *"Prints `-Xlog`
usage syntax and available tags, levels, and decorators along with example command lines with
explanations."* It is the single command that removes guesswork from this whole area, and it
costs nothing.

## Argument ordering: later wins, per output

> *"`-Xlog[:option]` — Applies multiple arguments in the order that they appear on the command
> line. **Multiple `-Xlog` arguments for the same output override each other in their given
> order.**"*

This is the second silent failure. Two `-Xlog` options both defaulting to `stdout`:

```
-Xlog:gc*:stdout -Xlog:safepoint:stdout        # the second REPLACES the first
```

You get safepoint logging and no GC logging, with no warning. The two ways to get both:

```
-Xlog:gc*,safepoint:stdout                                   # one argument, two selections
-Xlog:gc*:file=gc.log -Xlog:safepoint:file=safepoint.log     # two arguments, two outputs
```

Since omitting the output defaults to `stdout`, two bare `-Xlog:` arguments always collide.
That is the mechanism behind "I added GC logging and my safepoint logging disappeared".

## Operating the log

Decorators — including the one the defaults omit that makes a GC log correlatable with anything
else — plus reconfiguring logging on a running JVM through `jcmd VM.log`, and the tag selections
worth memorising, are
[07b · Decorators and runtime control](07b-decorators-and-runtime-control.md).

## Gotchas

**★ `-Xlog:gc` and `-Xlog:gc*` are different selections, not different verbosities.**
Tag matching is an exact set match without a wildcard. `-Xlog:gc` selects messages tagged
*only* `gc`; `-Xlog:gc*` selects every tag set containing `gc`. Asking for `-Xlog:gc=debug` and
receiving almost nothing is this rule, not a broken JVM.

**★ A second `-Xlog` for the same output silently replaces the first.**
*"Multiple `-Xlog` arguments for the same output override each other in their given order."*
Since omitting the output defaults to `stdout`, two bare `-Xlog:` arguments always collide.
Combine selections in one argument with a comma, or send them to different outputs.

**★ `-Xlog` with nothing after it does not mean "log everything".**
It applies the default configuration, which is `-Xlog:all=warning:stdout:uptime,level,tags` —
warnings and errors only. To actually log everything at info you have to say so.

**★ `+` in a tag selection means "and", not "then".**
`gc+heap` selects messages tagged with both `gc` and `heap`. It is set intersection, which is
why `gc+ergo+cset` is a three-tag selection and not a path.

**★ Log levels do not nest across tag sets the way people expect.**
`-Xlog:gc*=debug` sets debug for every tag set containing `gc`, including very chatty ones. On
a busy service this is a lot of output; the tuning guide recommends it as a *starting point*
followed by refinement, not as a production setting.

**★ The legacy GC print flags map onto this and still work, which hides the loss.**
`-XX:+PrintGCDetails` becomes `-Xlog:gc*` and `-Xloggc:f` becomes `-Xlog:gc:f`, both with a
deprecation warning — but neither can express decorators or output options, so a service on the
legacy path has no rotation, no `%p`, no `time` decorator and no async.
[02c2 · Flags that still work](02c2-flags-that-still-work.md).

## Interview questions

**★ What is the difference between `-Xlog:gc` and `-Xlog:gc*`?**
They select different sets of messages, not different amounts of detail from the same set.
Every unified-logging message carries a *set* of tags, and without a wildcard the selection is
an exact set match — so `-Xlog:gc` matches only messages tagged with exactly `gc`, which is the
one-line-per-collection summary. `-Xlog:gc*` matches every tag set that *contains* `gc`, which
brings in `gc,heap`, `gc,phases`, `gc,ergo`, `gc,age`, `gc,cpu` and the rest. The man page states
the rule directly: *"Matching with a wildcard selects all tag sets that contain at least the
specified tags. Without the wildcard, only exact matches of the specified tag sets are
selected."* In practice `-Xlog:gc` is the right always-on production setting and `-Xlog:gc*=debug`
is the right investigation setting.

**★ Someone adds `-Xlog:safepoint` to a command line that already has `-Xlog:gc*` and the GC
logging disappears. Why?**
Because both default to `stdout`, and *"multiple `-Xlog` arguments for the same output override
each other in their given order"*. The second argument replaced the first's configuration for
that output rather than adding to it. There are two correct forms: combine the selections in a
single argument, `-Xlog:gc*,safepoint`, or send them to different outputs,
`-Xlog:gc*:file=gc.log` and `-Xlog:safepoint:file=safepoint.log`. This is a genuinely common
production incident because it fails silently — the JVM starts, a log is produced, and the
missing half is only noticed during the next investigation.

**★ Why is `-Xlog` alone not equivalent to `-Xlog:all=info`?**
Because a bare `-Xlog` applies the *default configuration*, which the man page defines as
`-Xlog:all=warning:stdout:uptime,level,tags` — warnings and errors only, on every tag. The
"omitting the tag-selection defaults to a tag-set of `all` and a level of `info`" rule applies
to the *what* field of an explicit selection, not to the bare option. So `-Xlog:` with a
trailing colon and nothing else behaves differently from `-Xlog` with nothing at all, which is
the kind of distinction that only matters until it costs you an afternoon.

{/* FOOTER */}
