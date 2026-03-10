/**
 * 根据 result.json 里所有类型，逐个导出 URL 列表并试探拉取（含剧本类 .json/.txt 样本）。
 * 用法: node fetch-all-types.js
 * 会生成 manifest_<类型>.json，并对含 .json/.txt 的类型拉取少量样本到 samples/<类型>/
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const CryptoJS = require("crypto-js");

const RESULT_PATH = path.join(__dirname, "result.json");
const OUT_DIR = path.join(__dirname, "manifest_by_type");
const SAMPLE_DIR = path.join(__dirname, "samples");

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

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

function isScriptLike(p) {
  return /\.(json|txt|xml|ini)$/i.test(p) && !p.includes("atlas");
}

function looksLikeScenario(buf) {
  const s = buf.slice(0, 2000).toString("utf8");
  return /"(dialogue|text|message|lines|scenario|script|talk|name)"\s*:/i.test(s) || /"text"\s*:\s*"/.test(s);
}

function sanitizeType(type) {
  return type.replace(/\//g, "_").replace(/[^a-z0-9_]/gi, "_");
}

async function main() {
  if (!fs.existsSync(RESULT_PATH)) {
    console.error("需要 result.json，请先 npm start");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8"));
  const assets = Object.keys(manifest.assets || {});
  const version = manifest.version || "2.7.020";

  const byPrefix = {};
  assets.forEach((p) => {
    const parts = p.split("/");
    const pre = parts.length >= 2 ? parts.slice(0, 2).join("/") : parts[0] || p;
    if (!byPrefix[pre]) byPrefix[pre] = [];
    byPrefix[pre].push(p);
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SAMPLE_DIR, { recursive: true });

  const types = Object.entries(byPrefix).sort((a, b) => b[1].length - a[1].length);
  console.log("共", types.length, "种类型，开始导出并试探剧本类...\n");

  const scriptLikeByType = [];
  for (const [prefix, paths] of types) {
    const safe = sanitizeType(prefix);
    const list = paths.map((p) => ({
      path: p,
      name: p.replace(/\//g, "_"),
      url: getUrl(manifest, p),
    }));
    const outFile = path.join(OUT_DIR, `manifest_${safe}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ data: list }, null, 2), "utf8");

    const scriptPaths = paths.filter(isScriptLike);
    if (scriptPaths.length > 0) {
      scriptLikeByType.push({ prefix, count: scriptPaths.length, paths: scriptPaths });
    }
  }
  console.log("已导出所有类型到", OUT_DIR, "\n");

  console.log("含 .json/.txt 等剧本类扩展的类型:");
  for (const { prefix, count, paths } of scriptLikeByType) {
    console.log("  ", prefix, "数量:", count);
  }

  console.log("\n试探拉取剧本类样本（每类最多 2 个）:");
  for (const { prefix, paths } of scriptLikeByType) {
    const safe = sanitizeType(prefix);
    const sampleSub = path.join(SAMPLE_DIR, safe);
    fs.mkdirSync(sampleSub, { recursive: true });
    for (const p of paths.slice(0, 2)) {
      const url = getUrl(manifest, p);
      if (!url) continue;
      try {
        const buf = await fetchUrl(url);
        const name = p.replace(/\//g, "_");
        const outPath = path.join(sampleSub, name);
        fs.writeFileSync(outPath, buf);
        const maybeScenario = looksLikeScenario(buf);
        console.log("  ", maybeScenario ? "[可能剧本]" : "  ", p, "->", outPath);
        if (maybeScenario) console.log("      ^ 内容含 dialogue/text/lines 等，建议打开查看");
      } catch (e) {
        console.log("  ERROR", p, e.message);
      }
    }
  }

  console.log("\n完成。manifest 按类型在", OUT_DIR, "；剧本类样本在", SAMPLE_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
