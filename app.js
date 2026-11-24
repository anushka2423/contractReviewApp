(function () {
  var WEBHOOK_URL = "https://anushka0501.app.n8n.cloud/webhook-test/784bc58c-6f3a-4628-b2eb-9bbbb6913722";

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
  var busy = false;

  /* ---------- Contract upload & preview ---------- */

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
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

    frame.src = currentUrl;
    frame.hidden = false;
    dropzone.hidden = true;

    topbarFile.textContent = file.name;
    topbarFile.hidden = false;
    fileMeta.textContent = file.name + " · " + formatSize(file.size);
    fileMeta.hidden = false;
    clearBtn.hidden = false;
    uploadBtn.textContent = "Replace contract";

    addMessage("Loaded “" + file.name + "”. What would you like to know?", "bot");
  }

  function clearFile() {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
    currentFile = null;
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
  clearBtn.addEventListener("click", clearFile);

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
  function addAnswer(data) {
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

    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

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

  function askWebhook(message, file) {
    var body = new FormData();
    body.append("file", file, file.name);
    body.append("message", message);

    return fetch(WEBHOOK_URL, { method: "POST", body: body }).then(function (res) {
      if (!res.ok) throw new Error("The server returned " + res.status + ".");
      return res.json();
    }).then(normalize);
  }

  function updateSendState() {
    sendBtn.disabled = busy || !input.value.trim();
  }

  input.addEventListener("input", updateSendState);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;

    if (!currentFile) {
      addMessage("Please upload a PDF contract first, then ask your question.", "bot");
      return;
    }

    addMessage(text, "user");
    input.value = "";
    busy = true;
    updateSendState();
    var typing = addTyping();

    askWebhook(text, currentFile)
      .then(addAnswer)
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
