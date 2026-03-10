/**
 * 按角色 ID（如 208803_103）尝试拉取剧本；失败则从 manifest 拉取该角色相关 eventkey 等 json 保存。
 * 用法: node fetch-scenario-for-character.js 208803_103
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const CryptoJS = require("crypto-js");

const idArg = process.argv[2] || "208803_103";
const [charId, episode] = idArg.includes("_") ? idArg.split("_") : [idArg, "002"];

const CANDIDATES = [
  `adv/scenario/${charId}_${episode}.json`,
  `adv/scenario/${charId}_002.json`,
  `adv/scenario/${charId}/${episode}.json`,
  `adv/story/${charId}_${episode}.json`,
];

function _getMd5(r, img) {
  const a = r.assets[img];
  return a?.["0"]?.md5 ?? a?.["3"]?.md5 ?? a?.["1"]?.md5;
}
function _getUrl(ct, md5, ver) {
  const d = (t) => [t.substring(0, 2), t.substring(4, 6)];
  const h = (t) => [t.substring(2, 4), t.substring(6, 8), t.substring(0, 2)];
  const p = (t) => [t.substring(4, 6), t.substring(0, 2), t.substring(6, 8), t.substring(2, 4)];
  const _ = (t) => [t.substring(6, 8), t.substring(2, 4), t.substring(4, 6), t.substring(0, 2)];
  const f = { 0: d, 1: d, 2: d, 3: d, 4: h, 5: h, 6: h, 7: h, 8: p, 9: p, a: p, b: p, c: _, d: _, e: _, f: _ };
  function g(t) {
    if (t[0] === ".") return "";
    return f[t[0]](t).join("/");
  }
  const e = CryptoJS.MD5(ct).toString(CryptoJS.enc.Hex);
  const i = ct.substr(0, ct.lastIndexOf("."));
  const a = g(CryptoJS.MD5(i).toString(CryptoJS.enc.Hex));
  const n = md5 + "." + (ct.split(".")[1] || "json");
  return `https://minasigo-no-shigoto-pd-c-res.orphans-order.com/${ver}/${e}/${a}/${n}`;
}
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

async function main() {
  const resultPath = path.join(__dirname, "result.json");
  if (!fs.existsSync(resultPath)) {
    console.error("需要 result.json，请先运行 npm start");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const version = manifest.version || "2.7.020";

  // 1) 尝试 getStoryResource
  let mod;
  try {
    mod = require("./index.js");
  } catch (e) {
    mod = null;
  }
  if (mod && mod.fetchStoryResourcePath) {
    for (const p of CANDIDATES) {
      const info = await mod.fetchStoryResourcePath(p);
      if (info && info.path && info.md5) {
        const url = mod._getUrl(info.path, info.md5, version);
        const buf = await fetchUrl(url);
        const out = path.join(__dirname, `scenario_${charId}_${episode}.json`);
        fs.writeFileSync(out, buf);
        console.log("已通过 getStoryResource 拉取剧本:", out);
        return;
      }
      if (info && info.err) console.log("  ", p, "->", info.err);
    }
  }

  // 2) 从 manifest 拉取该角色相关 eventkey 等 json
  const assetPaths = Object.keys(manifest.assets || {});
  const related = assetPaths.filter(
    (k) => k.includes(charId) && k.endsWith(".json") && (k.includes("eventkey") || k.includes("spine/character"))
  );
  const outDir = path.join(__dirname, "scenario_fallback");
  fs.mkdirSync(outDir, { recursive: true });
  let saved = 0;
  for (const p of related.slice(0, 10)) {
    const md5 = _getMd5(manifest, p);
    if (!md5) continue;
    const url = _getUrl(p, md5, version);
    try {
      const buf = await fetchUrl(url);
      const name = p.replace(/\//g, "_");
      fs.writeFileSync(path.join(outDir, name), buf);
      console.log("已保存(manifest):", name);
      saved++;
    } catch (e) {
      console.log("  skip", p, e.message);
    }
  }
  if (saved) {
    console.log("getStoryResource 未返回剧本，已保存", saved, "个相关 json 到", outDir, "（多为 eventkey/Spine，非对话剧本）");
  } else {
    console.log("未找到可下载的剧本或相关 json。getStoryResource 可能不提供剧本资源，或需其他 path/接口。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
