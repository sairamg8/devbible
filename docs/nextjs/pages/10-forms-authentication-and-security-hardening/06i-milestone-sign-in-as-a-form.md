---
title: "Sign-in has to be a form and not a link, because the whole point of signing in is to set a cookie and a cookie cannot be set while a Server Component renders"
sidebar_label: "06i · Milestone: sign-in as a form"
sidebar_position: 167
description: "Chapter 10's capstone, step eight: why sign-in must be a POST, the sign-in page, the email form with zod field errors surfaced through useActionState, the Server Action that calls signIn, the OAuth button as a second form, and why unstable_rethrow is the first line of every catch near a redirect."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies)
> reference (`lastUpdated: 2026-06-09`), the [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
> (`lastUpdated: 2026-08-25`), the [Data Security guide](https://nextjs.org/docs/app/guides/data-security)
> (`lastUpdated: 2026-08-25`), [Auth.js sign-in and sign-out](https://authjs.dev/getting-started/session-management/login)
> and [`unstable_rethrow`](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow).
> Target: **Next.js 16.3.4** · React 19.2.8 · **`next-auth` 5.0.0-beta.32** · zod 4.4.3.
> Documentation-verified; **no sandbox run**.

**Sign-in is a `<form>` for a mechanical reason, not a stylistic one: the whole point of signing in is to set a cookie, and a cookie cannot be set while a Server Component renders.** That one constraint rules out a link, rules out a render-time side effect, and makes the sign-in page a Server Component wrapping two forms — one for the magic link with a validated field, one for OAuth. The happy path is genuinely short, because `signIn()` is one call. The part that catches people is that `signIn()` finishes by *throwing*, so the `try/catch` you added for a mail-provider timeout silently eats the successful sign-in and produces a form that appears to do nothing. What the endpoint gives away to an attacker — existence, redirects, sending capacity — is the sibling page, [06j](06j-milestone-what-a-sign-in-endpoint-gives-away.md).

## Why it is a form

> *"Setting cookies is not supported during Server Component rendering."*
>
> *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."*
> — [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`)

That is the entire argument, and it settles a class of designs before they are proposed. A `<Link href="/sign-in?do=it">` cannot sign anyone in. A Server Component that "logs the user in when it renders" cannot write the cookie. The Data Security guide reaches the same conclusion from the other direction, that mutations should never be a side effect of rendering, and notes that Next.js explicitly prevents setting cookies or triggering cache revalidation within render methods to avoid unintended side effects.

Auth.js's own Next.js example is therefore a form wrapping a Server Action, and SprintDesk's is the same shape with validation and error state added.

## The page

The page is a Server Component; the form beneath it is a Client Component because it needs `useActionState`.

```tsx filename="app/sign-in/page.tsx"
import { getCurrentUser } from '@/lib/dal/user'
import { redirect } from 'next/navigation'
import { safeRedirectTarget } from '@/lib/auth-redirect'
import { EmailSignInForm } from './email-sign-in-form'
import { GitHubButton } from './github-button'

export default async function SignInPage(props: PageProps<'/sign-in'>) {
  const { next } = await props.searchParams
  const redirectTo = safeRedirectTarget(next)

  // Already signed in? Do not show a sign-in form; go where they were going.
  if (await getCurrentUser()) {
    redirect(redirectTo)
  }

  return (
    <main className="sign-in">
      <h1>Sign in to SprintDesk</h1>
      <GitHubButton redirectTo={redirectTo} />
      <p className="divider">or</p>
      <EmailSignInForm redirectTo={redirectTo} />
    </main>
  )
}
```

## The email form and its action

```tsx filename="app/sign-in/email-sign-in-form.tsx"
'use client'

import { useActionState } from 'react'
import { requestMagicLink, type SignInState } from './actions'

const initialState: SignInState = {}

export function EmailSignInForm({ redirectTo }: { redirectTo: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialState)

  return (
    <form action={action}>
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <label htmlFor="email">Work email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-describedby={state.errors?.email ? 'email-error' : undefined}
        aria-invalid={state.errors?.email ? true : undefined}
      />
      {state.errors?.email && (
        <p id="email-error" role="alert">
          {state.errors.email[0]}
        </p>
      )}

      <button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>

      {state.message && <p role="status">{state.message}</p>}
    </form>
  )
}
```

The `useActionState` mechanics — the reducer signature, what happens to `pending` across queued submissions, why `state` is the first parameter — are chapter 8's, across nineteen pages: start at [06 · `useOptimistic` and `useActionState`](../08-state-management-in-an-rsc-world/06-useoptimistic-and-useactionstate-as-framework-native-alterna.md) and [06f · pending feedback and `useFormStatus`](../08-state-management-in-an-rsc-world/06f-pending-feedback-and-useformstatus.md). What is auth-specific is everything in the action:

```ts filename="app/sign-in/actions.ts"
'use server'

import { z } from 'zod'
import { unstable_rethrow } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { safeRedirectTarget } from '@/lib/auth-redirect'
import { allowMagicLink } from '@/lib/dal/rate-limit'

export type SignInState = {
  errors?: { email?: string[] }
  message?: string
}

const schema = z.object({
  email: z.email({ error: 'Enter a valid email address.' }).trim().toLowerCase(),
})

export async function requestMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const redirectTo = safeRedirectTarget(String(formData.get('redirectTo') ?? ''))

  // Sending email is expensive and abusable. Gate it before we send.
  if (!(await allowMagicLink(parsed.data.email))) {
    // Same message as success. An attacker learns nothing from the difference.
    return { message: 'If that address has an account, a sign-in link is on its way.' }
  }

  try {
    await signIn('resend', {
      email: parsed.data.email,
      redirectTo,
    })
  } catch (error) {
    // signIn() completes by redirecting, which throws. Let that through.
    unstable_rethrow(error)
    // Anything else: one generic message, never the provider's error text.
    return { message: 'If that address has an account, a sign-in link is on its way.' }
  }

  return { message: 'If that address has an account, a sign-in link is on its way.' }
}
```

### Four things in that action, each load-bearing

**`unstable_rethrow(error)` is the first line of the catch.** `signIn()` finishes by redirecting, and `redirect()` works by throwing. A `try/catch` written to handle a mail-provider failure will otherwise swallow the successful sign-in, and the symptom is a form that appears to do nothing at all on the happy path. The rule generalises to every `catch` in this codebase: control-flow interrupts go through first.

**The success message and the failure message are identical.** This is not laziness; it is the whole of the account-enumeration defence, and [06j](06j-milestone-what-a-sign-in-endpoint-gives-away.md) makes the argument in full. Say the same sentence in both branches, and make it a sentence that is true in both.

**`redirectTo` is re-validated inside the action**, even though the page already validated it before putting it in the hidden field. Hidden fields are not hidden — a Server Action is a POST endpoint and its body is whatever the caller sends. Validating in the page is UX; validating in the action is the control. `safeRedirectTarget` itself is in [06j](06j-milestone-what-a-sign-in-endpoint-gives-away.md).

**The rate limit runs before the send, keyed on the address.** An un-limited magic-link endpoint is an email cannon: any address, any number of times, from your domain. `allowMagicLink` and the documentation that asks for it are in [06j](06j-milestone-what-a-sign-in-endpoint-gives-away.md).

## The OAuth button, which is also a form

```tsx filename="app/sign-in/github-button.tsx"
import { signIn } from '@/lib/auth'
import { safeRedirectTarget } from '@/lib/auth-redirect'

export function GitHubButton({ redirectTo }: { redirectTo: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        'use server'
        await signIn('github', {
          redirectTo: safeRedirectTarget(String(formData.get('redirectTo') ?? '')),
        })
      }}
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button type="submit">Continue with GitHub</button>
    </form>
  )
}
```

No `try/catch` here at all — there is nothing to recover from in the browser, and swallowing the redirect would break it. The `redirectTo` option is Auth.js's documented way to send the user somewhere specific after authenticating; SprintDesk passes it through the same validator on the way in.

⚠️ **This is a form and not a `<button onClick>`.** A click handler would need a Client Component, which would want to import `signIn` from `@/lib/auth` — the exact import that [06b](06b-milestone-wiring-authjs-into-the-app-router.md)'s `import 'server-only'` turns into a build error, because that module holds the OAuth client secret. The inline Server Action keeps the secret on the server and the button progressively enhanced.

## Gotchas

**★ Symptom: the sign-in form appears to do nothing — no error, no navigation, no email.** Cause: a `try/catch` around `signIn()` swallowed the redirect it throws to complete. Fix: `unstable_rethrow` as the first statement of the catch, before any of your own handling.

```ts
catch (error) {
  unstable_rethrow(error)
  return { message: 'If that address has an account, a sign-in link is on its way.' }
}
```

**★ Symptom: signing in works, then the user lands on `/boards` instead of the page they were trying to reach.** Cause: the `next` parameter was never plumbed through — either the proxy redirect did not add it, or the form did not carry it. Fix: the proxy sets it on the way out (that is [06l](06l-milestone-proxy-as-ux-not-control.md)), the page validates it, the hidden field carries it, and the action validates it again before passing it to `signIn`.

**★ Symptom: a signed-in user visiting `/sign-in` sees a sign-in form.** Cause: no check on the page. It is a small thing, but it is also how people end up with two sessions in two tabs and a confusing bug report. Fix: the `if (await getCurrentUser()) redirect(redirectTo)` at the top of the page, which costs one DAL call that is already memoised.

**★ Symptom: the OAuth button is a Client Component and the build fails on an import of `@/lib/auth`.** Cause: `signIn` lives in a `server-only` module because that module also holds the OAuth client secret. Fix: keep the button a Server Component wrapping a form with an inline Server Action, as above. If you need client-side behaviour on the button — a spinner, say — that belongs in a small Client Component *inside* the form using `useFormStatus`, not around it.

**★ Symptom: field errors show for a moment and then vanish when the user types.** Cause: nothing in this action; that is `useActionState` semantics — the state is replaced on the next submission, not on input. Fix: if you want per-keystroke validation, that is React Hook Form's job on the client with the *same zod schema*, and the server action keeps its own parse regardless. Sharing one schema across both is this chapter's [02 · The schema as a trust boundary](02-boundary-validation-react-hook-form-zod-schemas-shared-acros.md).

**★ Symptom: a magic link works twice, or works after the user thought it had expired.** Cause: assumptions about verification-token lifecycle that the application does not control — the token lives in the `VerificationToken` table and its handling belongs to Auth.js and the adapter. I did not find documentation stating single-use or expiry semantics precisely enough to assert them here, so treat them as **unverified** and confirm against your adapter's behaviour before designing a feature on top of them. What you *can* control is the blast radius: keep the post-sign-in `redirectTo` same-origin, so a leaked link cannot be steered anywhere useful.

**★ Symptom: the form's `pending` state never appears, so the button can be double-clicked into two submissions.** Cause: `pending` came from somewhere other than `useActionState`'s third return value, or the button is outside the `<form>` it submits. Fix: take `pending` from the hook as in `EmailSignInForm` above and disable on it. The hook's exact semantics under queued submissions — and why `useFormStatus` is the right tool when the button is a separate component — are chapter 8's, at [06f · pending feedback and `useFormStatus`](../08-state-management-in-an-rsc-world/06f-pending-feedback-and-useformstatus.md).

**★ Symptom: the sign-in page renders nothing useful with JavaScript disabled or before hydration.** Cause: the form was built around an `onClick` handler rather than a `<form action={…}>`. Fix: both forms on this page are real forms wrapping Server Actions, so a submission works without client JavaScript at all. That is worth more on a sign-in page than anywhere else in the product — it is the first page a new user loads, often on a bad connection.

## Interview questions

**★ Why must sign-in be a form submission rather than a link or a render-time side effect?**
Because signing in means setting a cookie, and the `cookies` reference states that setting cookies is not supported during Server Component rendering, and that because HTTP does not allow setting cookies after streaming starts you must use `.set` in a Server Function or Route Handler. So the write has to happen in a POST. The Data Security guide arrives at the same place from the design side — mutations should not be side effects of rendering, and Next.js explicitly prevents cookie writes and revalidation inside render methods. A form is not the convention here; it is the only mechanism.

**★ A `try/catch` around `signIn()` breaks sign-in entirely. Why?**
Because `signIn()` completes by redirecting, and `redirect()` signals that by throwing a control-flow exception. A catch block written for a mail-provider timeout intercepts it, the redirect never happens, and the action returns normally — so the form submits, the server does the right thing, and the browser stays exactly where it was. `unstable_rethrow` at the top of the catch lets framework interrupts through and leaves genuine errors for you to handle. Any catch block in a Server Action should be assumed to have this bug until that line is present.

**★ Why is the "Continue with GitHub" button a form with an inline Server Action rather than a Client Component with an `onClick`?**
Because `signIn` is exported from a module that also holds the OAuth client secret, and that module carries `import 'server-only'` — so a Client Component importing it is a build error rather than a shipped secret. Wrapping a real `<form>` around a Server Action keeps the call on the server, and it also means the button works before hydration, which matters more on a sign-in page than almost anywhere else: it is the first page a new user loads, on whatever connection they have. Client-side flourishes go *inside* the form via `useFormStatus`.

**★ The chapter's validation topic owns zod and React Hook Form. What is left for the sign-in action to do?**
Everything that is not shape. The action still parses with the schema — client validation is a convenience and the action is a public endpoint — but the interesting work is what happens after the parse succeeds: deriving `redirectTo` safely, gating an expensive send, choosing a response that reveals nothing, and letting the framework's redirect through the error handling. A useful way to put it in review: zod decides whether the request is *well-formed*; this action decides what the application is willing to *do* about a well-formed request, and those are never the same question.

**★ Why does the form carry `redirectTo` in a hidden input rather than reading `searchParams` inside the action?**
Because a Server Action does not have the page's `searchParams`. It is a POST to an action id, not a render of the route, so anything the action needs from the URL has to be carried in the request body — which is exactly why the value has to be re-validated on arrival. The hidden field is a transport mechanism with no trust attached to it, and treating it as anything else is the mistake the next page is about.

---

← [06h · Authorization on writes](06h-milestone-authorization-on-writes.md) · [Chapter 10 overview](01-explanation.md) · Next → [06j · What a sign-in endpoint gives away](06j-milestone-what-a-sign-in-endpoint-gives-away.md)
