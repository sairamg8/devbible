---
name: research-nextjs-ch10-actions-and-validation
description: Banked primary-source research for Next.js chapter 10 forks A (Server Actions as an untrusted entry point, boundary validation with zod and React Hook Form) — verbatim quotes with URLs and lastUpdated dates, plus installed-package probes of zod 4.4.3. Spend this instead of re-fetching in ch15, ch16 and any forms/auth topic.
metadata:
  type: reference
---

# Research bank — Next.js ch10 · Server Actions security and boundary validation

**Collected 2026-09-05, session `989fb824`, fork A (~10 fetches + 4 T1 probes).**
🔴 **Do not re-fetch.** Every quote verbatim with URL and the doc's own `lastUpdated:`.
Target **Next.js 16.3.4**, **React 19.2.8**, **zod 4.4.3**.
Complements `research_nextjs_ch8_state_management.md` — that bank has the hook mechanics and
the short Server Actions security quotes; this one has the full data-security guide.

## Versions read from the npm registry, 2026-09-05

| Package | `latest` | Note |
|---|---|---|
| `react-hook-form` | **7.87.0** | https://registry.npmjs.org/react-hook-form/latest |
| `@hookform/resolvers` | **5.9.1** | https://registry.npmjs.org/@hookform%2Fresolvers/latest |
| `zod` | **4.5.4** | 🔴 corpus pin is **4.4.3** — currency sweep should look at this |

Installed in the devbible checkout: `zod` 4.4.3 (matches pin), `react` 19.2.8.
**Not installed:** `react-hook-form`, `@hookform/resolvers`, `next`, `typescript`.

## `/docs/app/guides/server-actions` · `lastUpdated: 2026-06-17`

- *"Treat every action as an untrusted entry point."*
- *"Render-time gating (only rendering a form on an authenticated page) is not a security boundary, because requests can be sent without going through the UI."*
- *"Constrain return values. Action returns are serialized to the client. Shape them to what the UI renders, not raw database records."*
- *"Destructive operations like deletes may warrant stronger handling, such as elevated session checks or re-authentication, and a loud failure when those checks miss."*
- *"a client legitimately tells the server *which* item to act on, but it should not supply the row's contents or ownership. Send a reference (typically an ID) plus the user's change, and re-read the rest from a trusted source using the session."*
- *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*
- *"Because `redirect` throws a control-flow exception, any code after it does not run."*
- 🔴 *"**Good to know:** This is a property of the client dispatcher, not of Server Functions in general. Server-side, an action runs in its own request and can do anything an async function can do."* — sequential dispatch is **not** a server-side concurrency control.
- Deployment: *"New deployments typically generate new IDs (Next.js rotates them at most every 14 days, even when the source is unchanged)"*; *"Surface the error as a retry path in the UI rather than a hard failure, so a refresh recovers the user."*
- Documented example pair: `findUnique`-then-compare (data-security) vs ownership-scoped `findFirst({ where: { id, ownerId } })` (this guide).

## `/docs/app/guides/data-security` · `lastUpdated: 2026-08-25`

