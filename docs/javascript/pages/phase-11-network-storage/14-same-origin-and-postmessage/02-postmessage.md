---
title: "2 · `postMessage`"
sidebar_label: "2 · postMessage"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), [`Window: message` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/message_event), [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent), [`MessageChannel`](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel), [`MessagePort.start()`](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort/start), [Structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). Documentation-validated; **no timings**.

## The call

```js
targetWindow.postMessage(message);
targetWindow.postMessage(message, targetOrigin);
targetWindow.postMessage(message, targetOrigin, transfer);
targetWindow.postMessage(message, options);          // { targetOrigin, transfer }
```

**`targetWindow` is any window reference you legitimately hold** — `iframe.contentWindow`,
`window.parent`, `window.opener`, or the return value of `window.open()`. It is one of the
few things you may call across an origin boundary at all
([chunk 1](./01-what-an-origin-is.md)).

**`message` is cloned, not shared.** It goes through the structured clone algorithm, the
same one behind `structuredClone()`
([Phase 5 · 21](../../phase-5-built-in-library/21-structuredclone.md)) — so the receiver gets
a copy, and functions, DOM nodes, class identity and property descriptors do not survive.
Anything the algorithm refuses throws a **`DataCloneError`** synchronously, on your side.

### 🔴 `targetOrigin` is a security check, not an address

**It says: deliver this only if the receiving document's origin is exactly this.** MDN says
it twice, in bold, because it is the mistake:

> "Always provide a specific `targetOrigin`, not `*`, if you know where the other window's
> document should be located. Failing to provide a specific target could disclose data to a
> malicious site."

> "A malicious site can change the location of the window without your knowledge, and
> therefore it can intercept the data sent using `postMessage`."

**That is the attack in one sentence.** You hold a reference to a window whose location you
cannot read ([chunk 1](./01-what-an-origin-is.md) — `location.href` is write-only
cross-origin). If anything navigated it — a redirect chain, an OAuth hop, a hostile parent —
then `"*"` hands your payload to whoever is there now.

```js
popup.postMessage(secret, "*");                       // ❌ whoever is in that window
popup.postMessage(secret, "https://secure.example.net"); // ✅ nobody else, ever
```

**The match "must match exactly (including scheme, hostname, and port)".** No wildcards, no
path component, no subdomain matching. If it does not match, **the event is simply not
dispatched** — silently, which is why a message that "never arrives" is so often a
`targetOrigin` typo rather than a listener bug.

⚠️ **`"*"` is defensible only when the payload is genuinely public** — a "ready" ping, a
height report from your own widget. The moment a token, a user id or personal data is in
there, it is a leak with no error message.

⚠️ **Omitting the argument defaults to `"/"`**, which means *the sender's own origin* — a
same-origin-only send. That is a safe default and an easy one to trip over when you meant to
talk to a different origin.

## Receiving — three checks, none optional

```js
addEventListener("message", (e) => {
  if (e.origin !== "https://widget.example.com") return;   // 1
  if (e.source !== frame.contentWindow) return;            // 2
  if (typeof e.data !== "object" || e.data === null) return;
  if (e.data.type !== "resize" || typeof e.data.height !== "number") return;  // 3
  applyHeight(e.data.height);
});
```

MDN's warnings again, because they are the entire risk:

> "If you do not expect to receive messages from other sites, *do not* add any event
> listeners for `message` events. This is a completely foolproof way to avoid security
> problems."

> "Any window (including, for example, `http://evil.example.com`) can send a message to any
> other window within the iframe hierarchy from top to every iframe below of the current
> document."

> "Failure to check the `origin` and possibly `source` properties enables cross-site
> scripting attacks."

**Read that middle quote carefully: a `message` listener is reachable by every window in the
frame tree, including ones you did not put there.** The event does not come with a
guarantee; `origin` is the only identity you get, and it is the browser that fills it in — so
it is trustworthy, as long as you actually read it.

| Check | What it stops |
|---|---|
| **1 · `e.origin`** | any other site messaging your listener |
| **2 · `e.source`** | *the right origin, the wrong window* — a second frame from the same origin, or one you did not create |
| **3 · the shape of `e.data`** | a compromise on the trusted side turning into a compromise on yours |

