import json
import requests
import argparse
from pathlib import Path

OUTPUT_ROOT = "output"
TYPE_CONFIG = {
    "cg": (f"{OUTPUT_ROOT}/cg.json", f"{OUTPUT_ROOT}/cg"),
    "audio": ("audio.json", "./audio"),
    "script": ("script.json", "./script"),
    "episode_story": ("manifest_episode_story.json", "./episode_story"),
    "stand": ("manifest_stand.json", "./stand"),
    "bgm": ("manifest_bgm.json", "./bgm"),
    "story_voice": (f"{OUTPUT_ROOT}/story_voice.json", f"{OUTPUT_ROOT}/voice"),
}

def main():
    parser = argparse.ArgumentParser(description="下载 CG / 音频 / 脚本")
    parser.add_argument("type", nargs="?", default="cg", choices=list(TYPE_CONFIG), help="资源类型: cg | audio | script | episode_story | stand | bgm | story_voice（story_voice 由 node fetch-resources.js --voice 生成）")
    args = parser.parse_args()

    list_file, out_dir = TYPE_CONFIG[args.type]
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    existing = set(f.name for f in Path(out_dir).iterdir() if f.is_file())

    try:
        with open(list_file, encoding="utf-8") as f:
            json_data = json.load(f)
    except FileNotFoundError:
        print("未找到 {}，请先运行 npm start 或 node get-resource-by-manifest.js list <类型> 生成".format(list_file))
        return

    data = json_data.get("data", [])
    for row in data:
        name = row["name"]
        if name in existing:
            continue
        print("Downloading {}".format(name))
        try:
            r = requests.get(row["url"], allow_redirects=True, timeout=60)
            r.raise_for_status()
            Path(out_dir, name).write_bytes(r.content)
        except Exception as e:
            print("  ERROR: {}".format(e))

if __name__ == "__main__":
    main()
