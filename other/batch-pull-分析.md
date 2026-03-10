# 批量拉取剧本 — 结果分析

## 问题与解决

1. **之前拉不下：** 用 `{ storyId: "123340", episodeId: "111" }` 调 readStory 时，服务端一直返回 **10011 story master not found**。
2. **原因：** 服务端实际接受的请求体是 **`{ "storyId": 123340111, "quality": 3 }`**（整段 resourcePath 数字 + quality），不是两个分开的 storyId/episodeId 字段。你提供的 curl 里解密后的 body 即为此格式。
3. **修改：**
   - 在 **index.js** 的 `readStory` 中：若传入 `{ storyId, episodeId }`，则自动改为发送 `{ storyId: Number(storyId + episodeId), quality: 3 }`。
   - 响应解密：兼容服务端返回 **裸加密字符串** 或 **`{ "data": "..." }`**，统一取出密文再解密。
   - 请求头：为 readStory 增加 **Origin / Referer**（与浏览器一致），避免被拒。

## 批量拉取结果（80 话试跑）

- **成功：15 话** — 已下载剧本到 `story_txt/*.txt`。
- **10004 not match condition：** 多数 — 表示该话在当前账号下**未解锁/不满足条件**，不是接口或格式错误。
- **10011 story master not found：** 少数 — 表示服务端无该剧情或 ID 不在库里。

成功的话包括但不限于：110010/101、110010/201、110010/202、110020/101、110030/101、110040/101、110050/101、110070/301、110070/302、120010/101、120010/102、120010/301、120010/302、120020/101、120020/102。

## 剧本内容核对

- **123340111.txt**：エーリュシオン 相关剧情（与你之前 curl 一致）。
- **110010101.txt**：世界守護者・零式、サンサン園等，格式为 CSV 指令（name / msg / playvoice / bg / playbgm / sprite 等），与游戏内一致。

可随意打开 `story_txt/` 下任意 `.txt` 与游戏内对应话面对照，确认台词与顺序是否正确。

## 后续怎么多拉

- **批量拉更多话：**  
  `node batch-pull-stories.js [数量]`  
  会从 manifest 的 `image/episode/story/` 顺序取 ID，逐话调 readStory 并下载能成功的话到 `story_txt/`。成功/失败会写入 **batch-pull-result.json**。
- **只拉指定话：**  
  `node download-story-from-readStory.js <storyId> <episodeId>`  
  例如：`node download-story-from-readStory.js 120010 102`。
- 若某话返回 **10004**，说明当前 token 对应账号未解锁该话，需在游戏内解锁或换已解锁账号的 token 后再拉。
