---
title: "01 · Custom elements"
sidebar_label: "01 · Custom elements"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Using custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements), [`CustomElementRegistry.define()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define), [`ElementInternals`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals), [`Element.moveBefore()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore). Documentation-validated; **no timings**.

A custom element is a tag the browser does not know until you define it. It is the platform's own
component model: no framework, no build step, and it works in whatever renders the page afterwards.

## Defining one

```js
class StatusPill extends HTMLElement {
  static observedAttributes = ['state'];

  constructor() {
    super();                                  // always first
    this.attachShadow({ mode: 'open' });      // allowed here
  }

  connectedCallback() {
    this.#render();                           // attributes are safe to read NOW
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.#render();
  }

  #render() { /* … */ }
}

customElements.define('status-pill', StatusPill);
```

**The name must contain a hyphen** and start with a lowercase letter. That is not style — it is how
the parser tells your element from a future standard one, and `customElements.define('statuspill',
…)` throws.

### Two kinds

| Kind | Extends | Used as |
|---|---|---|
| **autonomous** | `HTMLElement` | `<status-pill></status-pill>` |
| **customized built-in** | a specific class, e.g. `HTMLParagraphElement` | `<p is="word-count">` |

```js
customElements.define('word-count', WordCount, { extends: 'p' });
```

⚠️ **Safari does not support customized built-ins.** MDN says so plainly, and it is why almost all
real-world components are autonomous — you inherit nothing from `<button>` or `<input>` and
reimplement it, which is a genuine cost of the model.

## The lifecycle callbacks

| Callback | Fires |
|---|---|
| `constructor()` | on creation or upgrade |
| `connectedCallback()` | when inserted into the document |
| `disconnectedCallback()` | when removed from the document |
| `adoptedCallback()` | when moved to a **different document** |
| `attributeChangedCallback(name, old, new)` | when an **observed** attribute changes |
| `connectedMoveCallback()` | when moved with `Element.moveBefore()` |

🔴 **The constructor is severely restricted**, and this is the rule people break first. MDN's list of
what you must **not** do there: inspect attributes, inspect or add children, or do DOM work that
depends on attribute values. You may call `super()`, set initial state, register listeners and
attach a shadow root — nothing else.

The reason is upgrade: an element parsed from HTML before its definition loads runs the constructor
*after* it already has attributes and children, and the specification forbids the constructor from
depending on them so that both creation paths behave identically.

```js
// ❌ throws or silently misbehaves depending on how the element was created
constructor() { super(); this.textContent = this.getAttribute('label'); }

// ✅
connectedCallback() { this.textContent = this.getAttribute('label'); }
```

### `observedAttributes` is opt-in

`attributeChangedCallback` fires **only** for attributes named in the static `observedAttributes`
array. An attribute you forgot to list changes silently — the closest thing this API has to a
foot-gun, because the callback looks broken rather than unregistered.

It also fires for the **initial** values during upgrade, which is why `connectedCallback` and
`attributeChangedCallback` often both call one idempotent `#render()`.

### `connectedCallback` can run more than once

Moving an element with `appendChild` removes and re-inserts it, so `disconnectedCallback` and
`connectedCallback` both fire — a component that assumes "connected means first time" will
double-bind listeners. Make setup idempotent, or track a flag.

`Element.moveBefore()` is the newer API that **moves without disconnecting**, firing
`connectedMoveCallback()` instead of the disconnect/connect pair — which preserves state that a
re-insertion would destroy.

## Upgrade: elements that exist before the definition

```html
<status-pill state="live">…</status-pill>   <!-- parsed now, generic HTMLElement -->
<script type="module" src="./status-pill.js"></script>  <!-- upgraded here -->
```

Until the definition registers, the element is an ordinary unknown element: it renders its
children, has no methods, and CSS `:defined` does not match it. `customElements.whenDefined()`
returns a promise for that moment.

```css
status-pill:not(:defined) { visibility: hidden; }   /* avoid the unstyled flash */
```

The trade-off worth naming: this is the model's real strength — the markup is meaningful before the
JavaScript arrives, and enhances when it lands. It is also the source of the flash of unstyled
content that `:defined` exists to hide.

## Properties, attributes and reflection

A component has two interfaces: attributes for HTML, properties for JavaScript. Keeping them in
step is your job, and the convention is the one the platform uses
([05 · Attributes versus properties](../05-attributes-vs-properties/README.md)):

