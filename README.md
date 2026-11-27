# AYJX-ROOT · 爱意一键隐藏环境

> KernelSU / KSU-Next 模块 —— 一站式 Root 环境伪装、游戏环境清理与工具箱
> WebUI 代号：**SCHALE 终端**

作者：**爱意见汐**（闲鱼 / 酷安同名）· 版本：**v1.1.0 (versionCode 92)** · **免解锁 Root 专用版**

---

## 这是什么

`AYJX-ROOT` 是一个运行在 KernelSU / KSU-Next 上的综合模块。它把「隐藏 Root 环境」这件事拆成可点选的步骤：把常用的环境伪装、包名特征处理、SELinux 路径遮罩、Play Integrity 修复等子模块一次性装好，再用一个终端风格的 WebUI 把开关、修复、检测、启动全串起来。

本版是**免解锁 Root 专用版**：内置模块里不再包含 Oh My Keymint（OMK / Keymint）组件，一键配置也不再写 OMK 的注入列表，装完就是干净的环境伪装工具箱。

刷入后不需要自己一个个去找模块：安装脚本会把随包附带的 6 个内置模块按顺序装进 `/data/adb/modules/`，重启即生效；之后所有操作都在 WebUI 里点。


---

## 功能一览

| 功能 | WebUI 入口 | 说明 |
| --- | --- | --- |
| **一键写入全部配置** | `MISSION 01 / SETUP` | 一次把 Zygisk Next 运行参数（denylist / memory-type / linker）与 HMA-OSS 隐藏配置写到位；本版不含 OMK，不再写入注入清单 |
| **环境伪装** | `ENV` | 全局属性伪装（`resetprop`，缺失时回退 `setprop`）+ Zygisk 侧 per‑app 属性注入；支持机型 / 指纹 / 属性组切换，配置与日志保存在模块 `env/` 目录 |
| **主应用修复** | `01 MAIN` | 备份 → 卸载 → 重装 → 清数据 → 还原 `files` 与 Android ID；默认包名 `com.tencent.mf.uam` |
| **分身修复** | `02 CLONE` | 只处理指定分身 user（默认 `999`），主应用不受影响，Android ID 写入该 user 的 `settings_ssaid.xml` |
| **ARB 检测** | `03 ARB` | 读取 `xbl_config` 分区，用 `arbextract` 解析 ARB Index，判断防回滚（Anti‑Rollback）版本，刷机前先看清能不能降级 |
| **模糊查找** | `04 FIND` | 按「字符顺序出现」匹配目录里的文件名与路径（`sys` 命中 `sysctl`、`system_conf`、`/data/system/users`），支持停止 / 清除 / 导出 |
| **游戏直达** | `GAMES` | 暗区突围、三角洲行动、王者荣耀、和平精英 图标一键启动 |
| **电源菜单** | `POWER MENU` | 重启、软重启（soft reboot）、Bootloader、EDL(9008)、Recovery |
| **设备监控** | `SYSTEM MONITOR` | 实时读取 ROOT 权限、设备序列号、设备代号、Android 版本 |

---

## 环境要求

- **Root 方案**：KernelSU 或 KSU‑Next（安装脚本按 KSU 的 `ui_print` / `set_perm` / `modules_update` 约定编写）
- **架构**：`arm64-v8a`（自带 Zygisk native 组件 `zygisk/arm64-v8a.so`，基于 Zygisk `ModuleBase` 的 `EnvPropModule`，按 `env/perapp.conf` 做 per‑app 属性注入）
- **Zygisk**：可用（Zygisk Next 会随包安装）
- **建议**：Android 12 及以上；内核支持 LKM（PathMask 与 fgetpriority 是内核模块，免解锁方案若加载不了 LKM，装完在管理器里把这两个关掉即可）

---

## 安装

1. 下载 Release 里的 `AYJX-ROOT-v1.1.0.zip`（免解锁版）。
2. KernelSU / KSU‑Next 管理器 → 模块 → **从本地安装**，选择该 zip。
3. 安装日志里会看到 6 个内置模块逐个安装（`[1/6]` … `[6/6]`），最后提示成功 / 跳过数量。
4. **重启手机**。重启后 `service.sh` 会拉起后台还原服务 `restore-watcher.sh` 与环境引擎 `env-engine.sh`。

> 刷入或更新后**必须先重启一次**，否则后台还原服务不存在，修复流程会卡在「等待还原」。

---

## 使用

打开 **KernelSU 管理器 → 模块 → AYJX‑ROOT → WebUI**。

WebUI 依赖管理器注入的 `ksu.exec` / `KSUUI` 桥接调用 shell，用普通浏览器直接打开是执行不了的，页面会提示找不到执行接口。

推荐顺序：

1. `MISSION 01 / SETUP` → **一键配置**：写入 Zygisk Next 参数与 HMA‑OSS 配置（两步，无 OMK）。
2. `ENV` → 选机型 / 属性组，写入环境伪装，确认游戏进程内属性已生效。
3. `01 MAIN` / `02 CLONE` → 需要时做包名特征修复（会卸载重装）。
4. `03 ARB` → 刷机 / 降级前先看 ARB Index。

### 修复流程

