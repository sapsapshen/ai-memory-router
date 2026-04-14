/**
 * companion-pets — 轻量 HTTP 服务
 * 纯 Node.js 内置模块，无需 express / socket.io
 * GET  /          → 演示页面（含宠物小部件）
 * GET  /widget    → 只返回宠物 HTML 片段（供 openclaw 注入）
 * POST /pet/reset → 重置当前用户宠物
 * GET  /pet/info  → 返回当前宠物 JSON
 */

'use strict';

const http = require('http');
const CompanionPets = require('./companion');

const companion = new CompanionPets();
const PORT = process.env.PORT || 3000;

// 读取请求 body
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}

// 简单 JSON 响应
function json(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

// HTML 响应
function html(res, body) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // POST /pet/reset
  if (url === '/pet/reset' && method === 'POST') {
    await readBody(req);
    companion.resetPet();
    const pet = companion.getPet();
    return json(res, { ok: true, message: `宠物已重置，新宠物：${pet.emoji} ${pet.name}`, pet: { key: pet.key, name: pet.name, emoji: pet.emoji, color: pet.color } });
  }

  // GET /pet/info
  if (url === '/pet/info' && method === 'GET') {
    const pet = companion.getPet();
    return json(res, { key: pet.key, name: pet.name, emoji: pet.emoji, color: pet.color });
  }

  // GET /widget — 纯 HTML 片段，openclaw 可通过 iframe / innerHTML 注入
  if (url === '/widget' && method === 'GET') {
    return html(res, companion.getWebUI());
  }

  // GET / — 演示页面
  if (url === '/' && method === 'GET') {
    const pet = companion.getPet();
    return html(res, `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Companion Pets 演示</title>
  <style>
    body { font-family: sans-serif; background: #f5f7fa; margin: 0; padding: 40px 20px; color: #333; }
    h1 { text-align: center; color: ${pet.color}; }
    .info { max-width: 500px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .info p { line-height: 1.8; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .badge { display: inline-block; background: ${pet.color}; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>🐾 Companion Pets</h1>
  <div class="info">
    <p>当前宠物：<span class="badge">${pet.emoji} ${pet.name}</span></p>
    <p>输入 <code>/pet</code> 查看你的宠物，输入 <code>/pet reset</code> 随机换一只。</p>
    <p>API 端点：</p>
    <ul>
      <li><code>GET /widget</code> — 获取宠物小部件 HTML</li>
      <li><code>GET /pet/info</code> — 当前宠物信息 JSON</li>
      <li><code>POST /pet/reset</code> — 重置宠物</li>
    </ul>
  </div>
  ${companion.getWebUI()}
</body>
</html>`);
  }

  // 404
  json(res, { error: 'Not Found' }, 404);
});

server.listen(PORT, () => {
  const pet = companion.getPet();
  console.log(`[companion-pets] 服务已启动 → http://localhost:${PORT}`);
  console.log(`[companion-pets] 当前宠物：${pet.emoji} ${pet.name}`);
  console.log(`[companion-pets] 宠物小部件：http://localhost:${PORT}/widget`);
});
