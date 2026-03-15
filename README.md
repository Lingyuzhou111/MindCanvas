# 🎨 MindCanvas: Creative Flow Engine

> **MindCanvas** is an infinite node-based canvas focusing on "Efficiency" and "Minimalism." It is designed to strip away complex AI parameter configurations, allowing designers to focus entirely on creative inspiration. (After experiencing many mainstream or open-source infinite canvas projects and finding them somewhat lacking, I co-developed this one with Antigravity. Hope fellow creators enjoy it!)

[中文文档 (README_CN.md)](README_CN.md)

---

## 🔥 Core Features

- **☁️ Cloud Support**: Powered by the **BizyAir** platform, supporting high-speed cloud generation to reduce local resource consumption.
- **🔌 Multi-Source Adaptation**: Compatible with mainstream platforms like **SiliconFlow, ModelScope, Aliyun, Volcengine**, and custom third-party API interfaces. Both paid and free interfaces are supported.
- **🛠️ Full-Functionality**: Supports Text-to-Image, Image-to-Image, and Video generation (Future plans include AI Dubbing, Agent Skills, etc.).
- **⚡ High Concurrency**: Supports one-click batch execution of different group tasks with infinite concurrency (depending on your API quota and tier).
- **🖱️ Minimalist Interaction**: Double-click anywhere to add nodes; drag and drop to automatically connect and associate upstream/downstream nodes. Interaction is smooth and fluid.

---

## 🚀 Quick Start (For Beginners)

### 1. Prerequisites
- Install [Node.js](https://nodejs.org/) (v18+ recommended).
- Download or clone this repository to your local machine.

### 2. Installation
Open a terminal in the project root directory and run:
```bash
npm install
```

### 3. Configure API Keys (Critical Step)
MindCanvas needs to connect to cloud AI services to function. Follow these steps:

1. **Get your Keys**:
   - **BizyAir**: Register at [BizyAir Official](https://api.bizyair.cn) to get your API Key.
   - **SiliconFlow**: Get your key at [SiliconFlow](https://cloud.siliconflow.cn/i/IvfkhvET).
   - **ModelScope**: Get your key at [ModelScope](https://www.modelscope.cn/).
   - **Aliyun**: Get your key at [Aliyun Bailian](https://bailian.console.aliyun.com/).
   - **Volcengine**: Get your key at [Volcengine Console](https://console.volcengine.com/).
2. **Setup**:
   - Open the **API Settings** interface in the top-right corner of the MindCanvas workspace.
   - Find the corresponding platform (e.g., "BizyAir" or "SiliconFlow").
   - Paste your key into the **"API KEY"** input field.

### 4. Launch Project
Enter the following command in the terminal:
```bash
npm run dev
```
Alternatively, simply double-click **`Double-Click to Start.bat`** (双击一键启动.bat). Your browser will automatically open `http://localhost:5173`.

---

## 🧩 Using BizyAir Nodes

BizyAir is a core power source for MindCanvas, significantly improving generation efficiency.

### Basic Usage:
1. **Add Node**: Double-click the canvas and select nodes under the `BizyAir` menu.
2. **Configure Converter**: Use the `BizyAir Converter` node. Copy and paste `curl` example code from the BizyAir Web App into the main text box. Set the application name (EN/CN), and it will be converted into a modular feature that `BizyAir Generator` nodes can call with one click (you can also customize which parameters to expose).

---

## 🛠️ Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4
- **Backend**: Node.js + Express (API forwarding and OSS upload)
- **Icons**: Lucide React

---

## 🤝 Contribution & Feedback

This project draws inspiration and interaction patterns from many mainstream infinite canvas projects, including but not limited to Lovart, Tapnow, Mulan, FlowMuse, Mayi Canvas, and Tapnow-Studio-PP. You may find some familiar features while using MindCanvas.

We are grateful to these excellent projects and to **Antigravity** for its powerful support.

If you have great ideas or found a bug, feel free to submit an Issue or Pull Request.

---

## 🗺️ Roadmap
- Support for Video/Audio input nodes, video parsing, and AI dubbing.
- Batch management of history records.
- One-click call for prompt templates.
- Prompt case library.
- Integration with **OpenClaw** as the "brain" (time and energy permitting).
- Multi-Agent interaction and Skills integration.

---

## 💬 Community
If you are interested in this project or have any suggestions, feel free to join our community exchange group.

---

## 📄 License

This project is licensed under the [Apache 2.0 License](LICENSE).

---

**MindCanvas - Let design return to inspiration itself.**
