/**
 * 从 readStory 的 resources 里筛出剧本 txt，用 _getUrl 拼 CDN 并下载到 story_txt/
 * 用法：
 *   node download-story-from-readStory.js
 *     → 使用已存在的 readStory_response.json
 *   node download-story-from-readStory.js 123340 111
 *     → 先调 readStory(storyId, episodeId)，再下载
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const mod = require("./index.js");

const OUT_DIR = path.join(__dirname, "story_txt");

function getUrl(r) {
  const p = (r.path || "").replace(/^\//, "");
  return mod._getUrl(p, r.md5);
}

async function downloadStoryTxtFromResponse(res) {
  if (!res || !Array.isArray(res.resources)) {
    console.log("readStory 响应中无 resources");
    return;
  }
  const storyTxts = res.resources.filter((r) =>
    (r.path || "").includes("textfiles/story") && (r.path || "").endsWith(".txt")
  );
  if (storyTxts.length === 0) {
    console.log("未找到 adv/textfiles/story/*.txt 资源");
    return;
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const r of storyTxts) {
    const name = path.basename(r.path || r.resourcePath + ".txt");
    const filepath = path.join(OUT_DIR, name);
    const url = getUrl(r);
    console.log("下载剧本:", name, "->", filepath);
    await new Promise((resolve, reject) => {
      https.get(url, (resp) => {
        if (resp.statusCode !== 200) {
          reject(new Error(resp.statusCode + " " + url));
          return;
        }
        const chunks = [];
        resp.on("data", (c) => chunks.push(c));
        resp.on("end", () => {
          fs.writeFileSync(filepath, Buffer.concat(chunks), "utf8");
          resolve();
        });
      }).on("error", reject);
    });
  }
  console.log("已保存到", OUT_DIR);
}

async function main() {
  let res = null;
  const fromFile = path.join(__dirname, "readStory_response.json");
  const storyId = process.argv[2];
  const episodeId = process.argv[3];

  if (storyId && episodeId) {
    console.log("调用 readStory:", storyId, episodeId);
    try {
      res = await mod.readStory({ storyId, episodeId });
    } catch (e) {
      console.error(e.message || e);
      if (e.response) console.error("HTTP", e.response.status, e.response.data);
      process.exit(1);
    }
    fs.writeFileSync(fromFile, JSON.stringify(res, null, 2), "utf8");
    console.log("已写入", fromFile);
  } else if (fs.existsSync(fromFile)) {
    res = JSON.parse(fs.readFileSync(fromFile, "utf8"));
    console.log("使用已有 readStory_response.json");
  } else {
    console.log("用法: node download-story-from-readStory.js [storyId] [episodeId]");
    console.log("  无参数时需先运行 readStory-curl.js 或本脚本 storyId episodeId 生成 readStory_response.json");
    process.exit(1);
  }

  await downloadStoryTxtFromResponse(res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
