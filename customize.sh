#!/system/bin/sh
# ==========================================================
# 爱意一键隐藏环境模块 (AYJX-ROOT) — 安装脚本
#
# 本脚本由 KernelSU / Magisk 安装器 source 执行：
#   $MODPATH   当前模块目录（/data/adb/modules_update/>-toolbox）
#   $TMPDIR    安装器临时目录
#   ui_print / set_perm / set_perm_recursive / abort 由安装器提供
#
# ==========================================================
SKIPUNZIP=0

MODDIR="${MODPATH:-${0%/*}}"
NVBASE="${NVBASE:-/data/adb}"
BOOTMODE="${BOOTMODE:-true}"


if ! command -v ui_print >/dev/null 2>&1; then
  ui_print() { echo "$1"; }
fi
if ! command -v set_perm >/dev/null 2>&1; then
  set_perm() {
    chown "$2:$3" "$1" 2>/dev/null
    chmod "$4" "$1" 2>/dev/null
    [ -n "$5" ] && chcon "$5" "$1" 2>/dev/null
    return 0
  }
fi
if ! command -v set_perm_recursive >/dev/null 2>&1; then
  set_perm_recursive() {
    find "$1" -type d 2>/dev/null | while read -r _d; do set_perm "$_d" "$2" "$3" "$4" "$6"; done
    find "$1" -type f 2>/dev/null | while read -r _f; do set_perm "$_f" "$2" "$3" "$5" "$6"; done
    return 0
  }
fi

if [ -d "$MODDIR/scripts" ]; then
  set_perm_recursive "$MODDIR/scripts" 0 0 0777 0777
fi
[ -f "$MODDIR/customize.sh" ] && set_perm "$MODDIR/customize.sh" 0 0 0777
[ -f "$MODDIR/service.sh" ] && set_perm "$MODDIR/service.sh" 0 0 0777
[ -f "$MODDIR/bin/arbextract" ] && set_perm "$MODDIR/bin/arbextract" 0 0 0777

UNZIP_OK=0
if command -v unzip >/dev/null 2>&1; then
  UNZIP_OK=1
else
  for _bb in /data/adb/ksu/bin/busybox /data/adb/magisk/busybox /system/xbin/busybox /system/bin/busybox; do
    if [ -x "$_bb" ] && "$_bb" --list 2>/dev/null | grep -qx unzip; then
      unzip() { "$_bb" unzip "$@"; }
      UNZIP_OK=1
      break
    fi
  done
fi
if [ "$UNZIP_OK" = 0 ]; then
  for _tb in /system/bin/toybox /system/xbin/toybox; do
    if [ -x "$_tb" ] && "$_tb" --long 2>/dev/null | sed 's/^ *//; s/:.*//' | grep -qx unzip; then
      unzip() { "$_tb" unzip "$@"; }
      UNZIP_OK=1
      break
    fi
  done
fi

_module_id() {
  unzip -p "$1" module.prop 2>/dev/null \
    | tr -d '\r' \
    | sed -n 's/^id=//p' \
    | head -n 1 \
    | sed 's/[[:space:]]*$//'
}

