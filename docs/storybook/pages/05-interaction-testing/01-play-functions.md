---
title: "Interactions Panel: `play` Functions, Step Debugger & Behavioral Tests"
sidebar_label: "Interactions Panel"
sidebar_position: 1
---

# ▶️ Interactions Panel: `play` Functions, Step Debugger & Behavioral Tests

> **What you see:** Bottom panel tab **Interactions** on stories that define a `play` function.  
> **What it does:** Runs (and visually steps through) scripted user behavior + assertions attached to the story.  
> **What drives it:** `play` in CSF, `@storybook/test` (`userEvent`, `within`, `expect`, `fn`, `waitFor`, `step`), and in CI either the [test-runner](../11-testing-integration/01-test-runner.md) or the newer Vitest-based "Storybook Test" integration.  
> Related: [Controls](../04-controls-and-args/01-dynamic-prop-editing.md) · [Actions](../03-addons-ecosystem/02-actions-panel-in-depth.md) · [Test runner](../11-testing-integration/01-test-runner.md)
>
> **📌 Version note:** Interactions/`play` moved into Storybook core in
> version 9 — no `@storybook/addon-interactions` install needed (current
> stable: Storybook 10). `@storybook/test` still works; its current
> unscoped name is `storybook/test`. The play context also now exposes
> `canvas` (pre-scoped, equivalent to `within(canvasElement)`) and
> `userEvent` directly — `play: async ({ canvas, userEvent }) => …` — which
> is the primary pattern in current docs. Every example below uses the
> explicit `within(canvasElement)` + imported `userEvent` form instead,
> which is still fully correct (and necessary for shared helpers outside
> the play context, see §3.4) — just know both exist.

## 1. Under-The-Hood Mechanics

```
Story mounts in canvas (args + decorators applied)
        │
        ▼
If story.play exists → Storybook invokes play({ canvasElement, args, step, userEvent, … })
        │
        ▼
Each userEvent / expect / step() becomes a row in the Interactions panel
        │
        ├── Pass  → green steps; optional Action logs from fn() handlers
        └── Fail  → red step; panel stops; assertion message shown
        │
        ▼  (CI)
Either @storybook/test-runner (Playwright, re-runs the built Storybook)
   or the Vitest-based "Storybook Test" integration (@storybook/addon-vitest,
   recommended default for Vite-powered projects since Storybook 9 — runs
   stories as Vitest tests, unifying interaction + a11y + coverage)
```

### Why attach tests to stories?

A story with `play` is **one artifact** that is simultaneously:

1. **Documentation** — “this is how the component looks after a user does X”  
2. **Demo** — Interactions panel plays steps for design/product review  
3. **Regression test** — test-runner fails CI if the flow breaks  

Without `play`, you often maintain a Storybook story **and** a separate RTL file for the same flow.

### Instrumenting APIs (`@storybook/test`)

| API | Role |
|---|---|
| `within(canvasElement)` | Scope queries to **this** story’s root (never the whole manager chrome) |
| `userEvent` | Realistic pointer/keyboard (prefer over raw `fireEvent`) |
| `expect` | Jest-like matchers, including DOM and mock matchers |
| `fn()` | Trackable mock for callback props (see Actions) |
| `waitFor` / `findBy*` | Async UI (spinners → content) |
| `step('label', async () => …)` | Named groups in the Interactions panel |

---

## 2. What You See in the Interactions UI

| UI element | Meaning |
|---|---|
| **Run / Replay** | Re-execute `play` from the start |
| **Step list** | Ordered actions: type, click, expect, custom `step` names |
| **Pass / fail icons** | Which step broke |
| **Debugger controls** | Pause, step over, go to end (version-dependent) |
| **Error detail** | Matcher message, expected vs received |
| **No play function** | Panel empty / message that this story has no interactions |

**Debugging workflow:** fail in CI → open the story → Interactions → watch the red step → fix query, timing, or component → replay until green.

---

## 3. Writing Strong `play` Functions

### 3.1 Canonical form

```tsx
// LoginForm.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent, expect, fn, waitFor } from "@storybook/test";
import { LoginForm } from "./LoginForm";

const meta = {
  title: "Forms/LoginForm",
  component: LoginForm,
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShowsValidationErrorForInvalidEmail: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("Enter invalid email and a password", async () => {
      await userEvent.type(canvas.getByLabelText(/email/i), "not-a-valid-email");
      await userEvent.type(canvas.getByLabelText(/password/i), "password123");
    });

    await step("Submit the form", async () => {
      await userEvent.click(canvas.getByRole("button", { name: /log in/i }));
    });

    await step("Surface validation and block submit", async () => {
      await expect(
        canvas.getByText(/please enter a valid email/i),
      ).toBeInTheDocument();
      await expect(args.onSubmit).not.toHaveBeenCalled();
    });
  },
};

export const SubmitsWithValidCredentials: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/email/i), "alex@acme.com");
    await userEvent.type(canvas.getByLabelText(/password/i), "securepass123");
    await userEvent.click(canvas.getByRole("button", { name: /log in/i }));

    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: "alex@acme.com",
      password: "securepass123",
    });
  },
};
```

