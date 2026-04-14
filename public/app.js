// AI Memory Router - Frontend Application

let currentTab = 'memories';
let allMemories = [];
let allSkills = [];
let sourceTools = [];
let targetTools = [];
let selectedMemoryIds = new Set();
let selectedSkillIds = new Set();
// Active filter: null = all, string = specific tool ID
let activeSourceFilter = null;
let activeSkillSourceFilter = null;
let openFileGroups = new Set();
// Sidebar tree expansion state — default both trees expanded
let expandedTreeNodes = new Set(['tree-all', 'tree-all-skills']);
// Category collapse state (types that are collapsed)
let collapsedCategories = new Set();

// ========== TAB SWITCHING ==========
const chevronSvg = '<svg class="sidebar-toggle" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 3l4 4-4 4"/></svg>';

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTab = btn.dataset.tab;
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + currentTab).classList.add('active');
    renderSidebar();
    if (currentTab === 'memories') renderMemoryList();
    else renderSkillList();
    updateMigrateButton();
  });
});

// ========== LOAD DATA ==========
async function loadData() {
  try {
    const res = await fetch('/api/memories');
    const data = await res.json();
    allMemories = data.memories || [];
    sourceTools = data.tools || [];
    targetTools = data.targets || [];
    document.getElementById('memoryCount').textContent = allMemories.length;
    renderTargetSelect();
    renderSidebar();
    renderMemoryList();
  } catch (err) {
    document.getElementById('memoryList').innerHTML = '<p style="color:var(--critical)">加载失败：' + escapeHtml(err.message) + '</p>';
  }
}

async function loadSkills() {
  try {
    const res = await fetch('/api/skills');
    const data = await res.json();
    allSkills = data.skills || [];
    document.getElementById('skillCount').textContent = allSkills.length;
    document.getElementById('skillsTotalCount').textContent = '共 ' + allSkills.length + ' 个';
    renderSidebar();
    renderSkillList();
  } catch (err) {
    document.getElementById('skillList').innerHTML = '<p style="color:var(--critical)">加载失败：' + escapeHtml(err.message) + '</p>';
  }
}

function renderTargetSelect() {
  const sel = document.getElementById('targetTool');
  sel.innerHTML = '<option value="">选择目标工具...</option>';
  for (const t of targetTools) {
    sel.innerHTML += '<option value="' + t.id + '">' + t.label + '</option>';
  }
}

// ========== SIDEBAR — HIERARCHICAL TREE ==========
function renderSidebar() {
  const tree = document.getElementById('sidebarTree');
  if (currentTab === 'memories') {
    renderMemoryTree(tree);
  } else {
    renderSkillTree(tree);
  }
}

function renderMemoryTree(container) {
  // Build type → tool → count hierarchy
  const typeToolMap = {};
  for (const m of allMemories) {
    if (!typeToolMap[m.type]) typeToolMap[m.type] = {};
    typeToolMap[m.type][m.source] = (typeToolMap[m.type][m.source] || 0) + 1;
  }

  const typeColors = { user: 'var(--type-user)', project: 'var(--type-project)', feedback: 'var(--type-feedback)', reference: 'var(--type-reference)', session: 'var(--type-session)' };

  let html = '';

  // Root: All
  const isAllExpanded = expandedTreeNodes.has('tree-all');
  html += '<div class="sidebar-node' + (activeSourceFilter === null ? ' active' : '') + (isAllExpanded ? ' expanded' : '') + '" onclick="toggleTreeNode(\'tree-all\')">';
  html += chevronSvg;
  html += '<span class="node-label">全部记忆</span>';
  html += '<span class="node-count">' + allMemories.length + '</span>';
  html += '</div>';
  html += '<div class="sidebar-children' + (isAllExpanded ? ' open' : '') + '">';

  // Level 1: by type
  const typeOrder = ['user', 'project', 'feedback', 'reference', 'session'];
  for (const type of typeOrder) {
    const tools = typeToolMap[type];
    if (!tools) continue;
    const typeCount = Object.values(tools).reduce((a, b) => a + b, 0);
    const typeNodeId = 'tree-type-' + type;
    const isTypeExpanded = expandedTreeNodes.has(typeNodeId);

    html += '<div class="sidebar-node sidebar-level-1' + (activeSourceFilter === null && isAllExpanded ? '' : '') + (isTypeExpanded ? ' expanded' : '') + '" onclick="toggleTreeNode(\'' + typeNodeId + '\')">';
    html += chevronSvg;
    html += '<span class="node-label" style="color:' + typeColors[type] + '">' + capitalize(type) + '</span>';
    html += '<span class="node-count">' + typeCount + '</span>';
    html += '</div>';
    html += '<div class="sidebar-children' + (isTypeExpanded ? ' open' : '') + '">';

    // Level 2: by source tool
    for (const tool of sourceTools) {
      const count = tools[tool.id] || 0;
      if (count === 0) continue;
      const toolNodeId = 'tree-tool-' + tool.id;
      const isActive = activeSourceFilter === tool.id;

      html += '<div class="sidebar-node sidebar-level-2' + (isActive ? ' active' : '') + '" onclick="setSourceFilter(\'' + tool.id + '\')">';
      html += '<span class="node-label">' + escapeHtml(tool.label) + '</span>';
      html += '<span class="node-count">' + count + '</span>';
      html += '</div>';
    }

    html += '</div>'; // type children
  }

  html += '</div>'; // all children
  container.innerHTML = html;
}

