#!/usr/bin/env python3
import sys
import os
import json
sys.path.insert(0, os.path.dirname(__file__))
from feishu_api import FeishuAPI

api = FeishuAPI()

# 先尝试获取 spaces 的详细信息
print("[INFO] Getting wiki spaces with detail...")
result = api._request("GET", "/wiki/v2/spaces?page_size=50")
if result.get("code") == 0:
    spaces = result.get("data", {}).get("items", [])
    print(f"[INFO] Found {len(spaces)} wiki spaces:")
    for space in spaces:
        print(f"\n  Space Name: {space.get('name')}")
        print(f"  Space Token: {space.get('token')}")
        print(f"  Space ID: {space.get('space_id')}")
        print(f"  Type: {space.get('type')}")
else:
    print(f"[ERROR] {result.get('msg')} (code: {result.get('code')})")

print("\n" + "="*50 + "\n")

# 已知知识库分类的token，尝试获取节点信息
# 从 feishu-kb-organized.json 我们知道:
# "AI大模型 / AI行业动态" -> token: Ei1BdTqlloDU9zxZZtacSDNJnNc
kb_token = "Ei1BdTqlloDU9zxZZtacSDNJnNc"
print(f"[INFO] Trying to get node info for KB token: {kb_token}")

# 尝试不同的API端点
endpoints = [
    f"/wiki/v2/spaces/{kb_token}",
    f"/knowledge/v1/nodes/{kb_token}",
    f"/docx/v1/documents/{kb_token}",
    f"/wiki/v2/nodes/{kb_token}"
]

for endpoint in endpoints:
    print(f"\n[INFO] Trying GET {endpoint}")
    result = api._request("GET", endpoint)
    print(f"  Code: {result.get('code')}, Msg: {result.get('msg')[:100]}")
    if result.get("code") == 0:
        print(f"  Found! Data keys: {list(result.get('data', {}).keys())}")
        break
