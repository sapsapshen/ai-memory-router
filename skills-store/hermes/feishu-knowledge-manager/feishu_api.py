#!/usr/bin/env python3
"""
feishu_api.py - 飞书开放平台 API 封装 (v3)

已知问题：
- 段落块(block_type=2)添加失败，API返回1770001错误
- 仅heading块(block_type=3,4,5)和divider(block_type=10)可用
- 这是API权限或配置问题，需要在飞书开放平台检查应用权限
"""

import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

# 配置
FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "cli_a9242dbee9fa1cc6")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "5LGFP0INUQYEMBicpLarLh73ktKT6Sc4")

FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"


class FeishuAPI:
    """飞书 API 客户端"""

    def __init__(self, app_id=None, app_secret=None):
        self.app_id = app_id or FEISHU_APP_ID
        self.app_secret = app_secret or FEISHU_APP_SECRET
        self.tenant_token = None
        self.token_expire = 0

    def _request(self, method, path, data=None, need_token=True):
        """发送 API 请求"""
        url = f"{FEISHU_BASE_URL}{path}"
        headers = {"Content-Type": "application/json"}
        
        if need_token:
            self.ensure_token()
            headers["Authorization"] = f"Bearer {self.tenant_token}"

        if data:
            data = json.dumps(data).encode("utf-8")
        
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                if result.get("code") != 0:
                    print(f"[WARN] API {path} returned code {result.get('code')}: {result.get('msg')}")
                return result
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            print(f"[ERROR] HTTP {e.code} for {path}: {error_body[:200]}")
            return {"code": e.code, "msg": f"HTTP {e.code}", "detail": error_body}
        except Exception as e:
            print(f"[ERROR] Request failed: {e}")
            return {"code": -1, "msg": str(e)}

    def ensure_token(self):
        """确保有有效的 token"""
        if not self.need_token():
            return
        
        result = self._request("POST", "/auth/v3/tenant_access_token/internal", 
                               {"app_id": self.app_id, "app_secret": self.app_secret},
                               need_token=False)
        
        if result.get("code") == 0:
            self.tenant_token = result.get("tenant_access_token")
            self.token_expire = datetime.now().timestamp() + result.get("expire", 7200) - 300
            print(f"[INFO] Token: {self.tenant_token[:20]}...")

    def need_token(self):
        return not self.tenant_token or datetime.now().timestamp() > self.token_expire

    # ==================== 云文档操作 ====================

    def create_document(self, title, content=""):
        """创建云文档"""
        data = {"title": title}
        result = self._request("POST", "/docx/v1/documents", data)
        
        if result.get("code") != 0:
            return result
        
        doc_token = result.get("data", {}).get("document", {}).get("document_id")
        
        if content and doc_token:
            # 由于段落API有问题，使用heading构建内容
            self._add_content_as_headings(doc_token, content)
        
        return {
            "code": 0,
            "data": {
                "document": {
                    "document_id": doc_token,
                    "title": title,
                    "url": f"https://feishu.cn/docx/{doc_token}"
                }
            }
        }

    def _add_content_as_headings(self, doc_token, content):
        """使用text块添加内容
        
        注意(2026-04-04实测)：
        - block_type=2 (text) 可用
        - block_type=3/4/5 (heading) 返回1770001 invalid param，不可用
        - block_type=10 (divider) 返回1770001，不可用的
        因此统一使用text块。
        """
        import time
        
        # 获取根块ID
        blocks_result = self._request("GET", f"/docx/v1/documents/{doc_token}/blocks")
        if blocks_result.get("code") != 0:
            return
        
        items = blocks_result.get("data", {}).get("items", [])
        if not items:
            return
        
        root_block_id = items[0].get("block_id")
        
        # 将内容分割成行
        lines = content.split("\n")
        buffer = []
        
        for line in lines:
            line = line.strip()
            if not line:
                if buffer:
                    self._flush_text_buffer(doc_token, root_block_id, buffer)
                    buffer = []
                continue
            
            # 处理标题标记，用加粗模拟
            is_heading = line.startswith("# ") or line.startswith("## ") or line.startswith("### ")
            if line.startswith("# "):
                text = line[2:]
            elif line.startswith("## "):
                text = line[3:]
            elif line.startswith("### "):
                text = line[4:]
            else:
                text = line
            
            if len(text) > 200:
                text = text[:200] + "..."
            
            block = {
                "block_type": 2,
                "text": {
                    "elements": [{
                        "type": "text_run",
                        "text_run": {
                            "content": text,
                            "text_element_style": {"bold": is_heading}
                        }
                    }],
                    "style": {}
                }
            }
            buffer.append(block)
            
            # 每5个块一批
            if len(buffer) >= 5:
                time.sleep(0.3)
                self._request("POST",
                            f"/docx/v1/documents/{doc_token}/blocks/{root_block_id}/children",
                            {"children": buffer})
                buffer = []
        
        if buffer:
            time.sleep(0.3)
            self._request("POST",
                        f"/docx/v1/documents/{doc_token}/blocks/{root_block_id}/children",
                        {"children": buffer})

    def _flush_text_buffer(self, doc_token, root_block_id, buffer):
        """批量发送text块"""
        import time
        time.sleep(0.3)
        return self._request("POST",
                    f"/docx/v1/documents/{doc_token}/blocks/{root_block_id}/children",
                    {"children": buffer})

    def create_document_simple(self, title):
        """创建空文档"""
        data = {"title": title}
        result = self._request("POST", "/docx/v1/documents", data)
        
        if result.get("code") == 0:
            doc = result.get("data", {}).get("document", {})
            doc_token = doc.get("document_id")
            print(f"[SUCCESS] Document created: https://feishu.cn/docx/{doc_token}")
            return {
                "code": 0,
                "data": {
                    "document": {
                        "document_id": doc_token,
                        "title": title,
                        "url": f"https://feishu.cn/docx/{doc_token}"
                    }
                }
            }
        return result

    # ==================== 知识库操作 ====================

    def list_knowledge_bases(self):
        """列出知识库（需要额外权限）"""
        return self._request("GET", "/knowledge/v1/bases")

    def create_knowledge_base(self, name, description=""):
        """创建知识库"""
        data = {
            "name": name,
            "description": description
        }
        return self._request("POST", "/knowledge/v1/bases", data)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="飞书 API 工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    subparsers.add_parser("test", help="测试连接")
    subparsers.add_parser("list", help="列出文件")
    
    create_parser = subparsers.add_parser("create", help="创建文档")
    create_parser.add_argument("--title", required=True, help="文档标题")
    create_parser.add_argument("--content", default="", help="文档内容")
    
    args = parser.parse_args()
    
    api = FeishuAPI()
    
    if args.command == "test":
        print("[INFO] Testing connection...")
        # 尝试创建文档测试
        result = api.create_document_simple("API Test")
        if result.get("code") == 0:
            print("[SUCCESS] API working!")
        else:
            print(f"[ERROR] Failed: {result.get('msg')}")
    
    elif args.command == "create":
        print(f"[INFO] Creating: {args.title}")
        result = api.create_document(args.title, args.content)
        if result.get("code") == 0:
            print(f"[SUCCESS] https://feishu.cn/docx/{result.get('data', {}).get('document', {}).get('document_id')}")
        else:
            print(f"[ERROR] Failed: {result.get('msg')}")
    
    elif args.command == "list":
        result = api._request("GET", "/drive/v1/files")
        if result.get("code") == 0:
            files = result.get("data", {}).get("files", [])
            print(f"[INFO] Found {len(files)} files")
            for f in files[:5]:
                print(f"  - {f.get('name')}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