function renderSkillTree(container) {
  // Build tool → count hierarchy
  const toolMap = {};
  for (const s of allSkills) {
    toolMap[s.sourceTool] = (toolMap[s.sourceTool] || 0) + 1;
  }

  let html = '';

  // Root: All — default expanded
  const isAllExpanded = expandedTreeNodes.has('tree-all-skills');
  html += '<div class="sidebar-node' + (activeSkillSourceFilter === null ? ' active' : '') + (isAllExpanded ? ' expanded' : '') + '" onclick="toggleTreeNode(\'tree-all-skills\')">';
  html += chevronSvg;
  html += '<span class="node-label">全部技能平台</span>';
  html += '<span class="node-count">' + allSkills.length + '</span>';
  html += '</div>';
  html += '<div class="sidebar-children' + (isAllExpanded ? ' open' : '') + '">';

  for (const tool of sourceTools) {
    const count = toolMap[tool.id] || 0;
    if (count === 0) continue;
    const isActive = activeSkillSourceFilter === tool.id;

    html += '<div class="sidebar-node sidebar-level-1' + (isActive ? ' active' : '') + '" onclick="setSkillSourceFilter(\'' + tool.id + '\')">';
    html += '<span class="node-label">' + escapeHtml(tool.label) + '</span>';
    html += '<span class="node-count">' + count + '</span>';
    html += '</div>';
  }

  // Tools that exist in skills but not in sourceTools
  for (const [toolId, count] of Object.entries(toolMap)) {
    if (!sourceTools.find(t => t.id === toolId)) {
      const isActive = activeSkillSourceFilter === toolId;
      html += '<div class="sidebar-node sidebar-level-1' + (isActive ? ' active' : '') + '" onclick="setSkillSourceFilter(\'' + toolId + '\')">';
      html += '<span class="node-label">' + escapeHtml(toolId) + '</span>';
      html += '<span class="node-count">' + count + '</span>';
      html += '</div>';
    }
  }

  html += '</div>';
  container.innerHTML = html;
}

function toggleTreeNode(nodeId) {
  if (expandedTreeNodes.has(nodeId)) expandedTreeNodes.delete(nodeId);
  else expandedTreeNodes.add(nodeId);

  // If clicking "all", also clear the filter
  if (nodeId === 'tree-all') {
    activeSourceFilter = null;
    renderMemoryList();
  }
  if (nodeId === 'tree-all-skills') {
    activeSkillSourceFilter = null;
    renderSkillList();
  }

  renderSidebar();
}

function setSourceFilter(toolId) {
  if (activeSourceFilter === toolId) {
    activeSourceFilter = null; // toggle off = show all
  } else {
    activeSourceFilter = toolId;
  }
  renderSidebar();
  renderMemoryList();
}

function setSkillSourceFilter(toolId) {
  if (activeSkillSourceFilter === toolId) {
    activeSkillSourceFilter = null;
  } else {
    activeSkillSourceFilter = toolId;
  }
  renderSidebar();
  renderSkillList();
}

// ========== FILTERING ==========
function getFilteredMemories() {
  let items = allMemories;
  if (activeSourceFilter !== null) items = items.filter(m => m.source === activeSourceFilter);
  const search = document.getElementById('search').value.toLowerCase().trim();
  if (search) items = items.filter(m => m.title.toLowerCase().includes(search) || (m.content && m.content.toLowerCase().includes(search)) || m.sourcePath.toLowerCase().includes(search));
  const checkedTypes = new Set([...document.querySelectorAll('#typeFilters input:checked')].map(c => c.value));
  items = items.filter(m => checkedTypes.has(m.type));
  return items;
}