主应用 / 分身修复脚本**不再自己拉起游戏**，它只负责备份、卸载、重装、清数据，然后把「等游戏初始化 → 强停 → 还原 `files`」写成任务文件丢进 `env/restore_jobs/`，交给开机启动的 `restore-watcher.sh` 独立进程执行（`setsid` 启动，`oom_score_adj = -1000`）。

所以修复期间 **WebUI / 管理器被系统杀掉是正常现象**，稍后重开看还原日志即可。任务文件会被 `source` 且含 `rm -rf`，watcher 在执行前做了白名单校验，避免残缺任务造成误删。

---

## 目录结构

```
AYJX-ROOT/
├── module.prop              # 模块信息（id / 版本 / 作者 / 简介）
├── customize.sh             # 安装脚本：权限设置 + 内置模块逐个安装
├── service.sh               # 开机启动 restore-watcher.sh 与 env-engine.sh
├── scripts/
│   ├── env-engine.sh        # 环境伪装引擎（resetprop 属性伪装 + per-app）
│   ├── oneclick.sh          # 一键配置：Zygisk Next / HMA-OSS
│   ├── fix_pkg_main.sh      # 主应用修复
│   ├── fix_pkg_dual.sh      # 分身应用修复
│   ├── restore-watcher.sh   # 后台还原服务（独立于管理器）
│   ├── check_arb.sh         # ARB 防回滚检测
│   ├── fuzzy_find.sh        # 模糊查找
│   └── oneclick_hma_config.json # HMA-OSS 隐藏配置
├── webroot/                 # WebUI（SCHALE 终端）
│   ├── index.html / style.css
│   ├── app.js               # 主控、日志、任务调度
│   ├── env-tool.js          # 环境伪装面板
│   ├── game-launch.js       # 游戏直达
│   ├── monitor.js           # 设备监控
│   ├── power-menu.js        # 电源菜单
│   └── assets/              # 字体与角色立绘
├── zygisk/
│   └── arm64-v8a.so         # 自带 Zygisk 组件（EnvPropModule）
└── bundled_modules/         # 随包安装的 6 个内置模块（1.zip … 6.zip，无 OMK）
```

---

## 关于脚本加密

`scripts/*.sh` 是**构建产物**：由 `build.py` 生成，正文为三层自定义字母表 Base64 编码的密文，运行时还原后 `eval`，脚本头部带自校验（内容被改动会直接报错退出）。仓库里按原样保留密文，不附带解码内容。

要改功能请改源码后重新构建，**不要直接编辑加密后的脚本**，否则校验失败、功能失效。

`customize.sh`、`service.sh` 与 `webroot/` 全部为明文，可以直接阅读和修改。

---

## 常见问题

**Q：安装时内置模块有跳到一半失败？**
看安装日志里 `!` 开头的行。常见原因是设备没有 `unzip`（脚本会依次尝试 busybox / toybox），或某个内置模块的 `customize.sh` 主动 abort。失败的会跳过，其余照常安装，重启后可在管理器里单独补装。

**Q：ARB 检测一直「解析失败」？**
模块不自带 `arbextract`，首次会从 GitHub 下载，国内网络常失败。手动把 `arbextract-aarch64-android` 放到 `/data/adb/modules/AYJX-ROOT/bin/arbextract` 并 `chmod 755`，再点一次。

**Q：修复后看不到还原日志 / 数据没回来？**
先确认刷入后重启过一次；再确认 `restore-watcher.sh` 进程在（`pgrep -f restore-watcher.sh`）。任务文件在 `env/restore_jobs/`，日志在模块 `env/` 下。

---

## 更新日志

### v1.1.0 (92) · 免解锁 Root 专用版
- **移除内置 Oh My Keymint（OMK）模块**：`bundled_modules/` 不再附带，安装脚本遇到 `oh_my_keymint` 也会直接跳过（防止旧包残留装回）。
- **一键配置去掉 OMK 段**：不再生成 `injector.toml`、不再写入 scoop 注入列表，只处理 Zygisk Next 参数与 HMA-OSS 配置，步骤显示为 `1/2`、`2/2`。
- 删除 `scripts/oneclick_omk_scoop.txt`，WebUI 一键配置卡片文案同步去掉 OMK。
- 其余功能（环境伪装、主应用 / 分身修复、ARB 检测、模糊查找、游戏直达、电源菜单）不变。

### v1.0.0 (91)
- 首次发布：SCHALE 终端 WebUI、环境伪装引擎、主应用 / 分身修复、ARB 检测、模糊查找、游戏直达、电源菜单。
- 修复流程改为任务队列 + 独立 watcher，解决「游戏一启动管理器被杀导致还原中断」。
- 分身修复只匹配完全相等的包名，备份带 `.done` 标记，残缺备份不复用；失败时先还原存档再退出。
- 一键配置过滤非法包名，避免 `injector.toml` 整份解析失败。
- ARB 检测改为原子下载 + ELF 头校验，避免把 404 页面当二进制缓存。

---

## 免责声明

本项目仅供**个人设备折腾与数码交流学习**使用。刷入模块、卸载重装应用、修改系统属性均有风险（数据丢失、无法开机、账号风控等），请自行备份、自行承担后果。内置第三方模块版权归原作者，请遵守其各自许可。

如果这个模块帮到你，点个 **Star** 就好。
