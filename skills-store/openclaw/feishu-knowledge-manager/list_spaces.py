#!/usr/bin/env python3
import sys
import os
import json
sys.path.insert(0, os.path.dirname(__file__))
from feishu_api import FeishuAPI

api = FeishuAPI()

result = api._request("GET", "/wiki/v2/spaces")
if result.get("code") == 0:
    spaces = result.get("data", {}).get("items", [])
    print(f"[INFO] Found {len(spaces)} wiki spaces:")
    for space in spaces:
        print(f"\n  Space Name: {space.get('name')}")
        print(f"  Space Token: {space.get('token')}")
        print(f"  Space ID: {space.get('space_id')}")
        # 打印更多信息以便识别
        if 'description' in space:
            print(f"  Description: {space.get('description')}")
else:
    print(f"[ERROR] {result.get('msg')}")
