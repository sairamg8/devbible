---
title: "Appendix B · You do not choose your React version in the App Router — Next.js pins a canary and ships it, and every upgrade decision follows from that one fact"
sidebar_label: "04 · Appendix B — the React upgrade blueprint"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods), the [Next.js Glossary](https://nextjs.org/docs/app/glossary), and the [React 19.2 announcement](https://react.dev/blog/2025/10/01/react-19-2) as cited by the upgrade guide.
> Target: **Next.js 16.3.4** · React **canary** (ships all stable 19.2 features) · Node.js **20.9+** · TypeScript **5.1+**. Documentation-verified; **no sandbox run, no timings**.

**Almost everyone reads their `package.json` to find out which React they are running, and in the App Router that number is not the answer. Next.js bundles a React canary release and uses it; your declared `react` and `react-dom` versions exist for tooling and ecosystem compatibility. That single fact reorders the whole upgrade problem: you cannot adopt a React feature by bumping React, you cannot hold React back by pinning it, and "which React are we on" is answered by which Next.js you are on. This appendix explains the pinning model, then gives the repeatable procedure for tracking canary features into your codebase — and [part 2](02b-appendix-b-the-15-to-16-migration-mechanically.md) walks the 15 → 16 migration mechanically, because that is the migration this book's readers are actually standing in front of.**

## 1 · What "React canary" means here

The docs state the arrangement twice, in two places, and both sentences matter:

> *"The `App Router` uses React canary releases built-in, which include all the stable React 19 changes, as well as newer features being validated in frameworks, but you should still declare react and react-dom in package.json for tooling and ecosystem compatibility."*

> *"The App Router in **Next.js 16** uses the latest React Canary release, which includes the newly released React 19.2 features and other features being incrementally stabilized."*

Unpack the first one, because it contains the whole model:

- **"built-in"** — the canary ships inside the framework. It is not resolved from your lockfile.
- **"all the stable React 19 changes"** — you are not on something experimental in the risky sense. Everything React has shipped stable is in there.
- **"as well as newer features being validated in frameworks"** — plus things React has *not* shipped stable, which frameworks are trialling on React's behalf. This is the part that is genuinely ahead of public React.
- 🔴 **"but you should still declare react and react-dom in package.json"** — and this is the trap. You declare them, so they look authoritative. They are not what runs your components.

### Why React does it this way

The canary channel exists so a framework can adopt a React feature before React commits to its public API. React Server Components themselves went through exactly this: usable in Next.js for years before any stable React release contained them. The bargain is that the framework absorbs the churn — you get the feature, and if React changes the API before stabilizing, the framework's next major carries the migration, not you.

The cost of the bargain is the one this appendix is about: **your React version is downstream of your Next.js version, and you have no independent lever on it.**

## 2 · What that means in practice, in four consequences

**You cannot adopt a React feature by upgrading React.** Bumping `react` in `package.json` changes what your test runner, type definitions and ecosystem packages resolve. It does not change what renders your components. If the feature is not in the canary your Next.js bundles, you do not have it.

**You cannot hold React back by pinning it.** The same mechanism in reverse. Pinning `react` to an older version does not stop the bundled canary from being used, and it will produce a type-level lie: your `@types/react` will describe a React you are not running.

**"Which React are we on?" is answered by which Next.js you are on.** The useful question in an incident is *"what does Next.js 16.3.4 bundle"*, and the answer is stated in the upgrade guide for the major, not discoverable from your lockfile.

**Your declared versions still matter — for everything except rendering.** Testing libraries, `@types/react`, ecosystem packages with React peer dependencies, and any tool that reads the dependency graph all use the declared versions. The upgrade guide's manual path installs all four together for exactly this reason:

```bash
npm install next@latest react@latest react-dom@latest
```

> *"If you are using TypeScript, ensure you also upgrade `@types/react` and `@types/react-dom` to their latest versions."*

⚠️ **Stated as uncertain:** the documentation does not publish a mapping from a given Next.js patch to the exact canary SHA it bundles. Do not construct one from memory. The reliable statement is the one the docs make — Next.js 16 uses the latest canary, which contains all stable React 19.2 features — and anything more precise needs to come from the release notes for your specific version.

## 3 · The React 19.2 spine you actually get on Next.js 16

The upgrade guide names three highlights, and they are worth knowing because each one is a thing you would otherwise reach for a library to do:

> * *"**View Transitions**: Animate elements that update inside a Transition or navigation"*
> * *"**`useEffectEvent`**: Extract non-reactive logic from Effects into reusable Effect Event functions"*
> * *"**Activity**: Render "background activity" by hiding UI with `display: none` while maintaining state and cleaning up Effects"*

`useEffectEvent` is the one that changes day-to-day code most, because it dissolves the most common `useEffect` dependency-array argument: the callback that must see fresh values but must not re-trigger the effect.

```tsx
'use client'
import { useEffect, useEffectEvent, useState } from 'react'

export function RoomLogger({ roomId, theme }: { roomId: string; theme: string }) {
  const [status, setStatus] = useState('disconnected')

  // Reads the latest `theme` without making the effect depend on it.
  const onConnected = useEffectEvent(() => {
    setStatus('connected')
    console.info(`joined ${roomId} with theme ${theme}`)
  })

  useEffect(() => {
    const socket = new WebSocket(`wss://chat.example.com/${roomId}`)
    socket.addEventListener('open', onConnected)
    return () => socket.close()
  }, [roomId]) // theme is deliberately absent — a theme change must not reconnect

  return <span>{status}</span>
}
```

Without `useEffectEvent` you either list `theme` and reconnect the socket on every theme change, or omit it and read a stale value. Both are wrong; the third option is the point of the API.

## 4 · The React Compiler — stable, and still not on

This is the React-adjacent decision most teams get wrong in the 16 upgrade, because "stable" and "default" are not the same word.

> *"Built-in support for the React Compiler is now stable in **Next.js 16** following the React Compiler's 1.0 release. The React Compiler automatically memoizes components, reducing unnecessary re-renders with zero manual code changes."*

> *"The `reactCompiler` configuration option has been promoted from `experimental` to stable. It is not enabled by default as we continue gathering build performance data across different application types."*

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
}

export default nextConfig
```

