"use strict";

(function () {
  var REFRESH_MS = 20000;
  var TIMEOUT_MS = 12000;

  var seq = 0;
  var busy = false;
  var timer = null;

  function $(id) { return document.getElementById(id); }
  var els = {
    root: $("mon-root"),
    serial: $("mon-serial"),
    device: $("mon-device"),
    android: $("mon-android"),
    live: $("mon-live")
  };

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

      var name = "__mon_cb_" + (++seq) + "_" + Date.now();
      var settled = false;
      var timerId = setTimeout(function () {
        done(new Error("读取超时"));
      }, limit);

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
      if (typeof ret === "string") {
        accept(0, ret, "");
        return;
      }
      if (ret && typeof ret === "object" && (ret.stdout != null || ret.errno != null)) {
        accept(ret.errno, ret.stdout, ret.stderr);
      }
    });
  }

  var CMD = [
    "echo '##ROOT'",
    "id -u 2>/dev/null",
    "echo '##SER'",
    "getprop ro.serialno 2>/dev/null",
    "echo '##SER2'",
    "getprop ro.boot.serialno 2>/dev/null",
    "echo '##DEV'",
    "getprop ro.product.device 2>/dev/null",
    "echo '##DEV2'",
    "getprop ro.product.vendor.device 2>/dev/null",
    "echo '##REL'",
    "getprop ro.build.version.release 2>/dev/null",
    "echo '##SDK'",
    "getprop ro.build.version.sdk 2>/dev/null",
    "echo '##END'"
  ].join("; ");

  function parse(out) {
    var map = {};
    var cur = null;
    String(out || "").split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^##(ROOT|SER|SER2|DEV|DEV2|REL|SDK|END)\s*$/);
      if (m) {
        cur = m[1];
        map[cur] = [];
        return;
      }
      if (cur) map[cur].push(line);
    });
    function val(k) { return (map[k] || []).join("\n").replace(/\s+$/g, "").trim(); }
    return {
      root: val("ROOT"),
      ser: val("SER"),
      ser2: val("SER2"),
      dev: val("DEV"),
      dev2: val("DEV2"),
      rel: val("REL"),
      sdk: val("SDK")
    };
  }

  function cellOf(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.classList && node.classList.contains("mon")) return node;
      node = node.parentNode;
    }
    return null;
  }

  function setValue(el, text, state, title) {
    if (!el) return;
    el.textContent = text;
    if (title != null) el.title = title;
    var cell = cellOf(el);
    if (cell) {
      cell.classList.remove("ok", "warn", "off");
      if (state) cell.classList.add(state);
    }
  }

  function setLive(text, mode) {
    if (!els.live) return;
    els.live.innerHTML = "<i></i>" + text;
    els.live.classList.remove("offline", "syncing");
    if (mode) els.live.classList.add(mode);
  }

  function apply(data) {
    var uid = data.root;
    if (uid === "0") {
      setValue(els.root, "已获取", "ok", "uid=0");
    } else if (/^\d+$/.test(uid)) {
      setValue(els.root, "受限", "warn", "uid=" + uid);
    } else {
      setValue(els.root, "未知", "off", "无法读取 uid");
    }

    var serial = data.ser || data.ser2;
    if (serial && serial.toLowerCase() !== "unknown") {
      setValue(els.serial, serial, "ok", serial);
    } else if (serial) {
      setValue(els.serial, "不可读", "warn", serial);
    } else {
      setValue(els.serial, "不可读", "off", "无法读取序列号");
    }

    var dev = data.dev || data.dev2;
    if (dev && dev.toLowerCase() !== "unknown") {
      setValue(els.device, dev, "ok", dev);
    } else if (dev) {
      setValue(els.device, dev, "warn", dev);
    } else {
      setValue(els.device, "未知", "off", "无法读取设备代号");
    }

    if (data.rel) {
      var android = data.rel + (data.sdk ? " · SDK " + data.sdk : "");
      setValue(els.android, android, "ok", android);
    } else {
      setValue(els.android, "未知", "off", "无法读取安卓版本");
    }
  }

  function offline() {
    setValue(els.root, "未连接", "off", "未检测到 WebUI 执行接口");
    setValue(els.serial, "—", "off", "");
    setValue(els.device, "—", "off", "");
    setValue(els.android, "—", "off", "");
    setLive("OFFLINE", "offline");
  }

  function refresh() {
    if (busy) return;
    busy = true;
    setLive("SYNC", "syncing");

    if (!getBridge()) {
      offline();
      busy = false;
      return;
    }

    execOnce(CMD, TIMEOUT_MS).then(function (r) {
      apply(parse(r.out || ""));
      setLive("LIVE");
    }, function (err) {
      setValue(els.root, "读取失败", "warn", err && err.message ? err.message : "");
      setValue(els.serial, "—", "off", "");
      setValue(els.device, "—", "off", "");
      setValue(els.android, "—", "off", "");
      setLive("OFFLINE", "offline");
    }).then(function () {
      busy = false;
    });
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      if (!document.hidden) refresh();
      schedule();
    }, REFRESH_MS);
  }

  if (els.live) {
    els.live.addEventListener("click", function () { refresh(); });
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });

  setTimeout(refresh, 350);
  schedule();
})();