bundled_install() {
  _zip="$1"
  _base="${_zip##*/}"
  [ -f "$_zip" ] || return 1

  _id="$(_module_id "$_zip")"
  if [ -z "$_id" ]; then
    ui_print "! 无法读取 $_base 的 module.prop，跳过"
    _bundled_skip=$((_bundled_skip + 1))
    return 1
  fi
  case "$_id" in
    [A-Za-z]*) : ;;
    *) ui_print "! $_base 的模块 ID 非法（$_id），跳过"; _bundled_skip=$((_bundled_skip + 1)); return 1 ;;
  esac
  case "$_id" in
    *[!A-Za-z0-9._-]*) ui_print "! $_base 的模块 ID 非法（$_id），跳过"; _bundled_skip=$((_bundled_skip + 1)); return 1 ;;
  esac

  if [ "$_id" = "AYJX-ROOT" ]; then
    ui_print "! $_base 的 ID 与本模块相同，跳过"
    _bundled_skip=$((_bundled_skip + 1))
    return 1
  fi

  case "$_id" in
    oh_my_keymint)
      ui_print "! 免解锁 Root 专用版不含 OMK，跳过：$_id（$_base）"
      _bundled_skip=$((_bundled_skip + 1))
      return 1 ;;
  esac

  if [ "$BOOTMODE" = "false" ]; then
    _root="$NVBASE/modules"
  else
    _root="$NVBASE/modules_update"
  fi
  _stage="$_root/$_id"
  _tmp="${TMPDIR:-/dev/tmp}/.bundled-$_id"
  _mark="${TMPDIR:-/dev/tmp}/.bundled-ok-$_id"

  ui_print "- 正在安装内置模块：$_id（$_base）"

  rm -rf "$_stage" "$_tmp" 2>/dev/null
  rm -f "$_mark" 2>/dev/null
  mkdir -p "$_stage" "$_tmp" 2>/dev/null
  if [ ! -d "$_stage" ] || [ ! -d "$_tmp" ]; then
    ui_print "! 无法创建安装目录 $_stage"
    _bundled_skip=$((_bundled_skip + 1))
    return 1
  fi

  if ! unzip -o "$_zip" module.prop customize.sh -d "$_stage" >/dev/null 2>&1; then
    ui_print "! 解压 $_base 失败"
    rm -rf "$_stage" "$_tmp" 2>/dev/null
    _bundled_skip=$((_bundled_skip + 1))
    return 1
  fi
  unzip -o "$_zip" module.prop -d "$_tmp" >/dev/null 2>&1

  if [ ! -f "$_stage/module.prop" ]; then
    ui_print "! $_base 里没有 module.prop，跳过"
    rm -rf "$_stage" "$_tmp" 2>/dev/null
    _bundled_skip=$((_bundled_skip + 1))
    return 1
  fi

  if ! grep -q '^SKIPUNZIP=1$' "$_stage/customize.sh" 2>/dev/null; then
    ui_print "- 解压模块文件"
    if ! unzip -o "$_zip" -x 'META-INF/*' -d "$_stage" >/dev/null 2>&1; then
      ui_print "! 解压 $_base 失败"
      rm -rf "$_stage" "$_tmp" 2>/dev/null
      _bundled_skip=$((_bundled_skip + 1))
      return 1
    fi
    set_perm_recursive "$_stage" 0 0 0755 0644
    [ -d "$_stage/system/bin" ] && set_perm_recursive "$_stage/system/bin" 0 2000 0755 0755
    [ -d "$_stage/system/xbin" ] && set_perm_recursive "$_stage/system/xbin" 0 2000 0755 0755
    [ -d "$_stage/system/system_ext/bin" ] && set_perm_recursive "$_stage/system/system_ext/bin" 0 2000 0755 0755
    [ -d "$_stage/system/vendor" ] && set_perm_recursive "$_stage/system/vendor" 0 2000 0755 0755 'u:object_r:vendor_file:s0'
  fi

  if [ -f "$_stage/customize.sh" ]; then
    (
      cd "$_tmp" || exit 1
      MODPATH="$_stage"
      TMPDIR="$_tmp"
      ZIPFILE="$_zip"
      MODID="$_id"
      export MODPATH TMPDIR ZIPFILE MODID

      abort() { ui_print "$1"; exit 1; }
      . "$_stage/customize.sh"
      : > "$_mark"
    )
  else
    : > "$_mark"
  fi

  if [ ! -f "$_mark" ]; then
    ui_print "! 内置模块 $_id 的安装脚本中止，已跳过"
    rm -rf "$_stage" "$_tmp" 2>/dev/null
    rm -f "$_mark" 2>/dev/null
    _bundled_skip=$((_bundled_skip + 1))
    return 1
  fi

  if [ "$BOOTMODE" != "false" ]; then
    mkdir -p "$NVBASE/modules/$_id" 2>/dev/null
    cp -af "$_stage/module.prop" "$NVBASE/modules/$_id/module.prop" 2>/dev/null
    touch "$NVBASE/modules/$_id/update" 2>/dev/null
    rm -rf "$NVBASE/modules/$_id/remove" "$NVBASE/modules/$_id/disable" 2>/dev/null
  fi

  rm -rf "$_stage/customize.sh" "$_stage/system/placeholder" \
         "$_stage/README.md" "$_stage/.git"* 2>/dev/null
  rm -rf "$_tmp" 2>/dev/null
  rm -f "$_mark" 2>/dev/null

  ui_print "- ✅ 内置模块 $_id 安装完成"
  _bundled_ok=$((_bundled_ok + 1))
  return 0
}

BUNDLED_DIR="$MODDIR/bundled_modules"

if [ -d "$BUNDLED_DIR" ]; then
  if [ "$UNZIP_OK" != 1 ]; then
    ui_print "! 警告：找不到 unzip，跳过内置模块安装"
  else
    _bundled_total=0
    for _z in "$BUNDLED_DIR"/*.zip; do
      [ -f "$_z" ] && _bundled_total=$((_bundled_total + 1))
    done

    if [ "$_bundled_total" -gt 0 ]; then
      ui_print " "
      ui_print "====安装内置模块(共 $_bundled_total 个，按文件名顺序逐个安装)===="

      _bundled_ok=0
      _bundled_skip=0
      _bundled_idx=0

      for _z in "$BUNDLED_DIR"/*.zip; do
        [ -f "$_z" ] || continue
        _bundled_idx=$((_bundled_idx + 1))

        if [ "$_bundled_idx" -gt 1 ]; then
          ui_print "- 等待 3 秒后安装下一个模块…"
          sleep 3
        fi

        ui_print "- [$_bundled_idx/$_bundled_total] 开始处理 ${_z##*/}"
        bundled_install "$_z"
      done

      ui_print " "
      ui_print "===内置模块安装结束：成功 $_bundled_ok 个，跳过 $_bundled_skip 个，重启后生效==="
    fi
  fi
fi
