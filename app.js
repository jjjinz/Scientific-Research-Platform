const DB_NAME = "research-studio-db";
const DB_VERSION = 1;
const STORE_NAMES = ["documents", "ideas", "simulations", "experiments"];

const state = {
  documents: [],
  ideas: [],
  simulations: [],
  experiments: [],
};

const config = {
  documents: {
    store: "documents",
    formId: "documentForm",
    listId: "documentList",
    countId: "docCount",
    typeLabel: "Document",
    emptyTitle: "还没有文献记录",
    emptyText: "上传第一篇文献，建立你的阅读资料库。",
    getSummary: (record) => record.notes || "暂无摘要或阅读笔记。",
    getMeta: (record) => record.authors || "未填写来源",
    getTags: () => [],
    fillForm: (form, record) => {
      form.title.value = record.title || "";
      form.authors.value = record.authors || "";
      form.notes.value = record.notes || "";
    },
    readForm: async (form, existingRecord) => ({
      id: form.id.value || generateId(),
      title: form.title.value.trim(),
      authors: form.authors.value.trim(),
      notes: form.notes.value.trim(),
      files: await collectFiles(form.elements.namedItem("files"), existingRecord?.files),
      updatedAt: new Date().toISOString(),
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
    }),
  },
  ideas: {
    store: "ideas",
    formId: "ideaForm",
    listId: "ideaList",
    countId: "ideaCount",
    typeLabel: "Idea",
    emptyTitle: "还没有想法记录",
    emptyText: "把零散灵感写下来，后面就能持续迭代。",
    getSummary: (record) => record.content || "暂无详细内容。",
    getMeta: (record) => record.stage || "未标记阶段",
    getTags: (record) =>
      (record.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    fillForm: (form, record) => {
      form.title.value = record.title || "";
      form.stage.value = record.stage || "灵感";
      form.content.value = record.content || "";
      form.tags.value = record.tags || "";
    },
    readForm: async (form, existingRecord) => ({
      id: form.id.value || generateId(),
      title: form.title.value.trim(),
      stage: form.stage.value,
      content: form.content.value.trim(),
      tags: form.tags.value.trim(),
      files: existingRecord?.files || [],
      updatedAt: new Date().toISOString(),
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
    }),
  },
  simulations: {
    store: "simulations",
    formId: "simulationForm",
    listId: "simulationList",
    countId: "simulationCount",
    typeLabel: "Simulation",
    emptyTitle: "还没有仿真结果",
    emptyText: "保存图表、日志和结论，后续对比会轻松很多。",
    getSummary: (record) => record.summary || "暂无结果说明。",
    getMeta: (record) => buildMeta(record.date, record.metric),
    getTags: (record) => (record.metric ? [record.metric] : []),
    fillForm: (form, record) => {
      form.title.value = record.title || "";
      form.date.value = record.date || "";
      form.metric.value = record.metric || "";
      form.summary.value = record.summary || "";
    },
    readForm: async (form, existingRecord) => ({
      id: form.id.value || generateId(),
      title: form.title.value.trim(),
      date: form.date.value,
      metric: form.metric.value.trim(),
      summary: form.summary.value.trim(),
      files: await collectFiles(form.elements.namedItem("files"), existingRecord?.files),
      updatedAt: new Date().toISOString(),
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
    }),
  },
  experiments: {
    store: "experiments",
    formId: "experimentForm",
    listId: "experimentList",
    countId: "experimentCount",
    typeLabel: "Experiment",
    emptyTitle: "还没有实验结果",
    emptyText: "记录每次实验设置和结论，方便复盘和汇总。",
    getSummary: (record) => record.summary || "暂无结果说明。",
    getMeta: (record) => buildMeta(record.date, record.metric),
    getTags: (record) => (record.metric ? [record.metric] : []),
    fillForm: (form, record) => {
      form.title.value = record.title || "";
      form.date.value = record.date || "";
      form.metric.value = record.metric || "";
      form.summary.value = record.summary || "";
    },
    readForm: async (form, existingRecord) => ({
      id: form.id.value || generateId(),
      title: form.title.value.trim(),
      date: form.date.value,
      metric: form.metric.value.trim(),
      summary: form.summary.value.trim(),
      files: await collectFiles(form.elements.namedItem("files"), existingRecord?.files),
      updatedAt: new Date().toISOString(),
      createdAt: existingRecord?.createdAt || new Date().toISOString(),
    }),
  },
};

let db;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    db = await openDatabase();
    await loadAllStores();
    setupForms();
    renderAll();
    setStatus("数据已加载，编辑后会自动保存到当前浏览器。");
  } catch (error) {
    console.error(error);
    setStatus("初始化失败，请尝试刷新页面。");
  }
});

