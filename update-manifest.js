/**
 * Fetch manifest only (no auth). Does not depend on index.js.
 * getVersion -> fetch resource.json from CDN -> decrypt -> write result.json
 * Usage: node update-manifest.js
 */

const fs = require("fs");
const path = require("path");
const CryptoJS = require("crypto-js");
const axios = require("axios");

const ROOT = __dirname;
const RESULT_PATH = path.join(ROOT, "result.json");

function _decrypt(t) {
  const e = CryptoJS.SHA256("#mnsg#manifest");
  const i = CryptoJS.enc.Base64.stringify(e).substr(0, 32);
  const n = { iv: "BFA4332ECFDCB3D1DA2633B5AB509094", mode: CryptoJS.mode.CTR };
  const o = CryptoJS.AES.decrypt(t, i, n);
  return CryptoJS.enc.Utf8.stringify(o);
}

async function getResource() {
  const versionResponse = await axios.get("https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/user/getVersion");
  if (!versionResponse.data?.version?.resourceVersion) {
    throw new Error("getVersion returned no resourceVersion");
  }
  const version = versionResponse.data.version.resourceVersion;
  const resourceResponse = await axios.get(`https://minasigo-no-shigoto-pd-c-res.orphans-order.com/${version}/resource.json`);
  const decrypted = _decrypt(resourceResponse.data);
  fs.writeFileSync(RESULT_PATH, decrypted, "utf8");
  return { version };
}

async function main() {
  console.log("Fetching getVersion...");
  const { version } = await getResource();
  console.log("Wrote result.json, version:", version);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
