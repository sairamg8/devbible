import React from 'react';
import clsx from 'clsx';
import DocSidebar from '@theme-original/DocSidebar';
import SidebarCollapseAll from '@site/src/components/SidebarCollapseAll';
import TechRail from '@site/src/components/TechRail';
import styles from './styles.module.css';

/**
 * The docs aside: a technology rail beside the page tree, with the
 * collapse/expand-all control above the tree.
 *
 * ── Why the rail lives here and not in DocRoot/Layout ────────────────────────
 * The rail is a sibling of the tree, not of the article, so the obvious place is
 * a new first column in `DocRoot/Layout`. This is the cheaper way to the same
 * pixels: `DocSidebar` was already swizzled for the collapse control, the theme
 * already gives this element the full height of the sticky aside, and widening
 * `--doc-sidebar-width` makes room without touching the layout component that
 * also owns the article, the TOC and the mobile drawer.
 *
 * The control gets its own `tools` element rather than sitting bare in the flex
 * column. Two reasons, both load-bearing:
 *
 *   1. It is the flex-none row, so the sidebar below it can be the one that grows.
 *      Selecting the sidebar by `:last-child` instead does the wrong thing on
 *      mobile, where `DocSidebar` renders nothing into this aside and the bar
 *      itself becomes the last child — and then stretches to the full 900px of
 *      the sticky viewport.
 *   2. It is a class this file owns, so the padding rules do not depend on the
 *      theme's hashed CSS-module class names.
 *
 * On mobile none of this is visible: the aside is hidden below 997px and the
 * theme fills the navbar drawer through `NavbarSecondaryMenuFiller` instead, so
 * whatever renders here renders into a hidden element. The rail is display:none'd
 * there rather than left to build 29 links nobody can reach.
 *
 * ── `isHidden` ───────────────────────────────────────────────────────────────
 * The theme hides the collapsed sidebar by shrinking the aside to
 * `--doc-sidebar-hidden-width` (30px) with `clip-path: inset(0)`, and separately
 * setting `opacity: 0; visibility: hidden` on ITS OWN inner sidebar div — which
 * is only the page tree. The rail is not that div, so on collapse it kept its
 * full 168px, got clipped to 30, and left a column of sliced-off technology names
 * down the left edge instead of a clean strip with a toggle.
 *
 * `isHidden` is a real prop on `DocSidebar` — the theme passes it from
 * `DocRoot/Layout/Sidebar` — so the whole shell can take the same treatment. The
 * `ExpandButton` that brings the sidebar back is a SIBLING of this component, not
 * a child, so hiding everything here leaves the toggle reachable.
 */
export default function DocSidebarWrapper(props) {
  return (
    <div className={clsx(styles.shell, props.isHidden && styles.shellHidden)}>
      <TechRail />
      <div className={styles.wrapper}>
        <div className={styles.tools}>
          <SidebarCollapseAll />
        </div>
        <DocSidebar {...props} />
      </div>
    </div>
  );
}
