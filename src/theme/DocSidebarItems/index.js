import React, {useEffect, useMemo, useSyncExternalStore} from 'react';
import DocSidebarItems from '@theme-original/DocSidebarItems';
import {
  subscribe as subscribeCollapse,
  getSnapshot as getCollapseSnapshot,
  getServerSnapshot as getCollapseServerSnapshot,
  applyCollapsed,
} from '@site/src/components/SidebarCollapseAll/store';
import {
  subscribe as subscribeStudy,
  getSnapshot as getStudySnapshot,
  getServerSnapshot as getStudyServerSnapshot,
  hydrate,
} from '@site/src/components/StudyMode/store';
import {ALL_TIERS, TIER_CODES, isAtOrAbove} from '@site/src/data/tiers.mjs';

/**
 * The one place the sidebar item tree is rewritten before the theme renders it.
 *
 * Two independent controls land here:
 *
 *   collapse/expand-all   rewrites every category's `collapsed` flag
 *   Study Mode's floor    removes everything below the chosen tier
 *
 * Both are whole-tree rewrites, both are pure functions of (items, setting), and
 * both need the tree remounted afterwards — so they share one transform, one
 * memo and one `key`.
 *
 * ── Why the root, and only the root ──────────────────────────────────────────
 * `DocSidebarItems` re-enters itself once per expanded category (the theme's
 * Category renders `<DocSidebarItems level={level + 1}>` inside its Collapsible),
 * so this wrapper runs at every level of a tree that reaches six deep and 2,186
 * links on Java. Rewriting at each level would mean:
 *
 *   • the same subtree pruned once for every ancestor above it — O(n · depth)
 *     work per render instead of O(n) once;
 *   • a fresh `items` array handed to every nested instance, which defeats the
 *     `memo()` the theme puts on `DocSidebarItems` at *every* level (it compares
 *     props by reference, and that memo is the reason a route change does not
 *     re-render the whole tree);
 *   • nested remount keys, so a floor change would tear down subtrees inside
 *     subtrees instead of the tree once.
 *
 * The rewrite is recursive, so one pass at the root leaves every deeper instance
 * with items that are already correct and already reference-stable.
 *
 * ── The level test ───────────────────────────────────────────────────────────
 * The root is `level === 1` on desktop, and the mobile drawer passes `level={1}`
 * too in 3.10.2 — but it has passed nothing in the past, and testing `level !== 1`
 * would then quietly switch both controls off in the drawer without failing.
 * Nested levels are always explicit (`level + 1`, which is `NaN` under an
 * undefined root), so "null or 1" identifies the root in either shape.
 */
function isRootLevel(level) {
  return level == null || level === 1;
}

/**
 * Would anything inside this category survive the floor?
 *
 * 🔴 Answered from `customProps.tiers` — the subtree tally the sidebar generator
 * attached at build time — and never by descending into `item.items`. Java's
 * phase 10 has 585 descendants; deciding by tally means a branch that is entirely
 * below the floor costs one object lookup to drop instead of a 585-node walk.
 *
 * An item with no tally is kept. That is deliberate: `tiers` is absent only for
 * items the generator did not decorate, and hiding something the tier map has no
 * opinion about would make it unreachable rather than deferred.
 */
function categoryHasSurvivor(item, floor) {
  const tiers = item.customProps?.tiers;
  if (!tiers) return true;

  // Untiered pages are always visible — see `isAtOrAbove`. 289 corpus pages carry
  // no badge, so one of them inside a branch is enough to keep the branch.
  if (tiers.none > 0) return true;

  const limit = TIER_CODES.indexOf(floor);
  for (let i = 0; i <= limit; i += 1) {
    if (tiers[TIER_CODES[i]] > 0) return true;
  }
  return false;
}

/**
 * Drop everything below the floor.
 *
 * ── What happens to a category that keeps nothing ────────────────────────────
 * 🔴 It is removed outright, heading and all. The alternative — keeping it with
 * `items: []` — is worse than it looks: the theme's own Category falls through to
 * `DocSidebarItemCategoryEmpty` when it has no visible children, which re-renders
 * the heading as a plain *link* (link classes, link typography, no caret) or, if
 * the category has no index page, as nothing at all. A phase heading that changes
 * shape and styling depending on where the floor sits is a worse answer than a
 * shorter tree, and a shorter tree is the entire point of the control.
 *
 * 🔴 There is one case where a category survives the tally and still prunes to
 * zero children: `tallyTiers` counts the category's OWN index page, and a topic
 * directory's README is a real badged page (see `scripts/tier-map.mjs`). So a
 * topic whose README is `master` but whose chunks are all `when needed` stays in
 * the tree at floor `m` with nothing under it, and the theme degrades it to a link
 * to that README. That is the correct outcome — the page is at the floor, it must
 * stay reachable — and it is why the empty case is handled by the theme rather
 * than guarded against here.
 */