It needs a dev dependency of its own:

```bash
npm install -D babel-plugin-react-compiler
```

🔴 **And it has a stated cost, which is the reason it is off by default:**

> *"Expect compile times in development and during builds to be higher when enabling this option as the React Compiler relies on Babel."*

That last clause is the mechanism. Turbopack is the default bundler and does its own transforms in Rust; the React Compiler runs through Babel, so enabling it puts a JavaScript-speed step back into a Rust-speed pipeline. The trade is real: fewer re-renders at runtime, slower builds. Decide it with a number from your own CI, not from a blog post.

## 5 · The blueprint — a repeatable procedure for tracking canary → stable

This is the part to keep. It is four steps, and it runs once per Next.js major, not once per React release.

### Step 1 — establish what you are actually running

Not from `package.json`. From the upgrade guide for your Next.js major, which states the React relationship explicitly. Write the answer down somewhere durable, because the next person will read `package.json` and get it wrong.

### Step 2 — separate "in the canary" from "in stable React"

A feature can be in three states, and the state determines how much you should build on it:

| State | Means | Build on it? |
|---|---|---|
| Stable in React, in the canary | ordinary React | yes |
| In the canary, not yet stable in React | *"being validated in frameworks"* | yes, but expect the API to move in a Next.js major |
| Stable in React, but your Next.js major predates it | you do not have it | no — upgrading React will not give it to you |

The third row is the one that produces wasted afternoons.

### Step 3 — read the Next.js major's release notes for React content specifically

Next.js majors carry React migrations that are invisible in your own diff. The 16 guide's "React 19.2" section is exactly this: three features you gained without asking, and no code change required to have them.

