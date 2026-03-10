/**
 * 调试 OAuth 签名：打印 getAuthorization 用的 URL 和参数，便于对比 readStory vs getStoryResource
 */
const path = require("path");
const mod = require("../index.js");

const url1 = "https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/story/readStory";
const url2 = "https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/story/getStoryResource";

// 直接调用 getAuthorization 会每次生成新 nonce/timestamp，所以只打印 normalized URL
const o = require("url");
function _normalizeUrl(t) {
  const e = o.parse(t, true);
  delete e.query;
  delete e.search;
  return o.format(e);
}
console.log("readStory     normalized:", _normalizeUrl(url1));
console.log("getStoryRes  normalized:", _normalizeUrl(url2));
console.log("一致?", _normalizeUrl(url1) === _normalizeUrl(url2));

// 试一次 getAuthorization 看 header 格式（不发给服务器）
const auth1 = mod.getAuthorization("POST", url1);
const auth2 = mod.getAuthorization("POST", url2);
console.log("\nreadStory    Authorization 前 80 字符:", auth1.substring(0, 80) + "...");
console.log("getStoryRes Authorization 前 80 字符:", auth2.substring(0, 80) + "...");
console.log("\n两者 realm 与 oauth_token 一致?", auth1.includes('realm="Users"') && auth2.includes('realm="Users"'));
console.log("oauth_token 相同?", (auth1.match(/oauth_token="([^"]+)/) || [])[1] === (auth2.match(/oauth_token="([^"]+)/) || [])[1]);
