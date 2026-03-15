/**
 * Decrypt request body (e.g. readStory "data" field) using token from config.json.
 * Usage: node decrypt-body.js "<base64_ciphertext>"
 * Example: node decrypt-body.js "U2FsdGVkX19c87iG..."
 */

const path = require("path");
const fs = require("fs");

const CONFIG_PATH = path.join(__dirname, "config.json");

function loadToken() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error("config.json not found");
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const t = cfg.token;
  if (!t) throw new Error("config.json has no token");
  const token = t.token || t.oauth_token || "";
  if (!token) throw new Error("config.token has no token/oauth_token");
  return token;
}

function main() {
  const ciphertext = process.argv[2];
  if (!ciphertext || ciphertext.trim() === "") {
    console.error("Usage: node decrypt-body.js \"<base64_ciphertext>\"");
    process.exit(1);
  }

  let token;
  try {
    token = loadToken();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const CryptoJS = require("crypto-js");
  const decrypt = (t, e) => {
    const i = CryptoJS.SHA256(e + "one-deep");
    const n = i.toString(CryptoJS.enc.Base64).substr(0, 32);
    const iv = CryptoJS.SHA256(e.substr(0, 16)).toString(CryptoJS.enc.Base64).substr(0, 16);
    return CryptoJS.AES.decrypt(t, n, { iv, mode: CryptoJS.mode.CTR }).toString(CryptoJS.enc.Utf8);
  };

  try {
    const plain = decrypt(ciphertext.trim(), token);
    console.log(plain);
  } catch (e) {
    console.error("Decrypt failed:", e.message);
    process.exit(1);
  }
}

main();
