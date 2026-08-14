---
title: "01 · What Storybook is"
sidebar_label: "01 · What Storybook is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [Storybook documentation](https://storybook.js.org/docs)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest) on the npm
> registry. **No sandbox run** — this page carries no console output.

Storybook is a **second entry point into your application** that renders one
component, in one state, with nothing else running.

That is the whole idea. Everything the tool does afterwards — the docs site, the
interaction tests, the accessibility panel, the visual diffs — falls out of one
structural decision: **if every state of every component is addressable by URL,
then every state is also reviewable, testable and linkable.**

## The problem it exists to solve

Your app has one entry point, and it is the front door. To look at a component you
go through it:

```
run the app → log in → navigate to /orders → find an order that is still
pending → widen the browser to the breakpoint where the bug appears → look
at the component
```

Six steps, and five of them are not the component. Now do it again for the empty
state. There are no pending orders in your dev database, so you either write one,
or you comment out the fetch and hardcode `[]`, and you will forget to put it
back.

Storybook replaces that with a URL:

```
/?path=/story/orders-ordertable--empty
```

The component, in the state you wanted, in one hop. The states are not
*reproduced* — they are **declared**, so they are the same every time, for
everyone, forever.

## What a story is

A **story** is one reproducible render of one component in one state. It is a
named export from a file, and it is data, not a procedure:

```tsx
// OrderTable.stories.tsx
export const Empty = {
  args: {orders: [], isLoading: false},
};
```

That is a complete story. There is no `render()`, no mount, no assertion — you
described the inputs and Storybook builds the component from them.

The important consequence is the plural. One component gets **many** stories, and
together they are an inventory of what it can be:

```tsx
export const Empty        = {args: {orders: []}};
export const Loading      = {args: {orders: [], isLoading: true}};
export const OneOrder     = {args: {orders: [pendingOrder]}};
export const ManyOrders   = {args: {orders: Array.from({length: 200}, makeOrder)}};
export const FailedToLoad = {args: {orders: [], error: 'Could not reach the orders service'}};
```

Five states, five URLs, five things a designer can look at without cloning your
branch. **The set of stories is the component's real specification** — more
honest than a prop table, because each one renders.

## The mental shift: bottom-up, not top-down

Building a component inside the app means the app is always there to lean on. A
component can quietly reach into a Redux store, a router, a theme context, or a
`window` global, and it will work — because in the app, those are always present.

Isolation removes the crutch, and the removal is the point:

```tsx
// This looks fine in the app. It has three hidden dependencies.
function UserBadge() {
  const user = useSelector((s) => s.auth.user);   // needs a Provider
  const {pathname} = useLocation();               // needs a Router
  const {locale} = useContext(I18nContext);       // needs an I18n provider
  return <span>{formatName(user, locale)}</span>;
}
```

Rendered in Storybook with nothing around it, this throws immediately. That
failure is **information**: the component has three dependencies its signature
never mentioned. You then choose, deliberately:

- **make them props** — `<UserBadge user={user} locale={locale} />` — the
  component becomes portable and trivially testable; or
- **supply them in a decorator** — you keep the ergonomics of context, but you
  have now written down what the component needs, in one place, on purpose.

Both are fine. What is not fine is not knowing. Decorators are
[Phase 3](../../syllabus/02-composing-stories.md).

**The trade-off, stated plainly:** isolation costs you setup. A component that
needs a router, a store and a query client needs all three configured in
Storybook before its first story renders. That is a real half-day on a mature
codebase. What you buy is that the *second* component costs nothing, because the
setup is global — and that every component afterwards has an explicit, written
dependency list. On a project with ten components the trade is roughly neutral.
At forty it is not close.

## Where Storybook sits against the things it is confused with

| | What it renders | Where it runs | What it is for |
|---|---|---|---|
| **Storybook** | one component, one state | real browser | building, reviewing and documenting states |
| **Jest + RTL** | one component, one state | jsdom | asserting behaviour, fast, in bulk |
| **Playwright** | the whole app | real browser | asserting a user journey across pages |
| **A docs site (MDX, Docusaurus)** | prose | anywhere | explaining, not rendering |

Storybook overlaps all three and replaces none of them. The overlap with RTL is
the one people trip on: both render a component and drive it with `userEvent`.
The split is **jsdom vs a real browser** — RTL is faster and cheaper and cannot
see layout, focus order, scroll, or anything CSS decides. See
[Phase 6](../../syllabus/03-testing-with-storybook.md).

## What it is *not*

- **Not a component library.** It renders yours; it ships none.
- **Not a design tool.** It shows what was built, not what was intended. If your
  Storybook and your Figma disagree, Storybook is right and that is the problem.
