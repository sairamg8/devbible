---
title: "`NG1001` is really TypeScript diagnostic `-991001`, printed by `tsc` as `TS-991001` and string-replaced afterwards — and the sign of the `ErrorCode` enum member is a build-time index into the documentation site, which is why exactly ten compiler errors print a `Find more at` link and the rest do not"
sidebar_label: "13c · The NG code is a TS code"
sidebar_position: 13.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_details_base_url.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_details_base_url.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts) — the negative-valued enum members were **enumerated and counted directly from this file for this page**;
> and angular.dev [Error encyclopedia](https://angular.dev/errors).
> Documentation-validated; **no sandbox run** — no compiler was executed and no terminal output was captured; every string below is read from source.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular's error codes are not Angular's. They are TypeScript diagnostic codes with a deliberately unusable numeric range, printed by TypeScript's own formatter and then patched with a regular expression. `NG1001` never exists as a number anywhere in the compiler: the value is `-991001`, `tsc` renders it as `TS-991001`, and a string replacement turns the literal sequence `TS-99` into `NG`. That is the most concrete demonstration available that Angular is a plugin inside another compiler — and the encoding carries a second payload, because whether an `ErrorCode` member is declared positive or negative decides whether your terminal prints a link to the documentation.**

## The encoding, and the arithmetic

`packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts`, verbatim — with one alteration marked below:

```ts
const ERROR_CODE_MATCHER = /(\[\d+m ?)TS-99(\d+: ?\[\d+m)/g;

const ERROR_CODE_MARKER = 99;

/**
 * During formatting of `ts.Diagnostic`s, the numeric code of each diagnostic is prefixed with the
 * hard-coded "TS" prefix. For Angular's own error codes, a prefix of "NG" is desirable. To achieve
 * this, all Angular error codes start with "-99" so that the sequence "TS-99" can be assumed to
 * correspond with an Angular specific error code. This function replaces those occurrences with
 * just "NG".
 *
 * @param errors The formatted diagnostics
 */
export function replaceTsWithNgInErrors(errors: string): string {
  return errors.replace(ERROR_CODE_MATCHER, '$1NG$2');
}

export function ngErrorCode(code: ErrorCode): number {
  const absoluteCode = Math.abs(code);
  return -(ERROR_CODE_MARKER * 10 ** decimalDigits(absoluteCode) + absoluteCode);
}

export function formatCompilerErrorCode(code: number): string {
  return `NG${Math.abs(code)}`;
}
```

⚠️ **One alteration, and it matters.** In the real file each `[` inside `ERROR_CODE_MATCHER` is preceded by a literal ANSI escape byte, which cannot be reproduced faithfully in a document. The matcher is written to reach *through* `tsc`'s terminal colouring to find the code — that is what `(\[\d+m ?)` and `( ?\[\d+m)` are, the colour-on and colour-off sequences surrounding the code in a formatted diagnostic.

Work the arithmetic on a code you have seen:

- `ErrorCode.DECORATOR_ARG_NOT_LITERAL` is declared `-1001`. `Math.abs` gives `1001`, which has four decimal digits, so `ERROR_CODE_MARKER * 10 ** 4` is `990000`. Add `1001`, negate: **`-991001`**. TypeScript formats a diagnostic code by prefixing `TS`, giving `TS-991001`. The matcher replaces `TS-99` with `NG`, leaving **`NG1001`**.
- `ErrorCode.LOCAL_COMPILATION_UNRESOLVED_CONST` is `11001` — five digits. `99 * 10 ** 5` is `9900000`, plus `11001`, negated: `-9911001`, formatted `TS-9911001`, replaced to **`NG11001`**.

🔴 **That is why the marker is scaled by the digit count rather than being a fixed offset.** `99` followed by the code's own digits is exactly the decimal string, whatever the width of the code. A fixed offset would collide the moment Angular added a five-digit family, which it did.

🔴 **And note where `Math.abs` sits.** It is the first thing `ngErrorCode` does, so a member declared `-1001` and a member declared `1001` would produce the same diagnostic code. **The sign does not change the number the user sees.** It is carrying something else.

## The sign of the enum member is a pointer to a documentation page

Same file:

```ts
/**
 * Given a raw TypeScript diagnostic code, returns the corresponding {@link ErrorCode} if it is a
 * negative Angular error code that has an associated error guide, or `null` otherwise.
 */
export function errorCodeWithGuideFromDiagnosticCode(code: number): ErrorCode | null {
  const absoluteErrorCode = absoluteErrorCodeFromDiagnosticCode(code);
  if (absoluteErrorCode === null) {
    return null;
  }

  const codeWithGuide = -absoluteErrorCode;
  return ErrorCode[codeWithGuide] !== undefined ? codeWithGuide : null;
}

/**
 * Appends a "Find more at <url>" guide link to the message text of a diagnostic.
 */
export function addDiagnosticDetails(code: ErrorCode, messageText: string): string {
  const details = `Find more at ${ERROR_DETAILS_PAGE_BASE_URL}/${formatCompilerErrorCode(code)}`;
  return appendMessageText(messageText, details);
}
```

The trick is `ErrorCode[codeWithGuide]`. A TypeScript numeric enum compiles to an object carrying both directions — name to value and value back to name — so `ErrorCode[-1001]` is the string `'DECORATOR_ARG_NOT_LITERAL'`, while `ErrorCode[-2010]` is `undefined` because `COMPONENT_NOT_STANDALONE` was declared as a positive `2010`. The lookup would be meaningless otherwise; the whole function is built on the reverse mapping existing for exactly the members the authors chose to write with a minus sign.

**So: a negative `ErrorCode` member means "this error has a page in the encyclopedia".** The sign is a build-time index into the documentation site, maintained by hand, checked by nothing.

🔴 **I counted the negative members directly in `error_code.ts` at `v22.1.5` for this page rather than trusting a summary. There are ten:**

| enum member | declared value | prints as |
|---|---|---|
| `DECORATOR_ARG_NOT_LITERAL` | `-1001` | `NG1001` |
| `PARAM_MISSING_TOKEN` | `-2003` | `NG2003` |
| `COMPONENT_INVALID_SHADOW_DOM_SELECTOR` | `-2009` | `NG2009` |
| `IMPORT_CYCLE_DETECTED` | `-3003` | `NG3003` |
| `WARN_NGMODULE_ID_UNNECESSARY` | `-6100` | `NG6100` |
| `SCHEMA_INVALID_ELEMENT` | `-8001` | `NG8001` |
| `SCHEMA_INVALID_ATTRIBUTE` | `-8002` | `NG8002` |
| `MISSING_REFERENCE_TARGET` | `-8003` | `NG8003` |
| `MULTIPLE_MATCHING_COMPONENTS` | `-8023` | `NG8023` |
| `CONFLICTING_HOST_DIRECTIVE_BINDING` | `-8024` | `NG8024` |

The "Compiler errors" table in angular.dev's [error encyclopedia](https://angular.dev/errors) lists the same ten numbers. **Ten and ten.** Everything else in `error_code.ts` — the whole NG2xxx family, the NG4xxx configuration codes, the NG5xxx parse errors, the NG11xxx local-compilation pair — is declared positive and therefore prints no link.

**The practical rule this gives you** is the one [10](10-metadata-errors-one-by-one.md) leans on: if your error ends with a `Find more at …` line, the number is real *and* there is a page behind it. If it does not, the number is still real — it simply has no page. An absent link is never evidence that you misread the code.

## The link in your terminal is version-pinned; the one you find by searching is not

`packages/compiler-cli/src/ngtsc/diagnostics/src/error_details_base_url.ts`, verbatim:

```ts
export const DOC_PAGE_BASE_URL: string = (() => {
  const full = VERSION.full;
  const isPreRelease =
    full.includes('-next') || full.includes('-rc') || full === '0.0.0' + '-PLACEHOLDER';
  const prefix = isPreRelease ? 'next' : `v${VERSION.major}`;
  return `https://${prefix}.angular.dev`;
})();

