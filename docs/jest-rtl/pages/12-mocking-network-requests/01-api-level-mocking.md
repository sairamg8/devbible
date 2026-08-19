---
title: "Mocking Network Requests: MSW v2, Request Handlers & Error Injections"
sidebar_label: "Mocking Network Requests"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against MSW v2 documentation — [Mock Service Worker v2](https://mswjs.io/docs/).

Mock Service Worker (MSW v2) intercepts network requests at the Node HTTP / Fetch transport layer using `http` handlers and `HttpResponse` objects, allowing real application networking logic (serializers, headers, retry loops) to execute unmodified during tests.

---

## 1. Under-The-Hood Mechanics

Direct client stubbing vs MSW network-boundary interception:

```
Direct Client Mocking (`jest.mock('axios')` / `global.fetch = jest.fn()`):
  Component ──► Calls mocked `axios.get()` ──► Returns canned object immediately.
  (Bypasses header creation, base URL resolution, query param serialization, and interceptors).

MSW v2 Transport-Layer Interception (`setupServer`):
  Component ──► Real `fetch()` / `axios.get()` ──► Node.js `http`/`undici` socket stream
                                                               │
                                                               ▼
                                                     MSW Interceptor catches request
                                                               │
                                                               ▼
                                                  Evaluates `handlers` matrix
                                                               │
                                                               ▼
                                                  Returns real `Response` stream
```

### MSW v2 Architecture
MSW v2 uses standard Web Fetch API primitives (`Request`, `Response`, `Headers`):
- `http.get('/api/users/:id', ({ request, params, cookies }) => HttpResponse.json(...))`
- `HttpResponse.json(data, { status: 200 })`
- `HttpResponse.error()`: Simulates network dropouts / offline DNS failures.
- `delay(milliseconds)`: Simulates real network latency to test loading skeletons.

---

## 2. Real-World Engineering Scenario

**Scenario**: A production incident caused by missing `Authorization: Bearer <token>` headers that passed unit tests.

The application used `axios.create({ baseURL: '/api' })` with an interceptor that injected auth tokens. Because tests mocked axios with `jest.mock('axios')`, the interceptor never executed during tests. When a refactor broke the token injector, all tests passed, but production threw 401s. Switching tests to MSW v2 allowed the real axios instance to run, verifying that headers and interceptors executed properly on every test run.

---

## 3. Production-Grade Code Example

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';

export interface UserDTO {
  id: string;
  name: string;
  role: 'ADMIN' | 'USER';
}

export const handlers = [
  // 1. GET with URL params and auth header verification
  http.get('https://api.acme.com/v1/users/:id', ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new HttpResponse(null, { status: 401, statusText: 'Unauthorized' });
    }

    const { id } = params;
    return HttpResponse.json<UserDTO>({
      id: id as string,
      name: 'Alex Mercer',
      role: 'ADMIN',
    });
  }),

  // 2. POST with JSON body payload validation
  http.post('https://api.acme.com/v1/orders', async ({ request }) => {
    const payload = await request.json() as { items: string[] };
    if (!payload.items || payload.items.length === 0) {
      return HttpResponse.json({ error: 'Cart cannot be empty' }, { status: 400 });
    }

    return HttpResponse.json({ orderId: 'ord_98765', status: 'CONFIRMED' }, { status: 201 });
  }),
];
```

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```tsx
// UserProfile.test.tsx — Testing success, error override, and offline states
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { UserProfile } from './UserProfile';

