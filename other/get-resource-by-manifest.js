/**
 * 与参考 Python 一致：仅用 manifest 拼 CDN URL，不调 getStoryResource。
 * 支持类型：角色卡面(stand)、寝室预览(episode_story)、BGM、战神卡面(summon)、资源路径(直接 path)。
 * 用法:
 *   node get-resource-by-manifest.js list [类型]     # 列出该类型在 manifest 中的 path 并写 json
 *   node get-resource-by-manifest.js url <path>      # 输出该 path 的 CDN URL
 * 运行 node get-resource-by-manifest.js types 可查看 result.json 里所有类型。
 */

const fs = require("fs");
const path = require("path");
const CryptoJS = require("crypto-js");

const RESULT_PATH = path.join(__dirname, "result.json");

function _getMd5(manifest, assetPath) {
  const a = manifest.assets[assetPath];
  return a?.["0"]?.md5 ?? a?.["3"]?.md5 ?? a?.["1"]?.md5;
}

function getAdvResourcePath(filePath, md5Hex, version) {
  const d = (t) => [t.substring(0, 2), t.substring(4, 6)];
  const h = (t) => [t.substring(2, 4), t.substring(6, 8), t.substring(0, 2)];
  const p = (t) => [t.substring(4, 6), t.substring(0, 2), t.substring(6, 8), t.substring(2, 4)];
  const c = (t) => [t.substring(6, 8), t.substring(2, 4), t.substring(4, 6), t.substring(0, 2)];
  const f = { 0: d, 1: d, 2: d, 3: d, 4: h, 5: h, 6: h, 7: h, 8: p, 9: p, a: p, b: p, c: c, d: c, e: c, f: c };
  function getPath(h) {
    if (h[0] === ".") return "";
    return f[h[0]](h).join("/");
  }
  const e = CryptoJS.MD5(filePath).toString(CryptoJS.enc.Hex);
  const dot = filePath.lastIndexOf(".");
  const i = dot >= 0 ? filePath.slice(0, dot) : filePath;
  const ext = dot >= 0 ? filePath.slice(dot) : "";
  const part = getPath(CryptoJS.MD5(i).toString(CryptoJS.enc.Hex));
  const name = md5Hex + (ext || ".png");
  return `${e}/${part}/${name}`;
}

function bestQuality(assetMd5Dir) {
  const keys = Object.keys(assetMd5Dir || {}).filter((k) => /^\d+$/.test(k));
  return keys.length ? String(Math.max(...keys.map(Number))) : "0";
}

function getUrl(manifest, filePath) {
  const dir = manifest.assets[filePath];
  if (!dir) return null;
  const quality = bestQuality(dir);
  const md5 = dir[quality]?.md5;
  if (!md5) return null;
  const version = manifest.version || "2.7.020";
  const rel = getAdvResourcePath(filePath, md5, version);
  return `https://minasigo-no-shigoto-pd-c-res.orphans-order.com/${version}/${rel}`;
}

// result.json 里按 path 前两段作为类型；这里列出常用别名
const TYPE_FILTER = {
  stand: (p) => p.startsWith("image/character/stand/"),
  episode_story: (p) => p.startsWith("image/episode/story/"),
  episode: (p) => p.startsWith("image/episode/"),
  summon_stand: (p) => p.startsWith("image/summon/stand/"),
  summon: (p) => p.startsWith("image/summon/"),
  bgm: (p) => p.startsWith("sound/bgm/"),
  voice: (p) => p.startsWith("sound/voice/"),
  se: (p) => p.startsWith("sound/se/"),
  script: (p) => /\.(json|txt|xml|ini)$/i.test(p) && !p.includes("atlas"),
  audio: (p) => /\.(mp3|ogg|wav|m4a)$/i.test(p),
  character: (p) => p.startsWith("image/character/"),
  eventkey: (p) => p.startsWith("spine/eventkey/"),
  effect: (p) => p.startsWith("spine/effect/"),
  decoration: (p) => p.startsWith("image/decoration/"),
  gacha: (p) => p.startsWith("image/gacha/"),
  event: (p) => p.startsWith("image/event/"),
  shop: (p) => p.startsWith("image/shop/"),
  equipment: (p) => p.startsWith("image/equipment/"),
  item: (p) => p.startsWith("image/item/"),
  enemy: (p) => p.startsWith("image/enemy/"),
  news: (p) => p.startsWith("image/news/"),
  bg: (p) => p.startsWith("image/bg/"),
};

function main() {
  if (!fs.existsSync(RESULT_PATH)) {
    console.error("需要 result.json，请先 npm start");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8"));
  const assets = Object.keys(manifest.assets || {});
  const cmd = process.argv[2];
  const arg = process.argv[3];

  if (cmd === "types") {
    const byPrefix = {};
    assets.forEach((p) => {
      const parts = p.split("/");
      const pre = parts.length >= 2 ? parts.slice(0, 2).join("/") : parts[0] || p;
      byPrefix[pre] = (byPrefix[pre] || 0) + 1;
    });
    const sorted = Object.entries(byPrefix).sort((a, b) => b[1] - a[1]);
    console.log("result.json 中的类型（path 前两段）及数量:\n");
    sorted.forEach(([pre, cnt]) => console.log("  ", pre.padEnd(40), cnt));
    console.log("\n用法: node get-resource-by-manifest.js list <类型名或前缀>");
    console.log("示例: node get-resource-by-manifest.js list voice");
    console.log("      node get-resource-by-manifest.js list image/character");
    return;
  }

  if (cmd === "url") {
    const p = arg;
    if (!p) {
      console.error("用法: node get-resource-by-manifest.js url <path>");
      process.exit(1);
    }
    const url = getUrl(manifest, p);
    if (url) console.log(url);
    else console.error("manifest 中无此 path:", p);
    return;
  }

  if (cmd === "list") {
    const type = arg || "episode_story";
    const filter = TYPE_FILTER[type] || ((p) => p.startsWith(type + "/") || p.startsWith(type));
    const list = assets.filter(filter).map((p) => ({
      path: p,
      name: p.replace(/\//g, "_"),
      url: getUrl(manifest, p),
    }));
    const outFile = path.join(__dirname, `manifest_${type}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ data: list }, null, 2), "utf8");
    console.log(type, "数量:", list.length, "已写入", outFile);
    if (list.length && list[0].url) console.log("示例 URL:", list[0].url);
    return;
  }

  console.log("用法:");
  console.log("  node get-resource-by-manifest.js types                    # 查看 result.json 里所有类型");
  console.log("  node get-resource-by-manifest.js list [类型或前缀]         # 导出该类型 URL 列表");
  console.log("  node get-resource-by-manifest.js url <asset_path>          # 查单个 path 的 CDN URL");
}

main();
