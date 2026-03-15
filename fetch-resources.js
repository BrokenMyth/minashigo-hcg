/**
 * 按场景拉取：先下剧本，再根据剧本里引用的 path 拉取图片和语音；每个场景一个文件夹，按路径分类。
 * 输出：output/<sceneId>/<sceneId>.txt，output/<sceneId>/image/bg/...，output/<sceneId>/image/character/<id>_<文件名>，output/<sceneId>/sound/voice/...
 * 用法: node fetch-resources.js [--cg] [--story] [--voice]
 * 环境变量: SCENE_LIMIT=N  只拉前 N 个；SCENE_RANDOM=N  随机拉 N 个
 * 依赖: config.json（version + token）、cert.pem / key.pem，不依赖 index.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const CryptoJS = require("crypto-js");
const axios = require("axios");
const o = require("url");

// ---------- 从 config.json 读取版本与鉴权 ----------
let __ = {};
let _ = {};
const _data = {
  dmmId: "",
  user_id: "",
  game_server_token: "",
  game_server_secret: "",
  consumer_key: "jFxXF3M0n4P056yfXtogRRjkZpWFTm52",
  consumer_secret: "Ti60QlOqMur6trRkQY64xJkpRm47BupdPVM7bw5udWBxXPEQKGDraAmeO0y062DT2oVbSkbYbV0vWlSUe7y5OpVEwnqiMbyWHhqQA6ycS6utzRiCtHos9YDDjJ94JXuaBK7u0SGAjo1HK4pv4w5yegGBo3t1LyGICWAQ6XWxq82O",
  signature_method: "HMAC-SHA256",
};
try {
  const cfg = require("./config.json");
  if (cfg.version) __ = { ...cfg.version };
  if (cfg.token) {
    _ = { ...cfg.token };
    const t = cfg.token;
    _data.dmmId = String(t.dmmId ?? t.user_id ?? _.dmmId ?? "");
    _data.user_id = String(t.userId ?? t.user_id ?? _.userId ?? _.user_id ?? "");
    _data.game_server_token = String(t.token ?? t.oauth_token ?? _.token ?? "");
    _data.game_server_secret = String(t.secret ?? t.game_server_secret ?? _.secret ?? "");
  }
} catch (e) {}

function _certDir() {
  const d = __dirname;
  if (fs.existsSync(path.join(d, "cert.pem"))) return d;
  const parent = path.join(d, "..");
  if (fs.existsSync(path.join(parent, "cert.pem"))) return parent;
  return d;
}

function decrypt(t, e) {
  const i = CryptoJS.SHA256(e + "one-deep");
  const n = i.toString(CryptoJS.enc.Base64).substr(0, 32);
  const iv = CryptoJS.SHA256(e.substr(0, 16)).toString(CryptoJS.enc.Base64).substr(0, 16);
  return CryptoJS.AES.decrypt(t, n, { iv, mode: CryptoJS.mode.CTR }).toString(CryptoJS.enc.Utf8);
}
function encrypt(t, e) {
  const i = CryptoJS.SHA256(e + "one-deep");
  const n = i.toString(CryptoJS.enc.Base64).substr(0, 32);
  const iv = CryptoJS.SHA256(e.substr(0, 16)).toString(CryptoJS.enc.Base64).substr(0, 16);
  return CryptoJS.AES.encrypt(t, n, { iv, mode: CryptoJS.mode.CTR }).toString();
}
function _encode(t) {
  return encodeURIComponent(t).replace("(", "%28").replace(")", "%29").replace("$", "%24").replace("!", "%21").replace("*", "%2A").replace("'", "%27").replace("%7E", "~");
}
function _normalizeUrl(t) {
  const e = o.parse(t, true);
  delete e.query;
  delete e.search;
  return o.format(e);
}
function _normalizeParameters(t) {
  return Object.keys(t).sort().map((i) => i + "=" + t[i]).join("&");
}
function _constructBaseString(t, e, i) {
  return [t.toUpperCase(), _encode(e), _encode(i)].join("&");
}
function encryptHmac(t, e) {
  return CryptoJS.HmacSHA256(t, e).toString(CryptoJS.enc.Base64);
}
function getAuthorization(method, url) {
  const i = {};
  let oStr = "";
  oStr += 'OAuth realm="Users"';
  i.oauth_token = _data.game_server_token;
  i.xoauth_requestor_id = _data.user_id;
  i.oauth_consumer_key = _data.consumer_key;
  i.oauth_signature_method = _data.signature_method;
  i.oauth_nonce = String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  i.oauth_timestamp = String(Math.floor(Date.now() / 1000));
  const s = _normalizeUrl(url);
  const a = _normalizeParameters(i);
  const r = _constructBaseString(method, s, a);
  let u = _encode(_data.consumer_secret) + "&";
  if (_data.game_server_secret) u += _data.game_server_secret;
  i.oauth_signature = encryptHmac(r, u);
  Object.keys(i).forEach((k) => { oStr = oStr + " " + k + '="' + i[k] + '"'; });
  return oStr;
}

function _getUrl(ciphertext, md5, version) {
  version = version || __.resourceVersion || "";
  const d = (t) => [t.substring(0, 2), t.substring(4, 6)];
  const h = (t) => [t.substring(2, 4), t.substring(6, 8), t.substring(0, 2)];
  const p = (t) => [t.substring(4, 6), t.substring(0, 2), t.substring(6, 8), t.substring(2, 4)];
  const _f = (t) => [t.substring(6, 8), t.substring(2, 4), t.substring(4, 6), t.substring(0, 2)];
  const f = { 0: d, 1: d, 2: d, 3: d, 4: h, 5: h, 6: h, 7: h, 8: p, 9: p, a: p, b: p, c: _f, d: _f, e: _f, f: _f };
  function g(t) {
    if (t[0] === ".") return "";
    return f[t[0]](t).join("/");
  }
  const e = CryptoJS.MD5(ciphertext).toString(CryptoJS.enc.Hex);
  const dot = ciphertext.lastIndexOf(".");
  const i = dot >= 0 ? ciphertext.slice(0, dot) : ciphertext;
  const a = g(CryptoJS.MD5(i).toString(CryptoJS.enc.Hex));
  const n = md5 + "." + (ciphertext.split(".")[1] || "png");
  return `https://minasigo-no-shigoto-pd-c-res.orphans-order.com/${version}/${e}/${a}/${n}`;
}

async function readStory(params = {}) {
  const certDir = _certDir();
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync(path.join(certDir, "cert.pem")),
    key: fs.readFileSync(path.join(certDir, "key.pem")),
    passphrase: "",
  });
  const url = "https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/story/readStory";
  let body = typeof params === "string" ? params : JSON.stringify(params);
  if (params && typeof params === "object" && "storyId" in params && "episodeId" in params && params.storyId != null && params.episodeId != null) {
    const combined = String(params.storyId) + String(params.episodeId);
    body = JSON.stringify({ storyId: parseInt(combined, 10), quality: 3 });
  }
  try {
    const { data: raw } = await axios.post(url, { data: encrypt(body, _.token) }, {
      httpsAgent,
      headers: {
        accept: "application/json;charset=UTF-8",
        authorization: getAuthorization("POST", url),
        "content-type": "application/json;charset=UTF-8",
        "x-mnsg-app-version": JSON.stringify(__),
        origin: "https://minasigo-no-shigoto-pd-r-client.orphans-order.com",
        referer: "https://minasigo-no-shigoto-pd-r-client.orphans-order.com/",
      },
    });
    const ciphertext = raw?.data != null ? raw.data : (typeof raw === "string" ? raw : null);
    if (!ciphertext) return { err: "readStory response empty or invalid", status: 0 };
    const parsed = JSON.parse(decrypt(ciphertext, _.token));
    if (parsed?.err != null || parsed?.status != null) return { err: parsed.err, status: parsed.status };
    return parsed;
  } catch (e) {
    return { err: e.message, status: e.response?.status };
  }
}

async function fetchStoryResourcePath(relativePath) {
  const certDir = _certDir();
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync(path.join(certDir, "cert.pem")),
    key: fs.readFileSync(path.join(certDir, "key.pem")),
    passphrase: "",
  });
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(relativePath);
  const body = isImage ? `{"path":"${relativePath}","quality":3}` : `{"path":"${relativePath}","quality":0}`;
  const getStoryResourceUrl = "https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/story/getStoryResource";
  try {
    const { data } = await axios.post(getStoryResourceUrl, { data: encrypt(body, _.token) }, {
      httpsAgent,
      headers: {
        accept: "application/json;charset=UTF-8",
        authorization: getAuthorization("POST", getStoryResourceUrl),
        "content-type": "application/json;charset=UTF-8",
        "x-mnsg-app-version": JSON.stringify(__),
        origin: "https://minasigo-no-shigoto-pd-r-client.orphans-order.com",
        referer: "https://minasigo-no-shigoto-pd-r-client.orphans-order.com/",
      },
    });
    const parsed = JSON.parse(decrypt(data, _.token));
    const first = parsed?.resources?.[0];
    if (first) return { path: first.path, md5: first.md5 };
    return { err: parsed?.err, status: parsed?.status };
  } catch (e) {
    return { err: e.message, status: e.response?.status };
  }
}

// ---------- 场景拉取逻辑 ----------

const RESULT_PATH = path.join(__dirname, "result.json");
const EPISODE_STORY_PREFIX = "image/episode/story/";
const OUTPUT_ROOT = path.join(__dirname, "output");

function parseResourcePath(id) {
  const s = String(id).trim();
  if (!s || !/^\d+$/.test(s)) return null;
  if (s.length === 9) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  if (s.length === 10) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  if (s.length >= 6) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  return null;
}

function getScenesFromManifest(manifest) {
  const assets = Object.keys(manifest.assets || {});
  const list = assets
    .filter((p) => p.startsWith(EPISODE_STORY_PREFIX))
    .map((p) => {
      const id = p.slice(EPISODE_STORY_PREFIX.length).replace(/\.png$/i, "");
      const parsed = parseResourcePath(id);
      return parsed ? { ...parsed, sceneId: id } : null;
    })
    .filter((x) => x && x.storyId);
  const seen = new Set();
  return list.filter((x) => {
    if (seen.has(x.sceneId)) return false;
    seen.add(x.sceneId);
    return true;
  });
}

function getUrl(r) {
  const p = (r.path || "").replace(/^\//, "");
  return _getUrl(p, r.md5);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const flags = { cg: true, story: true, voice: true };
  for (const a of argv) {
    if (a === "--cg") flags.cg = true;
    else if (a === "--story") flags.story = true;
    else if (a === "--voice") flags.voice = true;
  }
  return flags;
}

async function downloadTo(url, filepath, asText = true) {
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
          const buf = Buffer.concat(chunks);
          fs.writeFileSync(filepath, asText ? buf.toString("utf8") : buf);
          resolve();
        });
      })
      .on("error", reject);
  });
}

/** 从剧本正文中解析出所有引用的资源路径：adv/image/... 与 adv/sound/...（去重，归一化去掉首斜杠） */
function extractAllResourcePathsFromStoryText(text) {
  const imagePaths = new Set();
  const soundPaths = new Set();
  const re = /\/?(adv\/(?:image|sound)\/[^\s,\r\n]+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const p = m[1].replace(/^\//, "").trim();
    if (!p) continue;
    if (p.startsWith("adv/image/")) imagePaths.add(p);
    else if (p.startsWith("adv/sound/")) soundPaths.add(p);
  }
  return { imagePaths: [...imagePaths], soundPaths: [...soundPaths] };
}

/** 根据请求 path 与接口返回 path 得到该资源在场景目录下的完整保存路径；角色图扁平到 image/character/<id>_<文件名> */
function getOutputFileForResource(sceneId, requestPath, responsePath) {
  const rel = (requestPath || "").replace(/^\//, "").replace(/^adv\//, "");
  if (!rel) return null;
  const nameFromResponse = (responsePath && path.basename(responsePath)) || path.basename(rel) || "file";
  const charMatch = rel.match(/^image\/character\/(\d+)\/(?:image|atlas)\/(.+)$/i);
  if (charMatch) {
    const dir = path.join(OUTPUT_ROOT, sceneId, "image", "character");
    const name = charMatch[1] + "_" + nameFromResponse;
    return path.join(dir, name);
  }
  const dir = path.join(OUTPUT_ROOT, sceneId, path.dirname(rel));
  return path.join(dir, nameFromResponse);
}

/** 检查该请求 path 对应的资源是否已存在（可能已用接口返回的带扩展名文件名保存） */
function resourceAlreadyDownloaded(sceneId, requestPath) {
  const rel = (requestPath || "").replace(/^\//, "").replace(/^adv\//, "");
  if (!rel) return false;
  const base = path.basename(rel);
  const charMatch = rel.match(/^image\/character\/(\d+)\/(?:image|atlas)\/(.+)$/i);
  const dir = charMatch
    ? path.join(OUTPUT_ROOT, sceneId, "image", "character")
    : path.join(OUTPUT_ROOT, sceneId, path.dirname(rel));
  const baseNoExt = base.replace(/\.[^.]+$/, "") || base;
  const prefix = charMatch ? charMatch[1] + "_" + baseNoExt : base;
  if (!fs.existsSync(dir)) return false;
  try {
    const files = fs.readdirSync(dir);
    return files.some((f) => f === prefix || f.startsWith(prefix + "."));
  } catch (_) {
    return false;
  }
}

/** 拉取一个 scene：先下剧本，再根据剧本里引用的 path 拉取图片和语音（保证剧本里写的都能下到） */
async function pullOneScene({ storyId, episodeId, sceneId }, opts) {
  let storyCount = 0,
    cgCount = 0,
    voiceCount = 0;
  let storyTxtContent = null;

  try {
    const res = await readStory({ storyId, episodeId });
    if (!res || !Array.isArray(res.resources)) return { storyCount, cgCount, voiceCount };
    const resources = res.resources;

    const sceneDir = path.join(OUTPUT_ROOT, sceneId);
    fs.mkdirSync(sceneDir, { recursive: true });
    if (opts.story) {
      const storyTxts = resources.filter(
        (r) =>
          (r.path || "").includes("textfiles/story") &&
          (r.path || "").endsWith(".txt")
      );
      const storyFile = path.join(sceneDir, sceneId + ".txt");
      for (const r of storyTxts) {
        if (!fs.existsSync(storyFile)) {
          await downloadTo(getUrl(r), storyFile, true);
        }
        storyCount++;
        try {
          storyTxtContent = fs.readFileSync(storyFile, "utf8");
        } catch (_) {}
      }
    }

    if (!storyTxtContent) {
      return { storyCount, cgCount, voiceCount };
    }

    // 与获取图片一致：优先从 readStory 的 resources 拿 path+md5，直接用 getUrl 下载（不调 getStoryResource）
    const imageResources = (resources || []).filter(
      (r) => (r.path || "").includes("image/") && /\.(jpg|jpeg|png|gif|webp)$/i.test(r.path || "")
    );
    const voiceResources = (resources || []).filter(
      (r) => (r.path || "").includes("sound/voice") && /\.mp3$/i.test(r.path || "")
    );
    if (opts.cg && imageResources.length) {
      for (const r of imageResources) {
        const norm = (r.path || "").replace(/^\//, "");
        if (resourceAlreadyDownloaded(sceneId, norm)) {
          cgCount++;
          continue;
        }
        const outPath = getOutputFileForResource(sceneId, norm, r.path);
        if (outPath) {
          try {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            await downloadTo(getUrl(r), outPath, false);
            cgCount++;
          } catch (_) {}
        }
      }
    }
    if (opts.voice && voiceResources.length) {
      const dirVoice = path.join(sceneDir, "sound", "voice");
      fs.mkdirSync(dirVoice, { recursive: true });
      for (const r of voiceResources) {
        const p = (r.path || "").replace(/^\//, "");
        const name = path.basename(p);
        const filepath = path.join(dirVoice, name);
        if (fs.existsSync(filepath)) {
          voiceCount++;
          continue;
        }
        try {
          await downloadTo(getUrl(r), filepath, false);
          voiceCount++;
        } catch (_) {}
      }
    }

    const { imagePaths, soundPaths } = extractAllResourcePathsFromStoryText(storyTxtContent);
    const voicePaths = soundPaths.filter((p) => /adv\/sound\/voice\//i.test(p));

    if (opts.cg) {
      for (const rel of imagePaths) {
        const norm = rel.replace(/^\//, "");
        if (resourceAlreadyDownloaded(sceneId, norm)) {
          cgCount++;
          continue;
        }
        try {
          const info = await fetchStoryResourcePath(norm);
          if (info && info.path) {
            const outPath = getOutputFileForResource(sceneId, norm, info.path);
            if (outPath) {
              fs.mkdirSync(path.dirname(outPath), { recursive: true });
              await downloadTo(_getUrl(info.path, info.md5), outPath, false);
              cgCount++;
            }
          }
        } catch (_) {}
      }
    }

    if (opts.voice) {
      for (const rel of voicePaths) {
        const norm = rel.replace(/^\//, "");
        if (resourceAlreadyDownloaded(sceneId, norm)) {
          voiceCount++;
          continue;
        }
        try {
          const info = await fetchStoryResourcePath(norm);
          if (info && info.path) {
            const outPath = getOutputFileForResource(sceneId, norm, info.path);
            if (outPath) {
              fs.mkdirSync(path.dirname(outPath), { recursive: true });
              await downloadTo(_getUrl(info.path, info.md5), outPath, false);
              voiceCount++;
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return { storyCount, cgCount, voiceCount };
}

async function main() {
  const opts = parseArgs();
  let scenes = [];
  const sceneIdArg = process.argv.find((a) => /^\d{6,}$/.test(a));
  if (sceneIdArg) {
    const parsed = parseResourcePath(sceneIdArg);
    if (parsed) scenes = [{ ...parsed, sceneId: sceneIdArg }];
    else scenes = [];
    console.log("[scene] 指定场景:", sceneIdArg, "\n");
  } else {
    if (!fs.existsSync(RESULT_PATH)) {
      console.error("需要 result.json，请先执行: npm start");
      process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8"));
    scenes = getScenesFromManifest(manifest);
  }

  const limit = parseInt(process.env.SCENE_LIMIT || "0", 10);
  const randomLimit = parseInt(process.env.SCENE_RANDOM || "0", 10);
  if (!sceneIdArg && limit > 0) {
    scenes = scenes.slice(0, limit);
    console.log("[scene] 限制为前", limit, "个（SCENE_LIMIT=0 不限制）");
  } else if (!sceneIdArg && randomLimit > 0) {
    for (let i = scenes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
    }
    scenes = scenes.slice(0, randomLimit);
    console.log("[scene] 随机抽取", randomLimit, "个场景");
  }
  console.log("[scene] 只拉取有 story 的 scene，共", scenes.length, "个\n");

  let totalStory = 0,
    totalCg = 0,
    totalVoice = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    process.stdout.write("[" + (i + 1) + "/" + scenes.length + "] " + s.sceneId + " ... ");
    const { storyCount, cgCount, voiceCount } = await pullOneScene(s, opts);
    totalStory += storyCount;
    totalCg += cgCount;
    totalVoice += voiceCount;
    console.log("story:" + storyCount + " cg:" + cgCount + " voice:" + voiceCount);
  }

  fs.writeFileSync(
    path.join(OUTPUT_ROOT, "README.txt"),
    `output/ 按场景分文件夹，每个场景内按路径分类
============================================
<sceneId>/
  <sceneId>.txt                剧本（如 121650112.txt）
  image/
    bg/                        ...背景图
    character/                 ...角色图扁平为 <id>_<文件名>（如 216501_201.jpg）
  sound/
    voice/                     ...语音 mp3
资源来自剧本中解析的 adv/image/...、adv/sound/voice/... 等 path。
`,
    "utf8"
  );

  console.log("\n全部完成。输出目录:", OUTPUT_ROOT);
  console.log("  合计 story:", totalStory, " cg:", totalCg, " voice:", totalVoice);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
