---
title: "The priority order"
sidebar_label: "02 · The priority order"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **Testing Library DOM 10.x / RTL 16.x**, from documentation —
> [Queries · About](https://testing-library.com/docs/queries/about) (the three-tier priority
> list and the stated rationale for each query) and
> [ByRole](https://testing-library.com/docs/queries/byrole) (the full options list, the
> W3C WAI-ARIA 1.2 tree-exclusion behaviour, `hidden: false` by default, and the
> performance note).
> No sandbox script backs this page; claims are cited, not measured.

Testing Library publishes an explicit ranking of its queries. It is not style advice — it
is the guiding principle turned into a lookup table, ordered by **how closely the handle
you grab resembles the handle a real person has.**

| Tier | Queries | The idea |
|---|---|---|
| **1 · Accessible to everyone** | `ByRole`, `ByLabelText`, `ByPlaceholderText`, `ByText`, `ByDisplayValue` | how the element is perceived by sighted users *and* assistive technology |
| **2 · Semantic** | `ByAltText`, `ByTitle` | HTML/ARIA attributes with less consistent support |
| **3 · Test IDs** | `ByTestId` | invisible to the user; the last resort |

Work down the list and stop at the first one that fits.

## Tier 1, in order

**`getByRole` — the default, and the one worth learning properly.** The docs' reason:
*"This can be used to query every element that is exposed in the accessibility tree"*. A
role plus an accessible name is very close to the sentence a user would say — "the Save
button", "the Invoices heading", "the Email field".

```jsx
screen.getByRole("button", { name: /save/i });
screen.getByRole("heading", { name: /invoices/i, level: 2 });
screen.getByRole("textbox", { name: /email/i });
```

**`getByLabelText` — for form fields.** The docs call it *"really good for form fields"*,
and it is the direct expression of the thing that makes a form usable: a control with a
label attached. It matches a `<label for>`, a wrapping `<label>`, `aria-label` or
`aria-labelledby` — so a passing query is also evidence the field is labelled at all.

**`getByPlaceholderText` — when there is no label, and only then.** The documentation is
blunt that *"a placeholder is not a substitute for a label"*. Reaching for this query is
worth one moment's thought about whether the fix is a label rather than a different query.

**`getByText` — the main way users find non-interactive content.** Paragraphs, list items,
status messages, the empty state. Note the split: text *inside* an interactive element is
better queried as that element's accessible name — `getByRole('button', { name: /save/i })`
rather than `getByText('Save')`, because the first also asserts that it is a button.

**`getByDisplayValue` — the current value of a filled-in control.** Narrow but real: "the
form loaded with the customer's saved email in it".

## Tier 2 — semantic

**`getByAltText`** for images and any element that takes `alt`. **`getByTitle`** is
explicitly discounted by the docs — a `title` is *"not consistently read by screenreaders,
and is not visible by default"*. In practice `ByTitle` shows up for SVG `<title>` elements
and little else.

## Tier 3 — test ids, and when they are right

The docs are direct: `getByTestId` is *"only recommended for cases where you can't match by
role or text"*, and the reason is that *"the user cannot see (or hear) these"*.

That is a real "sometimes", not a ban. Legitimate cases:

- **A container with no accessible identity** — a chart wrapper, a canvas, a layout region
  you need to scope `within` to.
- **Genuinely dynamic content** where the visible text is the thing under test, so keying
  the query on that text would make the test circular.
- **Third-party markup you do not control** and cannot add labels to.

The failing use is a test id on a button that already has a role and a name. That trades a
handle the user has for one only the test has, and it is exactly the case the ranking
exists to prevent.

## `getByRole` in depth

The role query has the largest option set, and knowing it removes most reasons to drop down
the list.

