---
title: "A Server Component is not 'a component that renders on the server' — it is code the browser never receives, which is what makes it a security boundary rather than only a performance one"
sidebar_label: "01 · Default architecture (RSC)"
sidebar_position: 1
description: "What a Server Component actually is: the default with no directive, why it can be async, the secrets argument that matters more than the bundle argument, what it cannot do, and how it differs from SSR."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (page header `version: 16.3.4`, `lastUpdated` 2026-08-25), via research banked for this track on 2026-09-04.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**"Server Component" sounds like it means "rendered on the server", and that reading loses the most important property. Server-side rendering has existed for a decade: the server produces HTML, then ships the component's JavaScript so the browser can hydrate it. A Server Component ships **no JavaScript at all** — the browser receives the rendered output and never receives the code. That distinction is why this is a security boundary and not merely a performance technique, and it is the difference most people miss when they conclude Server Components are "just SSR with extra steps".**

## The default requires no opt-in

> By default, layouts and pages are Server Components.

No directive, no configuration. Every component you write is a Server Component until something marks it otherwise.

```tsx
// app/products/page.tsx
export default async function ProductsPage() {
  const products = await db.product.findMany()   // direct data access
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>
}
```

Two things here are impossible in a traditional React application: the component is `async` and awaits a database call, and none of that database code — the client library, the credentials, the query — is ever sent to the browser.

## Why `async` works, and what it costs

A Server Component renders **once**, to completion, on the server. There is no re-render, no state, no lifecycle. That is exactly why it can be `async`: React never has to re-run it, so there is no question of what happens to an in-flight promise on the second render.

Everything a Server Component cannot do follows from the same fact:

| Cannot | Because |
|---|---|
| `useState`, `useReducer` | There is no re-render to deliver a new value to |
| `useEffect` | There is no mount, and no client to run it on |
| Event handlers | The code is never sent to the browser to attach them |
| Browser APIs | It does not run in a browser |
| React context | Not supported in Server Components at all |

🔴 **These are not restrictions imposed on Server Components; they are the same property described from different angles.** A component that renders once, on the server, and never ships cannot have any of them. Learning it that way means you never have to memorise the list.

## The argument that matters more than bundle size

Most explanations lead with "ships less JavaScript". The stronger argument is the one the docs make first:

> Use API keys, tokens, and other secrets without exposing them to the client.

**This is a security boundary by construction.** Not by discipline, not by remembering to keep secrets out of props — the component that touches the secret never becomes client code, so there is nothing to leak. Compare the traditional shape: an API route holds the secret, the client calls the route, and you must now design and defend that route as a public endpoint.

⚠️ **The protection is real and it is not automatic across the whole codebase.** A module imported by both a Server and a Client Component gets pulled into the client graph by the client import. Next.js blunts this — only `NEXT_PUBLIC_`-prefixed environment variables reach the client bundle — but the failure mode is nasty: unprefixed variables are replaced with **an empty string**, so code runs and fails as a 401 rather than erroring. [05 · Enforcing boundaries](05-enforcing-boundaries-with-server-only-client-only-packages.md) covers making this a build error instead.

## Server Component ≠ SSR

Worth separating explicitly, because the terms are used interchangeably and are not the same thing.

| | Traditional SSR | Server Component |
|---|---|---|
| Renders on the server | Yes | Yes |
| Component code sent to browser | **Yes** — needed for hydration | **No** |
| Can hold state | Yes, after hydration | No |
| Re-renders on the client | Yes | Never |
| Can hold secrets | No — the code ships | **Yes** |

**Both produce HTML from the server. Only one of them stops there.** A Client Component in the App Router is still server-rendered for its initial HTML — so "it appeared in the initial HTML" tells you nothing about whether a component is a Server Component.

## What actually reaches the browser

Server Components render into the **RSC Payload** — *"a compact, serialized representation of the rendered React Server Components tree"* — carrying the rendered result, placeholders and JS references for Client Components, and any props passed between them.

⚠️ **"Ships zero JavaScript" is precise and narrower than it sounds.** It means none of *that component's own code*. The framework runtime still ships, and any Client Component in the tree ships its own bundle. A page of pure Server Components adds nothing per component; it is not a page with no JavaScript on it.

🔴 **And props passed to Client Components are in the payload, which means they are visible to anyone who looks.** A Server Component that reads a secret safely and then passes it to a Client Component has leaked it — through the payload, not the bundle. Pass what the client needs to *render*, never what the server needed to *fetch*.

## Gotchas

