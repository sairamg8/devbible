---
title: "Four element-level decisions carry most of the accessibility defects in a React codebase — link or button, labelled or placeholdered, table or grid of divs, and what `alt` should say — and none of them are visible in a screenshot"
sidebar_label: "04b · Links, buttons, forms, alt"
sidebar_position: 114
description: "Link versus button and why a clickable div fails two success criteria at once, the type=submit default, form labelling and aria-describedby, error announcement with role=alert, table semantics, and the alt decision as a four-way table."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **WCAG 2.2** (W3C Recommendation,
> [w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/)) — criteria 1.1.1, 2.1.1, 2.5.3, 3.3.2, 4.1.2
> and 4.1.3 quoted verbatim — and
> [*Using ARIA*](https://www.w3.org/TR/using-aria/) (W3C), rules 1 and 3.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**[04](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md) is the model: a second rendering of your page that assistive technology reads. This page is where that rendering is actually built or destroyed, one element at a time. Four decisions account for most of what an audit will find in a React codebase — whether a clickable thing is a link or a button, whether an input has a real label, whether a table is a table, and what `alt` says — and every one of them is invisible in a screenshot, invisible to a mouse user, and invisible to a designer's review. They are also each a one-line fix, which is why they are worth knowing cold rather than looking up.**

## Links versus buttons

The single highest-value distinction in this whole area.

| | `<a href>` / `<Link href>` | `<button>` |
|---|---|---|
| Means | navigate to a URL | perform an action here |
| Keyboard | Enter | Enter **and** Space |
| Announced as | link | button |
| Right-click / middle-click | open in new tab, copy address | nothing |
| Works without JS | yes | no |

`next/link` renders a real anchor, so a `<Link>` is a link in every sense that matters. The failures are the two substitutions:

```tsx
// 🔴 A div that navigates: no role, no keyboard, no context menu, no focus
<div onClick={() => router.push(`/tasks/${task.id}`)}>{task.title}</div>

// 🔴 A link that acts: announced as a link, but goes nowhere and breaks middle-click
<a href="#" onClick={deleteTask}>Delete</a>

// ✅
<Link href={`/tasks/${task.id}`}>{task.title}</Link>
<button type="button" onClick={deleteTask}>Delete</button>
```

The `<div onClick>` form fails **2.1.1 Keyboard** — *"All functionality of the content is operable through a keyboard interface"* — and **4.1.2 Name, Role, Value** simultaneously, and it is the most common accessibility defect in React codebases by a wide margin, because it looks fine, works with a mouse, and no automated tool that only looks at rendered HTML can be certain it is interactive.

The counter-argument you will hear is *"we added `role="button"` and `tabIndex={0}`"*. W3C's third rule of ARIA use is where that stops:

> *"All interactive ARIA controls must be usable with the keyboard."* — *"if using role=button the element must be able to receive focus and a user must be able to activate the action associated with the element using both the enter (on WIN OS) or return (MAC OS) and the space key."*

So the honest version of the div-as-button is:

```tsx
// pseudo-code — what role="button" actually commits you to
<div
  role="button"
  tabIndex={0}
  aria-disabled={pending || undefined}
  onClick={act}
  onKeyDown={(e) => {
    if (e.key === 'Enter') act()
    if (e.key === ' ') {
      e.preventDefault() // Space scrolls the page otherwise
      act()
    }
  }}
>
  Delete
</div>
```

…and that still has no form participation, no real `disabled`, and no default focus ring. Rule 1 of *Using ARIA* is the answer:

> *"If you can use a native HTML element or attribute with the semantics and behavior you require already built in, instead of re-purposing an element and adding an ARIA role, state or property to make it accessible, then do so."*

🔴 **`type="button"` is not optional.** A `<button>` inside a `<form>` with no `type` defaults to `submit`, so every unmarked button in a form submits it. That is a functional bug that presents as an accessibility one — and in an App Router codebase where forms are wired to Server Actions, an accidental submit fires a mutation.

### The link that opens in a new tab

```tsx
<a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
  Download invoice <span className="sr-only">(opens in a new tab)</span>
</a>
```

The visually-hidden suffix is not decoration: a new tab is a change of context with no warning, and the only signal a sighted user gets is often an icon that conveys nothing to the accessibility tree. Announce it in the name.

## Forms

> *"Labels or instructions are provided when content requires user input."*
> — **3.3.2 Labels or Instructions (Level A)**

```tsx
// ✅ explicit association — works everywhere, survives refactors
<label htmlFor="task-title">Title</label>
<input
  id="task-title"
  name="title"
  required
  aria-describedby="task-title-hint task-title-error"
/>
<p id="task-title-hint">Keep it under 80 characters.</p>
{error && (
  <p id="task-title-error" role="alert">
    {error}
  </p>
)}
```

Four things there are load-bearing:

- **`htmlFor` / `id`, not a wrapping label alone.** Wrapping works, but breaks the moment someone puts a second control inside for layout.
- **`aria-describedby` takes a space-separated list of ids**, and ids that do not exist are silently ignored — so listing the error id unconditionally is safe.
- **`placeholder` is not a label.** It disappears on input, has no programmatic relationship to the field, and typically fails contrast.
- **`role="alert"` on the error** makes it announced when it appears, which is WCAG **4.1.3 Status Messages**: *"status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus."*

The generated-id question — what `id="task-title"` does when the component renders twice on one page — is `useId`, and it has a hydration dimension that gets its own page: [04d](04d-hydration-safe-accessible-markup.md).

### Required, invalid, and the two ways to say it

```tsx
<input
  id="email"
  name="email"
  type="email"
  required
  aria-invalid={error ? true : undefined}
  aria-describedby={error ? 'email-error' : undefined}
/>
```

`required` is the HTML attribute and is announced; `aria-required` is the ARIA equivalent and is redundant beside it. `aria-invalid` has no HTML equivalent and must be set explicitly — 🔴 **set it to `undefined` rather than `false` when there is no error**, because `aria-invalid="false"` is a distinct announced state ("valid") rather than the absence of one, which is noisy on a form the user has not touched.

### Label in name

> *"For user interface components with labels that include text or images of text, the name contains the text that is presented visually."*
> — **2.5.3 Label in Name (Level A)**

This is the criterion that makes a well-meaning `aria-label` a *failure*:

```tsx
// 🔴 Visible text says "Save"; voice control users saying "click Save" get nothing
<button aria-label="Save changes to this task">Save</button>

// ✅ the accessible name contains the visible text
<button aria-label="Save changes to this task" title="Save changes">Save…</button>
// ✅ better: make the visible text the name
<button>Save changes</button>
```

`aria-label` **replaces** the accessible name entirely. If the visible text is not a substring of it, voice control users cannot address the control by what they can see. The safest rule: prefer visible text; when you must use `aria-label`, start it with the visible text.

## Tables, lists and the alt decision

**Tables** need `<caption>`, `<th>` and `scope`:

```tsx
<table>
  <caption>Open tasks by assignee</caption>
  <thead>
    <tr>
      <th scope="col">Assignee</th>
      <th scope="col">Open</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Priya</th>
      <td>12</td>
    </tr>
  </tbody>
</table>
```

Without `scope`, a cell read in isolation is a bare number. With it, a screen reader announces *"Priya, Open, 12"*. If your data is not tabular, do not use a table — and if it *is*, do not build it from `<div>`s with grid CSS, which produces a visually identical table with no table semantics at all.

**Lists** matter more than they look: a screen reader announces *"list, 5 items"*, which is real navigational information. A stack of `<div>`s does not. 🔴 And a `<ul>` must contain only `<li>` as element children — wrapping each item in a `<div>` for layout destroys the list semantics of the whole thing, which is the second rule of ARIA use expressed in plain HTML.

**Images** are one decision, from **1.1.1 Non-text Content**: *"If non-text content is a control or accepts user input, then it has a name that describes its purpose."*

| The image | `alt` |
|---|---|
| Conveys information not in the surrounding text | describe the information |
| Is the only content of a link or button | describe the **destination or action**, not the picture |
| Repeats adjacent text (an avatar beside the name) | `alt=""` |
| Is decoration | `alt=""` |

🔴 **`alt=""` is a decision and a missing `alt` is a bug.** They are not the same: an empty alt tells assistive technology to skip the image; a missing one makes many screen readers announce the filename.

The second row is the one that gets reversed. An icon-only button containing an SVG needs the name of the *action*:

```tsx
// 🔴 announces "trash can" — the user must infer what it does
<button type="button" onClick={remove}>
  <TrashIcon aria-label="Trash can" />
</button>

// ✅ the button carries the name; the icon is hidden from the tree
<button type="button" onClick={remove} aria-label="Delete task">
  <TrashIcon aria-hidden="true" />
</button>
```

And the image no tool will check: `og:image` is not in your DOM, so its alt text comes from `openGraph.images[].alt` or an `opengraph-image.alt.txt` file and nothing will ever warn you about it ([02d](02d-the-opengraph-image-and-twitter-image-file-conventions.md)).

## Gotchas

**★ A clickable `<div>` is unreachable by keyboard.** No role, no tab stop, no Enter or Space handling. Fix: `<Link>` if it navigates, `<button type="button">` if it acts. Adding `role="button"` and `tabIndex={0}` is a worse version of a `<button>` that you now have to maintain — including the `preventDefault` on Space that stops the page scrolling.

**★ Every button in a form submits it.** `<button>` defaults to `type="submit"`. In an App Router form wired to a Server Action, that means an accidental mutation. Fix: `type="button"` on everything that is not the submit control — make it a lint rule, because it is invisible in review.

**★ `placeholder` is used as the label.** It vanishes on input, has no programmatic association, and usually fails contrast. Fix: a real `<label htmlFor>`; use `placeholder` only for a format example.

**★ A form error appears visually and is never announced.** It was added to the DOM with no live semantics. Fix: `role="alert"` on the error element, and reference its id from the input's `aria-describedby`.

**★ `aria-invalid="false"` is announced on every untouched field.** `false` is a state, not an absence. Fix: `aria-invalid={error ? true : undefined}` so the attribute is not rendered at all when there is no error.

**★ Voice control cannot activate a button whose visible text is "Save".** An `aria-label` that does not contain the visible text replaces the name entirely, so "click Save" matches nothing — WCAG 2.5.3. Fix: make the visible text the name, or start the `aria-label` with it.

**★ An icon-only button announces the icon, not the action.** The `aria-label` was put on the SVG describing the picture. Fix: `aria-hidden="true"` on the icon and `aria-label` on the button naming what it does.

**★ A data grid is built from `<div>`s and CSS grid.** Visually a table, semantically nothing — no row/column relationships, no header association. Fix: a real `<table>` with `<caption>`, `<th>` and `scope`. CSS can still lay it out.

**★ An avatar image beside a name announces the name twice.** The `alt` duplicates adjacent text. Fix: `alt=""`.

**★ A `<ul>` whose items are wrapped in `<div>`s is not a list.** Non-`<li>` element children break the list semantics for the whole container. Fix: put the wrapper *inside* the `<li>`.

**★ `target="_blank"` with no warning.** The context change is announced to nobody. Fix: a visually-hidden "(opens in a new tab)" inside the link, plus `rel="noopener noreferrer"` for the security half.

**★ A link's accessible name is "Read more", eleven times.** Screen-reader users list links out of context, so eleven identical names are eleven unusable links. Fix: put the subject in the link text, or append a visually-hidden qualifier — `Read more<span className="sr-only"> about billing</span>`.

## Interview questions

**★ Someone argues that `<div onClick>` with `role="button"` and `tabIndex={0}` is equivalent to a `<button>`. What is missing?**
Keyboard activation, at minimum: a native button fires on both Enter and Space and a div fires on neither, so you must add a key handler that distinguishes them and calls `preventDefault` on Space to stop the page scrolling — W3C's third rule of ARIA use states exactly that requirement for `role=button`. Then form participation, since a native button can submit or reset; then the real `disabled` state, which `aria-disabled` only announces rather than enforces; then the default focus ring and correct rendering in forced-colors mode. The practical point is that you are reimplementing a control the platform ships, and every piece is something to get wrong, review and maintain forever — which is why rule 1 of *Using ARIA* says to use the native element if it exists.

**★ When is `alt=""` correct, and how is it different from omitting `alt`?**
`alt=""` is correct when the image adds nothing a user would miss: pure decoration, or an image whose information is already in adjacent text — an avatar next to the person's name being the canonical case. It explicitly tells assistive technology to skip the image. Omitting the attribute is a different instruction: the image has no accessible name, so many screen readers fall back to announcing the filename and the user hears something like "IMG underscore 4021 dot jpg". One is a decision recorded in the markup; the other is an absence that gets read out loud.

**★ Why can an `aria-label` make a control *less* accessible?**
Because it replaces the accessible name rather than supplementing it. WCAG 2.5.3 requires that a component's name contain the text presented visually, and voice control depends on it — a user saying "click Save" is matching against the accessible name, so a button that reads "Save" but is named "Save changes to this task" cannot be activated by voice at all. It also silently overrides any content inside the element, so an `aria-label` on a wrapper can hide a whole subtree's text from the tree. The default should be visible text as the name; `aria-label` is for controls that genuinely have no visible text, and even then it should begin with whatever text is visible.

**★ A form error is rendered conditionally and sighted users see it immediately. What does a screen-reader user experience, and what fixes it?**
Nothing, unless the element carries live-region semantics. Content inserted into the DOM is not announced by default; the user finds out only when they next navigate to that part of the page, which for an error above the submit button may be never. `role="alert"` gives it an implicit assertive live region so it is announced on insertion, and referencing its id from the input's `aria-describedby` means the error is also read when focus returns to the field. That combination is what WCAG 4.1.3 asks for — the status must be programmatically determinable *without receiving focus*.

**★ Why is `<div>` with `display: table-row` not an acceptable substitute for `<tr>`?**
Because CSS display values do not create semantics in the accessibility tree; they affect layout only. A grid of `<div>`s has no rows, no columns, no header cells and no association between a cell and its headers, so a screen reader reading cell by cell announces bare values with no idea what they measure. The visual affordance a sighted user relies on — alignment under a column heading — has no programmatic counterpart, which is precisely the failure WCAG 1.3.1 describes. Use a real table and style it however you like; `display: grid` on a `<table>` is a different discussion and needs `role` restoration to be safe.

**★ You inherit a page with eleven "Read more" links. Why is that a defect, and what is the smallest fix?**
Because assistive technology offers a links list as a primary navigation mode, and out of context eleven identical names are eleven indistinguishable destinations. WCAG 2.4.4 allows the purpose to come from the link text *or* its programmatically determined context, so a link inside an article whose heading precedes it is arguably passing — but "arguably passing" is not the goal. The smallest real fix is a visually-hidden suffix carrying the subject, which changes the accessible name without changing the design: `Read more<span className="sr-only"> about billing</span>`.

{/* FOOTER */}
