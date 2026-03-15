/**
 * Fetch manifest and export lists (no auth). Does not depend on index.js.
 * 1. getVersion -> fetch resource.json from CDN -> decrypt -> write result.json
 * 2. From manifest: export audio.json, script.json ({ data: [ { name, url } ] }) using CDN URLs.
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

function _getMd5(manifest, assetPath) {
  const a = manifest.assets[assetPath];
  return a?.["0"]?.md5 ?? a?.["3"]?.md5 ?? a?.["1"]?.md5;
}

function _getUrl(ciphertext, md5, version) {
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

async function getResource() {
  const versionResponse = await axios.get("https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/user/getVersion");
  if (!versionResponse.data?.version?.resourceVersion) {
    throw new Error("getVersion returned no resourceVersion");
  }
  const version = versionResponse.data.version.resourceVersion;
  const resourceResponse = await axios.get(`https://minasigo-no-shigoto-pd-c-res.orphans-order.com/${version}/resource.json`);
  const decrypted = _decrypt(resourceResponse.data);
  fs.writeFileSync(RESULT_PATH, decrypted, "utf8");
  return { result: decrypted, version };
}

async function main() {
  console.log("Fetching getVersion...");
  const { result, version } = await getResource();
  console.log("Wrote result.json, version:", version);

  const manifest = JSON.parse(result);
  const assetPaths = Object.keys(manifest.assets || {});
  const audioPaths = assetPaths.filter((p) => /\.(mp3|ogg|wav|m4a)$/i.test(p));
  const scriptPaths = assetPaths.filter((p) => /\.(json|txt|xml|scenario|ini)$/i.test(p));

  const audioList = audioPaths.map((p) => ({
    name: p.replace(/\//g, "_"),
    url: _getUrl(p, _getMd5(manifest, p), version),
  }));
  const scriptList = scriptPaths.map((p) => ({
    name: p.replace(/\//g, "_"),
    url: _getUrl(p, _getMd5(manifest, p), version),
  }));

  fs.writeFileSync(path.join(ROOT, "audio.json"), JSON.stringify({ data: audioList }, null, 2), "utf8");
  fs.writeFileSync(path.join(ROOT, "script.json"), JSON.stringify({ data: scriptList }, null, 2), "utf8");
  console.log("Exported audio.json (%d), script.json (%d)", audioList.length, scriptList.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
