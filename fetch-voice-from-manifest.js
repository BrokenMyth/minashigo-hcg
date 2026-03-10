/**
 * 根据场景剧本里出现的 adv/sound/voice/xxx.mp3 中的角色 id（如 adu228101_02_01 里的 228101），
 * 在 result.json 里匹配 sound/voice 下包含该 id 的 mp3，用 manifest 的 URL 下载，保持音频原文件名。
 * 用法: node fetch-voice-from-manifest.js <sceneId>
 * 例: node fetch-voice-from-manifest.js 122810112
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUTPUT_ROOT = path.join(__dirname, "output");
const RESULT_PATH = path.join(__dirname, "result.json");

function getVoiceIdsFromScript(scriptText) {
  const ids = new Set();
  const re = /adv\/sound\/voice\/([a-zA-Z]*)(\d{5,})[_\-]/gi;
  let m;
  while ((m = re.exec(scriptText)) !== null) ids.add(m[2]);
  return [...ids];
}

function getVoicePathsFromManifest(manifest, voiceIds) {
  const out = [];
  const keys = Object.keys(manifest.assets || {});
  for (const key of keys) {
    if (!key.includes("sound/voice") || !/\.mp3$/i.test(key)) continue;
    for (const id of voiceIds) {
      if (key.includes(id)) {
        out.push(key);
        break;
      }
    }
  }
  return [...new Set(out)];
}

function getMd5(manifest, assetPath) {
  const a = manifest.assets[assetPath];
  return a?.["0"]?.md5 ?? a?.["3"]?.md5 ?? a?.["1"]?.md5;
}

function downloadTo(url, filepath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (resp) => {
        if (resp.statusCode !== 200) {
          reject(new Error(resp.statusCode + " " + url));
          return;
        }
        const chunks = [];
        resp.on("data", (c) => chunks.push(c));
        resp.on("end", () => {
          fs.writeFileSync(filepath, Buffer.concat(chunks));
          resolve();
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const sceneId = process.argv[2];
  if (!sceneId || !/^\d+$/.test(sceneId)) {
    console.error("用法: node fetch-voice-from-manifest.js <sceneId>");
    process.exit(1);
  }
  if (!fs.existsSync(RESULT_PATH)) {
    console.error("需要 result.json，请先执行: npm start");
    process.exit(1);
  }
  const scriptPath = path.join(OUTPUT_ROOT, sceneId, sceneId + ".txt");
  if (!fs.existsSync(scriptPath)) {
    console.error("未找到剧本:", scriptPath, "请先拉取该场景剧本");
    process.exit(1);
  }

  const mod = require("./index.js");
  const manifest = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8"));
  const scriptText = fs.readFileSync(scriptPath, "utf8");

  const voiceIds = getVoiceIdsFromScript(scriptText);
  const voicePaths = getVoicePathsFromManifest(manifest, voiceIds);

  const dirVoice = path.join(OUTPUT_ROOT, sceneId, "sound", "voice");
  fs.mkdirSync(dirVoice, { recursive: true });

  let downloaded = 0;
  for (const assetPath of voicePaths) {
    const name = path.basename(assetPath);
    const filepath = path.join(dirVoice, name);
    if (fs.existsSync(filepath)) {
      downloaded++;
      continue;
    }
    const md5 = getMd5(manifest, assetPath);
    if (!md5) continue;
    const version = manifest.version || "2.7.020";
    const url = mod._getUrl(assetPath, md5, version);
    try {
      await downloadTo(url, filepath);
      downloaded++;
      console.log("  ", name);
    } catch (e) {
      console.warn("  失败:", name, e.message);
    }
  }

  console.log("场景", sceneId, "剧本中 voice id:", voiceIds.join(", "));
  console.log("result.json 匹配到", voicePaths.length, "个 mp3，已存在/已下载", downloaded, "个");
  console.log("输出目录:", dirVoice);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
