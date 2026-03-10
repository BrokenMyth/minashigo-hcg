/**
 * 按类型下载：读取清单 JSON（data[].name + url），将未下载的项拉取到指定目录。
 * 清单来源：cg/audio/script 由 start.bat(index.js) 生成；episode_story/stand/bgm 由 get-resource-by-manifest.js list <类型> 生成。
 * 用法: node download.js [类型]
 * 类型: cg | audio | script | episode_story | stand | bgm | story_voice
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const OUTPUT_ROOT = "output";
const TYPE_CONFIG = {
  cg: [path.join(OUTPUT_ROOT, "cg.json"), path.join(OUTPUT_ROOT, "cg")],
  audio: ["audio.json", "audio"],
  script: ["script.json", "script"],
  episode_story: ["manifest_episode_story.json", "episode_story"],
  stand: ["manifest_stand.json", "stand"],
  bgm: ["manifest_bgm.json", "bgm"],
  story_voice: [path.join(OUTPUT_ROOT, "story_voice.json"), path.join(OUTPUT_ROOT, "voice")],
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(res.statusCode + " " + url));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

async function main() {
  const type = process.argv[2] || "cg";
  if (!TYPE_CONFIG[type]) {
    console.error("类型需为:", Object.keys(TYPE_CONFIG).join(" | "));
    process.exit(1);
  }
  const [listFile, outDir] = TYPE_CONFIG[type];
  const listPath = path.join(__dirname, listFile);

  if (!fs.existsSync(listPath)) {
    console.error("未找到", listFile, "，请先运行 start.bat 或 node get-resource-by-manifest.js list <类型> 生成");
    process.exit(1);
  }

  const outDirAbs = path.join(__dirname, outDir);
  fs.mkdirSync(outDirAbs, { recursive: true });
  const existing = new Set(
    fs.readdirSync(outDirAbs).filter((f) => fs.statSync(path.join(outDirAbs, f)).isFile())
  );
  const raw = JSON.parse(fs.readFileSync(listPath, "utf8"));
  const data = raw.data || [];

  for (const row of data) {
    const name = row.name;
    if (existing.has(name)) continue;
    console.log("Downloading", name);
    try {
      const buf = await get(row.url);
      fs.writeFileSync(path.join(outDirAbs, name), buf);
    } catch (e) {
      console.log("  ERROR:", e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
