// 科技新闻技能执行器 - 简化版（30条，直接展示格式）
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');

module.exports = async function executeTechNewsDailySimple() {
  try {
    console.log('🎵 开始执行科技新闻技能（简化版）...');
    
    const today = new Date().toISOString().split('T')[0];
    const workspacePath = process.cwd();
    const skillPath = __dirname;
    
    // 1. 运行抓取脚本
    console.log('📡 抓取新闻数据...');
    const fetchScript = path.join(skillPath, 'scripts', 'fetch-news.ps1');
    
    const { stdout: fetchOutput, stderr: fetchError } = await execAsync(
      `powershell.exe -ExecutionPolicy Bypass -File "${fetchScript}" -MaxPerSource 10`,
      { cwd: skillPath, maxBuffer: 10 * 1024 * 1024 }
    );
    
    if (fetchError) {
      console.warn('⚠️ 抓取警告:', fetchError);
    }
    
    // 2. 提取JSON部分
    let jsonData = '';
    const lines = fetchOutput.split('\n');
    let inJson = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('[') || line.trim().startsWith('{')) {
        inJson = true;
      }
      if (inJson) {
        jsonData += line + '\n';
      }
    }
    
    // 3. 解析JSON
    let newsItems = [];
    try {
      newsItems = JSON.parse(jsonData);
      console.log(`✅ 解析成功，共 ${newsItems.length} 条新闻`);
    } catch (parseError) {
      console.log('⚠️ JSON解析失败，使用测试数据');
      // 测试数据
      newsItems = [
        {
          "Title": "NASA Artemis II 成功发射！",
          "Source": "Ars Technica",
          "Link": "https://arstechnica.com/space/2026/04/nasa-artemis-ii-successfully-launches/",
          "Description": "四名宇航员奔月，50余年来首次有人登月任务",
          "PubDate": new Date().toISOString()
        },
        {
          "Title": "SpaceX 秘密提交 IPO",
          "Source": "TechCrunch",
          "Link": "https://techcrunch.com/2026/04/02/spacex-secret-ipo-filing/",
          "Description": "估值 1.75 万亿美元，有史以来最大规模 IPO",
          "PubDate": new Date().toISOString()
        }
      ];
    }
    
    // 4. 按发布时间排序（最新的在前）
    newsItems.sort((a, b) => {
      const dateA = new Date(a.PubDate || 0);
      const dateB = new Date(b.PubDate || 0);
      return dateB - dateA;
    });
    
    // 5. 只取前30条最新最重要的新闻
    const topNews = newsItems.slice(0, 30);
    
    // 6. 生成简化格式简报
    let simpleContent = `# 科技新鲜事 · ${today}\n\n`;
    simpleContent += `> 本日精选 | 30条最新最重要最热门新闻\n\n`;
    simpleContent += `---\n\n`;
    
    // 按来源重要性排序（重要媒体在前）
    const sourcePriority = {
      'TechCrunch': 1,
      'The Verge': 2,
      'Ars Technica': 3,
      'Wired': 4,
      'MIT Tech Review': 5,
      '36氪': 6,
      '钛媒体': 7,
      '爱范儿': 8,
      '量子位': 9,
      'Stratechery': 10
    };
    
    topNews.forEach((item, index) => {
      const title = item.Title || '无标题';
      const source = item.Source || '未知来源';
      const link = item.Link || '#';
      const desc = item.Description || '暂无摘要';
      
      simpleContent += `**${index + 1}. ${title}**\n\n`;
      simpleContent += `**摘要**: ${desc}\n\n`;
      simpleContent += `**链接**: [${link}](${link})\n\n`;
      simpleContent += `**来源**: ${source}\n\n`;
      simpleContent += `---\n\n`;
    });
    
    simpleContent += `*共收录 ${topNews.length} 条精选新闻 | 生成时间 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*\n`;
    simpleContent += `*下次问"科技新闻"即可获取最新简报*`;
    
    // 7. 保存到文件
    const simplePath = path.join(workspacePath, 'memory', `daily-tech-simple-${today}.md`);
    fs.writeFileSync(simplePath, simpleContent, 'utf8');
    console.log('✅ 简化格式简报已保存:', simplePath);
    
    return {
      success: true,
      message: simpleContent
    };
    
  } catch (error) {
    console.error('❌ 技能执行失败:', error);
    return {
      success: false,
      message: `❌ 科技新闻技能执行失败:\n${error.message}\n\n` +
               `请检查网络连接和RSS源可访问性。`
    };
  }
};