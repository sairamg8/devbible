import React, {useSyncExternalStore} from 'react';
import DocSidebarItems from '@theme-original/DocSidebarItems';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  applyCollapsed,
} from '@site/src/components/SidebarCollapseAll/store';

/**
 * Applies the collapse/expand-all choice to the sidebar item tree.
 *
 * A category seeds its open/shut state from `item.collapsed` when it mounts, so changing
 * the prop on an already-mounted tree does nothing. Bumping `key` with the store's epoch
 * remounts the tree, and the categories then read the rewritten value.
 *
 * Only the top level does the work: it rewrites the whole nested tree in one pass, and
 * the deeper DocSidebarItems instances receive items that are already correct. Guarding
 * on the level also keeps the remount at a single point instead of nesting keys.
 *
 * The root is `level === 1` on desktop but `undefined` on mobile, which passes no level
 * at all — so testing for `level !== 1` would quietly switch the control off in the
 * mobile drawer. Nested levels are always explicit (`level + 1`, which is `NaN` under
 * mobile's undefined root), so "null or 1" identifies the root in both trees.
 */
function isRootLevel(level) {
  return level == null || level === 1;
}

export default function DocSidebarItemsWrapper(props) {
  const {mode, epoch} = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isRootLevel(props.level) || mode === null) {
    return <DocSidebarItems {...props} />;
  }

  return (
    <DocSidebarItems
      {...props}
      key={epoch}
      items={applyCollapsed(props.items, mode === 'collapsed')}
    />
  );
}
