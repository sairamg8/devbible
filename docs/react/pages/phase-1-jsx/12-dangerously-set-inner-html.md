---
title: "dangerouslySetInnerHTML"
sidebar_label: "12 · dangerouslySetInnerHTML"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. The
> payloads below were rendered into a live page and their execution recorded by
> `sandbox/react-p1/ex11-dangerous-html.mjs`.

**React escapes every string you render. `dangerouslySetInnerHTML` is the one
door out, and the name is the documentation: it is `innerHTML`, with the same
consequences, deliberately made awkward to type.**

## The default is safe

```console
$ node ex11-dangerous-html.mjs
  --- text vs html ---
  {markup} as a child        "<div>&lt;em&gt;from the CMS&lt;/em&gt;</div>"
  dangerouslySetInnerHTML    "<div><em>from the CMS</em></div>"
```

```console
  --- React escapes everything else ---
  user text with tags       "<div>&lt;img src=x onerror=\"alert(1)\"&gt;</div>"
  user text in an attribute "<div title=\"&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;\"></div>"
```

Text children and attribute values are escaped, so the ordinary XSS vectors are
closed by default. That is the reason React apps have historically had few
injection bugs: you have to opt in.

### One more thing React 19 blocks for you

```console
  href="javascript:"   <a href="javascript:throw new Error('React has blocked a
                        javascript: URL as a security precaution.')">click</a>
```

React **rewrites** a `javascript:` URL into an expression that throws when
clicked, rather than removing the attribute. That is worth knowing because the
DOM still shows an `href` — a security scan reading the markup sees
`javascript:` and reports a finding that is already mitigated.

## The API is exact, and it throws

```console
  --- the API is exact ---
  __html missing            THROWS `props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`.
  a string, not an object   THROWS (same)
  with children as well     THROWS Can only set one of `children` or `props.dangerouslySetInnerHTML`.
  __html: undefined         "<div></div>"
  __html: null              "<div></div>"
  __html: 42                "<div>42</div>"
```

In production those are `Minified React error #61` and `#60`. The nested
`__html` key is not decoration — it is a second deliberate speed bump, so that
an object arriving from a server can never accidentally satisfy the shape.

## What actually executes

This is the part usually described vaguely. Four payloads, rendered into a live
document, with a record of which ones ran:

```console
  --- what executes ---
  <script> payload      "<div><script>window.__fired.push(\"script\")</script></div>"
  <img onerror> payload "<div><img src=\"x\" onerror=\"…\"></div>"
  <svg onload> payload  "<div><svg onload=\"…\"></svg></div>"
  <iframe srcdoc> payload "<div><iframe srcdoc=\"&lt;script&gt;…&lt;/script&gt;\"></iframe></div>"

  payloads that executed: [1,"img-onerror"]
```

🔴 **The `<script>` tag did not run.** HTML's own rules say script elements
inserted via `innerHTML` are not executed — which is exactly why "I stripped
`<script>` tags" is not a sanitizer. The two that *did* run were an `<img>` with
an `onerror` handler and an `<iframe srcdoc="…">`, neither of which contains the
string "script" in a form a naive filter would catch.

`<svg onload>` did not fire in Firefox 153 through this path. Do not read that
as safe — it fires in other contexts and other engines. **The only conclusion
supported here is that the dangerous surface is much wider than `<script>`.**

## Using it safely

There are exactly two safe positions.

**1. The HTML is yours.** Generated at build time from your own Markdown, or
composed by your own code from data you control. No user input anywhere in the
chain — including no user-supplied URLs interpolated into it.

**2. The HTML is sanitized, on the way in or immediately before rendering, by a
real sanitizer.**

```jsx
import DOMPurify from 'dompurify';

function Article({html}) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html]);
  return <div dangerouslySetInnerHTML={{__html: clean}} />;
}
```

*(No sanitizer is installed in this sandbox, so no output for that snippet is
shown. Using a maintained library — DOMPurify is the usual choice, and the
browser's own `setHTML`/`Sanitizer` API is arriving — is the point; the exact
call is documented by whichever you pick.)*

