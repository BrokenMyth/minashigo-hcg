/**
 * 测试脚本：优先拉取剧情脚本（通过 getStoryResource），失败则从 manifest 拉一个。
 * 用法:
 *   node test-fetch-one-script.js "adv/scenario/200107_302.json"
 * 需要:
 *   - result.json（先 npm start 会生成）
 *   - 拉剧情时还需 cert：即 cert.pem + key.pem（与 index.js 下 CG 用的同一套 TLS 客户端证书），
 *     放在本脚本同目录或上级目录，否则会回退到 manifest 里的 eventkey（非剧情）。
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const userPath = process.argv[2];

// 剧情脚本 path 候选（与 eventkey 编号对应；若你知道正确 path 可用命令行参数传入）
const STORY_PATH_CANDIDATES = userPath
  ? [userPath]
  : [
      "adv/scenario/100701_002.json",
      "adv/scenario/100701_001.json",
      "adv/scenario/200108_002.json",
      "adv/scenario/200204_002.json",
      "adv/scenario/100701.json",
      "adv/story/100701_002.json",
      "adv/story/100701.json",
      "adv/script/100701_002.json",
    ];

function fetchOne(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { rejectUnauthorized: false }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function tryStoryViaApi() {
  let mod;
  try {
    mod = require("./index.js");
  } catch (e) {
    return null;
  }
  if (!mod.fetchStoryResourcePath || !mod._getUrl) return null;
  const certDir = fs.existsSync(path.join(__dirname, "cert.pem")) ? __dirname : path.join(__dirname, "..");
  const hasCert = fs.existsSync(path.join(certDir, "cert.pem")) && fs.existsSync(path.join(certDir, "key.pem"));
  if (!hasCert) {
    console.error(
      "未找到客户端证书，无法调用 getStoryResource。\n" +
      "cert 即 cert.pem + key.pem：与 index.js 下 CG 时用的同一套 TLS 客户端证书，\n" +
      "请放在当前脚本所在目录或上级目录。当前检查路径: " +
      path.join(__dirname, "cert.pem") + " 或 " + path.join(__dirname, "..", "cert.pem")
    );
    return null;
  }
  const version = (mod.__version && mod.__version.resourceVersion) || "2.7.020";
  let lastErr = null;
  for (const storyPath of STORY_PATH_CANDIDATES) {
    try {
      const info = await mod.fetchStoryResourcePath(storyPath);
      if (info && info.path && info.md5) {
        const url = mod._getUrl(info.path, info.md5, version);
        return { url, path: info.path, ext: path.extname(info.path) || ".json" };
      }
      if (info && (info.err != null || info.status != null)) {
        lastErr = storyPath + " -> status=" + info.status + " err=\"" + (info.err || "") + "\"";
      } else {
        lastErr = storyPath + " -> 接口返回无 resources";
      }
    } catch (e) {
      lastErr = storyPath + " -> " + (e.message || e);
    }
  }
  if (lastErr) {
    let hint = "（可尝试其他剧情 path 或确认该 ID 在游戏内存在）";
    if (lastErr.includes("401")) hint = "（401=认证失败：请更新 token 后重试）";
    else if (lastErr.includes("story master not found")) hint = "（服务端表示找不到该剧情：path/ID 可能不对或需用其他格式）";
    console.error("getStoryResource 失败:", lastErr, hint);
  }
  return null;
}

async function pickFromManifest(manifest) {
  const version = manifest.version || "2.7.020";
  const assetPaths = Object.keys(manifest.assets || {});
  const CryptoJS = require("crypto-js");

  function _getMd5(resource, image) {
    const a = resource.assets[image];
    return a?.["0"]?.md5 ?? a?.["3"]?.md5 ?? a?.["1"]?.md5;
  }
  function _getUrl(ciphertext, md5, ver) {
    const d = (t) => [t.substring(0, 2), t.substring(4, 6)];
    const h = (t) => [t.substring(2, 4), t.substring(6, 8), t.substring(0, 2)];
    const p = (t) => [t.substring(4, 6), t.substring(0, 2), t.substring(6, 8), t.substring(2, 4)];
    const _ = (t) => [t.substring(6, 8), t.substring(2, 4), t.substring(4, 6), t.substring(0, 2)];
    const f = { 0: d, 1: d, 2: d, 3: d, 4: h, 5: h, 6: h, 7: h, 8: p, 9: p, a: p, b: p, c: _, d: _, e: _, f: _ };
    function g(t) {
      if (t[0] === ".") return "";
      return f[t[0]](t).join("/");
    }
    const e = CryptoJS.MD5(ciphertext).toString(CryptoJS.enc.Hex);
    const i = ciphertext.substr(0, ciphertext.lastIndexOf("."));
    const a = g(CryptoJS.MD5(i).toString(CryptoJS.enc.Hex));
    const n = md5 + "." + (ciphertext.split(".")[1] || "txt");
    return `https://minasigo-no-shigoto-pd-c-res.orphans-order.com/${ver}/${e}/${a}/${n}`;
  }

  // 优先：eventkey（与剧情事件编号对应，但内容是 Spine 动画事件，非对话剧本）
  const eventkey = assetPaths.find(
    (p) => p.startsWith("sp/spine/eventkey/") && p.endsWith(".json")
  );
  if (eventkey) {
    const md5 = _getMd5(manifest, eventkey);
    if (md5) return { url: _getUrl(eventkey, md5, version), path: eventkey, ext: ".json", fromManifest: true };
  }
  const txt = assetPaths.find((p) => p.endsWith(".txt") && !p.includes("atlas"));
  if (txt) {
    const md5 = _getMd5(manifest, txt);
    if (md5) return { url: _getUrl(txt, md5, version), path: txt, ext: ".txt", fromManifest: true };
  }
  return null;
}

async function main() {
  const resultPath = path.join(__dirname, "result.json");
  if (!fs.existsSync(resultPath)) {
    console.error("未找到 result.json，请先运行 npm start 生成 manifest。");
    process.exit(1);
  }

  let info = await tryStoryViaApi();
  let fromApi = !!info;
  if (!info) {
    const manifest = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    info = await pickFromManifest(manifest);
    if (info) {
      console.log("（未使用 getStoryResource：无 cert 或接口未返回；改为 manifest 内资源，可能非对话剧情）");
    }
  } else {
    console.log("（已通过 getStoryResource 获取剧情脚本 path）");
  }

  if (!info) {
    console.error("无法获取脚本：API 未返回且 manifest 中无合适脚本类资源。");
    process.exit(1);
  }

  const outName = "sample_script" + (info.ext || ".json");
  const outPath = path.join(__dirname, outName);

  console.log("选取:", info.path);
  console.log("URL:", info.url);
  console.log("正在拉取...");

  const buf = await fetchOne(info.url);
  fs.writeFileSync(outPath, buf);

  const preview = buf.slice(0, 2500).toString("utf8");
  const previewSafe = Buffer.from(preview, "utf8").toString("utf8").slice(0, 2000);
  console.log("\n已保存:", outPath);
  console.log("--- 内容预览 ---\n" + previewSafe + "\n--- 结束 ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
