#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from feishu_api import FeishuAPI

api = FeishuAPI()

# 获取 AI行业动态 文档内容
kb_doc_token = "Ei1BdTqlloDU9zxZZtacSDNJnNc"
print(f"[INFO] Fetching 'AI大模型/AI行业动态' document content...")

# 获取文档基本信息
result = api._request("GET", f"/docx/v1/documents/{kb_doc_token}")
if result.get("code") == 0:
    doc = result.get("data", {}).get("document", {})
    print(f"Title: {doc.get('title')}")
    print(f"Document ID: {doc.get('document_id')}")
else:
    print(f"Error getting document: {result.get('msg')}")

print("\n" + "="*50 + "\n")

# 获取文档的块（内容）
print("[INFO] Fetching document blocks...")
result = api._request("GET", f"/docx/v1/documents/{kb_doc_token}/blocks")
if result.get("code") == 0:
    items = result.get("data", {}).get("items", [])
    print(f"[INFO] Found {len(items)} blocks")
    for i, item in enumerate(items[:10], 1):
        block_type = item.get("block_type")
        block_id = item.get("block_id")
        print(f"  Block {i}: type={block_type}, id={block_id}")
        # 如果是文本块，看看内容
        if block_type == 2:  # text block
            text_obj = item.get("text", {})
            elements = text_obj.get("elements", [])
            content = ""
            for el in elements:
                if el.get("type") == "text_run":
                    content += el.get("text_run", {}).get("content", "")
            print(f"    Content: {content[:100]}")
else:
    print(f"Error getting blocks: {result.get('msg')} (code: {result.get('code')})")
