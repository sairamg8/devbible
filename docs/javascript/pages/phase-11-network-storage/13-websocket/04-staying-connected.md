---
title: "4 · Staying connected"
sidebar_label: "4 · Staying connected"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), [`CloseEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code), [Writing WebSocket servers — ping/pong](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers), [`Navigator.onLine`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine), [`Window: online` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static). Documentation-validated; **no timings**.

**Everything in the first three chunks is the API. This is the part that is not.** A
WebSocket connection will end — a sleeping laptop, a Wi-Fi handover, a server deploy, a
proxy that kills idle connections — and the browser does nothing about it. There is no
automatic reconnect, no replay, no queue. Compare that with `EventSource`, which reconnects
by itself ([chunk 5](./05-when-not-to.md)); with a WebSocket, every line below is yours.

## Reconnecting

**The loop is always the same shape:** `close` fires → decide whether to retry → wait →
construct a **new** `WebSocket` ([chunk 1](./01-connecting.md) — a closed socket cannot be
reopened).

```js
let attempt = 0;

function connect() {
  const ws = new WebSocket(url);

  ws.addEventListener("open", () => {
    attempt = 0;              // ⚠️ see "when to reset" below
    flushOutbox(ws);
    resync(ws);
  });

  ws.addEventListener("close", (e) => {
    if (e.code === 1000 || FATAL.has(e.code)) return;   // chunk 3
    setTimeout(connect, backoffWithJitter(attempt++));
  });
}
```

### 🔴 Backoff **and** jitter, not backoff alone

**Exponential backoff protects the server from one client. Jitter protects it from all of
them at once.**

When a server restarts, every connected client is disconnected in the same instant. With
pure exponential backoff they all retry in the same instant too, then again together, and
again — a thundering herd that arrives exactly as the server is trying to come back up. The
retry schedule has to be *spread*, and randomness is what spreads it:

```js
const BASE = 500, CAP = 30_000;

function backoffWithJitter(attempt) {
  const ceiling = Math.min(CAP, BASE * 2 ** attempt);
  return Math.random() * ceiling;          // full jitter
}
```

**Three properties that matter, and each fixes a real failure:**

| Property | Without it |
|---|---|
| **exponential growth** | a dead server is hammered at a constant rate |
| **randomness (jitter)** | every client retries in lockstep after a mass disconnect |
| **a cap** | after a long outage the delay grows into hours and the app never recovers |

The same reasoning, with the variants (full, equal and decorrelated jitter) and the
`AbortSignal` plumbing, is in
[Phase 17 · 08 · 01](../../phase-17-machine-coding/08-retry-backoff/01-backoff-and-jitter.md)
— this is that pattern applied to a connection rather than a request.

### ⚠️ When to reset the attempt counter

**Resetting on `open` is the obvious choice and it is subtly wrong.** If the server accepts
the connection and drops it a second later — an overloaded backend, a failing auth check
after the handshake, a bad deploy — then every attempt "succeeds", the counter resets, and
your backoff degenerates into a tight reconnect loop that is indistinguishable from an
attack on your own server.

```js
ws.addEventListener("open", () => {
  clearTimeout(stableTimer);
  stableTimer = setTimeout(() => { attempt = 0; }, STABLE_MS);   // ✅ reset on stability
});
ws.addEventListener("close", () => clearTimeout(stableTimer));
```

**Reset after the connection has *stayed* open**, not when it opens.

### Reconnect faster when you know something changed

Waiting out a 30-second backoff after the network has visibly returned is bad behaviour that
users read as "the app is broken". Two signals let you skip the wait:

```js
addEventListener("online", () => reconnectNow());          // network came back
addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") reconnectNow();
});
```

⚠️ **`navigator.onLine` only means "the browser has a network interface"**, not that your
server is reachable — a captive portal or a VPN in a bad state still reports `true`. Use the
`online` event as a *hint to retry sooner*, never as proof of connectivity, and keep the
backoff for the failures that follow.

⚠️ **A hidden tab is throttled** — timers in background tabs are clamped, so a reconnect
scheduled while hidden may not fire when you expect. Re-check state on
`visibilitychange` rather than trusting a pending timer.

## Heartbeats — because TCP will not tell you

🔴 **A dead connection can stay in `readyState === OPEN` indefinitely.** If the network
disappears between two packets — a laptop suspends, a phone changes cell, a NAT table entry
expires — nothing is sent, nothing is acknowledged, no close frame arrives, and the browser
has nothing to report. The socket is a **half-open** connection: alive on your side, gone on
the other. Messages you send are queued and never delivered.

**The protocol has a mechanism for this.** MDN's server-side guide describes it precisely:

> "At any point after the handshake, either the client or the server can choose to send a
> ping to the other party. When the ping is received, the recipient must send back a pong as
> soon as possible. You can use this to make sure that the client is still connected […] A
> ping or pong is just a regular frame, but it's a **control frame**. Pings have an opcode of
> `0x9`, and pongs have an opcode of `0xA`."

🔴 **The browser API does not expose it.** The `WebSocket` interface has `send()`, `close()`,
`readyState`, `bufferedAmount`, `binaryType`, `protocol`, `extensions` and `url` — **there is
no `ping()` and no `pong` event.** A browser client cannot send a control-frame ping, and
cannot see one. (A server *may* ping browsers, and the browser answers automatically; you
just never learn it happened.)

**So a browser heartbeat is an application-level message**, part of your envelope from
[chunk 2](./02-messaging.md):

```js
function startHeartbeat(ws) {
  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "ping" }));
    deadline = setTimeout(() => ws.close(4000, "heartbeat timeout"), PONG_WAIT);
  }, PING_EVERY);

  ws.addEventListener("message", onAnyMessage);   // clears `deadline`
  ws.addEventListener("close", () => { clearInterval(timer); clearTimeout(deadline); });
}
```

**It does two jobs at once, and both are needed:**

1. **Detection.** No pong before the deadline → close the socket yourself, which routes into
   the ordinary reconnect path above. **A heartbeat that only sends and never times out is
   decoration.**
2. **Keeping intermediaries from cleaning up.** Proxies, load balancers and NAT devices drop
   connections that have been idle too long — usually silently, which is exactly the
   half-open case. Regular traffic prevents it.

⚠️ **Close the socket rather than reconnecting around it.** `ws.close()` gives you one exit
path — the `close` handler resets state, rejects pending requests and schedules the retry
([chunk 3](./03-closing.md)) — instead of two code paths that both try to recover.

⚠️ **Any inbound message counts as a sign of life.** Clearing the deadline on *any* message,
not just a pong, avoids treating a busy connection as a dead one.

## Queueing while disconnected

Sends made while the socket is down are silently discarded ([chunk 2](./02-messaging.md)), so
anything that must survive a gap needs an outbox:

```js
const outbox = [];
function send(data) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(data);
  else if (outbox.length < MAX_QUEUED) outbox.push(data);
}
```

🔴 **Bound it, and be deliberate about what goes in it.** An unbounded outbox on a client
that has been offline for an hour is a memory leak that ends in a flood the moment it
reconnects.

| Kind of message | On reconnect |
|---|---|
| cursor position, presence, live filters | **drop** — only the latest matters, and it is already stale |
| "subscribe to channel X" | **do not queue — re-derive** from current state after `open` |
| a user action that changes data | queue, **with an idempotency key**, or refuse and surface an error |

⚠️ **Replay is not free of consequences.** Re-sending "place order" after a gap can place it
twice, because the first attempt may have arrived just before the socket died — the same
ambiguity as a cancelled `POST`
([08 · 02](../08-aborting-and-timing-out/02-cancellation-as-a-lifecycle.md)). A
server-checked idempotency key on the message is what makes replay safe; without one, an
error the user can act on is the honest option.

## Resynchronising after a gap

🔴 **A reconnected client is a new client.** The server has no memory of your subscriptions,
and you have no idea what happened while you were away. **Reconnecting is not resuming.**

**Three things belong in the `open` handler, in order:**

1. **Re-authenticate** if the protocol requires it ([chunk 5](./05-when-not-to.md)).
2. **Re-subscribe** to every channel, derived from current application state — never from a
   queued "subscribe" message that may no longer be wanted.
3. **Close the gap in state**, using the `seq` from your envelope:

```js
ws.addEventListener("open", () => {
  subscriptions.forEach((ch) => send({ type: "subscribe", channel: ch }));
  send({ type: "resume", since: lastSeq });      // server replays, or says "too old"
});
```

**The server's answer to `resume` has to include the case it cannot satisfy.** If the gap is
longer than its buffer, it says so, and the client **refetches a snapshot over HTTP** and
starts again from that sequence. A protocol without that branch appears to work in
development, where gaps are seconds, and silently serves stale state in production.

⚠️ **Live data that arrives before the snapshot is a race, not a rarity.** Buffer incoming
messages while a snapshot request is in flight, then apply the buffer on top, discarding
anything at or below the snapshot's sequence — the same shape as the stale-response race in
[08 · 02](../08-aborting-and-timing-out/02-cancellation-as-a-lifecycle.md).

## Gotchas

**Symptom → cause → fix.**

- **A server restart takes the server down again immediately** → every client retried on the
  same schedule → add jitter, not just backoff.
- **Reconnect storms with backoff already in place** → the attempt counter resets on `open`,
  while the server drops connections a second later → reset only after the socket has stayed
  open.
- **The app takes 30 seconds to notice the network came back** → nothing listens for `online`
  or `visibilitychange` → retry immediately on those, keeping the backoff for real failures.
- **`readyState` says `OPEN` but nothing arrives and nothing is delivered** → a half-open
  connection; TCP has not noticed → application heartbeat with a timeout that closes the
  socket.
- **The heartbeat runs and the connection still hangs forever** → pings are sent but no
  deadline is enforced → close on a missing pong; that is the whole point of it.
- **Idle connections die every few minutes in production but not locally** → an intermediary's
  idle timeout → keep the heartbeat interval below it.
- **Memory grows while offline, then a flood on reconnect** → an unbounded outbox → cap it,
  and drop what is only valuable when fresh.
- **A duplicate order after a flaky reconnect** → a non-idempotent message was replayed →
  idempotency keys server-side, or do not replay.
- **Subscriptions are silently lost after a reconnect** → they were assumed to persist →
  re-subscribe from application state in `open`.
- **The UI shows stale data after a long disconnect** → the gap was never closed → `resume`
  from `lastSeq`, and refetch a snapshot when the server cannot replay that far.

## Interview questions

**Why does a reconnect loop need jitter as well as backoff?** Backoff limits how hard one
client retries; jitter de-synchronises *all* clients. A mass disconnect — a deploy or a crash
— reconnects everyone at the same moment, so without randomness the retries arrive in
simultaneous waves and keep the server down.

**Where do you reset the backoff counter, and why not on `open`?** After the connection has
stayed open for a stability window. Resetting on `open` turns a server that accepts and
immediately drops connections into a tight loop, because every attempt technically succeeded.

**Why is an application heartbeat necessary when the WebSocket protocol has ping/pong?**
Because the browser API does not expose them — there is no `ping()` method and no `pong`
event, so a browser client cannot send or observe control frames. The heartbeat therefore
lives in your own message envelope.

**Why does TCP not tell you the connection died?** Because nothing was sent. A half-open
connection has no traffic to fail on, so the socket stays `OPEN` on your side indefinitely.
Only your own timed exchange detects it.

**What must happen after a reconnect that people forget?** Re-authenticating, re-subscribing
from current state, and closing the gap in data — plus deciding what in the outbox is safe to
replay. A reconnected client is a new client; the server remembers nothing.

**Is queueing messages while offline always right?** No. Presence and cursor updates should be
dropped, subscriptions re-derived rather than replayed, and state-changing actions replayed
only with an idempotency key — a message that arrived just before the socket died would
otherwise be applied twice.

---

← [3 · Closing](./03-closing.md) · Next → [5 · Authentication, and when not to](./05-when-not-to.md)
