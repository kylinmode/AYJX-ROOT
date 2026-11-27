"use strict";


(function () {
  var TIMEOUT_MS = 6000;
  var seq = 0;

  var MODES = {
    reboot: {
      name: "重启",
      verb: "重启",
      title: "确认重启？",
      desc: "设备会立即重启，未保存的数据可能丢失。",
      confirm: "确认重启",
      cmd: "svc power reboot || reboot"
    },
    soft: {
      name: "软重启",
      verb: "软重启",
      title: "确认软重启？",
      desc: "只重启系统界面（zygote），不重启内核。部分设备可能表现为普通重启。",
      confirm: "确认软重启",
      cmd: "setprop ctl.restart zygote || (stop; start)"
    },
    bootloader: {
      name: "Bootloader",
      verb: "进入 Bootloader",
      title: "重启到 Bootloader？",
      desc: "设备将进入 Fastboot / Bootloader 模式，适合刷机、救砖等操作。",
      confirm: "进入 Bootloader",
      cmd: "reboot bootloader"
    },
    edl: {
      name: "EDL (9008)",
      verb: "进入 EDL",
      title: "重启到 EDL 9008？",
      desc: "设备将尝试进入高通 EDL 下载模式。部分机型不支持该命令，可能需要按键组合；进入后请谨慎操作。",
      confirm: "进入 EDL",
      cmd: "reboot edl"
    },
    recovery: {
      name: "Recovery",
      verb: "进入 Recovery",
      title: "重启到 Recovery？",
      desc: "设备将重启到 Recovery 模式，可用于清除数据或刷入更新。",
      confirm: "进入 Recovery",
      cmd: "reboot recovery"
    }
  };

  var menu = document.getElementById("power-menu");
  var scrim = document.getElementById("power-scrim");
  var trigger = document.getElementById("power-btn");
  var modal = document.getElementById("power-modal");
  var titleEl = document.getElementById("power-title");
  var descEl = document.getElementById("power-desc");
  var confirmBtn = document.getElementById("power-confirm");
  var cancelBtn = document.getElementById("power-cancel");
  var toast = document.getElementById("power-toast");
  var dialog = document.getElementById("power-dialog");
  var avatar = document.getElementById("power-avatar");
  var charName = document.getElementById("power-char");

  var current = null;
  var toastTimer = null;

  var CHARS = [
    { id: "shiroko", name: "白子" },
    { id: "hoshino", name: "星野" },
    { id: "yuuka", name: "优香" },
    { id: "aru", name: "阿露" },
    { id: "shun", name: "瞬" },
    { id: "asuna", name: "亚丝娜" },
    { id: "hina", name: "日奈" }
  ];
  var charBag = [];

  function nextChar() {
    if (!charBag.length) {
      charBag = CHARS.slice();
      for (var i = charBag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = charBag[i]; charBag[i] = charBag[j]; charBag[j] = t;
      }
    }
    return charBag.pop();
  }

  function getBridge() {
    var names = ["ksu", "kernelsu", "ksuwebui"];
    for (var i = 0; i < names.length; i++) {
      var b = window[names[i]];
      if (b && typeof b.exec === "function") return b;
    }
    return null;
  }

  function execOnce(cmd, timeoutMs) {
    var limit = timeoutMs || TIMEOUT_MS;
    return new Promise(function (resolve, reject) {
      var bridge = getBridge();
      if (!bridge) {
        reject(new Error("找不到 WebUI 执行接口"));
        return;
      }
      var name = "__power_cb_" + (++seq) + "_" + Date.now();
      var settled = false;
      var timerId = setTimeout(function () { done(new Error("命令超时")); }, limit);

      function cleanup() {
        clearTimeout(timerId);
        try { delete window[name]; } catch (e) { window[name] = undefined; }
      }
      function done(err, data) {
        if (settled) return;
        settled = true;
        cleanup();
        if (err) reject(err); else resolve(data);
      }
      function accept(errno, stdout, stderr) {
        done(null, {
          code: typeof errno === "number" ? errno : 0,
          out: stdout == null ? "" : String(stdout),
          err: stderr == null ? "" : String(stderr)
        });
      }

      window[name] = accept;

      var ret;
      try {
        ret = bridge.exec(cmd, name);
      } catch (e) {
        done(e);
        return;
      }
      if (ret && typeof ret.then === "function") {
        ret.then(function (r) {
          if (!r) return accept(0, "", "");
          var code = r.errno != null ? r.errno : (r.exitCode != null ? r.exitCode : 0);
          accept(code, r.stdout, r.stderr);
        }, function (e) { done(e || new Error("执行失败")); });
        return;
      }
      if (typeof ret === "string") { accept(0, ret, ""); return; }
      if (ret && typeof ret === "object" && (ret.stdout != null || ret.errno != null)) {
        accept(ret.errno, ret.stdout, ret.stderr);
      }
    });
  }

  function showToast(text, isError) {
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.toggle("error", !!isError);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2800);
  }

  function openMenu() {
    if (!menu || !scrim) return;
    menu.hidden = false;
    scrim.hidden = false;
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    var first = menu.querySelector(".power-item");
    if (first) setTimeout(function () { first.focus(); }, 30);
  }

  function closeMenu(restoreFocus) {
    if (!menu || !scrim) return;
    menu.hidden = true;
    scrim.hidden = true;
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) trigger.focus();
    }
  }

  function openConfirm(mode) {
    var item = MODES[mode];
    if (!item) return;
    current = mode;
    if (titleEl) titleEl.textContent = item.title;
    if (descEl) descEl.textContent = item.desc;
    if (confirmBtn) confirmBtn.textContent = item.confirm;

    var ch = nextChar();
    if (avatar) {
      avatar.src = "assets/" + ch.id + ".webp";
      avatar.alt = "值班学生 " + ch.name;
    }
    if (charName) charName.textContent = ch.name;
    if (dialog) dialog.setAttribute("data-char", ch.id);

    closeMenu(false);
    if (modal) {
      modal.hidden = false;
      setTimeout(function () { if (dialog) dialog.focus(); }, 30);
    }
  }

  function closeConfirm() {
    if (modal) modal.hidden = true;
    current = null;
    if (trigger) trigger.focus();
  }

  function runPower(mode) {
    var item = MODES[mode];
    if (!item) return;

    if (!getBridge()) {
      closeConfirm();
      showToast("请用 KSU WebUI 打开本页", true);
      return;
    }

    closeConfirm();
    showToast("正在执行：" + item.name + "…", false);

    execOnce(item.cmd, TIMEOUT_MS).then(function (r) {
      var out = String(r.out || "") + " " + String(r.err || "");
      if (/not found|Permission denied|failed|error/i.test(out)) {
        showToast("执行失败：" + out.replace(/\s+/g, " ").slice(0, 80), true);
      } else {
        showToast("已发送，设备即将" + item.verb + "…", false);
      }
    }, function () {
      showToast("已发送，设备即将" + item.verb + "…", false);
    });
  }

  if (trigger) {
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menu && !menu.hidden) closeMenu(true); else openMenu();
    });
  }
  if (scrim) {
    scrim.addEventListener("click", function () { closeMenu(true); });
  }
  if (menu) {
    Array.prototype.forEach.call(menu.querySelectorAll(".power-item"), function (item) {
      item.addEventListener("click", function () {
        openConfirm(item.getAttribute("data-power"));
      });
    });
  }
  if (cancelBtn) cancelBtn.addEventListener("click", closeConfirm);
  if (confirmBtn) {
    confirmBtn.addEventListener("click", function () {
      if (current) runPower(current);
    });
  }
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeConfirm();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (modal && !modal.hidden) closeConfirm();
    else if (menu && !menu.hidden) closeMenu(true);
  });
})();
