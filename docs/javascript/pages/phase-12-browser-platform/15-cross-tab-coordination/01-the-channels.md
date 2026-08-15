---
title: "01 · The channels"
sidebar_label: "01 · The channels"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), [`BroadcastChannel.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel/postMessage), [`Window: storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [`StorageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/StorageEvent), [`SharedWorker`](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker), [`Clients.matchAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Clients/matchAll) — and the HTML Standard, [Broadcasting to other browsing contexts](https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts) and [Web storage](https://html.spec.whatwg.org/multipage/webstorage.html). Documentation-validated; **no timings and no console output**.

Your app is open in three tabs. The user logs out in one of them. What happens in the other two?

For most apps the honest answer is *nothing, until something breaks* — a request 401s, a stale
name sits in the header, or two tabs both refresh the same token at the same second and one of
them gets logged out by the server. Cross-tab coordination is the set of tools that make the
answer deliberate instead.

## 🔴 There are two different problems here

| Problem | Shape | Tool |
|---|---|---|
| **Tell the other tabs something happened** | one-to-many notification | `BroadcastChannel`, the `storage` event |
| **Make sure only one tab does something** | mutual exclusion, leader election | **Web Locks** — [02 · Web Locks](./02-web-locks.md) |

They get confused constantly, and the confusion is expensive: broadcasting *"I am refreshing the
token"* does not stop the other two tabs, because they broadcast the same thing at the same
moment. A message tells; a lock decides.

## What a "tab" is, precisely

Two tabs of the same site are **two separate JavaScript realms**. Separate globals, separate
heaps, separate event loops. Nothing in memory is shared — not a module singleton, not a store,
not a `Map`. What they *do* share is everything keyed by **origin** (scheme + host + port):
`localStorage`, IndexedDB, cookies, the cache, the service worker registration — and the
messaging channels below.

⚠️ **Same origin is the boundary, and it can be narrower than you expect.** `https://app.example.com`
and `https://www.example.com` do not share any of this. Browsers may also partition storage and
channels further by the *top-level* site when your page is embedded in a third-party iframe, so
"same origin" is the floor, not a guarantee that two contexts can see each other.

## `BroadcastChannel` — the one to reach for

```js
const channel = new BroadcastChannel('app');       // any string; the name IS the address

channel.postMessage({ type: 'cart:changed', at: Date.now() });

channel.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'cart:changed') refetchCart();
};

// on teardown
channel.close();
```

That is the whole API: a name, `postMessage`, a `message` event, `close()`. Everything that
matters is in the rules around it.

| Rule | Consequence |
|---|---|
| Every context of the origin with a channel of the **same name** receives it | tabs, iframes, and **workers** — `BroadcastChannel` exists in workers too |
| The message is **structured-cloned** | objects, `Map`, `Blob`, `ArrayBuffer` — but **not** functions, DOM nodes or class identity |
| 🔴 The **sending object** is excluded | the sender does not hear its own message |
| ⚠️ …but only *that object* | a **second** `BroadcastChannel` in the *same tab* **does** receive it |
| `postMessage` on a **closed** channel throws | `InvalidStateError` — a closed channel is not a silent no-op |
| A message that cannot be deserialized fires **`messageerror`** | not `message`; listen for it or lose the failure silently |
| Delivery is ordered per sender | the spec sorts destinations in the same agent by creation order, oldest first |

**The exclusion rule is the one that bites.** "The sender does not receive it" is per
`BroadcastChannel` *object*, not per tab — so the natural refactor of "one channel per module"
turns your own tab into a listener for its own broadcasts. Either keep **one channel object per
tab** and update local state directly, or tag messages with a per-tab id and ignore your own:

```js
const TAB_ID = crypto.randomUUID();                 // 10 · WebCrypto: never Math.random()

function publish(type, payload) {
  applyLocally(type, payload);                      // this tab, right now
  channel.postMessage({ type, payload, from: TAB_ID });
}

channel.onmessage = ({ data }) => {
  if (data.from === TAB_ID) return;                 // belt and braces
  applyLocally(data.type, data.payload);
};
```

### What `BroadcastChannel` deliberately does not give you

- **No history and no replay.** A tab opened ten seconds later gets nothing. The channel is a
  bus, not a log — durable state still has to live in storage.
- **No delivery receipt.** There is no ack, no "how many tabs are listening", no failure event
  when nobody hears you.
- **No delivery to a page that is not running.** A discarded tab, a page frozen in the back/forward
  cache, a tab the OS suspended — none of them are listening, and none of them are told they
  missed something.
- **No reach beyond the browser profile on this device.** It is not a network. Two devices, two
  browsers, or a normal and a private window are separate worlds; that is what the server, SSE or
  a WebSocket are for.

### The message shape that survives a deploy

Two tabs can be running **two different versions of your app** — one was opened before the
deploy, one after. That makes the channel a versioned interface, not an internal detail:

```js
channel.postMessage({ v: 1, type: 'auth:logout', reason: 'user' });

channel.onmessage = ({ data }) => {
  if (data?.v !== 1) return;                        // ignore what you do not understand
  switch (data.type) { /* … */ }                    // and ignore unknown types, never throw
};
```

🔴 **Send an event, not a diff.** `{type:'cart:changed'}` and letting the receiver re-read the
source of truth is robust to a missed message; `{type:'cart:add', item}` applied blind is not —
one dropped or duplicated message and the two tabs disagree forever.

## The `storage` event — the older bus, and the one that lies

Before `BroadcastChannel` there was a trick: write to `localStorage`, and every *other* tab gets a
`storage` event. It still works, and its details are the exam question.

```js
addEventListener('storage', (e) => {
  if (e.key !== 'logout') return;
  if (e.newValue === null) return;                  // this was a removal, not a signal
  hardLogout();
});

localStorage.setItem('logout', String(Date.now())); // a NEW value, every time
```

| `StorageEvent` field | What it holds |
|---|---|
| `key` | the key that changed — **`null` for `clear()`** |
| `oldValue` / `newValue` | previous and new value — `newValue` is `null` for `removeItem` |
| `url` | the document that made the change |
| `storageArea` | the `Storage` object itself, so you can read the rest |

🔴 **Four traps, all of them silent:**

1. **It never fires in the tab that made the change.** The writing tab must call its own handler.
   This is the single most reported "the storage event doesn't work" — it is working.
2. **Writing the same value broadcasts nothing.** The HTML Standard's `setItem` algorithm says
   *"If oldValue is value, then return"* — so `setItem('logout','1')` twice signals **once**. A
   timestamp or a `randomUUID()` in the value is what makes each write an event.
3. **`clear()` fires one event with `key`, `oldValue` and `newValue` all `null`.** A handler that
   starts `if (e.key === 'x')` ignores the entire storage being wiped.
4. **`sessionStorage` is not cross-tab.** Its `storage` event reaches other contexts in the *same
   top-level browsing context* — the iframes in that tab — and never another tab.

**When it is still the right tool:** when the message *is* the state. Persisting to `localStorage`
and notifying are one write, so a tab opened later reads the value instead of missing the message.
That is the one thing `BroadcastChannel` cannot do. Everything else — structured data, no
5 MB quota, no string encoding, works in a worker — is better on a channel.
See [Phase 11 · 10 · 02 · The storage event and choosing](../../phase-11-network-storage/10-web-storage/02-the-storage-event-and-choosing.md)
for the storage side of this in full.

## `SharedWorker` and the service worker — one script for every tab

Both channels above are peer-to-peer: every tab keeps its own copy of the work. Sometimes what you
actually want is **one thing, shared**.

```js
// main.js — every tab runs this and gets the SAME worker instance
const worker = new SharedWorker(new URL('./shared.js', import.meta.url), { type: 'module' });
worker.port.start();
worker.port.postMessage({ type: 'subscribe' });
worker.port.onmessage = ({ data }) => render(data);
```

A `SharedWorker` is one script instance for the whole origin, addressed through a `MessagePort`
per tab. One WebSocket instead of five, one poll loop, one in-memory cache — and the `connect`
event gives it a port list it can push to. ⚠️ **Support is not universal** — feature-detect it
(`'SharedWorker' in globalThis`) and keep a per-tab fallback, or elect a leader with a lock
instead ([03 · The patterns](./03-the-patterns.md)).

A **service worker** solves a related problem from the other side: it is a single script that
survives navigation and can reach every page it controls.

```js
// in the service worker
const clients = await self.clients.matchAll({ type: 'window' });
for (const client of clients) client.postMessage({ type: 'sync:done' });
```

⚠️ **A service worker is event-driven and may be stopped at any time.** It is started for the
events it is registered for — do not design a protocol that assumes it is sitting on a channel
waiting. Message it explicitly with `navigator.serviceWorker.controller.postMessage(…)` and let it
answer through the Clients API.

## Choosing

| What you need | Use |
|---|---|
| "Something changed, everyone re-read it" | **`BroadcastChannel`** |
| That, **plus** tabs opened later must see it | write to `localStorage` **and** post to the channel |
| A tab-to-tab reply, not a broadcast | `MessageChannel` ports handed over a broadcast |
| Only **one** tab may do this | **Web Locks** — [02](./02-web-locks.md) |
| One connection / one cache for all tabs | `SharedWorker`, or a lock-elected leader |
| Background, offline, or after the tab closed | a **service worker** |
| Another device, another browser, another user | the **server** — WebSocket or SSE |

🔴 **And the option worth naming: none of it.** If two tabs re-fetch on `visibilitychange` and the
server is the source of truth, that is a correct, boring design with no protocol to get wrong.
Reach for a channel when the cost of being stale is real — auth, carts, drafts, billing.

## Gotchas

**Symptom: the tab that posts also receives its own message.**
Cause — a second `BroadcastChannel` object with the same name in the same document; exclusion is
per object, not per tab.
Fix — one channel object per tab, or stamp messages with a tab id and drop your own.

**Symptom: `storage` events never fire.**
Cause — testing in the tab that made the write, where they never fire by design.
Fix — two real tabs; and call your own handler directly in the writing tab.

**Symptom: the logout signal works once and then stops.**
Cause — `setItem` with an unchanged value returns without broadcasting.
Fix — put a timestamp or `crypto.randomUUID()` in the value on every write.

**Symptom: a handler crashes with `Cannot read properties of null`.**
Cause — a `clear()` arrived: `key`, `oldValue` and `newValue` are all `null`.
Fix — guard `e.key === null` explicitly and treat it as "everything is gone".

**Symptom: `InvalidStateError` on `postMessage`.**
Cause — posting on a channel that was already `close()`d, often from a stale React effect.
Fix — create and close the channel in the same lifecycle, and null the reference on close.

**Symptom: a tab opened after the event never catches up.**
Cause — the channel has no history; the message was delivered to whoever was listening.
Fix — persist the state as well as broadcasting it, and read it on startup.

**Symptom: it works in two normal tabs but not between a normal and a private window, or in an
embedded iframe.**
Cause — different storage partitions; they are not the same world.
Fix — do not treat cross-tab messaging as a transport guarantee — fall back to the server.

**Symptom: an object arrives with its methods missing.**
Cause — structured clone copies data, not classes; a class instance arrives as a plain object.
Fix — send plain data and rehydrate on the receiving side.

## Interview questions

**★ How do two tabs of the same app talk to each other?**
`BroadcastChannel` — same origin, same channel name, structured-cloned messages, delivered to every
other context including workers. The older way is writing to `localStorage` and listening for the
`storage` event, which is still useful when the message *is* the persisted state.

**★ Why does the `storage` event have a reputation for "not working"?**
Because it never fires in the tab that wrote the value, so the first test looks broken; and because
writing an unchanged value broadcasts nothing at all, so a fixed sentinel signals only once.

**★ Does the sender receive its own `BroadcastChannel` message?**
No — the spec excludes the sending object. But it excludes only that *object*: another channel with
the same name in the same document does receive it, which is why one channel per tab is the safe
shape.

**★ What can't `BroadcastChannel` do?**
Persist. There is no replay for a tab opened later, no acknowledgement, no delivery to a frozen or
closed page, and no reach beyond this browser profile on this device.

**★ When is a `SharedWorker` better than broadcasting?**
When the tabs should share *the work*, not just the news — one WebSocket, one poll loop, one cache.
Support is uneven, so feature-detect and keep a fallback, or elect a leader with a Web Lock.

**★ You need every tab to log out when one does. What do you write?**
Broadcast a `{type:'auth:logout'}` message **and** clear the persisted session, so open tabs react
immediately and a tab opened later starts logged out. The clear is the source of truth; the message
is only how it arrives sooner.

---

[Topic index](./README.md) · [02 · Web Locks](./02-web-locks.md) →
