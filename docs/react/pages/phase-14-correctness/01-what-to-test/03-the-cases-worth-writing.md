---
title: "The cases worth writing"
sidebar_label: "03 · The cases worth writing"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React Testing Library 16.x** and
> **@testing-library/user-event 14.x**, from documentation — Testing Library
> [Guiding Principles](https://testing-library.com/docs/guiding-principles) and
> [queries · About](https://testing-library.com/docs/queries/about) for the query
> priority the examples follow. The test *selection* below (four states, the regression
> rule, the file shape) is judgement built on those principles. Every API used here is
> covered properly in [topic 02](../02-the-rtl-model/README.md) through
> [topic 06](../06-mocking-the-api.md); the code is illustrative and is **not** run output.
> No sandbox script backs this page; claims are cited, not measured.

The procedure from [chunk 02](02-what-earns-a-test.md), applied to one real feature: a
list of orders fetched from an API, with a search box and a retry button.

## The four states, and the one everybody writes

Any component that fetches has four user-visible states. Most suites contain a test for
exactly one of them — the success case — because it is the one you were looking at while
building the feature.

| State | The user sees | The bug it catches |
|---|---|---|
| **Loading** | a spinner, skeleton or "Loading…" | a spinner that never appears, or never leaves — the second is a real, common, invisible bug |
| **Success** | the data | the mapping from response to rendering: wrong field, wrong order, missing key |
| **Empty** | "No orders yet", not an empty box | the case where `[]` renders as a blank region users read as broken |
| **Error** | a message and a way to recover | the case where a failed request renders nothing, or renders "Loading…" forever |

**Empty and error are where the bugs are**, precisely because they are the states you never
saw during development. They cost one extra MSW handler each
([topic 06](../06-mocking-the-api.md)), which is the entire argument for mocking at the
transport layer rather than stubbing a module: switching a test from success to failure is
a one-line change to the response, not a rewrite of the mocking.

## The shape of the file

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";       // MSW, started in setup
import OrdersPage from "./OrdersPage";

describe("OrdersPage", () => {
  it("shows the orders once they load", async () => {
    render(<OrdersPage />);

    // The loading state is an assertion, not a step to skip past.
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    expect(await screen.findByRole("row", { name: /A-1001/ })).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it("tells the user when there is nothing to show", async () => {
    server.use(http.get("/api/orders", () => HttpResponse.json([])));

    render(<OrdersPage />);

    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
  });

  it("recovers from a failed request", async () => {
    server.use(http.get("/api/orders", () => new HttpResponse(null, { status: 500 })));

    render(<OrdersPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);

    // Now let it succeed, and prove the retry actually re-fetches.
    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByRole("row", { name: /A-1001/ })).toBeInTheDocument();
  });

  it("filters the list as the user types", async () => {
    render(<OrdersPage />);
    await screen.findByRole("row", { name: /A-1001/ });

    await userEvent.type(screen.getByRole("searchbox", { name: /search orders/i }), "1002");

    expect(screen.getByRole("row", { name: /A-1002/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /A-1001/ })).not.toBeInTheDocument();
  });
});
```

Four tests, and not one of them mentions a state variable, a hook, a handler name or a
class. Every query is by role and accessible name
([topic 03](../03-the-query-families/README.md)); every interaction goes through `user-event`
([topic 04](../04-user-event-over-fireevent/README.md)); every wait is a `findBy*`
([topic 05](../05-async-testing-and-act.md)). Rename everything inside `OrdersPage` and
this file stays green.

## Four details in there worth naming

**`getByText` for loading, `findByRole` for the data.** The loading state is present
synchronously on the first render, so `getBy*` is correct and asserts it was there. The
rows arrive later, so `findBy*` — which retries — is correct. Using `findBy*` for the
loading state would still pass, but would no longer prove the spinner appeared *first*.

**`queryBy*` is used only for absence.** `expect(screen.queryByText(/loading/i))
.not.toBeInTheDocument()` is the one job `queryBy*` exists for; `getBy*` throws before the
assertion can run, and the failure message would be about a missing element rather than an
unexpected one.

**The retry test asserts on the *consequence*, not on the fetch.** It would be easy to spy
on `fetch` and assert it was called twice. That test passes if the second response is
ignored and nothing re-renders. Asserting that the row now appears proves the whole path.

**The error test asserts through `role="alert"`.** That is both the accessible way to
announce an error and a stable query. A test that is easy to write by role is usually
sitting on top of markup that a screen reader can also announce —
[topic 11](../11-roles-as-the-query-surface.md) makes that argument properly.

## Regression tests: the one test that is always worth writing

**Every bug fix gets a test, and the test is written before the fix.** Not for coverage —
for two specific reasons:

1. **It proves the diagnosis.** A test that fails for the reported reason means you found
   the actual cause. A test that passes before you have fixed anything means you did not.
2. **It is a real user-visible case, by construction.** Someone hit it. There is no
   argument to have about whether the behaviour matters.

Regression tests also age well: they describe a specific, once-observed failure, so when
one goes red years later it is telling you something concrete.

## What a feature's suite looks like when it is done

For the orders page above: the four states, the search interaction, and one regression
test per bug ever fixed there. That is six to eight tests, all fast, none touching
internals — and it is *enough*. The instinct to add "one per prop, one per branch" is what
[chunk 02](02-what-earns-a-test.md) warns about; the instinct to stop at the success case
is what this chunk warns about. The target is between them, and it is smaller than most
people expect.

## Gotchas

**Symptom:** the suite is green, and users report a spinner that never goes away.
**Cause:** only the success path is tested, and the assertion is `findByText(/A-1001/)` —
which passes whether or not the loading indicator was ever removed.
**Fix:** assert the loading state's *disappearance* explicitly, with `queryBy*` after the
data arrives, or `waitForElementToBeRemoved`
([topic 05](../05-async-testing-and-act.md)).

**Symptom:** the error-state test passes even when the error UI is broken.
**Cause:** the test asserts that the success content is absent — which is also true while
loading, and while crashed.
**Fix:** assert on the presence of the error message itself, by `role="alert"` or its
text. Absence of one thing is not presence of another.

**Symptom:** a retry test asserts `fetch` was called twice and passes, yet retry does
nothing in the browser.
**Cause:** the assertion is on the request, not on the render that should follow it.
**Fix:** assert the new data is on screen. The request is an implementation detail of
"the list refreshed".

**Symptom:** a bug is fixed, the fix is committed, and the same bug returns two months
later.
**Cause:** no regression test — or one written after the fix and never seen to fail.
**Fix:** write the test first and watch it fail for the reported reason, then fix.

## Interview questions

**★ Which states does a data-fetching component need tested?**
Four: loading, success, empty and error. Most suites test only success, because that is
the state you develop against. Empty and error are where the bugs live, and with the
network mocked at the transport layer each costs one extra handler.

**★ Why `getBy*` for the loading state but `findBy*` for the loaded rows?**
`getBy*` throws immediately if the element is missing, which is exactly right for
something that must be present on the first render — it proves the spinner appeared.
`findBy*` returns a promise and retries, which is what asynchronously-arriving content
needs. Using `findBy*` for both would still pass and would stop proving the ordering.

**★ When do you use `queryBy*`?**
Only to assert that something is *not* there. It returns `null` instead of throwing, so
the assertion can run; `getBy*` would throw first and report a missing element rather than
an unexpected one.

**★ Why is asserting "fetch was called twice" a weak test of a retry button?**
Because it stops at the request. It passes if the response is discarded, if the state is
never updated, or if nothing re-renders — all of which are broken retries from the user's
point of view. Assert that the refreshed data is on screen instead.

**Why write the regression test before the fix?**
Because a test that fails for the reported reason confirms you found the real cause, and
one that passes before you changed anything proves you have not. It also guarantees the
test describes a genuine user-visible failure, since someone actually hit it.

**How many tests should one feature have?**
Fewer than most people write. For a fetch-plus-filter page: the four states, the
interaction, and one per bug ever fixed there. Duplicated coverage at several levels costs
maintenance and produces six red tests for one cause.

---

← Prev: [What earns a test](02-what-earns-a-test.md) ·
Index: [What to test, and what not to](README.md) ·
Next → [React Testing Library's model](../02-the-rtl-model/README.md)
