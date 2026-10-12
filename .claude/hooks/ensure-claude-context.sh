#!/usr/bin/env bash
# SessionStart: in cloud sessions, make sure the memory store (sairamg8/claude-context)
# is cloned next to this repo. Never fails the session; warns if it cannot clone.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

DIR=/home/user/claude-context
URL=https://github.com/sairamg8/claude-context

if git -C "$DIR" rev-parse HEAD >/dev/null 2>&1; then
  echo "claude-context present at $DIR (memory store; replaces /mnt/Storage/my-learning/claude)"
  exit 0
fi

if [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  echo "WARNING: $DIR exists but is not a valid clone; not touching it." >&2
  exit 0
fi

if timeout 540 git clone --depth 1 "$URL" "$DIR" >/dev/null 2>&1; then
  echo "claude-context cloned to $DIR (memory store; replaces /mnt/Storage/my-learning/claude)"
else
  rm -rf "$DIR"
  echo "WARNING: could not clone sairamg8/claude-context. Start the session with BOTH devbible and claude-context selected, or call add_repo for it." >&2
fi
exit 0
