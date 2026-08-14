---
title: "Mocking the API with MSW"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MSW 2.x**, from documentation —
> [Getting started](https://mswjs.io/docs/getting-started),
> [`setupServer`](https://mswjs.io/docs/api/setup-server) and
> [`listen()`](https://mswjs.io/docs/api/setup-server/listen).
> No sandbox script backs this topic; claims are cited, not measured.

**Where you mock decides what your test can prove.** Stub the module that fetches, and you
have assumed the component calls it correctly — the one thing most worth checking. Intercept
the network, and the component builds a real request, which either has the right URL, method
and body or does not.

MSW takes the second position. Its handlers are described as *"functions responsible for
intercepting requests and handling their responses"*, and because interception happens at
the network layer the same mocks *"reuse the same mocks across different tools and
environments"* — one definition serving unit tests, the browser during development, and
end-to-end runs.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Why the network is the right seam](01-the-right-seam.md)** | Module mocks vs `fetch` stubs vs network interception, what each can and cannot catch, and the tests each one makes possible |
| 02 | **[Handlers, lifecycle and the states that matter](02-handlers-and-lifecycle.md)** | `http` + `HttpResponse`, `setupServer`, the `listen`/`resetHandlers`/`close` cycle, `server.use()` overrides, `onUnhandledRequest`, and testing loading, error and empty states |

## Why this is two files

The first is the argument — it decides how you will test every data-driven component you
ever write, and it is the part people get wrong for years. The second is the mechanics you
copy into a project once and rarely revisit. Different half-lives, different reading.

## Where this connects

- **[Topic 01 · What to test](../01-what-to-test/README.md)** — the loading, error and empty
  states are named there as cases that earn a test; this is how you produce them.
- **[Topic 05 · Async testing](../05-async-testing-and-act/README.md)** — a mocked response
  is what all those waits are waiting for, and an unmocked one is a leading cause of `act`
  warnings after teardown.
- **[Topic 08 · Testing forms and Actions](../08-testing-forms-and-actions.md)** — asserting
  on the submitted payload is a request assertion, which only network-level mocking gives you.
- **[Topic 14 · Flaky tests and CI](../14-flaky-tests-and-ci.md)** — an un-reset handler is
  a classic source of order-dependent failures.

---

← Prev: [Async testing and what `act()` means](../05-async-testing-and-act/README.md) ·
Index: [Phase 14](../README.md) ·
Next → [Why the network is the right seam](01-the-right-seam.md)
