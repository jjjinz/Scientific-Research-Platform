const cloudbase = require("@cloudbase/node-sdk");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

exports.main = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const body = parseBody(event.body);
    const expectedPassword = process.env.ADMIN_PASSWORD || "";
    const credentials = process.env.CLOUDBASE_CUSTOM_LOGIN_CREDENTIALS || "";
    const loginUserId = process.env.LOGIN_USER_ID || "research_admin";

    if (!expectedPassword || !credentials) {
      return response(500, { message: "缺少登录函数环境变量，请先配置管理员密码和自定义登录密钥。" });
    }

    if (!body.password || body.password !== expectedPassword) {
      return response(401, { message: "管理员密码错误。" });
    }

    const app = cloudbase.init({
      env: cloudbase.SYMBOL_CURRENT_ENV,
      credentials: JSON.parse(credentials),
    });

    const ticket = app.auth().createTicket(loginUserId);
    return response(200, { ticket, userId: loginUserId });
  } catch (error) {
    console.error(error);
    return response(500, { message: "登录票据生成失败。", detail: error.message });
  }
};

function parseBody(value) {
  if (!value) return {};
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function response(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(payload),
  };
}
