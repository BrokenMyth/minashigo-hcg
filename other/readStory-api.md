# readStory 接口分析

## 基本信息

- **URL**: `https://minasigo-no-shigoto-web-r-server.orphans-order.com/mnsg/story/readStory`
- **方法**: POST
- **认证**: 与 `getStoryResource` 相同（TLS 客户端证书 cert.pem/key.pem + OAuth token，见 index.js）

## 请求格式

- **Content-Type**: `application/json;charset=UTF-8`
- **Body**: `{ "data": "<AES-CTR 加密的 JSON 字符串>" }`  
  加密方式与 getStoryResource 一致：明文为 **JSON 字符串**，用 `encrypt(plainJson, _.token)` 得到密文。
- **明文参数**（服务端实际接受格式）: `{ "storyId": 123340111, "quality": 3 }`
  - **storyId** 为**整段 resourcePath 数字**（即 storyId 6 位 + episodeId 3 位拼成，如 123340111），**不是**两个字段。
  - **quality** 建议为 3。
  - 项目内 `readStory({ storyId, episodeId })` 已自动转换为上述格式，调用方仍可传 `{ storyId: "123340", episodeId: "111" }`。
  - 使用 `story_id` / `episode_id` 或错误格式会返回 **10001 read story invalid parameter**。

## 响应（实测）

- 响应体为**加密字符串**（有时是裸字符串，有时在 `{ "data": "..." }` 里），需用 `decrypt(加密串, token)` 解密。
- 解密后为 JSON：**`{ "resources": [ { "path", "md5", "quality", "resourcePath", ... } ] }`**
  - **resources**：该剧情下的所有资源列表，包含：
    - **剧本文本**：`path: "adv/textfiles/story/<resourcePath>.txt"`（即剧本文件）
    - 背景图、BGM、语音、立绘、CG 等：`adv/image/...`、`adv/sound/...` 等
  - 用 `_getUrl(path, md5)` 可拼出 CDN 地址下载（剧本 txt 与 getStoryResource 同 CDN 规则）。

## 与 getStoryResource 的区别

| 项目       | getStoryResource              | readStory                    |
|------------|-------------------------------|------------------------------|
| 作用       | 按**单个** path 取资源 path+md5 | 按 **storyId+episodeId** 一次取**整段剧情**全部资源 |
| 请求体明文 | `{ "path": "adv/...", "quality": 0 }` | `{ "storyId": "xxx", "episodeId": "yyy" }` |
| 成功返回   | resources[0].path + md5        | resources[] 数组（含剧本 txt、图、语音等） |
| 剧本 path  | 无                            | **adv/textfiles/story/<id>.txt** |

## 项目中用法

- **调用**: `const mod = require("./index.js"); const res = await mod.readStory({ storyId: "208803", episodeId: "103" });`
- **试探脚本**: `node call-readStory.js 208803 103`  
  会尝试多种参数格式并打印解密后的 err/status 或成功时的 keys。

## 错误码（实测）

| status | 含义 |
|--------|------|
| 10001 | read story invalid parameter（参数名或格式错误） |
| 10004 | not match condition（该话未解锁/不满足条件） |
| 10011 | story master not found（服务端无此剧情或 ID 不存在） |

## 结论

- readStory 是 **按剧情 ID 读剧本** 的接口；请求体明文为 **`{ "storyId": resourcePath数字, "quality": 3 }`**，项目内对 `{ storyId, episodeId }` 已做自动转换。
- 成功时返回 `resources[]`，内含 `adv/textfiles/story/<id>.txt` 及该话的图/语音等，用 _getUrl 可下剧本。
- 10004 多为该账号未解锁该话；10011 多为无此剧情或 ID 错误。
