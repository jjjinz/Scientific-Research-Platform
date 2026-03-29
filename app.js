const DB_NAME = "research-studio-db";
const DB_VERSION = 1;
const STORE_NAMES = ["ideas", "simulations", "experiments", "documents"];

const state = {
  ideas: [],
  simulations: [],
  experiments: [],
  documents: [],
};

const sectionConfig = {
  ideas: {
    table: "ideas",
    formId: "ideaForm",
    listId: "ideaList",
    showcaseId: "ideaShowcaseList",
    countId: "ideaCount",
    typeLabel: "Idea",
    emptyTitle: "还没有保存任何想法",
    emptyText: "先写下一条科研问题或研究假设，这里就会成为你的想法首页。",
    supportsSummary: false,
    supportsOcr: false,
    fillForm(form, record) {
      form.title.value = record.title || "";
      form.stage.value = record.stage || "灵感";
      form.content.value = record.content || "";
      form.tags.value = record.tags || "";
    },
    async readForm(form, existingRecord, backend) {
      return {
        id: form.id.value || generateId(),
        title: form.title.value.trim(),
        stage: form.stage.value,
        content: form.content.value.trim(),
        tags: form.tags.value.trim(),
        files: existingRecord?.files || [],
        ai_summary: existingRecord?.ai_summary || "",
        ai_ocr: existingRecord?.ai_ocr || "",
        created_at: existingRecord?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        backend: backend.mode,
      };
    },
    getSummary: (record) => record.content || "暂无详细内容。",
    getMeta: (record) => record.stage || "未标记阶段",
    getTags: (record) => splitTags(record.tags),
  },
  simulations: {
    table: "simulations",
    formId: "simulationForm",
    listId: "simulationList",
    countId: "simulationCount",
    typeLabel: "Simulation",
    emptyTitle: "还没有仿真结果",
    emptyText: "保存一条仿真记录后，这里会自动罗列所有结果。",
    supportsSummary: true,
    supportsOcr: true,
    fillForm(form, record) {
      form.title.value = record.title || "";
      form.date.value = record.date || "";
      form.metric.value = record.metric || "";
      form.summary.value = record.summary || "";
    },
    async readForm(form, existingRecord, backend) {
      return {
        id: form.id.value || generateId(),
        title: form.title.value.trim(),
        date: form.date.value,
        metric: form.metric.value.trim(),
        summary: form.summary.value.trim(),
        files: await backend.uploadFiles("simulations", form.elements.namedItem("files"), existingRecord?.files),
        ai_summary: existingRecord?.ai_summary || "",
        ai_ocr: existingRecord?.ai_ocr || "",
        created_at: existingRecord?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        backend: backend.mode,
      };
    },
    getSummary: (record) => record.summary || "暂无结果说明。",
    getMeta: (record) => buildMeta(record.date, record.metric),
    getTags: (record) => (record.metric ? [record.metric] : []),
  },
  experiments: {
    table: "experiments",
    formId: "experimentForm",
    listId: "experimentList",
    countId: "experimentCount",
    typeLabel: "Experiment",
    emptyTitle: "还没有实验结果",
    emptyText: "保存一条实验记录后，这里会自动罗列所有结果。",
    supportsSummary: true,
    supportsOcr: true,
    fillForm(form, record) {
      form.title.value = record.title || "";
      form.date.value = record.date || "";
      form.metric.value = record.metric || "";
      form.summary.value = record.summary || "";
    },
    async readForm(form, existingRecord, backend) {
      return {
        id: form.id.value || generateId(),
        title: form.title.value.trim(),
        date: form.date.value,
        metric: form.metric.value.trim(),
        summary: form.summary.value.trim(),
        files: await backend.uploadFiles("experiments", form.elements.namedItem("files"), existingRecord?.files),
        ai_summary: existingRecord?.ai_summary || "",
        ai_ocr: existingRecord?.ai_ocr || "",
        created_at: existingRecord?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        backend: backend.mode,
      };
    },
    getSummary: (record) => record.summary || "暂无结果说明。",
    getMeta: (record) => buildMeta(record.date, record.metric),
    getTags: (record) => (record.metric ? [record.metric] : []),
  },
  documents: {
    table: "documents",
    formId: "documentForm",
    listId: "documentList",
    countId: "docCount",
    typeLabel: "Document",
    emptyTitle: "还没有文献记录",
    emptyText: "上传第一篇文献后，这里会形成你的文献库。",
    supportsSummary: true,
    supportsOcr: true,
    fillForm(form, record) {
      form.title.value = record.title || "";
      form.authors.value = record.authors || "";
      form.notes.value = record.notes || "";
    },
    async readForm(form, existingRecord, backend) {
      return {
        id: form.id.value || generateId(),
        title: form.title.value.trim(),
        authors: form.authors.value.trim(),
        notes: form.notes.value.trim(),
        files: await backend.uploadFiles("documents", form.elements.namedItem("files"), existingRecord?.files),
        ai_summary: existingRecord?.ai_summary || "",
        ai_ocr: existingRecord?.ai_ocr || "",
        created_at: existingRecord?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        backend: backend.mode,
      };
    },
    getSummary: (record) => record.notes || "暂无阅读笔记。",
    getMeta: (record) => record.authors || "未填写来源",
    getTags: () => [],
  },
};

