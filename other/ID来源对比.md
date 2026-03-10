# 剧本 ID 与 CG ID 从哪里来？有没有关系？

## 1. 来源都在同一份 manifest（result.json）

两份 ID 都来自 **npm start** 拉下来的 **result.json**（解密后的 resource.json），只是用的 **path 前缀不同**：

| 用途 | manifest 里的 path 示例 | 取到的 ID 是什么 |
|------|-------------------------|------------------|
| **CG** | `image/character/stand/10020203.png` | 文件名去掉 `03.png` → **100202**（6 位） |
| **剧本** | `image/episode/story/110010101.png` | 文件名去掉 `.png` → **110010101**（9 位，可拆成 110010 + 101） |

也就是说：

- **CG 用到的 ID**：来自 **image/character/stand/** 下 `*03.png` 的文件名（6 位角色 ID）。
- **剧本用到的 ID**：来自 **image/episode/story/** 下 `*.png` 的文件名（9 位 resourcePath = storyId 6 位 + episodeId 3 位）。

所以：**都是从 manifest 里“按路径规则”取出来的，只是规则不同、位数不同。**

---

## 2. 和“拉的 CG”有没有相似的地方？

有，而且有直接对应关系：

- **CG**：用 6 位 **角色 ID**（如 100202、233401）去请求  
  `adv/image/character/{id}/image/{i}0{j}.jpg`  
  也就是「某个角色的某张 CG」。
- **剧本**：用 9 位 **resourcePath**（如 110010101）调 readStory，拆成  
  **storyId = 前 6 位**（110010）、**episodeId = 后 3 位**（101），  
  得到「某条剧情的一话」的剧本和资源。

**相似点：**

1. **前 6 位可能和角色/剧情线一致**  
   在 manifest 里做过对比：有不少「剧本 ID 的前 6 位」和「CG 用的 6 位角色 ID」是**同一批数字**（例如 201001、202001、233401 等）。  
   也就是说：**同一串 6 位数，既可以用来拉这个角色的 CG（stand + character image），也可以用来当某条剧情线的 storyId 拉剧本。**

2. **都依赖同一份 manifest**  
   - 拉 CG：先有 stand 列表 → 得到角色 ID → 再按 `adv/image/character/{id}/image/...` 拉图。  
   - 拉剧本：先有 episode/story 列表 → 得到 9 位 resourcePath → 再按 readStory(storyId, episodeId) 拉剧本。  
   所以 **ID 都是从 manifest 来的，和拉的 CG 用的是同一套资源表。**

3. **剧本里会引用到 CG 路径**  
   剧本 txt 里会直接写资源路径，例如：  
   `adv/image/character/233401/image/101.jpg`、  
   `adv/sound/voice/adu233401_01_01.mp3`。  
   这里的 **233401** 就是角色 ID，和 manifest 里 **image/character/stand/**、CG 用的角色 ID 是同一套。

**总结一句：**  
剧本 ID（9 位）和 CG 用的 ID（6 位角色 ID）**都从 manifest 来**；剧本 ID 的**前 6 位**经常和某个**角色 ID** 相同或对应同一条线，所以和“拉的 CG”在角色/剧情线上是对得上的，只是 CG 用 6 位拉图，剧本用 9 位（6+3）拉一整话。
