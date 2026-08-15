---
title: "Augmenting a package"
sidebar_label: "02 · Augmenting a package"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging* —
> *Module Augmentation*, *Global augmentation*), whose two stated limitations are
> quoted verbatim, and against the **installed `@types/express-serve-static-core`
> **5.1.3** and `@types/express` **4.17.25** in this repository's `node_modules`.
> The `Express` namespace block and the `Request` declaration below are **read
> from those files**, comments included, not reconstructed. **No console block** —
> no sandbox run covers this phase.

## Two forms, and picking the right one

```ts
// Form A — reopen a module by its specifier
declare module 'some-package' {
  interface Config { retries: number }
}

// Form B — reopen something the package put in the GLOBAL scope
declare global {
  namespace Express {
    interface Request { user?: User }
  }
}
```

**Which one you need is decided by the library, not by you.** The question is
where the library put the interface it wants you to extend:

- If it is **exported from the module**, use form A with the exact specifier you
  would `import` from.
- If the library declared it **globally** — many Node-ecosystem types do — use
  form B, because the name does not live in the module at all.

Guessing wrong is failure mode #1 in [chunk 03](./03-why-it-did-not-load.md), and
it fails silently. Read the library's `.d.ts` rather than guessing; it takes
thirty seconds and it is the only reliable answer.

## `req.user`, worked against the real types

This is the canonical case, so it is worth doing properly rather than by
copy-paste. Here is what Express actually ships — read from
`@types/express-serve-static-core@5.1.3`, verbatim, comments included:

```ts
declare global {
    namespace Express {
        // These open interfaces may be extended in an application-specific manner via declaration merging.
        // See for example method-override.d.ts (https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/method-override/index.d.ts)
        interface Request {}
        interface Response {}
        interface Locals {}
        interface Application {}
    }
}
```

🔴 **Read that comment.** These are **empty interfaces that exist only to be
merged into**, and the maintainers say so in the source. Augmenting `req` is not
a hack or a workaround — it is the extension point, deliberately provided. That
single fact reframes the whole technique.

The other half of the wiring, from the same file:

```ts
export interface Request<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
> extends http.IncomingMessage, Express.Request {
```

There is the chain. The `Request` you import from `express` **extends the global
`Express.Request`**. So anything you merge into the global one appears on every
`Request`, in every handler, with no import and no generic parameter to thread.

So the augmentation is:

```ts
// src/types/express.d.ts
import type { User } from '../models/user';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
```

Three details that are all doing work:

- **`import type { User }`** — a type-only import, so no runtime dependency is
  created by a file that exists purely to describe types.
- **`declare global`** — required because the file is a module. Inside a module,
  the global scope has to be entered explicitly.
- 🔴 **`export {};`** — the line everyone omits. It is what *makes* the file a
  module. Without it (and without any other import or export) the file is a
  **script**, `declare global` is an error in it, and top-level declarations leak
  globally instead. If your file already has the `import type` above, it is
  already a module and `export {}` is redundant — but leave it in, because
  deleting the import later silently changes the file's kind.

**Why `user?: User` and not `user: User`.** The property is genuinely absent
until your auth middleware runs. Declaring it required is a lie the compiler will
happily believe and never check, and it converts a caught bug into an
`undefined` at runtime. Optional here is correct, and narrowing it in the
handlers that need it is [phase 2](../../phase-2-narrowing/README.md)'s job.

⚠️ The alternative you will see — a per-handler `interface AuthedRequest extends
Request { user: User }` — is a legitimate and sometimes better design: it makes
the requirement explicit in each handler's signature instead of pretending every
request has a user. Augmentation is the right tool when the property really is
global to the app; a narrower interface is right when only some routes have it.

## The two things you may not do

Quoted from the handbook, because both are absolute:

> You can't declare new top-level declarations in the augmentation — just patches
> to existing declarations.

So this fails: you cannot invent an export that the module never had.

```ts
declare module 'some-package' {
  export function brandNew(): void;   // ❌ not a patch to anything
}
```

The mental model from [chunk 01](./01-what-merging-and-augmentation-are.md)
covers it — augmentation is *openness*, and you can only reopen something that is
already there.

> Default exports also cannot be augmented, only named exports (since you need to
> augment an export by its exported name, and `default` is a reserved word)

A practical consequence worth knowing before you start: a package whose entire
API is a default export cannot be augmented at all. That is a design decision
made by the library author, and it usually leaves a wrapper module of your own as
the only route.

## Global augmentation is the same feature

```ts
// observable.ts
export class Observable<T> {
  // ... still no implementation ...
}

declare global {
  interface Array<T> {
    toObservable(): Observable<T>;
  }
}

Array.prototype.toObservable = function () {
  // ...
};
```

The handbook's own example, and its own summary: *"Global augmentations have the
same behavior and limits as module augmentations."* Same rules, same two halves,
same requirement that the file be a module.

The everyday version of this is typing environment variables:

```ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
    }
  }
}
```

⚠️ **And it is worth being honest about what that buys.** It gives you
autocomplete and removes `string | undefined`, which is the *appeal* — but
nothing checks that `DATABASE_URL` is actually set. You have told the compiler a
value exists; you have not made it exist. This is the same unearned confidence as
[phase 3's return-position generic](../../phase-3-generics/13-when-not-to-write-a-generic/02-the-unsafe-shape.md),
in different clothes. Validate at startup and the declaration becomes true; skip
that and you have swapped a compile-time nag for a production crash.

## Augmenting your own code

The same mechanism works inside a codebase you own, and there it is usually the
wrong tool.

A property added by augmentation appears from nowhere as far as a reader is
concerned — no import points at it, and "go to definition" lands in a file they
have never opened. In your own code you can simply put the member on the
interface. **Reserve augmentation for types you genuinely cannot edit.**

The exception that earns it: a **plugin boundary** inside your own system, where
a core interface is deliberately extended by independently-loaded modules. That
is the same shape as the library case, and it is the reason Express's empty
interfaces exist.

---

← [01 · What merging and augmentation are](./01-what-merging-and-augmentation-are.md) · Next → [03 · Why it did not load](./03-why-it-did-not-load.md)