/**
 * Base URL for the error details page.
 *
 * Keep the files below in full sync:
 *  - packages/compiler-cli/src/ngtsc/diagnostics/src/error_details_base_url.ts
 *  - packages/core/src/error_details_base_url.ts
 */
export const ERROR_DETAILS_PAGE_BASE_URL: string = (() => {
  return `${DOC_PAGE_BASE_URL}/errors`;
})();
```

The host is computed at runtime from the framework's own version. On Angular 22 the printed link is `https://v22.angular.dev/errors/NG1001`; on a `-next` or `-rc` build it is `https://next.angular.dev/errors/NG1001`. **Follow the link you were given rather than the one a search engine offers**, because the search result is the current major and the link in your terminal is the major that produced the error — and when those two differ, the difference is usually exactly the thing you are debugging.

The duplicated doc comment — *"Keep the files below in full sync"* — is worth noticing on its own: the same computation exists in `@angular/core` for runtime errors, because the compiler and the runtime print links from two separate copies of the same logic.

## Why the error you catch has no `.message`

`packages/compiler-cli/src/ngtsc/diagnostics/src/error.ts`, verbatim, with an unusually candid comment:

```ts
export class FatalDiagnosticError extends Error {
  // …
  // Trying to hide `.message` from `Error` to encourage users to look
  // at `diagnosticMessage` instead.
  declare message: never;
```

