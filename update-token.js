/**
 * 统一维护 config.json：拉取 getVersion 更新 config.version，保留已有 config.token。
 * 用法: node update-token.js
 * token 请直接编辑 config.json 的 token 字段。
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const BASE = "https://minasigo-no-shigoto-web-r-server.orphans-order.com";
const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, "config.json");
/// Replace this object by getVersion's response
/// Replace this object by getDmmAccessToken's response
async function fetchVersion() {
  const res = await axios.get(`${BASE}/mnsg/user/getVersion`);
  if (res.data && res.data.version) return res.data.version;
  throw new Error("getVersion 返回无 version");
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

async function main() {
  const config = loadConfig();

  console.log("拉取 getVersion...");
  try {
    config.version = await fetchVersion();
    console.log("版本:", config.version.resourceVersion || config.version);
  } catch (e) {
    console.error("getVersion 失败:", e.message);
    process.exit(1);
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  console.log("已写入 config.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
