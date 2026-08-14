---
title: "05.1 · Two parallel worlds"
sidebar_label: "01 · Two parallel worlds"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Element.setAttribute()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute), [`Element.getAttribute()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAttribute), [`HTMLElement.dataset`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset). Documentation-validated.

**Attributes are the markup; properties are the live object.** They are two different things
that happen to share names, and every confusing behaviour in this topic comes from treating
them as one.

```html
<input id="name" value="Ada">
```

```js
const el = document.querySelector("#name");
el.getAttribute("value");   // "Ada"  — what the markup said
el.value;                   // "Ada"  — the current value… for now
```

Type "Grace" into the field:

```js
el.getAttribute("value");   // "Ada"    ← unchanged. The markup never changes.
el.value;                   // "Grace"  ← the live state
```

🔴 **The attribute is the *initial* value; the property is the *current* value.** For
`<input>` the attribute is even named `defaultValue` on the property side, which is the
platform telling you exactly this. Reading `getAttribute("value")` to find out what the user
typed is a bug, and it is one that passes every test where nobody types anything.

## The general rule

| | Attribute | Property |
|---|---|---|
| Lives in | the markup / serialised HTML | the DOM object |
| Type | **always a string** | any type — string, boolean, number, object |
| Reflects user interaction | **no** | **yes** |
| API | `getAttribute` / `setAttribute` / `removeAttribute` | `el.value`, `el.checked`, … |

MDN on the string part:

> "A specified non-string value specified is **converted automatically into a string**."

So `setAttribute("tabindex", 0)` stores `"0"`, and `getAttribute` always hands you a string or
`null`. Numeric comparisons need parsing:

```js
Number(el.getAttribute("data-count")) + 1;   // ✅
el.getAttribute("data-count") + 1;           // ⚠️ "51" — string concatenation
```

**Default to the property** for anything the user can change or that has a non-string type.
Use attributes for markup-level concerns: `data-*`, ARIA, and attributes with no property
counterpart.

## Where they diverge, concretely

**`value` on form controls** — the case above. Attribute is initial, property is current.

**`checked` on a checkbox** — the same, and worse:

```js
box.checked;                      // true/false — live
box.getAttribute("checked");      // "" or null — whether the markup said so
box.setAttribute("checked", "");  // ⚠️ sets the DEFAULT, not the current state
box.checked = true;               // ✅ actually ticks the box
```

This is why a checkbox "loses its state" when a parent's `innerHTML` is rewritten
([04](../04-text-vs-html/README.md)): the tick lives in the **property**, and only the
attribute is serialised into markup.

**`class` versus `className` versus `classList`** — the attribute is `class`; the property is
`className` (renamed because `class` was a reserved word); and `classList` is the API you
should actually use, since it edits one token without touching the others.

**`href` on a link** — the attribute is what you wrote, the property is resolved:

```html
<a id="l" href="/about">
```

```js
l.getAttribute("href");   // "/about"
l.href;                   // "https://example.com/about"  ← absolute
```

Both are useful; pick deliberately. The property is right for navigation and comparison, the
attribute for reading back exactly what the markup contains.

## Boolean attributes

MDN:

> "Boolean attributes are considered to be **`true` if they're present on the element at
> all**. You should set `value` to the empty string (`""`) or the attribute's name, with no
> leading or trailing whitespace."

```js
helloButton.setAttribute("disabled", "disabled");
// or
helloButton.setAttribute("disabled", "");

// To disable it, remove the attribute entirely
helloButton.removeAttribute("disabled");
```

🔴 **`setAttribute("disabled", "false")` disables the button.** The string `"false"` is
present, and presence is what counts. This is the single most common attribute bug, and it
reads as correct in review.

```js
el.setAttribute("disabled", isDisabled);   // ⚠️ "false" still disables
el.disabled = isDisabled;                  // ✅ the property is a real boolean
el.toggleAttribute("disabled", isDisabled);// ✅ if you must use the attribute
```

**Use the property for booleans.** `disabled`, `checked`, `readonly`, `required`, `hidden`,
`open` — all of them are real booleans on the object and presence-only in markup.

## Attribute names are lowercased

MDN:

> "The attribute name is **automatically converted to all lower-case** when `setAttribute()`
> is called on an HTML element in an HTML document."

So `setAttribute("dataFoo", …)` produces `data-foo`? No — it produces `datafoo`, which is not
what anyone wanted. Attribute names are lowercase in HTML, and camelCase names silently
flatten. This is also why SVG's genuinely camelCase attributes (`viewBox`, `preserveAspectRatio`)
work in SVG documents and are a common source of confusion when set from JavaScript on an
HTML page.

## `data-*` and `dataset`

The one place attributes are unambiguously right, because there is no property counterpart:

```html
<li data-user-id="42" data-role="admin">
```

```js
el.dataset.userId;    // "42"   ← data-user-id → userId
el.dataset.role;      // "admin"
el.dataset.userId = "43";        // writes data-user-id
delete el.dataset.role;          // removes the attribute
```

Two things to keep in mind:

- **The name conversion is `kebab-case` ↔ `camelCase`**, applied automatically.
- **Values are always strings** — the same rule as every attribute. `data-count="0"` reads as
  `"0"`, which is **truthy**. Parse before testing:

```js
if (el.dataset.count) …               // ⚠️ "0" is truthy
if (Number(el.dataset.count)) …       // ✅
```

`dataset` is the right home for small identifiers a handler needs — a row id, a state name.
It is the wrong home for anything large or structured; stashing JSON in an attribute means
serialising on every write and parsing on every read, and a `WeakMap` keyed by the element
([Phase 8 · 04](../../phase-8-modules-errors/04-leaks/README.md)) is better for that.

## Gotchas

**Symptom:** `getAttribute("value")` does not reflect what the user typed
**Cause:** The attribute is the **initial** value; the property is the current one.
**Fix:** `el.value`.

**Symptom:** `setAttribute("disabled", "false")` disables the element
**Cause:** MDN: boolean attributes are true *"if they're present on the element at all"*.
**Fix:** `el.disabled = false`, or `el.toggleAttribute("disabled", cond)`.

**Symptom:** A checkbox's tick disappears when a parent's markup is rewritten
**Cause:** `checked` is a **property**; only the attribute is serialised.
**Fix:** Do not rebuild subtrees to update them — and set state via the property.

**Symptom:** Arithmetic on an attribute produces `"51"` instead of `51`
**Cause:** MDN: non-string values are *"converted automatically into a string"*, and
`getAttribute` always returns a string.
**Fix:** `Number(...)` before arithmetic.

**Symptom:** A `data-count="0"` check is always truthy
**Cause:** The value is the **string** `"0"`.
**Fix:** Parse it, or compare explicitly.

**Symptom:** `setAttribute("dataUserId", …)` creates a strange attribute
**Cause:** Names are *"automatically converted to all lower-case"* — you get `datauserid`.
**Fix:** Write `data-user-id`, or use `dataset.userId`.

**Symptom:** `el.href` is absolute when you expected the literal markup value
**Cause:** The property resolves the URL; the attribute does not.
**Fix:** `getAttribute("href")` when you want exactly what was written.

## Interview questions

**★ What is the difference between an attribute and a property?**
The attribute is the **markup** — always a string, and it does not change when the user
interacts. The property is the **live object state**, properly typed. For `<input>` the
attribute is the *initial* value (mirrored as `defaultValue`) while `.value` is the current
one.

**★ Why does `setAttribute("disabled", "false")` disable an element?**
Because boolean attributes are true *"if they're present on the element at all"* — the value
is irrelevant. Use the property, `el.disabled = false`, or `toggleAttribute`.

**★ Why does a checkbox lose its tick when a parent's `innerHTML` is rewritten?**
Because `checked` is a **property** and only the attribute is serialised into markup. The
reparse produces a fresh element reflecting only the attributes.

**★ What type does `getAttribute` return?**
Always a string, or `null`. MDN notes non-string values passed to `setAttribute` are
*"converted automatically into a string"* — so `data-count="0"` is the truthy string `"0"`.

**★ How does `dataset` map names?**
`kebab-case` attributes to `camelCase` properties — `data-user-id` becomes `dataset.userId`.
Values are still strings. It suits small identifiers; anything large or structured belongs in
a `WeakMap` keyed by the element.

**When is the attribute the right one to read?**
When you want exactly what the markup says — the original `href` rather than the resolved
absolute URL, a `data-*` value, or an ARIA attribute with no property counterpart.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
