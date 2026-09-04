---
title: "The board is the hardest thing in SprintDesk to make accessible because drag-and-drop has no keyboard equivalent you get for free — and the milestone is not done until a keyboard-only user can move a card, which is a criterion no tool in the pipeline will check"
sidebar_label: "06c · A11y pass and acceptance"
sidebar_position: 123
description: "The accessibility pass over SprintDesk's board — headings, landmarks, the column as a labelled region, a keyboard-operable move, live-region announcements — plus the full acceptance criteria for the milestone and the ones only a human can sign off."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **WCAG 2.2** criteria 1.3.1, 2.1.1, 2.4.1, 2.4.3, 2.4.7, 4.1.2 and
> 4.1.3 ([w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/)); the WAI-ARIA Authoring Practices
> Guide ([*Read Me First*](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/) and
> [*Developing a Keyboard Interface*](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/));
> [*Using ARIA*](https://www.w3.org/TR/using-aria/); and
> [Lighthouse accessibility scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring)
> for what the score excludes.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, **no scores reported**.

**A kanban board is the worst-case accessibility exercise in a normal application, and SprintDesk has one. Its core interaction is a pointer gesture with no keyboard equivalent the platform supplies, its structure is visual (columns are position, not markup), and its state changes without navigation. Every one of those is on the list of things automated tooling explicitly does not check. This page is the pass over that board, the acceptance criteria for the whole milestone, and an honest split between the criteria a machine can sign off and the ones a person has to.**

## The board's structure, before any interaction

Columns are conveyed by position, which WCAG 1.3.1 says is not enough — *"Information, structure, and relationships conveyed through presentation can be programmatically determined or are available in text."*

```tsx
// app/(app)/board/page.tsx
export default async function BoardPage() {
  const columns = await getColumns()

  return (
    <>
      <h1>Sprint 24 board</h1>
      <div className="board">
        {columns.map((column) => (
          <section
            key={column.id}
            aria-labelledby={`col-${column.id}`}
            className="board__column"
          >
            <h2 id={`col-${column.id}`}>
              {column.name}{' '}
              <span className="sr-only">
                — {column.tasks.length} tasks
              </span>
            </h2>
            <ul className="board__list">
              {column.tasks.map((task) => (
                <li key={task.id}>
                  <TaskCard task={task} headingLevel={3} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
```

Four decisions, each from a rule:

- **`<section aria-labelledby>`, not a bare `<section>`.** A section is only a landmark when it has an accessible name; without one it contributes nothing ([04](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md)).
- **A real `<ul>`**, so a screen reader announces "list, 7 items" — which is the count a sighted user reads off the column's height.
- **The count in a visually-hidden span**, because "7" rendered as a styled badge is information conveyed only by presentation.
- **`headingLevel={3}` passed as a prop**, because the card is reused inside a dialog where the correct level is different, and a context would force the subtree to become client code ([04](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md)).

## The move, which is the whole problem

Drag-and-drop is a pointer gesture. WCAG 2.1.1 requires *"All functionality of the content is operable through a keyboard interface"*, so the drag must have an equivalent — and the cheapest correct equivalent is not a keyboard drag simulation, it is **an ordinary menu of destinations on each card**.

```tsx
// components/task-card.tsx
'use client'
import { useId, useState } from 'react'
import { moveTask } from '@/app/actions'

export function TaskCard({
  task,
  columns,
  headingLevel = 3,
}: {
  task: Task
  columns: Column[]
  headingLevel?: 2 | 3 | 4
}) {
  const Heading = `h${headingLevel}` as const
  const id = useId()
  const [status, setStatus] = useState('')

  async function move(toColumnId: string, toColumnName: string) {
    await moveTask(task.id, toColumnId)
    setStatus(`${task.title} moved to ${toColumnName}`)
  }

  return (
    <article className="task-card" aria-labelledby={`${id}-title`}>
      <Heading id={`${id}-title`}>{task.title}</Heading>

      <label htmlFor={`${id}-move`} className="sr-only">
        Move {task.title} to column
      </label>
      <select
        id={`${id}-move`}
        value={task.columnId}
        onChange={(e) => {
          const column = columns.find((c) => c.id === e.target.value)!
          move(column.id, column.name)
        }}
      >
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Present from first render, so the change is announced */}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </article>
  )
}
```

Three things worth defending, because this design gets pushback:

1. 🔴 **A native `<select>` beats a hand-rolled keyboard drag.** The drag pattern requires grab/drop key handling, a live region narrating position, and an escape from a half-completed move — all of which you must write and test. The select is operable, announced and understood by every user on every platform on day one. Rule 1 of *Using ARIA* is exactly this argument.
2. **`useId` for the label and heading association**, because a card renders many times per page and hard-coded ids resolve to the first match ([04d](04d-hydration-safe-accessible-markup.md)).
3. **The live region is rendered always and its *text* changes.** A conditionally-rendered region inserted with its content in the same commit is unreliably announced ([04c](04c-aria-is-a-promise-you-then-have-to-keep.md)).

⚠️ Keep the drag. This is an *equivalent*, not a replacement — WCAG asks that the functionality be operable from the keyboard, not that the pointer affordance be removed.

## The rest of the pass

| Area | What changes | Rule |
|---|---|---|
| Skip link | first focusable element, visible on focus, target has `tabIndex={-1}` | 2.4.1 |
| Focus ring | `:focus-visible` styled, `*:focus { outline: none }` deleted | 2.4.7 |
| Filter chips | `<button>` with `aria-pressed`, not `<div onClick>` | 2.1.1, 4.1.2 |
| Nav links | `aria-current="page"` on the active one | 4.1.2 |
| Icon-only buttons | `aria-label` on the button, `aria-hidden` on the icon, ≥ 24×24 | 4.1.2, 2.5.8 |
| Task dialog | native `<dialog>` + `showModal()`, focus returns to the card | APG |
| Sticky board header | `scroll-margin-top` on focusable elements | 2.4.11 |
| Empty column | real text, not a background image | 1.1.1 |
| Assignee avatars | `alt=""` — the name is beside them | 1.1.1 |
| `<html lang>` | set in the root layout | 3.1.1 |

## Acceptance criteria

**Automated — these fail the build.**

| # | Criterion | Where |
|---|---|---|
| 1 | Every public route emits `og:title`, `og:type`, `og:image`, `og:url` | [05c](05c-auditing-seo-in-ci.md) |
| 2 | Every `og:image` is absolute and has `og:image:alt` | [05c](05c-auditing-seo-in-ci.md) |
| 3 | Every `og:image` URL returns 200 with an `image/*` content type | [05c](05c-auditing-seo-in-ci.md) |
| 4 | No public route emits `noindex` | [05c](05c-auditing-seo-in-ci.md) |
| 5 | Every public route has a `canonical` on the deployment's own origin | [05c](05c-auditing-seo-in-ci.md) |
| 6 | `/sitemap.xml` parses, is non-empty, all URLs absolute, sample non-redirecting | [05c](05c-auditing-seo-in-ci.md) |
| 7 | Production `/robots.txt` is not a blanket `Disallow: /` and names the sitemap | [05c](05c-auditing-seo-in-ci.md) |
| 8 | Blog JSON-LD parses and carries `@type: 'Article'` with absolute URLs | [05c](05c-auditing-seo-in-ci.md) |
| 9 | `axe` reports zero violations on `/`, `/pricing`, a blog post, the board, and the board with the task dialog open | [04g](04g-auditing-accessibility-and-what-no-tool-can-reach.md) |
| 10 | `eslint-plugin-jsx-a11y` recommended set passes | [04g](04g-auditing-accessibility-and-what-no-tool-can-reach.md) |
| 11 | The build fails when `NEXT_PUBLIC_SITE_URL` is unset | [06](06-project-milestone-sprintdesk-public-pages-fully-indexed.md) |
| 12 | A blog post with no matching slug returns a real `404` status | [05](05-common-seo-pitfalls-in-rsc-streaming-setups-and-automated-au.md) |

**Manual — a person signs these off, once, before release.**

| # | Criterion | Why no tool can do it |
|---|---|---|
| 13 | A keyboard-only user can move a task between columns | Lighthouse excludes keyboard operability from the score |
| 14 | Tab order across the board matches the visual layout | excluded manual check |
| 15 | Opening and closing the task dialog returns focus to the card | excluded manual check |
| 16 | The move is announced by a screen reader | requires a screen reader |
| 17 | The focused element is never hidden by the sticky header | 2.4.11 is an interaction between two components |
| 18 | Pasting a blog URL into Slack shows title, description and the post's image | needs a live scrape |
| 19 | The Rich Results Test reports the Article as eligible | external system's judgement |
| 20 | A preview deployment's `robots.txt` blocks everything | needs a preview deployment |

🔴 **Criteria 13 to 17 are the milestone.** 1 to 12 are worth automating precisely because they are the cheap ones; if the pass ends when the pipeline is green, the board is still unusable for the users this work was for.

## Gotchas

**★ The board is a `<div>` per column and axe reports nothing wrong.** Columns are conveyed by position, which is presentation; axe cannot know a column exists. Fix: `<section aria-labelledby>` per column with the heading as its name, and a real `<ul>` for the cards.

**★ A keyboard drag is implemented and is worse than the pointer version.** Grab, move, drop, cancel, and narration all had to be hand-written, and none of them is standard, so users must learn your invention. Fix: a native `<select>` of destinations, which is operable and understood immediately — and keep the drag for pointer users.

**★ Every card's move control has the same `id` and the labels all point at the first card.** Hard-coded ids in a repeated component. Fix: `useId` per instance, deriving every id from it.

**★ The "moved to Done" announcement never fires.** The live region is conditionally rendered, so region and content arrive in one commit. Fix: render an empty `role="status"` always, change its text.

**★ The score is high and criterion 13 fails.** Lighthouse excludes keyboard operability, focus trapping, tab order and focus direction from the score entirely — by design. Fix: run the manual pass; the number was never going to tell you.

**★ Filter chips are `<div onClick>` with an `aria-pressed` attribute.** The state is announced and the control cannot be reached. Fix: `<button aria-pressed>`; the attribute is fine, the element was not.

**★ The task dialog is a positioned `<div role="dialog">`.** No focus trap, no Escape, no background inertness, and `aria-modal` promising all three. Fix: native `<dialog>` with `showModal()` ([04f](04f-dialogs-focus-restoration-and-focus-visibility.md)).

**★ The sticky board header covers whatever you Tab to.** WCAG 2.4.11, and no component-level review catches it because neither component is wrong alone. Fix: `scroll-margin-top` matching the header height.

**★ An empty column renders as a background illustration with no text.** Nothing to announce, and nothing in the page source. Fix: real text — `<p>No tasks in Review</p>` — styled however you like.

**★ Acceptance was signed off on the automated criteria alone.** The twelve cheap ones passed and nobody did the five that matter. Fix: put criteria 13 to 17 on the release checklist with a named owner, not in a wiki.

## Interview questions

**★ Why is a `<select>` of destinations a better answer than a keyboard-accessible drag-and-drop?**
Because it is a control the platform already ships, fully operable and correctly announced on every device, and W3C's first rule of ARIA use says to prefer exactly that over re-creating behaviour with roles and script. A keyboard drag requires you to invent a grab key, a move key, a drop key and a cancel, then narrate position changes through a live region, then handle the half-completed state when focus leaves — a whole interaction vocabulary the user has to learn because it is yours. The select is understood immediately and costs one element. Keeping the pointer drag alongside it is the correct outcome: WCAG asks that the functionality be keyboard-operable, not that the pointer affordance be removed.

**★ A stakeholder asks why the accessibility work is not finished when the audit is green. What do you say?**
That the audit and the work overlap less than the name suggests. Lighthouse's documentation says the score is a weighted average of pass/fail audits and that manual checks are excluded from it entirely — and the excluded list is keyboard focusability of custom controls, logical tab order, focus trapping, and whether focus is directed to new content. Those are precisely the board's hard parts. axe is the same shape: it finds missing names and invalid attributes, and it cannot know that a `<div>` is meant to be interactive. The green pipeline means no cheap failures remain, which is a real result and is not the same claim as "a keyboard user can use this".

**★ Which acceptance criteria in this milestone genuinely cannot be automated, and why?**
Five. Moving a task by keyboard and the tab order matching the layout are both judgement about *sequence and meaning*, which no tool can evaluate. Focus returning to the invoking card after a dialog closes is checkable in principle but not by anything in a standard pipeline. The announcement of the move needs an actual screen reader. And the focused element not being hidden by the sticky header is an interaction between two independently-correct components, so it can only be seen by tabbing through the real page. Everything else on the list — tags present, images resolving, sitemap parsing, no stray `noindex` — is deterministic and belongs in CI precisely because it is cheap.

**★ Why does the milestone insist the build fail when `NEXT_PUBLIC_SITE_URL` is unset?**
Because the alternative failure is silent and expensive. A default of `http://localhost:3000` produces a successful build and a deployment whose canonicals, `og:url`s, sitemap entries and JSON-LD all point at localhost — every one of which renders fine in a browser and none of which produces an error anywhere. The consequences are cumulative and slow: wrong canonicals, previews that never resolve, a sitemap the crawler discards. A module-scope throw converts an invisible production defect into a visible build failure, which is the cheapest detection available and costs three lines.

**★ How would you convince a team to keep the manual pass after the first release?**
By making it small and specific rather than a virtue. It is five checks, it takes about five minutes, and it is written down as steps rather than as a principle — unplug the mouse, Tab through the board, move a card, open and close the dialog, watch where focus lands. The argument that lands is the asymmetry: the automated suite catches the failures that are cheap to fix and cheap to find, and this five minutes catches the ones that make the product unusable for a whole class of user. A checklist item with an owner survives; "we care about accessibility" does not.

{/* FOOTER */}
