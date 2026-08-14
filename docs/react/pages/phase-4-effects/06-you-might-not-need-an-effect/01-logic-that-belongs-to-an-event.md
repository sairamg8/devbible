---
title: "Logic that belongs to an event"
sidebar_label: "01 · Logic that belongs to an event"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
> (§ Sharing logic between event handlers, § Sending a POST request).
> No sandbox script backs this page; claims are cited, not measured.

**Two cases with one cause: logic that was triggered by a user action ended up in
an effect, where the information about what the user did no longer exists.**

The diagnostic is a single question, and it is the same one from
[topic 01](../01-what-an-effect-is-for.md): *why did this happen?* If the answer
names an interaction, the code belongs in the handler for that interaction.

## Case 5 — Sharing logic between event handlers

The usual origin is honest: two handlers need the same follow-up, so the shared
part gets hoisted into an effect.

```jsx
function ProductPage({ product, addToCart }) {
  // 🔴 Avoid: Event-specific logic inside an Effect
  useEffect(() => {
    if (product.isInCart) {
      showNotification(`Added ${product.name} to the shopping cart!`);
    }
  }, [product]);

  function handleBuyClick() {
    addToCart(product);
  }

  function handleCheckoutClick() {
    addToCart(product);
    navigateTo('/checkout');
  }
}
```

The bug is not subtle once you see it. That effect runs whenever `product`
changes **and on mount** — so a user who already has the item in their cart gets
"Added to the shopping cart!" on every page load, having done nothing.

The fix is a plain function, not a hook:

```jsx
function ProductPage({ product, addToCart }) {
  // ✅ Good: Event-specific logic is called from event handlers
  function buyProduct() {
    addToCart(product);
    showNotification(`Added ${product.name} to the shopping cart!`);
  }

  function handleBuyClick() {
    buyProduct();
  }

  function handleCheckoutClick() {
    buyProduct();
    navigateTo('/checkout');
  }
}
```

> The notification should appear because the user *pressed the button*, not
> because the page was displayed.

**Sharing code between handlers does not require a React mechanism.** An ordinary
function in the component body is the answer, and reaching for `useEffect`
because two call sites need the same lines is how the wrong causation gets
baked in.

## Case 6 — Sending a POST request

The case that proves the rule is not "POSTs don't go in effects". react.dev's
example puts **two** POSTs in one component and keeps one of them:

```jsx
function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // ✅ Good: This logic runs because the component was displayed
  useEffect(() => {
    post('/analytics/event', { eventName: 'visit_form' });
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    // ✅ Good: Event-specific logic is in the event handler
    post('/api/register', { firstName, lastName });
  }
}
```

> The analytics POST request should remain in an Effect because the reason to
> send it is that the form was displayed. However, the registration request
> should only happen when the user presses the button — that's an event, not a
> component lifecycle.

Same function, same verb, same component, opposite answers — determined entirely
by **what caused the call**. This is the sharpest worked example of the principle
anywhere in the docs, and it is the same distinction
[topic 04 · 03](../04-cleanup/03-when-cleanup-is-not-the-answer.md) reaches from
the cleanup side.

### The state-as-a-trigger antipattern

Worth naming, because it is how the wrong version usually looks:

```jsx
// 🔴 Avoid: Event-specific logic inside an Effect
const [jsonToSubmit, setJsonToSubmit] = useState(null);
useEffect(() => {
  if (jsonToSubmit !== null) {
    post('/api/register', jsonToSubmit);
  }
}, [jsonToSubmit]);

function handleSubmit(e) {
  e.preventDefault();
  setJsonToSubmit({ firstName, lastName });
}
```

The handler sets state purely so that an effect will notice and act. **State is
being used as a message queue.** Every symptom follows: an extra render, a null
check that exists only to skip the first run, a `StrictMode` double-submit
risk, and a dependency array that has to be reasoned about for something that
was never asynchronous.

If a piece of state exists only to trigger an effect, delete both and call the
function directly.

## Gotchas

**Symptom:** a notification or toast appears on page load, without the user
acting.
**Cause:** event logic in an effect. The effect runs on mount and on every
dependency change, and by then it cannot know whether the user did anything.
**Fix:** extract a plain function and call it from the handlers.

**Symptom:** a form submits twice, or submits on mount.
**Cause:** the handler sets state and an effect watches that state to perform the
submit.
**Fix:** call the request directly in the handler and delete the trigger state.

**Symptom:** a piece of state exists purely so that an effect will notice it.
**Cause:** state used as a message queue between a handler and an effect.
**Fix:** delete both — the handler can just call the function.

**Symptom:** an effect contains a condition whose only job is to work out whether
the user did something — `if (product.isInCart)`, `if (jsonToSubmit !== null)`.
**Cause:** intent being reconstructed from state, because the effect cannot see
the cause.
**Fix:** the handler already knows. Move the logic there and delete the
condition.

**Symptom:** a request fires again when the user navigates away and presses Back.
**Cause:** it is attached to the component being displayed rather than to the
interaction, and back-navigation remounts
([04 · 03](../04-cleanup/03-when-cleanup-is-not-the-answer.md)).
**Fix:** move it to the handler. This is a production failure, not a
`StrictMode` artefact.

**Symptom:** the analytics ping was moved to a handler along with everything
else, and now under-reports.
**Cause:** over-applying the rule. That one genuinely is caused by the component
being displayed.
**Fix:** keep it in the effect. react.dev's example deliberately keeps one POST
and moves the other.

## Interview questions

**★ Why is an effect the wrong place for logic triggered by a user action?**
Because by the time the effect runs, the information about what the user did is
gone. react.dev puts it directly: in the click handler you know exactly what
happened; in an effect you do not. So the effect has to reconstruct intent from
state — a `null` check, an `isInCart` flag — and it will also fire on mount and
on unrelated dependency changes, when the user did nothing at all.

**★ Two handlers need the same follow-up logic. Why is an effect the wrong way to
share it?**
Because sharing code between handlers is an ordinary function-extraction problem,
not a React one. Hoisting it into an effect changes its *causation*: it now runs
because the component rendered rather than because a button was pressed, so it
fires on mount and on every dependency change. Extract a plain function in the
component body and call it from both handlers.

**★ Should a POST request go in an effect?**
It depends entirely on what caused it, and react.dev's example keeps one and
moves the other in the same component. An analytics ping fires because the form
was *displayed*, so it is an effect. A registration submit fires because the user
*pressed submit*, so it is an event. The HTTP method tells you nothing; the
causation tells you everything.

**★ What does it mean when a piece of state exists only so an effect will notice
it?**
That state is being used as a message queue between a handler and an effect, and
both should go. The symptoms are consistent: an extra render, a `null` check that
exists only to skip the initial run, an unnecessary dependency array, and a
double-submit risk under `StrictMode`. The handler can simply call the function.

**An effect starts with `if (someFlag)` to decide whether to act. What does that
tell you?**
That it is reconstructing intent it should never have lost. The handler knew
exactly what happened; the effect has to infer it from a flag, and the inference
is always incomplete — the effect still fires on mount, on back-navigation, and
on unrelated dependency changes. A guard clause at the top of an effect is a
reliable smell for misplaced event logic.

**Is the "don't put requests in effects" rule absolute?**
No, and treating it as absolute breaks analytics. The rule is about causation:
a request that fires because the component was *displayed* is correctly an
effect, and react.dev's Form example keeps exactly that one while moving the
registration submit to the handler. Ask what caused the call before deciding
where it goes.

---

Index: [You might not need an effect](README.md) · Next → [Chains of effects](02-chains-of-effects.md)