- 🔴 *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action"* · *"The page-level redirect on line 6 controls which UI is rendered, but the Server Action is a separate entry point and must verify the caller on its own."*
- *"Beyond authentication (is the user logged in?), remember to check **authorization** (does this user have permission to act on this specific resource?). This prevents Insecure Direct Object Reference (IDOR) vulnerabilities"*
- 🔴 *"By default, when a Server Action is created and exported, it is reachable via a direct POST request, not just through your application's UI. This means, even if a Server Action or utility function is not imported elsewhere in your code, it can still be called externally."*
- *"**Secure action IDs:** Next.js creates encrypted, non-deterministic IDs…"* · *"**Dead code elimination:** Unused Server Actions (referenced by their IDs) are removed from client bundle to avoid public access."*
- *"The IDs are created during compilation and are cached for a maximum of 14 days. They will be regenerated when a new build is initiated or when the build cache is invalidated."*
- *"This security improvement reduces the risk in cases where an authentication layer is missing. However, you should still treat Server Actions as reachable via direct POST requests and verify authentication and authorization inside each one."*
- DAL for mutations: *"This keeps authentication, authorization, and database logic in a dedicated `server-only` module, while `"use server"` actions stay thin."* · *"You can use `import 'server-only'` in both the Data Access Layer and the `"use server"` file itself. Both work when the action is imported into a Client Component… because `"use server"` modules are resolved in a server-only webpack layer."*
- *"Secret keys should be stored in environment variables, but only the Data Access Layer should access `process.env`."*
- *"Use classes to avoid accidentally passing the whole object to the client."* · *"Functions and classes are already blocked from being passed to Client Components by default."*
- *"Cached helper methods makes it easy to get the same value in many places without manually passing it around. This discourages passing it from Server Component to Server Component which minimizes risk of passing it to a Client Component."*
- *"Server Action return values are serialized and sent to the client. Only return what the UI needs, not raw database records."*
- Closures: *"the captured variables are sent to the client and back to the server when the action is invoked. To prevent sensitive data from being exposed to the client, Next.js automatically encrypts the closed-over variables. A new private key is generated for each action every time a Next.js application is built. This means actions can only be invoked for a specific build."* · 🔴 *"We don't recommend relying on encryption alone to prevent sensitive values from being exposed on the client."*
- Key: *"The key must be a base64-encoded value whose decoded length matches a valid AES key size (16, 24, or 32 bytes). Next.js generates 32-byte keys by default."* · `openssl rand -base64 32`
- CSRF: *"Behind the scenes, Server Actions use the `POST` method, and only this HTTP method is allowed to invoke them."* · *"compare the Origin header to the Host header (or `X-Forwarded-Host`). If these don't match, the request will be aborted."*
- ⚠️ **Unsettled:** the precedence between `Host` and `X-Forwarded-Host`. Neither this page nor the `serverActions` reference states it. ch10 says so explicitly and gives proxy-hygiene advice instead.
- Render side-effects: *"Mutations (e.g. logging out users, updating databases, invalidating caches) should never be a side-effect… Next.js explicitly prevents setting cookies or triggering cache revalidation within render methods"* · *"Next.js uses `POST` requests to handle mutations. This prevents accidental side-effects from GET requests, reducing Cross-Site Request Forgery (CSRF) risks."*
- Rate limiting: only *"For expensive operations (sending emails, writing to a database), consider adding rate limiting to prevent abuse."* — **no Server-Action-specific mechanism exists.**
- Taint: *"it's an additional layer of protection, you should still filter and sanitize the data in your DAL before passing it to React's render context."* · *"Next.js exposes any environment variable prefixed with `NEXT_PUBLIC_` to the client."*
- Audit checklist (quoted in ch10 page 01): DAL isolation · `"use client"` prop breadth · per-`"use server"` validation, re-authorization, ownership, return filtering, DAL delegation · bracketed params · *"`proxy.ts` and `route.ts`: Have a lot of power."*

## `/docs/app/api-reference/config/next-config-js/serverActions` · `lastUpdated: 2026-06-25`

- *"By default, the maximum size of the request body sent to a Server Action is 1MB, to prevent the consumption of excessive server resources in parsing large amounts of data, as well as potential DDoS attacks."*
- *"It can take the number of bytes or any string format supported by bytes, for example `1000`, `'500kb'` or `'3mb'`."*
- 🔴 *"The limit applies to the raw HTTP request body, including the bytes that `multipart/form-data` adds for boundaries, part headers, and field metadata… For typical multipart uploads, an additional 10–20 KB is a reasonable rule of thumb."*
- *"A list of extra safe origin domains from which Server Actions can be invoked… If not provided, only the same origin is allowed."*

## `/docs/app/guides/forms` · `lastUpdated: 2026-08-25`

- *"For **client-side validation**, you can use the HTML attributes like `required` and `type="email"`…"* / *"For **server-side validation**, you can use a schema validation library like Zod or Valibot…"*
- 🔴 *"Note that this object will contain extra properties prefixed with `$ACTION_`."* (about `Object.fromEntries(formData)`)
- `bind` vs hidden input: *"the value will be part of the rendered HTML and will not be encoded."* · *"`bind` works in both Server and Client Components and supports progressive enhancement."*
- 🔴 **The guide's zod example is zod 3** — `z.string({ invalid_type_error: … })` and `error.flatten().fieldErrors`.
- *"With the **experimental** `useOffline` config enabled, a Server Action interrupted by a connectivity drop stays pending and completes when the network returns, so a user does not lose their submission."* (line 389)

