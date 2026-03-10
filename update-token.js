/**
 * 单独执行：拉取 getVersion 更新版本，并从 token.json 读取 getDmmAccessToken 响应更新 token。
 * 用法:
 *   1. 浏览器打开游戏，Network 里找到 getVersion、getDmmAccessToken 的响应，把 getDmmAccessToken 的响应复制到 token.json（见 token.json.example）
 *   2. node update-token.js
 * 会生成/覆盖 config.json，index.js 启动时会优先使用 config.json 里的 version 和 token。
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const BASE = "https://minasigo-no-shigoto-web-r-server.orphans-order.com";
const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "config.json");
const TOKEN_PATH = path.join(ROOT, "token.json");

async function fetchVersion() {
  const res = await axios.get(`${BASE}/mnsg/user/getVersion`);
  if (res.data && res.data.version) return res.data.version;
  throw new Error("getVersion 返回无 version");
}

function loadTokenFromFile() {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  const raw = fs.readFileSync(TOKEN_PATH, "utf8").trim();
  const data = JSON.parse(raw);
  return data;
}

async function main() {
  const config = {};

  console.log("拉取 getVersion...");
  try {
    config.version = await fetchVersion();
    console.log("版本:", config.version.resourceVersion || config.version);
  } catch (e) {
    console.error("getVersion 失败:", e.message);
    process.exit(1);
  }

  const token = loadTokenFromFile();
  if (token) {
    config.token = token;
    console.log("已从 token.json 读取 token（dmmId:", token.dmmId || "-", "）");
  } else {
    console.log("未找到 token.json，仅更新版本。如需更新 token，请将 getDmmAccessToken 的响应写入 token.json（参考 token.json.example）");
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  console.log("已写入 config.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
