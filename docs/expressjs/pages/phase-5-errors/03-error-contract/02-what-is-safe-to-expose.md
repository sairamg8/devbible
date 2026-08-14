---
title: "What is safe to expose"
sidebar_label: "02 · What is safe to expose"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**4xx errors describe the caller's request and are safe to echo. 5xx errors
describe your internals and are not. The `expose` convention encodes that — and
it is a default, not an excuse for the message text.**

> Verified: 2026-08-14. The `expose` convention comes from the `http-errors`
> package, which `body-parser` and much of the Express ecosystem use to build
> errors — installed in `sandbox/express-verify/node_modules/`. The default
> handler's environment-dependent leak is read from `finalhandler@2.1.1` and
> quoted in [01 · chunk 02](../01-error-middleware/02-the-default-handler.md);
> `env` is resolved once at `app.init()` from `NODE_ENV`, read from
> `express@5.2.1`'s `defaultConfiguration`. **No sandbox run backs this page and
> it carries no console block.** The exposure judgements below are **this bible's
> guidance**, stated as such.

## The default, and where it is wrong

`expose = status < 500` is a good default and it encodes a real distinction:
**the caller already knows what they sent**, so echoing it back leaks nothing;
what went wrong inside your process is not theirs to know.

Two places the default is wrong in opposite directions:

- **A 5xx you raised deliberately** — "payment provider unavailable", "feature
  temporarily disabled" — is safe and useful. Set `expose: true` explicitly.
- **A 4xx carrying internal detail** — a validation message quoting a database
  constraint name, a 403 naming an internal role id — is a leak with a 400 status.
  `expose` will happily send it.

🔴 **Treat `expose` as a default that individual errors override, never as a rule
that excuses the message text.** The status tells you the default; the message is
still something a human wrote and someone should have read.

## What must never reach a client

| Leak | Typical source |
|---|---|
| Stack traces | the default handler outside production, or a `stack` field left in |
| Driver / ORM messages | `err.message` from `pg`, `mongodb`, Prisma forwarded unmapped |
| Table, column and constraint names | the same |
| File paths | a stack, or an `fs` error's `path` |
| Connection strings, hostnames, ports | an `ECONNREFUSED` message |
| Internal service names and URLs | an upstream `fetch` failure's message |
| Whether a record exists | a 403 where a 404 was correct |
| Whether an account exists | different messages for "no such user" and "wrong password" |
| Library and version identifiers | `X-Powered-By`, a framework-branded error page |

The last two are the ones people do not think of as leaks.

**Auth failures must be indistinguishable.** "No such user" and "wrong password"
must produce the same code, the same message and — ideally — the same timing,
or the endpoint is a user-enumeration oracle
([Phase 8 · 04](../../phase-8-validation-authz/04-authn-middleware/README.md)). The same
applies to "your token expired" versus "that token is invalid": telling an
attacker their token was once real is information.

**Existence is a leak.** A 403 confirms the resource is there. Cross-tenant and
cross-user access should answer **404**
([Phase 8 · 07](../../phase-8-validation-authz/07-ownership/README.md)).

## Never forward a driver error

```js
// ❌ ships 'duplicate key value violates unique constraint "users_email_key"'
catch (err) { throw new AppError('CONFLICT', err.message); }

// ✅ map at the boundary where you know what the code means
catch (err) {
  if (err.code === '23505') throw new AppError('EMAIL_TAKEN', 'That email is already registered');
  throw err;
}
```

The mapping belongs **at the boundary where the code is understood** — the
repository knows that `23505` is a unique violation; the error handler does not,
and should not have to. Anything unmapped stays a 500 with a generic message,
which is the safe default
([Phase 5 · 04](../04-mapping-to-http.md)).

The same rule covers upstream HTTP calls: a `fetch` to an internal service that
fails must not surface that service's URL, its status, or its error body.

## The `NODE_ENV` trap

The default handler decides the leak from `env`, which Express resolves **once**,
at `app.init()`, from `process.env.NODE_ENV`
([Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md)).
Two consequences:

- **Unset means development.** `NODE_ENV` absent is not `'production'`, so the
  development branch runs and stacks go out. A container that lost an environment
  variable leaks by default.
- **Setting it after `express()` is too late.** `process.env.NODE_ENV =
  'production'` at the top of a module that imports the app after Express has
  already initialised does nothing.

🔴 **Fail closed.** Write the check so the *unsafe* branch needs a positive
signal:

