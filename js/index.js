const STORAGE_KEYS = {
  theme: "LINGXI_THEME",
  apiKey: "LINGXI_API_KEY",
  model: "LINGXI_MODEL",
  temperature: "LINGXI_TEMPERATURE",
};

const suggestions = [
  { icon: "〰", color: "#2f8cff", text: "我是一名前端开发初学者，如何提升相关技能?" },
  { icon: "◉", color: "#44d16e", text: "有哪些平价又新颖的生日礼物适合送朋友。" },
  { icon: "◎", color: "#f7bf2f", text: "准备在家里办一个大型家庭聚会，帮我计划。" },
  { icon: "✦", color: "#835bff", text: "带小朋友去野餐，有什么好玩的活动建议吗?" },
];

const state = {
  messages: [],
  uploads: [],
  controller: null,
  streaming: false,
  codeScrollState: new Map(),
  copyLock: new Set(),
};

const el = {
  welcomeSection: document.getElementById("welcomeSection"),
  suggestions: document.getElementById("suggestions"),
  chatList: document.getElementById("chatList"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  stopBtn: document.getElementById("stopBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  quickClearBtn: document.getElementById("quickClearBtn"),
  settingsPanel: document.getElementById("settingsPanel"),
  modelSelect: document.getElementById("modelSelect"),
  tempRange: document.getElementById("tempRange"),
  tempValue: document.getElementById("tempValue"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  imageInput: document.getElementById("imageInput"),
  previewArea: document.getElementById("previewArea"),
  apiKeyBtn: document.getElementById("apiKeyBtn"),
  apiKeyBanner: document.getElementById("apiKeyBanner"),
  quickKeyBtn: document.getElementById("quickKeyBtn"),
};

init();

function init() {
  renderSuggestions();
  restoreSettings();
  bindEvents();
  applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || "dark");
  updateApiKeyBanner();
  updateInputUI();
}

function bindEvents() {
  el.messageInput.addEventListener("input", () => {
    autoGrow(el.messageInput);
    updateInputUI();
  });

  el.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  });

  el.sendBtn.addEventListener("click", submitMessage);
  el.stopBtn.addEventListener("click", stopStreaming);

  el.imageInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      state.uploads.push({ file, url });
    });
    renderUploadPreview();
    updateInputUI();
    el.imageInput.value = "";
  });

  el.settingsBtn.addEventListener("click", () => {
    el.settingsPanel.classList.toggle("hidden");
  });
  el.quickClearBtn.addEventListener("click", clearAll);
  el.clearBtn.addEventListener("click", clearAll);
  el.themeToggleBtn.addEventListener("click", toggleTheme);
  el.modelSelect.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEYS.model, el.modelSelect.value);
  });
  el.tempRange.addEventListener("input", () => {
    el.tempValue.textContent = el.tempRange.value;
    localStorage.setItem(STORAGE_KEYS.temperature, el.tempRange.value);
  });
  el.apiKeyBtn.addEventListener("click", promptApiKey);
  el.quickKeyBtn.addEventListener("click", promptApiKey);
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      !el.settingsPanel.contains(target) &&
      !el.settingsBtn.contains(target)
    ) {
      el.settingsPanel.classList.add("hidden");
    }
  });
}

function restoreSettings() {
  const model = localStorage.getItem(STORAGE_KEYS.model) || "qwen-plus";
  const temperature = localStorage.getItem(STORAGE_KEYS.temperature) || "0.7";
  el.modelSelect.value = model;
  el.tempRange.value = temperature;
  el.tempValue.textContent = temperature;
}

function renderSuggestions() {
  el.suggestions.innerHTML = "";
  suggestions.forEach((item) => {
    const card = document.createElement("button");
    card.className = "suggestion-card";
    card.innerHTML = `
      <span class="s-icon" style="background:${item.color}">${item.icon}</span>
      <div>${escapeHTML(item.text)}</div>
    `;
    card.addEventListener("click", () => submitMessage(item.text));
    el.suggestions.appendChild(card);
  });
}

function renderUploadPreview() {
  el.previewArea.innerHTML = "";
  state.uploads.forEach((upload, index) => {
    const box = document.createElement("div");
    box.className = "preview-card";
    box.innerHTML = `
      <img src="${upload.url}" alt="preview" />
      <button class="remove-preview" title="删除">×</button>
    `;
    box.querySelector("button").addEventListener("click", () => {
      URL.revokeObjectURL(upload.url);
      state.uploads.splice(index, 1);
      renderUploadPreview();
      updateInputUI();
    });
    el.previewArea.appendChild(box);
  });
}

function updateInputUI() {
  const hasText = el.messageInput.value.trim().length > 0;
  const hasUpload = state.uploads.length > 0;
  const shouldShow = hasText || hasUpload;
  el.sendBtn.classList.toggle("hidden", !shouldShow || state.streaming);
  el.sendBtn.disabled = !shouldShow;
}

