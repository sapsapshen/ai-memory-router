#!/usr/bin/env python3
"""
Smart Summarize - 智能统一摘要脚本
自动识别 URL 类型，路由到 jina-ai-skill 或 bilibili-transcript
"""

import sys
import urllib.request
import urllib.error
import re
import json
import os
import subprocess
import platform

WORKSPACE = r"C:\Users\sap\.openclaw\workspace"
BILIBILI_SCRIPT = os.path.join(WORKSPACE, "skills", "bilibili-transcript", "scripts", "bilibili_transcript.sh")

def is_bilibili(url: str) -> bool:
    """检测是否为 Bilibili 链接"""
    return "bilibili.com" in url.lower()

def fetch_jina_markdown(url: str) -> str:
    """使用 Jina Reader 获取干净 Markdown"""
    encoded_url = urllib.parse.quote(url, safe='')
    jina_url = f"https://r.jina.ai/{encoded_url}"

    headers = {
        "Accept": "text/plain",
        "X-Return-Format": "markdown",
    }

    req = urllib.request.Request(jina_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        return f"[Jina 抓取失败] {str(e)}"

def extract_bilibili_transcript(url: str) -> str:
    """调用 bilibili-transcript 获取字幕"""
    if not os.path.exists(BILIBILI_SCRIPT):
        return f"[bilibili-transcript 脚本未找到: {BILIBILI_SCRIPT}]"

    try:
        # 使用 PowerShell 调用 WSL/bash 脚本
        result = subprocess.run(
            ["bash", BILIBILI_SCRIPT, url],
            capture_output=True,
            text=True,
            timeout=600,
            cwd=WORKSPACE
        )
        if result.returncode == 0:
            return result.stdout
        else:
            return f"[bilibili-transcript 失败] {result.stderr}"
    except FileNotFoundError:
        # Windows 没有 bash，尝试用 PowerShell + WSL
        try:
            result = subprocess.run(
                ["powershell.exe", "-Command", f"wsl bash '{BILIBILI_SCRIPT}' '{url}'"],
                capture_output=True,
                text=True,
                timeout=600,
                cwd=WORKSPACE
            )
            if result.returncode == 0:
                return result.stdout
            else:
                return f"[bilibili-transcript 失败] {result.stderr}"
        except Exception as e:
            return f"[调用 bilibili-transcript 失败] {str(e)}"
    except Exception as e:
        return f"[调用失败] {str(e)}"

def smart_summarize(url: str) -> str:
    """主函数：智能选择策略并抓取内容"""
    if is_bilibili(url):
        print(f"[SmartSummarize] 检测到 Bilibili 视频，使用字幕抓取...", file=sys.stderr)
        content = extract_bilibili_transcript(url)
    else:
        print(f"[SmartSummarize] 使用 Jina Reader 抓取页面...", file=sys.stderr)
        content = fetch_jina_markdown(url)

    if content.startswith("[") and "失败" in content:
        return content

    return content

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python smart_summarize.py <URL>")
        sys.exit(1)

    url = sys.argv[1]
    result = smart_summarize(url)
    print(result)
