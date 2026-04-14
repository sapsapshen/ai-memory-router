#!/usr/bin/env python3
"""
feishu_knowledge.py - 飞书知识库操作

将文章内容转录到飞书文档
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from feishu_api import FeishuAPI


class FeishuKnowledgeManager:
    """飞书知识管理器"""

    def __init__(self):
        self.api = FeishuAPI()
        self.folder_id = ""  # 可以指定文件夹

    def transcribe_article(self, title, url, summary, topic):
        """转录单篇文章到飞书"""
        # 格式化内容
        content_lines = [
            f"# {title}",
            "",
            f"**链接**: {url}",
            f"**主题**: {topic}",
            f"**收录时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "",
            "## 摘要",
            summary,
            "",
            "*由慕歌自动转录*"
        ]
        content = "\n".join(content_lines)
        
        # 创建文档
        print(f"[INFO] Creating document: {title}")
        result = self.api.create_docx(title, content)
        
        if result.get("code") == 0:
            doc = result.get("data", {}).get("document", {})
            doc_token = doc.get("document_id")
            print(f"[SUCCESS] Document created: {doc_token}")
            return {"code": 0, "doc_token": doc_token, "title": title}
        else:
            print(f"[ERROR] Failed: {result.get('msg')}")
            return result

    def daily_digest(self, topic, articles):
        """创建每日摘要文档"""
        doc_title = f"微信公众号摘要 {datetime.now().strftime('%Y-%m-%d')}"
        
        # 构建内容
        content_parts = [
            f"# 微信公众号每日摘要",
            "",
            f"**日期**: {datetime.now().strftime('%Y-%m-%d')}",
            f"**热词**: {topic}",
            "",
            "---",
            "",
            f"## 今日文章 ({len(articles)}篇)",
            ""
        ]
        
        for i, article in enumerate(articles, 1):
            title = article.get('title', '无标题')
            url = article.get('url', '')
            summary = article.get('summary', '（无摘要）')
            
            content_parts.extend([
                f"### {i}. {title}",
                "",
                f"**链接**: {url}",
                "",
                f"**摘要**: {summary}",
                ""
            ])
        
        content_parts.extend([
            "---",
            f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')} | 由慕歌自动生成*"
        ])
        
        content = "\n".join(content_parts)
        
        # 创建文档
        print(f"[INFO] Creating daily digest: {doc_title}")
        result = self.api.create_document(doc_title, content)
        
        if result.get("code") == 0:
            doc = result.get("data", {}).get("document", {})
            doc_token = doc.get("document_id")
            print(f"[SUCCESS] Digest created: {doc_token}")
            return {"code": 0, "doc_token": doc_token, "title": doc_title}
        else:
            print(f"[ERROR] Failed: {result.get('msg')}")
            return result


def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description="飞书知识库管理")
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    # 转录文章
    transcribe_parser = subparsers.add_parser("transcribe", help="转录文章")
    transcribe_parser.add_argument("--title", required=True, help="文章标题")
    transcribe_parser.add_argument("--url", required=True, help="文章链接")
    transcribe_parser.add_argument("--summary", required=True, help="文章摘要")
    transcribe_parser.add_argument("--topic", default="通用", help="所属主题")
    
    # 每日摘要
    digest_parser = subparsers.add_parser("digest", help="生成每日摘要")
    digest_parser.add_argument("--topic", required=True, help="今日热词")
    digest_parser.add_argument("--articles", required=True, help="文章列表JSON文件")
    
    args = parser.parse_args()
    
    manager = FeishuKnowledgeManager()
    
    if args.command == "transcribe":
        result = manager.transcribe_article(args.title, args.url, args.summary, args.topic)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    elif args.command == "digest":
        with open(args.articles, 'r', encoding='utf-8') as f:
            articles = json.load(f)
        result = manager.daily_digest(args.topic, articles)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