## `/docs/app/api-reference/file-conventions/error` · `lastUpdated: 2026-07-10`

- *"Errors forwarded from Client Components show the original `Error` message."*
- 🔴 *"Errors forwarded from Server Components show a generic message with an identifier. This is to prevent leaking sensitive details. You can use the identifier, under `errors.digest`, to match the corresponding server-side logs."* (the docs write `errors.digest`; the prop signature is `error.digest`)
- ⚠️ **Unsettled:** whether a Server Action's *thrown* message is redacted when caught by your own code and returned as state. Not stated anywhere reachable. ch10 says do not rely on it.

## `/docs/app/guides/backend-for-frontend` · `lastUpdated: 2026-06-25`

- *"You can implement rate limiting in your Next.js backend. In addition to code-based checks, enable any rate limiting features provided by your host."* (example is a Route Handler returning 429)
- *"Store user-generated static assets in dedicated services. When possible, upload them from the browser and store the returned URI in your database to reduce request size."*

## react.dev

`/reference/react-dom/components/form`
- *"When a function is passed to `action` or `formAction` the HTTP method will be POST regardless of value of the `method` prop."*
- *"When `<form>` is rendered by a Server Component, and a Server Function is passed to the `<form>`'s `action` prop, the form is progressively enhanced."*
- 🔴 *"Displaying a form submission error message before the JavaScript bundle loads for progressive enhancement requires that: `<form>` be rendered by a Client Component; the function passed to the `<form>`'s `action` prop be a Server Function; the `useActionState` Hook be used to display the error message."*
- ⚠️ **Unsettled:** what happens when `onSubmit` (with `preventDefault`) and a function `action` are both on the same element. Neither React's nor React Hook Form's docs address it. ch10 refuses to assert an answer.

`/reference/react/experimental_taintObjectReference`
- 🔴 *"Do not rely on just tainting for security. Tainting an object doesn't prevent leaking of every possible derived value. For example, the clone of a tainted object will create a new untainted object. Using data from a tainted object (e.g. `{secret: taintedObj.secret}`) will create a new value or object that is not tainted. Tainting is a layer of protection; a secure app will have multiple layers of protection, well designed APIs, and isolation patterns."*

## zod 4 (docs source: `github.com/colinhacks/zod/…/packages/docs/content/`)

`api.mdx` — coercion table: `z.coerce.string()` → `String(value)`, `.number()` → `Number(value)`, `.boolean()` → `Boolean(value)`, `.bigint()` → `BigInt(value)`, `.date()` → `new Date(value)`.
- *"Boolean coercion with `z.coerce.boolean()` may not work how you expect. Any truthy value is coerced to `true`, and any falsy value is coerced to `false`."* with `schema.parse("false"); // => true`
- *"The input type of these coerced schemas is `unknown` by default."* · `z.coerce.number<number>()` narrows it.
- *"For total control over coercion logic, consider using `z.transform()` or `z.pipe()`."*
- `z.stringbool()` (*"Introduced in `zod@4.0`"*) — truthy `["true","1","yes","on","y","enabled"]`, falsy `["false","0","no","off","n","disabled"]`, case-insensitive by default.
- Objects: *"By default, unrecognized keys are *stripped* from the parsed result"*; `z.strictObject` throws; `z.looseObject` passes through.
- Files: `z.file()` with `.min(bytes)`, `.max(bytes)`, `.mime(string | string[])`.
- Transforms: 🔴 *"Transform functions should never throw. Thrown errors are not caught by Zod."* — use `ctx.issues.push(...)` and `return z.NEVER`.
- `z.preprocess` narrowing note: *"This is useful when integrating with libraries like `react-hook-form` that derive their form value type from `z.input<>`."*

`error-formatting.mdx`
- `z.flattenError()` → `{ formErrors: string[], fieldErrors: Record<string, string[]> }`; 🔴 the documented example shows an issue at `path: ['favoriteNumbers', 1]` landing in `fieldErrors.favoriteNumbers` **with the index discarded**.
- `z.treeifyError()` → `{ errors, properties, items }`; *"Be sure to use optional chaining (`?.`) to avoid errors when accessing nested properties."*
- `z.prettifyError()` → human-readable string.
- `z.formatError()` and `.flatten()` / `.format()` methods: **deprecated**.

