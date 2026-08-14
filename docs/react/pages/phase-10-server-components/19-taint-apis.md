---
title: "Taint APIs"
sidebar_label: "19 · Taint APIs"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`experimental_taintObjectReference`](https://react.dev/reference/react/experimental_taintObjectReference)
> and
> [`experimental_taintUniqueValue`](https://react.dev/reference/react/experimental_taintUniqueValue)
> (parameters, returns, every caveat and both Pitfall boxes), react.dev
> [`'use server'`](https://react.dev/reference/rsc/use-server) (the WIP note), and Next.js
> [Data security](https://nextjs.org/docs/app/guides/data-security) (the `experimental.taint`
> flag and the "additional layer" framing).
> ⚠️ **Both APIs are experimental**, as their `experimental_` prefixes state.
> No sandbox script backs this page; claims are cited, not measured.

**Two APIs that turn "a secret reached the client" from a silent leak into a thrown error.**
Know tier — you should recognise them, know exactly what they do *not* cover, and never
present them as the answer to data exposure.

## The two, and the split between them

| | `experimental_taintObjectReference` | `experimental_taintUniqueValue` |
|---|---|---|
| Protects | **an object instance** | **a unique value** — string, bigint or TypedArray |
| For | a `user` row you must not pass wholesale | a token, key, hash or long password |
| Parameters | `message`, `object` | `message`, **`lifetime`**, `value` |
| Returns | `undefined` | `undefined` |

> `taintObjectReference` **lets you prevent a specific object instance from being passed to a
> Client Component like a `user` object.**
>
> `taintUniqueValue` **lets you prevent unique values from being passed to Client Components
> like passwords, keys, or tokens.**

Both replace React's default rejection message with **yours**, which is where most of their
practical value sits — the error can say what to do instead.

## Tainting an object

```js
import { experimental_taintObjectReference } from 'react';

export async function getUser(id) {
  const user = await db`SELECT * FROM users WHERE id = ${id}`;
  experimental_taintObjectReference(
    'Do not pass the entire user object to the client. ' +
      'Instead, pick off the specific properties you need for this use case.',
    user,
  );
  return user;
}
```

> Now whenever anyone tries to pass this object to a Client Component, **an error will be
> thrown with the passed in error message** instead.

Note what the message does: it names the fix. That is the difference between a guard that
teaches and one that merely blocks.

⚠️ **It taints one *instance*.** *"When a specific instance of a Typed Array is passed to
`taintObjectReference` as `object`, any other copies of the Typed Array will not be tainted."*
Functions and class instances can be passed too — they were already blocked
([topic 05](05-what-crosses-the-boundary.md)), so all you gain is your own message.

## Tainting a value — and the `lifetime` parameter

The middle parameter is the one people miss:

> **`lifetime`: Any object that indicates how long `value` should be tainted. `value` will be
> blocked from being sent to any Client Component while this object still exists. For example,
> passing `globalThis` blocks the value for the lifetime of an app. `lifetime` is typically an
> object whose properties contains `value`.**

Two idioms follow directly:

```js
// App-lifetime: an environment secret
import 'server-only';
experimental_taintUniqueValue(
  'Do not pass the API token password to the client. Instead do all fetches on the server.',
  process,
  process.env.API_PASSWORD,
);
```

```js
// Request-lifetime: a token that lives on the object it came from
export async function getUser(id) {
  const user = await db`SELECT * FROM users WHERE id = ${id}`;
  experimental_taintUniqueValue(
    'Do not pass a user session token to the client.',
    user,               // lifetime — the object whose property holds the value
    user.session.token,
  );
  return user;
}
```

**Getting `lifetime` wrong is a way to think you are protected and not be** — the docs list
*"using a global store outside of React, without the corresponding lifetime object"* among
the mistakes that *"can cause the tainted value to become untainted"*.

⚠️ **Not for low-entropy values.**

> **Do not use `taintUniqueValue` to protect low-entropy values such as PIN codes or phone
> numbers. If any value in a request is controlled by an attacker, they could infer which
> value is tainted by enumerating all possible values of the secret.**

The check itself becomes an oracle. `value` must be *"a unique sequence of characters or bytes
with high entropy such as a cryptographic token, private key, hash, or a long password"*.

## 🔴 The limitation that decides how you use them

Both reference pages carry a Pitfall box, and they say the same thing:

> **Do not rely on just tainting for security.** Tainting an object doesn't prevent leaking of
> every possible derived value. … **Tainting is a layer of protection; a secure app will have
> multiple layers of protection, well designed APIs, and isolation patterns.**

**Any derivation escapes the taint.** For objects:

> **Recreating or cloning a tainted object creates a new untainted object which may contain
> sensitive data.** For example, if you have a tainted `user` object,
> `const userInfo = {name: user.name, ssn: user.ssn}` or `{...user}` will create new objects
> which are not tainted.

For values, the documented example is blunt:

```js
const password = 'correct horse battery staple';
experimental_taintUniqueValue('Do not pass the password to the client.', globalThis, password);
const uppercasePassword = password.toUpperCase(); // `uppercasePassword` is not tainted
```

> New values created by **uppercasing** tainted values, **concatenating** tainted string
> values into a larger string, converting tainted values to **base64**, **substringing**
> tainted values, and other similar transformations **are not tainted** unless you explicitly
> call `taintUniqueValue` on these newly created values.

So the honest description: **tainting catches the mistake of passing the secret itself,
unchanged.** It catches nothing you did to it on the way. That is still worth having — passing
the object straight through is exactly the mistake people make — but it is a tripwire, not a
wall.

## Enabling them

React's own security section files them under work-in-progress:

> **To prevent sending sensitive data from a Server Function, there are experimental taint
> APIs to prevent unique values and objects from being passed to client code.**

Next.js requires an opt-in — `experimental.taint` in `next.config.js` — and frames the result
the same way React does:

> **This prevents the tainted objects or values from being passed to the client. However,
> it's an additional layer of protection, you should still filter and sanitize the data in
> your DAL before passing it to React's render context.**

Worth pairing with a fact from the same page: *"Functions and classes are already blocked
from being passed to Client Components by default."* Serialization already catches the
structural mistakes ([topic 05](05-what-crosses-the-boundary.md)). **Tainting exists for the
serializable-but-secret case** — a token that is just a string, a row that is just an object.

## Where they belong

At the **boundary of your data access layer**, not scattered through components
([topic 06 · 01](06-server-function-security/01-everything-is-an-endpoint.md)):

- Taint the row **where it is fetched**, so every caller inherits the protection.
- Taint environment secrets **once**, in a `server-only` module, with `process` or
  `globalThis` as the lifetime.
- Keep returning **minimal DTOs** anyway. Tainting is the backstop for the day someone
  forgets.

## Gotchas

**Symptom:** a tainted object was spread into a new one and passed through fine.
**Cause:** cloning creates a new, untainted object — documented.
**Fix:** do not rely on tainting; filter in the data layer.

**Symptom:** a tainted token was base64-encoded and reached the client.
**Cause:** derived values are not tainted unless you taint them explicitly.
**Fix:** same answer. Tainting catches the unchanged value only.

**Symptom:** tainting was enabled and nothing is blocked.
**Cause:** in Next.js it needs `experimental.taint` in `next.config.js`.
**Fix:** enable it — and remember both APIs are experimental.

**Symptom:** a tainted value stopped being blocked partway through.
**Cause:** the `lifetime` object was wrong — protection lasts only while that object exists.
**Fix:** use `globalThis`/`process` for app-lifetime secrets, or the object whose property
holds the value.

**Symptom:** a PIN was tainted and an attacker worked out what it was.
**Cause:** low-entropy values are enumerable, and the taint check answers the question.
**Fix:** documented as unsupported. High-entropy values only.

**Symptom:** tainting a function or class instance changed nothing.
**Cause:** those are already blocked from being passed to Client Components.
**Fix:** the only gain is replacing React's message with yours.

## Interview questions

**★ What are the taint APIs and when would you use them?**
`experimental_taintObjectReference` blocks a specific object instance — a database row you
must not pass wholesale — and `experimental_taintUniqueValue` blocks a high-entropy string,
bigint or TypedArray such as a token or key. Both throw your own message when the value
reaches a Client Component. Both are **experimental**, and in Next.js they need
`experimental.taint` enabled.

**★ What is the limitation, stated precisely?**
**Any derivation escapes the taint.** Cloning or spreading a tainted object produces a new
untainted object; uppercasing, concatenating, base64-encoding or substringing a tainted value
produces an untainted value. React's own Pitfall says not to rely on tainting alone — it is a
layer, alongside well-designed APIs and isolation patterns. It catches passing the secret
*unchanged*, which is the common mistake, and nothing else.

**★ What is the `lifetime` parameter?**
The object that determines how long the value stays tainted — the value is blocked while that
object still exists. `globalThis` or `process` for an app-lifetime secret; typically the
object whose property holds the value for a request-scoped one. Getting it wrong is one of
the documented ways a tainted value quietly becomes untainted.

**Why must the value be high-entropy?**
Because a low-entropy value like a PIN or phone number can be enumerated, and the taint check
tells the attacker when they have guessed right. The check becomes an oracle. The docs restrict
it to *"a unique sequence of characters or bytes with high entropy"*.

**Where do these fit relative to serialization?**
Serialization already blocks functions and classes by default, so structural mistakes are
caught without you. Tainting exists for the **serializable-but-secret** case — a token that is
just a string, a row that is just an object — and belongs at the data access layer, where
tainting once protects every caller.

---

← Prev: [Server Components without a framework](18-without-a-framework.md) ·
Index: [Phase 10](README.md)
