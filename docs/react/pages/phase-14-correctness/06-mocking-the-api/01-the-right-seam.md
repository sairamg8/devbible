---
title: "Why the network is the right seam"
sidebar_label: "01 · The right seam"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MSW 2.x**, from documentation —
> [Getting started](https://mswjs.io/docs/getting-started): handlers are *"functions
> responsible for intercepting requests and handling their responses"*, interception happens
> at the network level rather than by replacing application code, and the same mocks are
> reused *"across different tools and environments"*.
> No sandbox script backs this page; claims are cited, not measured.

## Three places you can cut

Every test of a data-driven component replaces the real server with something. The choice is
*where*, and there are three seams:

| Seam | What you replace | What is still under test |
|---|---|---|
| **Module mock** — `jest.mock('./api')` | your own request module | the component, given data |
| **`fetch` stub** — `global.fetch = jest.fn()` | the browser API | the component *and* your request module |
| **Network interception** — MSW | nothing in your code; requests are intercepted | the component, your request module, serialisation, headers, status handling |

Each row down, more of your code stays real. That is the entire argument.

## What a module mock cannot catch

```jsx
jest.mock("./api");
getOrders.mockResolvedValue([{ id: "A-1001" }]);
```

This proves the component renders a row when handed an array. It cannot notice that:

- the component calls `getOrders()` with no arguments while the real one requires a customer
  id — the mock accepts anything;
- the request goes to `/api/order` instead of `/api/orders`;
- the filter state is never serialised into the query string;
- a `POST` is sent where the API expects `PATCH`;
- the auth header is missing;
- the response is `{ data: [...] }` and the component reads the array directly.

Every one of those is a real bug that reaches production with a green suite, because the
mock's contract is *your assumption about the module*, restated in the test that checks it.

⚠️ **And the mock rots.** Change the real `getOrders` signature and `mockResolvedValue` keeps
returning the old shape forever. Nothing links the two — the test is asserting against a
version of the module that no longer exists.

## What a `fetch` stub cannot catch

Stubbing `global.fetch` keeps your request module real, which is better. What it costs:

```jsx
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => [{ id: "A-1001" }],
});
```

- **You are hand-building a `Response`.** The object above is not one — it has no `status`,
  no `headers`, no `text()`, no `clone()`. Code that reads any of those breaks in tests for
  reasons that do not exist in the app, so people start adding fields to the fake until it
  is a bad reimplementation of the platform.
- **It is one global stub for every request.** A screen that loads a user *and* their orders
  needs the stub to branch on the URL, and you end up writing a small router by hand.
- **It only covers `fetch`.** Anything using `XMLHttpRequest`, or a library that does,
  sails straight past.
- **Nothing verifies the request.** You *can* assert on `fetch.mock.calls[0]`, but that is
  an assertion about arguments, not about a request.

## What network interception gives you

MSW intercepts requests without replacing anything in your application code. The component
calls the real request module, which calls the real `fetch`, which produces a real `Request`,
which a handler answers with a real `Response`.

```jsx
http.get("/api/orders", ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("status") !== "open") {
    return HttpResponse.json({ message: "unexpected filter" }, { status: 400 });
  }
  return HttpResponse.json([{ id: "A-1001" }]);
});
```

Now the test can fail for the right reasons:

- **The URL and method are asserted by construction.** A request to the wrong path is
  unhandled, and with `onUnhandledRequest: 'error'` that fails the test
  ([chunk 02](02-handlers-and-lifecycle.md)).
- **The request body is inspectable** — `await request.json()` in the handler, which is how
  you assert what a form actually submitted ([topic 08](../08-testing-forms-and-actions.md)).
- **Status codes are real.** Returning `500` exercises your error path exactly as the server
  would; returning `401` exercises the refresh-and-retry logic.
- **Your serialisation layer is under test.** Query-string building, header construction,
  JSON parsing and error mapping all run.

## The property that pays for itself

The mocks are portable. Because interception is at the network layer, the same handlers run
in unit tests, in the browser during development, and in an end-to-end run — the docs'
*"reuse the same mocks across different tools and environments"*.

Practically: one `handlers.js` describing your API becomes the fixture for the test suite
*and* the offline dev environment. When the real API changes, one file changes, and every
test that depended on the old shape fails at once — which is the failure you want, instead
of ten module mocks quietly returning last quarter's schema.

## When a module mock is still right

This is not an absolutist position. Mock the module when **the thing you are replacing is
not a network call**:

- a module that reads from `localStorage`, or generates ids, or reads the clock;
- an analytics or logging SDK you only need to assert was called;
- a genuinely heavy child component in one specific test — the RTL FAQ's own suggestion
  ([topic 02](../02-the-rtl-model/README.md));
- third-party code with no HTTP boundary at all.

The test: **if it goes over HTTP, intercept it. If it does not, mocking the module is the
only option available anyway.**

## Gotchas

**Symptom:** a test passes with a module mock, and the feature 404s in production.
**Cause:** the mock never checked the URL, so a typo in the path was invisible.
**Fix:** intercept at the network level; an unhandled request is an unmistakable failure.

**Symptom:** a hand-built `fetch` stub grows `headers`, `status`, `clone`, `text`…
**Cause:** you are reimplementing `Response` badly.
**Fix:** let MSW produce a real one via `HttpResponse`.

**Symptom:** the suite is green, then everything breaks the day the API changes shape.
**Cause:** module mocks are frozen copies of an old contract and nothing ties them to it.
**Fix:** one shared handler file — the API changes there, and every affected test fails
immediately.

**Symptom:** a request-shape bug is only caught in QA.
**Cause:** the seam was above the point where the request is built, so the request was never
built at all.
**Fix:** move the seam down. Assert on the intercepted request itself.

## Interview questions

**★ Why mock the network instead of your API module?**
Because mocking the module assumes the very thing worth testing — that the component calls
the API correctly. Intercepting at the network layer leaves your request module, your
serialisation and the platform's `fetch` under test, so a wrong URL, method, query string,
header or response shape actually fails. It also gives you real `Request` and `Response`
objects rather than hand-built fakes.

**★ What is wrong with `global.fetch = jest.fn()`?**
You are hand-constructing responses, so anything reading `status`, `headers`, `text()` or
`clone()` breaks for reasons that do not exist in the app; the single stub has to branch by
URL once a screen makes more than one request; anything not using `fetch` bypasses it
entirely; and it lets you assert on arguments rather than on a request.

**★ What does MSW's portability actually buy you?**
Because it intercepts at the network level rather than replacing application code, the same
handlers work in unit tests, in the browser during development and in end-to-end runs. One
description of the API serves all three, so when the real contract changes there is one file
to update and every affected test fails at once.

**When is a module mock still the right call?**
When there is no HTTP boundary — `localStorage`, id or time generation, an analytics SDK you
only need to assert was called, or one deliberately mocked heavy child component. Network
interception is for things that go over the network; everything else has to be mocked where
it lives.

**A test mocks `getOrders` to resolve with an array and passes. What might still be broken?**
The URL, the method, the query string, the headers, the response envelope, and whether the
component passes the arguments the real function requires. The mock accepts any call and
returns whatever it was told to, so it verifies the component's rendering and nothing about
its integration.

---

← Index: [Mocking the API with MSW](README.md) ·
Next → [Handlers, lifecycle and the states that matter](02-handlers-and-lifecycle.md)
