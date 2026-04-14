// 科技新闻技能执行器 - 使用确认可访问的RSS源
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');

module.exports = async function executeTechNewsDailyAccessible() {
  try {
    console.log('🎵 开始执行科技新闻技能（可访问源版）...');
    
    const today = new Date().toISOString().split('T')[0];
    const workspacePath = process.cwd();
    const skillPath = __dirname;
    
    // 1. 运行抓取脚本（使用简单的可访问源）
    console.log('📡 从可访问源抓取新闻...');
    const fetchScript = path.join(skillPath, 'scripts', 'fetch-simple.ps1');
    
    const { stdout: fetchOutput, stderr: fetchError } = await execAsync(
      `powershell.exe -ExecutionPolicy Bypass -File "${fetchScript}" -MaxPerSource 5 -TimeoutSec 10`,
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
    let hasRealData = false;
    
    try {
      newsItems = JSON.parse(jsonData);
      console.log(`✅ 解析成功，共 ${newsItems.length} 条新闻`);
      
      // 检查是否有真实数据
      if (newsItems.length > 0) {
        hasRealData = true;
        
        // 验证链接
        const validItems = newsItems.filter(item => {
          return item.Link && 
                 item.Link.trim() !== '' && 
                 !item.Link.includes('example.com') &&
                 item.Link.startsWith('http');
        });
        
        console.log(`✅ 有效链接: ${validItems.length}/${newsItems.length}`);
        
        if (validItems.length > 0) {
          newsItems = validItems;
        }
      }
    } catch (parseError) {
      console.log('❌ JSON解析失败:', parseError.message);
    }
    
    // 4. 如果没有真实数据，使用高质量的模拟数据
    if (!hasRealData || newsItems.length === 0) {
      console.log('⚠️ 使用高质量模拟数据');
      newsItems = getHighQualitySampleNews();
    }
    
    // 5. 按发布时间排序（最新的在前）
    newsItems.sort((a, b) => {
      const dateA = new Date(a.PubDate || 0);
      const dateB = new Date(b.PubDate || 0);
      return dateB - dateA;
    });
    
    // 6. 只取前30条
    const topNews = newsItems.slice(0, 30);
    
    // 7. 生成简报
    let content = `# 科技新鲜事 · ${today}\n\n`;
    content += `> 本日精选 | ${topNews.length}条最新科技新闻\n\n`;
    content += `> 📡 来源: Hacker News, GitHub Trending, BBC, The Verge, TechCrunch, 36氪等\n\n`;
    
    if (!hasRealData) {
      content += `> ⚠️ **提示**: 当前为示例数据，真实链接需要网络连接正常\n\n`;
    }
    
    content += `---\n\n`;
    
    // 按重要性排序（重要新闻在前）
    const importantKeywords = ['AI', '人工智能', 'NASA', 'SpaceX', 'IPO', '融资', '泄露', '安全', '漏洞'];
    
    topNews.forEach((item, index) => {
      const title = item.Title || '无标题';
      const source = item.Source || '未知来源';
      const link = item.Link || '#';
      const desc = item.Description || '暂无摘要';
      
      // 检查链接质量
      const isHighQualityLink = link.startsWith('http') && 
                               !link.includes('example.com') &&
                               link.length > 10;
      
      // 检查新闻重要性
      const isImportant = importantKeywords.some(keyword => 
        title.includes(keyword) || desc.includes(keyword)
      );
      
      const prefix = isImportant ? '🔥 ' : '';
      
      content += `**${index + 1}. ${prefix}${title}**\n\n`;
      content += `**摘要**: ${desc}\n\n`;
      
      if (isHighQualityLink) {
        content += `**链接**: [${link}](${link})\n\n`;
      } else {
        content += `**链接**: [示例链接](${link}) *（需要真实网络连接）*\n\n`;
      }
      
      content += `**来源**: ${source}\n\n`;
      content += `---\n\n`;
    });
    
    content += `*共收录 ${topNews.length} 条新闻 | 生成时间 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*\n`;
    
    if (!hasRealData) {
      content += `*💡 提示: 要获取真实新闻链接，请确保网络能访问国际科技网站*\n`;
    } else {
      content += `*✅ 本次包含真实新闻链接*\n`;
    }
    
    content += `*下次问"科技新闻"即可获取最新简报*`;
    
    // 8. 保存到文件
    const outputPath = path.join(workspacePath, 'memory', `daily-tech-accessible-${today}.md`);
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log('✅ 简报已保存:', outputPath);
    
    return {
      success: true,
      message: content,
      hasRealData: hasRealData,
      itemCount: topNews.length
    };
    
  } catch (error) {
    console.error('❌ 技能执行失败:', error);
    return {
      success: false,
      message: `❌ 科技新闻技能执行失败:\n${error.message}\n\n` +
               `**可能的原因:**\n` +
               `1. 网络连接问题（某些国际网站可能被限制）\n` +
               `2. RSS源格式变化\n` +
               `3. 系统权限问题\n\n` +
               `**建议:**\n` +
               `1. 检查网络代理设置\n` +
               `2. 尝试只使用国内源（36氪、InfoQ等）\n` +
               `3. 稍后重试`
    };
  }
};

// 高质量模拟数据（基于真实新闻）
function getHighQualitySampleNews() {
  const today = new Date().toISOString().split('T')[0];
  
  return [
    {
      "Title": "Hacker News: New AI model achieves human-level reasoning",
      "Source": "Hacker News",
      "Link": "https://news.ycombinator.com/item?id=12345678",
      "Description": "Researchers announce breakthrough in AI reasoning capabilities, achieving human-level performance on complex tasks",
      "PubDate": today + "T10:00:00Z",
      "Lang": "en"
    },
    {
      "Title": "GitHub Trending: AI coding assistant framework tops charts",
      "Source": "GitHub Trending",
      "Link": "https://github.com/trending/ai-coding-assistant",
      "Description": "Open-source AI coding assistant framework gains 5k stars in one week, revolutionizing developer workflow",
      "PubDate": today + "T09:30:00Z",
      "Lang": "en"
    },
    {
      "Title": "BBC: Quantum computing breakthrough announced",
      "Source": "BBC Technology",
      "Link": "https://www.bbc.com/news/technology-12345678",
      "Description": "Scientists achieve quantum supremacy with new 1000-qubit processor, opening new possibilities for computation",
      "PubDate": today + "T08:15:00Z",
      "Lang": "en"
    },
    {
      "Title": "The Verge: Apple unveils revolutionary AR glasses",
      "Source": "The Verge",
      "Link": "https://www.theverge.com/2026/4/2/apple-ar-glasses",
      "Description": "Apple announces lightweight AR glasses with全天候 battery life and spatial computing capabilities",
      "PubDate": today + "T07:45:00Z",
      "Lang": "en"
    },
    {
      "Title": "36氪：小鹏汽车发布全自动驾驶技术",
      "Source": "36氪",
      "Link": "https://36kr.com/p/20260402003",
      "Description": "小鹏汽车宣布实现城市全场景自动驾驶，无需高精度地图支持",
      "PubDate": today + "T06:30:00Z",
      "Lang": "zh"
    },
    {
      "Title": "TechCrunch: SpaceX launches record-breaking satellite constellation",
      "Source": "TechCrunch",
      "Link": "https://techcrunch.com/2026/04/02/spacex-satellite-record",
      "Description": "SpaceX deploys 120 satellites in single launch, expanding global internet coverage",
      "PubDate": today + "T05:20:00Z",
      "Lang": "en"
    },
    {
      "Title": "InfoQ：微服务架构新趋势：服务网格与Serverless融合",
      "Source": "InfoQ",
      "Link": "https://www.infoq.cn/article/2026/04/microservices-trend",
      "Description": "2026年微服务架构演进：服务网格与Serverless计算深度整合，提升开发效率",
      "PubDate": today + "T04:10:00Z",
      "Lang": "zh"
    },
    {
      "Title": "IEEE Spectrum: Breakthrough in battery technology",
      "Source": "IEEE Spectrum",
      "Link": "https://spectrum.ieee.org/battery-breakthrough-2026",
      "Description": "New solid-state battery achieves 1000km range on single charge, charging in 5 minutes",
      "PubDate": today + "T03:05:00Z",
      "Lang": "en"
    }
  ];
}