---
title: "The third documented choice is `[]` plus a custom event, and `server.ws.send` has two different call shapes — the object form for HMR payloads and the two-argument form for your own events"
sidebar_label: "HMR: Custom Events"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `handleHotUpdate`](https://vite.dev/guide/api-plugin) (the custom-event recipe) and § Client-server Communication (Server to Client, Client to Server), plus [HMR API](https://vite.dev/guide/api-hmr) (`hot.on`, `hot.send`, the built-in event list and the required conditional guard). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ HMR: Custom Events

The third of the documented choices in [`handleHotUpdate`](01o-handle-hot-update.md), and the one
that gives a plugin complete control: hand back an empty array, then tell the client exactly what
happened. The rest of the channel — client to server, replies to one
client, and the events Vite already sends — is
[Client-Server Communication](01oda-client-server-communication.md), and typing the payloads is
[Typing Custom Events](01oe-typing-custom-events.md).

---

## 1. Under-The-Hood Mechanics

### The recipe, verbatim

> *"Return an empty array and perform complete custom HMR handling by sending custom events to the
> client:"*

```js
handleHotUpdate({ server }) {
  server.ws.send({
    type: 'custom',
    event: 'special-update',
    data: {}
  })
  return []
}
```

> *"Client code should register corresponding handler using the [HMR API](https://vite.dev/guide/api-hmr)
> (this could be injected by the same plugin's `transform` hook):"*

```js
if (import.meta.hot) {
  import.meta.hot.on('special-update', (data) => {
    // perform custom update
  })
}
```

The parenthetical is the part people miss. A custom event is useless unless something on the client
is listening, and the plugin that sends it is usually the only code that knows the event exists —
so the listener is normally injected by the same plugin's `transform` hook, into a module it already
owns.

### 🔴 `server.ws.send` has two documented call shapes

| Shape | Where the docs use it | Meaning |
|---|---|---|
| `server.ws.send({ type: 'custom', event, data })` | the `handleHotUpdate` recipe | an HMR payload object whose `type` is `custom` |
| `server.ws.send('my:greetings', { msg: 'hello' })` | Client-server Communication | event name and payload, positionally |

Both appear in the official documentation, and the same page also uses
`server.ws.send({ type: 'full-reload' })` — an HMR payload with no event name at all. Mixing them up
produces a message that is sent successfully and matches no listener, which is the single most
common reason a custom event "does not arrive".

### ⚠️ Namespacing is a documented recommendation

> *"We recommend **always prefixing** your event names to avoid collisions with other plugins."*

Every event name in the documentation follows it — `my:greetings`, `my:from-client`, `custom:foo` —
and Vite's own events are all `vite:`-prefixed. An unprefixed `update` or `reload` is a collision
waiting for the second plugin.

---

## 2. Real-World Engineering Scenario

**An event that was sent perfectly and heard by nobody.**

A design-token plugin watched `tokens.json` and pushed the new values to the client without a
reload, so the running app could restyle itself in place:

```ts
handleHotUpdate({ file, server }) {
  if (!file.endsWith('tokens.json')) return;
  server.ws.send('tokens:updated', tokens);     // shape A
  return [];
}
```

The client listener was in the plugin's own virtual module:

```ts
import.meta.hot.on('tokens:updated', applyTokens);
```

Nothing happened. Two separate causes, and both looked like the other one.

**First**, the listener module was only imported by a component that the route in question did not
load, so on that page nothing was listening. The event was broadcast correctly to a client with no
handler registered — silent by design.

**Second**, once that was fixed by injecting the listener through the plugin's `transform` hook into
a module the app always loads, an earlier debugging change had rewritten the send as
`server.ws.send({ type: 'custom', event: 'tokens:updated' })` — with the payload dropped, because in
the object shape the payload key is `data`, not a second argument. The handler now fired with
`undefined` and threw inside `applyTokens`, which read as "the event is broken" rather than "the
payload moved".

**The transferable point:** a custom event has three independent failure points — sent in the wrong
shape, no listener registered on this page, or `[]` returned with nothing sent at all. None of them
produce an error on the server side.

---

## 3. Production-Grade Code Example

```typescript
// ✅ The full round trip: server pushes, client listens, client acknowledges.
import type { Plugin } from 'vite';

const LISTENER_ID = 'virtual:token-hmr';
const RESOLVED = '\0' + LISTENER_ID;

export function tokenHmr(readTokens: () => unknown): Plugin {
  return {
    name: 'token-hmr',

    resolveId(id) {
      return id === LISTENER_ID ? RESOLVED : null;
    },

    // The listener lives in a module the plugin owns, so it is always present.
    load(id) {
      if (id !== RESOLVED) return null;
      return `
        if (import.meta.hot) {
          import.meta.hot.on('tokens:updated', (data) => {
            applyTokens(data.tokens);
            import.meta.hot.send('tokens:applied', { count: Object.keys(data.tokens).length });
          });
        }
      `;
    },

    configureServer(server) {
      // Client to server: acknowledge, and reply to that one client only.
      server.ws.on('tokens:applied', (data, client) => {
        client.send('tokens:ack', { ok: true, count: data.count });
      });
    },

    async handleHotUpdate({ file, server }) {
      if (!file.endsWith('tokens.json')) return;

      // Two-argument shape: event name, then payload.
      server.ws.send('tokens:updated', { tokens: readTokens() });

      // `[]` is only ever half of the instruction — the send above is the other half.
      return [];
    },
  };
}
```

```typescript
// ✅ The object shape, for when you are sending an HMR payload rather than a named event.
server.ws.send({ type: 'custom', event: 'tokens:updated', data: { tokens } });
// The payload key is `data`. There is no second argument in this shape.
```

```typescript
// ⛔ Four independent ways for a custom event to go missing.
handleHotUpdate({ file, server }) {
  if (!file.endsWith('tokens.json')) return;
  // 1. object shape with the payload passed positionally — it is dropped
  server.ws.send({ type: 'custom', event: 'update' }, { tokens });
  // 2. unprefixed name: 'update' will collide with another plugin sooner or later
  // 3. nothing returns [], so Vite ALSO performs its own update
  // 4. and the client listener lives in a module this page never imports
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Mixing the two `send` shapes

`server.ws.send({ type: 'custom', event, data })` and `server.ws.send(event, payload)` are both
documented. Passing a payload as a second argument to the object shape silently drops it.

### ⚠️ Pitfall 2 — Sending without returning `[]`

The recipe is both statements. Without the return, Vite performs its own update as well, so the
custom handling races an ordinary HMR update.

### ⚠️ Pitfall 3 — A listener in a module the page does not load

`hot.on` only exists where the module ran. Inject the listener from the plugin's own `transform` or
`load` hook into something always present, rather than documenting "import this somewhere".

### ⚠️ Pitfall 4 — Unprefixed event names

*"We recommend always prefixing your event names to avoid collisions with other plugins."* Two
plugins that both send `update` are indistinguishable to every listener on the page.

### ⚠️ Pitfall 5 — Publishing a plugin without its event types

A plugin that injects client listeners should ship a `.d.ts` that augments `CustomEventMap`, so
consumers get inference without copying declarations out of a README that will drift. See
[Typing Custom Events](01oe-typing-custom-events.md).

### ⚠️ Pitfall 6 — Unguarded `import.meta.hot` in injected client code

*"make sure to guard all HMR API usage with a conditional block so that the code can be tree-shaken
in production"*. Injected strings are the easiest place to forget, because nobody reads them as
source.

---

## Gotchas

**★ Symptom: the event is sent and the handler never fires.** Cause: the object shape was used with the payload as a second argument, or the event name differs by a character. Fix: pick one shape — `server.ws.send('ns:event', payload)` — and keep the name in a shared constant.

**★ Symptom: the handler fires with `undefined`.** Cause: the payload key in the object shape is `data`; a positional second argument is dropped. Fix: `server.ws.send({ type: 'custom', event, data: payload })`.

**★ Symptom: the event works on one route and not another.** Cause: the listener lives in a module that route does not import. Fix: inject the listener from the plugin's own `load`/`transform` into a module the app always loads.

**★ Symptom: a custom event and an ordinary HMR update both apply, in a varying order.** Cause: the hook sent the event but did not `return []`. Fix: return `[]` — the send and the return are one instruction.

**★ Symptom: two plugins' events trigger each other's handlers.** Cause: unprefixed names. Fix: prefix everything, as the docs recommend and as every documented example does.

**★ Symptom: consumers of a published plugin get `any` payloads.** Cause: the plugin ships client listeners but no type augmentation. Fix: publish a `.d.ts` that extends `CustomEventMap`, referenced from the package's `types`.

**★ Symptom: HMR client code ends up in the production bundle.** Cause: `import.meta.hot` used without the `if` guard. Fix: wrap it — the guard is what makes the block tree-shakeable.

---

## Interview questions

**★ Walk through the custom-event choice in `handleHotUpdate`. What are the two halves?**
The server half is `server.ws.send(...)` followed by `return []`, and both are required: the send
tells the client what happened, and the empty array tells Vite that this plugin has taken
responsibility so it does not also perform its own update. The client half is a listener registered
with `import.meta.hot.on(...)`, guarded by `if (import.meta.hot)`, and the documentation notes it
*"could be injected by the same plugin's `transform` hook"* — which is the practical answer, because
the plugin is usually the only code that knows the event exists. Leave out either half and there is
no error: the update simply does not happen.

**★ Why do two different `server.ws.send` call shapes exist, and how do you avoid mixing them up?**
The object form, `{ type: 'custom', event, data }`, is an HMR payload — the same shape as
`{ type: 'full-reload' }` — where `custom` is one of the payload types and the event name is a field
inside it. The two-argument form, `send('my:greetings', { msg: 'hello' })`, is the client-server
communication convenience introduced for plugin messaging. Both are in the official docs, in
different sections, which is exactly why they get mixed. The habit that prevents it is to choose one
form per codebase and put the event name in a shared constant imported by both the plugin and the
injected client code, so a mismatch is a build error rather than a message nobody receives.

**★ A custom event does not arrive. How do you localise the failure?**
Work backwards along the path, because none of the steps report an error. Confirm the hook ran at
all — a `ctx.file` guard may have excluded the change. Confirm the send shape matches how the
listener was registered, including the payload key. Confirm a listener is registered on *this page*,
since `hot.on` only exists in modules the page actually loaded, which is why the recommended
approach is to inject the listener from the plugin rather than ask users to import something. And
confirm the hook returned `[]` if the intent was full custom handling, because otherwise the ordinary
update runs too and can mask the custom one. Each of these is a single check, and all four are
silent when wrong.

---

← [Which Hooks Fire Per Environment](01ocb-which-hooks-fire-per-environment.md) · [Vite overview](../../README.md) · Next → [Client-Server Communication](01oda-client-server-communication.md)
