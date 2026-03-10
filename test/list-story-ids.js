/**
 * 从 result.json (manifest) 的 image/episode/story/*.png 提取剧情 ID，
 * 拆成 storyId + episodeId（先 6+3，若为 10 位则 6+4），供 readStory / download-story-from-readStory 使用。
 *
 * 用法:
 *   node list-story-ids.js
 *     → 输出所有 (resourcePath -> storyId, episodeId)，每行一个
 *   node list-story-ids.js --json
 *     → 输出 JSON 数组 [{ resourcePath, storyId, episodeId }, ...]
 *   node list-story-ids.js 110010101
 *     → 只输出该 resourcePath 的拆分结果
 */
const fs = require("fs");
const path = require("path");

const RESULT_PATH = path.join(__dirname, "result.json");
const PREFIX = "image/episode/story/";

function parseResourcePath(id) {
  const s = String(id).trim();
  if (!s || !/^\d+$/.test(s)) return null;
  // 常见: 9 位 = 6+3, 10 位 = 6+4
  if (s.length === 9) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  if (s.length === 10) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  if (s.length === 8) return { storyId: s.slice(0, 5), episodeId: s.slice(5) };
  if (s.length >= 6) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  return null;
}

function main() {
  if (!fs.existsSync(RESULT_PATH)) {
    console.error("需要 result.json，请先 npm start");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8"));
  const assets = Object.keys(manifest.assets || {});
  const storyPaths = assets.filter((p) => p.startsWith(PREFIX));

  const single = process.argv[2];
  let list = storyPaths.map((p) => {
    const name = p.slice(PREFIX.length);
    const id = name.replace(/\.png$/i, "");
    return { resourcePath: id, ...parseResourcePath(id) };
  }).filter((x) => x.storyId != null);

  list = list.filter((x, i, arr) => arr.findIndex((y) => y.resourcePath === x.resourcePath) === i);

  if (single && single !== "--json") {
    const one = list.find((x) => x.resourcePath === single) || (() => {
      const p = parseResourcePath(single);
      return p ? { resourcePath: single, ...p } : null;
    })();
    if (one) {
      console.log(one.resourcePath, "->", "storyId=" + one.storyId, "episodeId=" + one.episodeId);
      console.log("  node download-story-from-readStory.js", one.storyId, one.episodeId);
    } else {
      console.error("无法解析 ID:", single);
      process.exit(1);
    }
    return;
  }

  if (process.argv[2] === "--json") {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  console.log("# 从 result.json 的 image/episode/story/*.png 提取的剧情 ID (resourcePath -> storyId, episodeId)\n");
  list.forEach((x) => {
    console.log(x.resourcePath + "\t" + x.storyId + "\t" + x.episodeId);
  });
  console.log("\n# 用法: node download-story-from-readStory.js <storyId> <episodeId>");
}

main();
