---
title: "The browser sends Last-Event-ID on every reconnect whether or not your handler reads it — so a stream without a resume path does not fail, it silently loses everything that happened while the socket was down"
sidebar_label: "03fa · Resumable streams and Last-Event-ID"
sidebar_position: 169
description: "id: to Last-Event-ID as a resume contract: the buffer that never resets, the value-space constraint, a bounded replay handler, how to choose a cursor, why Last-Event-ID is untrusted input, and why replay forces at-least-once delivery on the client."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the WHATWG HTML Living Standard
> [§9.2.3 Processing model, §9.2.4 The `Last-Event-ID` header, §9.2.6 Interpreting an event stream](https://html.spec.whatwg.org/multipage/server-sent-events.html);
> MDN [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events);
> Next.js [`connection()`](https://nextjs.org/docs/app/api-reference/functions/connection).
> Documentation-verified against the specification text, **no sandbox run**.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**[03f](03f-eventsource-reconnection-and-last-event-id.md) established that the browser reconnects on its own. This page is the half that makes reconnection *correct* rather than merely automatic. Every `id:` line you emit sets a cursor inside the `EventSource` object, and on every reconnect the user agent puts that cursor in a `Last-Event-ID` request header without any client code being involved. That gives you, free, the hard part of a resumable protocol — and it also gives you an obligation, because a handler that ignores the header still gets reconnected to. It just answers from *now*, and the client's view of the world is permanently missing whatever happened during the gap. Nothing errors. The UI is quietly wrong until someone reloads the page.**

## `id:` sets a buffer that nothing else resets

The client-side rule for `id` is deliberately unlike the rule for `event`:

> *"If the field name is "id" — If the field value does not contain U+0000 NULL, then set the last event ID buffer to the field value. Otherwise, ignore the field."*

And at dispatch time:

> *"Set the last event ID string of the event source to the value of the last event ID buffer. The buffer does not get reset, so the last event ID string of the event source remains set to this value until the next time it is set by the server."*

Two consequences you design around:

- **Stickiness.** An event carrying no `id:` does not clear the cursor. You can send a hundred heartbeats, presence pings and coalesced UI hints with no id at all, and the resume point stays exactly where you last put it. Resumability is therefore a property of *some* events, chosen by you, not of all of them.
- **A NUL byte silently voids the field.** Not an error, not a warning — the `id` line is discarded and the cursor keeps its previous value. Resume then rewinds further than you intended, or not at all if no id ever landed.

There is one more asymmetry worth naming: the dispatch algorithm sets the last event ID *before* it checks whether there is any data to deliver. So a frame consisting of nothing but `id: 4711` followed by a blank line advances the cursor and fires no event — a pure checkpoint. That is a legitimate tool for a chatty stream whose individual events are not worth replaying.

## The header, and the one thing the specification will not yet promise

> *"The `Last-Event-ID` HTTP request header reports an `EventSource` object's last event ID string to the server when the user agent is to reestablish the connection."*

The reconnect step that sets it:

> *"If the `EventSource` object's last event ID string is not the empty string: Let lastEventIDValue be the `EventSource` object's last event ID string, encoded as UTF-8. Set (`Last-Event-ID`, lastEventIDValue) in request's header list."*

⚠️ The value space is an open question in the standard, and the standard says so itself. Verbatim, caveat included:

> *"See whatwg/html issue #7363 to define the value space better. It is essentially any UTF-8 encoded string, that does not contain U+0000 NULL, U+000A LF, or U+000D CR."*

Treat that as the practical constraint — **no NUL, no CR, no LF** — and go no further. The specification does not currently commit to more, so anything exotic (very long ids, non-ASCII, characters that need header escaping) is building on ground that has not settled. An opaque ASCII token is the safe shape.

## The gap is the whole reason this exists

Between the drop and the reconnect there is, at minimum, the reconnection time — a value that is *"implementation-defined, probably in the region of a few seconds"* unless you set `retry:` — and after a laptop lid closes over a weekend it is hours. Your producer kept producing the entire time. Nobody was listening.

A handler that ignores `Last-Event-ID` cannot detect that, cannot repair it, and gives the client no way to know it has a hole. This is worse than an outage, because an outage is visible. Silent divergence is the failure mode that gets found by a support ticket three days later saying "the board doesn't update sometimes".

## A resumable handler, end to end

```ts
// app/api/boards/[boardId]/events/route.ts
import { connection } from 'next/server'
import { encodeEvent } from '@/lib/sse'

const REPLAY_LIMIT = 200

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  await connection()
  const { boardId } = await params
  const session = await requireBoardAccess(boardId) // authorize BEFORE streaming

  // Sent by the browser itself on every reconnect. No client code produces it,
  // and — because it is a request header — no client code can be trusted for it.
  const cursor = parseCursor(request.headers.get('last-event-id'))

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encodeEvent({ retry: 5000, data: 'connected' }))

      if (cursor === null) {
        // First connection: a snapshot, never a delta.
        const board = await loadBoard(boardId)
        controller.enqueue(encodeEvent({
          id: board.lastEventId,
          event: 'snapshot',
          data: board,
        }))
      } else {
        // Reconnect: replay the gap, bounded, and scoped to THIS board.
        const missed = await listActivitySince(boardId, cursor, { limit: REPLAY_LIMIT })
        for (const row of missed) {
          controller.enqueue(encodeEvent({ id: row.id, event: 'activity', data: row }))
        }
        if (missed.length === REPLAY_LIMIT) {
          // We hit the bound. Say so — a truncated replay that pretends to be
          // complete is worse than no replay at all.
          controller.enqueue(encodeEvent({ event: 'resync', data: { boardId } }))
        }
      }

      await subscribeAndForward(boardId, controller, session)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

Four rules are embedded in that handler, and each one is load-bearing.

**The cursor is parsed and validated, not used.** `Last-Event-ID` is a request header. A header is client input. Anyone can `curl` your endpoint with an arbitrary value:

```ts
const CURSOR = /^[0-9]{1,19}$/ // a bigint sequence number, nothing else

function parseCursor(raw: string | null): bigint | null {
  if (raw === null) return null
  if (!CURSOR.test(raw)) return null // malformed → treat as a first connection
  return BigInt(raw)
}
```

Without that, `Last-Event-ID: 0` is a request to replay the entire history of the board, and `Last-Event-ID: '; DROP TABLE` is whatever your query builder does with it. **Treat it exactly as you would a query parameter**, because that is what it is.

**The replay is bounded, and scoped.** `listActivitySince` takes `boardId` as well as the cursor — a cursor from one stream must never be able to read another's events. An unbounded "everything since" is a self-inflicted denial of service the first time a sleeping laptop wakes up.

**A truncated replay announces itself.** The `resync` event is the client's signal to refetch rather than patch. Without it a client believes it is caught up while missing an arbitrary amount of history.

**Absence of the header is a different request, not a degenerate one.** No `Last-Event-ID` means a fresh client with no state, which needs a snapshot. Sending it deltas from now is how a newly-opened tab renders an empty board.

## Choosing a cursor you can actually resume from

The id is a public, client-echoed identifier of a position in your stream. That constrains it more than people expect.

| Property | Why it matters | What to use |
|---|---|---|
| **Monotonic within one stream** | `listActivitySince` is a range scan; without ordering there is no "since" | A database sequence, an `identity` column, or a logical clock — **not** `Date.now()` |
| **Opaque** | It ends up in server logs and in the client's memory | An integer or a random token, not `user-42-email-changed` |
| **Stable across deploys** | Connections reconnect *through* a deployment; a cursor issued by the old build is presented to the new one | Never derive it from an in-memory array index |
| **Bounded in length** | It becomes an HTTP request header on every reconnect | A sequence number or a ULID, not a serialized object |
| **Free of NUL, CR and LF** | The spec's stated constraint; a NUL silently voids the whole field | Printable ASCII |

The trap that catches most teams is the third row. An in-process ring buffer indexed by position works perfectly in development and breaks the first time you deploy or scale: the client presents a cursor the new instance has never heard of. Either the ids are meaningful to a shared durable store, or resume only works while nothing changes — which is precisely when you do not need it.

Where the events must survive a restart, this is the *persist and resume* strategy from [03e](03e-pull-sources-and-back-pressure.md): the id becomes a durable cursor into a table, and the replay is an ordinary indexed query.

## Replay makes duplicates normal, so the client must be idempotent

A reconnect can happen after the server sent an event but before the client processed it, and your replay window is inclusive-ish by construction. That makes SSE-with-resume an **at-least-once** channel, not exactly-once. The server cannot fix this; the client has to be built for it.

```tsx
source.addEventListener('activity', (e) => {
  const row: Activity = JSON.parse((e as MessageEvent).data)
  setItems((prev) => {
    // Keyed replace, not append. A replayed event is a no-op.
    const next = prev.filter((x) => x.id !== row.id)
    return [row, ...next]
  })
})
```

The general rule is the one queues teach: make the handler *set* state rather than *mutate* it. `items.unshift(row)` doubles on replay; `items = upsert(items, row)` does not. A counter incremented from an event is the classic thing that cannot be made safe this way — send the new total, not the delta.

## Gotchas

**★ Symptom: `Last-Event-ID` arrives on the server as `null` on every reconnect, so replay never runs.** Cause: you emitted the id inside the JSON payload instead of on an `id:` line. Only the wire field sets the client's cursor; the browser never looks at your data. Fix: put it on the frame, and let one encoder guarantee it — [03c](03c-producing-the-stream-correctly.md):

```ts
controller.enqueue(encodeEvent({ id: row.id, event: 'activity', data: row }))
```

**★ Symptom: resume works for months, then one day replays far more than it should.** Cause: an id containing a NUL byte — *"If the field value does not contain U+0000 NULL, then set the last event ID buffer to the field value. Otherwise, ignore the field."* The cursor silently stayed at an older value. Fix: constrain ids at the encoder and fail loudly rather than emitting a field the client will discard:

```ts
const ID_SAFE = /^[\x20-\x7E]+$/ // printable ASCII: no NUL, CR or LF
export function assertEventId(id: string): string {
  if (!ID_SAFE.test(id)) throw new Error(`unusable SSE id: ${JSON.stringify(id)}`)
  return id
}
```

**★ Symptom: one client reconnects and the database does a full table scan.** Cause: an unbounded replay query, usually `WHERE id > $1 ORDER BY id` with no limit, against a cursor from a tab that has been asleep for a day. Fix: a hard limit plus an explicit truncation signal, and an index that actually serves the range:

```sql
CREATE INDEX board_activity_stream ON board_activity (board_id, id);
```

```ts
const missed = await listActivitySince(boardId, cursor, { limit: 200 })
```

**★ Symptom: a user sees another tenant's events after a reconnect.** Cause: the replay query trusted the cursor and forgot the scope — `WHERE id > $cursor` with no `board_id` or `tenant_id` predicate. The cursor is global; the stream is not. Fix: every replay query carries the same authorization predicate as the live subscription. This is the SSE instance of the rule in [10c](10c-tenant-isolation-in-the-data-access-layer.md): the scope goes in the query, not in the caller's discipline.

**★ Symptom: replay works locally and returns nothing in production.** Cause: the replay log is an in-memory array in the module scope, and the reconnect landed on a different instance — or a different deployment. Fix: the log has to live somewhere both instances can read. An in-memory buffer is only correct for a single long-running process you control, and even then it does not survive a restart.

**★ Symptom: someone `curl`s the endpoint with `Last-Event-ID: 0` and pulls your entire event history.** Cause: the header was passed straight into a query. It is client-supplied input with no authentication attached to it whatsoever — the specification defines it as a report from the user agent, not as a credential. Fix: validate the shape, clamp the range, and scope the query to what the session may read:

```ts
const cursor = parseCursor(request.headers.get('last-event-id'))
const floor = await oldestReplayableId(boardId) // e.g. now() - 1 hour
const from = cursor === null ? null : cursor > floor ? cursor : floor
```

**★ Symptom: the client reconnects into a state that is subtly behind, and a later event "fixes" it.** Cause: a race between the replay and the live subscription — you started forwarding live events before the replay query finished, so a live event was delivered ahead of an older replayed one. Fix: subscribe first, buffer, then replay, then drain the buffer. Ordering is your responsibility; nothing in the protocol provides it:

```ts
const pending: Activity[] = []
const unsubscribe = subscribe(boardId, (row) => pending.push(row))
for (const row of await listActivitySince(boardId, cursor, { limit: 200 })) {
  controller.enqueue(encodeEvent({ id: row.id, event: 'activity', data: row }))
}
for (const row of pending.splice(0)) {
  controller.enqueue(encodeEvent({ id: row.id, event: 'activity', data: row }))
}
```

**★ Symptom: heartbeats advance the resume cursor and replay returns nothing after a drop.** Cause: an encoder that stamps every frame with an id, including the keep-alive. The cursor then points at a heartbeat that no `listActivitySince` query knows about, and the lookup finds nothing — or worse, silently returns everything. Fix: heartbeats are comments, not events, and comments cannot carry fields:

```ts
controller.enqueue(encoder.encode(': keep-alive\n\n'))
```

**★ Symptom: ids are `Date.now()` and replay occasionally skips events.** Cause: two events produced in the same millisecond share an id, so `WHERE id > cursor` drops the second one; clock skew across instances makes it worse. Fix: use the database's ordering, not the process's clock — a sequence, an `identity` column, or a ULID generated by the same writer that assigns the row.

**★ Symptom: after a schema change, old clients reconnect with cursors the new code cannot parse and every one of them errors.** Cause: the id format changed and the cursor from before the deploy is still in a live `EventSource` object. Fix: never throw on an unparseable cursor. Treat it as absent — a snapshot is always a correct answer, and it costs one extra payload once per deploy:

```ts
function parseCursor(raw: string | null): bigint | null {
  if (raw === null || !/^[0-9]{1,19}$/.test(raw)) return null // → snapshot path
  return BigInt(raw)
}
```

**★ Symptom: one `EventSource` carries three topics and resume restores only one of them correctly.** Cause: there is exactly one cursor per `EventSource` object, no matter how many event types flow over it. A single id cannot be a position in three independent logs. Fix: give the multiplexed stream a single ordering that all topics share — one activity log per connection scope, with a `topic` field inside the payload — or open one `EventSource` per topic and pay the connection cost. A composite cursor encoded as one string works too, but you own its parsing and its size on every reconnect:

```ts
// One log, one cursor, topic inside the payload.
controller.enqueue(encodeEvent({ id: row.seq, event: 'change', data: { topic: row.topic, ...row } }))
```

## Interview questions

**★ Where does `Last-Event-ID` come from, and what does a server that ignores it lose?**
It comes from the browser, with no client code involved. Every `id:` line in the stream sets the `EventSource` object's *last event ID buffer*, and on reconnect the user agent sets `Last-Event-ID` in the request's header list to that value. A server that ignores it loses everything produced during the gap between the drop and the reconnect — at minimum the reconnection time, which is implementation-defined and "probably in the region of a few seconds", and after a sleeping laptop possibly hours. Nothing errors; the client simply has a hole in its state and no way to detect it. That is why a reconnect and a first connection deserve different responses: a bounded replay for the former, a full snapshot for the latter.

**★ Why does the last event ID buffer not reset between events, and how would you use that deliberately?**
The spec says *"The buffer does not get reset, so the last event ID string of the event source remains set to this value until the next time it is set by the server."* Only an `id:` field changes it — the event type buffer resets on every dispatch, the id buffer does not. Deliberately, that lets you make resumability a property of the events that are worth replaying: emit ids on durable domain events, and omit them on heartbeats, typing indicators, presence pings and coalesced UI hints. The resume cursor then points at the last thing that actually mattered, and the replay after a drop is small and cheap.

**★ Is `Last-Event-ID` trustworthy?**
No. It is an ordinary HTTP request header, so it is fully client-controlled, and nothing in the specification attaches any authentication to it — the spec only says the user agent *reports* its own last event ID. Anyone can send any value, including one from a different user's stream. So it gets the treatment every query parameter gets: validate the format, reject or downgrade anything unexpected rather than throwing, clamp it to a floor so it cannot request unbounded history, and — most importantly — scope the replay query with the same authorization predicate as the live subscription. The cursor selects a *position*; the session selects *what is visible*. Conflating those is how a resume path becomes a data leak.

**★ Your replay is capped at 200 events. What happens to the client that missed 5,000?**
It gets 200 events and a `resync` event telling it the replay was truncated, and it refetches the full state instead of patching. The alternative — sending all 5,000 — turns one sleepy laptop into a large query, a large response and a long-running invocation, and it does this at exactly the moment many clients are reconnecting at once. The important part is that the truncation is *announced*. A capped replay with no signal is the worst of the three options, because the client cannot distinguish "you are caught up" from "you are missing four thousand eight hundred events".

**★ Does resume give you exactly-once delivery?**
No — it gives at-least-once. A reconnect can happen after the server wrote an event and before the client processed it, and the replay window is defined by a cursor that was last updated at some point before the drop, so duplicates are normal rather than exceptional. The consequence lands on the client: event handlers must be idempotent. Practically that means keying by event or entity id and replacing rather than appending, and sending absolute values rather than deltas — a replayed "set total to 12" is harmless, a replayed "add 1" is a bug. Exactly-once would require an acknowledgement channel back to the server, which SSE does not have, which is one of the honest reasons to reach for a real queue instead.

**★ Why is an in-memory ring buffer a bad replay log, even for a single server?**
Because the cursors outlive the process. A client's `EventSource` holds its last event ID across reconnects, and reconnects happen precisely when something disrupted the connection — a deploy, a restart, an instance being recycled, an autoscaler adding capacity. All of those are events after which the in-memory buffer is empty or belongs to a different process, so the cursor presented is one the buffer cannot resolve. You then either replay nothing (silent divergence) or fall back to a snapshot on every reconnect, which is a correct but expensive design you should choose deliberately rather than discover. On a serverless platform, where each connection may be a separate invocation, it never works at all.

---

← [03f · Reconnection and readyState](03f-eventsource-reconnection-and-last-event-id.md) · [Chapter 15 overview](01-explanation.md) · Next → [03g · `fetch` and `ReadableStream`](03g-fetch-and-readablestream-when-you-need-headers.md)
