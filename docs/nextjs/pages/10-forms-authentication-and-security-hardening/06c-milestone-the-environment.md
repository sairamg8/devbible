---
title: "Only the Data Access Layer touches process.env, which means the environment is parsed once at boot into a typed object — and the three variables that break production are the one you must copy, the one Vercel hides from you, and the one that is not an Auth.js variable at all"
sidebar_label: "06c · Milestone: the environment"
sidebar_position: 161
description: "Chapter 10's capstone, step two: the single server-only module that reads and validates process.env with zod, every environment variable SprintDesk needs with the deployment it belongs to, and why AUTH_SECRET, AUTH_TRUST_HOST and NEXT_SERVER_ACTIONS_ENCRYPTION_KEY are the three that actually bite."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Auth.js deployment / environment variables](https://authjs.dev/getting-started/deployment),
> the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`)
> and the Next.js [Authentication guide](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · **`next-auth` 5.0.0-beta.32** · zod 4.4.3.
> Documentation-verified; **no sandbox run**.

**Environment configuration is the part of an auth setup that has no type checker, no linter and no test, so it is where the failures that only happen in one deployment live.** Next.js's own guidance narrows the blast radius to one sentence — only the Data Access Layer should touch `process.env` — and SprintDesk takes that literally: one `server-only` module parses the whole environment through a zod schema at boot, and every other file, `lib/auth.ts` included, imports the parsed object. That turns a missing secret from a 3am OAuth error into a startup crash with a field name in it. Then there are three specific variables where the documented behaviour is surprising, and each of them produces a bug that looks like something else.

## The single reader of `process.env`

The Data Security guide's instruction is one sentence:

> *"Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`. This keeps secrets from being exposed to other parts of the application."*
> — [Data Security, Data Access Layer](https://nextjs.org/docs/app/guides/data-security#data-access-layer) (`lastUpdated: 2026-08-25`)

Taken literally that seems to forbid `lib/auth.ts` from reading its own OAuth secret. The resolution is that the DAL is a *directory*, not a file, and its first module is the one that reads and validates the environment. Everything else — including the auth config from [06b](06b-milestone-wiring-authjs-into-the-app-router.md) — imports the parsed object.

```ts filename="lib/dal/env.ts"
import 'server-only'
import { z } from 'zod'

const schema = z.object({
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.url().optional(),
  AUTH_TRUST_HOST: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  AUTH_GITHUB_ID: z.string().min(1),
  AUTH_GITHUB_SECRET: z.string().min(1),

  AUTH_RESEND_KEY: z.string().min(1),
  AUTH_EMAIL_FROM: z.email(),

  DATABASE_URL: z.url(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  // Field names only. Never log the values.
  throw new Error(
    `Invalid environment: ${Object.keys(parsed.error.flatten().fieldErrors).join(', ')}`,
  )
}

export const env = parsed.data
```

Three properties this buys, none of which is "tidiness":

1. **The app fails at boot, not at 3am on the first OAuth callback.** A missing `AUTH_GITHUB_SECRET` is a startup crash with a field name in it, not a provider error page six hours after deploy.
2. **`grep -rn 'process.env' app/ lib/` has exactly one hit**, and that hit is auditable. The Data Security guide's own audit checklist asks you to *verify that database packages and environment variables are not imported outside the Data Access Layer* — this is the shape that makes that verification a one-line command.
3. **The error message names fields, never values.** `parsed.error` from a failed zod parse does not contain the input values, but `console.log(process.env)` in the same catch block would, and it would go to your log aggregator. Keep the throw exactly as narrow as it is above.

🔴 **`NEXT_PUBLIC_` is not a naming convention, it is a bundling instruction.** Next.js exposes any environment variable prefixed with `NEXT_PUBLIC_` to the client. A variable called `NEXT_PUBLIC_AUTH_SECRET` is inlined into the JavaScript your users download. There is no warning, because you asked for it.

## Every environment variable, and where it lives

`AUTH_SECRET` first, because the documentation is unambiguous about its status:

> *"This is the only strictly required environment variable. It is the secret used to encode the JWT and encrypt things in transit."*
> — [Auth.js, environment variables](https://authjs.dev/getting-started/deployment)

Generate it with `npx auth secret` or `openssl rand -base64 33`; the docs ask for at least a 32-character random string.

| Variable | Local dev | Vercel | Docker / self-hosted |
|---|---|---|---|
| `AUTH_SECRET` | `.env.local`, git-ignored | Project env var, **same value across production and preview** | Secret store; injected at run, not baked into the image |
| `AUTH_URL` | not needed | not needed | Only if the app is served under a base path, e.g. `https://company.com/app1/auth` |
| `AUTH_TRUST_HOST` | not needed | detected automatically | 🔴 **`true`, or `trustHost: true` in the config** |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | `.env.local` | project env vars | secret store |
| `AUTH_RESEND_KEY` | `.env.local` | project env var | secret store |
| `AUTH_EMAIL_FROM` | `.env.local` | project env var | secret store |
| `DATABASE_URL` | `.env.local` | project env var | secret store |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | not needed | not needed | 🔴 required when running **more than one instance** |

### The three that actually bite

**`AUTH_SECRET` must match across preview and production.** The deployment docs give the reason: for preview deployments to work with OAuth, the value must be identical across the stable deployment and preview environments, because it secures the state parameter verification. The symptom of getting this wrong is the worst kind — OAuth works locally, works in production, and fails only on preview branches, which is where you test it.

**`AUTH_TRUST_HOST` is a Docker problem, not a Vercel problem.** Behind a reverse proxy, Auth.js needs permission to trust the `X-Forwarded-Host` header; the docs say it is detected automatically for Vercel and Cloudflare Pages, and that for Docker you must either set `trustHost: true` in the config or set `AUTH_TRUST_HOST=true`. Without it, callback URLs are built from the internal container host and the OAuth redirect lands nowhere.

**`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is not an Auth.js variable at all**, which is why it is missed. Next.js encrypts the variables a Server Action closes over, and the Data Security guide states that a new private key is generated for each action every time the application is built, so actions can only be invoked for a specific build. The guide then names the multi-server consequence:

> *"When **self-hosting** your Next.js application across multiple servers, each server instance may end up with a different encryption key, leading to potential inconsistencies."*
> — [Data Security, Overwriting encryption keys](https://nextjs.org/docs/app/guides/data-security#overwriting-encryption-keys-advanced)

The presentation of that bug is brutal: a sign-in form works, then fails, then works, depending on which instance the POST lands on. It reads as flaky auth. It is a key mismatch.

```bash
# base64, decoding to 16, 24 or 32 bytes. Next.js generates 32-byte keys by default.
openssl rand -base64 32
```

Set the result as `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` identically on every instance.

## Gotchas

**★ Symptom: OAuth works locally and in production and fails on every preview deployment.** Cause: preview builds were given their own generated `AUTH_SECRET`. The docs state the value must be identical across stable and preview environments because it secures the state parameter verification, and a mismatched secret makes the returning callback's state unverifiable. Fix: in your platform's env settings, scope the same value to both environments rather than generating one per environment — on Vercel that means one variable with production *and* preview ticked, not two variables.

**★ Symptom: in Docker, sign-in redirects to `http://localhost:3000/...` or to the container's internal hostname.** Cause: Auth.js builds callback URLs from the request host and will not trust `X-Forwarded-Host` from a reverse proxy unless told to. Fix — one of these, not both, and the config option is the one that survives someone clearing the environment:

```ts filename="lib/auth.ts"
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  // ...
})
```

**★ Symptom: sign-in intermittently fails across a self-hosted cluster, with no pattern except which pod served the request.** Cause: each instance built its own Server Action encryption key, and an action's encrypted closure can only be decrypted by the instance that built it. Fix: pin the key across instances.

```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

Set the same value on every instance and rotate it deliberately, not per deploy.

**★ Symptom: a secret ends up in the JavaScript your users download, and nothing warned you.** Cause: the variable was named with a `NEXT_PUBLIC_` prefix. The Data Security guide states plainly that by default environment variables are only available on the server and that Next.js exposes any variable prefixed with `NEXT_PUBLIC_` to the client. The prefix *is* the instruction to inline the value into the browser bundle; the framework did what you asked. Fix: there is no code fix — rename the variable, **and rotate the secret**, because it has been in a public artifact and possibly in a CDN cache. Then make the schema refuse it:

```ts filename="lib/dal/env.ts"
for (const key of Object.keys(process.env)) {
  if (key.startsWith('NEXT_PUBLIC_') && /SECRET|KEY|TOKEN|PASSWORD/i.test(key)) {
    throw new Error(`Refusing to boot: ${key} would be inlined into the client bundle`)
  }
}
```

**★ Symptom: a teammate adds `console.log(process.env)` while debugging a boot failure and your log aggregator now holds the OAuth secret.** Cause: the environment object is one object, and printing it prints the secrets with it. Fix: the throw in `lib/dal/env.ts` names field keys only — `Object.keys(parsed.error.flatten().fieldErrors)` — and that is deliberate rather than terse. Never widen it to include values, and never widen it to the whole `process.env`.

**★ Symptom: the app boots fine and dies on the first request that needs a secret.** Cause: the environment is read lazily, at the point of use, so a typo in a variable name is discovered by a user rather than by a deploy. Fix: the module-level `safeParse` above runs when the module is first imported, and `lib/auth.ts` imports it — so the failure moves to process start, where your platform's health check catches it and refuses to route traffic to the bad instance.

**★ Symptom: `AUTH_URL` is set on Vercel "to be safe" and callbacks start going to the wrong place after a domain change.** Cause: `AUTH_URL` is largely optional in v5 because the host is inferred from request headers; setting it pins the base URL to whatever you wrote, including after the deployment's real hostname changes. Fix: unset it. The documented reason to set it is a **base path** — an app served under `https://company.com/app1/auth` — not a hostname.

**★ Symptom: `.env.local` works in `next dev` and the values are missing in the deployed container.** Cause: `.env.local` is a local-development file and is git-ignored, which is correct; it is not a deployment mechanism. Fix: the values belong in the platform's secret store, injected at run time. 🔴 Do not `COPY .env.local` into a Docker image to fix this — a secret baked into an image layer is readable by anyone who can pull the image, and it survives every later `rm`.

**★ Symptom: rotating `AUTH_SECRET` signs everybody out, including people mid-task.** Cause: that is what it does — the secret encodes and encrypts tokens, so every existing token becomes unverifiable. Fix: this is not a bug to prevent, it is an operation to schedule. Rotate deliberately during a maintenance window, and note the useful corollary: **rotating `AUTH_SECRET` is a global session kill-switch**, which is worth knowing in an incident even when you have chosen database sessions and already have a per-user one.

## Interview questions

**★ The docs say only the Data Access Layer should access `process.env`, but your Auth.js config needs an OAuth secret. How do you satisfy both?**
By treating the DAL as a directory whose first module owns the environment. `lib/dal/env.ts` is `server-only`, parses `process.env` once through a zod schema, throws on boot with field names if anything is missing, and exports a typed object. `lib/auth.ts` imports that object rather than reading the environment itself. The rule's purpose is that secrets have exactly one reachable read site so an auditor can find it — which this satisfies — and the side effect is that a misconfigured deployment dies at startup instead of at the first OAuth callback.

**★ What is `AUTH_TRUST_HOST` for, and why have you probably never set it?**
It tells Auth.js it may trust the `X-Forwarded-Host` header when constructing callback URLs, which matters when a reverse proxy sits in front of the app. Most people have never set it because it is detected automatically on Vercel and Cloudflare Pages. It becomes mandatory the day you containerise — the docs are explicit that for Docker you set `trustHost: true` in the config or `AUTH_TRUST_HOST=true` in the environment. The failure without it is not an error message; it is an OAuth redirect to a hostname that only exists inside your network.

**★ A self-hosted deployment shows intermittent Server Action failures after scaling from one instance to three. Where do you look, and why is it not an auth bug?**
At `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Next.js encrypts the variables a Server Action closes over, and generates a new private key per action per build — so the docs note that across multiple self-hosted servers each instance can end up with a different key. An action encrypted by instance A cannot be decrypted by instance B, and load balancing decides which one you hit. It presents as flaky login because login is the form you exercise most, but nothing about Auth.js is involved: setting the same base64 key on every instance fixes it.

**★ Why must `AUTH_SECRET` be the same value in preview as in production, when isolating environments is normally the safer default?**
Because the OAuth round trip crosses the boundary. The secret secures the `state` parameter, which is created before the redirect to the provider and verified when the provider redirects back — and the deployment docs state that for preview deployments to work with OAuth, the value must be identical across the stable deployment and preview environments. Two different secrets means the state written on the way out cannot be verified on the way back. It is a real weakening of environment isolation, and the mitigation is not a different secret but a different OAuth application, with its own callback URLs, for anything you genuinely want isolated.

**★ Someone proposes `NEXT_PUBLIC_API_KEY` so a Client Component can call a third-party API directly. What is your answer?**
That the prefix ships the key to every visitor, because that is precisely what it is for — the Data Security guide says Next.js exposes any variable prefixed with `NEXT_PUBLIC_` to the client, and there is no warning because it is the documented behaviour. If the key is genuinely public (a publishable analytics or maps key scoped by referrer), the prefix is correct and the name should say so. If it is not, the call belongs on the server: a Route Handler or a Server Action that holds the key and returns only the result. The tell is whether you would be comfortable pasting the key into a public gist, because functionally you have.

**★ You inherit an app where `process.env.SOMETHING` appears in 60 files. What is the concrete cost, beyond untidiness?**
Three costs, all of which show up during incidents. First, there is no boot-time validation, so a missing variable is discovered by whichever user first hits the code path that reads it, at whatever hour that is. Second, an audit cannot answer "where do secrets enter this application" without reading 60 sites — and the Data Security guide's audit checklist asks exactly that, in the form *verify that database packages and environment variables are not imported outside the Data Access Layer*. Third, any of those 60 files can drift into a Client Component's import graph, and a `process.env.X` in client code silently becomes `undefined` rather than an error, so the failure is a mysterious wrong behaviour rather than a crash.

---

← [06b · Wiring Auth.js into the App Router](06b-milestone-wiring-authjs-into-the-app-router.md) · [Chapter 10 overview](01-explanation.md) · Next → [06d · The Data Access Layer](06d-milestone-the-data-access-layer.md)
