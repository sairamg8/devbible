---
title: "Custom Render: Wrapping Providers & Re-Exporting RTL Consistently"
sidebar_label: "Custom Render"
sidebar_position: 1
---

# 🧪 Custom Render: Wrapping Providers & Re-Exporting RTL Consistently

## 1. Under-The-Hood Mechanics

Any component relying on React Context (a Redux store, a router, a theme provider, a query client) will crash or behave incorrectly if rendered in isolation via plain RTL `render()` — a **custom render function**, wrapping the component tree in whatever providers the app actually needs, is the standard solution, written once and reused across every test file.

```
plain RTL render(ui)  ──► renders `ui` with NO surrounding context providers at all
        │
        ▼
custom render(ui, options)  ──► renders `ui` WRAPPED IN: <Provider><Router><ThemeProvider><QueryClientProvider>
                                    {ui}
                                  </QueryClientProvider></ThemeProvider></Router></Provider>
```

### Re-Exporting RTL: One Import Path for the Whole Test Suite
The idiomatic pattern doesn't just define a custom `render` — it **re-exports everything else from RTL** (`screen`, `waitFor`, etc.) from the same custom test-utils module, so every test file imports from **one** consistent location (`../test-utils`, not `@testing-library/react` directly) — this is what makes it structurally difficult to accidentally use the plain, unwrapped `render()` in a test that actually needs providers, since the "wrong" import isn't even the one habitually reached for.

### Configurable Initial State/Route
A well-designed custom render accepts **options** (an initial Redux state, an initial route, a set of feature flags) so individual tests can render the same component tree under different starting conditions — without each test needing to hand-construct its own full provider wrapper from scratch.

---

## 2. Real-World Engineering Scenario

**Scenario**: Every New Test File Needing to Hand-Wrap Components in Four Different Providers, Until a Custom Render Existed.
Before a custom render utility existed, every test file that touched a connected component had to manually wrap it in `<Provider store={...}><BrowserRouter><ThemeProvider theme={...}><QueryClientProvider client={...}>` — repetitive, error-prone (easy to forget one provider, or configure it inconsistently across files), and a genuine drag on new test authoring speed. Introducing one shared `renderWithProviders()` utility (accepting an optional `preloadedState` and `initialRoute`) collapsed all of that repeated wrapping into a single import, used identically across the entire test suite — new tests became faster to write, and every test's provider setup stayed consistent by construction, rather than by convention alone.

---

## 3. Production-Grade Code Example

```tsx
// test-utils.tsx — the ONE custom render, re-exporting everything else from RTL
import { render, type RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rootReducer } from '../app/rootReducer';
import type { RootState } from '../app/store';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  initialRoute?: string;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState, initialRoute = '/', ...renderOptions }: CustomRenderOptions = {}
) {
  const store = configureStore({ reducer: rootReducer, preloadedState });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }); // no retries slowing tests down

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Re-export EVERYTHING else from RTL, so tests never need a second import source
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
```

```tsx
// CartBadge.test.tsx — using the custom render, with test-specific initial state
import { renderWithProviders, screen } from '../test-utils'; // NOT '@testing-library/react' directly

test('shows the correct item count from preloaded state', () => {
  renderWithProviders(<CartBadge />, {
    preloadedState: { cart: { items: ['sku_1', 'sku_2'] } },
  });
  expect(screen.getByText('2')).toBeInTheDocument();
});

test('renders correctly when navigated to the checkout route', () => {
  renderWithProviders(<CheckoutPage />, { initialRoute: '/checkout' });
  expect(screen.getByRole('heading', { name: /checkout/i })).toBeInTheDocument();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Some Test Files Using the Custom Render, Others Importing RTL Directly
```tsx
// ❌ INCONSISTENT: mixing import sources means SOME tests get providers, others silently
// don't — a component needing context crashes only in the files that forgot the custom render
import { render, screen } from '@testing-library/react'; // ❌ missing providers entirely

// ✅ CORRECT: lint-enforce (via eslint's no-restricted-imports) that test files import
// render/screen ONLY from the custom test-utils module, never directly from RTL
import { renderWithProviders as render, screen } from '../test-utils';
```

### ⚠️ Pitfall 2: A Fresh Store/QueryClient Not Created Per-Render
```tsx
// ❌ WRONG: a MODULE-LEVEL shared store means state from one test LEAKS into the next test,
// since Redux/React Query state persists across renders sharing the same store/client instance
const store = configureStore({ reducer: rootReducer }); // created ONCE, shared across EVERY test
export function renderWithProviders(ui) { return render(ui, { wrapper: ... }); }

// ✅ CORRECT: construct a FRESH store/queryClient INSIDE the render function, per call,
// as shown in the production example — full isolation between tests
export function renderWithProviders(ui, options) {
  const store = configureStore({ reducer: rootReducer, preloadedState: options?.preloadedState });
  // ...
}
```

### ⚠️ Pitfall 3: Overloading One Custom Render With Every Possible Provider Combination
A single custom render trying to support every conceivable provider combination via a large, sprawling options object can become its own source of complexity and confusion. For apps with genuinely distinct testing needs across different areas (some tests need a router, some don't; some need auth context, some don't), consider a few distinct, purpose-built render utilities (`renderWithRouter`, `renderWithAuth`, `renderFullApp`) rather than one over-parameterized function trying to cover every case.
