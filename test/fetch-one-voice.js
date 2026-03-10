/**
 * 用 getStoryResource 按剧本 path 拉一条语音，看是否返回 URL（adu 语音不在 result.json 里，只能走接口）
 * 用法: node test/fetch-one-voice.js [path]
 * 例: node test/fetch-one-voice.js adv/sound/voice/adu228101_01_05.mp3
 */
const path = require("path");
const fs = require("fs");
const https = require("https");

const mod = require("../index.js");
const relPath = process.argv[2] || "adv/sound/voice/adu228101_01_05.mp3";

async function main() {
  console.log("请求 path:", relPath);
  try {
    const info = await mod.fetchStoryResourcePath(relPath);
    if (info.err) {
      console.log("接口返回错误:", info.err, info.status);
      return;
    }
    if (info.path && info.md5) {
      const url = mod._getUrl(info.path, info.md5);
      console.log("接口返回 path:", info.path);
      console.log("md5:", info.md5);
      console.log("URL:", url);
      // 可选：下载到当前目录
      const outName = path.basename(relPath);
      const outPath = path.join(__dirname, outName);
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          console.log("下载失败:", res.statusCode);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          fs.writeFileSync(outPath, Buffer.concat(chunks));
          console.log("已保存:", outPath);
        });
      }).on("error", (e) => console.error("下载 error:", e.message));
    } else {
      console.log("未返回 path/md5:", info);
    }
  } catch (e) {
    console.error("请求失败:", e.message);
    if (e.response) {
      console.error("status:", e.response.status);
      console.error("headers:", JSON.stringify(e.response.headers, null, 2));
      console.error("data:", typeof e.response.data === "object" ? JSON.stringify(e.response.data) : e.response.data);
    }
  }
}

main();
