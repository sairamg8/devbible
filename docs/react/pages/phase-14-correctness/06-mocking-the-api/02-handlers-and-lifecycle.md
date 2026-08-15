---
title: "Handlers, lifecycle and the states that matter"
sidebar_label: "02 · Handlers and lifecycle"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MSW 2.x**, from documentation —
> [Getting started](https://mswjs.io/docs/getting-started) (the `http.get` +
> `HttpResponse.json` handler shape),
> [`setupServer`](https://mswjs.io/docs/api/setup-server) (*"a function that configures the
> interception of requests in a Node.js process"*, the `listen` / `resetHandlers` / `close`
> hooks, `use()` for per-test overrides, and the warning that *"multiple setupServer calls
> is not a good idea"*) and
> [`listen()`](https://mswjs.io/docs/api/setup-server/listen) (`onUnhandledRequest` defaults
> to **`"warn"`**; `"error"` prints an error and halts request execution; `"bypass"` prints
> nothing and performs the request as-is).
> No sandbox script backs this page; claims are cited, not measured.

## The shape of a handler

```js
// mocks/handlers.js
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/orders", () => HttpResponse.json([{ id: "A-1001", total: 4200 }])),

  http.get("/api/orders/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, total: 4200 })),

  http.post("/api/orders", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "A-1002", ...body }, { status: 201 });
  }),
];
```

Three things to notice, because they are what make request assertions possible:

- **`request` is a real `Request`**, so `await request.json()`, `request.headers.get(…)` and
  `new URL(request.url).searchParams` all work.
- **`params` comes from the path pattern**, so `:id` is captured without parsing.
- **`HttpResponse.json(body, init)`** produces a real `Response`; the second argument carries
  `status` and `headers`.

## The lifecycle

```js
// setup file, referenced from the runner config
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- **`listen()`** starts interception.
- **`resetHandlers()`** removes the runtime handlers added during a test — the line that
  keeps tests independent.
- **`close()`** stops interception and cleans up.

🔴 **`resetHandlers()` in `afterEach` is not optional.** Without it, a `server.use()` override
added to make one test return a 500 stays installed, and every later test in the file sees a
failing API. The symptom is the worst kind: tests that pass alone and fail in a suite, or
pass in one order and fail in another ([topic 14](../14-flaky-tests-and-ci.md)).

⚠️ **One server per test run.** The docs warn that *"multiple setupServer calls is not a good
idea"* — pick global setup or per-test usage and stay consistent.

## `onUnhandledRequest` — set it to `error`

The default is `"warn"`: *"Print a warning but perform the request as-is."* The other
documented values are `"error"` (*"Print an error and halt request execution"*) and
`"bypass"` (*"Does not print anything and perform the request as-is"*), plus a custom
callback.

**Use `"error"` in tests.** Under the default, a request your handlers do not cover is
performed as-is — so a typo'd URL makes a real network call, which in CI either hangs, fails
slowly, or worse, succeeds against something real. With `"error"` the test fails immediately
and names the request, which turns "the component fetches the wrong path" from an invisible
bug into a one-line diagnosis.

One documented caveat if you pass a custom callback instead of a string: *"you will opt out
from that behavior"* where MSW ignores common static-asset requests — restore it by calling
`isCommonAssetRequest()` inside your strategy.

## Per-test overrides with `server.use()`

Default handlers describe the happy path. Individual tests override for the case they are
about:

```jsx
test("shows a retryable error when the list fails", async () => {
  server.use(
    http.get("/api/orders", () =>
      HttpResponse.json({ message: "boom" }, { status: 500 })),
  );

  render(<Orders />);

  expect(await screen.findByRole("alert")).toHaveTextContent(/could not load orders/i);
  expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
});
```

The override lives for one test because `resetHandlers()` removes it. This pattern is what
makes the important states cheap to test.

## The four states worth covering

For any data-driven screen, these are the tests that earn their place
([topic 01](../01-what-to-test/README.md)):

**1 · Loading.** Delay the response so the loading state is observable, then assert it goes
away:

```jsx
server.use(
  http.get("/api/orders", async () => {
    await delay(100);                       // msw's delay()
    return HttpResponse.json([]);
  }),
);
render(<Orders />);
expect(screen.getByRole("progressbar")).toBeInTheDocument();
await waitForElementToBeRemoved(() => screen.queryByRole("progressbar"));
```

**2 · Error.** A `500`, and the assertion that the user is told something useful and offered
a way forward. Also worth a test: the retry actually re-requests — override the handler again
so the second call succeeds, then assert the data appears.

**3 · Empty.** `HttpResponse.json([])`. The empty state is the single most commonly shipped-
broken state in a UI, because it is invisible during development against seeded data.

**4 · Success with the *right request*.** The assertion nothing else can make:

```jsx
let submitted;
server.use(
  http.post("/api/orders", async ({ request }) => {
    submitted = await request.json();
    return HttpResponse.json({ id: "A-1002" }, { status: 201 });
  }),
);

await user.click(screen.getByRole("button", { name: /place order/i }));

await screen.findByText(/order placed/i);
expect(submitted).toEqual({ items: [{ sku: "ABC", qty: 2 }], note: "" });
```

That test fails if the payload key is renamed, if the note is dropped, or if quantity is sent
as a string — none of which a module mock notices.

## Gotchas

**Symptom:** tests pass individually and fail as a suite.
**Cause:** a `server.use()` override leaked because `resetHandlers()` is missing from
`afterEach`.
**Fix:** add it. It is the single most common MSW setup mistake.

**Symptom:** a test hangs or is slow in CI only.
**Cause:** an unhandled request performed for real, because `onUnhandledRequest` is at its
`"warn"` default.
**Fix:** `server.listen({ onUnhandledRequest: "error" })`, which halts and names the request.

**Symptom:** "No handler found" for a request whose URL looks right.
**Cause:** a path/origin mismatch — a relative `/api/orders` handler against an absolute
`https://api.example.com/orders` request, or a missing/extra trailing segment.
**Fix:** match how the app actually builds the URL. The error prints the request; compare it
character by character rather than guessing.

**Symptom:** a POST assertion never sees the body.
**Cause:** the body was read after the response was returned, or read twice — a `Request`
body is a stream and can only be consumed once.
**Fix:** `await request.json()` once, at the top of the handler, and keep the value.

**Symptom:** the loading state can never be asserted because data appears instantly.
**Cause:** the handler resolves synchronously.
**Fix:** `await delay(…)` in the handler for that specific test.

**Symptom:** an `act()` warning after a test finishes.
**Cause:** a request resolving after teardown — often an unhandled one, or a test that never
waited for the result.
**Fix:** wait for the visible consequence inside the test, and make unhandled requests fail
loudly ([topic 05](../05-async-testing-and-act/README.md)).

## Interview questions

**★ What does the `beforeAll` / `afterEach` / `afterAll` trio do, and which line matters most?**
`server.listen()` starts interception, `server.resetHandlers()` removes per-test overrides,
`server.close()` stops interception. `resetHandlers()` is the one that matters most: without
it a `server.use()` override from one test stays installed for the rest of the file, which
produces tests that pass alone and fail in a suite — the hardest failure mode to diagnose.

**★ What is `onUnhandledRequest` and what should it be in tests?**
It decides what MSW does with a request no handler matches. It defaults to `"warn"`, which
prints a warning and performs the request as-is; `"error"` prints an error and halts
execution; `"bypass"` performs it silently. In tests it should be `"error"`, so a wrong URL
fails immediately and by name instead of making a real network call in CI.

**★ How would you assert that a form submits the right payload?**
Override the POST handler for that test, read `await request.json()` inside it, capture the
value, and assert on it after waiting for the success state. That is a genuine request
assertion — it fails if a key is renamed, a field is dropped, or a number is serialised as a
string — and it is only possible because the mock sits at the network layer.

**★ Which states should a data-driven component's tests cover?**
Loading, error, empty and success-with-the-right-request. Empty and error are the ones most
often shipped broken, because development happens against seeded data on a working API; MSW
makes both a two-line override.

**How do you test a retry button?**
Install a failing handler, assert the error state, then `server.use()` a succeeding handler
before clicking Retry and assert the data renders. Both handlers disappear at
`resetHandlers()`, so the next test is unaffected.

**Why can you only read a request body once?**
Because `Request` bodies are streams — the same platform rule as in application code. Read it
once at the top of the handler and keep the value if you need it later.

---

← Prev: [Why the network is the right seam](01-the-right-seam.md) ·
Index: [Mocking the API with MSW](README.md) ·
Next → [Jest or Vitest](../07-jest-or-vitest.md)
