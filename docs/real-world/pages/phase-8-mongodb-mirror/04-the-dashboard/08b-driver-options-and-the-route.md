---
title: "Without maxTimeMS an aggregation has no time limit at all, and three other options on the same call decide whether an incident is diagnosable"
sidebar_label: "20 · Driver options"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`aggregate` command](https://www.mongodb.com/docs/manual/reference/command/aggregate/)
> (*"Specifies a time limit in milliseconds. If you do not specify a value for
> `maxTimeMS`, operations will not time out"*; *"MongoDB only terminates an
> operation at one of its designated interrupt points"*; *"If the client that
> issued `aggregate` disconnects before the operation completes, MongoDB marks
> `aggregate` for termination using `killOp`"*; *"The `hint` does not apply to
> `$lookup` and `$graphLookup` stages"*; the `comment` field appearing in
> *"mongod log messages … Database profiler output … `currentOp` output"*),
> [Read Preference](https://www.mongodb.com/docs/manual/core/read-preference/).
> `mongodb` is **not** installed in this repo's `node_modules`, so every driver
> claim comes from the published driver docs and the driver source on GitHub, not
> from a local declaration file.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The second argument to `aggregate()` is an options object that most code leaves
empty, and four of its fields are the difference between a dashboard that
degrades visibly and one that takes a primary down without leaving a trace. The
sharpest is `maxTimeMS`, whose documented default is not "some sensible limit" but
**no limit at all**. This chunk is those four options and the two more that are
worth knowing exist; [chunk 21](08c-cursors-and-the-route.md) is the choice
between draining a cursor and iterating it, and the route above.**

## `maxTimeMS`, and what "no timeout" means

> *"Specifies a time limit in milliseconds. If you do not specify a value for
> `maxTimeMS`, operations will not time out."*
> — [`aggregate`](https://www.mongodb.com/docs/manual/reference/command/aggregate/)

**Not "will time out eventually" — will not time out.** A dashboard query over a
badly chosen range with no `maxTimeMS` runs until it finishes, holding server
resources, while the HTTP client that asked for it has long since given up.

Two qualifications from the same page. The server *"only terminates an operation
at one of its designated interrupt points"*, so the limit is enforced at
checkpoints rather than instantaneously — a stage deep in a long computation may
overrun it. And for pipelines without `$out` or `$merge`:

> *"If the client that issued `aggregate` disconnects before the operation
> completes, MongoDB marks `aggregate` for termination using `killOp`."*

So a browser closing the tab does eventually free the work — but through a
different mechanism, with different latency, and only when the disconnect is
noticed. It is not a substitute for a limit.

`maxTimeMS` on every read-side aggregation is the rule; the value is a product
decision. Five seconds for an admin dashboard says "if this is not fast, it is
broken, and I would rather show an error than a spinner".

The nightly `$merge` job is the exception: it may legitimately run for minutes,
it has no impatient client, and the client-disconnect kill does not apply to
pipelines containing `$merge` anyway. It gets a generous limit or none, plus a
job-level timeout that can clean up after itself.

One more limit worth knowing sits underneath all of this: the Manual's session
idle timeout. *"If a session is idle for longer than 30 minutes, the MongoDB
server marks that session as expired and may close it at any time"*, killing
in-progress operations and open cursors — *"This includes cursors configured with
`noCursorTimeout()` or a `maxTimeMS()` greater than 30 minutes."* A long export
that idles between batches needs an explicit session, refreshed.

## `comment` is the option nobody sets and everybody wants

> *"A user-provided comment to attach to this command. Once set, this comment
> appears alongside records of this command in the following locations: mongod log
> messages … Database profiler output … `currentOp` output"*

One string, and it turns "some aggregation is pegging the primary" into "the
admin dashboard is pegging the primary". Set it on every pipeline the app issues,
naming the **feature** rather than the function, so an operator reading
`currentOp` at 3am does not have to map a stage array back to a code path.

The comment is inherited by the `getMore` commands the cursor issues, so a
long-running iteration stays labelled for its whole life.

## `allowDiskUse`, `readPreference` and `hint`

```js
orders.aggregate(pipeline, {
  allowDiskUse: false,               // a live endpoint should not need it
  readPreference: 'primary',         // the default; state it when it matters
  maxTimeMS: 5_000,
  comment: 'admin:dashboard',
});
```

**`allowDiskUse: false` is worth setting explicitly on live endpoints.** Since
MongoDB 6.0 the server-wide `allowDiskUseByDefault` is true, so a stage that
outgrows 100 megabytes silently spills to temporary files instead of failing —
right for a batch job, wrong for a page, where a fast error is more useful than a
slow success. Setting it false converts the degradation back into a signal. The
Manual notes the profiler and diagnostic logs carry a `usedDisk` indicator when
any stage spilled, which is the other way to notice.

**`readPreference`** is where [chunk 18's](07b-merge-and-the-ladder.md) rung 3
lives. It is one option, which is exactly why it deserves a comment saying what
it costs: a secondary read is eventually consistent, so two consecutive refreshes
can show a total going backwards.

**`hint`** forces an index and belongs in a diagnostic, not in shipped code — the
argument is
**chapter 05, `hint()` and the plan cache** *(not written yet)*. One
restriction if you do reach for it: *"The `hint` does not apply to `$lookup` and
`$graphLookup` stages"*, so hinting a pipeline does nothing for the index its join
needs.

Two more that are worth knowing exist. **`collation`** applies to the whole
operation and cannot be varied per field or per stage — relevant because
[chapter 01·08](../01-modeling-the-store/06-constraints-that-vanish.md) put a
case-insensitive collation on `users.email`, and a pipeline that matches on email
must specify the same collation or it will not use that index. And **`let`**
declares pipeline-level variables referenced as `$$name`, which keeps a parameter
out of the stage bodies — readable, and it makes the pipeline shape constant
across requests, which matters for the plan cache
(**chapter 05, `hint()` and the plan cache** *(not written yet)*).

## Gotchas

**★ Without `maxTimeMS`, an aggregation does not time out.** The Manual says so
in those words. The HTTP client gives up; the server does not. Set it on every
read-side pipeline.

**★ `maxTimeMS` is enforced at interrupt points, not instantly.** A long-running
stage can overrun the limit. It bounds the damage; it does not guarantee the
deadline, so an HTTP-level timeout is still worth having on top.

**★ The client-disconnect kill does not apply to `$out` or `$merge`
pipelines.** The Manual scopes that behaviour to aggregations *without* those
stages — reasonably, since killing a half-finished write is worse than finishing
it. A materialising job therefore needs its own supervision; nothing upstream
will stop it.

**★ A cursor idle for more than 30 minutes can be killed with its session.** The
session idle timeout overrides `noCursorTimeout()` and any `maxTimeMS` above 30
minutes. A long export that pauses between batches needs an explicit session that
is periodically refreshed.

**★ Since 6.0 an oversized stage spills to disk instead of erroring.** The
default flipped, so the same pipeline that used to fail loudly now gets steadily
slower. On a live endpoint, `allowDiskUse: false` restores the signal; in the
logs, the `usedDisk` indicator is the other way to see it.

**★ `hint` does not apply to `$lookup` or `$graphLookup`.** Hinting a pipeline
directs the index used for the initial collection access only; the join still
needs its own index on `foreignField`.

**★ A collation set on the collection applies unless the operation overrides
it, and one operation gets one collation.** You cannot use a case-insensitive
collation for a `$match` on email and binary comparison for a `$sort` in the same
pipeline. Where the index carries a collation, the operation must specify the
same one or the index goes unused — silently, with correct results.

**★ Set `comment` on every pipeline.** It is one string, it costs nothing, and it
is the difference between an operator seeing a stage array in `currentOp` and
seeing `admin:dashboard`. Nobody sets it until the first incident, and the first
incident is when it would have paid.

## Interview questions

**★ Why set `maxTimeMS` on every read-side aggregation?**
Because the documented default is no limit at all: *"If you do not specify a
value for `maxTimeMS`, operations will not time out."* An HTTP client that has
already given up does not stop the server; the work continues, holding memory and
CPU, and on a busy primary that is how one bad range takes down unrelated
traffic. The server does kill an aggregation when it notices the client
disconnected — for pipelines without `$out`/`$merge` — but that is a different
mechanism with different latency. Note also that the limit is enforced at
interrupt points rather than instantly, so it bounds the damage without
guaranteeing a deadline.

**★ Since MongoDB 6.0 an oversized stage spills to disk by default. Why would you
set `allowDiskUse: false` on an endpoint?**
Because the default converts a loud failure into a quiet slowdown, and on a page
the loud failure is more useful. A stage exceeding 100 megabytes on an
interactive endpoint means the design is wrong — an unselective `$match`, an
unbounded `$group` key — and you want to learn that from an error rather than
from a gradually worsening p99 nobody attributes correctly. On a nightly job the
opposite is true, which is exactly why the option exists per operation rather
than only as a server parameter.

**★ What is `comment` for, and why is it not optional in practice?**
It attaches a user-supplied value to the command, which then appears in mongod
log messages, profiler output and `currentOp`, and is inherited by the cursor's
`getMore` calls. Without it, an operator staring at a slow operation sees an
anonymous array of pipeline stages and has to reverse-engineer which feature
issued it. With it they see `admin:dashboard`. The cost is one string per call
and the payoff is entirely in the incident you have not had yet, which is why it
is always the thing added *after* the incident.

**★ A pipeline matches on `users.email` and the index built with a
case-insensitive collation is not used. Why?**
Because an operation that does not specify a collation uses the collection's
default, or binary comparison, and the Manual requires that query and sort
operations specify the *same* collation as the index for the index to be used.
The result is still correct — the match just fails to find case-variant matches
and scans instead — which is why it presents as a performance problem rather than
a wrong answer. The fix is to pass the same collation option on the aggregation,
and the durable fix, per
[chapter 01·08](../01-modeling-the-store/06-constraints-that-vanish.md), is to
normalise the value on write so no collation is needed at all.

---

← Prev: [Running it from Node](08-running-it-from-node.md) ·
[Overview](README.md) ·
Next → [Draining the cursor, and the route above](08c-cursors-and-the-route.md)
