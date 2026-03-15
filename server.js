import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// 配置文件路径定义
const CONFIG_DIR = path.join(__dirname, 'config');
const MAIN_CONFIG_FILE = path.join(CONFIG_DIR, 'main_api_config.json');
const TP1_FILE = path.join(CONFIG_DIR, 'third_party_1.json');
const TP2_FILE = path.join(CONFIG_DIR, 'third_party_2.json');
const TP3_FILE = path.join(CONFIG_DIR, 'third_party_3.json');

app.use(cors());
app.use(express.json());

// 静态文件服务：允许前端直接通过 URL 访问保存的图片
const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}
app.use('/output', express.static(OUTPUT_DIR));

/**
 * 保存图片逻辑
 * POST /api/save
 * Body: { imageUrl, platform, model, prompt }
 */
app.post('/api/save', async (req, res) => {
  const { imageUrl, platform, model, prompt, generationTime, type = 'image' } = req.body;

  if (!imageUrl || !platform || !model) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // 1. 创建目录结构: output/Platform/Model
    const targetDir = path.join(OUTPUT_DIR, platform, model);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 2. 下载并保存文件 (图片/视频)
    const timestamp = Date.now();
    const ext = type === 'video' ? '.mp4' : '.png';
    const filename = `${timestamp}${ext}`;
    const filePath = path.join(targetDir, filename);

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    // 3. 同时保存一个 metadata.json 记录提示词和耗时
    const metaPath = path.join(targetDir, `${timestamp}.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      prompt,
      timestamp,
      platform,
      model,
      originalUrl: imageUrl,
      generationTime,
      type
    }, null, 2));

    const relativePath = `output/${platform}/${model}/${filename}`;
    console.log(`[Save] Image saved to: ${filePath}`);

    res.json({
      success: true,
      path: relativePath,
      filename,
      timestamp
    });
  } catch (error) {
    console.error('[Save Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 专门用于处理前端本地上传的 Base64 图片/视频
 * POST /api/upload
 * Body: { dataUrl, filename }
 */
app.post('/api/upload', async (req, res) => {
  try {
    const { dataUrl, filename: originalFilename } = req.body;
    if (!dataUrl) return res.status(400).json({ error: 'Missing dataUrl' });

    // 1. 确保上传目录存在
    const uploadDir = path.join(OUTPUT_DIR, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 2. 解析 Base64
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid DataURL format' });

    const mime = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // 3. 生成文件名
    const timestamp = Date.now();
    const ext = mime.split('/')[1] || 'png';
    const filename = `${timestamp}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, buffer);

    const relativePath = `/output/uploads/${filename}`;
    console.log(`[Upload] Local file saved to: ${filePath}`);

    res.json({
      success: true,
      path: relativePath,
      filename
    });
  } catch (error) {
    console.error('[Upload Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 临时下载并保存外部媒体 URL
 * POST /api/save-temp
 * Body: { url }
 */
app.post('/api/save-temp', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    // 1. 确保临时目录存在
    const tempDir = path.join(OUTPUT_DIR, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 2. 获取并保存文件
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || '';
    
    // 简易后缀识别
    const ext = contentType.includes('video') ? '.mp4' : '.png';
    const filename = `temp_${Date.now()}${ext}`;
    const filePath = path.join(tempDir, filename);

    fs.writeFileSync(filePath, Buffer.from(buffer));

    const relativePath = `/output/temp/${filename}`;
    console.log(`[SaveTemp] External resource saved to: ${filePath}`);

    res.json({
      success: true,
      path: relativePath
    });
  } catch (error) {
    console.error('[SaveTemp Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取历史记录逻辑
 * GET /api/history
 */
app.get('/api/history', (req, res) => {
  try {
    const history = [];

    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          walkDir(fullPath);
        } else if (file.endsWith('.png') || file.endsWith('.mp4')) {
          const ext = path.extname(file);
          const timestamp = path.basename(file, ext);
          const metaPath = path.join(dir, `${timestamp}.json`);
          let metadata = { type: file.endsWith('.mp4') ? 'video' : 'image' };
          if (fs.existsSync(metaPath)) {
            metadata = { ...metadata, ...JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
          }

          // 计算相对于 OUTPUT_DIR 的相对路径用于前端展示
          const relativePath = path.relative(OUTPUT_DIR, fullPath).replace(/\\/g, '/');

          history.push({
            url: `/output/${relativePath}`,
            timestamp: parseInt(timestamp),
            ...metadata
          });
        }
      });
    };

    if (fs.existsSync(OUTPUT_DIR)) {
      walkDir(OUTPUT_DIR);
    }

    // 按时间降序排列
    history.sort((a, b) => b.timestamp - a.timestamp);
    res.json(history);
  } catch (error) {
    console.error('[History Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除历史记录
 * POST /api/history/delete
 * Body: { url: '/output/...' }
 */
app.post('/api/history/delete', (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.startsWith('/output/')) return res.status(400).json({ error: 'Invalid URL format' });

    const relativePath = url.replace('/output/', '');
    const itemPath = path.join(OUTPUT_DIR, relativePath);
    const ext = path.extname(itemPath);
    const metaPath = itemPath.replace(ext, '.json');

    if (fs.existsSync(itemPath)) fs.unlinkSync(itemPath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

    res.json({ success: true });
  } catch (error) {
    console.error('[Delete History Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 在本地资源管理器中打开文件夹
 * POST /api/open-folder
 * Body: { url: '/output/...' } // 如果传 url 则打开对应的文件夹，否则打开根目录
 */
app.post('/api/open-folder', (req, res) => {
  try {
    const { url } = req.body;
    let targetDir = OUTPUT_DIR;

    if (url && url.startsWith('/output/')) {
      const relativePath = url.replace('/output/', '');
      const filePath = path.join(OUTPUT_DIR, relativePath);
      targetDir = path.dirname(filePath);
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Windows only command to open explorer
    const command = `explorer.exe "${targetDir}"`;
    exec(command, (error) => {
      if (error) {
        console.error(`Error opening folder: ${error}`);
        return res.status(500).json({ error: 'Failed to open folder' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('[Open Folder Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API Configuration Sync (v2)
 * GET /api/config/v2/all - Reads 4 JSON files
 * POST /api/config/v2/save-all - Saves to 4 JSON files
 */
app.get('/api/config/v2/all', (req, res) => {
  try {
    const readJson = (file) => {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
      return {};
    };

    res.json({
      main: readJson(MAIN_CONFIG_FILE),
      tp1: readJson(TP1_FILE),
      tp2: readJson(TP2_FILE),
      tp3: readJson(TP3_FILE)
    });
  } catch (error) {
    console.error('[Config v2 Get Error]', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config/v2/save-all', (req, res) => {
  try {
    const { main, tp1, tp2, tp3 } = req.body;
    
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (main) fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify(main, null, 4));
    if (tp1) fs.writeFileSync(TP1_FILE, JSON.stringify(tp1, null, 4));
    if (tp2) fs.writeFileSync(TP2_FILE, JSON.stringify(tp2, null, 4));
    if (tp3) fs.writeFileSync(TP3_FILE, JSON.stringify(tp3, null, 4));

    res.json({ success: true });
  } catch (error) {
    console.error('[Config v2 Save Error]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * BizyAir Apps Configuration
 * GET /api/config/bizyair/apps - Returns bizyair_apps.json
 * POST /api/config/bizyair/apps - Adds a new app to bizyair_apps.json
 */
const BIZYAIR_APPS_FILE = path.join(CONFIG_DIR, 'bizyair_apps.json');

app.get('/api/config/bizyair/apps', (req, res) => {
  try {
    if (fs.existsSync(BIZYAIR_APPS_FILE)) {
      const data = JSON.parse(fs.readFileSync(BIZYAIR_APPS_FILE, 'utf8'));
      res.json(data);
    } else {
      res.json({ apps: [] });
    }
  } catch (error) {
    console.error('[BizyAir Apps Error]', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config/bizyair/apps', (req, res) => {
  try {
    const newApp = req.body;
    
    if (!newApp || !newApp.id || !newApp.name) {
      return res.status(400).json({ error: 'Missing required fields: id and name' });
    }

    // 读取现有配置
    let data = { apps: [] };
    if (fs.existsSync(BIZYAIR_APPS_FILE)) {
      data = JSON.parse(fs.readFileSync(BIZYAIR_APPS_FILE, 'utf8'));
    }

    // 检查是否已存在相同 ID 的应用
    const existingIndex = data.apps.findIndex(app => app.id === newApp.id);
    if (existingIndex >= 0) {
      // 更新现有应用
      data.apps[existingIndex] = newApp;
      console.log(`[BizyAir Apps] Updated app: ${newApp.id}`);
    } else {
      // 添加新应用
      data.apps.push(newApp);
      console.log(`[BizyAir Apps] Added new app: ${newApp.id}`);
    }

    // 保存到文件
    fs.writeFileSync(BIZYAIR_APPS_FILE, JSON.stringify(data, null, 2));
    
    res.json({ success: true, app: newApp });
  } catch (error) {
    console.error('[BizyAir Apps Save Error]', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