function getFilteredSkills() {
  let items = allSkills;
  if (activeSkillSourceFilter !== null) items = items.filter(s => s.sourceTool === activeSkillSourceFilter);
  const search = document.getElementById('skillSearch').value.toLowerCase().trim();
  if (search) items = items.filter(s => s.name.toLowerCase().includes(search) || s.description.toLowerCase().includes(search));
  return items;
}

// ========== TYPE FILTER CHIPS ==========
document.querySelectorAll('.type-chip').forEach(chip => {
  chip.addEventListener('click', (e) => {
    e.preventDefault();
    const cb = chip.querySelector('input');
    cb.checked = !cb.checked;
    chip.classList.toggle('active', cb.checked);
    renderMemoryList();
  });
});

// ========== RENDER MEMORY LIST ==========
function renderMemoryList() {
  const filtered = getFilteredMemories();
  const container = document.getElementById('memoryList');
  document.getElementById('totalCount').textContent = '显示 ' + filtered.length + ' / ' + allMemories.length;
  updateSelectedCount();

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">没有找到匹配的记忆</div>';
    return;
  }

  // Group by type first, then by sourcePath
  const typeGroups = {};
  for (const m of filtered) {
    if (!typeGroups[m.type]) typeGroups[m.type] = {};
    if (!typeGroups[m.type][m.sourcePath]) typeGroups[m.type][m.sourcePath] = [];
    typeGroups[m.type][m.sourcePath].push(m);
  }

  const typeColors = { user: 'var(--type-user)', project: 'var(--type-project)', feedback: 'var(--type-feedback)', reference: 'var(--type-reference)', session: 'var(--type-session)' };

  const fileGroupChevronSvg = '<svg class="file-group-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';
  const catChevronSvg = '<svg class="cat-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';

  let html = '';
  const typeOrder = ['user', 'project', 'feedback', 'reference', 'session'];

  for (const type of typeOrder) {
    const pathGroups = typeGroups[type];
    if (!pathGroups) continue;

    const typeCount = Object.values(pathGroups).reduce((a, g) => a + g.length, 0);
    const isCollapsed = collapsedCategories.has(type);

    // Category header (clickable to collapse/expand)
    html += '<div class="category-header" onclick="toggleCategory(\'' + type + '\')">';
    html += catChevronSvg.replace('class="cat-chevron"', 'class="cat-chevron' + (isCollapsed ? ' rotated' : '') + '"');
    html += '<span class="cat-title" style="color:' + typeColors[type] + '">' + capitalize(type) + ' 记忆</span>';
    html += '<span class="cat-count">' + typeCount + '</span>';
    html += '</div>';

    // Collapsible container for file groups
    html += '<div class="category-children' + (isCollapsed ? ' collapsed' : '') + '">';

    // File groups within this type
    for (const [sourcePath, entries] of Object.entries(pathGroups)) {
      const fileName = sourcePath.split('/').pop().split('\\').pop();
      const groupKey = type + '::' + sourcePath;
      const isOpen = openFileGroups.has(groupKey);
      const allSelected = entries.every(e => selectedMemoryIds.has(e.id));

      html += '<div class="file-group' + (isOpen ? ' open' : '') + '">';
      html += '<div class="file-group-header" onclick="toggleFileGroup(\'' + escapeAttr(groupKey) + '\')">';
      html += fileGroupChevronSvg;
      html += '<input type="checkbox" ' + (allSelected ? 'checked' : '') + ' onclick="event.stopPropagation(); toggleGroupSelect(\'' + escapeAttr(groupKey) + '\', \'' + type + '\')">';
      html += '<span class="file-group-name" title="' + escapeAttr(sourcePath) + '">' + escapeHtml(fileName) + '</span>';
      html += '<span class="file-group-count">' + entries.length + '</span>';
      html += '</div>';

      html += '<div class="file-group-children">';
      for (const m of entries) {
        const isSelected = selectedMemoryIds.has(m.id);
        html += '<div class="memory-row' + (isSelected ? ' selected' : '') + '" ondblclick="showMemoryDetail(\'' + m.id + '\')">';
        html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation(); toggleMemorySelect(\'' + m.id + '\')">';
        html += '<div class="memory-row-info">';
        html += '<div class="memory-row-title">' + escapeHtml(m.title) + '</div>';
        html += '<div class="memory-row-preview">' + escapeHtml(m.content ? m.content.slice(0, 150) : '') + '</div>';
        html += '</div>';
        html += '<div class="memory-row-badges">';
        html += '<span class="pill pill-tool">' + escapeHtml(m.source) + '</span>';
        html += '<span class="pill pill-' + m.importance + '">' + escapeHtml(m.importance) + '</span>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // close category-children
  }

  container.innerHTML = html;
}

function toggleFileGroup(groupKey) {
  if (openFileGroups.has(groupKey)) openFileGroups.delete(groupKey);
  else openFileGroups.add(groupKey);
  renderMemoryList();
}

function toggleCategory(type) {
  if (collapsedCategories.has(type)) collapsedCategories.delete(type);
  else collapsedCategories.add(type);
  renderMemoryList();
}

function toggleGroupSelect(groupKey, type) {
  // Extract sourcePath from groupKey (type::sourcePath)
  const sourcePath = groupKey.substring(groupKey.indexOf('::') + 2);
  const entries = allMemories.filter(m => m.sourcePath === sourcePath && m.type === type);
  const allSelected = entries.every(e => selectedMemoryIds.has(e.id));
  if (allSelected) {
    entries.forEach(e => selectedMemoryIds.delete(e.id));
  } else {
    entries.forEach(e => selectedMemoryIds.add(e.id));
  }
  updateMigrateButton();
  renderMemoryList();
}

function toggleMemorySelect(id) {
  if (selectedMemoryIds.has(id)) selectedMemoryIds.delete(id);
  else selectedMemoryIds.add(id);
  updateMigrateButton();
  renderMemoryList();
}

function selectAll() {
  getFilteredMemories().forEach(m => selectedMemoryIds.add(m.id));
  updateMigrateButton();
  renderMemoryList();
}

function deselectAll() {
  selectedMemoryIds.clear();
  updateMigrateButton();
  renderMemoryList();
}

function selectSkillsAll() {
  getFilteredSkills().forEach(s => selectedSkillIds.add(s.id));
  updateMigrateButton();
  renderSkillList();
}

function deselectSkillsAll() {
  selectedSkillIds.clear();
  updateMigrateButton();
  renderSkillList();
}

function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = '已选：' + selectedMemoryIds.size;
}

function updateMigrateButton() {
  const count = currentTab === 'memories' ? selectedMemoryIds.size : selectedSkillIds.size;
  const btn = document.getElementById('migrateBtn');
  btn.disabled = count === 0;
  const label = currentTab === 'memories' ? '条记忆' : '个技能';
  btn.textContent = '迁移 ' + count + ' ' + label;
}

// ========== RENDER SKILL LIST ==========
function renderSkillList() {
  const filtered = getFilteredSkills();
  const container = document.getElementById('skillList');
  document.getElementById('skillsTotalCount').textContent = '显示 ' + filtered.length + ' / ' + allSkills.length;
  document.getElementById('skillsSelectedCount').textContent = '已选：' + selectedSkillIds.size;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty" style="grid-column:1/-1;">没有找到匹配的技能</div>';
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isSelected = selectedSkillIds.has(s.id);
    const sizeStr = s.size > 1024 * 1024 ? (s.size / 1024 / 1024).toFixed(1) + ' MB' : (s.size / 1024).toFixed(0) + ' KB';
    const warnLines = [];
    if (s.hasPackageJson) warnLines.push('⚠️ 包含 npm 依赖');
    if (s.hasRequirements) warnLines.push('⚠️ 包含 Python 依赖');
    return '<div class="skill-card' + (isSelected ? ' selected' : '') + '" onclick="showSkillDetail(\'' + s.id + '\')">' +
      '<div class="skill-card-header">' +
      '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation(); toggleSkillSelect(\'' + s.id + '\')">' +
      '<span class="skill-card-name">' + escapeHtml(s.name) + '</span>' +
      '<span class="pill pill-tool">' + escapeHtml(s.sourceTool) + '</span>' +
      '</div>' +
      '<div class="skill-card-desc">' + escapeHtml(s.description || '无描述') + '</div>' +
      '<div class="skill-card-meta">' +
      '<span>' + s.fileCount + ' 文件</span>' +
      '<span>' + sizeStr + '</span>' +
      (s.hasPackageJson ? '<span class="pill pill-medium">npm</span>' : '') +
      (s.hasRequirements ? '<span class="pill pill-high">pip</span>' : '') +
      '</div>' +
      (warnLines.length > 0 ? '<div class="skill-warn">' + warnLines.join('；') + '</div>' : '') +
      '</div>';
  }).join('');
}

