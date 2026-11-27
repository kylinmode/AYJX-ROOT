#!/system/bin/sh
MODDIR="${0%/*}"

WATCHER="$MODDIR/scripts/restore-watcher.sh"
if [ -f "$WATCHER" ] && ! pgrep -f "restore-watcher.sh" >/dev/null 2>&1; then
    if command -v setsid >/dev/null 2>&1; then
        setsid /system/bin/sh "$WATCHER" </dev/null >/dev/null 2>&1 &
    else
        nohup /system/bin/sh "$WATCHER" </dev/null >/dev/null 2>&1 &
    fi
fi

[ -f "$MODDIR/scripts/env-engine.sh" ] || exit 0
"$MODDIR/scripts/env-engine.sh" boot >/dev/null 2>&1 &
