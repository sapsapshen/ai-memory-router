#!/usr/bin/env python3
import sys
import os
import json
sys.path.insert(0, os.path.dirname(__file__))
from feishu_api import FeishuAPI

api = FeishuAPI()

# 尝试获取刚创建的文档信息
doc_token = "EnzkdfuFMoY4tsxx5tEcEfzonCd"
print(f"[INFO] Getting document info for: {doc_token}")
result = api._request("GET", f"/docx/v1/documents/{doc_token}")
if result.get("code") == 0:
    doc_info = result.get("data", {}).get("document", {})
    print(f"[SUCCESS] Document title: {doc_info.get('title')}")
    print(f"  Document ID: {doc_info.get('document_id')}")
    print(f"  URL: https://feishu.cn/docx/{doc_info.get('document_id')}")
    print(f"  Full data: {json.dumps(doc_info, ensure_ascii=False, indent=2)}")
else:
    print(f"[ERROR] {result.get('msg')} (code: {result.get('code')})")

print("\n" + "="*50 + "\n")

# 尝试列出根目录文件夹
print("[INFO] Listing root folders...")
result = api._request("GET", "/drive/v1/files?type=folder&page_size=10")
if result.get("code") == 0:
    files = result.get("data", {}).get("files", [])
    print(f"[INFO] Found {len(files)} folders/files:")
    for f in files[:5]:
        print(f"  - {f.get('name')} (type: {f.get('type')}, token: {f.get('file_token')})")
else:
    print(f"[ERROR] {result.get('msg')} (code: {result.get('code')})")