🔴 **The third check is the one people skip**, and MDN calls it out: "Having verified
identity, however, you still should always verify the syntax of the received message.
Otherwise, a security hole in the site you trusted to send only trusted messages could then
open a cross-site scripting hole in your site."

**Concretely: never route a message straight into a sink.**

```js
el.innerHTML = e.data.html;      // ❌ stored XSS with extra steps
navigate(e.data.url);            // ❌ open redirect; `javascript:` URLs
eval(e.data.code);               // ❌
```

Validate the `type`, validate every field's type, and allow-list anything that becomes a URL
or markup ([Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md)).

⚠️ **`origin` can be the string `"null"`** — from a sandboxed iframe without
`allow-same-origin`, or a `data:` URL ([chunk 1](./01-what-an-origin-is.md)). It is not an
origin you can allow-list, so a design that needs to trust such a frame needs a
`MessageChannel` handed to it instead.

### `MessageEvent`, field by field

| Field | What it is |
|---|---|
| `data` | "The data sent by the message emitter" — the clone |
| `origin` | "A string representing the origin of the message emitter" — browser-supplied |
| `source` | "a `WindowProxy`, `MessagePort`, or `ServiceWorker` object representing the message emitter" |
| `ports` | "An array of `MessagePort` objects… sent with the message, in order" |
| `lastEventId` | used by server-sent events, empty here |

**`source` is how you reply**, and it is why a request/response over `postMessage` is
possible at all:

```js
e.source.postMessage({ type: "pong", id: e.data.id }, e.origin);   // ✅ reply to the sender
```

⚠️ **Reply to `e.origin`, not to `"*"`.** You have just been told the exact origin — using it
costs nothing and closes the same hole as before.

**The same `MessageEvent` interface is fired by `EventSource`, `WebSocket`, `MessagePort`,
`Worker`, `ServiceWorkerGlobalScope`, `BroadcastChannel` and `RTCDataChannel`** — which is
why `e.data` feels familiar across all of them, and why the `origin`/`source` checks are
specific to the cross-document case rather than a universal habit.

## Transferables — moving instead of copying

```js
worker.postMessage({ buffer }, [buffer]);   // ownership moves
buffer.byteLength;                          // 0 — detached on this side
```

**Transferables are handed over rather than cloned**: "The ownership of these objects is
given to the destination side and they are no longer usable on the sending side." That is
the difference between copying a 50 MB `ArrayBuffer` and moving it
([Phase 5 · 25 · 01](../../phase-5-built-in-library/25-typed-arrays/01-buffers-and-views.md)
covers detachment).

🔴 **The list is a *permission*, not the payload.** MDN: "These transferable objects are not
automatically sent; they must either be contained in the message or be accessible to the
recipient via other means." An object in the transfer array but not in the message is
detached for nothing.

⚠️ **Typed arrays are not transferable — their `ArrayBuffer` is.** Transfer
`view.buffer`, and remember that detaching it detaches **every** view over it.

## `MessageChannel` — a private pipe

```js
const channel = new MessageChannel();

channel.port1.onmessage = (e) => handle(e.data);
frame.contentWindow.postMessage({ type: "init" }, TARGET_ORIGIN, [channel.port2]);
```

**One channel, two entangled ports; whatever goes into one comes out of the other.** You
transfer one end to the other side and keep the other, and from then on the two hold a direct
connection that no third window can listen to.

**Why it is worth the extra step:**

- **The `window` `message` listener is a public door** — every frame can knock. A port is
  reachable only by whoever holds it.
- **No repeated `origin` checks**, because there is nothing else on the pipe. Verify once,
  when you hand the port over.
- **It is the natural fit for request/response** and for talking to a frame whose origin is
  `"null"`.

🔴 **`port.start()` is required with `addEventListener` and implied by `onmessage`.** MDN:
"This method is only needed when using `EventTarget.addEventListener`; it is implied when
using `onmessage`." **Messages queue silently until it is called** — a listener that never
fires, with no error anywhere, is nearly always this.

```js
channel.port1.addEventListener("message", handle);
channel.port1.start();          // ✅ without this, nothing is delivered
```

