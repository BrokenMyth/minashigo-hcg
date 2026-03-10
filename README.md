# minashigo-hcg

用 Node 拉取剧情资源（剧本、CG、语音），按寝室/场景 ID 下载到本地。

## 环境

- Node.js：`npm i` 安装依赖即可跑所有脚本。若用 **download.py** 则需 Python 和 `pip install -r requirements.txt`（或已安装 `requests`），否则用 **download.js** 即可，无需 Python。

## 配置

所有鉴权与版本统一放在 **config.json**（项目根目录）：

```json
{
  "version": {
    "resourceVersion": "2.7.020",
    "masterVersion": "2.7.02",
    "clientVersion": "2.7.022"
  },
  "token": {
    "dmmId": "...",
    "userId": "...",
    "token": "...",
    "secret": "...",
    "expires": 1773584597
  }
}
```

- **version**：运行 **update-token.bat** 会拉取 getVersion 并更新该段，无需手改。
- **token**：需手动从浏览器抓包获取。打开游戏 → 开发者工具 Network → 找到 **getDmmAccessToken** 的响应，把响应 JSON 填进 `config.token`。

## 脚本用法

### 1. 更新版本（config.version）

```bat
update-token.bat
```

或命令行：`node update-token.js`  
会请求 getVersion 并写回 **config.json**，保留原有 `token` 不变。

### 2. 拉 manifest 并生成 result.json（index.js）

```bat
start.bat
```

或命令行：`npm start` / `node index.js`  
会拉取 getVersion、从 CDN 拉 resource.json 解密后写入 **result.json**，并导出 **audio.json**、**script.json**、**cg.json** 等。  
需要 **result.json** 做批量场景列表或给 get-resource-by-manifest / download 用时，先运行本脚本。

### 3. 按类型批量下载（清单 → 本地文件）

根据「类型」读取对应的清单 JSON（`data[].name` + `url`），把尚未下载的项用 URL 拉取到指定目录。清单来源：**cg / audio / script** 由 **start.bat** 生成；**episode_story / stand / bgm** 由 `node get-resource-by-manifest.js list <类型>` 生成。

```bat
node download.js [类型]
```

类型：`cg` | `audio` | `script` | `episode_story` | `stand` | `bgm` | `story_voice`。不传则默认 `cg`。  
未安装 Python 时用 **download.js**；有 Python 也可用 **download.py**（如 `python download.py episode_story`），二者行为一致。

### 4. 按寝室/场景 ID 拉资源（剧本 + CG + 语音）

```bat
fetch-resources.bat <寝室场景ID>
```

示例：

```bat
fetch-resources.bat 122810112
```

会拉取该场景的剧本、图片、语音到 **output/\<场景ID\>/**（如 `output/122810112/<sceneId>.txt`、`image/`、`sound/voice/` 等）。  
也可在命令后加参数传给脚本，例如只拉 CG：`fetch-resources.bat 122810112 --cg`。

不传场景 ID 时，需先有 **result.json**（先运行 **start.bat** 生成），脚本会从 manifest 里取场景列表再批量拉取。

## 其他

- **get-resource-by-manifest.js**：从 result.json 按类型导出 manifest 列表（如 `node get-resource-by-manifest.js list episode_story`），生成 `manifest_<类型>.json`，供 **download.js** / **download.py** 使用。
- **download.js** / **download.py**：按类型批量下载（见上方 3）。无 Python 用 **download.js** 即可。