let backend;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    backend = await createBackend();
    bindAuthEvents();
    await backend.ensureReady();
    await loadAllRecords();
    setupForms();
    renderAll();
    syncModeLabel();
    syncAuthUi();
    setStatus(backend.statusMessage());
  } catch (error) {
    console.error(error);
    setStatus("初始化失败，请刷新页面后重试。");
  }
});

async function createBackend() {
  const config = window.RESEARCH_CONFIG || {};
  const cloudbaseConfig = config.cloudbase || {};
  if (cloudbaseConfig.enabled && window.cloudbase) {
    return createCloudBaseBackend(cloudbaseConfig);
  }
  return createLocalBackend();
}

function createLocalBackend() {
  let db;

  return {
    mode: "local",
    isAuthenticated: true,
    async ensureReady() {
      if (!db) {
        db = await openLocalDatabase();
      }
    },
    async login() {
      throw new Error("当前未配置 CloudBase，仍运行在本地模式。");
    },
    async logout() {},
    async list(table) {
      await this.ensureReady();
      return getLocalRecords(db, table);
    },
    async save(table, record) {
      await this.ensureReady();
      await saveLocalRecord(db, table, record);
      return record;
    },
    async remove(table, id) {
      await this.ensureReady();
      await deleteLocalRecord(db, table, id);
    },
    async uploadFiles(_, fileInput, existingFiles) {
      return collectLocalFiles(fileInput, existingFiles);
    },
    async summarize() {
      throw new Error("当前是本地模式，AI 总结需要先接入 CloudBase 云端。");
    },
    async ocrImages() {
      throw new Error("当前是本地模式，图片 OCR 需要先接入 CloudBase 云端。");
    },
    fileUrl(file) {
      return file?.tempUrl || file?.objectUrl || "";
    },
    statusMessage() {
      return "当前为本地模式，数据保存在浏览器 IndexedDB。";
    },
  };
}