⚠️ **Close ports you stop using** — `port.close()`. A live port keeps both sides referenced.

## Which mechanism, and when

| You are talking to | Use | Note |
|---|---|---|
| an `<iframe>` you embed | `iframe.contentWindow.postMessage` | wait for the frame's `load`, or have the frame say "ready" first |
| the page that embeds you | `window.parent.postMessage` | `parent === window` when you are not framed |
| a popup you opened | `popup.postMessage` | keep the reference; `window.open` returns `null` when blocked |
| the page that opened you | `window.opener.postMessage` | `null` under `rel="noopener"` |
| a **Web Worker** | `worker.postMessage` | same clone rules, **no origin involved** — a worker is same-origin by construction |
| **other tabs of your origin** | `BroadcastChannel` | not `postMessage`; no window reference needed |

⚠️ **The handshake is the ordering problem.** A message posted to a frame before its document
has a listener is dropped — there is no buffering. Either wait for the iframe's `load` event
or, more robustly, have the frame post `{type:"ready"}` to `parent` first and reply to
`e.source`.

## Gotchas

**Symptom → cause → fix.**

- **The message never arrives, and nothing is logged** → `targetOrigin` does not match the
  receiving document exactly (scheme, host, **port**) → log both sides' `location.origin` and
  compare; the send is silent on mismatch.
- **It works locally and breaks in production** → the origin string is hardcoded to
  `localhost` → derive it from configuration, per environment.
- **Messages sent right after creating the iframe are lost** → nothing is listening yet, and
  there is no queue → wait for `load`, or use a ready handshake.
- **`DataCloneError` on send** → a function, DOM node, `Error` subclass detail or class
  instance in the payload → send plain data; rebuild the class on the far side
  ([Phase 5 · 21](../../phase-5-built-in-library/21-structuredclone.md)).
- **The receiver gets an object with no methods** → structured clone copies data, not
  prototypes → expected; reconstruct.
- **`byteLength` is `0` after sending** → the buffer was transferred, not copied → clone
  first if you still need it locally.
- **A `MessagePort` listener never fires** → `addEventListener` without `port.start()` →
  call `start()`, or use `onmessage`.
- **Another site's frame can drive your app** → no `e.origin` check → check origin, then
  `source`, then shape.
- **`e.origin` is `"null"`** → sandboxed frame without `allow-same-origin`, or a `data:` URL
  → do not allow-list it; hand that frame a `MessagePort` instead.
- **A trusted partner's compromise becomes XSS on your page** → the payload was routed into
  `innerHTML`/`eval`/a redirect → validate the shape and sanitise the sinks.

## Interview questions

**Why must `targetOrigin` be an exact origin rather than `"*"`?** Because you cannot read the
target window's location cross-origin, so you do not know who is in it. If it was navigated,
`"*"` delivers your payload to whoever is there. MDN: "A malicious site can change the
location of the window without your knowledge, and therefore it can intercept the data sent
using `postMessage`."

**What must a `message` listener check, and why three things?** `origin` (any window in the
frame tree can post to you), `source` (the right origin can still be the wrong window), and
the shape of `data` (so a compromise on the trusted side does not become XSS on yours).

**How is the data serialised?** With the structured clone algorithm — a deep copy that keeps
cycles, `Map`, `Set`, `Date`, typed arrays and `Blob`, and drops functions, DOM nodes and
prototypes, throwing `DataCloneError` on anything it cannot handle.

**What does the `transfer` array do?** Moves ownership instead of copying — the object is
detached on the sender's side. It is a permission list, not the payload: the object must also
be reachable from the message itself.

**When would you use `MessageChannel` instead of `window.postMessage`?** When you want a
private two-party pipe: no other frame can listen, the identity check happens once when the
port is handed over, and request/response is natural. Remember `port.start()` with
`addEventListener`.

**Is `postMessage` to a Web Worker the same thing?** The same clone and transfer semantics,
but no origin check — a worker is same-origin by construction, so there is no `targetOrigin`
and `e.origin` is not meaningful.

---

← [1 · What an origin is](./01-what-an-origin-is.md) · [Overview](./README.md)