```js
// ❌ fails open — an unset NODE_ENV leaks
if (process.env.NODE_ENV !== 'production') body.error.stack = err.stack;

// ✅ fails closed — you must ask for the stack
if (process.env.NODE_ENV === 'development') body.error.stack = err.stack;
```

And **assert it at startup** rather than trusting it: one config module, parsed
at import, that refuses to boot on an unrecognised environment
([Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md)).

## What replaces the detail you removed

Removing the detail is only half the job — the other half is making the failure
still diagnosable:

- **A request id in the body and the log.** The single most valuable field. It
  costs nothing to expose and turns a vague report into a lookup.
- **A stable `code`**, so support can tell "the user hit a known condition" from
  "something unexpected happened" without reading a stack.
- **Full detail in the log**, structured, with the error serialised properly —
  `Error` properties are non-enumerable, so a naive `JSON.stringify(err)` logs
  `{}` ([Phase 5 · 07](../07-error-logging.md)).

The pairing is what makes a terse response acceptable. `{"code":"INTERNAL",
"message":"Something went wrong","requestId":"01JC…"}` is genuinely useful; the
same body without the id is a dead end for everyone.

## Trade-off

Terse errors are safer and less helpful. Detailed errors are more helpful and
occasionally hand an attacker a map.

The line this bible draws: **be generous with 4xx, austere with 5xx, and always
send a request id.** A caller who got their own request wrong deserves to be told
exactly what was wrong with it — that is not a leak, it is the product. A caller
who triggered a bug in your process gets a code, an id and nothing else.

The one place to be austere even at 4xx is **anything that reveals existence or
identity**: authentication, authorization, and any lookup across a tenant
boundary.

## Gotchas

**Symptom:** Stack traces appear in production responses
**Cause:** `NODE_ENV` is unset — it is not `'production'`, so the development
branch ran
**Fix:** Set it in the deployment environment, assert it at startup, and write the
check so the unsafe branch needs `=== 'development'` rather than
`!== 'production'`

**Symptom:** An unexpected 500 leaks a database constraint name
**Cause:** A driver error's `message` was forwarded into the envelope
**Fix:** Map driver codes to your own errors at the repository boundary; leave
anything unmapped as a generic 500

**Symptom:** An attacker can enumerate registered emails through the login form
**Cause:** "No such user" and "wrong password" produce different responses
**Fix:** One code, one message, and ideally comparable timing

**Symptom:** A cross-tenant probe distinguishes real ids from fake ones
**Cause:** 403 for records that exist, 404 for those that do not
**Fix:** 404 for both

**Symptom:** A deliberately raised 503 tells the client nothing useful
**Cause:** `expose` defaults off for 5xx, so the message was replaced
**Fix:** Set `expose: true` on errors you raised on purpose — and add
`Retry-After` via `err.headers`

**Symptom:** The log line for an error is `{}`
**Cause:** `Error` properties are non-enumerable, so a plain serialiser drops them
**Fix:** A logger with an error serialiser, and log the error object rather than
`err.message`

## Interview questions

**★ How do you decide whether an error's message is safe to send?**
Default on the status: 4xx describes the caller's own request and is safe; 5xx
describes your internals and is not. Override deliberately with `expose` for a
5xx you raised on purpose — and never let a driver or ORM message through
unmapped, because that is a 4xx-shaped leak the default will happily send.

**★ What must never appear in production error JSON?**
Stack traces, driver and ORM messages, table and constraint names, file paths,
connection details, internal service URLs — and, less obviously, anything that
reveals whether a record or an account exists.

**★ Why must "no such user" and "wrong password" be indistinguishable?**
Because the difference is a user-enumeration oracle. The same applies to
"expired" versus "invalid" tokens: telling an attacker their token was once real
is information they did not have.

**★ Why write the environment check as `=== 'development'` rather than
`!== 'production'`?**
So it fails closed. `NODE_ENV` unset is not `'production'`, so the negative form
leaks by default when a container loses an environment variable. The positive
form requires someone to ask for the stack.

**Where should a driver error be translated?**
At the boundary that understands the code — the repository knows `23505` is a
unique violation. The error handler does not and should not; anything that
reaches it unmapped stays a generic 500, which is the safe default.

**What makes a terse 500 acceptable to a user?**
A request id. It is safe to expose and it is the only thing that links their
report to your logs. Without it, "something went wrong" is a dead end for support
as well as for them.

---

← Prev: [The envelope](01-the-envelope.md) · Index: [Error contract](README.md) · Next → [Making it stick](03-making-it-stick.md)
