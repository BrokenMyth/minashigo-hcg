/**
 * Request getUserData API, decrypt response, save to JSON.
 * Uses config.json (token) and cert.pem/key.pem. Depends on index.js for encrypt/decrypt/auth.
 * Usage: node fetch-user-data.js [output.json]
 * Default output: user-data.json
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const axios = require("axios");

const ROOT = __dirname;
const DEFAULT_OUT = path.join(ROOT, "user-data.json");

function certDir() {
  const d = ROOT;
  if (fs.existsSync(path.join(d, "cert.pem"))) return d;
  const parent = path.join(d, "..");
  if (fs.existsSync(path.join(parent, "cert.pem"))) return parent;
  return d;
}

function loadToken() {
  const cfgPath = path.join(ROOT, "config.json");
  if (!fs.existsSync(cfgPath)) throw new Error("config.json not found");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const t = cfg.token;
  if (!t) throw new Error("config.json has no token");
  const token = t.token || t.oauth_token || "";
  if (!token) throw new Error("config.token has no token/oauth_token");
  return token;
}

async function main() {
  const outPath = process.argv[2] || DEFAULT_OUT;

  const mod = require("./index.js");
  const token = loadToken();
  const certDirPath = certDir();
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync(path.join(certDirPath, "cert.pem")),
    key: fs.readFileSync(path.join(certDirPath, "key.pem")),
    passphrase: "",
  });

  const url = "https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/story/getUserData";
  const bodyPlain = "{}";
  const bodyEncrypted = mod.encrypt(bodyPlain, token);

  const { data: raw } = await axios.post(
    url,
    { data: bodyEncrypted },
    {
      httpsAgent,
      headers: {
        accept: "application/json;charset=UTF-8",
        authorization: mod.getAuthorization("POST", url),
        "content-type": "application/json;charset=UTF-8",
        "x-mnsg-app-version": JSON.stringify(mod.__version),
        origin: "https://minasigo-no-shigoto-pd-r-client.orphans-order.com",
        referer: "https://minasigo-no-shigoto-pd-r-client.orphans-order.com/",
      },
    }
  );

  const ciphertext = raw?.data != null ? raw.data : (typeof raw === "string" ? raw : null);
  if (!ciphertext) {
    throw new Error("getUserData response empty or no data field");
  }

  const plain = mod.decrypt(ciphertext, token);
  let data;
  try {
    data = JSON.parse(plain);
  } catch (_) {
    data = { raw: plain };
  }

  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log("Saved to", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
