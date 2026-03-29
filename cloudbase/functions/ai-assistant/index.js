const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });

exports.main = async (event, context) => {
  const { action, record, store } = event || {};
  const apiKey = process.env.DASHSCOPE_API_KEY || "";
  const summaryModel = process.env.QWEN_SUMMARY_MODEL || "qwen-plus";
  const ocrModel = process.env.QWEN_OCR_MODEL || "qwen-vl-ocr-latest";

  if (!apiKey) {
    throw new Error("缺少 DASHSCOPE_API_KEY 环境变量。");
  }

  if (action === "summarize_record") {
    const summary = await summarizeRecord(apiKey, summaryModel, store, record);
    return { summary };
  }

  if (action === "ocr_images") {
    const ocrText = await ocrImages(apiKey, ocrModel, record);
    return { ocrText };
  }

  throw new Error("不支持的 AI 动作。");
};

async function summarizeRecord(apiKey, model, store, record) {
  const prompt = [
    `你是一个科研记录整理助手。请根据以下 ${store} 记录生成一段简洁、结构化、忠实原文的中文总结。`,
    "要求：只总结用户已提供的信息，不要编造结论，不要添加虚构实验结果。",
    `标题：${record.title || ""}`,
    `日期：${record.date || ""}`,
    `指标：${record.metric || ""}`,
    `作者/来源：${record.authors || ""}`,
    `正文：${record.summary || record.notes || record.content || ""}`,
    record.ai_ocr ? `图片 OCR：${record.ai_ocr}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你是严谨的科研助理，负责压缩、归纳、整理科研记录。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error?.message || "通义总结接口调用失败。");
  }

  return payload.choices?.[0]?.message?.content || "";
}

async function ocrImages(apiKey, model, record) {
  const imageFiles = (record.files || []).filter((file) => isImage(file.name, file.type) && file.fileID);
  if (imageFiles.length === 0) {
    throw new Error("当前记录没有可识别的图片附件。");
  }

  const tempLinks = await app.getTempFileURL({
    fileList: imageFiles.map((file) => file.fileID),
  });

  const urlMap = new Map();
  (tempLinks.fileList || []).forEach((item) => {
    urlMap.set(item.fileID, item.tempFileURL);
  });

  const ocrResults = [];
  for (const file of imageFiles) {
    const imageUrl = urlMap.get(file.fileID);
    if (!imageUrl) {
      continue;
    }

    const response = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "system",
              content: [{ text: "你是科研图片 OCR 助手，请提取图片中的文字、表格标题、关键标注，并保持原意。" }],
            },
            {
              role: "user",
              content: [
                { image: imageUrl },
                { text: "请提取图中文字，并简洁说明这张图中最关键的实验信息。" },
              ],
            },
          ],
        },
        parameters: {
          result_format: "message",
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || payload.code || "通义 OCR 接口调用失败。");
    }

    const text = payload.output?.choices?.[0]?.message?.content
      ?.map((item) => item.text || "")
      .filter(Boolean)
      .join("\n");

    if (text) {
      ocrResults.push(`【${file.name}】\n${text}`);
    }
  }

  return ocrResults.join("\n\n");
}

function isImage(name = "", type = "") {
  return type.startsWith("image/") || /\.(png|jpg|jpeg|webp|bmp)$/i.test(name);
}
