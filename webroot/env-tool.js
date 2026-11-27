"use strict";

(function () {
  var ENGINE = "/data/adb/modules/AYJX-ROOT/scripts/env-engine.sh";
  var $ = function (id) { return document.getElementById(id); };
  var panel = $("panel-env");
  var state = {
    ready: false, loading: false, rendered: false,
    view: "home",
    status: {}, profile: {}, games: [], logging: false, android: "",
    info: {}, packages: [], selected: {},
    target: "__global__", perapp: {}, perappCount: 0, perappPkgs: [],
    log: "", templateQuery: "", confirmResolve: null
  };
  var toastTimer = 0;
  var pending = 0;
  var TEMPLATES = [
    { id: "xiaomi14", name: "小米 14", manufacturer: "Xiaomi", brand: "Xiaomi", model: "23127PN0CC", device: "houji", product: "houji", release: "14", sdk: "34", soc: "SM8650", board: "kalama", fingerprint: "Xiaomi/houji/houji:14/UKQ1.230804.001/OS1.0.2.0.UNCCNXM:user/release-keys" },
    { id: "k70", name: "Redmi K70", manufacturer: "Xiaomi", brand: "Redmi", model: "23113RKC6C", device: "manet", product: "manet", release: "14", sdk: "34", soc: "MT6989", board: "mt6989", fingerprint: "Redmi/manet/manet:14/UKQ1.231003.002/OS1.0.6.0.UNLCNXM:user/release-keys" },
    { id: "iqoo12", name: "iQOO 12", manufacturer: "vivo", brand: "iQOO", model: "V2307A", device: "kailua", product: "kailua", release: "14", sdk: "34", soc: "SM8650", board: "kalama", fingerprint: "vivo/kailua/kailua:14/UP1A.231005.007/compiler250121175242:user/release-keys" },
    { id: "oneplus12", name: "OnePlus 12", manufacturer: "OnePlus", brand: "OnePlus", model: "CPH2573", device: "salami", product: "salami", release: "14", sdk: "34", soc: "SM8650", board: "kalama", fingerprint: "OnePlus/salami/salami:14/UKQ1.230924.001/1b8c2d3a4f:user/release-keys" },
    { id: "s24", name: "Galaxy S24", manufacturer: "samsung", brand: "samsung", model: "SM-S9210", device: "e1q", product: "e1q", release: "14", sdk: "34", soc: "s5e9945", board: "e1q", fingerprint: "samsung/e1q/e1q:14/UP1A.231005.007/S9210ZCS2AXK1:user/release-keys" },
    { id: "pixel8", name: "Pixel 8", manufacturer: "Google", brand: "google", model: "GB7N6", device: "shiba", product: "shiba", release: "14", sdk: "34", soc: "Tensor G3", board: "zuma", fingerprint: "google/shiba/shiba:14/AP1A.240305.019.A1/11445699:user/release-keys" }
  ];
  var KNOWN = {
    "com.tencent.tmgp.sgame": "王者荣耀",
    "com.tencent.mf.uam": "暗区突围",
    "com.tencent.tmgp.dfm": "三角洲行动",
    "com.tencent.tmgp.pubgmhd": "和平精英",
    "com.tencent.tmgp.pubgm": "和平精英",
    "com.tencent.tmgp.cf": "穿越火线",
    "com.tencent.lolm": "英雄联盟手游",
    "com.tencent.jkchess": "金铲铲之战",
    "com.miHoYo.Yuanshen": "原神",
    "com.miHoYo.hkrpg": "崩坏：星穹铁道",
    "com.miHoYo.Nap": "绝区零",
    "com.kurogame.mingchao": "鸣潮",
    "com.hypergryph.arknights": "明日方舟",
    "com.netease.party": "蛋仔派对",
    "com.netease.sky": "光·遇",
    "com.netease.dwrg": "第五人格",
    "com.netease.mc": "我的世界"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  function initial(label, pkg) { return Array.from(String(label || pkg || "?").trim())[0] || "?"; }
  function validPkg(p) { return /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(p); }
  function getBridge() {
    var names = ["ksu", "kernelsu", "ksuwebui"];
    for (var i = 0; i < names.length; i++) {
      var b = window[names[i]];
      if (b && typeof b.exec === "function") return b;
    }
    return null;
  }
  function run(cmd) {
    // app.js 会把探测好的调用形式暴露成 window.KSUUI.exec；
    // 用它就不用在这里再猜一遍 exec 的参数个数。
    if (window.KSUUI && typeof window.KSUUI.exec === "function") {
      return window.KSUUI.exec(cmd, 60000).then(function (r) {
        return { errno: (r && r.code) || 0, stdout: (r && r.out) || "", stderr: (r && r.err) || "" };
      }, function (e) {
        return { errno: -1, stdout: "", stderr: String((e && e.message) || e) };
      });
    }
    return new Promise(function (resolve) {
      var bridge = getBridge();
      if (!bridge) return resolve({ errno: -1, stdout: "", stderr: "未检测到 WebUI 执行接口" });
      var name = "__env_run_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      var done = false;
      var timer = setTimeout(function () {
        if (done) return; done = true;
        try { delete window[name]; } catch (e) { window[name] = undefined; }
        resolve({ errno: -1, stdout: "", stderr: "执行超时" });
      }, 30000);
      window[name] = function (errno, stdout, stderr) {
        if (done) return; done = true;
        clearTimeout(timer);
        try { delete window[name]; } catch (e) { window[name] = undefined; }
        resolve({ errno: Number(errno) || 0, stdout: stdout || "", stderr: stderr || "" });
      };
      try {
        var ret = bridge.exec(cmd, "{}", name);
        if (ret && typeof ret.then === "function") {
          ret.then(function (r) {
            if (done) return; done = true; clearTimeout(timer);
            if (r && typeof r === "object") resolve({ errno: Number(r.errno) || 0, stdout: r.stdout || "", stderr: r.stderr || "" });
            else resolve({ errno: 0, stdout: typeof r === "string" ? r : "", stderr: "" });
          }, function (e) {
            if (done) return; done = true; clearTimeout(timer);
            resolve({ errno: -1, stdout: "", stderr: String(e) });
          });
        } else if (typeof ret === "string") {
          if (done) return; done = true; clearTimeout(timer);
          resolve({ errno: 0, stdout: ret, stderr: "" });
        } else if (ret && typeof ret === "object" && (ret.stdout != null || ret.errno != null)) {
          if (done) return; done = true; clearTimeout(timer);
          resolve({ errno: Number(ret.errno) || 0, stdout: ret.stdout || "", stderr: ret.stderr || "" });
        }
      } catch (e) {
        if (done) return; done = true; clearTimeout(timer);
        resolve({ errno: -1, stdout: "", stderr: String(e) });
      }
    });
  }
  async function engine(args) {
    var cmd = shq(ENGINE) + (args && args.length ? " " + args.map(shq).join(" ") : "");
    if (pending === 0) {
      setHead("处理中…", "busy");
      toast("处理中…");
    }
    pending += 1;
    try {
      var r = await run(cmd);
      var lines = String(r.stdout || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      for (var i = lines.length - 1; i >= 0; i--) {
        var obj = null;
        try { obj = JSON.parse(lines[i]); } catch (e) { continue; }
        if (obj && typeof obj.ok === "boolean") {
          if (!obj.ok) throw new Error(obj.message || "操作失败");
          return obj.data;
        }
      }
      throw new Error("引擎返回异常：" + String(r.stdout || r.stderr || "").slice(-140));
    } finally {
      pending -= 1;
      if (pending === 0) setHead(profileActive() || state.perappCount ? "伪装已启用" : "引擎就绪", "");
    }
  }

  function toast(msg, error) {
    var el = $("env-toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "env-toast" + (error ? " error" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function setHead(text, mode) {
    var el = $("env-status");
    if (!el) return;
    el.className = "env-status" + (mode ? " " + mode : "");
    el.innerHTML = "<i></i>" + esc(text);
  }
  function labelOf(pkg) { return state.info[pkg] || KNOWN[pkg] || pkg; }
  function iconHtml(pkg) {
    return '<span class="env-game-icon"><img src="ksu://icon/' + esc(pkg) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><i>' + esc(initial(labelOf(pkg), pkg)) + '</i></span>';
  }
  function profileActive() { return Object.keys(state.profile || {}).length > 0; }

  function studentStrip(name, file, quote, tag) {
    return '<div class="env-student">' +
      '<img src="assets/' + file + '" alt="' + esc(name) + '" loading="lazy">' +
      '<div><span class="env-student-tag">' + esc(tag) + '</span><b>' + esc(name) + '</b><p>「' + esc(quote) + '」</p></div>' +
    '</div>';
  }
  function quickActions() {
    return '<div class="env-quick">' +
      '<button type="button" data-env-tab="games"><b>游戏</b><span>添加 / 清理</span></button>' +
      '<button type="button" data-env-tab="model"><b>机型</b><span>模板 / 属性</span></button>' +
      '<button type="button" data-env-tab="ids"><b>ID</b><span>Android / DRM</span></button>' +
      '<button type="button" data-env-tab="logs"><b>日志</b><span>查看 / 清除</span></button>' +
    '</div>';
  }

  function openModal(o) {
    $("env-modal-tag").textContent = o.tag || "ENV";
    $("env-modal-title").textContent = o.title || "操作";
    $("env-modal-body").innerHTML = o.body || "";
    $("env-modal-actions").innerHTML = o.actions || '<button class="env-btn" data-act="modal-close">关闭</button>';
    $("env-modal").hidden = false;
  }
  function closeModal() {
    var m = $("env-modal");
    if (m) m.hidden = true;
    if (state.confirmResolve) {
      var r = state.confirmResolve;
      state.confirmResolve = null;
      r(false);
    }
  }
  function confirmAction(title, message, okLabel, danger) {
    return new Promise(function (resolve) {
      state.confirmResolve = resolve;
      openModal({
        tag: "CONFIRM",
        title: title,
        body: '<p class="env-note">' + esc(message) + '</p>',
        actions: '<button class="env-btn" data-act="modal-cancel">取消</button><button class="env-btn ' + (danger ? "danger" : "primary") + '" data-act="modal-ok">' + esc(okLabel || "确定") + "</button>"
      });
    });
  }

  async function loadInfo(pkgs) {
    pkgs = (pkgs || []).filter(validPkg);
    if (!pkgs.length) return;
    try {
      var b = getBridge();
      if (!b || typeof b.getPackagesInfo !== "function") return;
      var raw = await Promise.resolve(b.getPackagesInfo(JSON.stringify(pkgs)));
      var arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(arr)) return;
      arr.forEach(function (x) {
        var pkg = x.packageName || x.package || x.pkg;
        if (pkg) state.info[pkg] = x.appLabel || x.label || x.name || pkg;
      });
    } catch (e) {}
  }

  async function loadStatus() {
    var s = await engine(["status"]) || {};
    state.status = s;
    state.games = Array.isArray(s.games) ? s.games.filter(validPkg) : [];
    state.logging = !!s.logging;
    state.android = s.android || "";
    state.profile = (s.profileData && typeof s.profileData === "object") ? s.profileData : null;
    state.perapp = (s.perappData && typeof s.perappData === "object") ? s.perappData : null;
    if (!state.profile) {
      var p = await engine(["profile"]);
      state.profile = (p && p.profile) || {};
    }
    if (!state.perapp) {
      var pl = await engine(["perapp-list"]);
      var pkgs = (pl && pl.packages) || [];
      var map = {};
      for (var i = 0; i < pkgs.length; i++) {
        var pg = await engine(["perapp-get", pkgs[i]]);
        map[pkgs[i]] = (pg && pg.profile) || {};
      }
      state.perapp = map;
    }
    state.perappPkgs = Object.keys(state.perapp || {});
    state.perappCount = state.perappPkgs.length;
    if (state.target !== "__global__" && state.games.indexOf(state.target) < 0) state.target = "__global__";
    await loadInfo(state.games);
    state.ready = true;
    state.rendered = true;
    setHead(profileActive() || state.perappCount ? "伪装已启用" : "引擎就绪", "");
    renderAll();
  }
  async function ensureInit(force) {
    if (state.loading) return;
    if (state.ready && !force) { if (!state.rendered) renderAll(); return; }
    state.loading = true;
    setHead("读取中", "busy");
    try {
      await loadStatus();
      if (force) toast("状态已刷新");
    } catch (e) {
      state.ready = false;
      setHead("离线", "off");
      renderAll(e.message || "环境引擎连接失败");
      toast(e.message || "环境引擎连接失败", true);
    } finally {
      state.loading = false;
    }
  }
  async function refreshData() {
    await loadStatus();
  }

  function renderAll(error) {
    renderHome(error);
    renderGames();
    renderModel();
    renderIds();
    renderLogs();
  }

  function renderHome(error) {
    var el = $("env-home");
    if (!el) return;
    if (!state.ready && error) {
      el.innerHTML =
        '<div class="env-hero" style="border-color:#ffd3e2;background:linear-gradient(150deg,#fff7fa,#fff)">' +
          '<div class="env-hero-main"><span class="env-hero-shield" style="color:#ef5b93;box-shadow:inset 0 0 0 1px #ffd3e2">!</span>' +
            '<div class="env-hero-copy"><h3>环境引擎未就绪</h3><p>' + esc(error) + '</p></div>' +
          '</div>' +
        '</div>' +
        '<div class="env-card"><div class="env-row"><div><b>首次使用</b><p>确认模块已刷入并重启；引擎脚本位于 scripts/env-engine.sh。</p></div></div></div>' +
        '<div class="env-actions"><button class="env-btn primary" data-act="refresh">重新连接</button></div>';
      return;
    }
    var st = state.status || {};
    var dev = st.device || {};
    var active = profileActive() || state.perappCount > 0;
    var tool = st.propTool || "setprop";
    var root = Number(st.root) === 0;
    var count = Object.keys(state.profile || {}).length;
    var warn = tool === "setprop" ? '<div class="env-note" style="border-color:#ffe6b8;background:#fffaf0;color:#a56a00">未找到 resetprop，ro.* 属性可能无法修改；请确认 KernelSU/Magisk 的 resetprop 可用。</div>' : "";
    el.innerHTML =
      '<div class="env-hero">' +
        '<div class="env-hero-main">' +
          '<span class="env-hero-shield">' +
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-3.5 7-9V5l-7-2.5L5 5v7c0 5.5 7 9 7 9z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</span>' +
          '<div class="env-hero-copy"><h3>' + (active ? "环境伪装已启用" : "环境伪装未启用") + '</h3><p>' + (active ? "全局 " + count + " 项 · 逐应用 " + state.perappCount + " 个游戏" : "在「机型」里选择全局或单个游戏后应用") + '</p></div>' +
          '<img class="env-hero-avatar" src="assets/yuuka.webp" alt="优香" loading="lazy">' +
        '</div>' +
      '</div>' +
      '<div class="env-metrics">' +
        '<div class="env-metric"><span>全局属性</span><b>' + count + '</b></div>' +
        '<div class="env-metric"><span>逐应用</span><b>' + state.perappCount + '</b></div>' +
        '<div class="env-metric"><span>监听游戏</span><b>' + state.games.length + '</b></div>' +
      '</div>' +
      '<div class="env-card">' +
        '<div class="env-row"><div><b>当前设备</b><p>' + esc((dev.manufacturer || "?") + " · " + (dev.model || "?") + " · " + (dev.soc || "?")) + '</p></div><code>' + esc(dev.release || "?") + '</code></div>' +
        '<div class="env-row"><div><b>Android ID</b><p>系统级 Android ID</p></div><code>' + esc(state.android || "—") + '</code></div>' +
        '<div class="env-row"><div><b>ROOT</b><p>' + (root ? "已授权" : "未授权，功能可能不可用") + '</p></div><code>' + (root ? "OK" : "NO") + '</code></div>' +
        '<div class="env-row"><div><b>属性工具</b><p>' + (tool === "setprop" ? "仅 setprop，ro.* 可能失败" : "resetprop 可用") + '</p></div><code>' + esc(tool) + '</code></div>' +
        '<div class="env-row"><div><b>运行日志</b><p>记录伪装、清理与 ID 操作</p></div><button class="env-switch' + (state.logging ? " on" : "") + '" data-act="toggle-log"></button></div>' +
      '</div>' +
      '<div class="env-actions">' +
        '<button class="env-btn ghost" data-act="refresh">刷新状态</button>' +
        '<button class="env-btn danger" data-act="reset">重置伪装</button>' +
        (state.perappCount > 0 ? '<button class="env-btn ghost" data-act="clear-perapp">清除全部逐应用</button>' : '') +
      '</div>' +
      warn +
      '<div class="env-note">逐应用伪装由 Zygisk 模块在目标进程内替换，修改后重新打开游戏生效；全局属性由 resetprop 写入，重启后 service.sh 自动应用。部分银行/支付应用可能检测到环境变化，请谨慎使用。</div>' +
      studentStrip("日奈", "hina_portrait.webp", "设备状态确认完毕，老师。", "GEHENNA · 值班") +
      quickActions();
  }

  function renderGames() {
    var el = $("env-games");
    if (!el) return;
    var games = state.games || [];
    el.innerHTML =
      '<div class="env-toolbar">' +
        '<div class="env-profile" style="flex:1">主用户 · 已监听 <b>' + games.length + '</b> 个游戏</div>' +
        '<button class="env-btn primary small" data-act="add-games" type="button">+ 添加</button>' +
      '</div>' +
      (games.length
        ? '<div class="env-list">' + games.map(function (pkg) {
            return '<div class="env-game" data-act="game-detail" data-pkg="' + esc(pkg) + '">' +
              iconHtml(pkg) +
              '<div class="env-game-copy"><b>' + esc(labelOf(pkg)) + '</b><p>' + esc(pkg) + '</p></div>' +
              '<span class="env-chevron">›</span>' +
            '</div>';
          }).join("") + '</div>'
        : '<div class="env-empty">还没有监听游戏<br>点「+ 添加」选择已安装应用</div>') +
      '<div class="env-note">监听列表用于整理要清理的游戏；清理缓存会保留登录，彻底清理会清除全部数据。仅处理主用户（用户 0）。</div>' +
      studentStrip("星野", "hoshino_portrait.webp", "老师，想先清理哪个游戏？", "ABYDOS · 值班");
  }

  function currentProfile() {
    if (state.target === "__global__") return state.profile || {};
    return state.perapp[state.target] || {};
  }

  function renderModel() {
    var el = $("env-model");
    if (!el) return;
    var isGlobal = state.target === "__global__";
    var prof = currentProfile();
    var currentModel = prof["ro.product.model"] || "";
    var currentBrand = prof["ro.product.brand"] || "";
    var q = state.templateQuery || "";
    var list = TEMPLATES.filter(function (t) {
      return !q || (t.name + " " + t.model + " " + t.brand + " " + t.id).toLowerCase().indexOf(q) >= 0;
    });
    var extraPkgs = (state.perappPkgs || []).filter(function (p) { return state.games.indexOf(p) < 0; });
    if (state.target !== "__global__" && extraPkgs.indexOf(state.target) < 0 && state.games.indexOf(state.target) < 0) extraPkgs.push(state.target);
    var targetOptions = '<option value="__global__"' + (isGlobal ? " selected" : "") + '>全局（所有应用）</option>' +
      state.games.map(function (p) { return '<option value="' + esc(p) + '"' + (p === state.target ? " selected" : "") + '>' + esc(labelOf(p)) + '</option>'; }).join("") +
      extraPkgs.map(function (p) { return '<option value="' + esc(p) + '"' + (p === state.target ? " selected" : "") + '>' + esc(labelOf(p)) + '（仅逐应用）</option>'; }).join("");
    var activeCount = Object.keys(prof || {}).length;
    el.innerHTML =
      '<div class="env-card">' +
        '<div class="env-card-head"><b>应用目标</b><span class="env-tag">' + (isGlobal ? "GLOBAL" : "APP") + '</span></div>' +
        '<select class="env-select" id="env-target" aria-label="应用目标">' + targetOptions + '</select>' +
        '<div class="env-profile" style="margin-top:8px">' + (activeCount ? '已写入 <b>' + activeCount + '</b> 项 · ' + esc((currentBrand || "?") + " " + (currentModel || "")) : (isGlobal ? "全局未启用，选择模板或手动填写" : "该游戏未配置逐应用伪装")) + '</div>' +
        '<div class="env-note" style="margin-top:8px">' + (isGlobal ? "全局修改影响所有应用；重启或重置恢复。" : "逐应用伪装由 Zygisk 模块在目标进程内替换，保存后自动停止游戏，重新打开生效。DPI 仅支持全局。") + '</div>' +
      '</div>' +
      '<div class="env-card">' +
        '<div class="env-card-head"><b>机型模板</b><span class="env-tag">' + list.length + ' 个</span></div>' +
        '<input class="env-input" id="env-template-search" placeholder="搜索品牌 / 机型 / 代号" autocomplete="off" value="' + esc(q) + '">' +
        '<div class="env-template-list" id="env-template-list">' +
          (list.length ? list.map(function (t) {
            return '<button class="env-template" type="button" data-act="template" data-key="' + esc(t.id) + '" data-name="' + esc(t.name + " " + t.model + " " + t.brand) + '"><span><b>' + esc(t.name) + '</b><br><span>' + esc(t.brand + " · " + t.model + " · " + t.soc) + '</span></span><span class="env-chevron">›</span></button>';
          }).join("") : '<div class="env-empty" style="padding:14px">没有匹配的模板</div>') +
        '</div>' +
      '</div>' +
      '<div class="env-card">' +
        '<div class="env-card-head"><b>手动配置</b><span class="env-tag">' + (isGlobal ? "GLOBAL" : "APP") + '</span></div>' +
        '<div class="env-field-grid">' +
          '<div class="env-field"><label>制造商</label><input class="env-input" id="env-m-manufacturer" value="' + esc(prof["ro.product.manufacturer"] || "") + '" placeholder="Xiaomi"></div>' +
          '<div class="env-field"><label>品牌</label><input class="env-input" id="env-m-brand" value="' + esc(prof["ro.product.brand"] || "") + '" placeholder="Redmi"></div>' +
          '<div class="env-field"><label>型号</label><input class="env-input" id="env-m-model" value="' + esc(prof["ro.product.model"] || "") + '" placeholder="23127PN0CC"></div>' +
          '<div class="env-field"><label>设备代号</label><input class="env-input" id="env-m-device" value="' + esc(prof["ro.product.device"] || "") + '" placeholder="houji"></div>' +
          '<div class="env-field wide"><label>构建指纹</label><input class="env-input" id="env-m-fingerprint" value="' + esc(prof["ro.build.fingerprint"] || "") + '" placeholder="brand/product/device:version/id/build:user/release-keys"></div>' +
          '<div class="env-field"><label>CPU 型号</label><input class="env-input" id="env-m-cpu" value="' + esc(prof["ro.soc.model"] || "") + '" placeholder="SM8650"></div>' +
          '<div class="env-field"><label>DPI（仅全局）</label><input class="env-input" id="env-m-dpi" type="number" min="120" max="640" value="' + esc(isGlobal ? (prof.dpi || "") : "") + '" placeholder="120–640"></div>' +
        '</div>' +
        '<div class="env-actions">' +
          '<button class="env-btn primary" data-act="apply-manual">应用到' + (isGlobal ? "全局" : "当前游戏") + '</button>' +
          '<button class="env-btn danger" data-act="reset">重置' + (isGlobal ? "全局" : "当前游戏") + '</button>' +
          (state.perappCount > 0 ? '<button class="env-btn ghost" data-act="clear-perapp">清除全部逐应用</button>' : '') +
        '</div>' +
      '</div>' +
      studentStrip("优香", "yuuka_portrait.webp", "参数确认过了，可以应用。", "MILLENNIUM · 值班");
  }

  function renderIds() {
    var el = $("env-ids");
    if (!el) return;
    el.innerHTML =
      '<div class="env-card">' +
        '<div class="env-card-head"><b>Android ID</b><span class="env-tag">SYSTEM</span></div>' +
        '<div class="env-profile">当前：<b>' + esc(state.android || "未读取") + '</b></div>' +
        '<div class="env-field" style="margin-top:8px"><label>写入自定义值</label><input class="env-input" id="env-android-input" maxlength="16" autocomplete="off" placeholder="16 位十六进制，例如 1a2b3c4d5e6f7890"></div>' +
        '<div class="env-actions"><button class="env-btn primary" data-act="android-apply">应用</button><button class="env-btn ghost" data-act="android-random">随机生成</button></div>' +
      '</div>' +
      '<div class="env-card"><div class="env-row"><div><b>说明</b><p>Android ID 是系统级设置；部分应用会缓存旧值，清理应用数据或重启后才会读取新值。</p></div></div></div>' +
      '<div class="env-card">' +
        '<div class="env-card-head"><b>DRM ID</b><span class="env-tag">WIDEVINE</span></div>' +
        '<div class="env-row"><div><b>重置 Widevine</b><p>备份并清空 /data/mediadrm，重启后重新生成；可能影响 L1/依赖 DRM 的应用。</p></div></div>' +
        '<div class="env-actions"><button class="env-btn danger" data-act="drm-reset">重置 DRM ID</button></div>' +
      '</div>' +
      studentStrip("白子", "shiroko_portrait.webp", "新的 ID 已经准备好了，老师。", "ABYDOS · 值班");
  }

  function renderLogs() {
    var el = $("env-logs");
    if (!el) return;
    el.innerHTML =
      '<div class="env-card">' +
        '<div class="env-row"><div><b>运行日志</b><p>记录机型应用、清理与 Android ID 操作</p></div><button class="env-switch' + (state.logging ? " on" : "") + '" data-act="toggle-log"></button></div>' +
        '<div class="env-actions"><button class="env-btn ghost" data-act="log-refresh">刷新</button><button class="env-btn danger" data-act="log-clear">清除</button></div>' +
        '<pre class="env-log" id="env-log">' + esc(state.log || "暂无日志") + '</pre>' +
      '</div>' +
      studentStrip("瞬", "shun_portrait.webp", "日志看完了，交给我吧。", "SHANHAIJING · 值班");
  }

  async function applyProps(props, label) {
    var isGlobal = state.target === "__global__";
    if (!isGlobal && !state.target) { toast("请先选择目标游戏", true); return; }
    if (!isGlobal && props.dpi) { delete props.dpi; toast("DPI 仅支持全局，已忽略", true); }
    var keys = Object.keys(props).filter(function (k) { return props[k] != null && String(props[k]) !== ""; });
    if (!keys.length) { toast("没有可应用的配置", true); return; }
    var targetName = isGlobal ? "全局" : labelOf(state.target);
    var message = isGlobal
      ? "将写入 " + keys.length + " 项全局属性（" + label + "）。所有应用生效，部分银行/支付应用可能异常；可随时重置。"
      : "将把 " + keys.length + " 项属性写入 " + targetName + " 的逐应用配置（" + label + "）。保存后会停止该游戏，重新打开生效。";
    var ok = await confirmAction(isGlobal ? "应用全局伪装" : "应用到 " + targetName, message, "应用", false);
    if (!ok) return;
    try {
      if (isGlobal) {
        var args = ["apply"];
        keys.forEach(function (k) { args.push(k + "=" + props[k]); });
        var res = await engine(args);
        await refreshData();
        if (res && res.failed > 0) {
          toast("有 " + res.failed + " 项没写进去：" + (res.failedKeys || "") +
            "（没有 resetprop 时改不了 ro.* 属性，建议改用逐应用伪装）", true);
          return;
        }
      } else {
        var pa = ["perapp-set", state.target];
        keys.forEach(function (k) { pa.push(k + "=" + props[k]); });
        await engine(pa);
        var prev = state.perapp[state.target] || {};
        state.perapp[state.target] = Object.assign({}, prev, props);
        syncPerappCount();
        renderModel();
        renderHome();
      }
      toast(isGlobal ? "全局伪装已应用" : "已写入 " + targetName + "，重新打开游戏生效");
    } catch (e) { toast(e.message, true); }
  }

  function templateProps(t) {
    return {
      "ro.product.manufacturer": t.manufacturer,
      "ro.product.brand": t.brand,
      "ro.product.model": t.model,
      "ro.product.device": t.device,
      "ro.product.name": t.product || t.device,
      "ro.build.fingerprint": t.fingerprint,
      "ro.build.version.release": t.release,
      "ro.build.version.sdk": t.sdk,
      "ro.soc.model": t.soc,
      "ro.board.platform": t.board
    };
  }

  function applyManual() {
    var props = {};
    var map = [
      ["ro.product.manufacturer", "env-m-manufacturer"],
      ["ro.product.brand", "env-m-brand"],
      ["ro.product.model", "env-m-model"],
      ["ro.product.device", "env-m-device"],
      ["ro.build.fingerprint", "env-m-fingerprint"],
      ["ro.soc.model", "env-m-cpu"]
    ];
    map.forEach(function (x) {
      var el = $(x[1]);
      if (el && el.value.trim()) props[x[0]] = el.value.trim();
    });
    var dpiEl = $("env-m-dpi");
    if (dpiEl && dpiEl.value.trim()) {
      var n = Number(dpiEl.value.trim());
      if (!Number.isInteger(n) || n < 120 || n > 640) { toast("DPI 必须是 120–640 的整数", true); return; }
      props.dpi = String(n);
    }
    if (!Object.keys(props).length) { toast("至少填写一项配置", true); return; }
    applyProps(props, "手动配置");
  }

  async function resetProfile() {
    var isGlobal = state.target === "__global__";
    if (!isGlobal && !state.target) { toast("请先选择目标游戏", true); return; }
    var targetName = isGlobal ? "全局" : labelOf(state.target);
    if (!(await confirmAction("重置" + targetName + "伪装", isGlobal ? "将恢复首次应用前的属性，并重置 DPI。重启设备也可以恢复。" : "将删除该游戏的逐应用伪装配置，重新打开游戏后恢复系统属性。", "重置", true))) return;
    try {
      if (isGlobal) {
        await engine(["reset"]);
        await refreshData();
      } else {
        await engine(["perapp-remove", state.target]);
        delete state.perapp[state.target];
        syncPerappCount();
        renderModel();
        renderHome();
        // 回读校验：文件没删干净时本地状态会骗人
        var chk = await engine(["perapp-get", state.target]);
        var leftN = chk && chk.profile ? Object.keys(chk.profile).length : 0;
        if (leftN > 0) {
          state.perapp[state.target] = chk.profile;
          syncPerappCount();
          renderModel(); renderHome();
          toast("删除后仍读到 " + leftN + " 项配置，可点「清除全部逐应用伪装」强制清空", true);
          return;
        }
      }
      toast("已重置" + targetName);
    } catch (e) { toast(e.message, true); }
  }

  function syncPerappCount() {
    var map = state.perapp || {};
    state.perappPkgs = Object.keys(map).filter(function (k) {
      return map[k] && Object.keys(map[k]).length > 0;
    });
    state.perappCount = state.perappPkgs.length;
  }

  async function clearAllPerapp() {
    if (!(await confirmAction("清除全部逐应用伪装",
      "将删除所有游戏的逐应用机型/DRM 配置（不影响全局伪装），保存后重新打开游戏即恢复系统属性。",
      "全部清除", true))) return;
    try {
      var d = await engine(["perapp-clear"]);
      state.perapp = {};
      syncPerappCount();
      renderModel();
      renderHome();
      toast("已清除全部逐应用伪装" + (d && d.cleared ? "（" + d.cleared + " 条）" : ""));
    } catch (e) { toast(e.message, true); }
  }

  async function toggleLogging() {
    try {
      var d = await engine(["logging", state.logging ? "0" : "1"]);
      state.logging = !!d.logging;
      renderHome();
      renderLogs();
      toast(state.logging ? "运行日志已开启" : "运行日志已关闭");
    } catch (e) { toast(e.message, true); }
  }

  async function loadLog() {
    try {
      var d = await engine(["log"]);
      state.log = d.content || "";
    } catch (e) { state.log = "读取失败：" + e.message; }
    renderLogs();
  }

  async function clearLog() {
    if (!(await confirmAction("清除运行日志", "确定清除当前操作日志？", "清除", true))) return;
    try { await engine(["log-clear"]); state.log = ""; renderLogs(); toast("日志已清除"); }
    catch (e) { toast(e.message, true); }
  }

  async function resetSsaid(pkg) {
    if (!(await confirmAction("重置 SSAID", "将备份 settings_ssaid.xml，并为 " + labelOf(pkg) + " 写入新的 SSAID。需要重启后生效。", "写入", true))) return;
    try {
      var d = await engine(["ssaid-reset", pkg]);
      openModal({
        tag: "SSAID",
        title: "SSAID 已写入",
        body: '<p class="env-note">新值：<b>' + esc(d.value || "已生成") + '</b><br>备份：' + esc(d.backup || "已保存") + '<br><br>需要重启设备后生效。</p>',
        actions: '<button class="env-btn" data-act="modal-close">稍后</button><button class="env-btn primary" data-act="reboot-now">立即重启</button>'
      });
      toast("SSAID 已写入，重启后生效");
    } catch (e) { toast(e.message, true); }
  }

  function randomDrmidHex() {
    var a = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  async function resetDrmid(pkg) {
    if (!(await confirmAction("重置 DrmID", "将为 " + labelOf(pkg) + " 生成新的逐应用 Widevine deviceUniqueId。保存后会停止游戏，重新打开生效。", "生成", false))) return;
    try {
      var hex = randomDrmidHex();
      var d = await engine(["perapp-drmid", pkg, hex]);
      if (!state.perapp[pkg]) state.perapp[pkg] = {};
      state.perapp[pkg].drmid = (d && d.drmid) || hex;
      syncPerappCount();
      if (state.target === pkg) renderModel();
      renderHome();
      toast("DrmID 已更新，重新打开游戏生效");
    } catch (e) { toast(e.message, true); }
  }

  async function resetDrm() {
    if (!(await confirmAction("重置 DRM ID", "将备份 /data/mediadrm 并清空，重启后 Widevine 会重新生成设备 ID。可能影响 L1 和依赖 DRM 的应用，操作前请确认。", "重置", true))) return;
    try {
      var d = await engine(["drm-reset"]);
      openModal({
        tag: "DRM",
        title: "DRM ID 已重置",
        body: '<p class="env-note">备份：' + esc(d.backup || "已保存") + '<br><br>需要重启设备后重新生成 Widevine ID。</p>',
        actions: '<button class="env-btn" data-act="modal-close">稍后</button><button class="env-btn primary" data-act="reboot-now">立即重启</button>'
      });
      toast("DRM 已重置，重启后重新生成");
    } catch (e) { toast(e.message, true); }
  }

  async function rebootNow() {
    try {
      await engine(["reboot"]);
      toast("设备正在重启…");
    } catch (e) { toast(e.message, true); }
  }

  async function openAddGames() {
    state.selected = {};
    state.packages = [];
    openModal({
      tag: "ADD GAMES",
      title: "添加游戏",
      body: '<input class="env-input" id="env-app-search" placeholder="搜索应用名称或包名" autocomplete="off">' +
        '<div class="env-row" style="margin-top:6px"><span style="font-size:.56rem;color:#8fb3d1" id="env-app-count">正在读取应用…</span><span style="font-size:.56rem;color:#0d6fae" id="env-app-selected">已选 0</span></div>' +
        '<div class="env-list" id="env-app-list" style="max-height:44vh;overflow-y:auto;margin-top:6px"><div class="env-empty">正在读取…</div></div>',
      actions: '<button class="env-btn" data-act="modal-close">取消</button><button class="env-btn primary" data-act="save-apps">添加所选</button>'
    });
    try {
      var d = await engine(["list-apps"]);
      var pkgs = (d.apps || []).filter(validPkg).filter(function (p) { return state.games.indexOf(p) < 0; });
      if (!pkgs.length) {
        var l = $("env-app-list"); if (l) l.innerHTML = '<div class="env-empty">没有可添加的应用</div>';
        var c = $("env-app-count"); if (c) c.textContent = "0 个可添加";
        return;
      }
      await loadInfo(pkgs);
      state.packages = pkgs.map(function (p) { return { pkg: p, label: labelOf(p) }; }).sort(function (a, b) { return a.label.localeCompare(b.label, "zh-CN"); });
      renderAppPicker();
    } catch (e) {
      var l2 = $("env-app-list"); if (l2) l2.innerHTML = '<div class="env-empty">读取失败<br>' + esc(e.message) + '</div>';
    }
  }

  function renderAppPicker() {
    var list = $("env-app-list");
    if (!list) return;
    var q = ($("env-app-search") && $("env-app-search").value || "").trim().toLowerCase();
    var arr = state.packages.filter(function (x) { return !q || (x.label + " " + x.pkg).toLowerCase().indexOf(q) >= 0; });
    list.innerHTML = arr.length ? arr.map(function (x) {
      var sel = !!state.selected[x.pkg];
      return '<div class="env-app-option' + (sel ? " selected" : "") + '" data-act="pick-app" data-pkg="' + esc(x.pkg) + '">' +
        iconHtml(x.pkg) + '<b>' + esc(x.label) + '</b><span>' + (sel ? "已选" : "选择") + '</span>' +
      '</div>';
    }).join("") : '<div class="env-empty">没有匹配的应用</div>';
    var c = $("env-app-count"); if (c) c.textContent = arr.length + " 个应用";
    var s = $("env-app-selected"); if (s) s.textContent = "已选 " + Object.keys(state.selected).length;
  }

  async function saveSelected() {
    var selected = Object.keys(state.selected);
    if (!selected.length) { toast("请先选择应用", true); return; }
    try {
      var d = await engine(["games-add", selected.join(",")]);
      if (d && Array.isArray(d.games)) state.games = d.games.filter(validPkg);
      await loadInfo(state.games);
      closeModal();
      renderAll();
      toast("已添加 " + selected.length + " 个游戏");
    } catch (e) { toast(e.message, true); }
  }

  async function removeGame(pkg) {
    if (!(await confirmAction("移除游戏", "从监听列表移除 " + labelOf(pkg) + "？不会删除游戏数据。", "移除", true))) return;
    try {
      closeModal();
      var d = await engine(["games-remove", pkg]);
      if (d && Array.isArray(d.games)) state.games = d.games.filter(validPkg);
      renderAll();
      toast("已移除");
    } catch (e) { toast(e.message, true); }
  }

  async function cleanGame(pkg, mode) {
    var full = mode === "full";
    var msg = full
      ? "将强制停止并清除 " + labelOf(pkg) + " 的全部应用数据（登录、设置、缓存都会丢失），无法撤销。"
      : "将强制停止并清理 " + labelOf(pkg) + " 的缓存目录，保留登录数据。";
    if (!(await confirmAction(full ? "彻底清理游戏" : "清理游戏缓存", msg, full ? "彻底清理" : "清理", full))) return;
    try {
      closeModal();
      await engine(["clean", pkg, mode]);
      renderGames();
      toast(full ? "已清除游戏数据" : "缓存已清理");
    } catch (e) { toast(e.message, true); }
  }

  function openGameDetail(pkg) {
    openModal({
      tag: "GAME",
      title: labelOf(pkg),
      body: '<div class="env-game" style="cursor:default">' + iconHtml(pkg) +
        '<div class="env-game-copy"><b>' + esc(labelOf(pkg)) + '</b><p>' + esc(pkg) + '</p></div></div>' +
        '<div class="env-actions"><button class="env-btn" data-act="clean-cache" data-pkg="' + esc(pkg) + '">清理缓存</button><button class="env-btn danger" data-act="clean-full" data-pkg="' + esc(pkg) + '">彻底清理</button></div>' +
        '<div class="env-actions"><button class="env-btn" data-act="ssaid-reset" data-pkg="' + esc(pkg) + '">重置 SSAID</button><button class="env-btn" data-act="drmid-reset" data-pkg="' + esc(pkg) + '">重置 DrmID</button></div>' +
        '<div class="env-actions"><button class="env-btn danger" data-act="remove-game" data-pkg="' + esc(pkg) + '">移除监听</button></div>',
      actions: '<button class="env-btn" data-act="modal-close">关闭</button>'
    });
  }

  async function applyAndroid() {
    var v = ($("env-android-input") && $("env-android-input").value || "").trim().toLowerCase();
    if (!/^[0-9a-f]{16}$/.test(v)) { toast("请输入 16 位十六进制 Android ID", true); return; }
    if (!(await confirmAction("写入 Android ID", "将写入 " + v + "。部分应用需要清理数据或重启后才会读取新值。", "写入", false))) return;
    try {
      var d = await engine(["android-set", v]);
      state.android = d.value || v;
      renderHome();
      renderIds();
      toast("Android ID 已更新");
    } catch (e) { toast(e.message, true); }
  }

  async function randomAndroid() {
    if (!(await confirmAction("随机生成 Android ID", "将生成并写入新的 Android ID。", "生成", false))) return;
    try {
      var d = await engine(["android-random"]);
      state.android = d.value || state.android;
      renderHome();
      renderIds();
      toast("Android ID 已更新");
    } catch (e) { toast(e.message, true); }
  }

  function switchView(v) {
    state.view = v;
    Array.prototype.forEach.call(panel.querySelectorAll("[data-env-tab]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-env-tab") === v);
    });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-env-view]"), function (s) {
      s.classList.toggle("active", s.getAttribute("data-env-view") === v);
    });
    var body = $("env-body");
    if (body) body.scrollTop = 0;
    if (v === "logs") loadLog();
  }

  function handleEnvClick(e) {
    var nav = e.target.closest("[data-env-tab]");
    if (nav) { switchView(nav.getAttribute("data-env-tab")); return; }
    var act = e.target.closest("[data-act]");
    if (!act) return;
    var a = act.getAttribute("data-act");
    var pkg = act.getAttribute("data-pkg") || "";
    var key = act.getAttribute("data-key") || "";

    var heavy = ["refresh", "reset", "toggle-log", "add-games", "clean-cache", "clean-full", "remove-game", "ssaid-reset", "drmid-reset", "android-apply", "android-random", "drm-reset", "log-refresh", "log-clear", "save-apps"];
    if (pending > 0 && heavy.indexOf(a) >= 0) { toast("正在处理，请稍候", true); return; }

    if (a === "modal-close") { closeModal(); return; }
    if (a === "modal-cancel") {
      var rc = state.confirmResolve; state.confirmResolve = null;
      $("env-modal").hidden = true;
      if (rc) rc(false);
      return;
    }
    if (a === "modal-ok") {
      var ro = state.confirmResolve; state.confirmResolve = null;
      $("env-modal").hidden = true;
      if (ro) ro(true);
      return;
    }
    if (a === "refresh") { ensureInit(true); return; }
    if (a === "reset") { resetProfile(); return; }
    if (a === "clear-perapp") { clearAllPerapp(); return; }
    if (a === "toggle-log") { toggleLogging(); return; }
    if (a === "add-games") { openAddGames(); return; }
    if (a === "game-detail") { openGameDetail(pkg); return; }
    if (a === "clean-cache") { cleanGame(pkg, "cache"); return; }
    if (a === "clean-full") { cleanGame(pkg, "full"); return; }
    if (a === "remove-game") { removeGame(pkg); return; }
    if (a === "ssaid-reset") { resetSsaid(pkg); return; }
    if (a === "drmid-reset") { resetDrmid(pkg); return; }
    if (a === "drm-reset") { resetDrm(); return; }
    if (a === "reboot-now") { rebootNow(); return; }
    if (a === "template") {
      var t = TEMPLATES.filter(function (x) { return x.id === key; })[0];
      if (t) applyProps(templateProps(t), t.name);
      return;
    }
    if (a === "apply-manual") { applyManual(); return; }
    if (a === "android-apply") { applyAndroid(); return; }
    if (a === "android-random") { randomAndroid(); return; }
    if (a === "log-refresh") { loadLog(); return; }
    if (a === "log-clear") { clearLog(); return; }
    if (a === "pick-app") {
      if (state.selected[pkg]) delete state.selected[pkg]; else state.selected[pkg] = true;
      act.classList.toggle("selected", !!state.selected[pkg]);
      var sp = act.querySelector("span:last-child");
      if (sp) sp.textContent = state.selected[pkg] ? "已选" : "选择";
      var sel = $("env-app-selected");
      if (sel) sel.textContent = "已选 " + Object.keys(state.selected).length;
      return;
    }
    if (a === "save-apps") { saveSelected(); return; }
  }

  panel.addEventListener("click", handleEnvClick);

  function handleEnvInput(e) {
    if (e.target.id === "env-template-search") {
      state.templateQuery = e.target.value.trim().toLowerCase();
      var list = $("env-template-list");
      if (!list) return;
      Array.prototype.forEach.call(list.querySelectorAll(".env-template"), function (el) {
        var ok = !state.templateQuery || (el.getAttribute("data-name") || "").toLowerCase().indexOf(state.templateQuery) >= 0;
        el.style.display = ok ? "" : "none";
      });
    }
    if (e.target.id === "env-app-search") renderAppPicker();
  }

  panel.addEventListener("input", handleEnvInput);

  panel.addEventListener("change", function (e) {
    if (e.target.id !== "env-target") return;
    state.target = e.target.value || "__global__";
    renderModel();
  });

  var modal = $("env-modal");
  if (modal) {
    modal.addEventListener("click", handleEnvClick);
    modal.addEventListener("input", handleEnvInput);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  }
  var close = $("env-modal-close");
  if (close) close.addEventListener("click", closeModal);

  function syncOuter() {
    var tab = document.querySelector(".tab.active");
    var on = !!tab && tab.getAttribute("data-tab") === "env";
    document.body.classList.remove("env-mode");
    if (on) ensureInit(false);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () {
      requestAnimationFrame(syncOuter);
      setTimeout(syncOuter, 40);
    });
  });
  if (document.querySelector('.tab.active[data-tab="env"]')) syncOuter();
})();
