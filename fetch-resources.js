/**
 * 按场景拉取：先下剧本，再根据剧本里引用的 path 拉取图片和语音；每个场景一个文件夹，按路径分类。
 * 输出：output/<sceneId>/<sceneId>.txt，output/<sceneId>/image/bg/...，output/<sceneId>/image/character/<id>_<文件名>，output/<sceneId>/sound/voice/...
 * 用法: node fetch-resources.js [--cg] [--story] [--voice]
 * 环境变量: SCENE_LIMIT=N  只拉前 N 个；SCENE_RANDOM=N  随机拉 N 个
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const mod = require("./index.js");

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
  return mod._getUrl(p, r.md5);
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
    const res = await mod.readStory({ storyId, episodeId });
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
          const info = await mod.fetchStoryResourcePath(norm);
          if (info && info.path) {
            const outPath = getOutputFileForResource(sceneId, norm, info.path);
            if (outPath) {
              fs.mkdirSync(path.dirname(outPath), { recursive: true });
              await downloadTo(mod._getUrl(info.path, info.md5), outPath, false);
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
          const info = await mod.fetchStoryResourcePath(norm);
          if (info && info.path) {
            const outPath = getOutputFileForResource(sceneId, norm, info.path);
            if (outPath) {
              fs.mkdirSync(path.dirname(outPath), { recursive: true });
              await downloadTo(mod._getUrl(info.path, info.md5), outPath, false);
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