### 3.2 Async UI (`waitFor` / `findBy`)

```tsx
export const LoadsUser: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(/loading/i)).toBeInTheDocument();

    // findBy* = getBy* + waitFor
    await expect(
      await canvas.findByRole("heading", { name: /alex/i }),
    ).toBeInTheDocument();
  },
};
```

### 3.3 Keyboard and focus flows

```tsx
export const KeyboardAccessibleMenu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /open menu/i });

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(canvas.getByRole("menuitem", { name: /settings/i })).toHaveFocus();
  },
};
```

### 3.4 Composing plays (reuse setup)

```tsx
async function fillLogin(canvas: ReturnType<typeof within>, email: string) {
  await userEvent.type(canvas.getByLabelText(/email/i), email);
  await userEvent.type(canvas.getByLabelText(/password/i), "password123");
}

export const ErrorState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillLogin(canvas, "bad");
    await userEvent.click(canvas.getByRole("button", { name: /log in/i }));
    await expect(canvas.getByRole("alert")).toBeVisible();
  },
};
```

Storybook also supports **`play` on meta** plus story-level plays in some compositions; prefer explicit shared helpers for clarity when versions differ.

### 3.5 Reading live Controls args

```tsx
play: async ({ args, canvasElement }) => {
  const canvas = within(canvasElement);
  // If a reviewer changed args via Controls, then re-ran play, these reflect CURRENT args
  await userEvent.click(
    canvas.getByRole("button", { name: new RegExp(args.label, "i") }),
  );
},
```

In CI, args are always the story file values (no human Controls session).

---

## 4. Real-World Engineering Scenario

**Scenario:** Login validation must be demoable in design review **and** locked in CI.

A single `ShowsValidationErrorForInvalidEmail` story:

- Designers open Interactions → watch type → submit → error message appear.  
- Test-runner runs the same `play` on every PR.  
- No duplicate RTL file for this flow; deeper unit tests still cover pure validators.

Result: fewer “works in Storybook demo but tests don’t cover it” gaps.

---

## 5. When to Use Interactions vs Other Tests

| Need | Prefer |
|---|---|
| Component UX flow in isolation | **Story `play` + Interactions** |
| Many pure logic branches | Jest unit tests |
| Full page routing / auth / multi-service | Playwright E2E |
| Pixel regression of final state | Chromatic **after** play (or dedicated stories for end states) |
| WCAG rule violations | a11y panel + axe in test-runner |

**End-state stories vs play-only:** For visual baselines, prefer a story that **renders** the error state directly (via args) *and/or* a play that reaches it. Chromatic can wait for play to finish depending on setup — make end states explicit when snapshots flap.

---

## 6. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Querying `document` / unscoped `screen`
```tsx
// ❌ May hit wrong elements / other addons
await userEvent.click(screen.getByRole("button", { name: /submit/i }));

// ✅
const canvas = within(canvasElement);
await userEvent.click(canvas.getByRole("button", { name: /submit/i }));
```

### ⚠️ Pitfall 2: Interactions without assertions
```tsx
// ❌ Demo-only — CI always passes even if broken
play: async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
};

// ✅
play: async ({ args, canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button"));
  await expect(args.onClick).toHaveBeenCalled();
};
```

### ⚠️ Pitfall 3: Wrong mock reference  
Always assert `args.onSubmit` for the `fn()` passed in `args` (see Actions deep dive).

### ⚠️ Pitfall 4: Role/name queries that don’t match accessible names
If `getByRole('button', { name: 'Close' })` fails, the a11y panel often already shows “missing accessible name” — fix a11y first; interactions and AT users both benefit.

### ⚠️ Pitfall 5: Flaky timing
Prefer `findBy*` / `waitFor` over `userEvent.click` immediately after mount for async data. Avoid fixed `sleep(1000)` unless last resort; it slows CI and still flakes under load.

### ⚠️ Pitfall 6: Over-testing app wiring in stories
`play` should verify **component contracts** (UI + callbacks). Don’t spin full auth backends in every story — mock at the decorator/loader boundary.

### ⚠️ Pitfall 7: Portal content outside `canvasElement`
Modals/selects rendered in `document.body` may be **outside** the story root. Then:

```tsx
// Query the document for portal content when necessary
await expect(
  await within(document.body).findByRole("dialog"),
).toBeInTheDocument();
```

Document this in the story so readers know portals are intentional.

---

## 7. Checklist

```
[ ] Important UX flows have a named story with play + assertions
[ ] Queries scoped with within(canvasElement) (or body for portals)
[ ] Callbacks use fn() and are asserted via args.*
[ ] step() groups complex plays for readable Interactions panel
[ ] Async states use findBy / waitFor — no arbitrary sleeps
[ ] test-runner OR Storybook Test (Vitest addon) runs in CI so plays are not “UI-only”
[ ] Visual baselines use stable end-state stories where needed
```

---

## 8. Related panels

| Panel | Relationship |
|---|---|
| **Controls** | Set initial args; re-run play after exploring |
| **Actions** | Each handler call during play should log here |
| **Visual tests** | Capture pixels after play or of dedicated end states |
| **Accessibility** | Run axe on the **post-play** DOM for interactive widgets when configured |
