// Chat history: lists saved contracts (grouped by name) and reopens a conversation.
// Reads from Supabase via the anon key and the public SELECT policy only.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var dialog = $("history-dialog");
  var openBtn = $("history-btn");
  var closeBtn = $("history-close");
  var backBtn = $("history-back");
  var title = $("history-title");
  var loading = $("history-loading");
  var empty = $("history-empty");
  var errorBox = $("history-error");
  var retryBtn = $("history-retry");
  var list = $("history-list");
  var thread = $("history-thread");

  var view = "list";      // "list" or "thread"
  var openName = null;
  var requestId = 0;      // ignores out-of-order responses

  function show(which) {
    loading.hidden = which !== "loading";
    empty.hidden = which !== "empty";
    errorBox.hidden = which !== "error";
    list.hidden = which !== "list";
    thread.hidden = which !== "thread";
    backBtn.hidden = view !== "thread";
    title.textContent = view === "thread" ? openName : "Chat history";
  }

  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  // Group rows (newest first) by contract: name, count, last activity.
  function group(rows) {
    var map = {}, out = [];
    rows.forEach(function (r) {
      var g = map[r.contract_name];
      if (!g) { g = map[r.contract_name] = { name: r.contract_name, count: 0, last: r.created_at }; out.push(g); }
      g.count++;
      if (r.created_at > g.last) g.last = r.created_at;
    });
    out.sort(function (a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : 0; });
    return out;
  }

  function loadList() {
    var id = ++requestId;
    view = "list";
    show("loading");
    window.AppSupabase.select("chat_messages", {
      select: "contract_name,created_at",
      order: "created_at.desc",
      limit: 1000
    }).then(function (rows) {
      if (id !== requestId) return;
      var groups = group(rows);
      if (!groups.length) return show("empty");
      list.textContent = "";
      groups.forEach(function (g) {
        var li = document.createElement("li");
        var b = document.createElement("button");
        b.type = "button";
        b.className = "hist-item";
        var n = document.createElement("span");
        n.className = "hist-name";
        n.textContent = g.name;
        var m = document.createElement("span");
        m.className = "hist-meta";
        m.textContent = g.count + (g.count === 1 ? " question" : " questions") + " · " + when(g.last);
        b.appendChild(n); b.appendChild(m);
        b.addEventListener("click", function () { loadThread(g.name); });
        li.appendChild(b);
        list.appendChild(li);
      });
      show("list");
    }).catch(function (err) {
      console.warn("[history] list failed:", err && err.message);
      if (id === requestId) show("error");
    });
  }

  function loadThread(name) {
    var id = ++requestId;
    view = "thread";
    openName = name;
    show("loading");
    window.AppChat.fetchConversation(name).then(function (rows) {
      if (id !== requestId) return;
      thread.textContent = "";
      if (!rows.length) return show("empty");
      rows.forEach(function (r) { window.AppChat.renderPair(thread, r); });
      show("thread");
      thread.scrollTop = 0;
    }).catch(function (err) {
      console.warn("[history] thread failed:", err && err.message);
      if (id === requestId) show("error");
    });
  }

  function reload() { if (view === "thread") loadThread(openName); else loadList(); }

  openBtn.addEventListener("click", function () {
    dialog.showModal();
    loadList(); // refetch each time, so newly saved messages appear
  });
  closeBtn.addEventListener("click", function () { dialog.close(); });
  backBtn.addEventListener("click", loadList);
  retryBtn.addEventListener("click", reload);
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("close", function () { requestId++; openBtn.focus(); });
})();
