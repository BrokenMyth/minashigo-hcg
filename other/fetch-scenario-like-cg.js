/**
 * 按 cg.json 的获取原理逆向剧本：与 CG 同接口 getStoryResource、同 path 结构猜想。
 * CG path: adv/image/character/{id}/image/{i}0{j}.jpg
 * 剧本 path 猜想：adv/scenario/character/{id}/{episode}.json 或 adv/script/character/{id}/{episode}.json 等
 * 用法: node fetch-scenario-like-cg.js [characterId]
 * 示例: node fetch-scenario-like-cg.js 208803
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

async function main() {
  const resultPath = path.join(__dirname, "result.json");
  if (!fs.existsSync(resultPath)) {
    console.error("需要 result.json，请先 npm start");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  const stand_resource = manifest;
  const standImages = Object.keys(stand_resource.assets || {}).filter(
    (a) => a.includes("image/character/stand") && a.includes("3.png")
  );
  const ids = standImages.map((a) => a.split("/").at(-1).replace("03.png", ""));
  const charId = process.argv[2] || "208803";
  const tryIds = charId ? [charId] : ids.filter((id) => (id + "").length === 6).slice(0, 3);

  const mod = require("./index.js");
  if (!mod.fetchStoryResourcePath || !mod._getUrl) {
    console.error("index.js 未导出 fetchStoryResourcePath/_getUrl");
    process.exit(1);
  }
  const version = (mod.__version && mod.__version.resourceVersion) || manifest.version || "2.7.020";

  // 与 CG 完全同结构的 path 猜想（CG: adv/image/character/{id}/image/{i}0{j}.jpg）
  const episodeList = ["001", "002", "003", "101", "102", "103", "011", "012"];
  const pathTemplates = [
    (id, ep) => `adv/image/character/${id}/image/${ep}.json`,
    (id, ep) => `adv/image/character/${id}/script/${ep}.json`,
    (id, ep) => `adv/image/character/${id}/scenario/${ep}.json`,
    (id, ep) => `adv/scenario/character/${id}/${ep}.json`,
    (id, ep) => `adv/script/character/${id}/${ep}.json`,
    (id, ep) => `adv/text/character/${id}/${ep}.json`,
    (id, ep) => `adv/scenario/character/${id}/image/${ep}.json`,
    (id, ep) => `adv/image/character/${id}/data/${ep}.json`,
    (id, ep) => `adv/story/character/${id}/${ep}.json`,
    (id, ep) => `adv/scenario/${id}_${ep}.json`,
    (id, ep) => `adv/script/${id}_${ep}.json`,
  ];

  const scenarioList = [];
  let foundPattern = null;

  for (const id of tryIds) {
    for (const ep of episodeList) {
      for (const tpl of pathTemplates) {
        const p = tpl(id, ep);
        const info = await mod.fetchStoryResourcePath(p);
        if (info && info.path && info.md5) {
          const url = mod._getUrl(info.path, info.md5, version);
          scenarioList.push({ name: `${id}_${ep}_${path.basename(p)}`, url, path: info.path });
          if (!foundPattern) foundPattern = tpl;
          console.log("OK", p, "->", url.slice(0, 60) + "...");
        }
      }
    }
  }

  if (scenarioList.length) {
    const outPath = path.join(__dirname, "scenario.json");
    fs.writeFileSync(outPath, JSON.stringify({ data: scenarioList }, null, 2), "utf8");
    console.log("\n已写入", scenarioList.length, "条到", outPath);
    if (foundPattern) console.log("有效 path 示例:", foundPattern("208803", "002"));
  } else {
    console.log("未命中任何剧本 path。已尝试:", pathTemplates.length, "种模板 x", episodeList.length, "集 x", tryIds.length, "个角色");
    console.log("逆向结论: getStoryResource 的 story master 很可能只登记了 CG 图片 path，剧本可能走其他接口或仅在包内。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
