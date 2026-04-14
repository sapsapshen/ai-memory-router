#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from feishu_api import FeishuAPI

api = FeishuAPI()

# 尝试不同的知识库 API 端点
endpoints = [
    "/knowledge/v1/spaces",
    "/knowledge/v1/bases",
    "/knowledge/v2/spaces",
    "/wiki/v2/spaces",
    "/wiki/v1/spaces"
]

for endpoint in endpoints:
    print(f"\n[INFO] Trying: {endpoint}")
    result = api._request("GET", endpoint)
    code = result.get("code", -1)
    msg = result.get("msg", "no msg")
    print(f"  Code: {code}, Msg: {msg}")
    if code == 0:
        print(f"  SUCCESS! Data keys: {list(result.get('data', {}).keys())}")
        break