function toggleSkillSelect(id) {
  if (selectedSkillIds.has(id)) selectedSkillIds.delete(id);
  else selectedSkillIds.add(id);
  updateMigrateButton();
  renderSkillList();
}

// ========== DETAIL MODAL ==========
async function showMemoryDetail(id) {
  try {
    const res = await fetch('/api/memories/' + id);
    const entry = await res.json();
    document.getElementById('modalTitle').textContent = entry.title;
    document.getElementById('modalBadges').innerHTML =
      '<span class="pill pill-tool">' + escapeHtml(entry.sourceTool) + '</span>' +
      '<span class="pill pill-type">' + escapeHtml(entry.type) + '</span>' +
      '<span class="pill pill-' + entry.importance + '">' + escapeHtml(entry.importance) + '</span>' +
      '<span style="font-size:12px;color:var(--text-tertiary);margin-left:6px;">' + escapeHtml(entry.sourcePath) + '</span>';
    document.getElementById('modalContent').textContent = entry.content;
    document.getElementById('modal').classList.add('active');
  } catch { alert('无法加载详情'); }
}

function showSkillDetail(id) {
  const skill = allSkills.find(s => s.id === id);
  if (!skill) return;
  const sizeStr = skill.size > 1024 * 1024 ? (skill.size / 1024 / 1024).toFixed(1) + ' MB' : (skill.size / 1024).toFixed(0) + ' KB';
  document.getElementById('modalTitle').textContent = skill.name;
  document.getElementById('modalBadges').innerHTML =
    '<span class="pill pill-tool">' + escapeHtml(skill.sourceTool) + '</span>' +
    '<span class="pill pill-low">' + skill.fileCount + ' files</span>' +
    '<span class="pill pill-medium">' + sizeStr + '</span>';
  document.getElementById('modalContent').textContent =
    '技能目录：' + skill.dirPath + '\n文件数：' + skill.fileCount + '\n大小：' + sizeStr + '\n\n描述：' + skill.description + '\n\n' +
    (skill.hasPackageJson ? '⚠️ 包含 npm 依赖 (package.json)\n' : '') +
    (skill.hasRequirements ? '⚠️ 包含 Python 依赖 (requirements.txt)\n' : '') +
    '\n迁移时将完整复制整个目录结构，包括所有代码、脚本、配置文件。';
  document.getElementById('modal').classList.add('active');
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

// ========== MIGRATE ==========
document.getElementById('migrateBtn').addEventListener('click', async () => {
  const targetTool = document.getElementById('targetTool').value;
  if (!targetTool) { alert('请选择目标工具'); return; }

  const btn = document.getElementById('migrateBtn');
  btn.disabled = true;
  btn.textContent = '迁移中...';

  try {
    let res;
    if (currentTab === 'memories') {
      res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [...selectedMemoryIds], targetTool }),
      });
    } else {
      res = await fetch('/api/migrate-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillIds: [...selectedSkillIds], targetTool }),
      });
    }
    const result = await res.json();
    showResult(result);
  } catch (err) {
    showResult({ success: false, errors: [err.message], backedUp: [], written: [] });
  }

  updateMigrateButton();
});

