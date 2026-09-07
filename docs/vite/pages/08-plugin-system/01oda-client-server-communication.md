---
title: "`server.ws.send` broadcasts to every open tab and `client.send` replies to one — and the buffering guarantee that makes an early message safe is documented for the client direction only"
sidebar_label: "Client-Server Communication"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Client-server Communication](https://vite.dev/guide/api-plugin) (Server to Client, Client to Server) and [HMR API](https://vite.dev/guide/api-hmr) (`hot.on`, `hot.off`, `hot.send`, the automatic event list and the required conditional guard). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Client-Server Communication

[HMR: Custom Events](01od-hmr-custom-events.md) covered pushing an event out of `handleHotUpdate`.
The channel runs both ways, and the two directions have different guarantees — which is the part
that produces bugs you only see with a second browser tab open. The client-side listener lifecycle and the
events Vite already dispatches are
[HMR Client Listeners](01odb-hmr-client-listeners.md); typing the payloads is
[Typing Custom Events](01oe-typing-custom-events.md).

---

## 1. Under-The-Hood Mechanics

> *"Since Vite 2.9, we provide some utilities for plugins to help handle the communication with
> clients."*

### Server to client

> *"On the plugin side, we could use `server.ws.send` to broadcast events to the client:"*

```js
export default defineConfig({
  plugins: [
    {
      // ...
      configureServer(server) {
        server.ws.on('connection', () => {
          server.ws.send('my:greetings', { msg: 'hello' })
        })
      },
    },
  ],
})
```

🔴 Read where that send is: **inside a `connection` handler.** The verb in the documentation is
*"broadcast"*, and the buffering guarantee quoted below is stated only for the client direction — so
a message sent before any client has connected has no documented delivery. Sending on `connection`
is how the example sidesteps that entirely.

> *"On the client side, use [`hot.on`](https://vite.dev/guide/api-hmr.html#hot-on-event-cb) to listen
> to the events:"*

```ts
// client side
if (import.meta.hot) {
  import.meta.hot.on('my:greetings', (data) => {
    console.log(data.msg) // hello
  })
}
```

### Client to server

> *"To send events from the client to the server, we can use
> [`hot.send`](https://vite.dev/guide/api-hmr.html#hot-send-event-data):"*

```ts
// client side
if (import.meta.hot) {
  import.meta.hot.send('my:from-client', { msg: 'Hey!' })
}
```

> *"Then use `server.ws.on` and listen to the events on the server side:"*

```js
configureServer(server) {
  server.ws.on('my:from-client', (data, client) => {
    console.log('Message from client:', data.msg) // Hey!
    // reply only to the client (if needed)
    client.send('my:ack', { msg: 'Hi! I got your message!' })
  })
},
```

### 🔴 Broadcast versus reply

| Call | Reaches | Use for |
|---|---|---|
| `server.ws.send(event, payload)` | **every** connected client | announcements — "the tokens changed" |
| `client.send(event, payload)` | the one connection that sent the message | replies — "here is the answer you asked for" |

The second argument of a `server.ws.on` handler is that client, and the documentation's own comment
on the line is *"reply only to the client (if needed)"*. A request-response protocol built on
`server.ws.send` works perfectly with one tab open and starts answering questions the other tab never
asked as soon as there are two.

### The one buffering guarantee, and where it does not apply

> *"[`hot.send`] Send custom events back to Vite's dev server. If called before connected, the data
> will be buffered and sent once the connection is established."*

That is the **client to server** direction. ⚠️ The documentation states no equivalent for
`server.ws.send`; treat a broadcast issued before a client exists as undelivered rather than queued,
and send from `server.ws.on('connection', …)` when a newly-arrived client needs it.

---

## 2. Real-World Engineering Scenario

**A request-response protocol that answered the wrong tab.**

A plugin let the running app ask the dev server to regenerate a fixture:

```ts
// client
import.meta.hot.send('fixtures:regenerate', { name });
import.meta.hot.on('fixtures:ready', showFixture);
```

```ts
// server
server.ws.on('fixtures:regenerate', async (data) => {
  const fixture = await regenerate(data.name);
  server.ws.send('fixtures:ready', fixture);      // ⛔ broadcast
});
```

With one tab open this is indistinguishable from correct. The team worked this way for months.

Then the standard debugging setup — the app in one tab, a Storybook-style harness in another —
started showing fixtures nobody had requested: each tab received every other tab's answer, and each
tab's `showFixture` ran with a payload meant for someone else. It was reported as "the fixtures are
random", investigated as a caching problem, and fixed by using the second parameter that had been
there the whole time: `server.ws.on('fixtures:regenerate', (data, client) => { … client.send(...) })`.

**The second bug in the same plugin.** It also announced the available fixture list once, at server
start, with `server.ws.send('fixtures:list', list)` from `configureServer` — outside any `connection`
handler. Nobody ever received it, because no client had connected yet. The documented example sends
its greeting from inside `server.ws.on('connection', …)` for exactly this reason, and the buffering
guarantee that would have saved it is documented for the client's `hot.send`, not for the server's.

**The transferable point:** the two directions are not symmetric. One broadcasts and has no
documented buffering; the other is point-to-point and buffers until connected.

---

## 3. Production-Grade Code Example

```typescript
// ✅ A request-response protocol that survives a second tab.
import type { Plugin } from 'vite';

export function fixtureBridge(regenerate: (name: string) => Promise<unknown>): Plugin {
  return {
    name: 'fixture-bridge',

    configureServer(server) {
      // Announce state to each client as it arrives — not once at startup.
      server.ws.on('connection', () => {
        server.ws.send('fixtures:list', { names: listFixtures() });
      });

      // Reply to the asker only. `client` is the second parameter, and it is the
      // difference between an answer and a broadcast.
      server.ws.on('fixtures:regenerate', async (data, client) => {
        const fixture = await regenerate(data.name);
        client.send('fixtures:ready', { name: data.name, fixture });
      });
    },
  };
}
```

```typescript
// ⛔ The version that works until a second tab is opened.
configureServer(server) {
  // 1. sent once at startup, before any client exists — no documented delivery
  server.ws.send('fixtures:list', { names: listFixtures() });

  server.ws.on('fixtures:regenerate', async (data) => {
    // 2. broadcast: every tab receives every other tab's answer
    server.ws.send('fixtures:ready', await regenerate(data.name));
  });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Broadcasting when you meant to reply

`server.ws.send` reaches every connected client; `client.send` inside a `server.ws.on` handler
replies to one. With two tabs open the difference is immediate and looks like data corruption.

### ⚠️ Pitfall 2 — Expecting `server.ws.send` to buffer

The documented buffering — *"if called before connected, the data will be buffered"* — is stated for
the client's `hot.send`. ⚠️ Nothing equivalent is documented for the server direction, which is why
the docs send their greeting from inside `server.ws.on('connection', …)`.

### ⚠️ Pitfall 3 — Assuming a typed payload is a validated payload

`CustomEventMap` is erased at compile time. A `send` whose payload does not match the declaration is
a compile error and nothing more; a message from an older browser tab or an unmigrated client
arrives however it was sent. See [Typing Custom Events](01oe-typing-custom-events.md).

### ⚠️ Pitfall 4 — Treating the socket as a request-response transport

There is no correlation id in the documented API. If two requests of the same kind can be in flight,
put the identifying information in the payload and echo it back, as the example does with `name`.

---

## Gotchas

**★ Symptom: every open tab receives another tab's reply.** Cause: the handler used `server.ws.send`, which broadcasts. Fix: `server.ws.on(event, (data, client) => client.send(...))` — the second parameter is the asker.

**★ Symptom: an event sent at server start never arrives.** Cause: it was broadcast before any client connected, and buffering is documented only for the client's `hot.send`. Fix: send from inside `server.ws.on('connection', …)`.

**★ Symptom: a client-to-server message sent during module initialisation is lost.** Cause: it is not — this direction buffers. Fix: look elsewhere; the failure is a name mismatch or a missing `server.ws.on`.

**★ Symptom: a mismatched payload arrives at runtime despite the declaration.** Cause: the map is a compile-time construct with no runtime validation. Fix: validate at the boundary if the sender can be out of date — an old tab is a different build.

**★ Symptom: two in-flight requests get each other's responses.** Cause: no correlation information in the payload. Fix: echo an identifier back — `client.send('fixtures:ready', { name: data.name, fixture })`.

---

## Interview questions

**★ When would you use `client.send` rather than `server.ws.send`?**
When the message is a reply rather than an announcement. `server.ws.send` broadcasts to every
connected client, which is right for "the tokens changed" and wrong for "here is the answer to the
question you asked". The documented client-to-server example makes exactly this distinction: inside
`server.ws.on('my:from-client', (data, client) => …)` it calls `client.send('my:ack', …)` with the
comment *"reply only to the client (if needed)"*. The practical trigger for noticing you got it wrong
is a second browser tab — broadcast replies show up in both, so a request-response protocol built on
`server.ws.send` starts producing answers to questions that tab never asked, which usually gets
reported as data corruption rather than as a messaging bug.

**★ Which direction of the channel buffers, and why does the asymmetry matter?**
Only client to server. The HMR API documents that `hot.send` will buffer — *"if called before
connected, the data will be buffered and sent once the connection is established"* — so client code
can fire a message during module initialisation without checking the socket state. Nothing equivalent
is documented for `server.ws.send`, which is why the official server-to-client example puts its send
inside `server.ws.on('connection', …)` rather than at the top of `configureServer`. The asymmetry
matters because the failure is invisible: broadcasting to zero clients is not an error, so a plugin
that announces its state once at startup simply never announces it to anyone.

**★ What does this mechanism *not* give you?**
Runtime validation. The map is erased at compile time, so a `send` whose payload does not match is a
compile error and nothing else; a message that arrives over the socket is whatever the sender put
there. That matters more than it sounds in dev tooling, because an old browser tab is a different
build of the client — it can be sending last week's payload shape at a server that has moved on. If
the event carries anything the server acts on, validate at the boundary. The types are for the
developer writing the code, not for the data crossing the wire.

**★ How do you build a request-response exchange on an API with no correlation id?**
By putting the correlation in the payload and echoing it back, and by replying to the asker rather
than broadcasting. The example does both: the client sends `{ name }`, the server replies with
`{ name, fixture }` via `client.send`, and the client's handler checks the name before acting.
Without the echo, two in-flight requests of the same kind are indistinguishable in the response;
without `client.send`, every tab sees every response. It is also worth deciding what happens when no
reply arrives, since the documented API has no timeout and a dropped socket produces
`vite:ws:disconnect` rather than an error on the pending request.

---

← [HMR: Custom Events](01od-hmr-custom-events.md) · [Vite overview](../../README.md) · Next → [HMR Client Listeners](01odb-hmr-client-listeners.md)
