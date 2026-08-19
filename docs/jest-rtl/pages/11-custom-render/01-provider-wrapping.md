---
title: "Custom Render: Provider Wrappers, Redux, TanStack Query & Test Utils"
sidebar_label: "Custom Render"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against Testing Library documentation — [Custom Render Setup](https://testing-library.com/docs/react-testing-library/setup#custom-render).

A custom render utility encapsulates global React Contexts (Redux Store, TanStack QueryClient, MemoryRouter, ThemeProvider) into a single reusable test wrapper, guaranteeing test isolation by instantiating fresh state clients per test execution.

---

## 1. Under-The-Hood Mechanics

When testing React components that consume Context hooks (`useSelector`, `useQuery`, `useNavigate`), rendering without providers throws fatal runtime errors:

```
Direct Render (Unwrapped):
  render(<UserProfile />) ──► Fails: "useQuery must be used within a QueryClientProvider"

Custom Render Pipeline:
  renderWithProviders(<UserProfile />, options)
    ├── Instantiates FRESH Redux Store (with optional preloadedState)
    ├── Instantiates FRESH TanStack QueryClient (retry: false, gcTime: 0)
    ├── Instantiates MemoryRouter (with optional initialEntries: ['/profile/101'])
    └── Passes compound <AllTheProviders /> component to RTL's `wrapper` option
```

### The Single-Entrypoint Re-Export Pattern
To enforce consistency across engineering teams, author a central `src/test/test-utils.tsx` file that exports your custom `renderWithProviders` method while re-exporting all standard utilities from `@testing-library/react` and `@testing-library/user-event`.

---

## 2. Real-World Engineering Scenario

**Scenario**: Data leaking across tests due to a shared global `QueryClient` cache.

A dashboard test suite fetched user notification counts. Test A mutated the server cache with `queryClient.setQueryData()`. When Test B executed, it received Test A's cached notifications instead of fetching initial state, causing intermittent CI failures based on execution order. Refactoring `renderWithProviders` to instantiate a brand-new `QueryClient` inside the render function for each invocation restored complete test hermeticity.

---

## 3. Production-Grade Code Example

```tsx
// src/test/test-utils.tsx
import React, { PropsWithChildren } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { rootReducer, RootState } from '../store/rootReducer';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: Partial<RootState>;
  store?: EnhancedStore;
  queryClient?: QueryClient;
  initialEntries?: MemoryRouterProps['initialEntries'];
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: rootReducer,
      preloadedState: preloadedState as any,
    }),
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disables automatic retries that slow down tests
          gcTime: 0,    // Instantly clears garbage collection cache
        },
      },
    }),
    initialEntries = ['/'],
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function AllTheProviders({ children }: PropsWithChildren<{}>): React.JSX.Element {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );
  }

  return {
    store,
    queryClient,
    ...render(ui, { wrapper: AllTheProviders, ...renderOptions }),
  };
}

// Re-export standard testing utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
```

```tsx
// UserProfile.test.tsx — Clean consumer test file
import React from 'react';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { UserProfile } from './UserProfile';

describe('UserProfile Provider Integration', () => {
  test('renders user data with preloaded Redux state and route parameters', async () => {
    const user = userEvent.setup();

    renderWithProviders(<UserProfile />, {
      preloadedState: {
        auth: { user: { id: 'usr_1', role: 'ADMIN' }, isAuthenticated: true },
      },
      initialEntries: ['/users/usr_1?tab=security'],
    });

    expect(screen.getByRole('heading', { name: /admin security settings/i })).toBeInTheDocument();
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: Tests fail randomly when run in parallel or different order
- **Cause**: Creating a single `const queryClient = new QueryClient()` at the file module scope of `test-utils.tsx`. The cache is shared across every test in the file.
- **Fix**: Always construct a new `new QueryClient()` instance *inside* the `renderWithProviders` function body so each test receives an isolated cache.

### Symptom: `Error: useNavigate() may be used only in the context of a <Router> component`
- **Cause**: Testing a component that triggers programmatic routing without wrapping it in a `<MemoryRouter>`.
- **Fix**: Include `<MemoryRouter initialEntries={initialEntries}>` in your provider wrapper.

### Symptom: Query requests timeout because TanStack Query retries failed requests 3 times
- **Cause**: Default React Query options retry failed network requests with exponential backoff (1s, 2s, 4s), stalling failed API tests for 7+ seconds.
- **Fix**: In the test `QueryClient`, configure `defaultOptions: { queries: { retry: false } }`.

---

## 5. Interview Questions & Deep Dives

### ★ 1. Why is instantiating a fresh Redux store and QueryClient per test critical for test hermeticity?
**Answer**: Hermeticity requires that each test run in a clean, reproducible state. If a single store or QueryClient instance is shared across tests, state mutations, cached network payloads, and in-flight query subscriptions from Test A leak into Test B, making test outcomes order-dependent and causing flaky CI runs.

### ★ 2. How does RTL's `wrapper` option work inside `render()`?
**Answer**: The `wrapper` option accepts a React component (`({ children }) => <Providers>{children}</Providers>`). RTL wraps the rendered UI element inside this wrapper component before mounting it into the synthetic DOM container. When `rerender()` is called, RTL preserves the wrapper hierarchy.

### 3. How do you test route changes when using `MemoryRouter`?
**Answer**: You can inspect the current location by wrapping a lightweight consumer component or by testing UI elements that appear exclusively at the target destination URL:
```tsx
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}
```

### 4. How can ESLint prevent developers from bypassing the custom render utility?
**Answer**: Use `eslint-plugin-no-restricted-imports` to forbid direct imports of `render` from `@testing-library/react`:
```javascript
'no-restricted-imports': ['error', {
  paths: [{
    name: '@testing-library/react',
    importNames: ['render'],
    message: 'Please use renderWithProviders from src/test/test-utils instead.',
  }],
}]
```

---

## Where this connects

- **Previous**: [10 · Async Utilities](../10-async-utilities/01-waiting-for-updates.md) — Handling asynchronous DOM updates.
- **Next**: [12 · Mocking Network Requests](../12-mocking-network-requests/01-api-level-mocking.md) — Integrating Mock Service Worker (MSW) with custom render.
- **Redux Toolkit Track (`docs/redux-toolkit/`)**: In-depth state slice management.
