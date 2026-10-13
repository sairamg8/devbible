---
title: "Link map · TypeScript · Part 3 (phases 7–9)"
sidebar_label: "03 · In the stack"
sidebar_position: 4
---

# Link map · TypeScript · Part 3 (phases 7–9)

Covers every topic row of `docs/typescript/syllabus/03-in-the-stack.md`: T07-01 to T07-15 (TypeScript on the server), T08-01 to T08-14 (TypeScript in React), T09-01 to T09-15 (types at the boundary). That is 44 rows, matching the syllabus header.
Only T07-01 to T07-05 have pages of ours (✅). The other Phase 7 rows and all of Phases 8 and 9 were dropped on 2026-08-15 and are 🔲 not written; the syllabus keeps them as a record, so this map is reading material for a future reopening. *read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. `#anchors` appear only where the id was seen in the page HTML (none used here).

🔴 **Version note.** Our syllabus targets **TypeScript 7.0.2**. npm on 2026-10-12: `typescript` `latest` 7.0.2, `rc` 7.0.1-rc, `next` 7.1.0-dev, `beta` 6.0.0-beta; `@types/node` 26.6.5, `@types/express` 5.0.6, `@types/pg` 8.23.1, `express` 5.3.0, `zod` 4.6.6, `mongoose` 9.11.1, `react` and `@types/react` 19.3.0. The handbook lists release notes up to 6.0 and `typescript-7-0.html` returns 404, so 7.0 notes are not confirmed there. The [6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) (read) say `strict` is now `true` by default, `module` defaults to `esnext`, `target` floats to the current ES year (es2025 at the time), `types` defaults to `[]`, and `moduleResolution node10` and `baseUrl` are deprecated. Node's TypeScript page (read) shows type stripping stable from v25.2 and v24.12, v26.0.0 removing `--experimental-transform-types`, and Node ignoring `tsconfig.json`. `github.com` returns 403 to our fetcher, so GitHub-hosted sources are cited as `raw.githubusercontent.com`.

---

## Phase 7 — TypeScript on the server

