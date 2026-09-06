import React, {useSyncExternalStore} from 'react';
import Link from '@theme-original/DocSidebarItem/Link';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from '@site/src/components/StudyMode/store';
import {tierByCode} from '@site/src/data/tiers.mjs';
import '../studyMode.module.css';

/**
 * A sidebar page row, with its priority tier and whether it has been read.
 *
 * Both marks are attributes on the anchor, styled from `studyMode.module.css`.
 * Nothing about the theme's Link is re-implemented.
 *
 * ── 🔴 Why attributes and not a className ────────────────────────────────────
 * The theme's Link builds the anchor as
 *
 *   <Link className={clsx('menu__link', …)} … {...props}>
 *
 * with the spread LAST. Passing `className` through `props` therefore does not
 * merge with `menu__link` — it replaces it, and the row loses every scrap of
 * Infima's menu styling. (The `<li>` is the opposite case: `item.className` IS
 * clsx-merged, which is the hook a wrapper uses when it needs the list item.)
 * `data-*` attributes ride the same spread with none of that risk, and they read
 * back off the DOM, which makes the whole feature debuggable from devtools.
 *
 * ── Hydration ────────────────────────────────────────────────────────────────
 * The tier comes from `customProps`, which is baked into the sidebar at build
 * time, so dots are in the static HTML and survive hydration untouched.
 *
 * `visited` cannot be: it lives in localStorage, which the static render has no
 * access to. The store's `getServerSnapshot` hands back an EMPTY visited set, and
 * the first client render sees the same empty set — the marks appear one frame
 * later when `hydrate()` runs from an effect. That is why there is no `hydrated`
 * check below: an unhydrated store simply has nothing in the set, and testing for
 * it would only restate what the store already guarantees.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────────
 * Every rendered link subscribes to the store, so a store change notifies one
 * listener per row currently on screen — up to ~2,200 with expand-all on Java.
 * The alternative is a context provider, which needs a third swizzle to wrap both
 * sides of the tree; a Set add/remove per mount and a re-render per navigation is
 * the cheaper of the two. The rows themselves are lazy: the theme's Collapsible
 * does not mount a collapsed category's children at all.
 */
export default function DocSidebarItemLinkWrapper({item, ...props}) {
  const {visited} = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const tier = tierByCode(item.customProps?.tier);
  const read = Boolean(item.docId) && visited.has(item.docId);

  return (
    <Link
      item={item}
      {...props}
      {...(tier && {'data-db-tier': tier.code})}
      {...(read && {'data-db-read': ''})}
      title={describe(tier, read)}
    />
  );
}

/**
 * 🔴 The dot is a 7px circle whose only difference from its neighbours is hue.
 * That is a colour-only signal, which is no signal at all for a reader who cannot
 * separate the accent green from the amber — so the same fact is also carried in
 * text here.
 *
 * `title` rather than `aria-label`: `aria-label` would REPLACE the link's
 * accessible name, so the row would announce as "Master" instead of the page it
 * goes to. `title` supplements the name as a description and shows on hover for
 * everyone else. Untiered and unread rows get no title at all — an empty tooltip
 * on 289 pages is worse than none.
 */
function describe(tier, read) {
  if (tier && read) return `${tier.label} · read`;
  if (tier) return tier.label;
  if (read) return 'Read';
  return undefined;
}