`v4/changelog`
- 🔴 *"The `invalid_type_error` / `required_error` params have been dropped."* — replaced by a single `error` param. *"deprecates `.flatten()`"*, *"deprecates `.format()`"*, *"drops `.formErrors`"*.

## T1 probes — installed `zod` **4.4.3** (matches the corpus pin)

Run inline with `node -e`; no files created.

- `z.string({ invalid_type_error: 'CUSTOM' }).safeParse(123)` → message is the **default** `Invalid input: expected string, received number`. The key is silently ignored. `z.string({ error: 'CUSTOM' })` → `CUSTOM`.
- `z.coerce.number().safeParse('')` → **success, `0`**. `.safeParse(null)` → **success, `0`**. `.safeParse('abc')` → fails, `invalid_type`.
- `z.coerce.boolean().safeParse('false')` → `true`.
- `z.object({a:z.string()})` parsing `{a:'x', $ACTION_ID_1:'y'}` → `{a:'x'}` (stripped). `z.strictObject` → fails.
- `z.stringbool().or(z.undefined().transform(()=>false)).or(z.null().transform(()=>false))` → `'on'`→true, `'off'`→false, `undefined`→false, `null`→false, `'zzz'`→fails.
- `z.preprocess(v => v===''||v===null ? undefined : v, z.coerce.number({error:'Enter a quantity.'}).int().min(1))` → `''` fails with the custom message; `'3'` → `3`.
- `z.iso.date()` accepts `'2026-03-14'`, rejects `'nope'`. `z.email` and `z.uuid` are top-level functions.
- `z.file().min(10).max(1000).mime(['image/png','image/jpeg'])` → 500-byte PNG passes; 5-byte → `too_small`; `image/gif` → `invalid_value`.
- `new File([], '', {type:''})` has `size` 0 and `name` `''`; `z.file().min(1)` rejects it.
- `z.object({a,b}).keyof().options` → `['a','b']`.
- Export presence on 4.4.3: `file`, `stringbool`, `flattenError`, `treeifyError`, `prettifyError`, `formatError`, `coerce`, `preprocess`, `pipe`, `strictObject`, `looseObject`, `transform` all present. `Object.keys(z.coerce)` → `string,number,boolean,bigint,date`.

## `@hookform/resolvers` README (GitHub `master`, read 2026-09-05)

- `resolver(schema, schemaOptions?, resolverOptions?)` with `{ mode: 'async' | 'sync', raw?: boolean }`; `useForm<Input, Context, Output>()`.
- 🔴 *"If your schema uses `.default(...)` on a field, that field becomes optional on the schema's *input* type (`z.input`) but stays required on its *output* type (`z.output`/`z.infer`)… Passing a single generic to `useForm<T>` pins both to the same type and will conflict with `zodResolver`, which infers input and output separately. Either omit the generic and let it infer from `resolver`, or specify all three explicitly"*
- *"Example below uses the `valueAsNumber`, which requires `react-hook-form` v6.12.0 (released Nov 28, 2020) or later."*
- `standardSchemaResolver` from `@hookform/resolvers/standard-schema` works with zod too.

## react-hook-form.com `/docs/useform/handlesubmit`

⚠️ The page is client-rendered; only part of the text came through one fetch. What did:
- *"handleSubmit function will not swallow errors that occurred inside your onSubmit callback, so we recommend that you use try/catch blocks inside your async requests and handle those errors gracefully for your customers. Use setError inside the catch block to register a server-side error — this also ensures formState.isSubmitSuccessful is set to false"*
- **RHF's documentation does not mention Server Actions anywhere I could reach.** ch10 says so on the page rather than inventing an integration guarantee.

## Deliberately not asserted anywhere in fork A's pages

Whether closure encryption is authenticated against tampering (only "encrypted" is documented) ·
`Host` vs `X-Forwarded-Host` precedence · whether a Server Action's thrown message is redacted
outside the `error.tsx` path · the `onSubmit`-plus-`action` interaction · any latency, bundle-size
or throughput number · any claim that a framework feature provides idempotency or rate limiting.
