---
title: "10 · Forms, authentication and security hardening"
sidebar_label: "Overview"
sidebar_position: 0
description: "Every mutation in an App Router application is a POST endpoint anyone can call, and every page in this chapter follows from taking that literally."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js
> [Authentication guide](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`),
> [Data security](https://nextjs.org/docs/app/guides/data-security) (`2026-08-25`),
> [Server Actions](https://nextjs.org/docs/app/guides/server-actions) (`2026-06-17`),
> [Forms](https://nextjs.org/docs/app/guides/forms) (`2026-08-25`),
> [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`2026-08-25`),
> [`forbidden`](https://nextjs.org/docs/app/api-reference/functions/forbidden) (`2026-07-24`),
> [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`2026-06-09`) and
> [`serverActions`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) (`2026-06-25`);
> the React 19 references for `<form>` and the taint APIs; the GitHub Advisory record for
> **CVE-2025-55182** (GHSA-fv66-9v8q-g76r) and React's own 2025-12-03 disclosure post; and the
> published docs for **Auth.js 5.0.0-beta.32**, **@clerk/nextjs 7.9.1**,
> **@supabase/supabase-js 2.115.0**, **jose 6.2.11**, **react-hook-form 7.87.0**,
> **@hookform/resolvers 5.9.1**, **bcrypt 6.0.0** and **zod 4.4.3**.
> Target: **Next.js 16.3.4**, **React 19.2.8**, App Router. Documentation-verified; **no sandbox run**.

**One sentence from the documentation generates this entire chapter:** *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI."* Every convenience the App Router offers for mutations — a function you call from a component, a form that submits without a fetch, a hook that hands you pending state — is a public HTTP endpoint underneath. The framework will not stop anyone from calling it, and it says so.

Take that literally and the chapter falls out of it. If the endpoint is public, the authorization check cannot live in the component that renders the button — *"Render-time gating … is not a security boundary."* If the caller controls the payload, validation is a gate rather than a form nicety, and the client-side copy is a convenience. If the response is serialised back, what you return is disclosure. And if the proxy runs before the router knows which data the page will read, it can filter but it cannot authorize.

Three facts to carry into every page:

- 🔴 **A layout is not a boundary.** *"Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload."* The SPA habit of returning `null` from a layout is documented as **not recommended**, because there are multiple entry points.
- 🔴 **A Proxy matcher change can silently remove coverage from a Server Function.** *"Server Functions are not separate routes in this chain. They are handled as POST requests to the route where they are used, so a Proxy matcher that excludes a path will also skip Server Function calls on that path."* The conclusion the docs draw themselves: verify inside each function rather than relying on the proxy.
- 🔴 **The check belongs at the innermost layer that can see the fact it depends on.** *"The majority of security checks should be performed as close as possible to your data source."* That is why the Data Access Layer, not the route and not the proxy, is the spine of this chapter.

## Chunks

### 01 · Server Actions as an untrusted entry point

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Server Actions: where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md)** | Why the check cannot live in the component that renders the trigger |
| 2 | **[Mutation shape and failure posture](01b-mutation-shape-and-failure-posture.md)** | What an error may say to the user, and what belongs only in the log |
| 3 | **[What crosses the wire](01c-what-crosses-the-wire-modules-and-closures.md)** | A `'use server'` module exports endpoints; closed-over values ride along |
| 4 | **[Return values, DTOs and tainting](01d-return-values-dtos-and-tainting.md)** | Constraining what comes back, and why tainting is a backstop not a control |
| 5 | **[The request envelope](01e-the-request-envelope-csrf-size-rate-limits-and-idempotency.md)** | The Origin check, the 1MB cap, rate limiting and idempotent retries |

### 02 · Boundary validation

| # | Chunk | Covers |
|---|---|---|
| 6 | **[The schema as a trust boundary](02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md)** | One schema, two consumers — and which of the two is the gate |
| 7 | **[FormData is all strings](02b-formdata-is-all-strings-coercion-at-the-boundary.md)** | Coercion in the schema, and the `null` → `"null"` trap |
| 8 | **[Field errors the form can render](02c-field-errors-in-a-shape-the-form-can-render.md)** | Returning errors in a shape the UI can consume, without a store |
| 9 | **[React Hook Form and the resolver](02d-react-hook-form-and-the-resolver.md)** | What it buys, what it costs, and what its docs do not claim |
| 10 | **[File inputs](02e-file-inputs-and-the-checks-that-must-be-server-side.md)** | Size and type checks that only count on the server |

### 03 · Authentication patterns

| # | Chunk | Covers |
|---|---|---|
| 11 | **[Sessions: the cookie is the control](03-authentication-patterns-authjs-clerk-supabase-jwt-strategies.md)** | Cookie attributes as the actual mechanism, and why `cookies()` cannot be set mid-render |
| 12 | **[The Data Access Layer](03b-the-data-access-layer-server-only-and-the-dto.md)** | `server-only`, the DTO, and binding the check to the data rather than the path |
| 13 | **[Stateless vs stateful sessions](03c-stateless-vs-stateful-sessions-the-revocation-question.md)** | The fork in the road, settled by "can we log this user out right now" |
| 14 | **[Verifying a token, correctly](03d-verifying-a-token-alg-none-and-algorithm-confusion.md)** | `alg: none`, algorithm confusion, and what RFC 8725 actually says |
| 15 | **[Auth.js (NextAuth) in App Router](03e-authjs-nextauth-in-the-app-router.md)** | The config, the handler, the callbacks, and the two session strategies |
| 16 | **[Clerk and Supabase](03f-clerk-and-supabase-the-hosted-identity-trade.md)** | What moves off your infrastructure, and what each changes architecturally |
| 17 | **[Authorization: ownership checks](03g-authorization-ownership-checks-and-every-entry-point.md)** | Authentication says who; every read and write still needs ownership |
| 18 | **[The trust boundary around an action](03h-the-trust-boundary-around-a-server-action.md)** | The same boundary drawn around the caller's identity |
| 19 | **[CSRF, origins and the audit](03i-csrf-the-origin-check-and-the-audit.md)** | The Origin check, `allowedOrigins`, and the checklist to run on a codebase |

### 04 · Defence in depth

| # | Chunk | Covers |
|---|---|---|
| 20 | **[`proxy.ts` as a coarse filter](04-defense-in-depth-proxyts-as-a-coarse-filter.md)** | The optimistic redirect as UX, and the `includes()` bug in the documented snippet |
| 21 | **[Matchers, runtime and the rename](04b-proxy-configuration-matchers-runtime-and-what-the-rename-meant.md)** | What the Proxy rename changed, and why `runtime` now throws there |
| 22 | **[The innermost layer that can see the fact](04c-defence-in-depth-the-innermost-layer-that-can-see-the-fact.md)** | Which layer can enforce which control, and why that decides placement |
| 23 | **[The three places the gate cannot hold](04d-the-three-places-the-gate-cannot-hold.md)** | Static routes, Server Functions under a matcher, and the route added later |

### 05 · RSC serialization hardening

| # | Chunk | Covers |
|---|---|---|
| 24 | **[RSC serialization: the mechanism](05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md)** | What the payload carries, and what React2Shell actually taught |
| 25 | **[Projection at the boundary](05b-what-an-application-author-still-owns.md)** | The DTO you write by hand, and why the taint APIs are not it |
| 26 | **[The Server Function's serialization surface](05c-the-server-functions-own-serialization-surface.md)** | Endpoint IDs, closures and the encryption key a fleet must share |

### 06 · Project milestone — SprintDesk gets an identity

| # | Chunk | Covers |
|---|---|---|
| 27 | **[Milestone: the two decisions](06-project-milestone-sprintdesk-auth-authjs.md)** | Provider and session strategy, decided before any code |
| 28 | **[Wiring Auth.js](06b-milestone-wiring-authjs-into-the-app-router.md)** | The config module, the route handler and the `auth()` helper |
| 29 | **[The environment](06c-milestone-the-environment.md)** | `AUTH_SECRET`, `trustHost`, and what breaks per deployment target |
| 30 | **[The Data Access Layer](06d-milestone-the-data-access-layer.md)** | One `server-only` module, the sole session reader, returning a DTO |
| 31 | **[The layout is not a boundary](06e-milestone-the-layout-is-not-a-boundary.md)** | Why the obvious place to put the guard is the wrong one |
| 32 | **[Authorization on reads](06f-milestone-authorization-on-the-board.md)** | Membership on every board read, bound to the data |
| 33 | **[Hide, do not forbid](06g-milestone-hide-do-not-forbid.md)** | `notFound()` over `forbidden()`, and the status code streaming already spent |
| 34 | **[Authorization on writes](06h-milestone-authorization-on-writes.md)** | Re-verifying inside every action, because the page check does not reach it |
| 35 | **[Sign-in as a form](06i-milestone-sign-in-as-a-form.md)** | The action, the field errors, the redirect |
| 36 | **[What sign-in gives away](06j-milestone-what-a-sign-in-endpoint-gives-away.md)** | Enumeration, timing, and making both branches do the same work |
| 37 | **[Sign-out and the caches](06k-milestone-sign-out-and-the-caches.md)** | What must be invalidated, and what the docs leave unspecified |
| 38 | **[Proxy as UX, not control](06l-milestone-proxy-as-ux-not-control.md)** | The fast redirect, and the sentence that says it is not the boundary |
| 39 | **[Cost and generalisation](06m-milestone-what-it-costs-and-generalises.md)** | What this design costs, and the same shape on a different app |

### Hardening the delivered application

| # | Chunk | Covers |
|---|---|---|
| 40 | **[CSP: nonces and the dynamic-rendering tax](10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md)** | What a nonce costs you in rendering strategy |
| 41 | **[CSP without nonces: SRI and static headers](11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md)** | The static-header route, and third-party scripts |
| 42 | **[Auth with Cache Components: the session read](12-authentication-with-cache-components-reading-the-session.md)** | Which directives may see a cookie, and which may not |
| 43 | **[Auth with Cache Components: sharing and caching](13-authentication-with-cache-components-sharing-caching-and-mutating.md)** | Caching per-user data without serving it to the wrong user |
| 44 | **[The 2026 CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md)** | Eleven vulnerabilities, and the lesson each one carries |
| 45 | **[The patching habit](15-the-patching-habit-scheduled-security-releases-and-lts.md)** | Scheduled security releases, LTS, and staying current on purpose |

---

[Chapter 9 · Styling and UI](../09-styling-and-ui/01-explanation.md) · Next → [01 · Server Actions: where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md)