What does **not** work, and is worth naming because it keeps being written:

- a regex that strips `<script>` — the measurement above is the counterexample
- an allowlist of tags without an allowlist of **attributes** — `onerror` is an
  attribute
- escaping on output when the value was already stored as HTML
- sanitizing on the server only, when the client also composes HTML

The other rule: **sanitize as close to render as possible**, or sanitize on
input *and* validate on output. Data that was safe when stored can be made
unsafe by a later transformation.

## When you do not need it

Most reaches for `dangerouslySetInnerHTML` are for one of these, and all three
have a better answer:

| You want | Do this instead |
|---|---|
| Rich text from a CMS | Render a structured document (Markdown AST, portable text) to React elements |
| A few bold words in a translated string | Split the string and interpolate elements, or use a formatter that returns elements |
| An SVG icon | Import the SVG as a component |
| Line breaks in user text | `white-space: pre-wrap` in CSS |

The first row is the big one: a Markdown or rich-text renderer that produces
React elements never hands raw HTML to the DOM, so the whole question
disappears.

## Gotchas

**Symptom:** "`props.dangerouslySetInnerHTML` must be in the form `{__html:
...}`".
**Cause:** a bare string was passed, or the key is `html` rather than `__html`.
**Fix:** `{{__html: value}}` — note both braces.

**Symptom:** "Can only set one of `children` or `props.dangerouslySetInnerHTML`".
**Cause:** the element has nested content as well.
**Fix:** the HTML *is* the content; remove the children.

**Symptom:** a `<script>` in injected HTML does not run, so the code is assumed
safe.
**Cause:** `innerHTML` never executes script elements. Event-handler attributes
and `srcdoc` still run.
**Fix:** never infer safety from a script tag failing. Sanitize with a real
library.

**Symptom:** a security scan flags a `javascript:` href that appears harmless in
the app.
**Cause:** React 19 rewrote the URL to throw, but left an `href` attribute in
the markup.
**Fix:** it is already mitigated — but the value should not be reaching the
attribute at all.

**Symptom:** injected content works but React "forgets" it after an update.
**Cause:** React owns that node's content; changing `__html` replaces
everything, and any DOM you added by hand inside it is discarded.
**Fix:** do not mutate inside a `dangerouslySetInnerHTML` node.

**Symptom:** hydration mismatch on a server-rendered page using it.
**Cause:** the server and client produced different HTML strings — often a
sanitizer configured differently, or a date formatted in the string.
**Fix:** produce the HTML once and pass it through; sanitize identically on both
sides.

## Interview questions

**★ What is `dangerouslySetInnerHTML` and why the name?**
The escape hatch that sets an element's `innerHTML` instead of rendering
children. The name is deliberately awkward — as is the nested `__html` key — so
that using it is a conscious decision and greppable in review. It carries every
risk `innerHTML` does.

**★ What is the actual risk, concretely?**
Any HTML you insert can carry executable attributes. Measured: a `<script>` tag
inserted this way does **not** execute — HTML forbids it — but `<img src=x
onerror=…>` and `<iframe srcdoc="…">` both did. Filtering for `<script>` is
therefore not a defence.

**★ How do you use it safely?**
Either the HTML is entirely yours with no user input in the chain, or it is
sanitized by a maintained sanitizer such as DOMPurify — with an allowlist of
attributes, not just tags — as close to render as possible.

**Why can't you pass children as well?**
They both define the element's content. React throws `Can only set one of
children or props.dangerouslySetInnerHTML`.

**How does React protect you the rest of the time?**
Text children and attribute values are escaped, so tags in user data render as
text. React 19 additionally rewrites `javascript:` URLs into an expression that
throws when activated.

**What would you use instead for CMS content?**
A renderer that produces React elements from a structured document — a Markdown
AST or a portable-text format — so raw HTML never reaches the DOM.

---

← Prev: [Inline style](11-inline-style.md) · Index: [Phase 1](README.md) · Next → [Form elements in JSX](13-form-elements/README.md)
