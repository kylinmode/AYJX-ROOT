"use strict";


(function () {
  var TIMEOUT_MS = 12000;
  var seq = 0;
  var busy = false;
  var statusEl = document.getElementById("game-status");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".game"));

  function getBridge() {
    var names = ["ksu", "kernelsu", "ksuwebui"];
    for (var i = 0; i < names.length; i++) {
      var b = window[names[i]];
      if (b && typeof b.exec === "function") return b;
    }
    return null;
  }

  function shq(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
  }

  function execOnce(cmd, timeoutMs) {
    var limit = timeoutMs || TIMEOUT_MS;
    return new Promise(function (resolve, reject) {
      var bridge = getBridge();
      if (!bridge) {
        reject(new Error("找不到 WebUI 执行接口"));
        return;
      }

      var name = "__game_cb_" + (++seq) + "_" + Date.now();
      var settled = false;
      var timerId = setTimeout(function () {
        done(new Error("启动超时"));
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

  function setStatus(text, mode) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("ok", "fail", "busy");
    if (mode) statusEl.classList.add(mode);
  }

  function launch(btn) {
    if (busy) return;
    var pkg = btn.getAttribute("data-pkg");
    var name = btn.getAttribute("data-name") || "游戏";
    if (!pkg) return;

    if (!getBridge()) {
      setStatus("需 KSU WebUI", "fail");
      return;
    }

    busy = true;
    btn.classList.add("busy");
    setStatus("启动中…", "busy");

    var cmd = "monkey -p " + shq(pkg) + " -c android.intent.category.LAUNCHER 1 2>&1";
    execOnce(cmd, TIMEOUT_MS).then(function (r) {
      var out = String(r.out || "") + " " + String(r.err || "");
      if (/No activities found|monkey aborted|not found|Error/i.test(out)) {
        setStatus("未安装/启动失败", "fail");
      } else {
        setStatus("已启动 " + name, "ok");
      }
    }, function () {
      setStatus("启动失败", "fail");
    }).then(function () {
      busy = false;
      btn.classList.remove("busy");
    });
  }

  cards.forEach(function (btn) {
    btn.addEventListener("click", function () { launch(btn); });
  });
})();
