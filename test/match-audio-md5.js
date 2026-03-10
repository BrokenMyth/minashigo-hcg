/**
 * 对 122810112 剧本里的音频 path 做 MD5，看是否与给定 MD5 一致
 * 用法: node test/match-audio-md5.js [md5]
 */
const fs = require("fs");
const path = require("path");
const CryptoJS = require("crypto-js");

const scriptPath = path.join(__dirname, "../output/122810112/122810112.txt");
const targetMd5 = process.argv[2] || "9dc46fff9266d8e4cc3d36ab29e6c1b3";

const text = fs.readFileSync(scriptPath, "utf8");
const soundPaths = new Set();
const re = /\/?(adv\/(?:image|sound)\/[^\s,\r\n]+)/gi;
let m;
while ((m = re.exec(text)) !== null) {
  const p = m[1].replace(/^\//, "").trim();
  if (p && p.includes("sound/")) soundPaths.add(p);
}
const list = [...soundPaths];

function variants(p) {
  const noLead = p.replace(/^\//, "");
  const noAdv = noLead.replace(/^adv\//, "");
  const list = [p, noLead, noAdv, "adv/" + noAdv];
  if (noAdv && noAdv.startsWith("sound/")) list.push(noAdv);
  if (noAdv && noAdv.includes("voice/adu")) list.push("sound/voice/adu/" + noAdv.split("/").pop());
  return [...new Set(list)].filter(Boolean);
}

let found = null;
for (const p of list) {
  for (const v of variants(p)) {
    if (!v) continue;
    const md5 = CryptoJS.MD5(v).toString(CryptoJS.enc.Hex);
    if (md5 === targetMd5) {
      found = v;
      break;
    }
  }
  if (found) break;
}

console.log("122810112 中音频相关 path 数量:", list.length);
console.log("目标 MD5:", targetMd5);
console.log("匹配到的 path:", found || "(无)");
if (!found) {
  console.log("\n已尝试的 path 变体数量:", list.length * 5, "左右，均无匹配");
  console.log("示例（前 3 个 path 各变体 MD5）:");
  list.slice(0, 3).forEach((p) => {
    variants(p).forEach((v) => {
      if (!v) return;
      console.log("  ", v, "=>", CryptoJS.MD5(v).toString(CryptoJS.enc.Hex));
    });
  });
}
