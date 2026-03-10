/**
 * 用你提供的 curl 请求体调用 readStory，并解密、分析响应。
 * 用法: node readStory-curl.js [加密的 data 字符串]
 * 若不传参则使用你 curl 里的 data。
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");

const READSTORY_URL = "https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/story/readStory";
const CURL_DATA = "U2FsdGVkX18ysjtyslRoANrNGuSHctDtuJR0AATjnnVwJWKFFhdoFiV7v68eb3KBQoER9a4Po3u/cdwmAuD4hg==";

async function main() {
  const mod = require("./index.js");
  const cfg = require("./config.json");
  const token = (cfg.token && cfg.token.token) || "";
  if (!token) {
    console.error("请确保 config.json 中有 token.token");
    process.exit(1);
  }
  const certDir = fs.existsSync(path.join(__dirname, "cert.pem")) ? __dirname : path.join(__dirname, "..");
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync(path.join(certDir, "cert.pem")),
    key: fs.readFileSync(path.join(certDir, "key.pem")),
    passphrase: "",
  });
  const bodyData = process.argv[2] || CURL_DATA;
  const version = (cfg.version && cfg.version.resourceVersion) ? cfg.version : { resourceVersion: "2.7.020", masterVersion: "2.7.02", clientVersion: "2.7.022" };

  console.log("POST", READSTORY_URL);
  console.log("Body data 长度:", bodyData.length, "\n");

  try {
    const res = await axios.post(
      READSTORY_URL,
      { data: bodyData },
      {
        httpsAgent,
        headers: {
          Accept: "application/json;charset=UTF-8",
          "Content-Type": "application/json;charset=UTF-8",
          "X-Mnsg-App-Version": JSON.stringify(version),
          Authorization: mod.getAuthorization("POST", READSTORY_URL),
        },
        timeout: 20000,
      }
    );
    const raw = res.data;
    const encrypted = raw && typeof raw === "object" && raw.data != null ? raw.data : (typeof raw === "string" ? raw : null);
    if (encrypted) {
      const decrypted = mod.decrypt(encrypted, token);
      let parsed;
      try {
        parsed = JSON.parse(decrypted);
      } catch (_) {
        parsed = decrypted;
      }
      console.log("--- 解密后响应 ---\n");
      const out = typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed);
      console.log(out.slice(0, 4000));
      if (out.length > 4000) console.log("\n... (截断)");
      if (parsed && typeof parsed === "object") {
        console.log("\n--- 顶层 keys ---", Object.keys(parsed));
        if (parsed.story != null) console.log("  story:", typeof parsed.story, Array.isArray(parsed.story) ? "length=" + parsed.story.length : "");
        if (parsed.scenario != null) console.log("  scenario:", typeof parsed.scenario);
        if (parsed.err != null) console.log("  err:", parsed.err, "status:", parsed.status);
      }
      fs.writeFileSync(path.join(__dirname, "readStory_response.json"), typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed), "utf8");
      console.log("\n已保存 readStory_response.json");
    } else {
      console.log("响应:", typeof raw, raw);
    }
  } catch (e) {
    if (e.response) {
      console.log("HTTP", e.response.status);
      const d = e.response.data;
      if (d && typeof d === "object" && d.data != null && token) {
        try {
          const dec = mod.decrypt(d.data, token);
          console.log("body 解密:", dec.slice(0, 500));
        } catch (_) {}
      } else {
        console.log("body:", d);
      }
    } else {
      console.error(e.message);
    }
    process.exit(1);
  }
}

main();