### Step 4 — keep the declared versions honest anyway

Upgrade `react`, `react-dom`, `@types/react` and `@types/react-dom` alongside `next`, every time, even though the first two are not what renders. Skipping them produces the worst failure mode available: types that describe a different React from the one running, so the compiler confidently approves code that breaks at runtime.

## 6 · Where the version boundary actually bites

Three places, all documented, all outside React itself:

**Node.js.** *"Node.js 20.9+ | Minimum version now `20.9.0` (LTS); Node.js 18 no longer supported"*. This is a hard floor, not a recommendation.

**TypeScript.** *"TypeScript 5+ | Minimum version now `5.1.0`"*.

**Browsers.** *"Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+"*. 🔴 This one is easy to skip past and is the only item on the list your users experience rather than your build. Check it against your analytics before the upgrade, not after.

## Gotchas

**★ Symptom: you install a React feature's release version and it still does not exist at runtime.** Cause: the App Router renders with the canary Next.js bundles, not the `react` in your lockfile. Fix: there is no fix at the React level — the feature arrives with a Next.js version. Check the Next.js major's release notes, and if it is not there, wait for the major that carries it.

**★ Symptom: `@types/react` describes APIs your code cannot call, or the reverse.** Cause: the declared React and the bundled canary have drifted, usually because someone pinned `react` to "keep things stable". Fix: upgrade the declared versions in lockstep with `next`, and stop pinning React independently — the pin buys nothing and costs type accuracy.

```bash
npm install next@latest react@latest react-dom@latest
npm install -D @types/react@latest @types/react-dom@latest
```

**★ Symptom: a `useEffect` reconnects a socket every time an unrelated prop changes.** Cause: the callback reads a value that therefore has to be in the dependency array. Fix: move the non-reactive read into `useEffectEvent`, so the effect depends only on what should actually re-run it. The full example is in §3 above — the load-bearing detail is that `theme` is deliberately absent from the array.

**★ Symptom: you turn on `reactCompiler` and CI times jump.** Cause: it is documented — the compiler relies on Babel, which is a JavaScript step inside an otherwise Rust pipeline. Fix: this is a trade, not a bug. Measure both sides on your own app: runtime re-render reduction against build minutes, and decide with the number. If you keep it, budget the build time rather than treating it as a regression.

**★ Symptom: someone says "the React Compiler is stable now so it's on."** Cause: conflating stable with default. The docs promote `reactCompiler` out of `experimental` and in the same breath say *"It is not enabled by default."* Fix: check `next.config` before assuming either way; the two statements are both true and neither implies the other.

**★ Symptom: an upgrade passes locally and fails for a slice of real users with syntax errors.** Cause: the browser floor moved — Chrome/Edge/Firefox 111+, Safari 16.4+. Fix: check the floor against your analytics *before* the upgrade. This is the only item in the requirements table that fails in the field rather than in CI.

**★ Symptom: CI fails on Node 18 after the upgrade with no useful message.** Cause: Node 18 is no longer supported; the floor is 20.9.0. Fix: raise the runner's Node version first, as a separate change, so the two failures do not arrive together.

**★ Symptom: you plan a React upgrade as its own project, separate from the Next.js upgrade.** Cause: assuming the two are independently versioned. Fix: they are not, for rendering. Plan one upgrade — the Next.js major — and treat the React changes as part of its scope, because that is where they arrive.

**★ Symptom: a team is on Next.js 15 canary for PPR and wants React 19.2's `Activity`.** Cause: the two wants pull in opposite directions. The docs advise anyone using PPR today to stay on their current 15 canary rather than migrate half-way; but the 19.2 features arrive with 16. Fix: recognise it as a scheduling decision, not a technical one — the PPR migration and the React feature arrive in the same move, so do them together or neither.

## Interview questions