describe('UserProfile MSW Integration', () => {
  test('renders user data on 200 OK using global handler', async () => {
    renderWithProviders(<UserProfile userId="usr_123" />);

    expect(await screen.findByRole('heading', { name: 'Alex Mercer' })).toBeInTheDocument();
    expect(screen.getByText(/role: ADMIN/i)).toBeInTheDocument();
  });

  test('displays error alert on 500 internal server error override', async () => {
    // Override handler specifically for this test
    server.use(
      http.get('https://api.acme.com/v1/users/:id', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderWithProviders(<UserProfile userId="usr_123" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to load user profile/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  test('handles network offline dropout with HttpResponse.error()', async () => {
    server.use(
      http.get('https://api.acme.com/v1/users/:id', () => {
        return HttpResponse.error(); // Simulates network failure / offline status
      })
    );

    renderWithProviders(<UserProfile userId="usr_123" />);

    expect(await screen.findByText(/network connection lost/i)).toBeInTheDocument();
  });
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: Handler override in Test A causes Test B to fail with unexpected 500 error
- **Cause**: Forgetting to call `server.resetHandlers()` in the global `afterEach` hook. `server.use()` overrides persist across tests until explicitly reset.
- **Fix**: Place `afterEach(() => server.resetHandlers())` in your global `src/setupTests.ts` file.

### Symptom: `Cannot find name 'rest'` or `rest.get is not a function`
- **Cause**: Using legacy MSW v1 syntax (`rest.get()`, `res(ctx.json())`). MSW v2 replaced `rest` with `http` and native Web `HttpResponse`.
- **Fix**: Upgrade handlers to MSW v2 syntax: `http.get('/url', () => HttpResponse.json({ ... }))`.

### Symptom: Tests hang or pass with unhandled network requests
- **Cause**: MSW was configured without strict request matching, allowing unhandled requests to fall through silently.
- **Fix**: In `src/setupTests.ts`, initialize with `server.listen({ onUnhandledRequest: 'error' })` so any un-mocked endpoint fails immediately with a descriptive URL log.

---

## 5. Interview Questions & Deep Dives

### ★ 1. Why is MSW superior to `jest.mock('axios')` or stubbing `global.fetch`?
**Answer**: Direct mocking of `axios` or `fetch` replaces the client module itself. This prevents you from testing request URL formatting, query parameter serialization, custom headers (e.g. CSRF tokens, Auth headers), interceptors, and non-2xx HTTP status parsing. MSW intercepts at the network socket layer, allowing 100% of your client networking code to execute naturally.

### ★ 2. How does `server.use()` differ from passing handlers to `setupServer(...handlers)`?
**Answer**: `setupServer(...handlers)` registers the default baseline request handlers for the entire test suite. `server.use(...overrideHandlers)` prepends runtime overrides to the front of MSW's internal handler stack. When a request occurs, MSW evaluates the override first. Calling `server.resetHandlers()` removes all runtime overrides added via `server.use()`.

### 3. How does MSW v2 work inside Node.js vs the browser?
**Answer**:
- In the **browser** (e.g. Storybook or E2E development), MSW registers a Service Worker (`mockServiceWorker.js`) via `setupWorker` to intercept requests via the browser's Service Worker API.
- In **Node.js / jsdom** (Jest/Vitest), Service Workers do not exist. MSW uses `@mswjs/interceptors` via `setupServer` to monkey-patch Node's low-level `http.ClientRequest`, `https.request`, and global `fetch` / `XMLHttpRequest` classes.

### 4. How do you assert that a specific payload was sent in a POST request with MSW?
**Answer**: Read the `request` parameter in the handler:
```typescript
let capturedBody: any;
server.use(
  http.post('/api/checkout', async ({ request }) => {
    capturedBody = await request.json();
    return HttpResponse.json({ ok: true });
  })
);
// ... trigger interaction ...
expect(capturedBody).toEqual({ productId: '101', quantity: 2 });
```

---

## Where this connects

- **Previous**: [11 · Custom Render](../11-custom-render/01-provider-wrapping.md) — Integrating MSW with `renderWithProviders`.
- **Next**: [13 · Testing Hooks](../13-testing-hooks/01-render-hook.md) — Testing custom React data hooks with `renderHook`.
- **TanStack Query Integration (`docs/tanstack-query/`)**: Testing cache invalidation and query retries against MSW endpoints.