function showResult(result) {
  const panel = document.getElementById('resultPanel');
  const box = document.getElementById('resultBox');
  let html = '<h2 class="' + (result.success ? 'success' : 'error') + '">' + (result.success ? '迁移完成！' : '迁移失败') + '</h2>';
  if (result.backedUp?.length) {
    html += '<p style="color:var(--high);margin:14px 0 6px;font-size:14px;font-weight:500;">已备份 (' + result.backedUp.length + ')：</p><ul>';
    for (const f of result.backedUp) html += '<li>' + escapeHtml(f) + '</li>';
    html += '</ul>';
  }
  if (result.written?.length) {
    html += '<p style="color:var(--low);margin:14px 0 6px;font-size:14px;font-weight:500;">已写入 (' + result.written.length + ')：</p><ul>';
    for (const f of result.written) html += '<li>' + escapeHtml(f) + '</li>';
    html += '</ul>';
  }
  if (result.errors?.length) {
    html += '<p style="color:var(--critical);margin:14px 0 6px;font-size:14px;font-weight:500;">错误：</p><ul>';
    for (const e of result.errors) html += '<li>' + escapeHtml(e) + '</li>';
    html += '</ul>';
  }
  html += '<button class="result-close-btn" onclick="closeResult()">关闭</button>';
  box.innerHTML = html;
  panel.classList.add('active');
}

function closeResult() { document.getElementById('resultPanel').classList.remove('active'); }

// ========== UTILS ==========
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
function escapeAttr(str) { return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ========== EVENT LISTENERS ==========
document.getElementById('search').addEventListener('input', renderMemoryList);
document.getElementById('skillSearch').addEventListener('input', renderSkillList);
document.getElementById('modal').addEventListener('click', (e) => { if (e.target === document.getElementById('modal')) closeModal(); });

// ========== INIT ==========
loadData();
loadSkills();
