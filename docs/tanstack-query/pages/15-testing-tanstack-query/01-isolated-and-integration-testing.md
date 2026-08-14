---
title: "Testing TanStack Query: Fresh Clients, Disabled Retries & MSW Integration"
sidebar_label: "Testing TanStack Query"
sidebar_position: 1
---

# 🔄 Testing TanStack Query: Fresh Clients, Disabled Retries & MSW Integration

## 1. Under-The-Hood Mechanics

Testing components using TanStack Query requires three deliberate setup decisions — each addressing a way tests would otherwise behave differently from (and less reliably than) the same code running in the actual app.

```
1. FRESH QueryClient per test    ──► avoids cache state LEAKING between tests (the same
                                        isolation concern covered in the Jest/RTL custom
                                        render doc, applied specifically to the query cache)

2. retry: false in the test QueryClient  ──► a test asserting error-state UI shouldn't have
                                                 to wait through several REAL retry attempts
                                                 with exponential backoff — fail FAST instead

3. MSW for network mocking            ──► the SAME network-layer interception approach
                                              covered in the Jest/RTL network mocking doc —
                                              exercises the REAL queryFn/fetch code, not a
                                              mocked-away queryFn
```

### Why a Fresh `QueryClient` Per Test Is Non-Negotiable
Sharing one `QueryClient` instance across multiple tests means query results, error states, and cache timestamps from one test persist into the next — a test asserting "this query is in an error state" could pass or fail depending on what a **completely unrelated**, earlier test happened to do to that same cache entry. A fresh `QueryClient`, constructed inside a test-scoped render helper (exactly mirroring the [Jest/RTL custom render pattern](../../../jest-rtl/pages/11-custom-render/01-provider-wrapping.md)), guarantees each test starts from a genuinely empty, isolated cache.

### `retry: false`: Failing Fast Instead of Waiting Through Backoff
The app's real `defaultOptions` might configure several retries with exponential backoff (per the [global configuration doc](../13-global-configuration/01-defaultoptions.md)) — appropriate for production resilience, but disastrous for test speed: a test asserting an error state would otherwise need to wait through the full retry sequence (potentially many seconds of real backoff delay) before the query actually settles into its final error state. Configuring `retry: false` specifically in the test `QueryClient` makes queries fail immediately on the first attempt, matching what the test actually wants to assert.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Test Suite Where Error-State Tests Took Several Seconds Each, Until Retries Were Disabled for Tests.
A team's tests asserting error-state UI (e.g. "shows an error message when the API fails") were each taking 3-5 seconds to run — because the test `QueryClient` inherited the app's production retry configuration (3 retries with exponential backoff), every error-state test had to wait through that full retry sequence before the query settled into its final `error` status. Configuring the test-specific `QueryClient` with `retry: false` made every error-state test fail on the first attempt, as intended — cutting those tests down to near-instant, and revealing that the SLOW test suite had been almost entirely an artifact of test configuration, not anything inherent to the actual components being tested.

---

## 3. Production-Grade Code Example

```tsx
// test-utils.tsx — a fresh QueryClient per test, wrapped into the custom render
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }, // fail FAST instead of waiting through real backoff delays
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}
```

```tsx
// ProductDetail.test.tsx — using MSW for realistic network-layer mocking, alongside the fresh client
import { renderWithQueryClient } from '../test-utils';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

test('shows product data on successful fetch', async () => {
  renderWithQueryClient(<ProductDetail productId="1" />);
  expect(await screen.findByText('Wireless Mouse')).toBeInTheDocument();
});

test('shows an error message when the API fails', async () => {
  server.use(
    http.get('/api/products/:id', () => new HttpResponse(null, { status: 500 }))
  );

  renderWithQueryClient(<ProductDetail productId="1" />);

  // Fails FAST (retry: false in the test client) — no waiting through real backoff delays
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

```tsx
// Testing a custom hook directly, with the SAME fresh-client discipline
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProduct } from './useProduct';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

test('useProduct returns product data', async () => {
  const { result } = renderHook(() => useProduct('1'), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data.name).toBe('Wireless Mouse');
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Sharing One `QueryClient` Instance Across Multiple Tests
```tsx
// ❌ WRONG: a MODULE-LEVEL shared client means cache state (including ERROR states,
// stale timestamps) leaks between tests, causing order-dependent, confusing failures
const queryClient = new QueryClient(); // created ONCE, shared across every test in the file
export function renderWithQueryClient(ui) { return render(ui, { wrapper: ... }); }

// ✅ CORRECT: construct a FRESH QueryClient INSIDE the render function, per call (as shown above)
```

### ⚠️ Pitfall 2: Forgetting `retry: false` in the Test Client, Producing Needlessly Slow Tests
```tsx
// ❌ SLOW: inheriting production retry/backoff configuration in tests means error-state
// assertions must wait through the FULL retry sequence before the query actually settles
const queryClient = new QueryClient(); // no retry override — uses TanStack Query's own defaults (retry: 3)

// ✅ CORRECT: always disable retries for the TEST-specific QueryClient
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
```

### ⚠️ Pitfall 3: Mocking `queryFn` Directly Instead of Intercepting at the Network Layer
```tsx
// ❌ LESS REALISTIC: mocking the queryFn itself (jest.mock of the fetching function) means
// the REAL fetch/URL-construction/header logic never actually executes during the test —
// exactly the same realism gap covered in the Jest/RTL network mocking doc, applied to TanStack Query
jest.mock('../api/fetchProduct'); // bypasses the REAL fetch call entirely

// ✅ CORRECT: use MSW to intercept at the network layer, letting the real queryFn/fetch
// code execute fully, only mocking the final network RESPONSE
server.use(http.get('/api/products/:id', () => HttpResponse.json(mockProduct)));
```
