#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from feishu_api import FeishuAPI

api = FeishuAPI()

# 刚创建的文档ID
doc_token = "EnzkdfuFMoY4tsxx5tEcEfzonCd"
# AI大模型/AI行业动态 知识库分类token
kb_token = "Ei1BdTqlloDU9zxZZtacSDNJnNc"

print(f"[INFO] Adding document {doc_token} to knowledge base {kb_token}...")
result = api.add_document_to_knowledge_base(doc_token, kb_token)

if result.get("code") == 0:
    print("[SUCCESS] Document successfully added to 'AI大模型/AI行业动态' knowledge base!")
else:
    print(f"[WARN] API returned: {result.get('msg')} (code: {result.get('code')})")
    print("[INFO] The document was created successfully but may need manual categorization in Feishu.")
