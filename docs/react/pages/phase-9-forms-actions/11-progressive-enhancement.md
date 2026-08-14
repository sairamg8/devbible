---
title: "Progressive enhancement"
sidebar_label: "11 · Progressive enhancement"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<form>`](https://react.dev/reference/react-dom/components/form) (the
> progressive-enhancement note),
> [`useActionState`](https://react.dev/reference/react/useActionState) (the `permalink`
> parameter and its caveat), and MDN
> [Constraint validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation).
> Where a recommendation is engineering judgement rather than documented, it says so.
> No sandbox script backs this page; claims are cited, not measured.

**A progressively enhanced form works before its JavaScript has run. The usual argument for
it — users who disable JavaScript — is the weak one. The strong one is that every user has
JavaScript disabled for the first few hundred milliseconds of every page load, and on a slow
connection that gap is where they are.**

## The conditions, exactly

> When `<form>` is rendered by a **Server Component**, and a **Server Function** is passed
> to the `<form>`'s `action` prop, the form is **progressively enhanced**. Passing a Server
> Function to `<form action>` allows users to **submit forms without JavaScript enabled or
> before the code has loaded.**

Both conditions, or you do not have it:

| Setup | Works before hydration? |
|---|---|
| Server Component + Server Function action | ✅ Yes |
| Client Component + a local function action | 🔴 No — there is nothing to call yet |
| Any component + a **string** `action` (a real URL) | ✅ Yes — plain HTML |
| `onSubmit` handler | 🔴 No |

The third row is worth noticing: **the platform has always had this.** A form with a URL
`action` and `method="post"` submits without any JavaScript at all. React's contribution is
letting you keep the same behaviour *while* getting the client-side experience once
hydration completes — not inventing the capability.

## Why "before the code has loaded" is the real argument

⚠️ **Judgement, though it follows from the documented behaviour.**

The share of users who deliberately disable JavaScript is small. The share who interact with
a page during the interval between HTML arriving and the bundle executing is **everyone**,
at least sometimes — on a slow connection, a cold cache, a poor mobile network, or a device
throttled by whatever else it is doing.

In that window a non-enhanced form is **visible and inert**. A user types, presses the
button, and nothing happens. They press again. When hydration completes, they may get two
submissions or none, and either way the interface lied about being ready. The enhanced form
just works, then upgrades silently.

That reframing matters because it changes who the feature is for: not an accessibility
checkbox for a minority, but a robustness property for everyone on a bad connection.

## What survives before hydration, and what does not

| Feature | Before hydration |
|---|---|
| Submitting the form | ✅ Yes — a full page POST |
| `required`, `pattern`, `type="email"`, `min`/`max` | ✅ Yes — constraint validation is the platform's ([topic 04](04-validation.md)) |
| `formAction` on a button | ✅ Yes — it is an HTML attribute ([topic 08](08-multiple-actions.md)) |
| The server's validation and response | ✅ Yes — as a page render |
| `useActionState`'s returned state | ⚠️ Only via `permalink` |
| `isPending` / `useFormStatus` | 🔴 No — no JavaScript, no pending UI |
| `useOptimistic` | 🔴 No |
| Client-side validation you wrote in JS | 🔴 No |
| Avoiding a full page navigation | 🔴 No — it is a real form post |

The pattern: **anything the platform does survives; anything React does does not.** Which is
the strongest practical reason to use the platform's own validation attributes even when you
also validate in JavaScript — they are the only validation that exists in that window.

## `permalink`, and what it is actually solving

Before hydration, a submission is a real navigation — so the response has to be a page. That
is what `permalink` is for:

> **`permalink`**: A string containing the unique page URL that this form modifies. For use
> on pages with React Server Components with progressive enhancement. If the action is a
> **Server Function** and the form is submitted **before the JavaScript bundle loads**, the
> browser will **navigate to the specified permalink URL** rather than the current page's
> URL.

> When using the `permalink` option, ensure **the same form component is rendered on the
> destination page** (including the same action and permalink) so React knows how to pass
> the state through. **Once the page becomes interactive, this parameter has no effect.**

So it answers "where does the user land, and how do they see the result?" — and the answer
requires the destination to render the same form, so the returned state has somewhere to go.
Outside RSC with Server Functions it does nothing at all.

## What it costs

⚠️ **Judgement.** Progressive enhancement is not free, and the honest version says so:

- **It constrains your architecture.** Server Components and Server Functions are a
  commitment, and the feature does not exist without them. A client-rendered SPA cannot
  bolt it on.
- **The pre-hydration experience is a page navigation**, so there is no optimistic update,
  no in-place error, and no pending indicator. You are designing two experiences and one of
  them is worse.
- **Uncontrolled fields become close to mandatory.** Controlled inputs need JavaScript to
  hold their values, so a progressively enhanced form is an uncontrolled form
  ([topic 05](05-uncontrolled-and-formdata.md)) — which is a good default anyway, but it is
  now a constraint rather than a choice.
- **It must be tested with JavaScript off**, and almost nobody does. An untested
  enhancement path is an assumption, not a feature.

**When it is worth it:** anything that must work on poor connections, anything public and
high-traffic where the hydration gap is measurable, sign-up and checkout flows where a
dropped submission is lost revenue, and anything with a regulatory or accessibility
obligation. **When it is not:** an internal dashboard behind a login on a fast network,
where the cost is real and the benefit is theoretical.

## Building one

The shape, given the constraints above:

- **Uncontrolled fields with `name` attributes** — the whole form readable from `FormData`.
- **Platform validation attributes**, so something validates before hydration.
- **A Server Function action**, from a Server Component.
- **`useActionState` for the enhanced path**, with `permalink` for the unenhanced one.
- **Errors returned, not thrown** ([topic 10](10-errors-in-actions.md)) — a thrown error
  before hydration has no boundary to catch it in the way you expect.
- **Progressive, not conditional.** Do not branch on whether JavaScript is available; write
  one form that degrades, rather than two that diverge.

## Gotchas

**Symptom:** a form with a function `action` does nothing with JavaScript disabled.
**Cause:** progressive enhancement needs a Server Component **and** a Server Function. A
client-side function action has nothing to call before hydration.
**Fix:** both conditions, or accept it is client-only.

**Symptom:** the enhanced path works and the unenhanced one loses the result.
**Cause:** the submission is a real navigation and had nowhere to land.
**Fix:** `permalink`, with the same form component rendered at the destination.

**Symptom:** nothing validates before hydration.
**Cause:** all the validation is in JavaScript.
**Fix:** the platform's constraint-validation attributes, which cost nothing and are the
only ones that run in that window.

**Symptom:** users double-submit during page load.
**Cause:** the form is visible but inert, with no pending indicator possible.
**Fix:** progressive enhancement is the fix; if you cannot, disable the control until
hydration.

**Symptom:** it worked in development and not in production.
**Cause:** in development the bundle is local and the gap is invisible.
**Fix:** test with JavaScript disabled and with throttling. An untested path is an
assumption.

**Symptom:** controlled fields are empty after a pre-hydration submission.
**Cause:** their values lived in JavaScript state that never ran.
**Fix:** uncontrolled fields with `name` attributes.

## Interview questions

**★ What exactly does React require for a progressively enhanced form?**
Two things together: the `<form>` must be rendered by a **Server Component**, and a **Server
Function** must be passed to its `action`. Then it submits without JavaScript enabled or
before the code has loaded. A client component with a local function action gives you
neither, since there is nothing to call before hydration — though a plain string `action`
has always worked, because that is the platform's own behaviour.

**★ What is the real argument for it?**
Not users who disable JavaScript — that group is small. It is that *every* user has no
JavaScript for the first stretch of every page load, and on a slow connection that is where
they are. A non-enhanced form in that window is visible and inert: the user types, presses,
nothing happens, they press again, and after hydration they get two submissions or none.

**★ What works before hydration and what does not?**
Anything the platform does survives — submitting, constraint validation from attributes,
`formAction` on a button, the server's response as a page render. Anything React does does
not — `isPending`, `useFormStatus`, `useOptimistic`, and any validation you wrote in
JavaScript. That is the strongest reason to use the platform's validation attributes even
when you also validate in JS.

**★ What is `permalink` solving?**
Where a pre-hydration submission lands. Because it is a real navigation, the response has to
be a page — so `permalink` tells the browser which URL to go to, and the destination must
render the same form component with the same action and permalink so React can pass the
returned state through. Once the page is interactive the parameter has no effect.

**What does it cost?**
It constrains the architecture to Server Components and Server Functions, so a
client-rendered SPA cannot bolt it on. The unenhanced path is a page navigation with no
optimistic update, no in-place error and no pending indicator, so you are designing two
experiences and one is worse. Controlled inputs stop being viable. And it has to be tested
with JavaScript off, which almost nobody does — an untested enhancement path is an
assumption.

**When would you skip it?**
An internal dashboard behind a login on a fast network, where the cost is real and the
benefit theoretical. It earns its place on public high-traffic pages, sign-up and checkout
flows where a dropped submission is lost revenue, and anywhere with an accessibility or
regulatory obligation.

---

← Prev: [Errors in actions](10-errors-in-actions.md) ·
Index: [Phase 9](README.md) ·
Next → [Accessible forms](12-accessible-forms.md)