### T07-01 · `tsconfig.json` for a Node 24 service — Master · ✅ written `docs/typescript/pages/phase-7-server/01-tsconfig-for-a-node-service/README.md`
- **Read this:** [Modules — Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html) · typescriptlang.org · "compiling and running in Node.js" template: `module: nodenext` (implies `moduleResolution`, `esModuleInterop`, `target: esnext`) plus `verbatimModuleSyntax`; says to set `target`, `lib`, `strict` yourself (*read* the Node passage) · covers our angle: **partial** — no `@types/node` or `noEmit` story · fetched 2026-10-12
- **Also good:** [Node.js — Modules: TypeScript](https://nodejs.org/api/typescript.html) · nodejs.org · type stripping does no type checking and Node ignores `tsconfig.json` (*read*); [TSConfig: erasableSyntaxOnly](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html) · typescriptlang.org · the flag that mirrors Node's strip-only limits (*read* the lead) · fetched 2026-10-12
- **Beyond the docs:** [The TSConfig Cheat Sheet](https://www.totaltypescript.com/tsconfig-cheat-sheet) · Total TypeScript (Matt Pocock) · an opinionated, modular recommended config (base, strictness, transpiling sections) that says NodeNext is the best option for Node, where the handbook lists every option; changelog dated 2024-04-23 · fetched 2026-10-13 (*read*)
- **Our delta:** 🔴 the 6.0 notes (read) flip `strict` and `target` defaults and make `types` default to `[]`, so projects "will likely need" `"types": ["node"]`; `"types": ["*"]` restores the old enumeration. Whether 7.0 keeps these defaults is not confirmed (no 7.0 notes page).

### T07-02 · Shipping TypeScript to production — Master · ✅ written `docs/typescript/pages/phase-7-server/02-shipping-to-production/README.md`
- **Read this:** [Node.js — Modules: TypeScript](https://nodejs.org/api/typescript.html) · nodejs.org · type stripping is stable; inline types become whitespace so source maps are unnecessary for line numbers; refuses `.ts` under `node_modules` (*read* the Source maps section) · covers our angle: **partial** — the `tsc` build path is not covered · fetched 2026-10-12
- **Also good:** [Node.js CLI — `--enable-source-maps`](https://nodejs.org/api/cli.html) · nodejs.org · caches source maps and reports stack traces against the original source, best effort; overriding `Error.prepareStackTrace` can defeat it (*read*) · fetched 2026-10-12
- **Our delta:** build-with-`tsc` versus run-`.ts` decision table; the `sourceMap` flag side is on TSConfig, which I did not open.

### T07-03 · Typing `process.env` — Master · ✅ written `docs/typescript/pages/phase-7-server/03-typing-process-env/README.md`
- **Read this:** [Node.js — `process.env`](https://nodejs.org/api/process.html) · nodejs.org · what the object holds; assigning a non-string implicitly converts to a string (deprecated) so `env.test = undefined` gives the string `'undefined'` (*read*) · covers our angle: **partial** — nothing on TypeScript or `ProcessEnv` · fetched 2026-10-12
- **Also good:** [T3 Env — Introduction](https://env.t3.gg/docs/introduction) · env.t3.gg · why they moved validated env into a library (*read*, about 700 words) · fetched 2026-10-12
- **Our delta:** none found for "augmenting `ProcessEnv` versus parsing once"; the argument is ours. The `ProcessEnv` merge itself is a declaration-merging case (see T07-06).

### T07-04 · `catch (e: unknown)` — Master · ✅ written `docs/typescript/pages/phase-7-server/04-catch-e-unknown/README.md`
- **Read this:** [TypeScript 4.4 → `useUnknownInCatchVariables`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html) · typescriptlang.org · any value can be thrown, so catch variables default to `unknown` under `--strict` (*read* that section) · covers our angle: **partial** — no custom error classes or bundling guard · fetched 2026-10-12
- **Also good:** [MDN — Error: cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) · MDN · re-throwing with the original error kept; `cause` can be any type, so do not assume it is an `Error` (*read*); [Narrowing → `instanceof`](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · prototype-chain check (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Get a catch block error message with TypeScript](https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript) · Kent C. Dodds · turns the unknown catch variable into a reusable getErrorMessage helper instead of only explaining the flag; 2021-10-28 · fetched 2026-10-13 (*read*)
- **Our delta:** the guard that survives bundling (duplicate class copies defeat `instanceof`): no page found.

### T07-05 · Typed Express handlers — Master · ✅ written `docs/typescript/pages/phase-7-server/05-typed-express-handlers/README.md`
- **Read this:** [Adding Types to Express](https://stevekinney.com/courses/full-stack-typescript/adding-types-to-express) · Steve Kinney · shows `Request<P, ResBody, ReqBody, ReqQuery, Locals>` with the defaults and calls the `any` slots "danger zones"; last modified 2026-01-07 (*read*) · covers our angle: **full** for the five slots and the unverifiable body · fetched 2026-10-12
- **Also good:** [DefinitelyTyped `express-serve-static-core`](https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/express-serve-static-core/index.d.ts) · github (raw) · `ParamsDictionary` and `RequestHandler` with `ReqBody = any` defaults (*read* the declarations) · fetched 2026-10-12
- **Our delta:** why the typed body is a promise the compiler cannot keep; the course shows the types but its validation chapters are separate pages.

### T07-06 · Augmenting `Express.Request` — Master · 🔲 not written (the `req.user` case lives in `docs/typescript/pages/phase-4-classes-declarations/01-module-augmentation/`)
- **Read this:** [Overriding the Express API](https://expressjs.com/en/guide/overriding-express-api/) · expressjs.com · declaration merging on the `Express` namespace in a `.d.ts` that is part of the project; no `tsconfig.json` change unless a custom `include` does not cover it; example adds `user?: User` and ends with `export {}` (*read*) · covers our angle: **partial** — the `include` caveat is one sentence, with no demonstration of the silent failure · fetched 2026-10-12
- **Also good:** [Declaration Merging → Module Augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) · typescriptlang.org · the import-then-`declare module` form (*read* the opening of the section) · fetched 2026-10-12
- **Our delta:** the silent "not in `include`" failure is named by Express only as a caveat; our page owns the demonstration.

### T07-07 · Typing `pg` query results — Understand · 🔲 not written
- **Read this:** [DefinitelyTyped `@types/pg`](https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/pg/index.d.ts) · github (raw) · `QueryResultRow`, and `Pool.query<R extends QueryResultRow = any, I = any[]>`: the row type is a caller-supplied generic that defaults to `any` (*read* the declarations) · covers our angle: **partial** — shows the shape of the claim, no prose about it · fetched 2026-10-12
- **Also good:** [node-postgres — Queries](https://node-postgres.com/features/queries) · node-postgres.com · the runtime API; the page has no TypeScript text (*read*) · fetched 2026-10-12
- **Our delta:** "assertion, not a check" is inferred from the declarations; no official page states it, not confirmed beyond that. *Not opened:* a community `query<T>` tutorial from search (secondary).

### T07-08 · Typed middleware — Understand · 🔲 not written
- **Read this:** [Express — Error handling](https://expressjs.com/en/guide/error-handling/) · expressjs.com · error handlers take four arguments `(err, req, res, next)`; shows a TypeScript tab with `Request`, `Response`, `NextFunction` (*read*) · covers our angle: **partial** — does not say TypeScript cannot enforce arity · fetched 2026-10-12
- **Also good:** [Type-Safe Middleware with Express](https://stevekinney.com/courses/full-stack-typescript/type-safe-middleware-with-express) · Steve Kinney · `RequestWithUser`, a middleware that casts `req`, and a guard chain; modified 2025-04-16 (*read*) · fetched 2026-10-12
- **Our delta:** the `RequestHandler` / `ErrorRequestHandler` distinction and the arity trap.

### T07-09 · Async handlers — Understand · 🔲 not written
- **Read this:** [Express — Error handling](https://expressjs.com/en/guide/error-handling/) · expressjs.com · handlers that return a Promise call `next(value)` when they reject or throw (*read*) · covers our angle: **partial** — nothing on the declared return type · fetched 2026-10-12
- **Also good:** [Moving to Express 5 → Rejected promises](https://expressjs.com/en/guide/migrating-5/) · expressjs.com · the same change framed as a migration (*read*); [Type-Safe Async Error Handling in Express Routes](https://stevekinney.com/courses/full-stack-typescript/type-safe-asynchronous-route-handlers-with-express) · Steve Kinney · an Express 4 style `asyncHandler` returning `Promise<void>`; modified 2025-09-22 (*read*) · fetched 2026-10-12
- **Our delta:** why the wrapper is now unneeded and what return type the router sees: not confirmed on any page.

### T07-10 · Typed configuration loading — Understand · 🔲 not written
- **Read this:** [T3 Env — Introduction](https://env.t3.gg/docs/introduction) · env.t3.gg · schema-validated env as a library; warns that frameworks such as Next.js tree-shake env variables not accessed on `process.env` (*read*) · covers our angle: **partial** — Next.js/bundler flavour, not a plain Node service · fetched 2026-10-12
- **Also good:** [Type Safety and Runtime Validation](https://stevekinney.com/courses/full-stack-typescript/type-safety-vs-runtime-validation) · Steve Kinney · data from "configuration files" is a boundary that needs a runtime schema; modified 2026-10-05 (*read*) · fetched 2026-10-12
- **Our delta:** fail-fast at startup and one exported `config`: no page found that argues it for Express.

### T07-11 · DTOs vs domain types vs row types — Understand · 🔲 not written
- **Read this:** [Use DTOs to Enforce a Layer of Indirection](https://khalilstemmler.com/articles/enterprise-typescript-nodejs/use-dtos-to-enforce-a-layer-of-indirection/) · Khalil Stemmler · last updated 2021-02-24 · domain objects, DTOs and raw Sequelize objects with a mapper between them (*read*) · covers our angle: **partial** — Sequelize era, not `pg` rows; no column-leak example checked · fetched 2026-10-12
- **Our delta:** the column-leak failure (`password_hash` in a response) is ours; the post has a "Disadvantages to this approach" heading I did not read closely.

### T07-12 · Typing the service and repository layer — Understand · 🔲 not written
- **Read this:** [Exploring the repository pattern with TypeScript and Node](https://blog.logrocket.com/exploring-repository-pattern-typescript-node) · LogRocket · 2022-10-20 · a repository decouples data access from business logic and enforces dependency inversion (*read* the benefits passage) · covers our angle: **partial** — no transactions · fetched 2026-10-12
- **Also good:** [node-postgres — Transactions](https://node-postgres.com/features/transactions) · node-postgres.com · BEGIN/COMMIT/ROLLBACK yourself, and one client for every statement (*read*); [Suggested Code Structure](https://node-postgres.com/guides/project-structure) · node-postgres.com · a single `db` module that the app imports instead of `pg` (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Repository Pattern with Typescript, Node.js and native PostgreSQL driver](https://dev.to/fyapy/fully-featured-repository-pattern-with-typescript-and-native-postgresql-driver-4f2j) · aabdullin (DEV Community) · a working repository on plain pg with generic query helpers (rows cast to T, so a compile-time assertion) and a PoolClient passed through start/commit/rollback helpers, which the official pages do not combine; 2022-03-20 · fetched 2026-10-13 (*read*)
- **Our delta:** typing a transaction-carrying function: none found.

### T07-13 · Typed errors → HTTP responses — Understand · 🔲 not written
- **Read this:** [Typed-Error Middleware with Express](https://stevekinney.com/courses/full-stack-typescript/typed-error-middleware-with-express) · Steve Kinney · `AppError` with `statusCode` and `code`, subclasses such as `NotFoundError`, and a mapping handler; modified 2025-04-16 (*read*) · covers our angle: **partial** — classes, not a union with an exhaustiveness check · fetched 2026-10-12
- **Also good:** [Narrowing → Exhaustiveness checking](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · assign to `never` in a `default` so a missed case errors (*read*); [Global Error Types in Express](https://stevekinney.com/courses/full-stack-typescript/global-error-types-express) · Steve Kinney · an `ErrorCode` enum plus `AppError` subclasses; modified 2025-04-16 (*read*) · fetched 2026-10-12

### T07-14 · Typing MongoDB and Mongoose — Understand · 🔲 not written
- **Read this:** [Mongoose — Schemas in TypeScript](https://mongoosejs.com/docs/typescript/schemas.html) · mongoosejs.com · raw document interface, no automatic check that it matches the schema, `InferRawDocType` for the `lean()` and `toObject()` result (*read*) · covers our angle: **full** for lean and inference limits (docs are Mongoose v9.11.1) · fetched 2026-10-12
- **Also good:** [Mongoose — TypeScript Support](https://mongoosejs.com/docs/typescript.html) · mongoosejs.com · use `Types.ObjectId` in the document interface and `ObjectId` in the schema (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Derive TypeScript Types from Mongoose Schemas](https://dev.to/silentwatcher_95/derive-typescript-types-from-mongoose-schemas-4323) · Ali nazari (DEV Community) · shows when to use InferSchemaType for plain data versus HydratedDocument for full documents; 2025-05-02, does not cover lean · fetched 2026-10-13 (*headings only*)

### T07-15 · Sharing types with the client — Understand · 🔲 not written
- **Read this:** [Turborepo — TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript) · turborepo.dev · internal packages as Just-in-Time versus Compiled; compiled needs `declaration` and `declarationMap` for go-to-definition (*read* that passage, rest *headings only*) · covers our angle: **partial** — no `import type` rule or "what must not cross" · fetched 2026-10-12
- **Also good:** [TypeScript 3.8 → type-only imports and exports](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html) · typescriptlang.org · `import type` is always fully erased (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Sharing TypeScript Types in a Monorepo/BFF](https://dev.to/wantedhorizon1/sharing-typescript-types-in-a-monorepobff-2k8a) · wantedhorizon1 (DEV Community) · a concrete shared-types folder for an Express server and React client, with per-route req/res types; 2025-10-14, a single author's approach rather than a settled pattern · fetched 2026-10-13 (*read*)
- **Our delta:** what must not cross the boundary (server-only imports, secrets, ORM types): none found.

---

## Phase 8 — TypeScript in React

Every Phase 8 row is 🔲 not written (phase dropped). React 19.3 docs are current on `react.dev`; `forwardRef` is marked deprecated there (read).

### T08-01 · Typing props — Master · 🔲 not written
- **Read this:** [React — Using TypeScript](https://react.dev/learn/typescript) · react.dev · `children` typed as `React.ReactNode` (any renderable) versus `ReactElement` (JSX only); React v19.3 (*read* the components and Children sections) · covers our angle: **partial** — no `React.FC` position · fetched 2026-10-12
- **Also good:** [Function Components](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/function_components/) · React TypeScript Cheatsheet · `React.FC` is "mostly a stylistic choice, otherwise discouraged" with current types (*read*) · fetched 2026-10-12

### T08-02 · `useState` — Master · 🔲 not written
- **Read this:** [Hooks → useState](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/hooks/) · React TypeScript Cheatsheet · inference for simple values; `useState<User | null>(null)` for null-ish initial values; a `{} as User` assertion shown with its risk (*read*) · covers our angle: **full** except the status-union alternative · fetched 2026-10-12
- **Also good:** [React — Using TypeScript → useState](https://react.dev/learn/typescript) · react.dev · inference from the initial value; explicit generic for a union, including a status-union object (*read*) · fetched 2026-10-12

### T08-03 · `useRef` — Master · 🔲 not written
- **Read this:** [Hooks — useRef](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/hooks/) · React TypeScript Cheatsheet · `useRef` returns `RefObject<T>`, initial value required, DOM refs take the element generic with `null`, `.current` may be null so check before use, plus a separate mutable-value ref option (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [React — useRef](https://react.dev/reference/react/useRef) · react.dev · reference page (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [A common TypeScript error with useRef](https://dev.to/arichy/a-common-typescript-error-with-useref-27fj) · Arc (DEV Community) · explains the two `useRef` overloads that make `useRef<T>(null)` read-only and how adding `| null` to the generic changes that; 2024-04-15 · fetched 2026-10-13 (*read*)

### T08-04 · Event types — Master · 🔲 not written
- **Read this:** [React — Using TypeScript → DOM Events](https://react.dev/learn/typescript) · react.dev · `React.ChangeEventHandler<HTMLInputElement>` on a `useCallback`; says to hover the handler to see the event type, with `React.SyntheticEvent` as the base (*read*) · covers our angle: **partial** — only `ChangeEvent` is shown; no `FormEvent` or `MouseEvent` example · fetched 2026-10-12
- **Also good:** [Forms and Events](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/forms_and_events/) · React TypeScript Cheatsheet · `FormEvent<HTMLInputElement>` versus typing the handler on the left, `currentTarget.value` (*read*; examples are class components) · fetched 2026-10-12

### T08-05 · `useReducer` with a discriminated union of actions — Understand · 🔲 not written
- **Read this:** [Hooks — useReducer](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/hooks/) · React TypeScript Cheatsheet · discriminated union for actions; annotate the reducer's return type (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [React — Using TypeScript → useReducer](https://react.dev/learn/typescript) · react.dev · state types inferred from the initial state, optional type argument (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Typing a useReducer React hook in TypeScript](https://www.sumologic.com/blog/react-hook-typescript) · Milosz Piechocki (Sumo Logic blog) · a full request/success/failure fetch reducer with a discriminated union of actions and a status union for state; 2019-05-24, written for older React · fetched 2026-10-13 (*read*)

### T08-06 · `useContext` — Understand · 🔲 not written
- **Read this:** [Context](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/context/) · React TypeScript Cheatsheet · `createContext<T | null>(null)` when there is no sensible default, plus a custom hook that throws if the provider is missing so consumers never check null; React 19 renders the context object directly (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [React — Using TypeScript → useContext](https://react.dev/learn/typescript) · react.dev · the same `| null` default and a throwing hook, recommended there (*read*) · fetched 2026-10-12
- **Beyond the docs:** [How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) · Kent C. Dodds · argues for no default value, a provider component and a consumer hook that throws outside the provider, with the TypeScript typing; 2021-06-05 · fetched 2026-10-13 (*read*)

### T08-07 · Generic components — Understand · 🔲 not written
- **Read this:** [Useful Patterns by Use Case → Generic Components](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/patterns_by_usecase/) · React TypeScript Cheatsheet · generic functions applied to props, plus a "Props: Render Props" section (*read* the generics passage, rest *headings only*) · covers our angle: **partial** — constrained item types and `Table<Row>` for our page · fetched 2026-10-12

### T08-08 · Discriminated union props — Understand · 🔲 not written
- **Read this:** [Useful Patterns by Use Case → Type Narrowing based on Props](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/patterns_by_usecase/) · React TypeScript Cheatsheet · a Button that is either `button` or `a` props, and "Props: One or the other but not both" (*read* the narrowing passage, the rest *headings only*) · covers our angle: **partial** · fetched 2026-10-12

### T08-09 · Typing custom hooks — Understand · 🔲 not written
- **Read this:** [Hooks → Custom Hooks](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/hooks/) · React TypeScript Cheatsheet · tuple return with `as const` versus asserting the return type; notes the React team prefers objects past two values (*read*) · covers our angle: **partial** — the object-return option gets one sentence · fetched 2026-10-12

### T08-10 · `ComponentProps<typeof X>` — Understand · 🔲 not written
- **Read this:** [API Reference — `ComponentProps<ElementType>`](https://react-typescript-cheatsheet.netlify.app/docs/reference/componentprops/) · React TypeScript Cheatsheet · constructs the props type of an element or component (*read*) · covers our angle: **partial** — short · fetched 2026-10-12
- **Also good:** [Useful Patterns → Wrapping/Mirroring](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/patterns_by_usecase/) · React TypeScript Cheatsheet · extend `ComponentPropsWithoutRef<'button'>` (*read*) · fetched 2026-10-12

### T08-11 · Refs across the boundary — Understand · 🔲 not written
- **Read this:** [forwardRef/createRef](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/forward_and_create_ref/) · React TypeScript Cheatsheet · ref as a prop typed with `ComponentPropsWithRef` (recommended for React 19+), then the legacy `forwardRef` form for React 18 and earlier (*read*) · covers our angle: **full** · fetched 2026-10-12
- **Also good:** [React 19 → ref as a prop](https://react.dev/blog/2024/12/05/react-19) · react.dev · function components receive `ref` as a prop; `forwardRef` to be deprecated later (*read*; nothing on typing); [React — forwardRef](https://react.dev/reference/react/forwardRef) · react.dev · marked Deprecated (*read* the lead) · fetched 2026-10-12

### T08-12 · `ReactNode` vs `ReactElement` vs `JSX.Element` — Understand · 🔲 not written
- **Read this:** [Basic Type Example](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/basic_type_example/) · React TypeScript Cheatsheet · a quoted note that `createElement` always returns `React.JSX.Element` while `ReactNode` is the set of all possible component return values (*read*) · covers our angle: **partial** — `ReactElement` is not on this page · fetched 2026-10-12
- **Also good:** [React — Using TypeScript → Children](https://react.dev/learn/typescript) · react.dev · `ReactNode` is broad, `ReactElement` is JSX only (*read*) · fetched 2026-10-12

### T08-13 · Typing forms — Understand · 🔲 not written
- **Read this:** [Powerful Form Validation With React Hook Form and Zod](https://catalins.tech/form-validation-with-react-hook-form-zod-typescript/) · Catalin Pit · published 2023-04-06, modified 2026-09-11 · `z.infer` for the form type, `zodResolver(schema)` into `useForm` (*read*) · covers our angle: **partial** — Zod 4 with `@hookform/resolvers` is not confirmed · fetched 2026-10-12
- **Also good:** [React Hook Form — TypeScript Support](https://react-hook-form.com/ts) · react-hook-form.com · exported types `Resolver`, `SubmitHandler` and more (*headings only*) · fetched 2026-10-12

### T08-14 · Polymorphic components (`as` prop) — Know · 🔲 not written
- **Read this:** [Useful Patterns → Polymorphic Components](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/patterns_by_usecase/) · React TypeScript Cheatsheet · `React.ElementType` for a simple `as` prop, then links out for the full generic version (*read*) · covers our angle: **partial** — the cost note and full generics are not on the page · fetched 2026-10-12
- **Beyond the docs:** [Build polymorphic React components with Typescript](https://khacvy.substack.com/p/build-polymorphic-react-components) · khacvy (Substack) · builds the as prop step by step and is open about the cost: helper types, forwardRef losing generics, duplicated defaults; 2023-01-04 · fetched 2026-10-13 (*read*)

---

## Phase 9 — Types at the boundary

Every Phase 9 row is 🔲 not written (phase dropped).

### T09-01 · Static types stop at the network — Master · 🔲 not written
- **Read this:** [Type Safety and Runtime Validation](https://stevekinney.com/courses/full-stack-typescript/type-safety-vs-runtime-validation) · Steve Kinney · types are erased, so compile-time checks cannot protect against data from user input, APIs and config at runtime; modified 2026-10-05 (*read*) · covers our angle: **partial** — conceptual, no annotated-`fetch` example · fetched 2026-10-12
- **Also good:** [MDN — Response: json()](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) · MDN · resolves to "anything that can be represented by JSON" (*read*) · fetched 2026-10-12
- **Beyond the docs:** [Type-Safe JSON in TypeScript: Parsing, Typing, and Runtime Validation](https://betterstack.com/community/guides/scaling-nodejs/typescript-json-type-safety/) · Stanley Ulili (Better Stack) · shows JSON.parse giving any, assertions not checking anything, and hand-written guards as the fix; updated 2025-12-17, no Zod or Date coverage · fetched 2026-10-13 (*read*)

### T09-02 · Parse, don't validate — Master · 🔲 not written
- **Read this:** [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) · Alexis King · 2019-11-05 · the original essay, in Haskell (*read* the opening) · covers our angle: **partial** — Haskell examples, no TypeScript · fetched 2026-10-12
- **Also good:** [Type Guards vs Schema Validation](https://stevekinney.com/courses/full-stack-typescript/type-guards-vs-schema-validation) · Steve Kinney · hand-written guards compared with schemas; modified 2025-04-16 (*read* the lead) · fetched 2026-10-12

### T09-03 · Schema-first with zod/valibot — Master · 🔲 not written
- **Read this:** [Zod — Basics](https://zod.dev/basics) · zod.dev · `z.infer` extracts the type from a schema; `z.input` and `z.output` when they differ (*read*) · covers our angle: **partial** — the "never hand-write a duplicate" rule is ours · fetched 2026-10-12
- **Also good:** [Valibot — Introduction](https://valibot.dev/guides/introduction/) · valibot.dev · modular, dependency-free schema library (*read* the lead) · fetched 2026-10-12

### T09-04 · `unknown` at the door, never `any` — Master · 🔲 not written
- **Read this:** [Avoiding anys with Linting and TypeScript](https://typescript-eslint.io/blog/avoiding-anys/) · typescript-eslint · prefer `unknown`; `JSON.parse()`, `.json()` and `Storage` are typed `any`, and `ts-reset` switches them to `unknown` (*read*) · covers our angle: **partial** — the `any` policy, but no parse-at-the-edge step · fetched 2026-10-12
- **Also good:** [no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any/) · typescript-eslint · the rule, with editor suggestions and an opt-in `fixToUnknown` auto-fix option (*headings only*, options block read) · fetched 2026-10-12
- **Beyond the docs:** [Taming dynamic data in TypeScript](https://www.pluralsight.com/resources/blog/software-development/taming-dynamic-data-in-typescript) · Pluralsight · walks from any to unknown to an assertion to runtime decoders, so the reason for parsing at the edge is argued rather than listed; 2019-11-08, uses runtypes · fetched 2026-10-13 (*read*)

### T09-05 · JSON does not round-trip your types — Master · 🔲 not written
- **Read this:** [MDN — JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) · MDN · a `BigInt` throws; `undefined` in an array becomes `null`; a `Date` becomes an ISO string; `Map` and `Set` become `{}` (*read*) · covers our angle: **full** for the five hazards · fetched 2026-10-12
- **Also good:** [MDN — JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) · MDN · reviver parameter (*headings only*) · fetched 2026-10-12
- **Beyond the docs:** [Mastering Type-Safe JSON Serialization in TypeScript](https://www.hackernoon.com/mastering-type-safe-json-serialization-in-typescript) · Maksim Zemskov (HackerNoon) · shows the Date-becomes-string mismatch and a JSONCompatible type that rejects bigint, symbol and functions at compile time; 2024-02-26, Map and Set only mentioned · fetched 2026-10-13 (*read*)
- **Our delta:** what to do about each (revivers, schema transforms): not confirmed on these pages.

### T09-06 · Typed `fetch` wrappers — Understand · 🔲 not written
- **Read this:** [Validating API Response with Zod](https://www.wisp.blog/blog/validating-api-response-with-zod) · Wisp · 2024-11-13 · `fetch` then `response.json()` then `UserSchema.parse` / `safeParse` (*read*) · covers our angle: **partial** — no reusable wrapper that cannot skip validation · fetched 2026-10-12
- **Also good:** [MDN — Response: json()](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) · MDN (*read*) · fetched 2026-10-12

### T09-07 · Generated clients — Understand · 🔲 not written
- **Read this:** [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) · openapi-ts.dev · typed client from `openapi-typescript` output, 6 kB, "virtually zero runtime" (*read* the lead) · covers our angle: **partial** — no GraphQL, and it does not validate responses at runtime · fetched 2026-10-12
- **Also good:** [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) · the-guild.dev · typed clients, resolvers and SDKs from a schema (*read* the lead); [Generating Types from an OpenAPI spec](https://stevekinney.com/courses/full-stack-typescript/generating-types-from-open-api) · Steve Kinney · modified 2026-09-14 (*headings only*) · fetched 2026-10-12

### T09-08 · Database row types — Understand · 🔲 not written
- **Read this:** [Kysely — Generating types](https://kysely.dev/docs/generating-types) · kysely.dev · `kysely-codegen` introspects a live database; `kysely-typegen` does it through the Kysely instance (*read*) · covers our angle: **partial** — no cost-of-schema-change comparison · fetched 2026-10-12
- **Also good:** [Drizzle — Type API](https://orm.drizzle.team/docs/goodies) · orm.drizzle.team · `$inferSelect` and `$inferInsert` from a table definition (*read*); [Kysely — Getting started](https://kysely.dev/docs/getting-started) · kysely.dev · hand-written `Database` interface (*read*) · fetched 2026-10-12
- **Our delta:** Prisma's inference: the page I opened (the "data contract") is not a type-safety guide, so none chosen.

### T09-09 · Typed environment parsing — Understand · 🔲 not written
- **Read this:** [T3 Env — Introduction](https://env.t3.gg/docs/introduction) · env.t3.gg · validated env as a library (*read*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [Node.js — `process.env`](https://nodejs.org/api/process.html) · nodejs.org · values are strings (*read*) · fetched 2026-10-12

### T09-10 · Branded IDs across layers — Understand · 🔲 not written
- **Read this:** [Branded Types with Express](https://stevekinney.com/courses/full-stack-typescript/branded-types-express) · Steve Kinney · `UserId = string & { readonly _brand: unique symbol }` with `createUserId` as the single cast; modified 2025-04-16 (*read*) · covers our angle: **partial** — no unwrap rule or database boundary · fetched 2026-10-12
- **Beyond the docs:** [Flavoring: Flexible Nominal Typing for TypeScript](https://spin.atomicobject.com/typescript-flexible-nominal-typing/) · Drew Colthorp (Atomic Object) · compares branding with an optional-marker flavor for IDs and says when strictness is worth it, including friction with tests and code generators; 2018-01-15 · fetched 2026-10-13 (*read*)

### T09-11 · Error shapes over the wire — Understand · 🔲 not written
- **Read this:** [Narrowing → Discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) · typescriptlang.org · the narrowing mechanism a `{ ok: true, data } | { ok: false, error }` response relies on (*read* the opening) · covers our angle: **partial** — not about HTTP responses · fetched 2026-10-12
- **Also good:** [Global Error Types in Express](https://stevekinney.com/courses/full-stack-typescript/global-error-types-express) · Steve Kinney · a shared error code type; modified 2025-04-16 (*read*) · fetched 2026-10-12
- **Our delta:** validating the union on arrival: none found.

### T09-12 · Sharing schemas between form and API — Understand · 🔲 not written
- **Read this:** [Sharing Types and Validations with Zod Across a Monorepo](https://leapcell.io/blog/sharing-types-and-validations-with-zod-across-a-monorepo) · Leapcell · published 2025-10-01, modified 2025-10-28 · schemas in a shared package for a Next.js frontend and a Fastify backend (*read*) · covers our angle: **partial** — does not argue why server re-validation is not redundant · fetched 2026-10-12
- **Also good:** [Powerful Form Validation With React Hook Form and Zod](https://catalins.tech/form-validation-with-react-hook-form-zod-typescript/) · Catalin Pit · 2023-04-06 / modified 2026-09-11 · the form side (*read*) · fetched 2026-10-12

### T09-13 · Versioning shared types — Know · 🔲 not written
- **Read this:** [SemVer for TS in Practice](https://v5.chriskrycho.com/journal/semver-for-ts-in-practice/) · Chris Krycho · 2022-04-22 · a TypeScript 4.7 change was breaking for a library's types even though it caught bugs (*read*) · covers our angle: **partial** — about published libraries, not a monorepo package · fetched 2026-10-12
- **Also good:** [Semantic Versioning for TypeScript Types (Ember RFC 0730)](https://rfcs.emberjs.com/id/0730-semver-for-ts/) · Ember.js RFCs · long (≈12k words) proposal on defining breaking type changes (*headings only*) · fetched 2026-10-12

### T09-14 · End-to-end inference (tRPC-style) — Know · 🔲 not written
- **Read this:** [tRPC — Concepts](https://trpc.io/docs/concepts) · trpc.io · RPC mindset: call functions, ignore HTTP verbs; designed for TypeScript monorepos (*read*) · covers our angle: **partial** — the coupling and build-time cost is not discussed · fetched 2026-10-12
- **Also good:** [tRPC — Quickstart](https://trpc.io/docs/quickstart) · trpc.io · requires TypeScript >=5.7.2 and recommends `"strict": true` (*read*) · fetched 2026-10-12
- **Beyond the docs:** [How to Get Type Safety Without Code Generation Using tRPC and Hono](https://www.freecodecamp.org/news/type-safety-without-code-generation-using-trpc-and-hono/) · Tarun Singh (freeCodeCamp) · shows the mechanism, exporting the router type and creating the client from it, so a server rename becomes a client compile error; 2026-01-12 · fetched 2026-10-13 (*read*)

### T09-15 · Contract testing vs shared types — Know · 🔲 not written
- **Read this:** [Pact — When to use Pact](https://docs.pact.io/getting_started/what_is_pact_good_for) · docs.pact.io · good for intra-organisation microservices; not for public APIs whose consumers cannot be identified (*read*) · covers our angle: **partial** — no comparison with shared types · fetched 2026-10-12
- **Also good:** [Pact — How Pact works](https://docs.pact.io/getting_started/how_pact_works) · docs.pact.io · consumer and provider definitions (*read*) · fetched 2026-10-12
- **Beyond the docs:** [How to split the deployment of your front end and back end with Consumer Driven Contract Testing](https://www.freecodecamp.org/news/split-frontend-backend-deployment-with-cdcs/) · Mario Fernandez (freeCodeCamp) · a worked Pact flow: a Jest consumer test on a React frontend, with the provider verified on a Spring Boot backend via Gradle; 2019-11-12, does not compare with shared types · fetched 2026-10-13 (*read*)
