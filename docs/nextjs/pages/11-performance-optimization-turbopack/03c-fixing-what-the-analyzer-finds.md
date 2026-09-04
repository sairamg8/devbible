---
title: "The biggest single client-bundle win is usually not a config flag — it is noticing that a library which exists only to turn data into markup is sitting on the wrong side of the client boundary"
sidebar_label: "03c · Fixing what it finds"
sidebar_position: 115
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [package bundling guide](https://nextjs.org/docs/app/guides/package-bundling)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-06-01`).
> Documentation-verified; **no sandbox run, no bundle measured, no byte counts here**.
> Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**An analyzer produces a list of large modules; turning that list into a smaller bundle needs you to recognise
which of four shapes each one is.** Three of them have a configuration answer — `optimizePackageImports` for
packages with hundreds of exports, `serverExternalPackages` for server dependencies that should not be bundled,
`next/dynamic` for code only some users reach. **The fourth has no flag at all, and it is the one with the
largest payoff**: expensive rendering work sitting in a Client Component that never needed to be there. This
page is that fourth case, worked through the example the Next.js guide itself leads with — syntax highlighting
moved from `prism-react-renderer` in the browser to `shiki` on the server — plus the design cost that move
imposes. Reading the analyzer to work out which shape you have is
[03b](03b-the-two-analyzers-and-how-to-read-them.md); the two configuration flags are
[03d](03d-package-imports-and-server-externals.md); deferring what genuinely must stay on the client is
[03e](03e-next-dynamic-and-lazy-loading.md).

## 🔴 The heavy client workload — the fix with no flag

This is the guide's own headline case, and the reason it is first here is that no amount of tree-shaking
configuration touches it.

> *"A common cause of large client bundles is doing expensive rendering work in Client Components. This often
> happens with libraries that exist only to transform data into UI, such as syntax highlighting, chart
> rendering, or markdown parsing."*
> *"If that work does not require browser APIs or user interaction, it can be run in a Server Component."*

**Before — the library ships to every visitor.** A code block rendered with `prism-react-renderer` inside a
Client Component:

```tsx
// components/code-block.tsx
'use client'

import { Highlight, themes } from 'prism-react-renderer'

export function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <Highlight theme={themes.nightOwl} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre className={className} style={style}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}
```

> *"Even though the final output is just a `<code>` block, the entire highlighting library is bundled into the
> client JavaScript bundle"*
> *"This increases bundle size because the client must download and execute the highlighting library, even
> though the result is static HTML."*

**After — the library never crosses the boundary.** The guide's instruction is direct:

> *"Instead, move the highlighting logic to a Server Component and render the final HTML on the server. The
> client will only receive the rendered markup."*

```tsx
// components/code-block.tsx  — no 'use client'; this is a Server Component
import { codeToHtml } from 'shiki'

export async function CodeBlock({ code, language }: { code: string; language: string }) {
  // The Shiki package runs on the server and is never bundled for the client.
  const html = await codeToHtml(code, { lang: language, theme: 'night-owl' })
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
```

**Why this is the highest-leverage change available.** The config flags on
[03d](03d-package-imports-and-server-externals.md) make a dependency *smaller* in the client graph. This
removes it from the client graph entirely — the browser downloads markup, not a tokenizer and a grammar set.
The test for whether a component qualifies is the guide's own sentence: does
the work *"require browser APIs or user interaction"*? Syntax highlighting does not. Nor does markdown
rendering, static chart rendering to SVG, date formatting for display, or table sorting that could have
happened before the data was serialised.

⚠️ **The component becomes `async` and stops being usable inside a Client Component.** That is the real cost of
this refactor and it is a design change, not a config change: a Server Component can render a Client Component,
but not the other way round. If a client-side panel needs a highlighted block, pass the rendered element in as
`children` from the server rather than importing the server component into the client one.

```tsx
// app/docs/[slug]/page.tsx — the server assembles, the client wraps.
import { InteractivePanel } from '@/components/interactive-panel' // 'use client'
import { CodeBlock } from '@/components/code-block'               // server, async

export default async function Page({ params }: PageProps<'/docs/[slug]'>) {
  const { slug } = await params
  const doc = await getDoc(slug)
  return (
    <InteractivePanel title={doc.title}>
      {/* rendered on the server, passed through as children */}
      <CodeBlock code={doc.example} language="tsx" />
    </InteractivePanel>
  )
}
```

## Gotchas

**★ Symptom: a syntax-highlighting, charting or markdown library dominates the client bundle even though the
output is static.** Cause: it is imported from a `'use client'` component, so *"the entire highlighting library
is bundled into the client JavaScript bundle"* even though *"the final output is just a `<code>` block."* Fix:
move the transformation to a Server Component and send markup.

```tsx
// components/code-block.tsx — Server Component, no 'use client'
import { codeToHtml } from 'shiki'

export async function CodeBlock({ code, language }: { code: string; language: string }) {
  const html = await codeToHtml(code, { lang: language, theme: 'night-owl' })
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
```

**★ Symptom: after moving a component to the server, importing it from a Client Component throws or the
`async` component will not render.** Cause: a Client Component cannot import and render an async Server
Component — the direction only works one way. Fix: render it on the server and pass it down as `children`.

```tsx
// ❌ inside a 'use client' file
import { CodeBlock } from '@/components/code-block' // async Server Component

// ✅ in the server page
<InteractivePanel>
  <CodeBlock code={doc.example} language="tsx" />
</InteractivePanel>
```

**Symptom: a shared `lib/` module put a server-only library into the client graph.** Cause: the module is
imported from both environments, so everything it imports at module scope crosses too. Fix: split the module by
environment rather than by topic — the heavy import lives in a file only Server Components import.

```ts
// ❌ lib/content.ts — imported from both sides
export { codeToHtml } from 'shiki'
export function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, '-') }

// ✅ lib/content.ts keeps the shared pure helper …
export function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, '-') }

// ✅ … and lib/highlight.server.ts holds the heavy import.
import { codeToHtml } from 'shiki'
export async function highlight(code: string, lang: string) {
  return codeToHtml(code, { lang, theme: 'night-owl' })
}
```

**Symptom: the highlighted markup renders but a code sample containing HTML shows up mangled or as live
markup.** Cause: `dangerouslySetInnerHTML` inserts whatever string you give it, so the safety depends entirely
on the highlighter escaping the code it was handed. Fix: pass the raw source string straight to `codeToHtml`
and insert only its return value — never concatenate your own markup, interpolate user content into the HTML
string, or hand it a fragment you assembled yourself.

```tsx
// ✅ the highlighter owns the whole string
const html = await codeToHtml(code, { lang: language, theme: 'night-owl' })
return <div dangerouslySetInnerHTML={{ __html: html }} />

// ❌ never assemble around it
// const html = `<div class="wrap">${userSuppliedCaption}${await codeToHtml(code, opts)}</div>`
```

**Symptom: moving work to the server made the route slower even though the bundle shrank.** Cause: you moved
CPU work from a thousand browsers onto one server, and if it happens per request on an uncached route the
server now does it every time. Fix: make sure the result is cached or statically generated — the win is real
when the output is stable per input, which is exactly the case for highlighting a code sample stored in
content.

## Interview questions

**★ The analyzer shows a syntax-highlighting library in the client bundle. Walk me through the fix.**
The first question is whether the work needs the browser at all — the guide's test is whether it *"require[s]
browser APIs or user interaction."* Highlighting does not: it takes a string and produces markup. So the fix is
architectural rather than configuration: drop the `'use client'` directive, do the transformation in an async
Server Component with something like `shiki`'s `codeToHtml`, and render the resulting HTML. The client then
downloads markup instead of a tokenizer and its grammars. The cost to be honest about is that the component
becomes async and therefore cannot be imported by a Client Component — if a client-side wrapper needs it,
render it on the server and pass it through as `children`.

**★ When is moving work to a Server Component the wrong answer?**
When the work needs the browser, or when it needs to happen per interaction. Anything touching the DOM,
measuring layout, reading `window`, responding to typing or drag — that has to stay on the client, and the
lever there is deferral rather than relocation. The other case is cost transfer: the transformation you moved
now runs on your server, once per request, unless the route is cached or statically generated. For content that
is stable per input — a code sample, a stored markdown document — that is a clear win. For something computed
from per-request user input on an uncached route, you have traded client bytes for server CPU and should say so
out loud before shipping it.

**★ The server version renders with `dangerouslySetInnerHTML`. Is that not a security problem?**
It is the point at which you have to be able to say where the HTML came from. In this pattern the entire string
is produced by the highlighter from a source string you handed it, and a highlighter's job includes escaping the
code it is given — so the safety property is "the library owns the whole string". It stops holding the moment
you concatenate anything of your own around it, interpolate a user-supplied caption into it, or pass it a
fragment you assembled. The reviewable rule is therefore mechanical rather than judgemental: the argument to
`__html` must be a single call's return value, never a template literal.

**How does moving a component to the server change the shape of the tree around it?**
It inverts who imports whom. A Client Component cannot import and render an async Server Component, so anything
that used to sit inside a client wrapper has to be lifted: the server assembles the element and passes it down
as `children`, and the client wrapper renders `{children}` without knowing what is in it. That is usually a
better structure anyway — the interactive shell stops depending on the content it displays — but it is a real
refactor with a real cost, and it is the reason "just move it to the server" is sometimes a bigger change than
it sounds.

**Which libraries are worth checking for this pattern first?**
The guide names the category: libraries *"that exist only to transform data into UI, such as syntax
highlighting, chart rendering, or markdown parsing."* The test is whether the library's output is inert markup.
Syntax highlighters, markdown and MDX renderers, static chart-to-SVG generators, date and number formatters for
display, table sorting and grouping — all candidates. What is not a candidate is anything that reads the DOM,
attaches listeners, animates, or responds to input after the first paint, which is why an interactive charting
library usually has to stay on the client even though a static chart renderer does not.

---

← [03b · The two analyzers](03b-the-two-analyzers-and-how-to-read-them.md) · [Chapter index](01-explanation.md) · Next → [03d · Package imports and server externals](03d-package-imports-and-server-externals.md)
