/**
 * 批量拉取剧本：对多组 storyId/episodeId 调 readStory，成功的就下载 txt 到 story_txt/
 * 用法:
 *   node batch-pull-stories.js [数量]
 *   默认试前 20 条（从 list-story-ids 顺序）；也可传数量如 30
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const mod = require("./index.js");

const OUT_DIR = path.join(__dirname, "story_txt");
const RESULT_PATH = path.join(__dirname, "result.json");
const PREFIX = "image/episode/story/";

function parseResourcePath(id) {
  const s = String(id).trim();
  if (!s || !/^\d+$/.test(s)) return null;
  if (s.length === 9) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  if (s.length === 10) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  if (s.length >= 6) return { storyId: s.slice(0, 6), episodeId: s.slice(6) };
  return null;
}

function getIdsFromManifest(max) {
  if (!fs.existsSync(RESULT_PATH)) return [];
  const manifest = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8"));
  const assets = Object.keys(manifest.assets || {});
  const list = assets
    .filter((p) => p.startsWith(PREFIX))
    .map((p) => {
      const id = p.slice(PREFIX.length).replace(/\.png$/i, "");
      return parseResourcePath(id);
    })
    .filter((x) => x && x.storyId);
  const seen = new Set();
  const uniq = list.filter((x) => {
    const k = x.storyId + "_" + x.episodeId;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.slice(0, max || 20);
}

function getUrl(r) {
  const p = (r.path || "").replace(/^\//, "");
  return mod._getUrl(p, r.md5);
}

async function downloadOne(res, outDir) {
  const storyTxts = (res.resources || []).filter(
    (r) => (r.path || "").includes("textfiles/story") && (r.path || "").endsWith(".txt")
  );
  for (const r of storyTxts) {
    const name = path.basename(r.path || r.resourcePath + ".txt");
    const filepath = path.join(outDir, name);
    const url = getUrl(r);
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
  return storyTxts.length;
}

async function main() {
  const limit = parseInt(process.argv[2], 10) || 20;
  const ids = getIdsFromManifest(limit);
  if (ids.length === 0) {
    console.error("需要 result.json，请先 npm start");
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("批量拉取剧本，共", ids.length, "组 ID\n");
  const results = { ok: [], fail: [] };

  for (const { storyId, episodeId } of ids) {
    process.stdout.write(storyId + "/" + episodeId + " ... ");
    try {
      const res = await mod.readStory({ storyId, episodeId });
      if (res && Array.isArray(res.resources) && res.resources.length) {
        const n = await downloadOne(res, OUT_DIR);
        console.log("OK (resources:", res.resources.length, ", 剧本:", n, ")");
        results.ok.push({ storyId, episodeId, resources: res.resources.length, txt: n });
      } else {
        const err = (res && res.err) || "no resources";
        const status = (res && res.status) != null ? res.status : "-";
        console.log("FAIL", status, err);
        results.fail.push({ storyId, episodeId, err, status });
      }
    } catch (e) {
      console.log("ERROR", e.message || e);
      results.fail.push({ storyId, episodeId, err: e.message || String(e) });
    }
  }

  console.log("\n--- 汇总 ---");
  console.log("成功:", results.ok.length, "话");
  console.log("失败:", results.fail.length, "话");
  if (results.ok.length) {
    console.log("已保存到", OUT_DIR);
    results.ok.forEach((x) => console.log("  ", x.storyId + "/" + x.episodeId));
  }
  fs.writeFileSync(
    path.join(__dirname, "batch-pull-result.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log("\n详细结果已写入 batch-pull-result.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