**★ Symptom: a secret is "safe on the server" and appears in the browser's network tab.** Cause: it was passed as a prop to a Client Component. Props travel in the RSC payload, which is sent to the browser — the component being server-side protects the *code*, not the values it hands over the boundary. Fix: pass rendered results or non-sensitive fields, never the credential.

```tsx
// ❌ token is in the payload, readable in devtools
<Widget apiToken={process.env.API_KEY} />
// ✅ do the privileged work server-side; pass only what renders
const data = await fetchWithKey()
<Widget data={data} />
```

**★ Symptom: `useState` in a page throws, and it is not obvious why a "component" cannot have state.** Cause: Server Components render once with no re-render, so there is nowhere for a new state value to go. Fix: extract the stateful part into a Client Component. Understanding it as "renders once" rather than as an arbitrary rule also explains the absence of effects, handlers and context.

**★ Symptom: an unprefixed env var reads as `""` in the browser instead of failing.** Cause: Next.js replaces non-`NEXT_PUBLIC_` variables with an empty string in client code. Nothing throws; you get a 401 from an empty header. Fix: `import 'server-only'` in modules touching secrets — see [05](05-enforcing-boundaries-with-server-only-client-only-packages.md).

**★ Symptom: "this is just SSR" — and the team optimises the wrong thing.** Cause: conflating server-rendering with not shipping code. Both render HTML on the server; only Server Components withhold the component's JavaScript, which is what makes secrets safe and the bundle smaller. Fix: check whether the component's code appears in the client bundle; that is the operative difference, not whether HTML arrived.

**★ Symptom: a component is in the initial HTML, so someone concludes it is a Server Component.** Cause: Client Components are also server-rendered for their initial HTML in the App Router. Fix: presence in the HTML proves nothing. Look for the directive and for the module in the client bundle.

**Symptom: "zero JavaScript" is quoted to a stakeholder and the page still loads a bundle.** Cause: the claim is per-component, not per-page. The framework runtime ships regardless, and any Client Component brings its own. Fix: state it as "adds no JavaScript for itself" — accurate, and it survives the follow-up question.

**Symptom: an `async` component works, and the same pattern fails in a Client Component.** Cause: only Server Components can be `async`, because they render once. A Client Component re-renders, so an in-flight promise has no defined behaviour across renders. Fix: fetch on the server and pass data down, or use the `use` API on the client.

## Interview questions

**★ What is a Server Component, and how is it different from server-side rendering?**
Both render on the server and produce HTML, and that is where the similarity ends. With SSR, the component's JavaScript is still sent to the browser so React can hydrate it. A Server Component's code is never sent at all — the browser receives rendered output. That is why it is a security boundary rather than just a performance technique: a component holding an API key cannot leak it, because the code that touches it never becomes client code. A useful check is that a Client Component is also server-rendered for its initial HTML, so appearing in the HTML proves nothing about which kind it is.

**★ Why can a Server Component be `async` when a Client Component cannot?**
Because it renders exactly once, to completion, on the server — there is no re-render, so there is no question about what happens to an in-flight promise on a second pass. A Client Component re-renders, and an async component function has no defined behaviour across renders. The same "renders once" fact explains everything a Server Component cannot do: no `useState` because there is no re-render to deliver a value to, no `useEffect` because there is no mount, no event handlers because the code never reaches the browser, no context because it is unsupported there. It is one property viewed from several angles rather than a list to memorise.

**★ A Server Component reads a secret safely. Can that secret still leak?**
Yes — by passing it as a prop to a Client Component. Props cross the boundary inside the RSC payload, which is sent to the browser and readable in devtools. Being a Server Component protects the *code*, not the values you hand over. So the rule is to do the privileged work server-side and pass only what the client needs to render. The related trap is environment variables: unprefixed ones are replaced with an empty string in client code rather than being undefined, so nothing throws and you debug a 401 instead of reading an error.

**Is "Server Components ship zero JavaScript" accurate?**
Precise but narrower than people hear. It means none of that component's own code. The framework runtime still ships, and any Client Component in the tree brings its own bundle. A page built entirely from Server Components adds nothing per component, which is a strong claim, but it is not a page with no JavaScript. Stating it as "adds no JavaScript for itself" is the version that survives the follow-up question.

**Which components are Server Components by default?**
All of them. Layouts and pages are Server Components with no directive and no configuration, and everything you write stays one until something marks it otherwise. That is the inversion relative to the Pages Router, where the mental model was client-first — and it is why the burden of proof sits on the client boundary rather than on staying server-side.

---

← Prev [Overview: Server Components vs Client Components](01-explanation.md) · [Index](01-explanation.md) · Next → [02 · `'use client'`: when and why to opt in](02-use-client-when-and-why-to-opt-in-interactivity-browser-apis.md)
