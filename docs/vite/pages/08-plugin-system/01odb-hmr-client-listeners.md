---
title: "A top-level `hot.on` registers again every time its own module is hot-replaced, so the listener lifecycle is your problem — and eight `vite:` events already exist for the conditions plugins most often reinvent"
sidebar_label: "HMR Client Listeners"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [HMR API](https://vite.dev/guide/api-hmr) (`hot.on`, `hot.off`, `hot.dispose`, `hot.invalidate`, the automatic event list and the Required Conditional Guard) and [Plugin API § Client-server Communication](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ HMR Client Listeners

The client end of [Client-Server Communication](01oda-client-server-communication.md). Registering a
listener is one line; keeping exactly one of them alive across hot replacements is the part that goes
wrong, and it presents as the server sending duplicates. Self-accepting modules — `accept`,
`dispose`, `prune`, `data` and `invalidate` — are
[Self-accepting Modules](01odc-self-accepting-modules.md), and typing the payloads is
[Typing Custom Events](01oe-typing-custom-events.md).

---

## 1. Under-The-Hood Mechanics

### The guard is not optional

> *"First of all, make sure to guard all HMR API usage with a conditional block so that the code can
> be tree-shaken in production:"*

```js
if (import.meta.hot) {
  // HMR code
}
```

The stated reason is tree-shaking: the guard is what lets the whole block disappear from the
production bundle. Injected client code — a string returned from a plugin's `load` or `transform` —
is where this is forgotten, because nobody reviews it as source.

### `hot.on` and the registration that accumulates

> *"[`hot.on(event, cb)`] Listen to an HMR event."*

> *"[`hot.off(event, cb)`] Remove callback from the event listeners."*

A listener registered at the top level of a module is registered again every time that module is hot
replaced, because a hot replacement re-runs the module body. After three edits the callback runs
three times per event — which looks exactly like the server sending duplicates, and sends people to
read the wrong half of the system.

The fix is to remove the old registration as the module is discarded:

> *"[`hot.dispose(cb)`] … the dispose callback [is called] when the module is going to be replaced"*

That is what `hot.off` is for, and the pairing makes the listener's lifetime visible at the
registration site.

### The eight events Vite dispatches automatically

> *"The following HMR events are dispatched by Vite automatically:"*
>
> *"`'vite:beforeUpdate'` when an update is about to be applied (e.g. a module will be replaced) ·
> `'vite:afterUpdate'` when an update has just been applied (e.g. a module has been replaced) ·
> `'vite:beforeFullReload'` when a full reload is about to occur · `'vite:beforePrune'` when modules
> that are no longer needed are about to be pruned · `'vite:invalidate'` when a module is invalidated
> with `import.meta.hot.invalidate()` · `'vite:error'` when an error occurs (e.g. syntax error) ·
> `'vite:ws:disconnect'` when the WebSocket connection is lost · `'vite:ws:connect'` when the
> WebSocket connection is (re-)established"*

| Want to know | Listen to | Instead of |
|---|---|---|
| a build/syntax error occurred | `vite:error` | a plugin-specific error event |
| the socket came back | `vite:ws:connect` | polling, or a custom heartbeat |
| the socket dropped | `vite:ws:disconnect` | a timeout on your own request |
| an update is about to apply | `vite:beforeUpdate` | wrapping every `accept` callback |

The two most reimplemented are `vite:error` and `vite:ws:connect`. A plugin-specific error event
fires only when that plugin is involved; `vite:error` fires whenever the condition occurs, which is
almost always what was wanted.

`'vite:ws:disconnect'` and `'vite:ws:connect'` also tell you something structural: **connections drop
and return.** A laptop waking from sleep reconnects, so any per-client state the server holds must
survive that or be rebuilt.

---

## 2. Real-World Engineering Scenario

**"The server is sending the event three times."**

A plugin pushed design tokens over a custom event, and the client applied them:

```ts
if (import.meta.hot) {
  import.meta.hot.on('tokens:updated', (data) => applyTokens(data.tokens));
}
```

The first save applied the tokens once. The second applied them twice. The fifth applied them five
times, and because `applyTokens` appended a `<style>` element rather than replacing one, the page
accumulated stylesheets until it visibly slowed down.

The server was sending one message. The module containing the listener imported the token helper, so
every token change hot-replaced *that module too* — and each replacement ran the module body again
and registered another callback. Nothing removed the previous ones.

The team's first fix was a module-scope `let registered = false`, which worked until the module was
fully reloaded and the flag reset while the old listeners survived in the HMR client. The correct fix
is the documented pairing: keep a reference to the callback and `hot.off` it in a `hot.dispose`
handler.

**The second finding.** The same plugin had built a reconnection detector — a timer that pinged the
server and re-requested state when the ping failed. `vite:ws:connect` and `vite:ws:disconnect` are
dispatched by Vite for exactly that, and the custom version had a bug the built-in one cannot have:
it only noticed a disconnect while the tab was focused, because the timer was throttled in
background tabs.

**The transferable point:** on the client, the hard part of HMR is not receiving a message — it is
that your listener-registration code is itself subject to HMR.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Exactly one live listener, across any number of hot replacements.
if (import.meta.hot) {
  const onTokens = (data: { tokens: Record<string, string> }) => applyTokens(data.tokens);
  import.meta.hot.on('tokens:updated', onTokens);

  // Remove this registration as the module is replaced, so the next
  // evaluation of the module body does not add a second listener.
  import.meta.hot.dispose(() => {
    import.meta.hot!.off('tokens:updated', onTokens);
  });
}
```

```typescript
// ✅ Use the built-in events rather than reinventing them.
if (import.meta.hot) {
  import.meta.hot.on('vite:ws:connect', () => {
    // Re-request anything the server pushes only on connection.
    import.meta.hot!.send('fixtures:regenerate', { name: currentFixture });
  });

  import.meta.hot.on('vite:error', (payload) => {
    showOwnOverlay(payload);
  });

  import.meta.hot.on('vite:beforeFullReload', () => {
    saveScrollPosition();
  });
}
```

```typescript
// ⛔ Three client-side mistakes.
// 1. no guard: this block cannot be tree-shaken out of the production bundle
import.meta.hot.on('tokens:updated', (d) => applyTokens(d.tokens));

// 2. a module-scope flag instead of hot.off — resets on full reload, old listeners survive
let registered = false;
if (!registered) { registered = true; import.meta.hot.on('x', handler); }

// 3. a listener registered inside a callback that itself re-runs on every update
import.meta.hot.on('vite:afterUpdate', () => import.meta.hot.on('x', handler));
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Registering at top level without removing

Every hot replacement of the module re-runs its body and adds another listener. Pair `hot.on` with
`hot.off` inside `hot.dispose`.

### ⚠️ Pitfall 2 — Using a boolean flag instead of `hot.off`

The flag lives in the module being replaced, so it resets while the listeners registered by the
previous copy survive in the HMR client. It makes the bug intermittent rather than fixing it.

### ⚠️ Pitfall 3 — Reinventing an event Vite already sends

`vite:error`, `vite:ws:connect`, `vite:beforeFullReload` and five others fire whenever the condition
occurs, not only when your plugin is involved. Custom equivalents are narrower and usually buggier.

### ⚠️ Pitfall 4 — Assuming one connection lasts forever

`vite:ws:disconnect` and `vite:ws:connect` exist because sockets drop and return. Server-side
per-client state must survive a reconnect or be rebuilt in the `connection` handler.

### ⚠️ Pitfall 5 — Unguarded `import.meta.hot`

*"make sure to guard all HMR API usage with a conditional block so that the code can be tree-shaken
in production"*. Plugin-injected strings are where this is missed.

### ⚠️ Pitfall 6 — A handler that mutates the DOM additively

Duplicate registrations turn "append a style element" into an unbounded leak, while "replace the
style element" degrades to a harmless repeat. Idempotent handlers make listener bugs visible instead
of destructive.

---

## Gotchas

**★ Symptom: a handler runs several times for one event, more each time its module is edited.** Cause: `hot.on` at module top level, re-registering on every hot replacement. Fix: `hot.off(event, cb)` inside `hot.dispose`.

**★ Symptom: the page accumulates `<style>` elements until it slows down.** Cause: duplicate listeners plus a handler that appends rather than replaces. Fix: the `dispose`/`off` pairing, and make the handler idempotent.

**★ Symptom: a `registered` flag fixes the duplication and it comes back after a full reload.** Cause: the flag lives in the module being replaced; the old listeners live in the HMR client. Fix: `hot.off`, which removes the actual registration.

**★ Symptom: a plugin's error overlay only appears for errors that plugin caused.** Cause: a custom event where `vite:error` already exists and fires for every error. Fix: listen to `vite:error`.

**★ Symptom: a reconnection handler misses disconnects while the tab is in the background.** Cause: a custom timer-based ping, throttled in background tabs. Fix: `vite:ws:disconnect` and `vite:ws:connect`.

**★ Symptom: per-client server state is empty after the laptop wakes from sleep.** Cause: the WebSocket dropped and reconnected. Fix: rebuild the state in the server's `connection` handler rather than only at startup.

**★ Symptom: HMR client code ends up in the production bundle.** Cause: `import.meta.hot` used without the `if` guard. Fix: wrap it — the guard is what makes the block tree-shakeable.

---

## Interview questions

**★ Why does a top-level `hot.on` registration need `hot.off`?**
Because the module containing it is itself hot-replaced. Each replacement re-runs the module body and
registers another callback, so after three edits the handler fires three times per event — which
looks exactly like the server sending duplicates and sends people to debug the wrong half of the
system. Pairing the registration with `hot.off(event, cb)` inside a `hot.dispose` callback removes
the previous one as the module is discarded, leaving exactly one live listener. The tempting
alternative, a module-scope `registered` boolean, is worse than useless: the flag is in the module
being replaced, so it resets while the old listeners survive in the HMR client, turning a
deterministic bug into an intermittent one.

**★ Which HMR events does Vite already dispatch, and why does it matter?**
Eight: `vite:beforeUpdate`, `vite:afterUpdate`, `vite:beforeFullReload`, `vite:beforePrune`,
`vite:invalidate`, `vite:error`, `vite:ws:disconnect` and `vite:ws:connect`. It matters because
plugins routinely reimplement two of them — an overlay duplicating `vite:error`, and a reconnection
handler duplicating `vite:ws:connect` — with a plugin-specific event that fires only when that plugin
is involved rather than whenever the condition occurs. The list also settles naming, since everything
Vite sends is `vite:`-prefixed and the docs recommend prefixing your own, and it tells you something
structural: the presence of connect and disconnect events means connections are expected to drop and
return, so per-client state has to be rebuildable.

**★ Why is the conditional guard around HMR code described in terms of tree-shaking rather than errors?**
Because that is what it buys you. `import.meta.hot` is undefined in a production build, so the guard
does prevent a runtime error, but the documentation's stated reason is that guarding *"[allows] the
code [to] be tree-shaken in production"* — the whole block, including the handler bodies and anything
they import, is statically removable. That reframes it from defensive coding to bundle hygiene, and it
explains why the guard matters most in plugin-injected client code: those strings often pull in
helpers that would otherwise be reachable from production code paths, and nobody reviews a generated
string as if it were source.

**★ A colleague makes an HMR handler idempotent "just in case". Is that worth doing?**
Yes, and for a reason worth articulating: it changes the failure mode of the most likely bug in this
area. Duplicate listener registration is common because the registering module is itself subject to
hot replacement, and with an additive handler — append a style element, push onto an array, add an
event listener of your own — duplicates compound into a leak that degrades the page. With an
idempotent handler, the same bug shows up as a repeated no-op, which is harmless and much easier to
spot. It does not remove the need for `hot.off`; it makes the consequence of forgetting it survivable.

---

← [Client-Server Communication](01oda-client-server-communication.md) · [Vite overview](../../README.md) · Next → [Self-accepting Modules](01odc-self-accepting-modules.md)