function toggleTheme() {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  applyTheme(next);
  localStorage.setItem(STORAGE_KEYS.theme, next);
}

function applyTheme(mode) {
  document.body.classList.toggle("light", mode === "light");
}

function promptApiKey() {
  const current = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
  const value = window.prompt("请输入阿里云百炼 API Key：", current);
  if (value === null) return;
  const key = value.trim();
  if (!key) {
    localStorage.removeItem(STORAGE_KEYS.apiKey);
    alert("已清除 API Key。");
    updateApiKeyBanner();
    return;
  }
  localStorage.setItem(STORAGE_KEYS.apiKey, key);
  updateApiKeyBanner();
  alert("API Key 已保存在本地浏览器。");
}

function updateApiKeyBanner() {
  const hasKey = Boolean(localStorage.getItem(STORAGE_KEYS.apiKey));
  el.apiKeyBanner.classList.toggle("hidden", hasKey);
}

function clearAll() {
  stopStreaming();
  state.messages = [];
  state.uploads.forEach((item) => URL.revokeObjectURL(item.url));
  state.uploads = [];
  el.previewArea.innerHTML = "";
  el.chatList.innerHTML = "";
  el.welcomeSection.classList.remove("hidden");
  updateInputUI();
}

async function submitMessage(overrideText = "") {
  if (state.streaming) return;
  const apiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (!apiKey) {
    alert("请先点击“设置 API Key”并保存到本地（LINGXI_API_KEY）。");
    return;
  }

  const text = (overrideText || el.messageInput.value).trim();
  if (!text && state.uploads.length === 0) return;

  const uploadInfo = state.uploads.length
    ? `\n\n[用户上传了 ${state.uploads.length} 张图片，仅做前端预览]`
    : "";
  const userText = text + uploadInfo;

  pushMessage("user", userText);
  el.welcomeSection.classList.add("hidden");
  el.messageInput.value = "";
  autoGrow(el.messageInput);
  state.uploads.forEach((item) => URL.revokeObjectURL(item.url));
  state.uploads = [];
  renderUploadPreview();
  updateInputUI();

  const aiMsg = pushMessage("ai", "");
  aiMsg.content = "思考中...";
  renderMessages();
  state.streaming = true;
  updateInputUI();
  el.stopBtn.classList.remove("hidden");

  try {
    await streamChat(apiKey, aiMsg);
  } catch (error) {
    if (error.name !== "AbortError") {
      aiMsg.content = `请求失败：${error.message || "未知错误"}`;
    }
  } finally {
    state.streaming = false;
    state.controller = null;
    el.stopBtn.classList.add("hidden");
    updateInputUI();
    renderMessages();
  }
}

function stopStreaming() {
  if (state.controller) {
    state.controller.abort();
  }
}

function pushMessage(role, content) {
  const msg = { id: crypto.randomUUID(), role, content };
  state.messages.push(msg);
  renderMessages();
  return msg;
}