`declare message: never` is a type-level shove, not a runtime deletion — but it means anything typed against `FatalDiagnosticError` that reads `.message` is a type error, and the intent is that you read `diagnosticMessage`, which is the structured `ts.DiagnosticMessageChain` the compiler will render with positions and related information. A tool that catches this error and logs `err.message` is throwing away the only useful part.

## Gotchas

**★ Symptom: a CI log parser or error-tracking rule matching `error TS\d+` silently drops every Angular error.** Cause: the formatted code is `TS-991001`, with a hyphen and a minus-sign range that a `TS\d+` pattern cannot match, and after the replacement it is `NG1001`, which starts with different letters entirely. Fix: match both prefixes and allow the raw form:

```js
// Matches NG1001, TS2345 and the un-replaced TS-991001 form.
const DIAGNOSTIC_CODE = /\b(?:NG\d+|TS-?\d+)\b/g;
```

**★ Symptom: an error in the log reads `TS-998001` and nothing on angular.dev has that number.** Cause: it is `NG8001` before the replacement ran. `replaceTsWithNgInErrors` is a **formatting** step applied to an already-rendered diagnostic string, so anything that captures diagnostics before or around that step sees the TypeScript form. Fix: strip the marker yourself when you consume raw codes — this is the inverse of `ngErrorCode`, written out here because Angular's own recovery helper body was not read for this page:

```ts
/** Recovers the Angular error code from a raw TypeScript diagnostic code. */
function angularCodeFromDiagnosticCode(code: number): number | null {
  const digits = String(Math.abs(code));
  return digits.startsWith('99') ? Number(digits.slice(2)) : null;
}

// angularCodeFromDiagnosticCode(-998001)  ->  8001
// angularCodeFromDiagnosticCode(-9911001) ->  11001
// angularCodeFromDiagnosticCode(2345)     ->  null  (a real TypeScript error)
```

**★ Symptom: your error has no `Find more at` line, and a teammate concludes the code is made up or the version is wrong.** Cause: `addDiagnosticDetails` appends that line only for codes whose `ErrorCode` member is declared negative, and only ten compiler codes are. Fix: nothing to fix in the build — look the message text up rather than the number. [10](10-metadata-errors-one-by-one.md) catalogues the families that have no page, and the message text is the stable identifier in all of them.

**Symptom: a build in a non-TTY CI runner prints `TS-99…` where an interactive run prints `NG…`.** Cause: read `ERROR_CODE_MATCHER` again — **both capture groups require the ANSI colour sequences**, so the replacement can only fire on a diagnostic string that was formatted with colour. ⚠️ I did not trace which formatter each build path selects, so treat this as the mechanism that explains a leaked `TS-99` code rather than a confirmed reproduction recipe. Fix either way: make your log consumer accept both forms, as above, rather than making the build produce one of them.

**Symptom: a script catches a compiler error and logs an empty message.** Cause: `FatalDiagnosticError` declares `message: never` specifically to push callers towards `diagnosticMessage`. Fix: read the structured field and render it through TypeScript's own formatter:

```ts
import ts from 'typescript';

try {
  runCompilation();
} catch (err) {
  const diagnostics = (err as {diagnostic?: ts.Diagnostic}).diagnostic;
  if (diagnostics !== undefined) {
    console.error(ts.formatDiagnosticsWithColorAndContext([diagnostics], formatHost));
  } else {
    throw err;
  }
}
```

**Symptom: you follow the error link, read the page, apply the fix, and the error persists.** Cause: the printed URL is version-pinned by `DOC_PAGE_BASE_URL` — `v22.angular.dev` on Angular 22 — but you searched instead and landed on the current major's page, which may describe a different rule. Fix: copy the URL out of the terminal rather than retyping the code into a search box. On a pre-release build the host is `next.angular.dev`, which is a stronger signal still that the page and your compiler are the same age.

**Symptom: `@ts-ignore` or `@ts-expect-error` above the line does not suppress an `NG` diagnostic.** Cause: those comments are implemented by TypeScript's checker for diagnostics the checker produces; Angular's diagnostics are produced by `NgCompiler` and merged into the same reporting surface afterwards. ⚠️ I could not confirm from the source read for this page whether `ngtsc` honours those comments in any code path, so this page does not claim they are universally ignored — but do not build a workflow on them. Fix: for template warnings there is a supported suppression path through `extendedDiagnostics.checks`, which is [15 · Extended diagnostics](15-extended-diagnostics.md); for compiler errors there is none, and the code has to change.

