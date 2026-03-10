/**
 * 试探调用 readStory 接口，尝试常见参数格式。
 * 用法: node call-readStory.js [storyId] [episodeId]
 * 示例: node call-readStory.js 208803 103
 */

const fs = require("fs");
const path = require("path");

async function main() {
  const storyId = process.argv[2] || "208803";
  const episodeId = process.argv[3] || "103";
  let mod;
  try {
    mod = require("./index.js");
  } catch (e) {
    console.error("需要 index.js 且具备 cert/token，", e.message);
    process.exit(1);
  }
  if (!mod.readStory) {
    console.error("index.js 未导出 readStory");
    process.exit(1);
  }

  const candidates = [
    { storyId, episodeId },
    { story_id: storyId, episode_id: episodeId },
    { storyId: storyId + "_" + episodeId },
    { path: `adv/scenario/${storyId}_${episodeId}.json` },
    { storyMasterId: storyId, episodeNo: episodeId },
  ];

  console.log("readStory 接口试探，storyId=%s episodeId=%s\n", storyId, episodeId);
  for (const params of candidates) {
    process.stdout.write(JSON.stringify(params) + " -> ");
    const res = await mod.readStory(params);
    if (res && (res.err || res.status)) {
      console.log("err:", res.err || res.status, "status:", res.status);
    } else if (res && typeof res === "object") {
      console.log("OK, keys:", Object.keys(res).slice(0, 10).join(", "));
      const out = path.join(__dirname, "readStory_sample.json");
      fs.writeFileSync(out, JSON.stringify(res, null, 2), "utf8");
      console.log("  已保存到", out);
      break;
    } else {
      console.log("res:", typeof res, res);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
