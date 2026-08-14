---
title: "Mocking Network Requests: MSW vs Direct `fetch`/`axios` Mocking"
sidebar_label: "Mocking Network Requests"
sidebar_position: 1
---

# 🧪 Mocking Network Requests: MSW vs Direct `fetch`/`axios` Mocking

## 1. Under-The-Hood Mechanics

Two genuinely different approaches to testing code that makes network requests — intercepting at the **network layer** (MSW) versus mocking the **client library/function** directly — trade off realism against setup simplicity.

```
Direct mocking:  jest.mock('axios')  OR  global.fetch = jest.fn()
        │
        ▼
Replaces the ENTIRE fetch/axios call — the REAL networking code (headers, serialization,
error handling in fetchBaseQuery-style wrappers) NEVER RUNS AT ALL in the test

MSW (Mock Service Worker):  intercepts at the NETWORK LAYER (Service Worker in browser,
                              a request interceptor in Node), BELOW fetch/axios
        │
        ▼
The REAL fetch()/axios call code EXECUTES FULLY — MSW intercepts the actual outgoing
request and returns a mocked RESPONSE, exactly as if a real server had answered
```

### Why MSW Is More Realistic
Because MSW intercepts at the network boundary rather than replacing the calling code, the **actual** `fetch`/`axios` invocation — including real header construction, real URL building, real error-handling logic for non-2xx responses — genuinely executes during the test. A bug in how the app constructs its request (a missing header, a malformed URL) would surface as a real MSW "no matching handler" mismatch, whereas mocking `axios` directly would never exercise that request-construction code at all, since the mock intercepts before any of it runs.

### Handler Override Per-Test
MSW's handlers are typically defined once, globally, for the happy path — individual tests needing to simulate an error or edge case (a 500 response, a network timeout) can override a specific handler **just for that test**, using `server.use()`, without needing to touch the shared global handler setup.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Bug in Request Header Construction That Direct Mocking Would Never Have Caught.
An API client had a bug where an authorization header was being set with an expired/malformed token format under certain conditions — because the team's existing tests mocked `axios` directly (`jest.mock('axios')`), the actual header-construction code never ran during any test; the mock simply returned canned data regardless of what headers would have actually been sent. Migrating critical API-client tests to MSW (which lets the real `axios` call execute, intercepting only the final network response) meant the test suite could now assert against the **actual** intercepted request's headers, immediately catching this exact class of bug that direct mocking had been structurally blind to.

---

## 3. Production-Grade Code Example

```typescript
// mocks/handlers.ts — MSW handler definitions, the shared "happy path" for the whole suite
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Alex', email: 'alex@acme.com' });
  }),
  http.post('/api/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'order_123', ...body }, { status: 201 });
  }),
];
```

```typescript
// mocks/server.ts — MSW's Node-side server, started once for the whole test run
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// test-setup.ts
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' })); // FAIL on any request with no matching handler
afterEach(() => server.resetHandlers()); // reset any per-test overrides after each test
afterAll(() => server.close());
```

```typescript
// UserProfile.test.tsx — using the shared happy-path handler, then overriding for an error case
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

test('displays user data on successful fetch', async () => {
  renderWithProviders(<UserProfile userId="1" />); // uses the SHARED happy-path handler automatically
  expect(await screen.findByText('Alex')).toBeInTheDocument();
});

test('displays an error message when the API returns 500', async () => {
  server.use(
    http.get('/api/users/:id', () => new HttpResponse(null, { status: 500 })) // OVERRIDE, just for this test
  );
  renderWithProviders(<UserProfile userId="1" />);
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `server.resetHandlers()` Between Tests, Leaking Overrides
```typescript
// ❌ WRONG: without resetting, a server.use() override from ONE test persists into the
// NEXT test, causing confusing, order-dependent failures that only reproduce when run together
test('A', () => { server.use(http.get('/api/users/1', () => HttpResponse.error())); /* ... */ });
test('B', () => { /* still sees the OVERRIDE from test A if resetHandlers() wasn't called! */ });

// ✅ CORRECT: always reset in an afterEach hook, globally, in test setup
afterEach(() => server.resetHandlers());
```

### ⚠️ Pitfall 2: Setting `onUnhandledRequest` to `'warn'` (or Leaving the Default) Instead of `'error'`
```typescript
// ❌ RISKY: the default/'warn' setting lets a request with NO matching handler fall through
// silently (or with just a console warning) — a genuinely broken/unexpected API call in
// the app's code produces a confusing downstream test failure, rather than an immediate,
// clear "no handler matched this request" signal pointing directly at the actual problem
server.listen(); // default onUnhandledRequest behavior

// ✅ CORRECT: fail LOUDLY and immediately on any unmatched request during tests
server.listen({ onUnhandledRequest: 'error' });
```

### ⚠️ Pitfall 3: Mocking `axios`/`fetch` Directly for Complex Request-Construction Logic
```typescript
// ❌ RISKY (for anything beyond trivial cases): as the scenario above shows, direct mocking
// means the ACTUAL request-building code (headers, serialization, retry logic) never executes,
// leaving real bugs in that code completely untested
jest.mock('axios');
axios.get.mockResolvedValue({ data: { id: 1, name: 'Alex' } }); // bypasses ALL real request logic

// ✅ CORRECT: for anything beyond the simplest cases, MSW's network-layer interception
// exercises the REAL request-construction code, catching bugs direct mocking cannot
```