function createCloudBaseBackend(config) {
  const app = window.cloudbase.init({
    env: config.envId,
    region: config.region || "ap-shanghai",
  });
  const auth = app.auth();
  const database = app.database();
  const storageBucket = config.storageBucket || "";
  const authUrl = config.authFunctionUrl || "";
  const aiFunctionName = config.aiFunctionName || "ai-assistant";

  return {
    mode: "cloud",
    isAuthenticated: false,
    async ensureReady() {
      this.isAuthenticated = Boolean(auth.hasLoginState && auth.hasLoginState());
    },
    async login(password) {
      if (!authUrl) {
        throw new Error("缺少 CloudBase 登录函数地址，请先配置 config.js。");
      }
      const response = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ticket) {
        throw new Error(payload.message || "登录失败，请检查管理员密码。");
      }
      if (typeof auth.setCustomSignFunc === "function" && typeof auth.signInWithCustomTicket === "function") {
        await auth.setCustomSignFunc(() => Promise.resolve(payload.ticket));
        await auth.signInWithCustomTicket();
      } else if (typeof auth.customAuthProvider === "function") {
        await auth.customAuthProvider().signIn(payload.ticket);
      } else {
        throw new Error("当前 CloudBase Web SDK 不支持自定义 Ticket 登录，请检查前端 SDK 版本。");
      }
      this.isAuthenticated = true;
      return true;
    },
    async logout() {
      if (auth.signOut) {
        await auth.signOut();
      }
      this.isAuthenticated = false;
    },
    async list(table) {
      if (!this.isAuthenticated) {
        return [];
      }
      const result = await database.collection(table).orderBy("updated_at", "desc").get();
      return attachNormalizedCloudFiles(app, result.data || []);
    },
    async save(table, record) {
      if (!this.isAuthenticated) {
        throw new Error("请先登录云端。");
      }
      const payload = { ...record, _id: record.id };
      await database.collection(table).doc(record.id).set(payload);
      const saved = await database.collection(table).doc(record.id).get();
      const enriched = await attachNormalizedCloudFiles(app, saved.data ? [saved.data] : []);
      return enriched[0] || normalizeCloudRecord(payload);
    },
    async remove(table, id) {
      if (!this.isAuthenticated) {
        throw new Error("请先登录云端。");
      }
      const existing = findRecord(table, id);
      const files = existing?.files || [];
      const fileIds = files.map((file) => file.fileID).filter(Boolean);
      if (fileIds.length > 0) {
        await app.deleteFile({ fileList: fileIds });
      }
      await database.collection(table).doc(id).remove();
    },
    async uploadFiles(table, fileInput, existingFiles) {
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return existingFiles || [];
      }
      if (!storageBucket) {
        throw new Error("缺少 CloudBase 存储路径前缀，请先配置 storageBucket。");
      }
      const uploaded = [];
      for (const file of Array.from(fileInput.files)) {
        const cloudPath = `${storageBucket}/${table}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const result = await app.uploadFile({ cloudPath, filePath: file });
        uploaded.push({
          name: file.name,
          size: file.size,
          type: file.type,
          cloudPath,
          fileID: result.fileID,
        });
      }
      return uploaded;
    },
    async summarize(record, store) {
      if (!this.isAuthenticated) {
        throw new Error("请先登录云端。");
      }
      const result = await app.callFunction({
        name: aiFunctionName,
        data: {
          action: "summarize_record",
          store,
          record: stripTransientFileFields(record),
        },
      });
      return result?.result?.summary || "";
    },
    async ocrImages(record, store) {
      if (!this.isAuthenticated) {
        throw new Error("请先登录云端。");
      }
      const result = await app.callFunction({
        name: aiFunctionName,
        data: {
          action: "ocr_images",
          store,
          record: stripTransientFileFields(record),
        },
      });
      return result?.result?.ocrText || "";
    },
    fileUrl(file) {
      return file?.tempUrl || "";
    },
    statusMessage() {
      return this.isAuthenticated
        ? "当前为 CloudBase 云端模式，数据可跨设备同步。"
        : "CloudBase 已配置，请登录以访问私有云端数据。";
    },
  };
}

function bindAuthEvents() {
  const loginForm = document.getElementById("loginForm");
  const logoutButton = document.getElementById("logoutButton");

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!backend || backend.mode !== "cloud") {
      setStatus("当前还没有启用 CloudBase，仍运行在本地模式。");
      return;
    }
    const password = loginForm.password.value.trim();
    if (!password) {
      setStatus("请输入管理员密码。");
      return;
    }
    try {
      setStatus("正在登录云端...");
      await backend.login(password);
      await loadAllRecords();
      renderAll();
      syncModeLabel();
      syncAuthUi();
      setStatus("云端登录成功，已切换到个人私有模式。");
      loginForm.reset();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "登录失败，请检查配置。");
    }
  });

  logoutButton.addEventListener("click", async () => {
    if (!backend || backend.mode !== "cloud") {
      return;
    }
    await backend.logout();
    STORE_NAMES.forEach((store) => {
      state[store] = [];
    });
    renderAll();
    syncModeLabel();
    syncAuthUi();
    setStatus("已退出云端登录。");
  });
}

async function loadAllRecords() {
  await Promise.all(
    STORE_NAMES.map(async (store) => {
      state[store] = await backend.list(store);
      state[store].sort(sortByUpdatedAt);
    })
  );
}

function setupForms() {
  STORE_NAMES.forEach((store) => {
    const config = sectionConfig[store];
    const form = document.getElementById(config.formId);
    const list = document.getElementById(config.listId);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (backend.mode === "cloud" && !backend.isAuthenticated) {
        setStatus("请先登录云端，再保存数据。");
        return;
      }
      try {
        const existing = findRecord(store, form.id.value);
        const record = await config.readForm(form, existing, backend);
        const saved = await backend.save(store, record);
        upsertState(store, saved);
        resetForm(form);
        renderAll();
        setStatus(`已保存：${saved.title}`);
      } catch (error) {
        console.error(error);
        setStatus(error.message || "保存失败，请检查网络或云端配置。");
      }
    });

    form.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      resetForm(form);
      setStatus("已清空当前表单。");
    });

    list.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const card = event.target.closest("[data-id]");
      if (!card) return;

      const id = card.dataset.id;
      const action = button.dataset.action;
      const record = findRecord(store, id);
      if (!record) return;

      if (action === "edit") {
        form.id.value = record.id;
        config.fillForm(form, record);
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        setStatus(`正在编辑：${record.title}`);
        return;
      }

      if (action === "delete") {
        try {
          await backend.remove(store, id);
          state[store] = state[store].filter((item) => item.id !== id);
          renderAll();
          setStatus(`已删除：${record.title}`);
        } catch (error) {
          console.error(error);
          setStatus(error.message || "删除失败，请稍后重试。");
        }
        return;
      }

      if (action === "summarize") {
        try {
          setStatus(`正在总结：${record.title}`);
          const summary = await backend.summarize(record, store);
          const nextRecord = { ...record, ai_summary: summary, updated_at: new Date().toISOString() };
          const saved = await backend.save(store, nextRecord);
          upsertState(store, saved);
          renderAll();
          setStatus(`已生成 AI 总结：${saved.title}`);
        } catch (error) {
          console.error(error);
          setStatus(error.message || "AI 总结失败。");
        }
        return;
      }

      if (action === "ocr") {
        try {
          setStatus(`正在识别图片：${record.title}`);
          const ocrText = await backend.ocrImages(record, store);
          const nextRecord = { ...record, ai_ocr: ocrText, updated_at: new Date().toISOString() };
          const saved = await backend.save(store, nextRecord);
          upsertState(store, saved);
          renderAll();
          setStatus(`已完成图片 OCR：${saved.title}`);
        } catch (error) {
          console.error(error);
          setStatus(error.message || "图片 OCR 失败。");
        }
      }
    });
  });
}

function renderAll() {
  STORE_NAMES.forEach(renderSection);
  renderIdeaShowcase();
}

function renderSection(store) {
  const config = sectionConfig[store];
  const list = document.getElementById(config.listId);
  const count = document.getElementById(config.countId);
  const records = [...state[store]].sort(sortByUpdatedAt);

  count.textContent = String(records.length);
  list.innerHTML = "";

  if (records.length === 0) {
    list.appendChild(createEmptyState(config.emptyTitle, config.emptyText));
    return;
  }

  records.forEach((record) => list.appendChild(createRecordCard(record, config, store)));
}

function renderIdeaShowcase() {
  const showcase = document.getElementById("ideaShowcaseList");
  const ideas = [...state.ideas].sort(sortByUpdatedAt);
  showcase.innerHTML = "";
  if (ideas.length === 0) {
    showcase.appendChild(createEmptyState("想法总览还没有内容", "保存第一条想法后，这里会自动展示。"));
    return;
  }
  ideas.forEach((record) => showcase.appendChild(createRecordCard(record, sectionConfig.ideas, "ideas")));
}

function createRecordCard(record, config, store) {
  const template = document.getElementById("recordTemplate");
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".record-card");
  card.dataset.id = record.id;

  fragment.querySelector(".record-type").textContent = config.typeLabel;
  fragment.querySelector(".record-title").textContent = record.title;
  fragment.querySelector(".record-meta").textContent = config.getMeta(record) || formatDate(record.updated_at);
  fragment.querySelector(".record-summary").textContent = config.getSummary(record);

  const tags = config.getTags(record);
  const tagContainer = fragment.querySelector(".record-tags");
  if (tags.length === 0) {
    tagContainer.remove();
  } else {
    tags.forEach((tag) => {
      const item = document.createElement("span");
      item.textContent = tag;
      tagContainer.appendChild(item);
    });
  }

  const fileList = fragment.querySelector(".file-list");
  if (!record.files || record.files.length === 0) {
    fileList.remove();
  } else {
    record.files.forEach((file) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = backend.fileUrl(file);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.download = file.name;
      link.textContent = `${file.name} (${formatFileSize(file.size || 0)})`;
      item.appendChild(link);
      fileList.appendChild(item);
    });
  }

  const summaryBlock = fragment.querySelector(".ai-summary-block");
  if (record.ai_summary) {
    summaryBlock.hidden = false;
    fragment.querySelector(".ai-summary-text").textContent = record.ai_summary;
  }

  const ocrBlock = fragment.querySelector(".ai-ocr-block");
  if (record.ai_ocr) {
    ocrBlock.hidden = false;
    fragment.querySelector(".ai-ocr-text").textContent = record.ai_ocr;
  }

  const summarizeButton = fragment.querySelector('[data-action="summarize"]');
  summarizeButton.hidden = !config.supportsSummary;

  const ocrButton = fragment.querySelector('[data-action="ocr"]');
  ocrButton.hidden = !config.supportsOcr || !hasImageFile(record.files);

  if (store === "ideas") {
    ocrButton.remove();
    summarizeButton.remove();
  }

  return fragment;
}

function syncAuthUi() {
  const loginForm = document.getElementById("loginForm");
  const logoutButton = document.getElementById("logoutButton");
  const authCard = document.getElementById("authCard");

  if (!backend || backend.mode !== "cloud") {
    authCard.classList.add("disabled-card");
    logoutButton.hidden = true;
    return;
  }

  authCard.classList.remove("disabled-card");
  logoutButton.hidden = !backend.isAuthenticated;
  loginForm.password.disabled = backend.isAuthenticated;
  loginForm.querySelector('button[type="submit"]').disabled = backend.isAuthenticated;
}

function syncModeLabel() {
  const label = document.getElementById("storageModeLabel");
  if (!label) return;
  if (backend.mode === "cloud") {
    label.textContent = backend.isAuthenticated ? "CloudBase 云端同步已启用" : "CloudBase 已配置，等待登录";
    return;
  }
  label.textContent = "当前为本地模式";
}

function upsertState(store, record) {
  const index = state[store].findIndex((item) => item.id === record.id);
  if (index >= 0) {
    state[store][index] = record;
  } else {
    state[store].push(record);
  }
  state[store].sort(sortByUpdatedAt);
}

function findRecord(store, id) {
  return state[store].find((record) => record.id === id);
}

function createEmptyState(title, text) {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";
  wrapper.innerHTML = `<div><h4>${title}</h4><p>${text}</p></div>`;
  return wrapper;
}

function resetForm(form) {
  form.reset();
  form.id.value = "";
}

function splitTags(value) {
  return (value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildMeta(date, metric) {
  if (date && metric) return `${formatDate(date)} · ${metric}`;
  if (date) return formatDate(date);
  if (metric) return metric;
  return "待补充";
}

function hasImageFile(files = []) {
  return files.some((file) => (file.type || "").startsWith("image/") || /\.(png|jpg|jpeg|webp|bmp)$/i.test(file.name || ""));
}

function normalizeCloudRecord(record) {
  return {
    ...record,
    id: record.id || record._id,
    files: record.files || [],
  };
}

async function attachNormalizedCloudFiles(app, records) {
  const normalized = records.map(normalizeCloudRecord);
  const fileIds = normalized.flatMap((record) => record.files.map((file) => file.fileID).filter(Boolean));
  const fileMap = new Map();

  if (fileIds.length > 0) {
    const temp = await app.getTempFileURL({ fileList: fileIds });
    (temp.fileList || []).forEach((item) => {
      fileMap.set(item.fileID, item.tempFileURL);
    });
  }

  return normalized.map((record) => ({
    ...record,
    files: (record.files || []).map((file) => ({
      ...file,
      tempUrl: file.fileID ? fileMap.get(file.fileID) || "" : file.tempUrl || "",
    })),
  }));
}

function stripTransientFileFields(record) {
  return {
    ...record,
    files: (record.files || []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      cloudPath: file.cloudPath || "",
      fileID: file.fileID || "",
    })),
  };
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeFileName(name) {
  return name.replace(/[^\w.\-]+/g, "-");
}

function formatDate(value) {
  if (!value) return "未标记日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sortByUpdatedAt(a, b) {
  return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message) {
  const status = document.getElementById("saveStatus");
  if (status) {
    status.textContent = message;
  }
}

function openLocalDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      STORE_NAMES.forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getLocalRecords(db, store) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readonly");
    const request = transaction.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function saveLocalRecord(db, store, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    const request = transaction.objectStore(store).put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

function deleteLocalRecord(db, store, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    const request = transaction.objectStore(store).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function collectLocalFiles(fileInput, existingFiles = []) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    return existingFiles || [];
  }
  return Array.from(fileInput.files).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    objectUrl: URL.createObjectURL(file),
  }));
}
