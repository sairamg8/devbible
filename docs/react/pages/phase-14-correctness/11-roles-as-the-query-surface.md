---
title: "Roles are the query surface"
sidebar_label: "11 · Roles as the query surface"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **Testing Library DOM 10.x** and the **HTML-AAM / ARIA**
> model, from documentation —
> [Queries · About](https://testing-library.com/docs/queries/about) (the priority order and
> the reason test ids come last),
> [ByRole](https://testing-library.com/docs/queries/byrole) (the accessibility tree and the
> `name` option) and
> [MDN · Accessible name](https://developer.mozilla.org/en-US/docs/Glossary/Accessible_name)
> (names come from element content, associated elements such as `<label>`, `<legend>` and
> `<caption>`, attributes such as `alt`, or `aria-label`/`aria-labelledby`; *"It is best to
> use visible text as the accessible name"*; *"All controls must have an accessible name"*).
> No sandbox script backs this page; claims are cited, not measured.

This topic is not about accessibility as a subject. It is about a practical consequence:
**Testing Library queries the accessibility tree, so how easy a component is to query is a
direct measurement of how usable it is.** A component that is awkward to test is usually
awkward to use with a keyboard or a screen reader — and the query failure is the earliest,
cheapest signal you will get.

## The two halves of a role query

```jsx
screen.getByRole("button", { name: /save invoice/i });
//                 ^role            ^accessible name
```

**The role is what the element *is*.** It comes from the tag for semantic HTML — `<button>`
is `button`, `<a href>` is `link`, `<h2>` is `heading` — or from an explicit `role`
attribute. A `<div onClick>` has no role at all, which is why it cannot be queried this way
and why a keyboard user cannot activate it. Same cause, two symptoms.

**The accessible name is what it is *called*.** Per MDN it is computed from element content,
from an associated element (`<label>`, `<legend>`, `<caption>`), from an attribute like
`alt`, or from `aria-label`/`aria-labelledby` — and the guidance is that **visible text is
the best source**.

## Reading a failed query as a finding

`getByRole` failures print the roles and names actually present, which turns the error into a
diagnosis. Four common ones:

**1 · "There are no accessible roles" for something clearly interactive.**
The element is a `<div>` or `<span>` with a click handler. It is not focusable, not
keyboard-activatable, and invisible to assistive technology.
**Fix:** use a `<button>`. Nearly always the whole fix — focus, Enter/Space activation,
role and default semantics arrive together.

**2 · The role is there, the name is empty.**
An icon-only button: `<button><TrashIcon /></button>`. MDN's rule is that all controls must
have an accessible name; this one has none, so a screen-reader user hears "button".
**Fix:** `aria-label="Delete invoice"`, or visually-hidden text inside the button. Then
`getByRole('button', { name: /delete invoice/i })` works — and so does the screen reader.

**3 · The name is not what you expected.**
Usually because the name is composed from all the content, so an icon's `alt` or a stray
`<span>` is joining in. The failure message shows the computed name.
**Fix:** query what is really there, or mark decorative icons `aria-hidden="true"` — which is
correct anyway, since a decorative icon should not be announced.

**4 · Several elements share a name.**
Five "Delete" buttons in a table. A screen-reader user hears "Delete, Delete, Delete" with no
way to tell them apart.
**Fix:** distinguish the names — "Delete invoice A-1001" — usually with visually-hidden text.
The test then scopes cleanly and the app improves for exactly the same reason.

## Form fields are the most common failure

```jsx
// ❌ not queryable by label, and not usable
<input type="email" placeholder="Email" />

// ✅
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

The placeholder version cannot be found by `getByLabelText`, and the docs say plainly that
*"a placeholder is not a substitute for a label"* — it disappears on typing, is often too
low-contrast, and is not reliably announced. **When `getByLabelText` fails, the field usually
has no label at all.**

## Groups, dialogs and landmarks

- **A dialog needs an accessible name** — `aria-label` or `aria-labelledby` pointing at its
  heading — so `getByRole('dialog', { name: /confirm deletion/i })` works and a screen-reader
  user knows which dialog opened.
- **Radio and checkbox groups** take their name from a `<fieldset>`'s `<legend>`, which is
  what makes "shipping method" queryable as a group rather than as three loose inputs.
- **Landmarks** — `main`, `navigation`, `banner`, `contentinfo` — give you natural scoping
  regions: `within(screen.getByRole('navigation'))`.
- **Tables** name rows from their cells' text, which is why
  `getByRole('row', { name: /A-1001/ })` is the clean way to reach a row without a test id.

## When the element genuinely has no role

Some things have no accessible identity and should not be forced into one: a chart canvas, a
purely visual container, a layout region. **That is what `getByTestId` is for**, and using it
there is the documented, correct call ([topic 03](03-the-query-families/README.md)). The
mistake is a test id on a button that already has a role and a name.

⚠️ **Do not add ARIA to make a test pass.** `role="button"` on a `<div>` satisfies the query
and leaves the element unfocusable and unactivatable by keyboard — a strictly worse outcome
than before, because the accessibility tree now claims something untrue. Use the semantic
element.

## The limits of this signal

Queryability is a proxy, not an audit. It says nothing about colour contrast, focus order,
focus trapping, reduced motion, or whether the announcement makes sense in context. A
component can be fully queryable and still fail real accessibility review.

Automated checks — `jest-axe` and similar — catch a further slice, and are worth adding for
rule-based issues. Neither replaces keyboard and screen-reader testing on the paths that
matter. **The honest claim is narrow and still valuable: if it is hard to query, it is
probably hard to use.**

## Gotchas

**Symptom:** "Unable to find an accessible element with the role button".
**Cause:** it is a `<div onClick>`.
**Fix:** make it a `<button>`. The test is reporting that keyboard users cannot activate it.

**Symptom:** the button is found only as `{ name: '' }`.
**Cause:** icon-only, with no accessible name.
**Fix:** `aria-label` or visually-hidden text — required for controls regardless of testing.

**Symptom:** `getByLabelText` cannot find a field that visibly has a label.
**Cause:** the label is not associated — no `htmlFor`/`id` pair and no wrapping `<label>`, or
it is a `<div>` styled to look like a label.
**Fix:** associate them properly; the click-to-focus behaviour users expect returns too.

**Symptom:** the accessible name includes text you did not expect.
**Cause:** the name is composed from content, including icon `alt` text and nested spans.
**Fix:** `aria-hidden="true"` on decorative icons, which is the correct markup anyway.

**Symptom:** a query works after adding `role="button"` to a `<div>`.
**Cause:** the role was added for the test.
**Fix:** revert it and use a `<button>`. An ARIA role without the behaviour is a lie in the
accessibility tree.

**Symptom:** every row's Delete button matches the same query.
**Cause:** identical accessible names.
**Fix:** include the row's identity in the name, or scope with `within` — the first also
fixes the experience for screen-reader users.

## Interview questions

**★ Why does querying by role tell you something about accessibility?**
Because the query reads the accessibility tree — the same structure assistive technology
uses. If `getByRole` cannot find an element, it is absent from that tree, which usually means
it is a `<div>` with a click handler that keyboard and screen-reader users cannot operate.
The test failure and the usability bug have one cause.

**★ Where does an accessible name come from?**
From element content for things like buttons and links, from an associated element such as a
`<label>`, `<legend>` or `<caption>`, from attributes like `alt`, or from `aria-label` /
`aria-labelledby`. MDN's guidance is to prefer visible text, and that all controls must have
a name — which is why an icon-only button without one is a genuine defect, not just an
inconvenient query.

**★ A `getByRole('button')` query fails. What is the likely bug and the likely fix?**
The element is probably a `<div>` or `<span>` with an `onClick`. The fix is a real `<button>`,
which brings focusability, Enter/Space activation and the role together. Adding
`role="button"` instead makes the query pass while leaving it unusable by keyboard, which is
worse than the original.

**Is "queryable by role" the same as "accessible"?**
No. It is a useful proxy covering roles, names and the presence of elements in the tree, but
it says nothing about contrast, focus order, focus trapping or whether announcements make
sense. Automated tools like `jest-axe` catch more rule-based issues; neither replaces keyboard
and screen-reader testing on important paths.

**Five rows each have a "Delete" button. What do you do?**
Give each an accessible name that includes the row's identity, usually via visually-hidden
text, or scope the query with `within(row)`. Both make the test unambiguous, and the first
also fixes the experience for someone hearing five identical "Delete" announcements.

---

← Prev: [Wrappers — context, providers and the router](10-wrappers-and-providers.md) ·
Index: [Phase 14](README.md) ·
Next → [Snapshot tests](12-snapshot-tests.md)
