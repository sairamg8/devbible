---
title: "Automated accessibility testing finds a documented minority of problems, Lighthouse's own scoring excludes every manual check from the number, and the checks it excludes are precisely the ones this chapter has been about"
sidebar_label: "04g · Auditing accessibility"
sidebar_position: 24
description: "What axe and Playwright actually detect, Lighthouse's weighted-average scoring with no partial credit and its excluded manual list, wiring jsx-a11y after next lint was removed, the keyboard pass that costs five minutes, and building an a11y gate that fails builds."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against
> [Playwright — *Accessibility testing*](https://playwright.dev/docs/accessibility-testing)
> and
> [Lighthouse accessibility scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring),
> both quoted verbatim; the Next.js
> [ESLint reference](https://nextjs.org/docs/app/api-reference/config/eslint)
> (`lastUpdated: 2026-08-25`) and
> [Accessibility architecture page](https://nextjs.org/docs/architecture/accessibility)
> (`2024-11-06`).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout**,
> so **the jsx-a11y bundling question below could not be settled** — see §*The unresolved one*.
> **No sandbox run**; no scores, timings or violation counts are reported here.

**Every accessibility tool you can run in CI is a filter, not a verdict, and both of the major ones say so in their own documentation. Playwright's guide states plainly that automated tests detect *some* common problems and that many can only be found by manual testing. Lighthouse's scoring page goes further: each audit is pass or fail with no partial credit, and the manual checks — which include focus order, keyboard operability of custom controls, focus trapping and whether focus moves to new content — are **excluded from the score entirely**. So a perfect accessibility score is compatible with a page that a keyboard user cannot operate. This page is what to automate anyway, what the number means, and the five-minute manual pass that finds what the tools cannot.**

## What automated tools actually claim

Playwright's own framing, verbatim:

> *"Automated accessibility tests can detect some common accessibility problems such as missing or invalid properties. But many accessibility problems can only be discovered through manual testing."*

The wiring is small:

```ts
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('board page has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/board')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

That test is worth having and worth understanding narrowly. It catches missing form labels, images without an accessible name, insufficient contrast on rendered text, invalid ARIA attribute values, a role missing its required properties, duplicate ids in ARIA references. It does **not** catch: a `<div onClick>` (it cannot know the div is interactive), an `aria-label` that contradicts the visible text in a way that breaks voice control, a focus trap, a heading outline that is technically valid and semantically nonsense, a live region that never announces, or a modal that does not restore focus.

Two practical refinements:

```ts
// Scope to a region — useful when a third-party widget you cannot fix is on the page
const results = await new AxeBuilder({ page })
  .include('#main')
  .exclude('#intercom-container')
  .analyze()

// Restrict to the tags you are committing to, so a rule-set upgrade cannot fail the build
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .analyze()
```

🔴 **Run the check in each meaningful *state*, not once per route.** A page with a closed dialog and the same page with the dialog open are different DOMs, and the second one is where dialogs are usually wrong:

```ts
test('delete dialog is accessible when open', async ({ page }) => {
  await page.goto('/tasks/42')
  await page.getByRole('button', { name: 'Delete task' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

The `getByRole` locators are themselves an accessibility assertion, which is the quiet argument for role-based selectors over `data-testid`: a test that finds the button by its accessible name fails when the accessible name disappears.

## What the Lighthouse number means

Three facts from the scoring documentation, each of which changes how you should read a score.

**1 · It is a weighted average, and the weights come from axe.** Audits are weighted by user impact as assessed by axe, so a missing button name moves the number far more than a missing `lang`.

**2 · Each audit is pass/fail with no partial credit.** If some buttons have accessible names and others do not, the page scores **zero** for that audit. This is the fact that makes the score behave discontinuously — fixing nine of ten unnamed buttons changes nothing at all, and fixing the tenth moves the score by the audit's full weight. It also means the score is a poor progress metric on a large remediation: use the violation list, not the number.

**3 · Manual checks are excluded from the score entirely.** The list Lighthouse hands you to check by hand includes: custom controls have ARIA roles; custom controls have associated labels; the user's focus is not trapped; interactive controls are keyboard-focusable; interactive elements indicate their purpose and state; the page has a logical tab order; the user's focus is directed to new content added to the page; offscreen content is hidden from assistive technology.

🔴 **Read that list again.** It is, almost exactly, the contents of [04b](04b-links-buttons-forms-and-the-alt-decision.md), [04c](04c-aria-is-a-promise-you-then-have-to-keep.md), [04e](04e-keyboard-first-interactive-components.md) and [04f](04f-dialogs-focus-restoration-and-focus-visibility.md). Everything hardest to get right is outside the number by design — not because the tool is bad, but because those things cannot be decided by inspecting a DOM.

## Linting — and the unresolved one

`eslint-plugin-jsx-a11y` catches a different class again: mistakes visible in the source that may never be visible in a rendered DOM, because the branch never rendered in the state you tested.

⚠️ **The unresolved one.** The Next.js accessibility architecture page (last reviewed **2024-11-06**) states that Next.js *"includes `eslint-plugin-jsx-a11y`"* by default and links the Pages Router ESLint page. The current ESLint reference (2026-08-25) describes `eslint-config-next` as `@next/eslint-plugin-next` plus recommended rule sets from `eslint-plugin-react` and `eslint-plugin-react-hooks`, and **does not list jsx-a11y** — while naming it later as a plugin that can conflict if you configure it yourself. **`next` is not installed in this checkout, so this could not be settled by inspection, and no claim is made either way here.**

What *is* settled: **`next lint` was removed in 16.0 and `next build` no longer lints.** So even on the most generous reading of the older page, nothing runs those rules during a build. The safe action is to configure the plugin explicitly and run ESLint as its own CI step:

```js
// eslint.config.mjs
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      // next/link renders an anchor; teach the plugin about your wrappers
      'jsx-a11y/anchor-is-valid': [
        'error',
        { components: ['Link'], specialLink: ['href'] },
      ],
    },
  },
]
```

The wiring after `next lint` — flat config, the codemod, what to run in CI — is [13 · Linting after `next lint`](../13-testing-and-developer-experience/13-linting-after-next-lint.md); do not duplicate it, cross-link it.

⚠️ jsx-a11y has a real false-negative pattern worth naming: it analyses **JSX**, so a `<div>` given an `onClick` through a spread prop, or an element chosen by a variable tag name, is invisible to it. It is a lint of what you literally wrote.

## The five-minute manual pass

This finds more real defects than anything above, and it needs no tooling:

1. **Put the mouse away.** Tab from the top of the page to the bottom.
2. **Can you see where you are, at every stop?** (2.4.7 — and if a sticky header covers a stop, 2.4.11.)
3. **Does the order make sense?** (2.4.3.) If focus jumps across the screen, something is reordered in CSS.
4. **Can you reach every control?** Anything you cannot Tab to is probably a `<div onClick>`.
5. **Can you *operate* every control?** Enter *and* Space on anything announced as a button.
6. **Open a dialog. Can you Tab out of it? Does Escape close it? Where does focus go afterwards?**
7. **Open a menu or a tab set. Do the arrow keys work, and is the whole thing one tab stop?**
8. **Zoom the browser to 200% and repeat step 1.**

Every one of those is on Lighthouse's *excluded* manual list. That is not a coincidence; it is the division of labour.

For the announcement half you need an actual screen reader — VoiceOver on macOS, NVDA on Windows, both free — and the first hour with one is genuinely unpleasant and genuinely irreplaceable. The cheapest useful habit: navigate one flow by heading only, then by landmark only, then by link only. Anything that is unusable that way is unusable.

## A gate that is worth having

The trap in accessibility CI is failing the build on a rule set you do not control, then disabling the whole job the first time a dependency upgrade breaks it. A gate survives when it is narrow, pinned and owned:

| Layer | Runs | Fails the build on |
|---|---|---|
| `eslint-plugin-jsx-a11y` | every commit | its recommended set, with a pinned plugin version |
| axe via Playwright | every commit, on the key routes and states | `violations` non-empty, with `withTags` pinned to the WCAG levels you claim |
| Lighthouse | nightly or on release | a **budget** on the accessibility category, treated as a trend, not a gate |
| The manual pass | before each release of a changed flow | judgement |

🔴 **Do not gate on the Lighthouse score.** Pass/fail audits with no partial credit make it discontinuous, so a threshold either never fires or fires on an unrelated change. Gate on axe violations, which are specific, actionable and attributable to a line of code.

## Gotchas

**★ The a11y score is 100 and the page cannot be used with a keyboard.** Every keyboard-related check is on Lighthouse's manual list and is excluded from the score by design. Fix: treat the score as a smoke test, and gate on axe violations plus the manual pass.

**★ Fixing nine of ten unnamed buttons does not move the score at all.** Audits are pass/fail with no partial credit. Fix: track the violation list, not the number, during remediation.

**★ axe passes on a page whose main action is a `<div onClick>`.** The tool cannot know a div is interactive. Fix: this is a jsx-a11y and code-review responsibility — and a role-based Playwright locator that cannot find the button by name.

**★ Your axe suite tests one state per route.** Dialogs, menus and expanded panels are separate DOMs and are where the defects are. Fix: a test per meaningful state, driving the UI into it first.

**★ A dependency upgrade adds axe rules and the build goes red.** The rule set moved under you. Fix: `withTags` restricted to the WCAG levels you actually claim, and pin `@axe-core/playwright`.

**★ A third-party widget fails the audit and you cannot fix it.** Fix: `.exclude()` that container and open a ticket with the vendor — do not delete the test, and do not pretend the exclusion is a pass.

**★ You assumed accessibility linting was running because Next.js used to do it.** `next lint` was removed in 16.0 and `next build` no longer lints; the page claiming jsx-a11y is bundled has not been reviewed since 2024-11. Fix: configure the plugin yourself and run ESLint as its own CI step.

**★ jsx-a11y misses a handler passed through a spread.** It analyses the JSX you wrote, so `<div {...handlers}>` is opaque to it. Fix: do not hide interactivity behind spreads on non-interactive elements; use the right element and the lint has nothing to miss.

**★ The audit runs against the development build.** Development renders extra markup and different error boundaries. Fix: audit a production build, which is also the only build whose streaming and caching behaviour matches production.

**★ Contrast passes in the audit and fails in the product.** axe checks contrast on rendered text with a computed background; text over an image, over a gradient, or in a state you did not render (hover, focus, disabled) is not measured. Fix: check the states by hand, and design tokens for the states rather than opacity on the base colour.

**★ Nobody looks at the Lighthouse trend after month one.** A nightly job with no owner is deleted eventually. Fix: put the number in the same review as your other release metrics, or stop collecting it.

## Interview questions

**★ A page scores 100 for accessibility in Lighthouse. What have you actually learned?**
That it has no *automatically detectable* failures among the audits Lighthouse runs — which is a real but narrow statement. The scoring documentation says the score is a weighted average of pass/fail audits, weighted by axe's user-impact assessments, and that manual checks are excluded from it entirely. Those excluded checks include focus trapping, keyboard focusability of custom controls, logical tab order, and whether focus is directed to new content. So a 100 is consistent with a page a keyboard user cannot operate, and the correct reading is "no low-hanging failures", not "accessible".

**★ Why does fixing most of a problem not improve the score?**
Because each audit is pass/fail with no partial credit — the documentation states it explicitly. If ten buttons lack accessible names and you fix nine, the audit still fails and the page still scores zero for it; fixing the tenth moves the score by that audit's full weight. That makes the score a bad progress metric for a remediation project and a bad CI gate, because it is discontinuous and can move sharply on an unrelated change. The violation list is continuous, specific and attributable, which is what you want to gate on.

**★ What class of defect does `eslint-plugin-jsx-a11y` catch that axe cannot, and vice versa?**
jsx-a11y reads source, so it catches things in branches you never rendered — a modal variant, an error state, a role only used on one flag path — and it catches them at the moment they are written rather than after a deploy. axe reads the rendered DOM, so it catches things that only exist after composition: contrast against the actual background, an `aria-labelledby` pointing at an id that another component removed, a duplicate id created by rendering a component twice. Neither sees a `<div onClick>` as interactive, and neither can evaluate whether your tab order makes sense.

**★ Design an accessibility gate for CI that will still be running in a year.**
Three layers with different failure semantics. jsx-a11y on every commit with a pinned plugin version, failing the build — cheap, fast and stable. axe via Playwright on every commit against the key routes *and their key states*, failing on any violation, with `withTags` restricted to the WCAG levels you actually claim so a rule-set upgrade cannot turn the build red overnight. Lighthouse nightly as a trend with an owner, never as a gate. The design principle is that everything which fails the build must be pinned and attributable to a line of code, because a gate that goes red for reasons nobody can act on gets disabled, and a disabled gate is worse than no gate — it looks like coverage.

**★ You have five minutes to audit a page by hand. What do you do?**
Unplug the mouse and Tab from top to bottom. Watch for four things: that you can always see where focus is, that the order matches the visual layout, that you can reach every control, and that you can operate each one with Enter and Space as appropriate. Then open the one dialog and check that Escape closes it and focus returns to what opened it. That sequence maps almost one-to-one onto Lighthouse's excluded manual checks, which is exactly why it is worth the five minutes — it is the part no tool in your pipeline is even attempting.

**★ Is it safe to say Next.js ships accessibility linting?**
No, and this is a case where the documentation contradicts itself. The architecture page, last reviewed in November 2024, says `eslint-plugin-jsx-a11y` is included by default; the current ESLint reference describes `eslint-config-next` without it, while separately warning that jsx-a11y can conflict if you configure it. Without an installed copy to inspect there is no way to settle which is current, so the honest answer is "unresolved". What *is* settled makes the question mostly academic: `next lint` was removed in 16.0 and `next build` no longer lints, so whatever is bundled, nothing runs it during a build. Configure it yourself.

---

← [Dialogs, focus restoration and focus visibility](04f-dialogs-focus-restoration-and-focus-visibility.md) · [Chapter 12 overview](01-explanation.md) · Next → [SEO pitfalls in RSC and streaming setups](05-common-seo-pitfalls-in-rsc-streaming-setups-and-automated-au.md)
