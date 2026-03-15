# 🎨 MindCanvas: 创意灵感引擎 (Creative Flow Engine)

> **MindCanvas** 是一款专注于“高效”与“极简”的节点式无限画布。它旨在剥离复杂的AI参数配置，让设计师将全部精力集中在创意灵感之上。（本人体验了大量市面主流或开源的无限画布项目，但或多或少总有些不顺手的地方，于是配合Antigravity写了一个，希望有相同感受的朋友会喜欢。）

[English README](README.md)

---

## 🔥 核心特性

- **云端支持**：基于BizyAir平台提供的强大算力，支持云端高速生成，减轻本地资源消耗。
- **多源适配**：适配SiliconFlow、ModelScope、阿里云、火山引擎等主流平台和自定义第三方API接口，付费平台与免费接口兼顾，丰俭由人。
- **功能齐全**：支持文本、图片、视频生成，满足不同需求（后续还会考虑增加AI配音、Agent Skills等相关功能）。
- **高效并发**：支持一键批量执行不同类型的群组任务，无限并发（取决于你的API额度与等级）。
- **极简交互**：双击空白处即可添加节点，拖拽连线自动关联上下游相关节点，操作如丝般顺滑。
---

## 🚀 快速上手（新手必读）

### 1. 环境准备
- 安装 [Node.js](https://nodejs.org/) (推荐 v18+)。
- 下载本项目代码到本地。

### 2. 安装依赖
在项目根目录下打开终端，运行：
```bash
npm install
```

### 3. 配置 API Key (关键步骤)
MindCanvas 需要连接云端 AI 服务才能工作。请按照以下步骤配置：

1. **获取 Key**：
   - **BizyAir**: 访问 [BizyAir 官网](https://api.bizyair.cn) 注册并获取 API Key。
   - **SiliconFlow**: 访问 [硅基流动](https://cloud.siliconflow.cn/i/IvfkhvET) 获取 Key。
   - **魔搭平台**: 访问 [魔搭](https://www.modelscope.cn/) 注册并获取 API Key。
   - **阿里云**: 访问 [阿里云](https://bailian.console.aliyun.com/) 注册并获取 API Key。
   - **火山引擎**: 访问 [火山引擎](https://console.volcengine.com/) 注册并获取 API Key。
   - **第三方平台**: 访问 [第三方平台](https://www.example.com/) 注册并获取 API Key。
2. **填入配置**：
   - 打开画布右上角的API设置界面。
   - 找到对应的平台（如 `"BizyAir"` 或 `"SiliconFlow"`）。
   - 将你的 Key 粘贴到 `"API KEY"` 输入框中。

### 4. 运行项目
在终端中输入：
```bash
npm run dev
```
之后浏览器会自动打开 `http://localhost:5173`，你就可以开始创作了！

---
或直接双击 `双击一键启动.bat` 运行

## 🧩 如何使用 BizyAir 节点

BizyAir 是 MindCanvas 的强大动力来源，能够显著提升生成效率。

### 基础用法：
1. **添加节点**：左键双击画布，选择 `BizyAir` 菜单下的节点。
2. **配置转换器**：使用 `BizyAir Converter` 节点，将BizyAir Web应用的curl示例代码复制粘贴进主文本框，设置好应用中英文名，便可转换为模块化功能供 `BizyAir Generator` 节点一键调用（可以自定义暴露哪些参数）。

---

## 🛠️ 技术架构

- **前端**: React 19 + Vite + Tailwind CSS 4
- **后端**: Node.js + Express (处理 API 转发与 OSS 上传)
- **图标**: Lucide React

---

## 🤝 贡献与反馈

本项目借鉴和参考了大量市场主流无限画布类项目的交互体验和实现方式，包括但不限于Lovart/Tapnow/Mulan/FlowMuse/麻衣画布/Tapnow-Studio-PP等闭源或开源项目，因此您在使用本画布项目的时候可能会看到一些似曾相识的功能。
在此感谢这些优秀的项目，也感谢Antigravity提供的强大支持。
如果你有任何好的想法或发现了 Bug，欢迎提交 Issue 或 Pull Request。

---
## 后续计划
-支持视频/音频等输入节点以及视频解析与AI配音功能
-支持批量管理历史记录
-支持一键调用提示词模版
-增加提示词案例库
-支持接入OpenClaw作为大脑（如果时间精力允许的前提下）
-支持多Agent交互和Skills集成

## 交流
如果你对本项目感兴趣或者有任何好的想法，欢迎加入我们的交流群。


## 📄 开源协议

本项目采用 [Apache 2.0 License](LICENSE) 开源协议。

---

**MindCanvas - 让设计回归灵感本身。**
