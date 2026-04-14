#!/usr/bin/env python3
"""
daily-wechat-digest - 每日微信公众号热词摘要任务生成器

此脚本作为 cron job 的一部分运行，负责：
1. 从 last30days-skill-cn 获取当前热词
2. 生成搜索任务配置
3. 准备摘要模板

实际搜索和总结由 OpenClaw agent 在 cron job 的 agentTurn 中完成
"""

import json
import os
import subprocess
import sys
import re
from datetime import datetime
from pathlib import Path

# 技能目录
SKILL_DIR = Path(__file__).parent.resolve()
WORKSPACE = Path("C:/Users/sap/.openclaw/workspace")
OUTPUT_DIR = WORKSPACE / "memory" / "daily-wechat-digest"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def run_command(cmd, timeout=120, shell=True):
    """执行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd,
            shell=shell,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace"
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except Exception as e:
        return "", str(e), 1


def log(msg):
    """打印日志"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        print(f"[{timestamp}] {msg}", flush=True)
    except UnicodeEncodeError:
        clean_msg = msg.encode('gbk', errors='ignore').decode('gbk')
        print(f"[{timestamp}] {clean_msg}", flush=True)


def get_trending_topics():
    """从多个平台获取当前热词"""
    log("[STEP 1] 正在获取各平台热词...")

    topics = []
    sources = ["bilibili", "baidu"]

    for source in sources:
        last30_script = SKILL_DIR / ".." / "last30days-skill-cn" / "scripts" / "last30days.py"
        cmd = f'python "{last30_script}" "热点" --search {source} --quick --emit compact'
        stdout, stderr, code = run_command(cmd, timeout=120)

        if code == 0 and stdout.strip():
            lines = stdout.strip().split("\n")
            for line in lines[:5]:
                matches = re.findall(r'[\u4e00-\u9fff]{4,10}', line)
                for m in matches:
                    if m and m not in topics:
                        topics.append(m)

        if len(topics) >= 5:
            break

    if not topics:
        topics = ["人工智能", "科技趋势", "数字化"]

    log(f"[INFO] 获得热词: {topics}")
    return topics


def create_daily_task(topics, date_str):
    """创建每日任务配置"""
    task_file = OUTPUT_DIR / f"daily-task-{date_str}.json"

    task_data = {
        "date": date_str,
        "topics": topics,
        "status": "pending_search",
        "steps": [
            {
                "step": 1,
                "action": "web_search",
                "query": f'{topics[0]} site:mp.weixin.qq.com',
                "count": 5,
                "description": f"搜索微信公众号: {topics[0]}"
            },
            {
                "step": 2,
                "action": "jina_fetch",
                "description": "获取文章内容"
            },
            {
                "step": 3,
                "action": "summarize",
                "description": "AI总结每篇文章"
            },
            {
                "step": 4,
                "action": "save_digest",
                "output": f"memory/daily-wechat-digest/wechat-digest-{date_str}.md",
                "description": "保存摘要"
            }
        ],
        "feishu_sync": {
            "enabled": True,
            "action": "transcribe_to_feishu",
            "knowledge_base": "每日微信摘要",
            "schedule_refine": "10:00",
            "description": "10点执行内容提炼并汇入知识库"
        }
    }

    task_file.write_text(json.dumps(task_data, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"[SAVE] 每日任务已创建: {task_file}")

    return task_file


def create_agent_prompt(topics, date_str):
    """创建 Agent 执行提示"""
    prompt = f"""你是每日微信公众号摘要助手。今天是 {date_str}。

## 任务
1. 使用 web_search 搜索微信公众号文章（搜索词：{topics[0]} site:mp.weixin.qq.com）
2. 获取前5篇文章的完整内容（使用 jina.ai reader: https://r.jina.ai/URL）
3. 对每篇文章进行AI总结（核心要点、内容概要、核心思想）
4. 将总结保存到 memory/daily-wechat-digest/wechat-digest-{date_str}.md
5. 更新任务状态为 completed

## 输出格式
```
# 微信公众号每日摘要 - {date_str}

## 今日热词: {topics[0]}

---

### 1. [文章标题]
**链接**: URL
**核心要点**: ...
**内容概要**: ...
**核心思想**: ...

---
...（其他4篇文章）
```
"""

    prompt_file = OUTPUT_DIR / f"agent-prompt-{date_str}.txt"
    prompt_file.write_text(prompt, encoding="utf-8")
    log(f"[SAVE] Agent提示已创建: {prompt_file}")

    return prompt_file, prompt


def main():
    log("[START] ====== 每日微信公众号摘要任务生成开始 ======")

    date_str = datetime.now().strftime("%Y-%m-%d")

    # Step 1: 获取热词
    topics = get_trending_topics()

    # Step 2: 创建任务配置
    task_file = create_daily_task(topics, date_str)

    # Step 3: 创建 Agent 提示
    prompt_file, prompt = create_agent_prompt(topics, date_str)

    log("[DONE] ====== 任务生成完成 ======")

    # 输出结果
    print("\n" + "="*60)
    print(f"[INFO] 今日热词: {topics}")
    print(f"[INFO] 任务文件: {task_file}")
    print(f"[INFO] Agent提示: {prompt_file}")
    print("="*60)
    print("\n[PROMPT_START]\n" + prompt + "\n[PROMPT_END]")

    return 0


if __name__ == "__main__":
    sys.exit(main())
