---
title: "3 · Closing"
sidebar_label: "3 · Closing"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`WebSocket.close()`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close), [`CloseEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent), [`CloseEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code), [`CloseEvent.wasClean`](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/wasClean), [`readyState`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState), [Writing WebSocket client applications](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications). Documentation-validated; **no timings**.

**Closing is a handshake, not a hang-up.** One side sends a close frame, the other answers,
and only then is the connection down. That is why `readyState` has a `CLOSING` state at all,
and why "I closed it" and "it is closed" are different moments.

## `close(code, reason)`

```js
ws.close();                          // code defaults to 1000
ws.close(1000, "done");
ws.close(4001, "session expired");   // your own application code
```

**`code` must be `1000` or in the range `3000`–`4999`.** Anything else throws
**`InvalidAccessError`** — you cannot send `1006` or `1011` yourself, because those belong to
the protocol and the browser. **If you omit it**, MDN documents that it is set automatically —
`1000` for a normal closure, or another standard value in the range `1001`–`1015` chosen to
describe what actually happened.

🔴 **`reason` is limited to 123 *bytes* of UTF-8, not 123 characters**, and exceeding it
throws **`SyntaxError`**. MDN spells the trap out: "a 123-character `reason` value containing
non-ASCII characters would exceed the 123-byte limit."

**So a reason built from user or server text is a crash waiting for its first non-ASCII
input** — a name, a translated error, an emoji. Either keep the reason a fixed constant and
put the detail in a normal message, or truncate by encoded bytes
([Phase 5 · 26 · 01](../../phase-5-built-in-library/26-text-encoding/01-textencoder-and-textdecoder.md)):

```js
function closeReason(text) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= 123) return text;
  return new TextDecoder().decode(bytes.slice(0, 120)) + "…";   // ⚠️ still check
}
```

⚠️ **Truncating bytes can split a multi-byte character**, which is why the decoder above may
produce a replacement character — the safe version keeps a constant. It is a close reason for
your own logs, not a user-facing string.

### What `close()` does and does not do

- **It does not discard queued messages.** MDN: "the `close()` method does not discard
  previously-sent messages before starting that closing handshake; even if the user agent is
  still busy sending those messages, the handshake will only start after the messages are
  sent." A final `send()` immediately followed by `close()` is therefore safe.
- **It is idempotent.** "If the connection is already `CLOSED`, this method does nothing" — so
  calling it in teardown, on `pagehide` and in an error path is fine.
- **It returns immediately**, with `readyState` at `CLOSING`. The `close` event is what tells
  you it finished.
- **Calling it while `CONNECTING` is allowed** and aborts the pending connection; you get a
  `close` event without ever having had an `open`.

🔴 **Do not tear state down in the function that calls `close()`.** Put it in the `close`
handler, which fires whether you closed it, the server closed it or the network did. One exit
path, one place that resets:

```js
function shutdown() {
  ws.close(1000, "client shutdown");   // request it
}

ws.addEventListener("close", (e) => {  // ✅ the only place that reacts
  pending.forEach(({ reject }) => reject(new Error(`socket closed: ${e.code}`)));
  pending.clear();
  outbox.length = 0;
  setConnected(false);
});
```

That rejection loop matters: without it, every outstanding request promise from
[chunk 2](./02-messaging.md) stays pending forever — a leak that looks like a hang.

## The `CloseEvent`

```js
ws.addEventListener("close", (e) => {
  e.code;       // number
  e.reason;     // string, often ""
  e.wasClean;   // did a closing handshake actually complete?
});
```

**`wasClean` is the honest field.** `true` means a close frame was exchanged — someone
decided to close and said so. `false` means the connection died and the browser noticed;
`code` will then be a reserved one that carries no information.

| Code | Name | Meaning (MDN) |
|---|---|---|
| `1000` | Normal Closure | "The connection successfully completed the purpose for which it was created." |
| `1001` | Going Away | "The endpoint is going away, either because of a server failure or because the browser is navigating away from the page that opened the connection." |
| `1002` | Protocol error | terminating "due to a protocol error" |
| `1003` | Unsupported Data | "received data of a type it cannot accept. (For example, a text-only endpoint received binary data.)" |
| `1004` | Reserved | "A meaning might be defined in the future." |
| `1005` | No Status Received | **Reserved** — "no status code was provided even though one was expected" |
| `1006` | Abnormal Closure | **Reserved** — "closed abnormally (that is, with no close frame being sent)" |
| `1007` | Invalid frame payload | "inconsistent data (e.g., non-UTF-8 data within a text message)" |
| `1008` | Policy Violation | the generic one, "used when codes 1003 and 1009 are not suitable" |
| `1009` | Message Too Big | "a data frame was received that is too large" |
| `1010` | Mandatory Ext. | the client expected an extension "but the server didn't" negotiate it |
| `1011` | Internal Error | the server "encountered an unexpected condition" |
| `1012` / `1013` | Service Restart / Try Again Later | restarting, or "overloaded and is casting off some of its clients" |
| `1014` | Bad Gateway | a gateway "received an invalid response from the upstream server… similar to 502" |
| `1015` | TLS handshake | **Reserved** — "a failure to perform a TLS handshake" |
| `3000`–`3999` | registered | "For use by libraries, frameworks, and applications", registered with IANA |
| `4000`–`4999` | private | "For private use… by prior agreements between WebSocket applications" |