function pruneToFloor(items, floor) {
  const kept = [];

  for (const item of items) {
    if (item.type === 'category') {
      if (!categoryHasSurvivor(item, floor)) continue;
      kept.push({...item, items: pruneToFloor(item.items ?? [], floor)});
      continue;
    }

    // `html` items carry no tier and no doc; they are separators and headings the
    // sidebar author put there on purpose, so the floor does not touch them.
    if (item.type === 'html') {
      kept.push(item);
      continue;
    }

    if (isAtOrAbove(item.customProps?.tier ?? null, floor)) {
      kept.push(item);
    }
  }

  return kept;
}

/**
 * The root instance: subscribes, transforms, remounts.
 *
 * Split out from the wrapper below so the two `useSyncExternalStore`
 * subscriptions exist ONCE rather than once per expanded category. With
 * expand-all on Java that is the difference between two listeners and several
 * hundred, each of which every store notification would have to walk.
 */
function StudyModeSidebarItems(props) {
  const {mode, epoch} = useSyncExternalStore(
    subscribeCollapse,
    getCollapseSnapshot,
    getCollapseServerSnapshot,
  );
  const {floor} = useSyncExternalStore(subscribeStudy, getStudySnapshot, getStudyServerSnapshot);

  /**
   * 🔴 The sidebar hydrates itself rather than waiting for the Study Mode control
   * bar to do it. That bar lives in the desktop aside, which is `display: none`
   * below 997px — so on mobile the drawer renders this tree with nobody having
   * touched localStorage, and the floor and the visited marks would silently stay
   * at their defaults. Calling it here costs one no-op after the first mount.
   */
  useEffect(() => {
    hydrate();
  }, []);

  // A floor the store does not recognise must not be allowed to reach the tally
  // loop, where `indexOf` returns -1 and the filter would drop the entire corpus.
  const filtering = floor !== ALL_TIERS && TIER_CODES.includes(floor);

  /**
   * Memoised because `activePath` changes on every navigation, so this component
   * re-renders on every page view. Without the memo each of those would pay for a
   * fresh 6,797-node rewrite AND hand every child a new array, which defeats the
   * theme's per-level `memo()`. `props.items` is the sidebar object from
   * `useDocsSidebar()`, which is stable for the life of a sidebar — so the memo
   * actually holds across navigation, which is also what lets Category cache its
   * subtree doc ids on item identity.
   */
  const items = useMemo(() => {
    const pruned = filtering ? pruneToFloor(props.items, floor) : props.items;
    return mode === null ? pruned : applyCollapsed(pruned, mode === 'collapsed');
  }, [props.items, filtering, floor, mode]);

  // Neither control engaged: hand the theme its own untouched array and no key,
  // which is exactly what the static render produced. Introducing a key here
  // would remount the tree on hydration for no reason.
  if (!filtering && mode === null) {
    return <DocSidebarItems {...props} />;
  }

  /**
   * 🔴 One key, composed from BOTH stores.
   *
   * A category seeds `collapsed` from props when it mounts and ignores the prop
   * afterwards, so changing the tree in place changes nothing on screen. That is
   * why collapse/expand-all bumps an epoch. The floor has the same problem from
   * the other direction: filtering the tree without remounting leaves every
   * surviving category holding the open/shut state it had under the old floor —
   * categories expanded around a page that the floor has just hidden. So the key
   * has to move when either store moves, and a single composed key remounts the
   * tree once instead of twice.
   */
  return <DocSidebarItems {...props} key={`${epoch}:${floor}`} items={items} />;
}

export default function DocSidebarItemsWrapper(props) {
  // Not a hook, and `level` never changes for a given instance, so this branch is
  // stable — React sees one component type per position for the life of the tree.
  return isRootLevel(props.level) ? (
    <StudyModeSidebarItems {...props} />
  ) : (
    <DocSidebarItems {...props} />
  );
}