function openDatabase() {
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

async function loadAllStores() {
  await Promise.all(
    STORE_NAMES.map(async (storeName) => {
      state[storeName] = await getAllRecords(storeName);
      state[storeName].sort(sortByUpdatedAt);
    })
  );
}

function getAllRecords(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function saveRecord(storeName, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function setupForms() {
  Object.values(config).forEach((sectionConfig) => {
    const form = document.getElementById(sectionConfig.formId);
    const list = document.getElementById(sectionConfig.listId);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const existingRecord = findRecord(sectionConfig.store, form.id.value);
      const record = await sectionConfig.readForm(form, existingRecord);
      await saveRecord(sectionConfig.store, record);
      upsertState(sectionConfig.store, record);
      resetForm(form);
      renderSection(sectionConfig.store);
      setStatus(`已保存：${record.title}`);
    });

    form.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      resetForm(form);
      setStatus("已清空当前表单。");
    });

    list.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      const card = event.target.closest("[data-id]");
      if (!card) {
        return;
      }

      const id = card.dataset.id;
      const action = button.dataset.action;
      const record = findRecord(sectionConfig.store, id);
      if (!record) {
        return;
      }

      if (action === "edit") {
        form.id.value = record.id;
        sectionConfig.fillForm(form, record);
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        setStatus(`正在编辑：${record.title}`);
      }

      if (action === "delete") {
        await deleteRecord(sectionConfig.store, id);
        state[sectionConfig.store] = state[sectionConfig.store].filter((item) => item.id !== id);
        renderSection(sectionConfig.store);
        setStatus(`已删除：${record.title}`);
      }
    });
  });
}

function renderAll() {
  STORE_NAMES.forEach(renderSection);
}

function renderSection(storeName) {
  const sectionConfig = config[storeName];
  const list = document.getElementById(sectionConfig.listId);
  const count = document.getElementById(sectionConfig.countId);
  const records = [...state[storeName]].sort(sortByUpdatedAt);

  count.textContent = String(records.length);
  list.innerHTML = "";

  if (records.length === 0) {
    list.appendChild(createEmptyState(sectionConfig.emptyTitle, sectionConfig.emptyText));
    return;
  }

  records.forEach((record) => {
    list.appendChild(createRecordCard(record, sectionConfig));
  });
}

function createEmptyState(title, text) {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";
  wrapper.innerHTML = `<div><h4>${title}</h4><p>${text}</p></div>`;
  return wrapper;
}

function createRecordCard(record, sectionConfig) {
  const template = document.getElementById("recordTemplate");
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".record-card");
  card.dataset.id = record.id;
  fragment.querySelector(".record-type").textContent = sectionConfig.typeLabel;
  fragment.querySelector(".record-title").textContent = record.title;
  fragment.querySelector(".record-meta").textContent = sectionConfig.getMeta(record) || formatDate(record.updatedAt);
  fragment.querySelector(".record-summary").textContent = sectionConfig.getSummary(record);

  const tagContainer = fragment.querySelector(".record-tags");
  const tags = sectionConfig.getTags(record);
  if (tags.length === 0) {
    tagContainer.remove();
  } else {
    tags.forEach((tag) => {
      const pill = document.createElement("span");
      pill.textContent = tag;
      tagContainer.appendChild(pill);
    });
  }

  const fileList = fragment.querySelector(".file-list");
  if (!record.files || record.files.length === 0) {
    fileList.remove();
  } else {
    record.files.forEach((file) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(file);
      link.href = objectUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.download = file.name;
      link.textContent = `${file.name} (${formatFileSize(file.size || 0)})`;
      item.appendChild(link);
      fileList.appendChild(item);
    });
  }

  return fragment;
}

function resetForm(form) {
  form.reset();
  form.id.value = "";
}

function upsertState(storeName, record) {
  const index = state[storeName].findIndex((item) => item.id === record.id);
  if (index >= 0) {
    state[storeName][index] = record;
  } else {
    state[storeName].push(record);
  }
  state[storeName].sort(sortByUpdatedAt);
}

function findRecord(storeName, id) {
  return state[storeName].find((record) => record.id === id);
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function collectFiles(fileInput, existingFiles = []) {
  if (fileInput.files && fileInput.files.length > 0) {
    return Array.from(fileInput.files);
  }
  return existingFiles || [];
}

function sortByUpdatedAt(a, b) {
  return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
}

function formatDate(value) {
  if (!value) {
    return "未标记日期";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildMeta(date, metric) {
  if (date && metric) {
    return `${formatDate(date)} · ${metric}`;
  }
  if (date) {
    return formatDate(date);
  }
  if (metric) {
    return metric;
  }
  return "待补充";
}

function formatFileSize(size) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message) {
  const status = document.getElementById("saveStatus");
  if (status) {
    status.textContent = message;
  }
}
