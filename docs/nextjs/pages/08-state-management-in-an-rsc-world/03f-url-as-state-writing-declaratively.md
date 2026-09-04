---
title: "A filter chip should be an anchor and a search box should be a GET form — the two declarative writers survive without JavaScript, can be prefetched, and are the only ones a crawler can follow"
sidebar_label: "03f · Writing the URL declaratively"
sidebar_position: 124
description: "The four ways to write a query param compared, then Link and next/form in depth: why scroll={false} matters on a filter, the sticky-header scroll trap, and why a GET form silently drops every param it does not carry."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`Link`](https://nextjs.org/docs/app/api-reference/components/link) (`lastUpdated: 2026-08-25`),
> [`Form`](https://nextjs.org/docs/app/api-reference/components/form) (`lastUpdated: 2026-08-25`) and
> [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**Reading the URL has one mechanism. Writing it has four, and the choice is not stylistic: they differ in whether they survive without JavaScript, whether they can be prefetched, and — the dimension that actually decides it — whether the server is asked to re-render. Two of the four are declarative and should be your default: a filter chip is an anchor, and a search box is a GET form. Both are real HTML that works before hydration, both can be prefetched, and both put the framework's navigation machinery to work instead of reimplementing it in an event handler.**

## The four writers, compared

| Mechanism | Server re-renders? | History entry | Works without JS | Prefetchable | Use it for |
|---|---|---|---|---|---|
| `<Link href="?status=open">` | ✅ | push (default) | ✅ — it is an `<a>` | ✅ | Filter chips, tabs, pagination |
| `next/form` with a string `action` | ✅ | push, or replace with `replace` | ✅ — a real GET form | ✅ | Search boxes, multi-field filter forms |
| `router.push` / `router.replace` | ✅ | push / replace | ❌ | ❌ | Programmatic updates from a control that is not a link |
| `window.history.pushState` / `replaceState` | ❌ | push / replace | ❌ | n/a | Client-only URL sync: a slider, a map viewport, a client-side sort |

The bottom two are [03g](03g-url-as-state-writing-programmatically.md). This page is the top two, which are where you should start — and the reason is the middle two columns. A filter bar built from `onClick` handlers is invisible to a crawler, dead before hydration, and cannot be prefetched, which forfeits the one advantage URL state has over client state.

## `<Link>` — the default, and the only one that can be prefetched

```tsx filename="app/[tenant]/board/filter-bar.tsx"
import Link from 'next/link'

export function FilterBar({ active }: { active: string }) {
  return (
    <nav aria-label="Filter by status">
      <Link href="?status=open" scroll={false} aria-current={active === 'open' ? 'page' : undefined}>
        Open
      </Link>
      <Link href="?status=blocked" scroll={false} aria-current={active === 'blocked' ? 'page' : undefined}>
        Blocked
      </Link>
      <Link href="?status=archived" scroll={false} aria-current={active === 'archived' ? 'page' : undefined}>
        Archived
      </Link>
    </nav>
  )
}
```

A bare `?status=open` href is relative to the current path, so the same component works on every route it is dropped into. **What it does not do is merge with the existing query string** — it replaces it. Preserving sibling params means building the href:

```tsx filename="app/[tenant]/board/filter-bar.tsx"
import Link from 'next/link'

export function FilterBar({ current }: { current: Record<string, string> }) {
  function hrefWith(patch: Record<string, string>) {
    const params = new URLSearchParams(current)
    for (const [k, v] of Object.entries(patch)) params.set(k, v)
    return `?${params.toString()}`
  }

  return (
    <nav aria-label="Filter by status">
      <Link href={hrefWith({ status: 'open' })} scroll={false}>Open</Link>
      <Link href={hrefWith({ status: 'blocked' })} scroll={false}>Blocked</Link>
    </nav>
  )
}
```

The docs show the equivalent with a `useCallback`-memoised `createQueryString` helper reading `useSearchParams()`; building it from a server-passed object as above avoids the client-side bailout entirely ([03e](03e-url-as-state-reading-from-a-client-component.md)).

### `scroll={false}` matters more on a filter than anywhere else

> *"**Defaults to `true`.** The default scrolling behavior of `<Link>` in Next.js **is to maintain scroll position**, similar to how browsers handle back and forwards navigation. When you navigate to a new Page, scroll position will stay the same as long as the Page is visible in the viewport. However, if the Page is not visible in the viewport, Next.js will scroll to the top of the first Page element."*
> *"When `scroll = {false}`, Next.js will not attempt to scroll to the first Page element."*
> — [`Link`, `scroll`](https://nextjs.org/docs/app/api-reference/components/link#scroll)

Read the condition: *"if the Page is not visible in the viewport"*. A long board scrolled halfway is exactly that case, so a filter chip click throws the reader back to the top. A normal link earns that behaviour — you arrived somewhere new. A filter does not.

The selection algorithm has a documented consequence that produces a subtler bug:

> *"Next.js checks if `scroll: false` before managing scroll behavior. If scrolling is enabled, it identifies the relevant DOM node for navigation and inspects each top-level element. All non-scrollable elements and those without rendered HTML are bypassed, this includes sticky or fixed positioned elements, and non-visible elements such as those calculated with `getBoundingClientRect`."*
> — same section

Because sticky and fixed elements are skipped, the chosen target can end up underneath a sticky header:

```css filename="app/globals.css"
html {
  scroll-padding-top: 64px; /* Match the height of your sticky header */
}
```

> *"This is a browser CSS property that offsets scroll-based positioning. It applies whenever Next.js uses the native `scrollIntoView()` API, including hash fragment (`#id`) navigation."*
> — [`Link`, Disable scrolling to the top of the page](https://nextjs.org/docs/app/api-reference/components/link#disable-scrolling-to-the-top-of-the-page)

## `next/form` — the search box that works without JavaScript

```tsx filename="app/[tenant]/board/search-form.tsx"
import Form from 'next/form'

export function SearchForm({ status, sort }: { status: string; sort: string }) {
  return (
    <Form action="" replace scroll={false}>
      <input name="q" aria-label="Search tasks" />
      {/* a GET form submits only its own fields — carry what must survive */}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="sort" value={sort} />
      <button type="submit">Search</button>
    </Form>
  )
}
```

> *"The `<Form>` component extends the HTML `<form>` element to provide **prefetching** of loading UI, **client-side navigation** on submission, and **progressive enhancement**."*
> *"It's useful for forms that update URL search params as it reduces the boilerplate code needed to achieve the above."*
> — [`Form`](https://nextjs.org/docs/app/api-reference/components/form)

> *"When `action` is a **string**, the `<Form>` behaves like a native HTML form that uses a **`GET`** method. The form data is encoded into the URL as search params, and when the form is submitted, it navigates to the specified URL."*
> — [`Form`, Reference](https://nextjs.org/docs/app/api-reference/components/form)

> *"An empty string `""` will navigate to the same route with updated search params."*
> — [`Form`, `action` (string) Props](https://nextjs.org/docs/app/api-reference/components/form)

Two things it adds over a bare `<form method="get">`:

> *"Prefetches the path when the form becomes visible, this preloads shared UI (e.g. `layout.js` and `loading.js`), resulting in faster navigation."*
> *"Performs a client-side navigation instead of a full page reload when the form is submitted. This retains shared UI and client-side state."*
> — same section

Its four string-action props map exactly onto the decisions this chapter has been making: `action` (where to go, `""` for here), `replace` (history semantics — `false` by default, so a search box wants `replace`), `scroll` (defaults to `true`, so a filter form wants `scroll={false}`), and `prefetch` (defaults to `true`, on viewport entry).

🔴 **The hidden inputs are not optional.** A GET form submits only its own fields, so any query param the form does not carry is dropped on submit. That is the single most common `next/form` bug and it presents to users as *"searching clears my filters"*.

### The caveats that bite

- **`method`, `encType` and `target` are unsupported** — they *"override `<Form>` behavior"*. For a genuine POST, pass a *function* action (a Server Action) or use a plain `<form>`.
- **`onSubmit` with `preventDefault()` cancels the navigation**: *"calling `event.preventDefault()` will override `<Form>` behavior such as navigating to the specified URL."*
- **`key` on a string action is unsupported**: *"Passing a `key` prop to a string `action` is not supported. If you'd like to trigger a re-render or perform a mutation, consider using a function `action` instead."*
- **`formAction` on a button overrides `action` but forfeits prefetching**: *"Next.js will perform a client-side navigation, however, this approach doesn't support prefetching."*
- **File inputs submit the filename**: *"Using this input type when the `action` is a string will match browser behavior by submitting the filename instead of the file object."*
- **With a function action, `replace` and `scroll` are ignored** — there is no navigation to control.

## Gotchas

**★ Symptom: submitting the search form wipes the status filter.** Cause: a GET form submits only its own fields, so every other query param disappears. Fix: carry the survivors as hidden inputs.

```tsx
<Form action="" replace scroll={false}>
  <input name="q" />
  <input type="hidden" name="status" value={status} />
  <input type="hidden" name="sort" value={sort} />
</Form>
```

**★ Symptom: clicking a filter chip loses the sort order.** Cause: `href="?status=open"` replaces the whole query string rather than merging into it. Fix: build the href from the current params.

```tsx
const params = new URLSearchParams(current)
params.set('status', 'open')
<Link href={`?${params.toString()}`} scroll={false}>Open</Link>
```

**★ Symptom: the page jumps to the top every time a filter chip is clicked.** Cause: the default scroll behaviour scrolls to the first Page element when the Page is not visible in the viewport — exactly what a long list produces. Fix: `scroll={false}`.

```tsx
<Link href="?status=blocked" scroll={false}>Blocked</Link>
```

**★ Symptom: after a filter change the first rows are hidden behind the sticky header.** Cause: Next.js skips sticky and fixed elements when choosing a scroll target, so it scrolls to content the header then covers. Fix: offset the scroll container in CSS.

```css
html { scroll-padding-top: 64px; }
```

**★ Symptom: `onSubmit` on a `next/form` runs but the navigation never happens.** Cause: the handler called `event.preventDefault()`, which overrides the component's navigation behaviour. Fix: do the side effect without cancelling.

```tsx
<Form action="" onSubmit={() => track('search_submitted')}>   {/* ✅ no preventDefault */}
```

**★ Symptom: `<Form method="post">` silently behaves like a GET.** Cause: `method`, `encType` and `target` are unsupported because they override the component's behaviour. Fix: for a real mutation, pass a function action; for anything the component cannot express, use a plain `<form>`.

```tsx
<Form action={createTask}>{/* ✅ function action = Server Action */}</Form>
```

**★ Symptom: a file input on a search form uploads nothing — the server sees a filename string.** Cause: with a string action the component matches browser GET behaviour, which submits the filename. Fix: a file upload is a mutation; give the form a function action.

```tsx
<Form action={uploadAttachment}><input type="file" name="file" /></Form>
```

**★ Symptom: a `formAction` button on a search form is slower than the main submit button.** Cause: `formAction` overrides `action` and still performs a client-side navigation, but it does not support prefetching. Fix: if the alternate destination matters for speed, make it a `<Link>` or a second form with its own `action`.

**★ Symptom: adding `key` to a `<Form>` to reset it after a search does nothing.** Cause: `key` on a string action is not supported. Fix: reset the field explicitly, or move to a function action if you genuinely need remount semantics.

```tsx
<Form action="" onSubmit={(e) => { /* imperatively clear the input after submit */ }}>
```

## Interview questions

**★ Compare the four ways to put a value in the query string.**
`<Link>` is a real anchor: it works without JavaScript, is prefetchable, and pushes a history entry by default — the right choice for filter chips, tabs and pagination. `next/form` with a string action is a GET form: also progressively enhanced, also prefetchable, and it collects several fields at once, which makes it the right shape for a search box — at the cost that it submits only its own fields, so surviving params need hidden inputs. `useRouter().push`/`replace` is the programmatic escape hatch for controls that are not links; it triggers a server re-render and gives you `replace` semantics, but it is invisible to a crawler and dead without JavaScript. `window.history.pushState`/`replaceState` changes the URL and notifies `usePathname`/`useSearchParams` **without** re-rendering Server Components — the App Router's only shallow update.

**★ Why does `scroll={false}` matter more on a filter than on a normal link?**
Because a filter change is not a change of place. The default behaviour maintains scroll position only while the Page element is visible in the viewport; once the user has scrolled far enough down a long list that the Page element is out of view, the next navigation scrolls to the top of it. On a normal link that is desirable — you arrived somewhere new. On a filter chip it throws the user back to the top of a list they were reading, and the further they had scrolled, the more certain it is to happen. The bug therefore gets worse exactly as the list gets more useful.

**★ Why can `next/form` not do a POST?**
Because a string `action` is defined to behave like a native GET form — the fields are encoded into the URL as search params and the component navigates there — and `method`, `encType` and `target` are explicitly unsupported because they would override that behaviour. The component's entire value is that it turns form fields into a URL. When you want a mutation rather than a query, you pass a *function* action, at which point it behaves like a React form and runs a Server Action on submit, and the `replace` and `scroll` props are ignored because there is no navigation to control.

**★ A colleague builds the filter bar out of `<button onClick={...}>` handlers. What did that cost?**
Four things, all of which the anchor gives away for free. It is invisible to a crawler, so a filtered view can never be indexed or shared as a discoverable URL. It does nothing before hydration, so a slow connection sees a filter bar that visibly does not work. It cannot be prefetched, which forfeits the single largest performance advantage URL state has — the framework being able to render the destination with the filter resolved before the click. And it loses middle-click, ctrl-click and "copy link address", which users of a data table expect to work.

**★ Why does `href="?status=open"` lose the sort order, and what is the fix?**
Because a query-only href replaces the entire query string rather than merging into it — it is a new URL that happens to share a path, not a patch. The fix is to construct the href from the current parameters: copy them into a fresh `URLSearchParams`, set the one key the chip owns, and serialise. Doing that from a value the *server* passed down is better than reading `useSearchParams()` in the filter bar, because the hook would client-side render the bar up to its nearest `Suspense` boundary while a prop costs nothing.

---

← [03e · Reading the URL from a client component](03e-url-as-state-reading-from-a-client-component.md) · [Chapter 8 overview](01-explanation.md) · Next → [03g · Writing the URL programmatically](03g-url-as-state-writing-programmatically.md)