| Option | Notes |
|---|---|
| `name` | the **accessible name** — a `TextMatch`, so a string, regex or function |
| `level` | headings only: `getByRole('heading', { level: 1 })` |
| `hidden` | **defaults to `false`** — elements excluded from the accessibility tree are not matched |
| `checked`, `selected`, `pressed`, `expanded`, `busy`, `current` | query by ARIA state — a toggled toolbar button, an open disclosure, an active nav link |
| `value` | range widgets: `{ min, max, now, text }` for sliders and progress bars |
| `description` | matches the accessible *description*, e.g. from `aria-describedby` |
| `queryFallbacks` | matches later roles in a multi-role `role="a b"` list, which are otherwise ignored |

**`hidden: false` by default is the important one.** By default the query follows the
**W3C WAI-ARIA 1.2 tree-exclusion rules** — so anything `display: none`, `visibility:
hidden`, `hidden`, or under `aria-hidden="true"` is invisible to it. Two consequences you
will meet:

- **This is a feature.** A closed dialog's buttons are not found, and neither is content
  behind an `aria-hidden` overlay — which mirrors what a screen-reader user experiences.
  A "cannot find the button" failure on an open-looking modal is frequently the test
  correctly reporting that the modal is inert.
- **`hidden: true` widens the search** to elements normally excluded, at the cost of
  matching things nobody can reach. Use it to *diagnose* ("is it in the DOM but hidden?"),
  rarely to assert.

One documented exception is worth knowing: `role="none"` and `role="presentation"` are
*"considered in the query in any case"*.

⚠️ **The performance note is also documented**, and it explains a slow suite: the
accessibility-tree calculation *"can be expensive (particularly with large DOM trees)"*.
`getByLabelText` and `getByText` are described as *"significantly faster though less robust
alternatives"*, and `hidden: true` speeds `ByRole` up by skipping visibility checks. **Do
not optimise here by default** — correctness first, and most suites are slow for other
reasons ([topic 14](../14-flaky-tests-and-ci.md)). But if profiling points at queries on a
large tree, this is a real lever with a real trade-off.

## Roles you will use constantly

| Element | Role | Name comes from |
|---|---|---|
| `<button>`, `<input type="submit">` | `button` | text content, `aria-label` |
| `<a href>` | `link` | link text |
| `<input type="text">`, `<textarea>` | `textbox` | its label |
| `<input type="checkbox">` | `checkbox` | its label; state via `checked` |
| `<input type="radio">` | `radio` | its label; state via `checked` |
| `<select>` | `combobox` | its label |
| `<h1>`–`<h6>` | `heading` | text content; `level` selects which |
| `<ul>`/`<ol>` and `<li>` | `list` / `listitem` | — |
| `<table>`, `<tr>`, `<td>` | `table` / `row` / `cell` | row name from its cells' text |
| `<dialog>`, `role="dialog"` | `dialog` | `aria-label` or `aria-labelledby` |
| `<img alt="…">` | `img` | the `alt` text |
| an element with `role="alert"` | `alert` | its text — the standard handle for errors |

⚠️ **`<input type="text">` is a `textbox`, but `<input type="search">` is a `searchbox` and
`<input type="number">` is a `spinbutton`.** Guessing costs more time than looking, and the
error message from a failed `getByRole` lists the roles actually present in the DOM —
usually the fastest way to the right answer.

## Scoping with `within`

The right response to an ambiguous query is almost always to narrow the region rather than
change the query:

```jsx
const row = screen.getByRole("row", { name: /A-1001/ });
await user.click(within(row).getByRole("button", { name: /cancel/i }));

const dialog = screen.getByRole("dialog", { name: /confirm cancellation/i });
await user.click(within(dialog).getByRole("button", { name: /^cancel order$/i }));
```

This reads the way the interaction actually happened — *in that row, click Cancel* — and it
survives new rows, reordering, and a second Cancel button appearing in a dialog.

## Gotchas

**Symptom:** `getByRole('button', { name: 'Save' })` fails, but the button is on screen.
**Cause:** the accessible name is not what you assumed — an icon-only button with no
`aria-label`, or a name including hidden text or an icon's alt text.
**Fix:** read the roles-and-names list printed in the error. If the button genuinely has no
accessible name, that is a real accessibility bug the test just found
([topic 11](../11-roles-as-the-query-surface.md)).