function renderMessages() {
  el.chatList.innerHTML = "";
  state.messages.forEach((msg) => {
    const row = document.createElement("div");
    row.className = `msg-row ${msg.role}`;
    if (msg.role === "ai") {
      row.innerHTML = `
        <div class="msg-avatar">AI</div>
        <div class="msg-bubble markdown">${renderMarkdown(msg.content, msg.id)}</div>
      `;
    } else {
      row.innerHTML = `<div class="msg-bubble">${escapeHTML(msg.content)}</div>`;
    }
    el.chatList.appendChild(row);
  });

  attachCodeScrollHandlers();
  attachCopyHandlers();
  el.chatList.scrollTop = el.chatList.scrollHeight;
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function streamChat(apiKey, aiMsg) {
  const model = localStorage.getItem(STORAGE_KEYS.model) || "qwen-plus";
  const temperature = Number(localStorage.getItem(STORAGE_KEYS.temperature) || "0.7");
  const history = state.messages
    .filter((item) => item.id !== aiMsg.id)
    .map((item) => ({ role: item.role, content: item.content }));

  state.controller = new AbortController();
  const response = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        stream: true,
        messages: history,
      }),
      signal: state.controller.signal,
    }
  );

  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const payload = trimmed.replace(/^data:\s*/, "");
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content || "";
        if (!delta) return;
        if (aiMsg.content === "思考中...") aiMsg.content = "";
        aiMsg.content += delta;
        renderMessages();
      } catch (error) {
        // ignore malformed stream chunk
      }
    });
  }
}

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function escapeHTML(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarkdown(raw = "", messageId = "") {
  const codeBlocks = [];
  let text = escapeHTML(raw);

  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = "", code = "") => {
    const index = codeBlocks.length;
    const codeId = `${messageId}-${index}`;
    const highlighted = simpleHighlight(code.trimEnd(), lang);
    codeBlocks.push(`
      <div class="code-wrap">
        <button class="copy-btn" data-code-id="${codeId}">一键复制</button>
        <pre class="code-scroll" data-code-id="${codeId}"><code data-raw="${encodeURIComponent(code)}" class="lang-${lang}">${highlighted}</code></pre>
      </div>
    `);
    return `@@CODE_${index}@@`;
  });

  text = text.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  text = text.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  text = text.replace(/^\- (.+)$/gm, "<li>$1</li>");
  text = text.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  text = text.replace(/`([^`]+?)`/g, "<code>$1</code>");

  text = text.replace(/((?:\|.*\|\n)+)/g, (tableBlock) => {
    const rows = tableBlock
      .trim()
      .split("\n")
      .filter((r) => !/^\|\s*[-:]+/.test(r.replaceAll(" ", "")));
    if (rows.length < 2) return tableBlock;
    const head = rows[0]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((cell) => `<th>${cell}</th>`)
      .join("");
    const body = rows
      .slice(1)
      .map((r) => {
        const tds = r
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((cell) => `<td>${cell}</td>`)
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  });

  text = text
    .split(/\n{2,}/)
    .map((block) => {
      if (/^<h\d|^<ul>|^<blockquote>|^<table>|^@@CODE_/.test(block)) return block;
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  codeBlocks.forEach((html, index) => {
    text = text.replace(`@@CODE_${index}@@`, html);
  });
  return text;
}

function simpleHighlight(code, lang = "") {
  let html = escapeHTML(code);
  const language = (lang || "").toLowerCase();
  const tokens = [];
  const hold = (value) => {
    const idx = tokens.length;
    tokens.push(value);
    return `@@TOK_${idx}@@`;
  };

  html = html.replace(
    /(\/\/.*$|#.*$)/gm,
    (m) => hold(`<span class="tok-com">${m}</span>`)
  );
  html = html.replace(
    /(".*?"|'.*?'|`.*?`)/g,
    (m) => hold(`<span class="tok-str">${m}</span>`)
  );

  const jsKeywords = /\b(function|const|let|var|return|if|else|for|while|class|import|from|export|switch|case|break|continue|try|catch|finally|new|throw|async|await)\b/g;
  const goKeywords = /\b(package|func|type|struct|interface|map|range|go|defer|select|chan|fallthrough|make)\b/g;
  const typeWords = /\b(string|number|boolean|any|void|int|int32|int64|float32|float64|rune|byte|error)\b/g;
  const literalWords = /\b(true|false|null|undefined|nil)\b/g;
  const numberWords = /\b\d+(\.\d+)?\b/g;
  const operatorWords = /(===|!==|==|!=|<=|>=|=>|\+\+|--|\+|-|\*|\/|%|&&|\|\||!|=)/g;

  html = html.replace(jsKeywords, (m) => hold(`<span class="tok-kw">${m}</span>`));
  if (language === "go" || code.includes("package ") || code.includes("func ")) {
    html = html.replace(goKeywords, (m) => hold(`<span class="tok-kw">${m}</span>`));
  }
  html = html.replace(typeWords, (m) => hold(`<span class="tok-type">${m}</span>`));
  html = html.replace(literalWords, (m) => hold(`<span class="tok-lit">${m}</span>`));
  html = html.replace(numberWords, (m) => hold(`<span class="tok-num">${m}</span>`));
  html = html.replace(
    /\b([A-Za-z_]\w*)(?=\s*\()/g,
    (m) => hold(`<span class="tok-fn">${m}</span>`)
  );
  html = html.replace(operatorWords, (m) => hold(`<span class="tok-op">${m}</span>`));

  tokens.forEach((token, idx) => {
    html = html.replaceAll(`@@TOK_${idx}@@`, token);
  });
  return html;
}

function attachCodeScrollHandlers() {
  el.chatList.querySelectorAll(".code-scroll").forEach((box) => {
    const codeId = box.dataset.codeId;
    if (!codeId) return;
    if (state.codeScrollState.has(codeId)) {
      box.scrollTop = state.codeScrollState.get(codeId);
    }
    box.onscroll = () => {
      state.codeScrollState.set(codeId, box.scrollTop);
    };
  });
}

function attachCopyHandlers() {
  el.chatList.querySelectorAll(".copy-btn").forEach((button) => {
    button.onclick = async () => {
      const codeId = button.dataset.codeId || "";
      if (state.copyLock.has(codeId)) return;
      const code = button.parentElement.querySelector("code");
      const raw = decodeURIComponent(code.getAttribute("data-raw") || "");
      state.copyLock.add(codeId);
      try {
        await navigator.clipboard.writeText(raw);
        button.textContent = "已复制";
        button.classList.add("copied");
      } catch (error) {
        alert("复制失败，请手动复制代码。");
      } finally {
        setTimeout(() => {
          button.textContent = "一键复制";
          button.classList.remove("copied");
          state.copyLock.delete(codeId);
        }, 2000);
      }
    };
  });
}
