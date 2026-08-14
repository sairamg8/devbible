---
title: "01 · What a decorator is"
sidebar_label: "01 · What a decorator is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the [decorators documentation](https://storybook.js.org/docs/writing-stories/decorators)
> and [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — this page carries no console output.

A decorator is **a function that wraps a story in more markup**.

```tsx
const withPadding = (Story) => (
  <div style={{padding: 24}}>
    <Story />
  </div>
);
```

That is the entire API. It receives the story as a component and returns whatever
should render around it.

## Why it exists

Isolation ([Phase 0](../phase-0-how-storybook-runs/01-what-storybook-is.md)) is
the point of Storybook — but a component that legitimately needs a theme, a
router or a store still needs them. Without decorators you have exactly two bad
options:

```tsx
// ❌ Every story file re-implements the provider tree.
export const Default: Story = {
  render: (args) => (
    <ThemeProvider>
      <MemoryRouter>
        <UserMenu {...args} />
      </MemoryRouter>
    </ThemeProvider>
  ),
};
```

```tsx
// ❌ Or the component provides its own context, which makes it untestable
//    and unusable anywhere the real app already provides it.
function UserMenu() {
  return <ThemeProvider>{/* … */}</ThemeProvider>;
}
```

The decorator is the third option: **the setup is declared once, somewhere else,
and the story stays a statement about the component.**

```tsx
// UserMenu.stories.tsx — after
export const Default: Story = {};
```

## The signature

```tsx
type Decorator = (Story, context) => ReactNode;
```

- **`Story`** is a component. Render it — `<Story />` — do not call it as a
  function.
- **`context`** is the full story context: `args`, `parameters`, `globals`, `id`,
  `viewMode`, and more. Topic 04 covers it.

```tsx
const withTheme = (Story, context) => (
  <ThemeProvider mode={context.globals.theme}>
    <Story />
  </ThemeProvider>
);
```

## The three levels

| Level | Where | Applies to |
|---|---|---|
| **Global** | `decorators` in `preview.ts` | every story in the project |
| **Component** | `decorators` on the meta | every story in that file |
| **Story** | `decorators` on the export | that story only |

```tsx
// .storybook/preview.ts — every story gets the theme
const preview: Preview = {
  decorators: [(Story) => <ThemeProvider><Story /></ThemeProvider>],
};
export default preview;
```

```tsx
// CartBadge.stories.tsx — only this file's stories get the store
const meta = {
  component: CartBadge,
  decorators: [(Story) => <Provider store={mockStore}><Story /></Provider>],
} satisfies Meta<typeof CartBadge>;
```

```tsx
// …and only this story gets the dark override
export const InDarkMode: Story = {
  decorators: [(Story) => <ThemeProvider mode="dark"><Story /></ThemeProvider>],
};
```

## Choosing the level

The rule is **the narrowest level that works**, and the reason is not tidiness.

Put a Redux `Provider` globally when only six of ninety components are connected,
and you have made it impossible to discover that a seventh component quietly
started reading from the store. In isolation that component *should* crash — that
crash is the tool telling you a dependency appeared. A global provider silences it.

| Put it global | Put it on the meta / story |
|---|---|
| genuinely universal — theme, i18n, CSS baseline | a store, for the connected components |
| things the *real app root* always provides | route context, for components reading params |
| anything whose absence is never informative | anything whose absence is a useful signal |

**Global decorators should mirror your app's real root and stop there.** Everything
else is scoped.

## Decorators are components, so treat them like components

A decorator that does work needs to do it inside a component, not in the function
body:

```tsx
// ❌ Runs on every render, never cleans up, leaks across story navigation.
const withResizeListener = (Story) => {
  window.addEventListener('resize', handler);
  return <Story />;
};

// ✅ Cleanup tied to the story's lifetime.
const withResizeListener = (Story) => {
  function Wrapper({children}) {
    useEffect(() => {
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
    }, []);
    return children;
  }
  return (
    <Wrapper>
      <Story />
    </Wrapper>
  );
};
```

The symptom of getting this wrong is the worst kind: **behaviour that depends on
which stories you visited first**, which is not reproducible from a URL and
therefore nearly impossible to report.

## Gotchas

**Symptom — a component crashes in isolation with a missing-context error.**
*Cause:* it reads from a provider nothing supplies. *Fix:* a decorator at the
narrowest level that covers it — or lift the dependency into props, which is often
the better answer. Do not reach for a global decorator first.

**Symptom — a component that should not depend on the store silently works.**
*Cause:* a `Provider` was applied globally. *Fix:* scope it to the connected
components' story files. The crash you removed was information.

**Symptom — a story behaves differently depending on which story you opened
first.** *Cause:* a decorator with an uncleaned side effect — an event listener, a
mutated module-level variable, a timer. *Fix:* move the effect into a wrapper
component with a `useEffect` cleanup.

**Symptom — "Story is not a function" or a blank canvas.** *Cause:* the decorator
called `Story()` instead of rendering `<Story />`. *Fix:* render it as a component.
It is a component, not a render function.

**Symptom — every story is wrapped in padding you did not want.** *Cause:* a
layout decorator applied globally. *Fix:* `parameters: {layout: 'centered' |
'padded' | 'fullscreen'}` exists for exactly this and does not need a decorator.

## Interview questions

**★ What is a decorator, and what problem does it solve?**
A function `(Story, context) => ReactNode` that wraps a story in extra markup. It
solves the tension between isolation and context: a component may legitimately need
a theme, router or store, and without decorators you would either re-implement the
provider tree in every story or bake providers into the component itself. The
decorator declares the setup once, elsewhere, so the story stays a statement about
the component.

**★ Why not just apply every provider globally?**
Because a global provider destroys a useful signal. If only some components are
connected to the store, a component that quietly starts reading from it *should*
crash in isolation — that crash is how you learn a dependency appeared. Applied
globally, the provider silences it. Global decorators should mirror the app's real
root and nothing more.

**★ How do you decide which level a decorator belongs at?**
The narrowest one that works. Global for genuinely universal concerns — theme,
i18n, CSS baseline. Component level for what a particular component needs, such as
a store for a connected component. Story level for a one-off override.

**A story behaves differently depending on which story you opened first. What
would you suspect?**
A decorator with a side effect and no cleanup — an event listener, a timer, a
mutated module-level variable — leaking across story navigation. The fix is to move
the effect into a wrapper component with a `useEffect` cleanup, so it is tied to
the story's lifetime.

**Why must you render `<Story />` rather than call `Story()`?**
Because it is a component, not a render function. Calling it bypasses React's
rendering, which typically shows up as a blank canvas or a "Story is not a
function" error.

---

**Next →** [02 · Decorator order](./02-decorator-order.md)