**Symptom:** an element is in the DOM but `getByRole` will not match it.
**Cause:** it is excluded from the accessibility tree — `display: none`, `hidden`,
`aria-hidden`, or an inert ancestor — and `hidden` defaults to `false`.
**Fix:** confirm with `hidden: true` to see whether that is the cause, then fix the app if
the element should be reachable. Do not leave `hidden: true` in the assertion.

**Symptom:** the suite is slow and the profile points at queries.
**Cause:** accessibility-tree computation on a large DOM, which the docs call expensive.
**Fix:** consider `hidden: true` or a `ByLabelText`/`ByText` query in the hot spot,
knowingly trading robustness for speed. Check first that the real cost is not module
transforms or an un-mocked network ([topic 14](../14-flaky-tests-and-ci.md)).

**Symptom:** everything is queried by test id and no test ever breaks meaningfully.
**Cause:** test ids used as the primary handle, bypassing the ranking.
**Fix:** re-query the interactive elements by role and name. Keep test ids for containers
with no accessible identity and for third-party markup.

**Symptom:** `getByText('Save')` matches the button's inner `<span>`, so a click behaves oddly.
**Cause:** text queries return the element containing the text, not the interactive ancestor.
**Fix:** query the interactive element itself: `getByRole('button', { name: /save/i })`.

## Interview questions

**★ What is Testing Library's query priority order, and why does it exist?**
Queries accessible to everyone first — role, label, placeholder, text, display value — then
semantic queries like alt and title, then test ids last. The ordering ranks queries by how
closely they resemble the handle a real user has, so a test written high on the list breaks
when the user's experience breaks and survives refactors the user cannot perceive. Test ids
are last because, in the docs' words, the user cannot see or hear them.

**★ Why is `getByRole` the recommended default?**
Because it queries the accessibility tree, so it matches on the two things a user actually
perceives — what the element *is* and what it is *called*. It also asserts something extra
for free: if the query passes, the element has a role and an accessible name, which is the
minimum for it to be usable with assistive technology.

**★ What does the `hidden` option do and what is its default?**
It defaults to `false`, meaning the query follows the W3C WAI-ARIA tree-exclusion rules and
ignores anything hidden from assistive technology. Setting it to `true` includes those
elements — useful for diagnosing "is it in the DOM but hidden?", but it weakens the
assertion because it matches things nobody can reach.

**★ When is `getByTestId` the right choice?**
When there is genuinely nothing accessible to match: a container with no role or name, a
canvas or chart wrapper, third-party markup you cannot change, or a case where querying the
visible text would make the test circular. Not for a button that already has a role and a
name — that swaps the user's handle for the test's.

**Your `getByRole` query fails but you can see the element. What do you do?**
Read the error, which lists the roles and accessible names present. Usually the accessible
name differs from the visible text, the role is not the one assumed (`searchbox` rather than
`textbox`), or the element is excluded from the accessibility tree. Each of those is worth
knowing about the component, which is why the failure is useful rather than annoying.

**How do you handle two identical buttons on the page?**
Scope with `within` to the row, section or dialog the interaction really happened in, or give
them distinct accessible names. Both fixes describe the app more truthfully; indexing into
`getAllBy` describes only document order.

**Is `getByRole` ever the wrong choice for performance reasons?**
It can be. The docs say the accessibility-tree calculation is expensive on large trees and
name `getByLabelText`/`getByText` as faster but less robust. It is a real trade-off, worth
making only where profiling shows the cost — not as a default posture.

---

← Prev: [`getBy`, `queryBy`, `findBy`](01-get-query-find.md) ·
Index: [The query families](README.md) ·
Next → [`user-event` over `fireEvent`](../04-user-event-over-fireevent/README.md)