### 🔴 `1006` is the one you will actually see, and it means nothing

**`1005`, `1006` and `1015` are reserved and never travel on the wire.** They are what the
*browser* reports when there was no close frame to read:

| What happened | What you observe |
|---|---|
| the handshake was refused, or the server is down | `1006`, `wasClean: false`, **no `open` first** |
| Wi-Fi dropped, laptop slept, tunnel died | `1006`, `wasClean: false` |
| a proxy or load balancer killed an idle connection | `1006`, `wasClean: false` |
| TLS could not be established | `1015` |
| a close frame arrived with no code | `1005` |

**So `1006` with `wasClean: false` means "it broke, and the browser cannot tell you why."**
Do not build logic on the distinction between "server unreachable" and "network lost" — the
client genuinely cannot know. The diagnosis lives in the server's logs; the client's job is
to reconnect sensibly ([chunk 4](./04-staying-connected.md)).

⚠️ **A `1006` before any `open` event is the most useful variant** — it means the connection
never came up at all, which usually points at the URL, mixed content, CSP or an intermediary
that will not forward `Upgrade` ([chunk 1](./01-connecting.md)), not at a flaky network.

### `4000`–`4999` is where your own decisions live

**It is the only range you can send that survives the round trip**, and it is what makes a
reconnection policy possible at all:

```js
const FATAL = new Set([4001 /* auth expired */, 4003 /* banned */, 4009 /* bad version */]);

ws.addEventListener("close", (e) => {
  if (e.code === 1000 || FATAL.has(e.code)) return;   // deliberate — stay closed
  scheduleReconnect(e);                               // chunk 4
});
```

🔴 **Do not treat "not 1000" as "retry".** Reconnecting into an expired token produces an
infinite loop against your own auth endpoint, at whatever rate your backoff allows, from
every open tab. **A distinct application close code is what stops it** — and it has to come
from the server, because the client cannot tell an auth rejection from a network drop.

⚠️ **Codes are for the machine; the reason string is for the log.** Never parse `e.reason` to
decide behaviour — it is free text, it may be empty, and it is truncated at 123 bytes.

## Gotchas

**Symptom → cause → fix.**

- **`ws.close(1011, "…")` throws `InvalidAccessError`** → only `1000` and `3000`–`4999` may be
  sent by a client → use a `4xxx` code for application decisions.
- **`close()` throws `SyntaxError` for some users only** → the `reason` exceeds 123 **bytes**
  once it contains non-ASCII text → use a constant, or truncate by encoded bytes.
- **The last message never arrives, and `close()` is blamed** → it is not the cause; `close()`
  waits for already-sent messages → look at whether the send happened while `readyState` was
  already `CLOSING`, where it is discarded silently ([chunk 2](./02-messaging.md)).
- **State resets when the client closes but not when the server does** → teardown lives in the
  function that called `close()` → move it into the `close` handler.
- **Request promises hang forever after a disconnect** → the `pending` map is never rejected →
  reject and clear it in `close`.
- **Every disconnect reports `1006` with an empty reason** → reserved code, no close frame was
  received → expected; diagnose server-side, and use `wasClean` to tell deliberate from not.
- **The app reconnects forever after the session expires** → "not 1000" was treated as
  retryable → have the server close with a `4xxx` code the client treats as fatal.
- **Behaviour changed when a translated close reason shipped** → logic was parsing
  `e.reason` → switch on `e.code`.

## Interview questions

**Which close codes may a client send, and why so few?** Only `1000` and `3000`–`4999`.
Everything from `1001`–`1015` is the protocol's and the browser's to describe what happened,
so a client sending them would be lying about the transport. `4000`–`4999` is the private
range for application meaning.

**Why is `reason` limited to 123 bytes rather than 123 characters?** It is UTF-8-encoded on
the wire, so non-ASCII characters take 2–4 bytes each; a 123-character reason can exceed the
limit and throw `SyntaxError`.

**What does close code `1006` tell you?** That the connection ended without a close frame and
the browser has no further detail — it is a reserved code that never appears on the wire, and
it covers a refused handshake, a dead network and a proxy timeout equally. `wasClean` is
`false` alongside it.

**Does `close()` drop messages you just sent?** No — the closing handshake starts only after
previously-sent messages have gone out. What does get dropped is anything sent *after*
`readyState` reaches `CLOSING`.

**Where should connection state be reset?** In the `close` handler, because it is the single
event that fires whether the close was yours, the server's or the network's.

**How do you stop a client from reconnecting forever into a rejected session?** The server
closes with a distinct application code in `4000`–`4999`, and the client's `close` handler
treats that code as fatal. The client cannot infer it, because an auth rejection and a
dropped connection are indistinguishable from the browser's side.

---

← [2 · Messaging](./02-messaging.md) · Next → [4 · Staying connected](./04-staying-connected.md)