```js
get state() { return this.getAttribute('state') ?? 'idle'; }
set state(value) { this.setAttribute('state', value); }    // reflect down to the attribute
```

Reflecting means `attributeChangedCallback` is the single place that reacts, whether the change
came from HTML, from `setAttribute`, or from the property — one source of truth again.

⚠️ **A property set before upgrade shadows the accessor.** If a framework assigns
`el.state = 'live'` while the element is still generic, the value lands as an own property on the
instance and your getter never runs. The documented cure is to delete and re-assign it on upgrade:

```js
connectedCallback() {
  for (const prop of ['state']) {
    if (Object.hasOwn(this, prop)) {
      const value = this[prop];
      delete this[prop];
      this[prop] = value;         // now it goes through the setter
    }
  }
}
```

## `ElementInternals` — form participation and custom states

`this.attachInternals()` gives a component access to the parts of the platform normally reserved
for built-ins:

```js
class MyInput extends HTMLElement {
  static formAssociated = true;             // required for form participation

  #internals = this.attachInternals();

  set value(v) { this.#internals.setFormValue(v); }
}
```

- **Form association** — the element submits a value with the form, participates in validation and
  in `FormData` ([09 · Forms](../09-forms/01-formdata.md)).
- **Custom states** — `this.#internals.states.add('hidden')`, styled with the `:state()`
  pseudo-class. State that is genuinely internal, and not exposed as an attribute anyone can set.
- **ARIA defaults** — internals also carry the element's implicit role and ARIA properties, which
  is how a custom element declares what it *is* rather than requiring `role` in every usage.

## Gotchas

**Symptom: `customElements.define()` throws.**
Cause — the name has no hyphen, or that name is already defined, or the same class is being
registered twice.
Fix — hyphenated lowercase name, and guard with `if (!customElements.get(name))` in code that may
load twice.

**Symptom: the element renders nothing until you touch it.**
Cause — rendering was done in the constructor, where attributes and children are not available.
Fix — render in `connectedCallback`, keeping it idempotent.

**Symptom: `attributeChangedCallback` never fires.**
Cause — the attribute is not listed in the static `observedAttributes`.
Fix — add it. There is no wildcard.

**Symptom: listeners are bound twice and events fire twice.**
Cause — the element was moved with `appendChild`, so it disconnected and reconnected.
Fix — make `connectedCallback` idempotent, clean up in `disconnectedCallback`, or move with
`moveBefore()` where available.

**Symptom: a property set by a framework is ignored by the component.**
Cause — it was assigned before upgrade and shadows the class accessor.
Fix — the delete-and-reassign upgrade pattern in `connectedCallback`.

**Symptom: unstyled content flashes before the component initialises.**
Cause — the element is meaningful before its definition loads.
Fix — style `:not(:defined)`, and `customElements.whenDefined()` where you need to wait in code.

**Symptom: `<p is="word-count">` works in Chrome and not in Safari.**
Cause — Safari does not support customized built-in elements.
Fix — an autonomous element, accepting that you reimplement the built-in behaviour.

## Interview questions

**★ Why must a custom element's name contain a hyphen?**
So the parser can distinguish author-defined elements from current and future standard ones.
`customElements.define()` throws without it.

**★ What may you not do in a custom element's constructor?**
Inspect attributes, inspect or add children, or any DOM work that depends on them. Only `super()`,
initial state, listeners and `attachShadow()`. The restriction exists because an upgraded element
runs its constructor after it already has attributes and children.

**★ What is element upgrade?**
Markup for an undefined element parses as a generic element and renders its children; when the
definition registers, the browser upgrades it — running the constructor, then
`attributeChangedCallback` for observed attributes, then `connectedCallback`. `:defined` and
`customElements.whenDefined()` let you handle the interval.

**★ Why might `connectedCallback` run several times?**
Because moving an element with `appendChild` disconnects and reconnects it. Setup must be
idempotent, with teardown in `disconnectedCallback`; `moveBefore()` avoids the pair entirely and
fires `connectedMoveCallback()`.

**★ What does `ElementInternals` give you?**
Form participation (`formAssociated` plus `setFormValue`), custom states styled with `:state()`,
and the element's implicit ARIA role and properties — the built-in capabilities that were otherwise
closed to custom elements.

**Autonomous or customized built-in?**
Autonomous in practice: Safari does not support customized built-ins. The cost is that you
reimplement everything a native `<button>` or `<input>` would have given you.

---

[Topic index](./README.md) · [02 · Shadow DOM](./02-shadow-dom.md) →
