"use strict";

(function () {
  var MODULE_ID = "AYJX-ROOT";
  var MODDIR_CANDIDATES = [
    "/data/adb/modules/" + MODULE_ID,
    "/data/adb/modules_update/" + MODULE_ID
  ];
  var WORK = "/data/local/tmp/" + MODULE_ID + "-ui";
  var JOB_LOG = WORK + "/job.log";
  var JOB_RC = WORK + "/job.rc";
  var JOB_PID = WORK + "/job.pid";

  var POLL_MS = 500;          // 日志轮询间隔
  var CHUNK = 262144;         // 每次最多取 256KB
  var MAX_TEXT = 500000;      // 页面里最多保留 50 万字符
  var QUICK_TIMEOUT = 15000;  // 单条短命令超时

  var $ = function (id) { return document.getElementById(id); };
  var outputEl = $("output");
  var statusEl = $("run-status");
  var stopBtn = $("btn-stop");
  var runBtns = Array.prototype.slice.call(document.querySelectorAll("button[data-run]"));

  var moddir = null;
  var job = null;       // 当前任务
  var busy = false;
  var seq = 0;

  /* ------------------------------------------------------------------ */
  /* 日志显示                                                            */
  /* ------------------------------------------------------------------ */

  function appendText(text) {
    if (!text) return;
    var cur = outputEl.textContent;
    var next = cur + text;
    if (next.length > MAX_TEXT) {
      next = "…（前面的输出已省略）\n" + next.slice(-MAX_TEXT);
    }
    outputEl.textContent = next;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function logLine(text) {
    appendText(text + "\n");
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text ? "· " + text : "";
  }

  function setBusy(on) {
    busy = on;
    runBtns.forEach(function (b) { b.disabled = on; });
    if (stopBtn) stopBtn.hidden = !on;
  }

  /* ------------------------------------------------------------------ */
  /* 与宿主通信                                                          */
  /* ------------------------------------------------------------------ */

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

  var EXEC_MODE = null;      // "cb3" | "cb2"
  var execModePromise = null;
  var PROBE_CMD = "echo __KSU_PROBE_OK__";

  function rawExec(mode, cmd, limit) {
    return new Promise(function (resolve, reject) {
      var bridge = getBridge();
      if (!bridge) {
        reject(new Error("找不到 WebUI 执行接口（ksu.exec）。请用 KernelSU / KSU-Next 管理器里的「模块 WebUI」打开本页，不要用普通浏览器。"));
        return;
      }
      var name = "__ksu_probe_" + (++seq) + "_" + Date.now();
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("probe-timeout"));
      }, limit || 1500);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[name]; } catch (e) { window[name] = undefined; }
      }
      function done(err, data) {
        if (settled) return;
        settled = true;
        cleanup();
        if (err) reject(err); else resolve(data);
      }

      window[name] = function (errno, stdout) {
        done(null, { code: Number(errno) || 0, out: stdout == null ? "" : String(stdout) });
      };

      var ret;
      try {
        ret = mode === "cb2" ? bridge.exec(cmd, name) : bridge.exec(cmd, "{}", name);
      } catch (e) {
        done(e);
        return;
      }
      if (ret && typeof ret.then === "function") {
        ret.then(function (r) {
          done(null, { code: 0, out: r && r.stdout != null ? String(r.stdout) : "" });
        }, function (e) { done(e || new Error("执行失败")); });
        return;
      }
      if (typeof ret === "string") {
        done(null, { code: 0, out: ret });
        return;
      }
      if (ret && typeof ret === "object" && (ret.stdout != null || ret.errno != null)) {
        done(null, { code: Number(ret.errno) || 0, out: ret.stdout == null ? "" : String(ret.stdout) });
      }
      
    });
  }

  function detectExecMode() {
    if (execModePromise) return execModePromise;
    execModePromise = rawExec("cb3", PROBE_CMD, 1500).then(function (r) {
      if (String(r.out).indexOf("__KSU_PROBE_OK__") >= 0) return (EXEC_MODE = "cb3");
      throw new Error("no-cb3");
    }).catch(function () {
      return rawExec("cb2", PROBE_CMD, 1500).then(function (r) {
        if (String(r.out).indexOf("__KSU_PROBE_OK__") >= 0) return (EXEC_MODE = "cb2");
        throw new Error("no-cb2");
      });
    }).catch(function (e) {
      execModePromise = null;
      throw new Error("WebUI 执行接口无响应（" + ((e && e.message) || e) + "）。请用 KernelSU / KSU-Next 管理器里的「模块 WebUI」打开本页。");
    });
    return execModePromise;
  }

  function execOnce(cmd, timeoutMs) {
    return detectExecMode().then(function () {
      return rawExec(EXEC_MODE, cmd || "", timeoutMs || QUICK_TIMEOUT);
    });
  }

  window.KSUUI = {
    exec: function (cmd, timeoutMs) { return execOnce(cmd, timeoutMs || QUICK_TIMEOUT); }
  };

  var textDecoder = null;
  try { textDecoder = new TextDecoder("utf-8"); } catch (e) { textDecoder = null; }

  function b64ToText(b64) {
    var clean = String(b64 || "").replace(/\s+/g, "");
    if (!clean) return "";
    var bin;
    try { bin = atob(clean); } catch (e) { return null; }
    if (textDecoder && typeof Uint8Array !== "undefined") {
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      try { return textDecoder.decode(bytes); } catch (e) { /* 落到下面的兜底 */ }
    }
    try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; }
  }

  function resolveModdir() {
    if (moddir) return Promise.resolve(moddir);
    var probe = "for p in " + MODDIR_CANDIDATES.map(shq).join(" ") +
      "; do [ -d \"$p/scripts\" ] && { echo \"$p\"; break; }; done";
    return execOnce(probe, 10000).then(function (r) {
      var found = (r.out || "").trim().split("\n")[0].trim();
      if (found) {
        moddir = found;
        return moddir;
      }
      throw new Error("在 " + MODDIR_CANDIDATES.join(" / ") + " 下都没找到模块脚本目录，请确认模块已经安装并重启过一次。");
    });
  }



  function countNewlines(text) {
    var n = 0;
    for (var i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return n;
  }

  function pollCommand() {
    return [
      "echo '##RC'",
      "cat " + shq(JOB_RC) + " 2>/dev/null",
      "echo",
      "echo '##OUT'",
      "tail -n +" + job.line + " " + shq(JOB_LOG) + " 2>/dev/null | head -c " + CHUNK +
        " | (base64 2>/dev/null || busybox base64 2>/dev/null || cat)",
      "echo",
      "echo '##ALIVE'",
      "kill -0 $(cat " + shq(JOB_PID) + " 2>/dev/null) 2>/dev/null && echo 1 || echo 0",
      "echo '##END'"
    ].join("; ");
  }

  function parsePoll(out) {
    var iRc = out.indexOf("##RC");
    var iOut = out.indexOf("##OUT");
    var iAlive = out.indexOf("##ALIVE");
    var iEnd = out.indexOf("##END");
    if (iRc < 0 || iOut < 0 || iAlive < 0) return null;

    var rc = out.slice(iRc + 4, iOut).replace(/^\s+|\s+$/g, "");
    var payload = out.slice(iOut + 5, iAlive);
    var alive = out.slice(iAlive + 7, iEnd < 0 ? out.length : iEnd).replace(/^\s+|\s+$/g, "");
    return { rc: rc, payload: payload, alive: alive === "1" };
  }

  function consumePayload(payload) {
    var decoded = b64ToText(payload);
    if (decoded === null) {
      // 宿主没有 base64，退回原始文本
      decoded = payload;
    }
    if (!decoded) return;

    var cut = decoded.lastIndexOf("\n");
    var complete;
    if (cut < 0) {
      complete = decoded;
      job.line += 1;
    } else {
      complete = decoded.slice(0, cut + 1);
      job.line += countNewlines(complete);
    }
    appendText(complete);
  }

  function schedulePoll(delay) {
    if (!job) return;
    job.timer = setTimeout(function () { pollOnce(); }, delay);
  }

  function pollOnce() {
    var current = job;
    if (!current) return;
    execOnce(pollCommand(), QUICK_TIMEOUT).then(function (r) {
      if (job !== current) return;

      var data = parsePoll(r.out || "");
      if (!data) {
        current.badPolls = (current.badPolls || 0) + 1;
        if (current.badPolls >= 5) {
          finishJob(null, "多次读取日志失败，已停止跟踪（脚本可能仍在后台运行）。");
          return;
        }
        schedulePoll(POLL_MS);
        return;
      }
      current.badPolls = 0;

      consumePayload(data.payload);

      var elapsed = Math.round((Date.now() - current.startedAt) / 1000);
      setStatus("运行中 " + elapsed + "s");

      if (data.rc !== "") {
        current.rc = data.rc;
        finalDrain(current);
        return;
      }

      if (!data.alive) {
        current.deadCount = (current.deadCount || 0) + 1;
        if (current.deadCount >= 3) {
          finishJob(null, "脚本进程已退出，但没有拿到退出码（可能被系统杀掉）。");
          return;
        }
      } else {
        current.deadCount = 0;
      }

      schedulePoll(POLL_MS);
    }, function (err) {
      if (job !== current) return;
      current.failCount = (current.failCount || 0) + 1;
      if (current.failCount >= 3) {
        finishJob(null, "读取输出失败：" + err.message);
        return;
      }
      schedulePoll(POLL_MS * 2);
    });
  }

  function finalDrain(current) {
    execOnce(
      "tail -n +" + current.line + " " + shq(JOB_LOG) + " 2>/dev/null | head -c " + CHUNK +
        " | (base64 2>/dev/null || busybox base64 2>/dev/null || cat)",
      QUICK_TIMEOUT
    ).then(function (r) {
      if (job !== current) return;
      var decoded = b64ToText(r.out || "");
      if (decoded === null) decoded = r.out || "";
      appendText(decoded);
      current.line += countNewlines(decoded) + (decoded && decoded.slice(-1) !== "\n" ? 1 : 0);
      if (decoded.length >= CHUNK) {
        setTimeout(function () { finalDrain(current); }, 0);
        return;
      }
      finishJob(current.rc, null);
    }, function () {
      if (job === current) finishJob(current.rc, null);
    });
  }

  function finishJob(code, note) {
    var current = job;
    if (!current) return;
    clearTimeout(current.timer);
    job = null;
    setBusy(false);

    setStatus("");
    if (current.stopped) {
      logLine("[已停止] 任务被手动终止");
      return;
    }
    if (note) {
      logLine("[错误] " + note);
      return;
    }
    var tag = String(code) === "0" ? "[完成]" : "[失败]";
    logLine(tag + " 退出码 " + code + "（用时 " + Math.round((Date.now() - current.startedAt) / 1000) + "s）");
  }

  function startJob(label, script, args) {
    if (busy) return;

    clearLog();
    setBusy(true);
    setStatus("准备中…");
    logLine("[" + label + "] 启动中…");

    resolveModdir().then(function (dir) {
      var scriptPath = dir + "/scripts/" + script;
      var argStr = (args || []).map(shq).join(" ");
      var launch = [
        "mkdir -p " + shq(WORK),
        "rm -f " + shq(JOB_LOG) + " " + shq(JOB_RC) + " " + shq(JOB_PID),
        ": > " + shq(JOB_LOG),
        "( sh " + shq(scriptPath) + (argStr ? " " + argStr : "") +
          " >> " + shq(JOB_LOG) + " 2>&1 < /dev/null; echo $? > " + shq(JOB_RC) +
          " ) > /dev/null 2>&1 & echo $! > " + shq(JOB_PID),
        "echo '##STARTED'"
      ].join("; ");

      return execOnce(launch, QUICK_TIMEOUT).then(function (r) {
        if ((r.out || "").indexOf("##STARTED") < 0) {
          throw new Error("启动脚本失败：" + (r.err || r.out || "未知原因"));
        }
        logLine("> " + scriptPath + (argStr ? " " + argStr : ""));

        job = {
          script: script,
          startedAt: Date.now(),
          line: 1,
          timer: null,
          rc: "",
          stopped: false
        };
        setStatus("运行中 0s");
        schedulePoll(150);
      });
    }).catch(function (err) {
      job = null;
      setBusy(false);
      setStatus("");
      logLine("[错误] " + err.message);
    });
  }

  function stopJob() {
    if (!job) return;
    var current = job;
    current.stopped = true;
    var cmd = [
      "kill -TERM $(cat " + shq(JOB_PID) + " 2>/dev/null) 2>/dev/null",
      "pkill -TERM -f " + shq("scripts/" + current.script) + " 2>/dev/null",
      "echo stopped"
    ].join("; ");
    execOnce(cmd, 8000).catch(function () {  })
      .then(function () {
        if (job === current) {
          clearTimeout(current.timer);
          job = null;
          setBusy(false);
          setStatus("");
          logLine("[已停止] 任务被手动终止（正在结束进程）");
        }
      });
  }

  function clearLog() {
    outputEl.textContent = "";
  }

  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (tab) {
    tab.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
        t.classList.remove("active");
      });
      Array.prototype.forEach.call(document.querySelectorAll(".panel"), function (p) {
        p.classList.remove("active");
      });
      tab.classList.add("active");
      var panel = document.getElementById("panel-" + tab.getAttribute("data-tab"));
      if (panel) panel.classList.add("active");
    });
  });

  function readValue(id) {
    var el = $(id);
    return el ? el.value.trim() : "";
  }

  function validPkg(pkg) {
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pkg);
  }

  var actions = {
    oneclick: function () {
      startJob("一键配置", "oneclick.sh", []);
    },
    main: function () {
      var pkg = readValue("main-pkg");
      if (pkg && !validPkg(pkg)) { logLine("[错误] 包名只能包含字母、数字、点、下划线和中划线"); return; }
      startJob("主应用修复", "fix_pkg_main.sh", pkg ? [pkg] : []);
    },
    dual: function () {
      var pkg = readValue("dual-pkg");
      var user = readValue("dual-user");
      if (pkg && !validPkg(pkg)) { logLine("[错误] 包名只能包含字母、数字、点、下划线和中划线"); return; }
      if (user && !/^[0-9]+$/.test(user)) { logLine("[错误] 分身 User ID 必须是数字"); return; }
      // 脚本的第 1 个参数是包名、第 2 个是 User ID，只填 User ID 时包名必须补上默认值
      if (user && !pkg) pkg = "com.tencent.mf.uam";
      var args = [];
      if (pkg) args.push(pkg);
      if (user) args.push(user);
      startJob("分身修复", "fix_pkg_dual.sh", args);
    },
    arb: function () {
      startJob("ARB 检测", "check_arb.sh", []);
    },
    fuzzy: function () {
      var dir = readValue("fuzzy-dir") || ".";
      var pattern = readValue("fuzzy-pattern");
      if (!pattern) { logLine("[错误] 关键词不能为空"); return; }
      startJob("模糊查找", "fuzzy_find.sh", [dir, pattern]);
    }
  };

  Array.prototype.forEach.call(document.querySelectorAll("button[data-run]"), function (btn) {
    btn.addEventListener("click", function () {
      var fn = actions[btn.getAttribute("data-run")];
      if (fn) fn();
    });
  });

  $("btn-clear").addEventListener("click", clearLog);
  if (stopBtn) stopBtn.addEventListener("click", stopJob);

  $("btn-export").addEventListener("click", function () {
    var path = readValue("export-path") || "/sdcard/Download/ksu_output.txt";
    if (!/^\//.test(path)) {
      logLine("[错误] 导出路径必须是绝对路径，例如 /sdcard/Download/ksu_output.txt");
      return;
    }
    var cmd = "mkdir -p \"$(dirname " + shq(path) + ")\" 2>/dev/null; cp -f " + shq(JOB_LOG) + " " + shq(path) +
      " 2>&1; echo \"##EXPORT=$?\"";
    execOnce(cmd, 15000).then(function (r) {
      var m = (r.out || "").match(/##EXPORT=(\d+)/);
      if (m && m[1] === "0") {
        logLine("[导出] 已保存到 " + path);
      } else {
        logLine("[导出] 失败：" + (r.out || r.err || "没有可导出的日志，或路径无权限").replace(/##EXPORT=\d+/, "").trim());
      }
    }).catch(function (err) {
      logLine("[导出] 失败：" + err.message);
    });
  });

  if (!getBridge()) {
    logLine("⚠️ 没有检测到 WebUI 执行接口，按钮点下去不会执行命令。");
    logLine("   请用 KernelSU / KSU-Next 管理器的模块 WebUI 打开本页。");
  }
})();