## Interview questions

**★ Angular's compiler produces diagnostics whose codes are negative and begin `-99`. Why?**
Because they are `ts.Diagnostic` objects and TypeScript's formatter hard-codes a `TS` prefix on the numeric code. Angular wanted `NG`. So it places every one of its codes in a range TypeScript will never use — negative, with a `99` marker scaled by the code's own digit count — formats the diagnostic through TypeScript, and then runs a regular expression over the rendered string replacing the literal sequence `TS-99` with `NG`. `NG1001` is `-991001` printed as `TS-991001` and patched. It is a twelve-line demonstration that Angular's error reporting is not Angular's own subsystem; it is TypeScript's, borrowed.

**★ Some `ErrorCode` members are negative and some positive. What does the sign mean, and how many negative ones are there?**
The sign means "this error has a documentation page". `errorCodeWithGuideFromDiagnosticCode` recovers the absolute code, negates it, and checks `ErrorCode[codeWithGuide] !== undefined` — a numeric enum's reverse mapping only contains the negative key if the member was *declared* negative. When it resolves, `addDiagnosticDetails` appends `Find more at <url>` to the message. At `v22.1.5` there are exactly ten: `-1001`, `-2003`, `-2009`, `-3003`, `-6100`, `-8001`, `-8002`, `-8003`, `-8023`, `-8024` — and angular.dev's compiler-errors table lists exactly those ten numbers. The sign is a hand-maintained index into the docs site with no automated check behind it.

**Why is the `99` marker multiplied by ten to the power of the code's digit count instead of being a constant offset?**
Because the goal is a decimal *string* of the form `99` followed by the code, not an arithmetic offset. `ngErrorCode` computes `99 * 10 ** decimalDigits(code) + code`, so `1001` becomes `991001` and `11001` becomes `9911001`. A constant offset would work only while every code had the same width; the moment the NG11xxx local-compilation family was added, a fixed offset would have produced codes that no longer began with the `TS-99` sequence the matcher looks for, and the replacement would have stopped firing for them.

**Does the sign of the enum member change the number the user sees?**
No, and this is the detail people get wrong. `ngErrorCode` calls `Math.abs(code)` before doing anything else, and `formatCompilerErrorCode` does the same, so a member declared `-8001` and one declared `8001` would both render as `NG8001`. The sign is invisible in the output and visible only to the lookup that decides whether to append the documentation link.

**You see `TS-9911001` in a log. What is it, and what does its presence tell you about how the log was produced?**
It is `NG11001`, `LOCAL_COMPILATION_UNRESOLVED_CONST`, before the `TS-99` to `NG` replacement. Its presence tells you the string you are reading was captured somewhere other than the final formatted output — the replacement is a post-formatting string operation, so anything reading `ts.Diagnostic.code` directly, or rendering diagnostics with its own formatter, gets the TypeScript form. The matcher also requires the ANSI colour sequences around the code, so a colourless rendering is a second candidate explanation. Either way the correct response is to make the consumer accept both forms rather than to change the build.

**Why does the compiler compute its documentation URL from the framework version at runtime?**
Because the encyclopedia is versioned. `DOC_PAGE_BASE_URL` reads `VERSION.full`, detects `-next`, `-rc` and the placeholder build, and produces `https://next.angular.dev` for pre-releases and `https://v22.angular.dev` for a released major. The link in your terminal therefore describes the compiler that produced the error, not the compiler that is current on the day you read it. The same computation is duplicated in `@angular/core` for runtime errors, with a doc comment ordering the two files kept in sync — which is a small but honest admission that the compiler and the runtime are separate packages that happen to agree.

**Why does `FatalDiagnosticError` declare `message` as `never`?**
To make reading it a type error, so that callers reach for `diagnosticMessage` instead. The comment says so outright: *"Trying to hide `.message` from `Error` to encourage users to look at `diagnosticMessage` instead."* `diagnosticMessage` is the structured `ts.DiagnosticMessageChain` with the node, the file, the position and any related information attached; `.message` on a plain `Error` is a flat string that loses all of it. Any tooling that catches compiler errors and logs `err.message` is discarding the diagnostic and keeping the wrapper.

---

← Prev: [13b · `ngc` is `tsc`, and the pin](13b-ngc-is-tsc-and-the-typescript-pin.md) · Index: [Topic index](README.md) · Next → [`compilationMode` and the local-compilation portability trap](13d-compilation-mode-and-the-local-portability-trap.md)
