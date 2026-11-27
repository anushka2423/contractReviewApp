(function () {
  var CFG = window.APP_CONFIG || {};
  // Ingestion: receives the PDF once, right after upload. Chat: only the typed message.
  var INGEST_URL = CFG.INGEST_URL;
  var CHAT_URL = CFG.CHAT_URL;

  var $ = function (id) { return document.getElementById(id); };
  var dropzone = $("dropzone");
  var fileInput = $("file-input");
  var uploadBtn = $("upload-btn");
  var frame = $("pdf-frame");
  var clearBtn = $("clear-btn");
  var errorEl = $("upload-error");
  var topbarFile = $("topbar-file");
  var fileMeta = $("file-meta");
  var form = $("chat-form");
  var input = $("chat-input");
  var sendBtn = $("send-btn");
  var messages = $("messages");

  var currentUrl = null;
  var currentFile = null;
  var currentContract = "Untitled contract"; // name used to save/load chat history
  var busy = false;
  var ready = false;        // true once the current contract is indexed
  var ingestToken = 0;      // identifies the latest upload, so stale results are ignored
  var placeholderText = input.placeholder;

  input.disabled = true;
  input.placeholder = "Upload a contract to start chatting…";

  /* ---------- Contract upload & preview ---------- */

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  // "Master Services Agreement.pdf" -> "Master Services Agreement"
  function contractName(fileName) {
    var n = String(fileName || "").replace(/\.[^./\\]+$/, "").trim();
    return n || "Untitled contract";
  }

  function loadFile(file) {
    if (!file) return;
    var isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      showError("That doesn’t look like a PDF. Please choose a .pdf file.");
      return;
    }
    showError("");
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(file);
    currentFile = file;
    currentContract = contractName(file.name);

    frame.src = currentUrl;
    frame.hidden = false;
    dropzone.hidden = true;

    topbarFile.textContent = file.name;
    topbarFile.hidden = false;
    fileMeta.textContent = file.name + " · " + formatSize(file.size);
    fileMeta.hidden = false;
    clearBtn.hidden = false;
    uploadBtn.textContent = "Replace contract";

    ingest(file);
  }

  // Send the PDF once to the ingestion webhook; chat stays disabled until it succeeds.
  function ingest(file) {
    var token = ++ingestToken;
    ready = false;
    input.disabled = true;
    input.placeholder = "Indexing contract…";
    updateSendState();
    var status = addMessage("Indexing contract…", "bot");

    var body = new FormData();
    body.append("data", file, file.name);

    fetch(INGEST_URL, { method: "POST", body: body })
      .then(function (res) {
        if (!res.ok) throw new Error("The server returned " + res.status + ".");
      })
      .then(function () {
        if (token !== ingestToken) return;
        ready = true;
        status.textContent = "Loaded “" + file.name + "”. What would you like to know?";
        input.disabled = false;
        input.placeholder = placeholderText;
        updateSendState();
        input.focus();
        loadPrior(token, currentContract);
      })
      .catch(function (err) {
        if (token !== ingestToken) return;
        status.className = "msg bot error";
        status.textContent = "Sorry, I couldn’t index that contract. " + (err.message || "") +
          " Please upload it again.";
        clearFile(true);
      });
  }

  function clearFile(keepToken) {
    if (keepToken !== true) ingestToken++; // cancel any in-flight indexing
    ready = false;
    input.disabled = true;
    input.placeholder = "Upload a contract to start chatting…";
    updateSendState();
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
    currentFile = null;
    currentContract = "Untitled contract";
    frame.removeAttribute("src");
    frame.hidden = true;
    dropzone.hidden = false;
    fileInput.value = "";
    topbarFile.hidden = true;
    fileMeta.hidden = true;
    clearBtn.hidden = true;
    uploadBtn.textContent = "Upload contract";
  }

  function pickFile() { fileInput.click(); }

  uploadBtn.addEventListener("click", pickFile);
  dropzone.addEventListener("click", pickFile);
  dropzone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pickFile();
    }
  });
  fileInput.addEventListener("change", function () {
    loadFile(fileInput.files[0]);
    fileInput.value = ""; // allow re-selecting the same file
  });
  clearBtn.addEventListener("click", function () { clearFile(); });

  ["dragenter", "dragover"].forEach(function (type) {
    dropzone.addEventListener(type, function (e) {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (type) {
    dropzone.addEventListener(type, function (e) {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });
  dropzone.addEventListener("drop", function (e) {
    loadFile(e.dataTransfer.files[0]);
  });

  // Dropping a file anywhere else shouldn't navigate the browser away.
  ["dragover", "drop"].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (!dropzone.contains(e.target)) e.preventDefault();
    });
  });

  /* ---------- Chat ---------- */

  function addMessage(text, who) {
    var el = document.createElement("div");
    el.className = "msg " + who;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function addTyping() {
    var el = document.createElement("div");
    el.className = "msg bot typing";
    el.setAttribute("aria-label", "Assistant is typing");
    el.innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  // Assistant reply with the answer, citations and reasoning beneath it.
  function addAnswer(data, container) {
    container = container || messages;
    var el = document.createElement("div");
    el.className = "msg bot answer";

    var main = document.createElement("div");
    main.className = "answer-text";
    main.textContent = data.response;
    el.appendChild(main);

    if (data.citation.length) {
      var label = document.createElement("div");
      label.className = "answer-label";
      label.textContent = data.citation.length === 1 ? "Citation" : "Citations";
      el.appendChild(label);

      data.citation.forEach(function (c) {
        var q = document.createElement("blockquote");
        q.className = "citation";
        q.textContent = c;
        el.appendChild(q);
      });
    }

    if (data.reasoning) {
      var rl = document.createElement("div");
      rl.className = "answer-label";
      rl.textContent = "Reasoning";
      el.appendChild(rl);

      var r = document.createElement("div");
      r.className = "reasoning";
      r.textContent = data.reasoning;
      el.appendChild(r);
    }

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // One saved question/answer pair, rendered exactly like a live chat turn.
  function renderPair(container, row) {
    var u = document.createElement("div");
    u.className = "msg user";
    u.textContent = row.question;
    container.appendChild(u);
    addAnswer({
      response: row.response,
      citation: Array.isArray(row.citation) ? row.citation : [],
      reasoning: row.reasoning || ""
    }, container);
  }

  // Fetch a contract's saved rows, oldest first (latest 200 kept).
  function fetchConversation(name) {
    return window.AppSupabase.select("chat_messages", {
      select: "question,response,citation,reasoning,created_at",
      contract_name: "eq." + name,
      order: "created_at.desc",
      limit: 200
    }).then(function (rows) { return rows.reverse(); });
  }

  // On opening a contract, show earlier conversation about the same contract name.
  // Silent on failure: the chat works without it.
  function loadPrior(token, name) {
    if (!window.AppSupabase) return;
    fetchConversation(name).then(function (rows) {
      if (token !== ingestToken || !rows.length) return;
      var note = document.createElement("div");
      note.className = "history-divider";
      note.textContent = "Previous conversation";
      messages.appendChild(note);
      rows.forEach(function (r) { renderPair(messages, r); });
      var end = document.createElement("div");
      end.className = "history-divider";
      end.textContent = "New questions";
      messages.appendChild(end);
      messages.scrollTop = messages.scrollHeight;
    }).catch(function (err) {
      console.warn("[chat_messages] history not loaded:", err && err.message);
    });
  }

  window.AppChat = { renderPair: renderPair, fetchConversation: fetchConversation };

  // Accept the documented shape; tolerate n8n wrapping it in an array.
  function normalize(payload) {
    if (Array.isArray(payload)) payload = payload[0];
    if (payload && typeof payload === "object" && typeof payload.response === "string") {
      return {
        response: payload.response,
        citation: Array.isArray(payload.citation)
          ? payload.citation.filter(function (c) { return typeof c === "string" && c; })
          : [],
        reasoning: typeof payload.reasoning === "string" ? payload.reasoning : ""
      };
    }
    throw new Error("Unexpected response format from the webhook.");
  }

  function askWebhook(message) {
    var body = new FormData();
    body.append("message", message);

    return fetch(CHAT_URL, { method: "POST", body: body }).then(function (res) {
      if (!res.ok) throw new Error("The server returned " + res.status + ".");
      return res.json();
    }).then(normalize);
  }

  // Save a finished question/answer to Supabase. Fire-and-forget: it never delays
  // or breaks the chat, and a failure is only logged (the user sees nothing).
  function saveChat(question, data, contract) {
    try {
      if (!window.AppSupabase) return;
      window.AppSupabase.insert("chat_messages", {
        contract_name: contract,
        question: question,
        response: data.response,
        citation: data.citation.length ? data.citation : null,
        reasoning: data.reasoning ? data.reasoning : null
      }).catch(function (err) {
        console.warn("[chat_messages] not saved:", err && err.message);
      });
    } catch (err) {
      console.warn("[chat_messages] not saved:", err && err.message);
    }
  }

  function updateSendState() {
    sendBtn.disabled = busy || !ready || !input.value.trim();
  }

  input.addEventListener("input", updateSendState);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy || !ready) return;

    addMessage(text, "user");
    input.value = "";
    busy = true;
    updateSendState();
    var typing = addTyping();
    var asked = currentContract;

    askWebhook(text)
      .then(function (data) {
        addAnswer(data);          // show the reply first
        saveChat(text, data, asked);  // then save it, in the background
      })
      .catch(function (err) {
        addMessage("Sorry, I couldn’t get an answer. " + (err.message || "") +
          " Please try again.", "bot error");
      })
      .then(function () {
        typing.remove();
        busy = false;
        updateSendState();
        input.focus();
      });
  });
})();
