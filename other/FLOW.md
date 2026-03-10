# 当前整体流程与 storyId / episodeId 来源

## 一、整体流程概览

```
┌─────────────────┐     getVersion      ┌──────────────────────────────────┐
│  游戏服务器       │ ◄─────────────────► │  config.json (version)            │
│  (cert + OAuth)  │     getResource     │  token.json → config (OAuth)     │
└────────┬────────┘     resource.json   └──────────────────────────────────┘
         │                     │
         │                     ▼
         │              ┌──────────────┐  解密   ┌─────────────┐
         │              │ resource.json │ ──────► │ result.json │  (manifest)
         │              │   (CDN)      │         │ assets{}    │
         │              └──────────────┘         └──────┬──────┘
         │                                              │
         │  readStory(storyId, episodeId)               │ image/episode/story/*.png
         │  POST /mnsg/story/readStory                  │ 文件名 = resourcePath
         │         │                                    │ = storyId + episodeId
         │         ▼                                    │
         │  ┌─────────────────────┐                     │
         │  │ resources[]         │ 含 adv/textfiles/    │
         │  │  - *.txt 剧本       │   story/<id>.txt    │
         │  │  - 图/语音/BGM 等   │                     │
         │  └──────────┬──────────┘                     │
         │             │                                 │
         │             ▼                                 │
         │  _getUrl(path, md5) → CDN URL → 下载剧本      │
         │                                             │
         │  getStoryResource(path)  (单资源 path+md5)   │
         └─────────────────────────────────────────────┘
```

## 二、storyId + episodeId 从哪里拿？

### 1. 推荐来源：manifest 里的 `image/episode/story/` 路径

- **result.json**（即解密后的 manifest）中，**assets** 的 key 包含大量 `image/episode/story/<id>.png`。
- 这里的 **`<id>` 就是 resourcePath**，即 **storyId 与 episodeId 的拼接**（无下划线）。
- 拆分规则（实测）：
  - **常见为 6 位 + 3 位**：如 `123340111` → storyId=`123340`，episodeId=`111`。
  - 也有 6 位 + 4 位等（如部分活动剧情）：如 `2010020211` → storyId=`201002`，episodeId=`0211`。

**操作步骤：**

1. 已有 **result.json** 时，运行：
   ```bash
   node get-resource-by-manifest.js list episode_story
   ```
   会生成 **manifest_episode_story.json**，其中每一项的 `path` 形如 `image/episode/story/110010101.png`。
2. 从文件名取 ID：去掉 `.png`，得到 `110010101`。
3. 拆成 storyId / episodeId（先试 6+3）：
   - storyId = `110010`，episodeId = `101`。
4. 调 readStory 并下载剧本：
   ```bash
   node download-story-from-readStory.js 110010 101
   ```

若返回 **10011 story master not found**，说明该剧情在当前账号下未解锁或服务端无此 story；换已解锁的 ID 或换 token 再试。

### 2. 其他可能来源（需自行抓包或逆向）

- **游戏内 API**：例如“剧情列表”“寝室列表”等接口可能返回 storyId / episodeId 或 resourcePath，需在浏览器 Network 里抓。
- **master 数据**：getVersion 里有 **masterVersion**，若游戏还有“master JSON”（剧情表、章节表），可能从那里拿到完整 story/episode 列表；当前项目未拉取该数据。
- **你已知的 ID**：如 `100202_201` 表示 storyId=`100202`、episodeId=`201`；`110010101` 表示 storyId=`110010`、episodeId=`101`。注意 readStory 接口要的是**数字字符串**，中间不要下划线。

## 三、各脚本在流程中的位置

| 步骤 | 脚本 / 命令 | 作用 |
|------|-------------|------|
| 版本与 manifest | `npm start` | 拉 getVersion + resource.json，解密写 **result.json** |
| Token 更新 | `node update-token.js` | 用 token.json 更新 config.json（版本 + OAuth） |
| 列出剧情 ID | `node get-resource-by-manifest.js list episode_story` | 从 result.json 导出 **manifest_episode_story.json**（含所有 image/episode/story/*.png 的 path） |
| 取 storyId/episodeId | 从 manifest_episode_story 的 path 里取文件名（去 .png），再按 6+3 等拆分 | 得到可调 readStory 的 storyId、episodeId |
| 拉剧本 | `node download-story-from-readStory.js <storyId> <episodeId>` | 调 readStory，从 resources 里下 **adv/textfiles/story/*.txt** 到 story_txt/ |
| 仅用已有响应下载 | `node download-story-from-readStory.js` | 用当前目录下 readStory_response.json 中的 resources 下载剧本 |

## 四、小结

- **剧本**只能通过 **readStory(storyId, episodeId)** 拿到；返回的 **resources** 里包含 `adv/textfiles/story/<resourcePath>.txt`，用 _getUrl 拼 CDN 下载。
- **storyId + episodeId** 在项目内**唯一可批量获取的方式**是：从 **result.json** 的 `image/episode/story/<id>.png` 得到 `<id>`（即 resourcePath），再按 6+3（或 6+4）拆成 storyId 与 episodeId。其他来源需抓包或查 master 数据。