**★ Your `package.json` says `react: 19.2.0`. Is that what renders your App Router pages?**
No. The App Router uses a React canary release built into Next.js. The declared versions exist, in the docs' own words, *"for tooling and ecosystem compatibility"* — type definitions, testing libraries, peer-dependency resolution. What renders is whatever canary your Next.js version bundles, which includes all stable React 19 changes plus features React has not shipped publicly yet. The practical consequence is that the answer to "which React are we on" is "which Next.js are we on".

**★ Why would a framework ship a canary rather than a stable React?**
Because the canary channel is how React validates framework-facing APIs before committing to them publicly, and Server Components are the case that proves it — usable in Next.js for years before any stable React contained them. The framework takes on the churn in exchange for shipping the feature early. For a user of the framework, the deal is good as long as you understand where the churn surfaces: in Next.js majors, as migration steps, rather than in your own React upgrades.

**★ A colleague pins `react` to an older version to reduce upgrade risk. What do you tell them?**
That it does not do what they think. The pin does not change which React renders their components, so it buys no runtime stability at all. What it does buy is a mismatch between `@types/react` and the actual runtime, which is strictly worse than no pin — the type checker will approve code against a React that is not running. The way to control React risk in the App Router is to control which Next.js major you are on.

**★ The React Compiler is stable in Next.js 16. Should you turn it on?**
Only with a measurement. It is stable but deliberately not default, and the docs give the reason: they are still gathering build performance data. The trade is explicit — automatic memoization reduces unnecessary re-renders at runtime, and compile times in both dev and build go up because the compiler runs through Babel. That last part matters more than it sounds, because Turbopack is the default bundler and does its transforms in Rust; enabling the compiler puts a JavaScript-speed stage back into the pipeline. So: measure your own CI and your own re-render profile, and decide from the two numbers.

**★ What problem does `useEffectEvent` solve, and why could a dependency array not solve it?**
It separates the values an effect should *react* to from the values it merely needs to *read*. The classic case is an effect that opens a connection keyed on one prop while its callback reads a second prop. Put the second in the dependency array and every change tears down and rebuilds the connection; leave it out and the callback closes over a stale value. The dependency array has only those two positions, so it cannot express "read fresh but do not re-run". `useEffectEvent` extracts the non-reactive read into a separate function, and the effect's array then contains exactly what should retrigger it.

**★ How do you find out what React features a Next.js major brought you?**
The upgrade guide for that major, which has a section naming them — for 16 it names View Transitions, `useEffectEvent` and `Activity` and links the React 19.2 announcement. You do not find it from your lockfile, and you should not try to derive it from the React release calendar, because the canary can be ahead of stable React. If a claim needs to be exact — which canary build, which SHA — the honest answer is that the docs do not publish that mapping, and you would read the release notes for the specific version rather than construct it.

**★ Which parts of a Next.js 16 upgrade fail in CI, and which fail in production?**
CI catches the Node floor of 20.9, the TypeScript floor of 5.1, the removed synchronous Request APIs, the parallel-route `default.js` requirement, and a webpack config colliding with the default Turbopack build. Production is where the browser floor lands — Chrome, Edge and Firefox 111+, Safari 16.4+ — because no build step knows what your users run. That asymmetry is the argument for checking analytics against the browser matrix before the upgrade rather than after.

**★ Someone proposes upgrading React and Next.js in two separate PRs to reduce blast radius. Respond.**
For the App Router that split is illusory: the React that renders comes with Next.js, so the "React PR" changes only declared versions and types while the "Next.js PR" carries the actual React change. Worse, in between the two you have types describing one React and a runtime using another. The genuinely separable pieces are different — raise the Node version in its own change, run the async Request API codemod ahead of the major, and set the browser matrix expectation with the team — and then do `next`, `react`, `react-dom` and the two `@types` packages as one move.

---

← [Glossary, part 3 — the A–Z](01c-appendix-a-glossary-the-a-to-z.md) · [Chapter 20 overview](01-explanation.md) · Next → [Appendix B part 2 · the migration the build catches](02b-appendix-b-the-15-to-16-migration-mechanically.md)
