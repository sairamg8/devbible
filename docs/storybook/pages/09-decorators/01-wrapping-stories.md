---
title: "Decorators: Global, Story-Level & Composition Order"
sidebar_label: "Decorators"
sidebar_position: 1
---

# 📖 Decorators: Global, Story-Level & Composition Order

## 1. Under-The-Hood Mechanics

A decorator wraps a story's rendered output in additional JSX — the mechanism for providing context/providers a component needs (a theme, a router, a store) **without** that wrapping logic needing to be repeated inside every single story, or baked into the component itself.

```typescript
// A decorator is a function: (Story, context) => ReactNode
const withThemeProvider = (Story, context) => (
  <ThemeProvider theme={context.args.theme ?? 'light'}>
    <Story />
  </ThemeProvider>
);
```

### Global Decorators: Applied to Every Story, App-Wide
```typescript
// .storybook/preview.ts
export const decorators = [withThemeProvider, withRouter]; // applied to EVERY story in the ENTIRE Storybook instance
```
Appropriate for genuinely universal context every component might need — a theme provider, an i18n provider — the same category of "wrap literally everything" concern as a real app's own root-level provider tree.

### Story-Level Decorators: Scoped to Specific Stories
```typescript
export const InsideRouter: Story = {
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>], // ONLY this specific story is wrapped
};
```
For context only a subset of components/stories actually need (a Redux store for connected components, specific route context for a component reading route params) — applying it globally would be wasteful (and could even mask bugs in components that shouldn't actually depend on that context at all).

### Composition Order: Global Decorators Wrap OUTSIDE Story-Level Ones
When both global and story-level decorators apply, global decorators wrap around story-level ones — global decorators form the "outermost" layer, with story-specific decorators nested inside, closest to the actual story content.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Connected Component Needing a Redux Store Only in Its Own Stories, Not Polluting Every Other Component's Stories With an Unnecessary Provider.
A design system's stories mostly needed just a theme provider (applied globally, since virtually every component in the library reads theme tokens) — but one specific `<CartBadge>` component, connected to a Redux store for its item count, additionally needed a mock store wrapping just its own stories. Applying the Redux Provider as a **story-level** decorator (scoped only to `CartBadge.stories.tsx`) meant every other component's stories stayed lean and provider-free, while `CartBadge`'s stories got exactly the additional context they specifically needed — global decorators handled the universal theme need, story-level decorators handled the narrow, component-specific one.

---

## 3. Production-Grade Code Example

```typescript
// .storybook/preview.ts — global decorators, applied to EVERY story
import { ThemeProvider } from '../src/theme';

export const decorators = [
  (Story) => (
    <ThemeProvider theme="light">
      <Story />
    </ThemeProvider>
  ),
];
```

```tsx
// CartBadge.stories.tsx — a story-level decorator, scoped ONLY to this component's stories
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CartBadge } from './CartBadge';

const mockStore = configureStore({
  reducer: { cart: () => ({ items: ['sku_1', 'sku_2'] }) },
});

const meta: Meta<typeof CartBadge> = {
  component: CartBadge,
  title: 'Components/CartBadge',
  decorators: [(Story) => <Provider store={mockStore}><Story /></Provider>], // ONLY applies here
};
export default meta;

export const Default: Story = {}; // renders wrapped in BOTH the global ThemeProvider AND this local Redux Provider
```

```tsx
// A per-STORY decorator, scoped even narrower than the file's meta-level decorator
export const InsideDarkTheme: Story = {
  decorators: [
    (Story) => <ThemeProvider theme="dark"><Story /></ThemeProvider>, // overrides the GLOBAL light theme, for THIS story only
  ],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Applying a Narrow-Need Provider Globally, Wasting Setup and Masking Missing-Context Bugs
```typescript
// ❌ WRONG: making EVERY component's stories depend on a Redux Provider, when only a
// small subset of components are actually connected, wastes setup and can MASK a genuine
// bug where a component secretly, accidentally started depending on Redux context it shouldn't
export const decorators = [(Story) => <Provider store={mockStore}><Story /></Provider>]; // GLOBAL, but few components need it

// ✅ CORRECT: scope providers to the SPECIFIC stories that genuinely need them — a component
// that DOESN'T need Redux context should be free to crash in isolation if it secretly starts
// depending on it, surfacing that dependency immediately rather than being silently masked
```

### ⚠️ Pitfall 2: Forgetting Decorator Composition Order When Debugging Unexpected Wrapping Behavior
```
❌ CONFUSING: if a story isn't rendering with the expected theme/context, forgetting that
GLOBAL decorators wrap OUTSIDE story-level ones can lead to confusion about which decorator's
value is actually "winning" for a given piece of context — a story-level decorator's theme
value should generally take precedence for that specific story if both are trying to provide
the SAME context, but the actual behavior depends on how each decorator itself is implemented

✅ AWARENESS: understand the actual nesting order (global outermost, story-level innermost)
when debugging why a specific story isn't reflecting an expected override
```

### ⚠️ Pitfall 3: A Decorator With Side Effects That Persist Across Story Navigation
```typescript
// ❌ RISKY: a decorator that sets up some GLOBAL side effect (registering a global event
// listener, mutating a module-level variable) without cleanup can leak state as a user
// navigates between different stories in the Storybook UI, causing confusing, story-order-
// dependent behavior
const withGlobalListener = (Story) => {
  window.addEventListener('resize', someHandler); // never cleaned up!
  return <Story />;
};

// ✅ CORRECT: decorators needing side effects should clean them up, ideally via a useEffect
// INSIDE a wrapper component, not directly in the decorator function body
const withGlobalListener2 = (Story) => {
  function Wrapper({ children }) {
    useEffect(() => {
      window.addEventListener('resize', someHandler);
      return () => window.removeEventListener('resize', someHandler); // cleaned up on story change
    }, []);
    return children;
  }
  return <Wrapper><Story /></Wrapper>;
};
```