- **Not a replacement for running the app.** Composition is not a component
  concern. Stories will not catch a page that assembles three correct components
  into a broken layout.
- **Not free.** It is a second build of your app, with a second config, that must
  keep working. Treat it as production code or it will rot in a quarter.

## The smallest complete example

Two files. This is genuinely all of it.

```tsx
// Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary';
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({variant, label, disabled, onClick}: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
```

```tsx
// Button.stories.tsx
import type {Meta, StoryObj} from '@storybook/react';
import {Button} from './Button';

const meta = {
  component: Button,
  title: 'Components/Button',
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {variant: 'primary', label: 'Place order'},
};

export const Secondary: Story = {
  args: {variant: 'secondary', label: 'Cancel'},
};

export const Disabled: Story = {
  args: {variant: 'primary', label: 'Place order', disabled: true},
};
```

The default export is **metadata about the component**. Every named export is
**one state of it**. That is the Component Story Format, and it is covered
properly in [Phase 1](../../syllabus/01-how-storybook-runs.md).

```bash
npm run storybook
```

⚠️ `@storybook/react` above is correct on 10.x — the renderer packages were *not*
consolidated. Many other `@storybook/*` imports were, and Storybook 9 deleted
several outright. Read
[06 · Storybook 10 and the package consolidation](./05-storybook-10-and-package-consolidation.md)
before you copy any snippet dated earlier than 2025.

## Gotchas

**Symptom — a component renders in the app but throws immediately in Storybook.**
*Cause:* it reads from a provider (store, router, theme, i18n) that the app
supplies and the story does not. *Fix:* this is the tool working. Either lift the
dependency into props, or add a global decorator in `preview.ts`. Do not wrap the
single story and move on — the next component in that folder has the same
dependency.

**Symptom — you wrote stories, but bugs still reach QA in states you "covered".**
*Cause:* only the happy path became a story. `Default` is the state least likely
to be broken. *Fix:* write the states from the *data's* possibilities, not the
design's: empty, one, many, too many, loading, failed, forbidden, and the longest
string a real user has typed.

**Symptom — Storybook drifts out of date and nobody opens it.**
*Cause:* stories were treated as documentation, so nothing fails when they rot.
*Fix:* give them a job that breaks the build — the test runner
([Phase 9](../../syllabus/04-configuration-and-shipping.md)) turns every story into a CI test.
A story nothing depends on will be abandoned; a story that gates a merge will not.

**Symptom — "we'll add Storybook properly later", six months on, four stories.**
*Cause:* it was adopted as a project instead of a habit. *Fix:* do not backfill.
Require a story for **new and changed** components only, and let the coverage
accumulate. Phase 10 covers the realistic adoption path.

**Symptom — the component looks right in Storybook and wrong in the app.**
*Cause:* the preview iframe is not loading the same CSS the app does — a global
stylesheet, a reset, or a font that `preview.ts` never imported. *Fix:*
[Phase 5](../../syllabus/02-composing-stories.md). This is the single most common "but it
works in Storybook" report.

## Interview questions

**★ What problem does Storybook actually solve?**
Reaching a component's states. In an app, a state is the *result* of navigation,
auth and data; you reproduce it by arranging the world until it appears. In
Storybook a state is *declared* as data, so it is addressable by URL, identical
for everyone, and available without a backend. Everything else the tool does
depends on having that.

**★ How is a Storybook story different from a unit test?**
A story declares a state and asserts nothing; a test asserts. That is why the two
compose rather than compete — a story plus a `play` function *is* a test, so the
demo and the test cannot drift apart. Storybook also runs in a real browser,
where RTL runs in jsdom, so it can see layout and focus behaviour that jsdom
cannot.

**★ A component works in the app but crashes in Storybook. What does that tell
you?**
That it has an implicit dependency on ambient context — a store, a router, a
theme provider — which its props never declared. It is a design signal, not a
Storybook bug. Fix it by making the dependency explicit, either as a prop or as a
deliberate global decorator.

**Why is "one story per component" an anti-pattern?**
Because the default state is the one least likely to be broken. The value is in
the states that are hard to reach in the real app — empty, error, loading, 200
rows, a 90-character name. A single `Default` story gives you a screenshot, not an
inventory.

**When would you not reach for Storybook?**
When there are few components, or they are mostly pages; when the team is one
person who is also the designer; or when nothing in the codebase is reused. It is
a second build with a second config and a real maintenance cost, and that cost is
only repaid by the number of components and the number of people looking at them.

**What is the relationship between Storybook and a design system?**
Storybook is the usual delivery mechanism, not the design system itself. The
design system is the components and the tokens; Storybook is where they become
browsable, reviewable and shared. Phase 10 covers the difference.

---

**Next →** [02 · The manager and the preview](./02-manager-and-preview.md)
