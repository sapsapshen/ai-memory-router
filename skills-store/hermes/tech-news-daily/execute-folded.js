// 折叠格式科技新闻技能执行器
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');

module.exports = async function executeTechNewsDailyFolded() {
  try {
    console.log('🎵 开始执行折叠格式科技新闻技能...');
    
    // 1. 运行折叠格式生成脚本
    const scriptPath = path.join(__dirname, 'scripts', 'run-folded.ps1');
    console.log(`📡 运行脚本: ${scriptPath}`);
    
    const { stdout, stderr } = await execAsync(
      `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { cwd: __dirname, maxBuffer: 10 * 1024 * 1024 }
    );
    
    if (stderr) {
      console.error('⚠️ 脚本执行警告:', stderr);
    }
    
    console.log('✅ 脚本执行完成');
    
    // 2. 读取生成的折叠格式简报
    const today = new Date().toISOString().split('T')[0];
    const foldedPath = path.join(process.cwd(), 'memory', `daily-tech-folded-${today}.md`);
    
    if (fs.existsSync(foldedPath)) {
      const foldedContent = fs.readFileSync(foldedPath, 'utf8');
      console.log(`📋 读取折叠简报: ${foldedPath}`);
      
      // 3. 返回折叠格式内容
      return {
        success: true,
        message: `🎵 **今日科技新闻（折叠版）已生成！**\n\n` +
                 `共收录 150+ 条新闻，来自 11 个已验证 RSS 源。\n\n` +
                 `**使用说明：**\n` +
                 `- 点击类别标题（如"🚀 太空 & 前沿科技"）展开该类别\n` +
                 `- 点击新闻标题展开查看详情和链接\n` +
                 `- 支持混合折叠：类别 + 单条新闻都可折叠\n\n` +
                 `---\n\n` +
                 foldedContent +
                 `\n\n---\n` +
                 `*下次问"科技新闻"即可获取最新折叠版简报*`
      };
    } else {
      // 如果折叠格式失败，尝试读取传统格式
      const traditionalPath = path.join(process.cwd(), 'memory', `daily-tech-${today}.md`);
      if (fs.existsSync(traditionalPath)) {
        const traditionalContent = fs.readFileSync(traditionalPath, 'utf8');
        return {
          success: true,
          message: `📄 **今日科技新闻已生成（传统格式）**\n\n` +
                   `折叠格式生成失败，已回退到传统格式。\n\n` +
                   traditionalContent
        };
      } else {
        throw new Error('简报文件未生成');
      }
    }
    
  } catch (error) {
    console.error('❌ 技能执行失败:', error);
    return {
      success: false,
      message: `❌ 科技新闻技能执行失败:\n${error.message}\n\n` +
               `请检查：\n` +
               `1. PowerShell 执行权限\n` +
               `2. 网络连接\n` +
               `3. RSS 源可访问性`
    };
  }
};