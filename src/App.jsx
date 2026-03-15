import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import GeneratorNode from './components/GeneratorNode';
import ResultDisplayNode from './components/ResultDisplayNode';
import HistorySidebar from './components/HistorySidebar';
import TextNode from './components/TextNode';
import ChatNode from './components/ChatNode';
import ImageNode from './components/ImageNode';
import VideoNode from './components/VideoNode';
import { BizyAirNode } from './components/BizyAirNode';
import { BizyAirConverterNode } from './components/BizyAirConverterNode';
import { Settings, Plus, X, AlertCircle, History, Sparkles, Monitor, MessageSquare, Video, Layout, Trash2, Type, AlignLeft, Image as ImageIcon, Download, Save, Sun, Moon, Lock, Unlock, Undo2, Redo2, Eye, EyeOff, Component, Settings2, ChevronRight, Users, UserMinus, AlignRight, AlignStartVertical, AlignEndVertical, AlignStartHorizontal, AlignEndHorizontal, AlignCenterHorizontal, AlignCenterVertical, Columns, Rows, ArrowRightCircle, Copy, ClipboardPaste, Upload, SquarePen, ImageUp, SquarePlay, MessageSquarePlus, ScanEye, Biohazard, Play } from 'lucide-react';

const EMPTY_ARRAY = [];

const GROUP_THEMES = [
  { id: 'grey', color: '#475569', bg: 'rgba(71, 85, 105, 0.15)' },
  { id: 'red', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' },
  { id: 'orange', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  { id: 'green', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  { id: 'cyan', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  { id: 'blue', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  { id: 'purple', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
];

export default function App() {
  // --- 画布基础状态 ---
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [isViewLocked, setIsViewLocked] = useState(false);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const pendingGroupDrag = useRef(null); // { id: string, initialOffsets: { [nodeId]: { dx, dy } } }

  // --- 端口偏移量缓存 (用于精确连线对齐) ---
  // 存储 { [portId]: { dx, dy } }，其中 dx/dy 是相对于所属节点左上角的偏移
  const [portOffsets, setPortOffsets] = useState({});

  // --- 业务数据状态 ---
  const [nodes, setNodes] = useState(() => {
    try {
      const saved = localStorage.getItem('easy-canvas-data-nodes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [links, setLinks] = useState(() => {
    try {
      const saved = localStorage.getItem('easy-canvas-data-links');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [groups, setGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('easy-canvas-data-groups');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [projectName, setProjectName] = useState(() => {
    try {
      return localStorage.getItem('easy-canvas-project-name') || 'Untitled Flow';
    } catch { return 'Untitled Flow'; }
  });

  const [isEditingProjectName, setIsEditingProjectName] = useState(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // --- Theme State ---
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('easy-canvas-theme') || 'dark';
    } catch { return 'dark'; }
  });

  const [qualityMode, setQualityMode] = useState(() => {
    try {
      return localStorage.getItem('easy-canvas-quality') || 'ultra';
    } catch { return 'ultra'; }
  });

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    try {
      localStorage.setItem('easy-canvas-theme', theme);
    } catch (e) { console.error('Failed to save theme', e); }

    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('easy-canvas-quality', qualityMode);
    } catch (e) { console.error('Failed to save quality mode', e); }
  }, [qualityMode]);

  // Persistent Project Name
  useEffect(() => {
    try {
      localStorage.setItem('easy-canvas-project-name', projectName);
    } catch (e) { console.error('Failed to save project name', e); }
  }, [projectName]);

  useEffect(() => {
    if (nodes.length > 0 || links.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [nodes, links]);

  // --- 关键：在每次 DOM 提交后测量并缓存端口坐标 ---
  // 使用 useLayoutEffect 保证在浏览器绘制前读取已提交的 DOM
  useLayoutEffect(() => {
    const newOffsets = {};
    document.querySelectorAll('[data-port-visual]').forEach(el => {
      const portId = el.getAttribute('data-port-visual');
      const nodeContainer = el.closest('[id^="node-container-"]');
      if (!nodeContainer) return;

      const portRect = el.getBoundingClientRect();
      const nodeRect = nodeContainer.getBoundingClientRect();

      newOffsets[portId] = {
        dx: Math.round((portRect.left + portRect.width / 2 - nodeRect.left) / view.zoom),
        dy: Math.round((portRect.top + portRect.height / 2 - nodeRect.top) / view.zoom),
      };
    });

    // 仅在数据真正变化时更新，避免无意义重绘
    setPortOffsets(prev => {
      if (JSON.stringify(prev) === JSON.stringify(newOffsets)) return prev;
      return newOffsets;
    });
  }, [nodes, links, view.zoom]); // 增加 view.zoom 依赖，确保缩放后偏移依然准确

  useEffect(() => {
    if (!import.meta.env.PROD) return; // Skip in dev mode to avoid annoying prompts during file changes

    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Standard way to trigger browser prompt
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleExport = async () => {
    const data = { nodes, links, view };
    const jsonStr = JSON.stringify(data, null, 2);

    const now = new Date();
    // Use padStart(2, '0') to ensure consistent YYMMDD_HHMMSS formatting
    const timestampStr =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      '_' +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');

    const fileName = `workflow_${timestampStr}.json`;

    try {
      if (window.showSaveFilePicker) {
        // Use modern File System Access API
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        setHasUnsavedChanges(false);
      } else {
        // Fallback for older browsers
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert("保存失败：" + err.message);
      }
    }
  };

  const fileInputRef = useRef(null);
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.nodes && data.links) {
          setNodes(data.nodes);
          setLinks(data.links);
          if (data.view) setView(data.view);
          setHasUnsavedChanges(false);
        } else {
          throw new Error("Invalid Format");
        }
      } catch (err) {
        alert("导入失败：文件格式不正确或已损坏");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  }; // [{ from: id, to: id }]
  const [nodeResults, setNodeResults] = useState({}); // { [nodeId]: imageUrls[] }

  // 监听 nodes 和 links 变化，存入 localStorage (剔除体积过大的 base64 图片)
  useEffect(() => {
    const nodesToSave = nodes;
    try {
      localStorage.setItem('easy-canvas-data-nodes', JSON.stringify(nodesToSave));
    } catch (e) {
      console.error('Failed to save nodes to localStorage', e);
    }
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem('easy-canvas-data-links', JSON.stringify(links));
  }, [links]);

  useEffect(() => {
    localStorage.setItem('easy-canvas-data-groups', JSON.stringify(groups));
  }, [groups]);

  const [apiKeys, setApiKeys] = useState({ SiliconFlow: '', ModelScope: '', Aliyun: '', T8star: '', BizyAir: '', Volcengine: '', ThirdParty1: { platform: '', api_key: '' }, ThirdParty2: { platform: '', api_key: '' }, ThirdParty3: { platform: '', api_key: '' } });
  const [modelConfigs, setModelConfigs] = useState({ chat: {}, image: {}, video: {} });
  const [activeSettingsTab, setActiveSettingsTab] = useState('recommended'); // 'recommended', 'tp1', 'tp2', 'tp3'
  const [activeTPSubTab, setActiveTPSubTab] = useState('chat'); // 'chat', 'image', 'video'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showKeys, setShowKeys] = useState({}); // { [platform]: boolean }

  const [sequentialRun, setSequentialRun] = useState(null); // { groupId, queue: nodeId[], currentIndex: number }
  const [editingGroupTitleId, setEditingGroupTitleId] = useState(null);

  // --- Sequential Execution Orchestrator ---
  useEffect(() => {
    if (!sequentialRun) return;

    const { queue, currentIndex } = sequentialRun;
    if (currentIndex >= queue.length) {
      setSequentialRun(null);
      return;
    }

    const currentNodeId = queue[currentIndex];
    const currentNode = nodes.find(n => n.id === currentNodeId);
    const status = currentNode?.data?.status;

    if (status === 'success') {
      // Current node finished successfully, move to next
      const nextIndex = currentIndex + 1;
      if (nextIndex < queue.length) {
        const nextNodeId = queue[nextIndex];
        setNodes(prev => prev.map(n => n.id === nextNodeId ? { ...n, data: { ...n.data, runTrigger: Date.now() } } : n));
        setSequentialRun(prev => ({ ...prev, currentIndex: nextIndex }));
      } else {
        setSequentialRun(null);
      }
    } else if (status === 'error') {
      // Error occurred, stop sequential run
      setSequentialRun(null);
    }
  }, [nodes, sequentialRun]);

  // --- Undo Logic Helpers ---
  const takeSnapshot = useCallback(() => {
    setUndoStack(prev => {
      const newStack = [...prev, {
        nodes: JSON.parse(JSON.stringify(nodes)),
        links: JSON.parse(JSON.stringify(links)),
        groups: JSON.parse(JSON.stringify(groups))
      }];
      return newStack.slice(-10); // Limit to 10 steps
    });
    setRedoStack([]); // Clear redo stack on new action
  }, [nodes, links, groups]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastState = undoStack[undoStack.length - 1];

    // Push current state to redo stack before applying undo
    setRedoStack(prev => {
      const newStack = [...prev, {
        nodes: JSON.parse(JSON.stringify(nodes)),
        links: JSON.parse(JSON.stringify(links)),
        groups: JSON.parse(JSON.stringify(groups))
      }];
      return newStack.slice(-10);
    });

    setNodes(lastState.nodes);
    setLinks(lastState.links);
    setGroups(lastState.groups || []);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, nodes, links, groups]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];

    // Push current state back to undo stack
    setUndoStack(prev => {
      const newStack = [...prev, {
        nodes: JSON.parse(JSON.stringify(nodes)),
        links: JSON.parse(JSON.stringify(links)),
        groups: JSON.parse(JSON.stringify(groups))
      }];
      return newStack.slice(-10);
    });

    setNodes(nextState.nodes);
    setLinks(nextState.links);
    setGroups(nextState.groups || []);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, nodes, links, groups]);

  // 初始化获取 API Keys 和模型配置 (v2 - 从4个配置文件加载)
  useEffect(() => {
    console.log('[Config] Loading config from v2 API...');
    fetch('/api/config/v2/all')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        console.log('[Config] Loaded data:', data);
        // 1. 解析 main 配置 (BizyAir, SiliconFlow, ModelScope, Aliyun, Volcengine)
        const mainConfig = data.main || {};
        console.log('[Config] Main config:', mainConfig);
        const newApiKeys = { ...apiKeys };
        const newModelConfigs = { chat: {}, image: {}, video: {} };

        // 处理主流平台配置
        ['BizyAir', 'SiliconFlow', 'ModelScope', 'Aliyun', 'Volcengine'].forEach(platform => {
          const cfg = mainConfig[platform];
          if (cfg && typeof cfg === 'object') {
            // 设置 API Key
            newApiKeys[platform] = cfg.api_key || '';
            console.log(`[Config] Loading ${platform}:`, { api_key: cfg.api_key ? '***' : 'empty' });

            // 设置模型配置 (chat)
            if (cfg.chat_model && Array.isArray(cfg.chat_model) && cfg.chat_model.length > 0) {
              newModelConfigs.chat[platform] = {
                models: cfg.chat_model.filter(m => m && m.trim && m.trim() !== '').map((m) => ({
                  id: m,
                  url: cfg.chat_api_url || ''
                }))
              };
              console.log(`[Config] ${platform} chat models:`, newModelConfigs.chat[platform].models.length);
            }

            // 设置模型配置 (image)
            if (cfg.image_model && Array.isArray(cfg.image_model) && cfg.image_model.length > 0) {
              newModelConfigs.image[platform] = {
                models: cfg.image_model.filter(m => m && m.trim && m.trim() !== '').map((m) => ({
                  id: m,
                  url: cfg.image_api_url || ''
                }))
              };
              console.log(`[Config] ${platform} image models:`, newModelConfigs.image[platform].models.length);
            }

            // 设置模型配置 (video)
            if (cfg.video_model && Array.isArray(cfg.video_model) && cfg.video_model.length > 0) {
              const validVideoModels = cfg.video_model.filter(m => m && m.trim && m.trim() !== '');
              if (validVideoModels.length > 0) {
                newModelConfigs.video[platform] = {
                  models: validVideoModels.map((m) => ({
                    id: m,
                    url: cfg.video_submit_url || '',
                    statusUrl: cfg.video_status_url || ''
                  }))
                };
                console.log(`[Config] ${platform} video models:`, newModelConfigs.video[platform].models.length);
              }
            }
          } else {
            console.log(`[Config] No config found for ${platform}`);
          }
        });

        // 2. 解析第三方平台配置 (tp1, tp2, tp3)
        ['tp1', 'tp2', 'tp3'].forEach((tpKey, idx) => {
          const tpConfig = data[tpKey] || {};
          const tpName = `ThirdParty${idx + 1}`;

          // 始终设置 API Keys（即使没有 platform_alias 或 api_key）
          newApiKeys[tpName] = {
            platform: tpConfig.platform_alias || '',
            api_key: tpConfig.api_key || ''
          };

          // Chat 模型（只要模型列表存在且有内容就设置）
          if (tpConfig.chat_model && Array.isArray(tpConfig.chat_model) && tpConfig.chat_model.length > 0 && tpConfig.chat_model[0] !== '') {
            newModelConfigs.chat[tpName] = {
              models: tpConfig.chat_model.map((m) => ({
                id: m,
                url: tpConfig.chat_api_url || ''
              })).filter(m => m && m.id !== '')
            };
          }

          // Image 模型
          if (tpConfig.image_model && Array.isArray(tpConfig.image_model) && tpConfig.image_model.length > 0 && tpConfig.image_model[0] !== '') {
            newModelConfigs.image[tpName] = {
              models: tpConfig.image_model.map((m) => ({
                id: m,
                url: tpConfig.image_api_url || ''
              })).filter(m => m && m.id !== '')
            };
          }

          // Video 模型
          if (tpConfig.video_model && Array.isArray(tpConfig.video_model) && tpConfig.video_model.length > 0 && tpConfig.video_model[0] !== '') {
            newModelConfigs.video[tpName] = {
              models: tpConfig.video_model.map((m) => ({
                id: m,
                url: tpConfig.video_submit_url || '',
                statusUrl: tpConfig.video_status_url || ''
              })).filter(m => m && m.id !== '')
            };
          }
        });

        setApiKeys(newApiKeys);
        setModelConfigs(newModelConfigs);

        console.log('[Config] Set apiKeys:', newApiKeys);
        console.log('[Config] Set modelConfigs:', newModelConfigs);

        // 如果所有 key 都是空的，则打开设置面板
        const allKeys = Object.values(newApiKeys).map(v => typeof v === 'object' ? v.api_key : v);
        if (!allKeys.some(key => key?.trim() !== '')) {
          setIsSettingsOpen(true);
        }
      })
      .catch(err => {
        console.error("[Config] Failed to load config v2:", err);
        // 如果v2 API失败，尝试旧版API作为回退
        console.log('[Config] Falling back to legacy API...');
        fetch('/api/config/keys')
          .then(res => res.json())
          .then(data => {
            if (data.api_key) {
              setApiKeys(prev => ({ ...prev, ...data.api_key }));
            }
          })
          .catch(err2 => console.error("[Config] Legacy API also failed:", err2));
      });
  }, []);

  const handleSaveSettings = async () => {
    try {
      // 构建 main_api_config.json 格式
      const mainConfig = {};
      ['BizyAir', 'SiliconFlow', 'ModelScope', 'Aliyun', 'Volcengine'].forEach(platform => {
        const platformKey = platform;
        const apiKey = apiKeys[platformKey] || '';

        // 收集该平台的模型配置
        const chatModels = modelConfigs.chat[platformKey]?.models || [];
        const imageModels = modelConfigs.image[platformKey]?.models || [];
        const videoModels = modelConfigs.video[platformKey]?.models || [];

        mainConfig[platform] = {
          api_key: apiKey,
          api_base: platform === 'BizyAir' ? 'https://api.bizyair.cn' : undefined,
          chat_api_url: chatModels[0]?.url || '',
          chat_model: chatModels.map(m => m.id).filter(id => id),
          image_api_url: imageModels[0]?.url || '',
          image_model: imageModels.map(m => m.id).filter(id => id),
          video_submit_url: videoModels[0]?.url || '',
          video_status_url: videoModels[0]?.statusUrl || '',
          video_model: videoModels.map(m => m.id).filter(id => id)
        };

        // 移除 undefined 值
        if (mainConfig[platform].api_base === undefined) {
          delete mainConfig[platform].api_base;
        }
      });

      // 构建第三方平台配置
      const buildTPConfig = (tpName) => {
        const tpData = apiKeys[tpName] || {};
        const chatModels = modelConfigs.chat[tpName]?.models || [];
        const imageModels = modelConfigs.image[tpName]?.models || [];
        const videoModels = modelConfigs.video[tpName]?.models || [];

        return {
          platform_alias: tpData.platform || '',
          api_key: tpData.api_key || '',
          chat_api_url: chatModels[0]?.url || '',
          chat_model: chatModels.map(m => m.id).filter(id => id),
          image_api_url: imageModels[0]?.url || '',
          image_model: imageModels.map(m => m.id).filter(id => id),
          video_submit_url: videoModels[0]?.url || '',
          video_status_url: videoModels[0]?.statusUrl || '',
          video_model: videoModels.map(m => m.id).filter(id => id)
        };
      };

      const tp1Config = buildTPConfig('ThirdParty1');
      const tp2Config = buildTPConfig('ThirdParty2');
      const tp3Config = buildTPConfig('ThirdParty3');

      // 使用 v2 API 保存所有配置
      await fetch('/api/config/v2/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          main: mainConfig,
          tp1: tp1Config,
          tp2: tp2Config,
          tp3: tp3Config
        })
      });

      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("保存失败，请检查后端连接");
    }
  };

  const updateTPModel = (type, tpKey, index, field, value) => {
    setModelConfigs(prev => {
      const newTypeConfig = { ...prev[type] };
      if (!newTypeConfig[tpKey]) newTypeConfig[tpKey] = { models: [] };
      const newModels = [...(newTypeConfig[tpKey].models || [])];
      // Ensure index exists
      while (newModels.length <= index) {
        newModels.push({ id: '', url: '', statusUrl: '' });
      }
      newModels[index] = { ...newModels[index], [field]: value };
      newTypeConfig[tpKey] = { ...newTypeConfig[tpKey], models: newModels };
      return { ...prev, [type]: newTypeConfig };
    });
  };

  const addTPModel = (type, tpKey) => {
    setModelConfigs(prev => {
      const newTypeConfig = { ...prev[type] };
      if (!newTypeConfig[tpKey]) newTypeConfig[tpKey] = { models: [] };
      const newModels = [...(newTypeConfig[tpKey].models || [])];
      newModels.push({ id: '', url: '', statusUrl: '' });
      newTypeConfig[tpKey] = { ...newTypeConfig[tpKey], models: newModels };
      return { ...prev, [type]: newTypeConfig };
    });
  };

  // --- 交互状态 ---
  const pendingNodeDrag = useRef(false);
  const draggingNodeIds = useRef([]);
  const affectedLinks = useRef([]); // { linkId, fromNodeId, toNodeId, fromOffset, toOffset, elements: { visual, placeholder, ... } }
  const lastDragStart = useRef(0);
  const pendingNodeResize = useRef(null); // { id: string, side: 'left' | 'right' }
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const activeNodeData = useRef({}); // { [id]: { x, y, w, h } }
  const [selectionBox, setSelectionBox] = useState(null);

  // 连线拖拽状态
  const [pendingLink, setPendingLink] = useState(null); // { fromId: string, startX, startY, endX, endY }

  // 快捷菜单状态
  const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, type: 'creation' | 'action', fromId?: string, toId?: string }
  const [activeSubmenu, setActiveSubmenu] = useState(null); // { id: string, x: number, y: number }
  const [clipboard, setClipboard] = useState(null); // { nodes: [], links: [] }
  const [selectedLinkId, setSelectedLinkId] = useState(null); // "fromId-toId"

  // 1. 挂载原生 Wheel 事件
  const containerRef = useRef(null);
  const handleWheel = useCallback((e) => {
    // 拦截滚动：如果鼠标指针悬停在文本框或自定义滚动条的内容区域，放行原生滚动，阻止画布缩放
    if (e.target.closest('textarea') || e.target.closest('.custom-scrollbar')) {
      return;
    }

    e.preventDefault();
    if (Math.abs(e.deltaY) > 0) {
      if (isViewLocked) {
        // Only allow vertical panning when locked
        setView(prev => {
          let newY = Math.max(-15000, Math.min(15000, prev.y - e.deltaY));
          return { ...prev, y: newY };
        });
      } else {
        const zoomSensitivity = 0.002;
        const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
        setView(prev => {
          let newZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.1), 3); // 10% to 300%
          const dx = (e.clientX - prev.x) * (1 - newZoom / prev.zoom);
          const dy = (e.clientY - prev.y) * (1 - newZoom / prev.zoom);
          let newX = Math.max(-15000, Math.min(15000, prev.x + dx));
          let newY = Math.max(-15000, Math.min(15000, prev.y + dy));
          return { zoom: newZoom, x: newX, y: newY };
        });
      }
    }
    if (Math.abs(e.deltaX) > 0) {
      setView(prev => {
        let newX = Math.max(-15000, Math.min(15000, prev.x - e.deltaX));
        return { ...prev, x: newX };
      });
    }
  }, [isViewLocked]); // Fix stale closure: depend on isViewLocked

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]); // Now it will correctly re-bind when handleWheel updates

  const stopPropagation = (e) => e.stopPropagation();

  // 2. 交互分发中心 (Pointer Down)
  const handlePointerDown = (e) => {
    const target = e.target;
    const canvasPoint = {
      x: (e.clientX - view.x) / view.zoom,
      y: (e.clientY - view.y) / view.zoom
    };

    if (target.closest('[data-context-menu]')) return;
    // Ignore clicks on group toolbar buttons/interactive areas
    if (target.closest('button') || target.closest('[data-group-toolbar]')) return;

    setContextMenu(null);
    setActiveSubmenu(null);
    setSelectedLinkId(null);

    // a. 检查连线点击
    if (target.tagName === 'path' && target.hasAttribute('data-link-id')) {
      setSelectedLinkId(target.getAttribute('data-link-id'));
      e.stopPropagation();
      return;
    }

    // group detection (click on group border/background)
    const groupEl = target.closest('[data-group-id]');
    if (groupEl && !target.closest('[data-node]')) {
      const groupId = groupEl.getAttribute('data-group-id');
      const group = groups.find(g => g.id === groupId);
      if (group) {
        setSelectedNodeIds(group.nodeIds);
        handleNodeDragStart(e, group.nodeIds);
        pendingGroupDrag.current = groupId;
        e.stopPropagation();
        target.setPointerCapture(e.pointerId);
        return;
      }
    }

    // b. 检查连线点 (支持从输入点和输出点均可拉出连线)
    const portEl = target.closest('[data-port-output]') || target.closest('[data-port-input]');
    if (portEl) {
      const isOutput = portEl.hasAttribute('data-port-output');
      const id = portEl.getAttribute('data-id');

      const rect = portEl.getBoundingClientRect();
      const portX = (rect.left + rect.width / 2 - view.x) / view.zoom;
      const portY = (rect.top + rect.height / 2 - view.y) / view.zoom;

      setPendingLink({
        fromId: isOutput ? id : null,
        toId: !isOutput ? id : null,
        startX: portX,
        startY: portY,
        endX: canvasPoint.x,
        endY: canvasPoint.y,
        isReverse: !isOutput
      });
      e.stopPropagation();
      target.setPointerCapture(e.pointerId);
      return;
    }

    // b. 检查缩放手柄
    if (target.closest('[data-resize]')) {
      const resizeEl = target.closest('[data-resize]');
      const id = resizeEl.getAttribute('data-id');
      const side = resizeEl.getAttribute('data-resize'); // 'left' | 'right'
      pendingNodeResize.current = { id, side };
      setSelectedNodeIds([id]);

      const node = nodes.find(n => n.id === id);
      // Add fallbacks for older nodes or safety
      const defaultW = 400;
      const defaultH = 400;
      activeNodeData.current[id] = {
        x: node.x,
        y: node.y,
        w: node.w || defaultW,
        h: node.h || defaultH
      };
      lastPointerPos.current = { x: e.clientX, y: e.clientY };

      e.stopPropagation();
      target.setPointerCapture(e.pointerId);
      return;
    }

    // c. 检查节点交互
    if (target.closest('[data-node]')) {
      const nodeEl = target.closest('[data-node]');
      const id = nodeEl.getAttribute('data-id');
      if (e.ctrlKey || e.metaKey) {
        setSelectedNodeIds(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
        e.stopPropagation();
        return;
      } else {
        // 如果点击的节点不在已选列表中，则单选该节点
        const isSelected = selectedNodeIds.includes(id);
        const finalIds = isSelected ? selectedNodeIds : [id];
        setSelectedNodeIds(finalIds);
        handleNodeDragStart(e, finalIds);
        return;
      }
    }

    // d. 画布背景交互
    if (!(e.ctrlKey || e.metaKey) && e.button === 0) {
      setSelectedNodeIds([]);
    }
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      // Ctrl + 左键框选
      setSelectionBox({ startX: canvasPoint.x, startY: canvasPoint.y, endX: canvasPoint.x, endY: canvasPoint.y });
      e.target.setPointerCapture(e.pointerId);
    } else if (e.button === 0 || e.button === 1) {
      // 拖动画布
      setIsDraggingViewport(true);
      lastPointerPos.current = { x: e.clientX, y: e.clientY };
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    const canvasPoint = {
      x: (e.clientX - view.x) / view.zoom,
      y: (e.clientY - view.y) / view.zoom
    };

    // a. 连线拖拽中
    if (pendingLink) {
      setPendingLink(prev => ({ ...prev, endX: canvasPoint.x, endY: canvasPoint.y }));
      return;
    }

    // b. 节点缩放中
    if (pendingNodeResize.current) {
      const { id, side } = pendingNodeResize.current;
      const dx = (e.clientX - lastPointerPos.current.x) / view.zoom;
      const dy = (e.clientY - lastPointerPos.current.y) / view.zoom;
      lastPointerPos.current = { x: e.clientX, y: e.clientY };

      const nodeEl = document.getElementById(`node-container-${id}`);
      if (nodeEl && activeNodeData.current[id]) {
        const data = activeNodeData.current[id];
        const node = nodes.find(n => n.id === id);
        // 任务执行类节点(chat/generator/video/bizyair)极限尺寸400x400
        // 文本节点极限尺寸400x200，其他节点极限尺寸400x300
        const minW = 400;
        const isTaskNode = ['chat', 'generator', 'video', 'bizyair'].includes(node?.type);
        const minH = isTaskNode ? 400 : (node?.type === 'text' ? 200 : 300);

        if (side === 'right') {
          data.w = Math.max(minW, data.w + dx);
        } else {
          // 左侧缩放同时需位移 X
          data.x += dx;
          data.w = Math.max(minW, data.w - dx);
          nodeEl.style.transform = `translate(${data.x}px, ${data.y}px)`;
        }
        data.h = Math.max(minH, data.h + dy);
        nodeEl.style.width = `${data.w}px`;
        nodeEl.style.height = `${data.h}px`;
      }
      return;
    }

    // c. 框选拖拽中
    if (selectionBox) {
      const endX = canvasPoint.x;
      const endY = canvasPoint.y;
      setSelectionBox(prev => ({ ...prev, endX, endY }));

      const minX = Math.min(selectionBox.startX, endX);
      const maxX = Math.max(selectionBox.startX, endX);
      const minY = Math.min(selectionBox.startY, endY);
      const maxY = Math.max(selectionBox.startY, endY);

      const isWindowSelection = endX > selectionBox.startX; // L->R: Window (Full Containment), R->L: Crossing (Intersection)

      const intersectedIds = nodes.filter(n => {
        const nx = n.x;
        const ny = n.y;
        // 统一默认尺寸为400x400
        const nw = n.w || 400;
        const nh = n.h || 400;

        if (isWindowSelection) {
          // Window Selection: Full Containment
          return nx >= minX && nx + nw <= maxX && ny >= minY && ny + nh <= maxY;
        } else {
          // Crossing Selection: Any Intersection
          return !(nx + nw < minX || nx > maxX || ny + nh < minY || ny > maxY);
        }
      }).map(n => n.id);

      setSelectedNodeIds(intersectedIds);
      return;
    }

    // d. 画布背景平移中
    if (isDraggingViewport) {
      const dx = e.clientX - lastPointerPos.current.x;
      const dy = e.clientY - lastPointerPos.current.y;
      lastPointerPos.current = { x: e.clientX, y: e.clientY };
      setView(prev => {
        let newX = Math.max(-15000, Math.min(15000, prev.x + dx));
        let newY = Math.max(-15000, Math.min(15000, prev.y + dy));
        return { ...prev, x: newX, y: newY };
      });
      return;
    }

    // e. 节点拖拽中
    if (pendingNodeDrag.current) {
      const dx = (e.clientX - lastPointerPos.current.x) / view.zoom;
      const dy = (e.clientY - lastPointerPos.current.y) / view.zoom;
      lastPointerPos.current = { x: e.clientX, y: e.clientY };

      const idsToMove = draggingNodeIds.current.length > 0 ? draggingNodeIds.current : selectedNodeIds;
      idsToMove.forEach(id => {
        if (activeNodeData.current[id]) {
          let newX = activeNodeData.current[id].x + dx;
          let newY = activeNodeData.current[id].y + dy;
          newX = Math.max(-10000, Math.min(10000, newX));
          newY = Math.max(-10000, Math.min(10000, newY));
          activeNodeData.current[id].x = newX;
          activeNodeData.current[id].y = newY;

          const nodeEl = document.getElementById(`node-container-${id}`);
          if (nodeEl) {
            nodeEl.style.transform = `translate(${newX}px, ${newY}px)`;
            nodeEl.style.zIndex = '100';
          }
        }
      });

      // Update groups in real-time
      const nodeMap = {};
      nodes.forEach(n => nodeMap[n.id] = n);

      groups.forEach(group => {
        if (group.nodeIds.some(id => idsToMove.includes(id))) {
          const groupEl = document.querySelector(`[data-group-id="${group.id}"]`);
          if (groupEl) {
            const memberNodes = group.nodeIds.map(id => nodeMap[id]).filter(Boolean);
            const padding = 20;
            const currentPositions = memberNodes.map(n => activeNodeData.current[n.id] || { x: n.x, y: n.y, w: n.w || 400, h: n.h || 400 });
            const minX = Math.min(...currentPositions.map(p => p.x)) - padding;
            const minY = Math.min(...currentPositions.map(p => p.y)) - padding;
            const maxX = Math.max(...currentPositions.map(p => p.x + (p.w || 400))) + padding;
            const maxY = Math.max(...currentPositions.map(p => p.y + (p.h || 400))) + padding;

            groupEl.style.transform = `translate(${minX}px, ${minY}px)`;
            groupEl.style.width = `${maxX - minX}px`;
            groupEl.style.height = `${maxY - minY}px`;

            const toolbarEl = document.querySelector(`[data-group-toolbar-id="${group.id}"]`);
            if (toolbarEl) {
              toolbarEl.style.transform = `translate(${minX}px, ${minY - 10}px) translateY(-100%)`;
            }
          }
        }
      });

      // [Optimization] Use cached affectedLinks to update connection paths
      affectedLinks.current.forEach(item => {
        const fPos = activeNodeData.current[item.fromNodeId] || { x: nodeMap[item.fromNodeId]?.x || 0, y: nodeMap[item.fromNodeId]?.y || 0 };
        const tPos = activeNodeData.current[item.toNodeId] || { x: nodeMap[item.toNodeId]?.x || 0, y: nodeMap[item.toNodeId]?.y || 0 };

        const startX = fPos.x + item.fromOffset.dx;
        const startY = fPos.y + item.fromOffset.dy;
        const endX = tPos.x + item.toOffset.dx;
        const endY = tPos.y + item.toOffset.dy;

        const dist = Math.abs(endX - startX);
        const pitch = Math.max(40, Math.min(dist * 0.5, 120));
        const cp1x = startX + pitch;
        const cp2x = endX - pitch;
        const pathD = `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;

        if (item.elements.placeholder) item.elements.placeholder.setAttribute('d', pathD);
        if (item.elements.visual) item.elements.visual.setAttribute('d', pathD);
        if (item.elements.highlight) item.elements.highlight.setAttribute('d', pathD);
        if (item.elements.startCirc) { item.elements.startCirc.setAttribute('cx', startX); item.elements.startCirc.setAttribute('cy', startY); }
        if (item.elements.startCircOuter) { item.elements.startCircOuter.setAttribute('cx', startX); item.elements.startCircOuter.setAttribute('cy', startY); }
        if (item.elements.endCirc) { item.elements.endCirc.setAttribute('cx', endX); item.elements.endCirc.setAttribute('cy', endY); }
        if (item.elements.endCircOuter) { item.elements.endCircOuter.setAttribute('cx', endX); item.elements.endCircOuter.setAttribute('cy', endY); }
        if (item.elements.midPoint) {
          const midX = 0.125 * startX + 0.375 * cp1x + 0.375 * cp2x + 0.125 * endX;
          const midY = 0.125 * startY + 0.375 * startY + 0.375 * endY + 0.125 * endY;
          item.elements.midPoint.setAttribute('x', midX - 12);
          item.elements.midPoint.setAttribute('y', midY - 12);
        }
      });
      return;
    }
  };

  const handlePointerUp = (e) => {
    // a. 连线松开逻辑
    if (pendingLink) {
      const dropTarget = document.elementFromPoint(e.clientX, e.clientY);

      if (!pendingLink.isReverse) {
        // 从Output拖出，寻找Input
        const targetPort = dropTarget?.closest('[data-port-input]');
        if (targetPort) {
          const toId = targetPort.getAttribute('data-id');
          const fromNode = nodes.find(n => n.id === pendingLink.fromId);
          let isValid = true;

          if (fromNode) {
            const toNode = nodes.find(n => n.id === toId.split('-')[0]);
            const isGenerator = toNode && ['generator', 'video', 'bizyair', 'chat'].includes(toNode.type);
            const isPreview = toNode && ['preview', 'display_text'].includes(toNode.type);

            if (fromNode.type === 'image') {
              // 只有目标是图片接口或生成器统一接口才允许
              if (!toId.includes('-img') && !isGenerator && !isPreview) isValid = false;
              // 统一接口下的图片限制：生成器6个，对话6个
              if (isGenerator) {
                const limit = toNode.type === 'chat' ? 6 : 6;
                const existingImageLinks = links.filter(l => l.to === toId && nodes.find(n => n.id === l.from)?.type === 'image').length;
                const existingGeneratorLinks = links.filter(l => l.to === toId && ['generator', 'video', 'bizyair', 'chat'].includes(nodes.find(n => n.id === l.from)?.type)).length;
                if (existingImageLinks + existingGeneratorLinks >= limit) isValid = false;
              }
            } else if (fromNode.type === 'text' || fromNode.data?.text !== undefined || fromNode.type === 'chat' || ['generator', 'video', 'bizyair'].includes(fromNode.type)) {
              // 图片接口不允许接入非纯图
              if (toId.includes('-img')) isValid = false;
              // 生成器节点限制接入数量
              if (isGenerator) {
                const limit = toNode.type === 'chat' ? 2 : 1;
                const existingTextLinks = links.filter(l => {
                  if (l.to !== toId) return false;
                  const sn = nodes.find(n => n.id === l.from);
                  return sn?.type === 'text' || sn?.data?.text !== undefined || sn?.type === 'chat';
                }).length;
                if (existingTextLinks >= limit) isValid = false;
              }
            }

            // [NEW] 强制预览节点单执行节点输入约束
            if (isPreview && ['generator', 'video', 'bizyair', 'chat'].includes(fromNode.type)) {
              const hasExistingExecutionInput = links.some(l => {
                if (l.to !== toId) return false;
                const sn = nodes.find(n => n.id === l.from);
                return ['generator', 'video', 'bizyair', 'chat'].includes(sn?.type);
              });
              if (hasExistingExecutionInput) isValid = false;
            }
          }

          if (isValid && !links.some(l => l.from === pendingLink.fromId && l.to === toId)) {
            takeSnapshot();
            setLinks(prev => [...prev, { from: pendingLink.fromId, to: toId }]);
          }
          setPendingLink(null);
          e.target.releasePointerCapture(e.pointerId);
          return;
        }
      } else {
        // 从Input拖出，寻找Output
        const targetPort = dropTarget?.closest('[data-port-output]');
        if (targetPort) {
          const fromId = targetPort.getAttribute('data-id');
          const fromNode = nodes.find(n => n.id === fromId);
          let isValid = true;

          if (fromNode) {
            const toNode = nodes.find(n => n.id === pendingLink.toId.split('-')[0]);
            const isGenerator = toNode && ['generator', 'video', 'bizyair', 'chat'].includes(toNode.type);
            const isPreview = toNode && ['preview', 'display_text'].includes(toNode.type);

            // 反向连线时同样进行类型校验
            if (pendingLink.toId.includes('-img')) {
              if (fromNode.type === 'text') isValid = false;
            } else if (!isGenerator && !isPreview) {
              // 既不是生成器也不是预览节点，如果来源是图片则拒绝（除非是专用图像口）
              if (fromNode.type === 'image') isValid = false;
            } else if (isGenerator) {
              // 生成器节点反向连线时，如果来源是文本，也要检查是否已满
              if (fromNode.type === 'text' || fromNode.data?.text !== undefined || fromNode.type === 'chat') {
                const existingTextLink = links.some(l => {
                  if (l.to !== pendingLink.toId) return false;
                  const sourceNode = nodes.find(n => n.id === l.from);
                  return sourceNode?.type === 'text' || sourceNode?.data?.text !== undefined || sourceNode?.type === 'chat';
                });
                if (existingTextLink) isValid = false;
              }
            }

            // [NEW] 强制预览节点单执行节点输入约束 (反向连线判定)
            if (isPreview && ['generator', 'video', 'bizyair', 'chat'].includes(fromNode.type)) {
              const hasExistingExecutionInput = links.some(l => {
                if (l.to !== pendingLink.toId) return false;
                const sn = nodes.find(n => n.id === l.from);
                return ['generator', 'video', 'bizyair', 'chat'].includes(sn?.type);
              });
              if (hasExistingExecutionInput) isValid = false;
            }
          }

          if (isValid && !links.some(l => l.from === fromId && l.to === pendingLink.toId)) {
            takeSnapshot();
            setLinks(prev => [...prev, { from: fromId, to: pendingLink.toId }]);
          }
          setPendingLink(null);
          e.target.releasePointerCapture(e.pointerId);
          return;
        }
      }

      const canvasPoint = {
        x: (e.clientX - view.x) / view.zoom,
        y: (e.clientY - view.y) / view.zoom
      };

      // 处理画板空白处的释放逻辑
      if (!pendingLink.isReverse) {
        // [New Logic] 执行类节点输出端向外拉：直接自动创建展示结果节点
        const fromNode = nodes.find(n => n.id === pendingLink.fromId);
        if (fromNode && ['chat', 'generator', 'video', 'bizyair'].includes(fromNode.type)) {
          createNode('preview', canvasPoint.x, canvasPoint.y, pendingLink.fromId);
          setPendingLink(null);
          e.target.releasePointerCapture(e.pointerId);
          return;
        }

        // 源节点是 image 或 text，呼出新建生成器类节点的快捷菜单
        if (fromNode && (fromNode.type === 'image' || fromNode.type === 'text')) {
          setContextMenu({
            x: canvasPoint.x,
            y: canvasPoint.y,
            type: 'unified_creation_forward',
            fromId: pendingLink.fromId
          });
          setPendingLink(null);
          e.target.releasePointerCapture(e.pointerId);
          return;
        }
      } else if (pendingLink.isReverse && pendingLink.toId) {
        // 反向连线释放
        const toNodeId = pendingLink.toId.split('-')[0];
        const toNode = nodes.find(n => n.id === toNodeId);

        // 如果是从生成器类节点或预览类节点的统一端口反向拉出，显示快捷菜单
        if (toNode && ['generator', 'video', 'bizyair', 'chat', 'preview', 'display_text'].includes(toNode.type)) {
          const isPreview = toNode.type === 'preview' || toNode.type === 'display_text';
          setContextMenu({
            x: canvasPoint.x,
            y: canvasPoint.y,
            type: isPreview ? 'unified_creation_backward_preview' : 'unified_creation',
            toId: pendingLink.toId
          });
          setPendingLink(null);
          e.target.releasePointerCapture(e.pointerId);
          return;
        }

        if (pendingLink.toId.includes('-img')) {
          // 图像接口反向拉出自动创建图像节点
          const newImageNodeId = `node_${Date.now()}`;
          takeSnapshot();
          setNodes(prev => [...prev, {
            id: newImageNodeId, type: 'image',
            x: canvasPoint.x - 200, y: canvasPoint.y - 200,
            w: 400, h: 400, data: {}
          }]);
          setLinks(prev => [...prev, { from: newImageNodeId, to: pendingLink.toId }]);
          setPendingLink(null);
          e.target.releasePointerCapture(e.pointerId);
          return;
        } else {
          // 文本接口反向拉出自动创建文本节点
          const newTextNodeId = `node_${Date.now()}`;
          takeSnapshot();
          setNodes(prev => [...prev, {
            id: newTextNodeId, type: 'text',
            x: canvasPoint.x - 200, y: canvasPoint.y - 200,
            w: 400, h: 400, data: {}
          }]);
          setLinks(prev => [...prev, { from: newTextNodeId, to: pendingLink.toId }]);
          setPendingLink(null);
          e.target.releasePointerCapture(e.pointerId);
          return;
        }
      }

      // 兜底：呼出常规的右键创建菜单
      setContextMenu({ x: canvasPoint.x, y: canvasPoint.y, type: 'creation', fromId: pendingLink.fromId, toId: pendingLink.toId });
      setPendingLink(null);
      e.target.releasePointerCapture(e.pointerId);
      return;
    }

    // b. 缩放结束
    if (pendingNodeResize.current) {
      const { id } = pendingNodeResize.current;
      if (activeNodeData.current[id]) {
        takeSnapshot();
        setNodes(prev => prev.map(n => n.id === id ? {
          ...n,
          x: activeNodeData.current[id].x,
          y: activeNodeData.current[id].y,
          w: activeNodeData.current[id].w,
          h: activeNodeData.current[id].h
        } : n));
      }
      pendingNodeResize.current = null;
      e.target.releasePointerCapture(e.pointerId);
      return;
    }

    // c. 框选结束
    if (selectionBox) {
      setSelectionBox(null);
      e.target.releasePointerCapture(e.pointerId);
      return;
    }

    // d. 画布拖拽结束
    if (isDraggingViewport) {
      setIsDraggingViewport(false);
      e.target.releasePointerCapture(e.pointerId);
    }

    // e. 节点拖拽结束
    if (pendingNodeDrag.current) {
      takeSnapshot();
      const idsToFinalize = draggingNodeIds.current.length > 0 ? draggingNodeIds.current : selectedNodeIds;
      setNodes(prev => prev.map(n => {
        if (idsToFinalize.includes(n.id) && activeNodeData.current[n.id]) {
          return { ...n, x: activeNodeData.current[n.id].x, y: activeNodeData.current[n.id].y };
        }
        return n;
      }));
      pendingNodeDrag.current = false;
      draggingNodeIds.current = [];
      affectedLinks.current = [];
    }

    if (pendingGroupDrag.current) {
      pendingGroupDrag.current = null;
    }
  };

  const handleDoubleClick = (e) => {
    if (e.target.closest('[data-node]')) return;
    const canvasPoint = {
      x: (e.clientX - view.x) / view.zoom,
      y: (e.clientY - view.y) / view.zoom
    };
    setContextMenu({ x: canvasPoint.x, y: canvasPoint.y, type: 'creation' });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (selectedNodeIds.length === 0) return;
    const canvasPoint = {
      x: (e.clientX - view.x) / view.zoom,
      y: (e.clientY - view.y) / view.zoom
    };
    setContextMenu({ x: canvasPoint.x, y: canvasPoint.y, type: 'action' });
  };

  // 3. 节点交互函数 (提前声明，避免 useEffect 中引用时 TDZ 错误)
  const handleGroupNodes = useCallback(() => {
    if (selectedNodeIds.length < 2) return;

    const newGroupId = `group_${Date.now()}`;
    const newGroup = {
      id: newGroupId,
      nodeIds: [...selectedNodeIds],
      title: '新建群组',
      theme: 'grey',
      fontSize: 42
    };

    takeSnapshot();
    setGroups(prev => {
      const filteredGroups = prev.map(g => ({
        ...g,
        nodeIds: g.nodeIds.filter(id => !selectedNodeIds.includes(id))
      })).filter(g => g.nodeIds.length >= 2);

      return [...filteredGroups, newGroup];
    });
  }, [selectedNodeIds, takeSnapshot]);

  const handleUngroupNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

    takeSnapshot();
    setGroups(prev => {
      const groupsToRemove = prev.filter(g => g.nodeIds.some(id => selectedNodeIds.includes(id)));
      if (groupsToRemove.length === 0) return prev;

      return prev.filter(g => !groupsToRemove.includes(g));
    });
  }, [selectedNodeIds, takeSnapshot]);

  const handleGroupThemeChange = useCallback((groupId, themeId) => {
    takeSnapshot();
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, theme: themeId } : g));
  }, [takeSnapshot]);

  const handleGroupTitleChange = useCallback((groupId, newTitle) => {
    takeSnapshot();
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, title: newTitle } : g));
  }, [takeSnapshot]);

  const handleGroupFontSizeChange = useCallback((groupId, newSize) => {
    takeSnapshot();
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, fontSize: newSize } : g));
  }, [takeSnapshot]);

  const handleRunGroup = useCallback((groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    takeSnapshot();
    setNodes(prev => prev.map(node => {
      if (group.nodeIds.includes(node.id)) {
        return {
          ...node,
          data: {
            ...node.data,
            runTrigger: Date.now(),
            status: 'idle' // Reset status to allow sequential chains or visual restart
          }
        };
      }
      return node;
    }));
  }, [groups, takeSnapshot]);

  const handleRunGroupSequentially = useCallback((groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const memberNodes = nodes.filter(n => group.nodeIds.includes(n.id));
    const executionNodes = memberNodes.filter(n => ['chat', 'generator', 'video', 'bizyair'].includes(n.type));

    if (executionNodes.length === 0) return;

    // Sort: Left to Right, Top to Bottom
    const sortedQueue = [...executionNodes]
      .sort((a, b) => {
        if (Math.abs(a.y - b.y) < 50) return a.x - b.x;
        return a.y - b.y;
      })
      .map(n => n.id);

    takeSnapshot();
    setSequentialRun({ groupId, queue: sortedQueue, currentIndex: 0 });

    // Trigger first node and reset others' status
    setNodes(prev => prev.map(n => {
      if (group.nodeIds.includes(n.id)) {
        if (n.id === sortedQueue[0]) {
          return { ...n, data: { ...n.data, runTrigger: Date.now(), status: 'idle' } };
        }
        return { ...n, data: { ...n.data, status: 'idle' } };
      }
      return n;
    }));
  }, [groups, nodes, takeSnapshot]);

  const handleCopyNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const nodesToCopy = nodes.filter(n => selectedNodeIds.includes(n.id));
    const linksToCopy = links.filter(l => selectedNodeIds.includes(l.from.split('-')[0]) && selectedNodeIds.includes(l.to.split('-')[0]));
    setClipboard({ nodes: JSON.parse(JSON.stringify(nodesToCopy)), links: JSON.parse(JSON.stringify(linksToCopy)) });
  }, [selectedNodeIds, nodes, links]);

  const handlePasteNodes = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;

    takeSnapshot();
    const idMap = {};
    const offset = 50;

    const newNodes = clipboard.nodes.map(n => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap[n.id] = newId;
      return {
        ...n,
        id: newId,
        x: n.x + offset,
        y: n.y + offset
      };
    });

    const newLinks = clipboard.links.map(l => {
      const fromParts = l.from.split('-');
      const toParts = l.to.split('-');
      const newFromId = idMap[fromParts[0]];
      const newToId = idMap[toParts[0]];

      if (!newFromId || !newToId) return null;

      return {
        ...l,
        from: fromParts.length > 1 ? `${newFromId}-${fromParts[1]}` : newFromId,
        to: toParts.length > 1 ? `${newToId}-${toParts[1]}` : newToId
      };
    }).filter(Boolean);

    setNodes(prev => [...prev, ...newNodes]);
    setLinks(prev => [...prev, ...newLinks]);
    setSelectedNodeIds(newNodes.map(n => n.id));
  }, [clipboard, takeSnapshot]);

  // --- 节点对齐功能 ---
  const handleAlignNodes = useCallback((alignType) => {
    if (selectedNodeIds.length < 2) return;

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 2) return;

    takeSnapshot();

    // 获取所有选中节点的边界信息
    const nodesWithBounds = selectedNodes.map(n => ({
      ...n,
      width: n.w || (n.type === 'generator' || n.type === 'bizyair' ? 400 : (n.type === 'text' || n.type === 'image') ? 300 : 400),
      height: n.h || (n.type === 'generator' || n.type === 'bizyair' ? 400 : (n.type === 'text' || n.type === 'image') ? 300 : 400)
    }));

    // 计算参考值
    const minX = Math.min(...nodesWithBounds.map(n => n.x));
    const maxX = Math.max(...nodesWithBounds.map(n => n.x + n.width));
    const minY = Math.min(...nodesWithBounds.map(n => n.y));
    const maxY = Math.max(...nodesWithBounds.map(n => n.y + n.height));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setNodes(prev => prev.map(n => {
      if (!selectedNodeIds.includes(n.id)) return n;

      // 统一默认尺寸为400x400
      const nodeWidth = n.w || 400;
      const nodeHeight = n.h || 400;

      let newX = n.x;
      let newY = n.y;

      switch (alignType) {
        case 'left':
          newX = minX;
          break;
        case 'right':
          newX = maxX - nodeWidth;
          break;
        case 'top':
          newY = minY;
          break;
        case 'bottom':
          newY = maxY - nodeHeight;
          break;
        case 'centerH':
          newX = centerX - nodeWidth / 2;
          break;
        case 'centerV':
          newY = centerY - nodeHeight / 2;
          break;
        default:
          break;
      }

      return { ...n, x: newX, y: newY };
    }));
  }, [selectedNodeIds, nodes, takeSnapshot]);

  // --- 节点分布功能 ---
  const handleDistributeNodes = useCallback((distributeType) => {
    if (selectedNodeIds.length < 3) return;

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 3) return;

    takeSnapshot();

    const nodesWithBounds = selectedNodes.map(n => ({
      ...n,
      // 统一默认尺寸为400x400
      width: n.w || 400,
      height: n.h || 400
    }));

    if (distributeType === 'horizontal') {
      // 按 X 坐标排序
      const sortedNodes = [...nodesWithBounds].sort((a, b) => a.x - b.x);
      const minX = sortedNodes[0].x;
      const maxX = sortedNodes[sortedNodes.length - 1].x + sortedNodes[sortedNodes.length - 1].width;
      const totalWidth = maxX - minX;
      const totalNodesWidth = sortedNodes.reduce((sum, n) => sum + n.width, 0);
      const gap = (totalWidth - totalNodesWidth) / (sortedNodes.length - 1);

      let currentX = minX;
      const newPositions = {};
      sortedNodes.forEach(n => {
        newPositions[n.id] = currentX;
        currentX += n.width + gap;
      });

      setNodes(prev => prev.map(n => {
        if (!selectedNodeIds.includes(n.id)) return n;
        return { ...n, x: newPositions[n.id] };
      }));
    } else {
      // 按 Y 坐标排序
      const sortedNodes = [...nodesWithBounds].sort((a, b) => a.y - b.y);
      const minY = sortedNodes[0].y;
      const maxY = sortedNodes[sortedNodes.length - 1].y + sortedNodes[sortedNodes.length - 1].height;
      const totalHeight = maxY - minY;
      const totalNodesHeight = sortedNodes.reduce((sum, n) => sum + n.height, 0);
      const gap = (totalHeight - totalNodesHeight) / (sortedNodes.length - 1);

      let currentY = minY;
      const newPositions = {};
      sortedNodes.forEach(n => {
        newPositions[n.id] = currentY;
        currentY += n.height + gap;
      });

      setNodes(prev => prev.map(n => {
        if (!selectedNodeIds.includes(n.id)) return n;
        return { ...n, y: newPositions[n.id] };
      }));
    }
  }, [selectedNodeIds, nodes, takeSnapshot]);

  // --- 节点尺寸对齐功能 ---
  const handleSizeAlignNodes = useCallback((alignType) => {
    if (selectedNodeIds.length < 2) return;

    takeSnapshot();

    if (alignType === 'height') {
      // 上下高度对齐：所有选中节点高度统一为400
      setNodes(prev => prev.map(n => {
        if (!selectedNodeIds.includes(n.id)) return n;
        return { ...n, h: 400 };
      }));
    } else if (alignType === 'width') {
      // 左右宽度对齐：所有选中节点宽度统一为400
      setNodes(prev => prev.map(n => {
        if (!selectedNodeIds.includes(n.id)) return n;
        return { ...n, w: 400 };
      }));
    }
  }, [selectedNodeIds, takeSnapshot]);

  // 快捷键 useEffect (放在函数声明之后，避免 TDZ 错误)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT' || document.activeElement.isContentEditable) return;
      if (e.key === 'Delete') {
        if (selectedNodeIds.length > 0) {
          takeSnapshot();
          setNodes(prev => prev.filter(n => !selectedNodeIds.includes(n.id)));
          setLinks(prev => prev.filter(l => !selectedNodeIds.includes(l.from) && !selectedNodeIds.includes(l.to)));
          setSelectedNodeIds([]);
        } else if (selectedLinkId) {
          takeSnapshot();
          setLinks(prev => prev.filter(l => `${l.from}-${l.to}` !== selectedLinkId));
          setSelectedLinkId(null);
        }
      }
      // Redo shortcut (Ctrl+Shift+Z or Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Undo shortcut
        e.preventDefault();
        undo();
      }

      // Group shortcut (Ctrl+G)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleGroupNodes();
      }
      // Ungroup shortcut (Ctrl+Shift+G)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleUngroupNodes();
      }

      // Copy shortcut (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        handleCopyNodes();
      }
      // Paste shortcut (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        handlePasteNodes();
      }

      // 对齐快捷键 (Alt+1 到 Alt+8)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            handleAlignNodes('left');
            break;
          case '2':
            e.preventDefault();
            handleAlignNodes('right');
            break;
          case '3':
            e.preventDefault();
            handleAlignNodes('top');
            break;
          case '4':
            e.preventDefault();
            handleAlignNodes('bottom');
            break;
          case '5':
            e.preventDefault();
            handleAlignNodes('centerH');
            break;
          case '6':
            e.preventDefault();
            handleAlignNodes('centerV');
            break;
          case '7':
            e.preventDefault();
            handleDistributeNodes('horizontal');
            break;
          case '8':
            e.preventDefault();
            handleDistributeNodes('vertical');
            break;
          case '9':
            e.preventDefault();
            handleSizeAlignNodes('height');
            break;
          case '0':
            e.preventDefault();
            handleSizeAlignNodes('width');
            break;
          default:
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, selectedLinkId, groups, undo, redo, handleGroupNodes, handleUngroupNodes, handleCopyNodes, handlePasteNodes, handleAlignNodes, handleDistributeNodes, handleSizeAlignNodes, takeSnapshot, setNodes, setLinks, setSelectedNodeIds, setSelectedLinkId]);

  const handleDeleteSelection = useCallback(() => {
    if (selectedNodeIds.length === 0 && !selectedLinkId) return;

    takeSnapshot();
    if (selectedNodeIds.length > 0) {
      setNodes(prev => prev.filter(n => !selectedNodeIds.includes(n.id)));
      setLinks(prev => prev.filter(l => !selectedNodeIds.includes(l.from.split('-')[0]) && !selectedNodeIds.includes(l.to.split('-')[0])));
      setGroups(prev => prev.map(g => ({
        ...g,
        nodeIds: g.nodeIds.filter(id => !selectedNodeIds.includes(id))
      })).filter(g => g.nodeIds.length >= 2));
      setSelectedNodeIds([]);
    } else if (selectedLinkId) {
      setLinks(prev => prev.filter(l => `${l.from}-${l.to}` !== selectedLinkId));
      setSelectedLinkId(null);
    }
  }, [selectedNodeIds, selectedLinkId, takeSnapshot]);

  const createNode = (type, x, y, fromId, toId) => {
    const id = `node_${Date.now()}`;
    const defaultX = (window.innerWidth / 2 - view.x) / view.zoom;
    const defaultY = (window.innerHeight / 2 - view.y) / view.zoom;

    const newNode = {
      id,
      type,
      x: (x ?? defaultX) - 200,
      y: (y ?? defaultY) - 50,
      // 所有节点初始尺寸统一为400x400
      w: 400,
      h: 400,
      data: {}
    };

    // 如果是反向连线（从目标输入点拉出的菜单），新节点的默认位置应该偏移至线端左侧
    if (toId) {
      newNode.x -= Math.max(0, newNode.w - 150);
    }

    setNodes(prev => {
      takeSnapshot();
      return [...prev, newNode];
    });
    if (fromId) {
      setLinks(prev => [...prev, { from: fromId, to: id }]);
    }
    if (toId) {
      setLinks(prev => [...prev, { from: id, to: toId }]);
    }
    setContextMenu(null);
  };

  const handleNodeDragStart = (e, idsToDrag) => {
    // 避让逻辑：如果点击的是端口或缩放手柄，不启动节点拖拽，让 handlePointerDown 处理连线或缩放
    const target = e.target;
    if (target.closest('[data-port-output]') || target.closest('[data-port-input]') || target.closest('[data-resize]')) {
      return;
    }

    const now = Date.now();
    if (now - lastDragStart.current < 50) return; // Prevent double-trigger from bubbling
    lastDragStart.current = now;

    pendingNodeDrag.current = true;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };

    let draggingIds = idsToDrag;

    if (e.altKey) {
      // Alt + Drag: Copy nodes
      const newIds = [];
      const copiedNodes = draggingIds.map(oId => {
        const originalNode = nodes.find(n => n.id === oId);
        const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        newIds.push(newId);
        return {
          ...originalNode,
          id: newId,
          data: JSON.parse(JSON.stringify(originalNode.data || {})),
          x: originalNode.x, // 保持原位对齐，防止鼠标与抓取点产生偏移
          y: originalNode.y
        };
      });

      draggingIds = newIds;
      draggingNodeIds.current = newIds;

      // 视觉优化：立即手动将原始节点的层级降低，确保新节点一旦渲染就必然在上方
      idsToDrag.forEach(oldId => {
        const oldEl = document.getElementById(`node-container-${oldId}`);
        if (oldEl) oldEl.style.zIndex = '10';
      });

      setSelectedNodeIds(newIds);

      takeSnapshot();
      setNodes(prev => {
        const withCopies = [...prev, ...copiedNodes];
        draggingIds.forEach(id => {
          const node = withCopies.find(n => n.id === id);
          if (node) activeNodeData.current[id] = { x: node.x, y: node.y, w: node.w, h: node.h };
        });
        const draggings = withCopies.filter(n => draggingIds.includes(n.id));
        const others = withCopies.filter(n => !draggingIds.includes(n.id));
        return [...others, ...draggings];
      });
    } else {
      draggingNodeIds.current = draggingIds;
      setNodes(prev => {
        draggingIds.forEach(id => {
          const node = prev.find(n => n.id === id);
          if (node) activeNodeData.current[id] = { x: node.x, y: node.y, w: node.w, h: node.h };
        });
        const draggings = prev.filter(n => draggingIds.includes(n.id));
        const others = prev.filter(n => !draggingIds.includes(n.id));
        return [...others, ...draggings];
      });
    }

    // [Fixed] Generic prefix matching to include all sub-ported links
    const relevantLinks = links.filter(l => {
      const isFromDragging = draggingIds.includes(l.from);
      const isToDragging = draggingIds.some(id => l.to === id || l.to.startsWith(id + '-'));
      return isFromDragging || isToDragging;
    });

    affectedLinks.current = relevantLinks.map(link => {
      const linkId = `${link.from}-${link.to}`;

      // Extract base node IDs for position lookup
      const fromNodeId = link.from;
      // For target, find which dragging ID matches as a prefix (or use split as fallback)
      const toNodeId = nodes.find(n => link.to === n.id || link.to.startsWith(n.id + '-'))?.id || link.to.split('-')[0];

      const fromNode = nodes.find(n => n.id === fromNodeId);
      const toNode = nodes.find(n => n.id === toNodeId);

      // 1. Prioritize measured offsets
      let fromOffset = portOffsets[link.from];
      let toOffset = portOffsets[link.to];

      // 2. Fallbacks (Synchronized with renderLinks)
      if (!fromOffset) {
        fromOffset = { dx: (fromNode?.w || 400), dy: (fromNode?.h || 300) / 2 };
      }
      if (!toOffset) {
        toOffset = { dx: 0, dy: (toNode?.h || 400) / 2 };
        if (toNode) {
          const targetSuffix = link.to.replace(toNode.id + '-', '');
          if (toNode.type === 'chat' && ['sys', 'user', 'img1', 'img2', 'img3', 'img4', 'img5', 'img6'].some(s => targetSuffix.startsWith(s))) {
            const h = toNode.h || 520; const flexH = Math.max(120, h - 161);
            if (targetSuffix === 'sys') toOffset.dy = 61 + (flexH - 12) / 4;
            else if (targetSuffix === 'user') toOffset.dy = 61 + (flexH - 12) / 2 + 12 + (flexH - 12) / 4;
            else if (targetSuffix.startsWith('img')) {
              toOffset.dy = h - 125;
              const idx = parseInt(targetSuffix.replace('img', '')) || 1;
              toOffset.dx = 38 + (idx - 1) * 62;
            }
          } else if (toNode.type === 'generator') {
            const h = toNode.h || 520;
            if (targetSuffix === 'txt') toOffset.dy = 42;
            else if (targetSuffix.startsWith('img')) {
              toOffset.dy = h - 110;
              const idx = parseInt(targetSuffix.replace('img', '')) || 1;
              toOffset.dx = 38 + (idx - 1) * 62;
            }
          } else if (toNode.type === 'video' && targetSuffix.startsWith('img')) {
            const h = toNode.h || 520;
            toOffset.dy = h - 125;
            const idx = parseInt(targetSuffix.replace('img', '')) || 1;
            toOffset.dx = 38 + (idx - 1) * 62;
          }
        }
      }

      return {
        linkId, fromNodeId, toNodeId, fromOffset, toOffset,
        elements: {
          placeholder: document.querySelector(`[data-link-id="${linkId}"]`),
          visual: document.querySelector(`[data-link-visual-id="${linkId}"]`),
          highlight: document.querySelector(`[data-link-highlight-id="${linkId}"]`),
          startCirc: document.querySelector(`[data-link-start-id="${linkId}"]`),
          startCircOuter: document.querySelector(`[data-link-start-outer-id="${linkId}"]`),
          endCirc: document.querySelector(`[data-link-end-id="${linkId}"]`),
          endCircOuter: document.querySelector(`[data-link-end-outer-id="${linkId}"]`),
          midPoint: document.querySelector(`[data-link-mid-id="${linkId}"]`)
        }
      };
    });
  };

  /**
   * 动态获取端口视觉中心的画布坐标
   * 通过 DOM getBoundingClientRect 获取精确位置，从而解决手动计算带来的偏移累积问题
   */
  const getVisualPortPosition = (portId, fallbackX, fallbackY) => {
    // 查找带有 data-port-visual 标记的元素（在各 Node 组件中已导出）
    const el = document.querySelector(`[data-port-visual="${portId}"]`);
    if (!el) return { x: fallbackX, y: fallbackY };

    const rect = el.getBoundingClientRect();
    const containerEl = containerRef.current;
    if (!containerEl) return { x: fallbackX, y: fallbackY };

    const containerRect = containerEl.getBoundingClientRect();

    // 计算屏幕坐标中心点
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 将屏幕坐标转换回画布内的本地逻辑坐标（需考虑画布当前的平移和缩放）
    return {
      x: (centerX - containerRect.left - view.x) / view.zoom,
      y: (centerY - containerRect.top - view.y) / view.zoom
    };
  };

  // 5. 渲染连接线
  const renderLinks = (mode = 'background') => {
    return links.map((link) => {
      const fromNode = nodes.find(n => n.id === link.from);

      let toNodeId = link.to;
      let targetSuffix = '';

      // Robust parsing for sub-ports (e.g., node-id-img1, node-id-txt)
      if (link.to.includes('-sys')) {
        toNodeId = link.to.replace('-sys', ''); targetSuffix = 'sys';
      } else if (link.to.includes('-user')) {
        toNodeId = link.to.replace('-user', ''); targetSuffix = 'user';
      } else if (link.to.includes('-txt')) {
        toNodeId = link.to.replace('-txt', ''); targetSuffix = 'txt';
      } else if (link.to.includes('-img')) {
        const match = link.to.match(/(.+)-(img\d+)$/);
        if (match) {
          toNodeId = match[1];
          targetSuffix = match[2];
        }
      }

      const toNode = nodes.find(n => n.id === toNodeId);
      if (!fromNode || !toNode) return null;

      const manualStartX = fromNode.x + (fromNode.w || 400);
      const manualStartY = fromNode.y + (fromNode.h || 300) / 2;

      let manualEndX = toNode.x;
      let manualEndY = toNode.y + (toNode.h || 400) / 2;

      // 手动计算的 Fallback 逻辑（针对不同节点类型的端口偏移）
      if (toNode.type === 'chat' && ['sys', 'user', 'img1', 'img2', 'img3', 'img4'].includes(targetSuffix)) {
        const nodeHeight = toNode.h || 500;
        const headerAndPadding = 61; const bottomArea = 100;
        const flexHeight = Math.max(120, nodeHeight - 161);
        const gap = 12; const singleBoxHeight = (flexHeight - gap) / 2;

        if (targetSuffix === 'sys') {
          manualEndY = toNode.y + headerAndPadding + (singleBoxHeight / 2);
        } else if (targetSuffix === 'user') {
          manualEndY = toNode.y + headerAndPadding + singleBoxHeight + gap + (singleBoxHeight / 2);
        } else if (targetSuffix.startsWith('img')) {
          // ChatNode: 125px from bottom
          manualEndY = toNode.y + nodeHeight - 125;
          const imgIndex = parseInt(targetSuffix.replace('img', ''));
          manualEndX = toNode.x + 38 + (imgIndex - 1) * 62;
        }
      }
      if (toNode.type === 'generator') {
        const nodeHeight = toNode.h || 500;
        if (targetSuffix.startsWith('img')) {
          // GeneratorNode: 110px from bottom (based on visual feedback)
          manualEndY = toNode.y + nodeHeight - 110;
          const imgIndex = parseInt(targetSuffix.replace('img', ''));
          manualEndX = toNode.x + 38 + (imgIndex - 1) * 62;
        } else if (targetSuffix === 'txt') {
          manualEndX = toNode.x;
          manualEndY = toNode.y + 42; // Precisely center of input port
        }
      }

      // 混合方案：优先使用 useLayoutEffect 测量的精确偏移量，
      // 偏移量相对于节点左上角(canvas coords)，加上节点坐标即为画布绝对坐标
      // 此方案既有 DOM 精度，又不受缩放影响（因为偏移量在 canvas 空间存储）
      const fromOffset = portOffsets[link.from];
      const toOffset = portOffsets[link.to];

      const startX = fromOffset ? fromNode.x + fromOffset.dx : manualStartX;
      const startY = fromOffset ? fromNode.y + fromOffset.dy : manualStartY;
      const endX = toOffset ? toNode.x + toOffset.dx : manualEndX;
      const endY = toOffset ? toNode.y + toOffset.dy : manualEndY;

      const dist = Math.abs(endX - startX);
      const pitch = Math.max(40, Math.min(dist * 0.5, 120));
      const cp1x = startX + pitch;
      const cp2x = endX - pitch;

      const linkId = `${link.from}-${link.to}`;
      const isSelected = selectedLinkId === linkId;

      // 统一高亮色为蓝色
      const linkHighlightColor = '#3b82f6';

      if (mode === 'background') {
        return (
          <g key={linkId}>
            {/* 交互占位线 */}
            <path
              data-link-id={linkId}
              d={`M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`}
              stroke="transparent"
              strokeWidth="20"
              fill="none"
              className="cursor-pointer pointer-events-auto"
              onPointerDown={(e) => {
                e.stopPropagation();
                setSelectedLinkId(linkId);
              }}
            />
            {/* 视觉底线 (未选中时可见) */}
            <path
              data-link-visual-id={linkId}
              d={`M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`}
              stroke="var(--color-zinc-600)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              className={`pointer-events-none transition-opacity duration-300 ${isSelected ? 'opacity-30' : 'opacity-100'}`}
            />
          </g>
        );
      } else if (mode === 'foreground' && isSelected) {
        // 计算中点 (t=0.5)
        const midX = 0.125 * startX + 0.375 * cp1x + 0.375 * cp2x + 0.125 * endX;
        const midY = 0.125 * startY + 0.375 * startY + 0.375 * endY + 0.125 * endY;

        return (
          <g key={`${linkId}-foreground`}>
            {/* 高亮线 */}
            <path
              data-link-highlight-id={linkId}
              d={`M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`}
              stroke={linkHighlightColor}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              className="pointer-events-none shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            />
            {/* 端点高亮 */}
            <circle data-link-start-id={linkId} cx={startX} cy={startY} r={5} fill={linkHighlightColor} opacity={0.9} className="pointer-events-none" />
            <circle data-link-start-outer-id={linkId} cx={startX} cy={startY} r={9} fill="none" stroke={linkHighlightColor} strokeWidth={1.5} opacity={0.4} className="pointer-events-none" />
            <circle data-link-end-id={linkId} cx={endX} cy={endY} r={5} fill={linkHighlightColor} opacity={0.9} className="pointer-events-none" />
            <circle data-link-end-outer-id={linkId} cx={endX} cy={endY} r={9} fill="none" stroke={linkHighlightColor} strokeWidth={1.5} opacity={0.4} className="pointer-events-none" />
            {/* 中点按钮 */}
            <foreignObject data-link-mid-id={linkId} x={midX - 12} y={midY - 12} width="24" height="24" className="pointer-events-auto">
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  takeSnapshot();
                  setLinks(prev => prev.filter(l => `${l.from}-${l.to}` !== linkId));
                  setSelectedLinkId(null);
                }}
                className="w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-500/50 hover:bg-red-500/10 transition-all shadow-xl"
              >
                <X size={12} />
              </button>
            </foreignObject>
          </g>
        );
      }
      return null;
    });
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-zinc-950 select-none ${qualityMode === 'performance' ? 'performance-mode' : ''}`}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{ cursor: isDraggingViewport ? 'grabbing' : pendingNodeResize.current ? 'nwse-resize' : 'auto' }}
    >
      {/* --- 画布层 --- */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <div className="absolute inset-[-10000px] pointer-events-none opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle, #71717a 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full">
          {renderLinks('background')}
        </svg>

        <div className="absolute inset-0 pointer-events-none">
          {groups.map(group => {
            const memberNodes = nodes.filter(n => group.nodeIds.includes(n.id));
            if (memberNodes.length === 0) return null;

            const padding = 20;
            const minX = Math.min(...memberNodes.map(n => n.x)) - padding;
            const minY = Math.min(...memberNodes.map(n => n.y)) - padding;
            const maxX = Math.max(...memberNodes.map(n => n.x + (n.w || 400))) + padding;
            const maxY = Math.max(...memberNodes.map(n => n.y + (n.h || 400))) + padding;

            const w = maxX - minX;
            const h = maxY - minY;
            const isGroupSelected = group.nodeIds.every(id => selectedNodeIds.includes(id)) && selectedNodeIds.length > 0;
            const theme = GROUP_THEMES.find(t => t.id === group.theme) || GROUP_THEMES[0];

            return (
              <React.Fragment key={group.id}>
                {/* Group Background & Outline */}
                <div
                  data-group-id={group.id}
                  className="absolute rounded-[32px] pointer-events-auto transition-colors duration-300"
                  style={{
                    transform: `translate(${minX}px, ${minY}px)`,
                    width: `${w}px`,
                    height: `${h}px`,
                    zIndex: -1,
                    backgroundColor: theme.bg
                  }}
                >
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <rect
                      x="0" y="0" width="100%" height="100%"
                      rx="32" ry="32"
                      fill="none"
                      stroke={theme.color}
                      strokeWidth={isGroupSelected ? "3" : "2"}
                      className="transition-all duration-300"
                      opacity={isGroupSelected ? 0.8 : 0.4}
                    />
                  </svg>

                  {/* Editable Group Title */}
                  <span
                    contentEditable={editingGroupTitleId === group.id}
                    suppressContentEditableWarning
                    onPointerDown={(e) => { if (editingGroupTitleId === group.id) e.stopPropagation(); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingGroupTitleId(group.id); }}
                    onBlur={(e) => {
                      setEditingGroupTitleId(null);
                      const newTitle = e.target.innerText.trim();
                      handleGroupTitleChange(group.id, newTitle || '新建群组');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.target.blur();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditingGroupTitleId(null);
                        e.target.innerText = group.title || '新建群组';
                      }
                    }}
                    className={`absolute top-[15px] left-[20px] px-2 py-1 rounded font-medium transition-all outline-none select-none ${editingGroupTitleId === group.id
                      ? 'text-white bg-white/10 ring-1 ring-white/20 shadow-lg cursor-text select-text'
                      : 'text-zinc-500 hover:text-zinc-400 cursor-pointer'
                      }`}
                    style={{ fontSize: `${group.fontSize || 42}px` }}
                  >
                    {group.title || '新建群组'}
                  </span>
                </div>

                {/* Group Selection Toolbar - Floating high above */}
                {isGroupSelected && (
                  <div
                    data-group-toolbar="true"
                    data-group-toolbar-id={group.id}
                    className="absolute pointer-events-auto z-50"
                    onPointerDown={stopPropagation}
                    style={{
                      transform: `translate(${minX}px, ${minY - 10}px) translateY(-100%)`,
                    }}
                  >
                    <div className="flex w-max items-center gap-4 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 px-4 py-2 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300">
                      {/* Color Palette */}
                      <div className="flex items-center gap-2 pr-4 border-r border-zinc-700/50">
                        {GROUP_THEMES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleGroupThemeChange(group.id, t.id)}
                            className={`w-5 h-5 rounded-full transition-all duration-200 hover:scale-125 hover:rotate-12 ${group.theme === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 border-2 border-transparent' : 'border border-white/10'}`}
                            style={{ backgroundColor: t.color }}
                            title={t.id}
                          />
                        ))}
                      </div>

                      {/* Font Size Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-300 whitespace-nowrap">标题字高</span>
                        <select
                          value={group.fontSize || 42}
                          onChange={(e) => handleGroupFontSizeChange(group.id, parseInt(e.target.value))}
                          className="bg-zinc-800/50 text-zinc-300 text-xs rounded-lg border-none focus:ring-1 focus:ring-zinc-600 px-2 py-1 cursor-pointer hover:bg-zinc-700/50 transition-colors"
                        >
                          <option value={24}>小 (24px)</option>
                          <option value={42}>中 (42px)</option>
                          <option value={60}>大 (60px)</option>
                        </select>
                      </div>

                      <div className="w-px h-4 bg-zinc-700/50 mx-2" />

                      {/* Run Group Parallel Button */}
                      <button
                        onClick={() => handleRunGroup(group.id)}
                        className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-all group/run rounded-full border border-transparent hover:border-zinc-700/50 hover:bg-zinc-800/40"
                      >
                        <Play size={14} className="fill-zinc-400 group-hover/run:fill-white transition-colors" />
                        <span>整组同步执行</span>
                      </button>

                      <div className="w-px h-4 bg-zinc-700/50" />

                      {/* Run Group Sequential Button */}
                      <button
                        onClick={() => handleRunGroupSequentially(group.id)}
                        className={`flex items-center gap-2 px-3 py-1 text-xs font-medium transition-all group/seq rounded-full border border-transparent hover:border-zinc-700/50 hover:bg-zinc-800/40 ${sequentialRun?.groupId === group.id ? 'text-emerald-500' : 'text-zinc-300 hover:text-white'}`}
                      >
                        <ArrowRightCircle size={14} className={`transition-colors ${sequentialRun?.groupId === group.id ? 'text-emerald-500' : 'text-zinc-400 group-hover/seq:text-white'}`} />
                        <span>组内按序执行</span>
                      </button>

                      <div className="w-px h-4 bg-zinc-700/50" />

                      {/* Ungroup Button */}
                      <button
                        onClick={handleUngroupNodes}
                        className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-all group/ungroup rounded-full border border-transparent hover:border-zinc-700/50 hover:bg-zinc-800/40"
                      >
                        <UserMinus size={14} className="text-zinc-400 group-hover/ungroup:text-white transition-colors" />
                        <span>解组</span>
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {nodes.map(node => (
            <div key={node.id} data-node="true" data-id={node.id} className="pointer-events-auto">
              {node.type === 'text' ? (
                <TextNode
                  node={node}
                  updateNode={(id, d) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...d } } : n))}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to.startsWith(node.id))}
                  isOutputConnected={links.some(l => l.from.startsWith(node.id))}
                />
              ) : node.type === 'image' ? (
                <ImageNode
                  node={node}
                  updateNode={(id, d) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...d } } : n))}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isResizing={pendingNodeResize.current?.id === node.id}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to.startsWith(node.id))}
                  isOutputConnected={links.some(l => l.from.startsWith(node.id))}
                  isConnected={links.some(l => l.from === node.id)}
                />
              ) : node.type === 'chat' ? (
                <ChatNode
                  node={node} apiKeys={apiKeys} modelConfigs={modelConfigs.chat}
                  updateNode={(id, d) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...d } } : n))}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isResizing={pendingNodeResize.current?.id === node.id}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to.startsWith(node.id))}
                  isOutputConnected={links.some(l => l.from.startsWith(node.id))}
                  onOutput={(results) => setNodeResults(prev => ({ ...prev, [node.id]: results }))}
                  {...(() => {
                    const incomingLinks = links.filter(l => l.to === node.id || l.to.split('-')[0] === node.id);
                    const textInputs = [];
                    const imageInputs = [];

                    incomingLinks.forEach(link => {
                      const fromNode = nodes.find(n => n.id === link.from);
                      const result = nodeResults[link.from];

                      // 1. Try to extract text
                      let textContent = fromNode?.data?.text;
                      if (textContent === undefined && result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && !firstRes.startsWith('http') && !firstRes.startsWith('/') && !firstRes.startsWith('data:')) {
                          textContent = firstRes;
                        }
                      }
                      if (textContent !== undefined && textContent !== null) {
                        textInputs.push(textContent);
                      }

                      // 2. Try to extract images
                      if (fromNode?.type === 'image' && fromNode.data?.image) {
                        imageInputs.push({ url: fromNode.data.image, fromId: link.from });
                      } else if (result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && (firstRes.startsWith('http') || firstRes.startsWith('/') || firstRes.startsWith('data:'))) {
                          imageInputs.push({ url: firstRes, fromId: link.from });
                        }
                      }
                    });

                    let systemInputText = undefined;
                    let userInputText = undefined;
                    if (textInputs.length === 1) {
                      userInputText = textInputs[0];
                    } else if (textInputs.length >= 2) {
                      systemInputText = textInputs[0];
                      userInputText = textInputs[1];
                    }

                    return { systemInputText, userInputText, inputImages: imageInputs.slice(0, 6) };
                  })()}
                  onDisconnect={(fromId) => {
                    takeSnapshot();
                    setLinks(prev => prev.filter(l => !(l.from === fromId && (l.to === node.id || l.to.split('-')[0] === node.id))));
                  }}
                />
              ) : node.type === 'generator' ? (
                <GeneratorNode
                  node={node} apiKeys={apiKeys} modelConfigs={modelConfigs.image}
                  updateNode={(id, d) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...d } } : n))}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isResizing={pendingNodeResize.current?.id === node.id}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to.startsWith(node.id))}
                  isOutputConnected={links.some(l => l.from.startsWith(node.id))}
                  onOutput={(results) => setNodeResults(prev => ({ ...prev, [node.id]: results }))}
                  {...(() => {
                    const incomingLinks = links.filter(l => l.to.split('-')[0] === node.id);
                    let inputText = undefined;
                    const inputImages = [];
                    incomingLinks.forEach(link => {
                      const fromNode = nodes.find(n => n.id === link.from);
                      const result = nodeResults[link.from];

                      // 1. Extract text (favoring local then result)
                      let textContent = fromNode?.data?.text;
                      if (textContent === undefined && result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && !firstRes.startsWith('http') && !firstRes.startsWith('/') && !firstRes.startsWith('data:')) {
                          textContent = firstRes;
                        }
                      }
                      if (textContent !== undefined) inputText = textContent;

                      // 2. Extract images
                      if (fromNode?.type === 'image' && fromNode.data?.image) {
                        inputImages.push({ url: fromNode.data.image, fromId: link.from });
                      } else if (result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && (firstRes.startsWith('http') || firstRes.startsWith('/') || firstRes.startsWith('data:'))) {
                          inputImages.push({ url: firstRes, fromId: link.from });
                        }
                      }
                    });
                    return { inputText, inputImages };
                  })()}
                  onDisconnect={(fromId) => {
                    takeSnapshot();
                    setLinks(prev => prev.filter(l => !(l.from === fromId && l.to.split('-')[0] === node.id)));
                  }}
                />
              ) : node.type === 'bizyair' ? (
                <BizyAirNode
                  node={node} apiKey={apiKeys?.BizyAir} theme={theme}
                  updateNode={(id, d) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...d } } : n))}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isResizing={pendingNodeResize.current?.id === node.id}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to.startsWith(node.id))}
                  isOutputConnected={links.some(l => l.from.startsWith(node.id))}
                  onOutput={(results) => setNodeResults(prev => ({ ...prev, [node.id]: results }))}
                  {...(() => {
                    const incomingLinks = links.filter(l => l.to === node.id || l.to.split('-')[0] === node.id);
                    let inputText = undefined;
                    const inputImages = [];
                    incomingLinks.forEach(link => {
                      const fromNode = nodes.find(n => n.id === link.from);
                      const result = nodeResults[link.from];

                      let textContent = fromNode?.data?.text;
                      if (textContent === undefined && result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && !firstRes.startsWith('http') && !firstRes.startsWith('/') && !firstRes.startsWith('data:')) {
                          textContent = firstRes;
                        }
                      }
                      if (textContent !== undefined) inputText = textContent;

                      if (fromNode?.type === 'image' && fromNode.data?.image) {
                        inputImages.push({ base64: fromNode.data.image, fromId: link.from });
                      } else if (result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && (firstRes.startsWith('http') || firstRes.startsWith('/') || firstRes.startsWith('data:'))) {
                          inputImages.push({ file: firstRes, fromId: link.from });
                        }
                      }
                    });
                    return { inputText, inputImages };
                  })()}
                  onDisconnect={(fromId) => {
                    takeSnapshot();
                    setLinks(prev => prev.filter(l => !(l.from === fromId && (l.to === node.id || l.to.split('-')[0] === node.id))));
                  }}
                />
              ) : node.type === 'bizyair_converter' ? (
                <BizyAirConverterNode
                  node={node}
                  updateNode={(id, d) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...d } } : n))}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isResizing={pendingNodeResize.current?.id === node.id}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to.startsWith(node.id))}
                  isOutputConnected={links.some(l => l.from.startsWith(node.id))}
                />
              ) : node.type === 'video' ? (
                <VideoNode
                  node={node} apiKeys={apiKeys} modelConfigs={modelConfigs.video}
                  updateNode={(id, d) => setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...d } } : n))}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isResizing={pendingNodeResize.current?.id === node.id}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to.startsWith(node.id))}
                  isOutputConnected={links.some(l => l.from.startsWith(node.id))}
                  onOutput={(results) => setNodeResults(prev => ({ ...prev, [node.id]: results }))}
                  {...(() => {
                    const incomingLinks = links.filter(l => l.to === node.id || l.to.split('-')[0] === node.id);
                    let inputText = undefined;
                    const inputImages = [];
                    incomingLinks.forEach(link => {
                      const fromNode = nodes.find(n => n.id === link.from);
                      const result = nodeResults[link.from];

                      let textContent = fromNode?.data?.text;
                      if (textContent === undefined && result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && !firstRes.startsWith('http') && !firstRes.startsWith('/') && !firstRes.startsWith('data:')) {
                          textContent = firstRes;
                        }
                      }
                      if (textContent !== undefined) inputText = textContent;

                      if (fromNode?.type === 'image' && fromNode.data?.image) {
                        inputImages.push({ url: fromNode.data.image, fromId: link.from });
                      } else if (result && result.length > 0) {
                        const firstRes = result[0];
                        if (typeof firstRes === 'string' && (firstRes.startsWith('http') || firstRes.startsWith('/') || firstRes.startsWith('data:'))) {
                          inputImages.push({ url: firstRes, fromId: link.from });
                        }
                      }
                    });
                    return { inputText, inputImages };
                  })()}
                  onDisconnect={(fromId) => {
                    takeSnapshot();
                    setLinks(prev => prev.filter(l => !(l.from === fromId && (l.to === node.id || l.to.split('-')[0] === node.id))));
                  }}
                />
              ) : (['preview', 'display_text'].includes(node.type)) ? (
                <ResultDisplayNode
                  node={node}
                  onDragStart={(e) => {
                    const ids = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];
                    handleNodeDragStart(e, ids);
                  }}
                  isDragging={pendingNodeDrag.current && selectedNodeIds.includes(node.id)}
                  isResizing={pendingNodeResize.current?.id === node.id}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isInputConnected={links.some(l => l.to === node.id)}
                  isOutputConnected={links.some(l => l.from === node.id)}
                  inputData={(() => {
                    const incomingLinks = links.filter(l => l.to === node.id || l.to.split('-')[0] === node.id);
                    if (incomingLinks.length === 0) return EMPTY_ARRAY;
                    
                    const combinedResults = [];
                    incomingLinks.forEach(link => {
                      const fromId = link.from.split('-')[0];
                      const fromNode = nodes.find(n => n.id === fromId);
                      if (!fromNode) return;
                      
                      // Priority 1: Direct data for input nodes
                      if (fromNode.type === 'text' && fromNode.data?.text) {
                        combinedResults.push(fromNode.data.text);
                      } else if (fromNode.type === 'image' && fromNode.data?.image) {
                        combinedResults.push(fromNode.data.image);
                      } else {
                        // Priority 2: nodeResults for generator nodes
                        const result = nodeResults[fromId];
                        if (result && Array.isArray(result)) {
                          combinedResults.push(...result);
                        } else if (result) {
                          combinedResults.push(result);
                        }
                      }
                    });
                    return combinedResults;
                  })()}
                  upstreamNode={(() => {
                    const link = links.find(l => l.to === node.id || l.to.split('-')[0] === node.id);
                    if (!link) return null;
                    const fromId = link.from.split('-')[0];
                    return nodes.find(n => n.id === fromId);
                  })()}
                  onDisconnect={(fromId) => {
                    takeSnapshot();
                    setLinks(prev => prev.filter(l => !(l.from === fromId && (l.to === node.id || l.to.split('-')[0] === node.id))));
                  }}
                />
              ) : null}
            </div>
          ))}

          {/* Top Layer SVG for Selection Highlights & Pending Interactions */}
          <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full z-[100]">
            {renderLinks('foreground')}
            {pendingLink && (() => {
              const dist = Math.abs(pendingLink.endX - pendingLink.startX);
              const pitch = Math.max(40, Math.min(dist * 0.5, 120));
              return (
                <path
                  d={`M ${pendingLink.startX} ${pendingLink.startY} C ${pendingLink.startX + pitch} ${pendingLink.startY}, ${pendingLink.endX - pitch} ${pendingLink.endY}, ${pendingLink.endX} ${pendingLink.endY}`}
                  stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5" fill="none"
                />
              );
            })()}
            {selectionBox && (() => {
              const isWindow = selectionBox.endX > selectionBox.startX;
              const color = isWindow ? '#3b82f6' : '#22c55e'; // Blue for Window, Green for Crossing
              const fill = isWindow ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)';
              return (
                <rect
                  x={Math.min(selectionBox.startX, selectionBox.endX)}
                  y={Math.min(selectionBox.startY, selectionBox.endY)}
                  width={Math.abs(selectionBox.endX - selectionBox.startX)}
                  height={Math.abs(selectionBox.endY - selectionBox.startY)}
                  fill={fill}
                  stroke={color} strokeWidth="1" strokeDasharray={isWindow ? "" : "5,5"}
                />
              );
            })()}
          </svg>

        </div>
      </div>

      {contextMenu && (
        <div
          data-context-menu="true"
          onPointerDown={stopPropagation}
          className="fixed z-[200] w-44 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
          style={{
            left: contextMenu.x * view.zoom + view.x,
            top: contextMenu.y * view.zoom + view.y
          }}
        >
          {(() => {
            const menuItems = contextMenu.type === 'creation' ? [
              { id: 'chat', icon: MessageSquarePlus, label: 'AI对话' },
              { id: 'generator', icon: Sparkles, label: 'AI绘图' },
              { id: 'video', icon: SquarePlay, label: 'AI视频' },
              { id: 'text', icon: SquarePen, label: '文本输入' },
              { id: 'image', icon: ImageUp, label: '图片上传' },
              { id: 'preview', icon: ScanEye, label: '展示结果' },
              { id: 'divider', type: 'divider' },
              { id: 'bizyair', icon: Component, label: 'BizyAir生成器' },
              { id: 'bizyair_converter', icon: Biohazard, label: 'BizyAir转换器' },
            ] : contextMenu.type === 'unified_creation' ? [
              { id: 'text', icon: SquarePen, label: '文本输入' },
              { id: 'image', icon: ImageUp, label: '图片上传' },
              { id: 'preview', icon: ScanEye, label: '展示结果' },
            ] : contextMenu.type === 'unified_creation_forward' ? [
              { id: 'chat', icon: MessageSquarePlus, label: 'AI对话' },
              { id: 'generator', icon: Sparkles, label: 'AI绘图' },
              { id: 'video', icon: SquarePlay, label: 'AI视频' },
              { id: 'bizyair', icon: Component, label: 'BizyAir生成器' },
              { id: 'preview', icon: ScanEye, label: '展示结果' },
            ] : contextMenu.type === 'unified_creation_backward_preview' ? [
              { id: 'chat', icon: MessageSquarePlus, label: 'AI对话' },
              { id: 'generator', icon: Sparkles, label: 'AI绘图' },
              { id: 'video', icon: SquarePlay, label: 'AI视频' },
              { id: 'bizyair', icon: Component, label: 'BizyAir生成器' },
              { id: 'text', icon: SquarePen, label: '文本输入' },
              { id: 'image', icon: ImageUp, label: '图片上传' },
            ] : [
              { id: 'copy', icon: Copy, label: '复制', shortcut: 'Ctrl+C', onClick: handleCopyNodes, disabled: selectedNodeIds.length === 0 },
              { id: 'paste', icon: ClipboardPaste, label: '粘贴', shortcut: 'Ctrl+V', onClick: handlePasteNodes, disabled: !clipboard },
              { id: 'delete', icon: Trash2, label: '删除', shortcut: 'Delete', onClick: handleDeleteSelection, disabled: selectedNodeIds.length === 0 && !selectedLinkId },
              { id: 'divider-cp', type: 'divider' },
              { id: 'group', icon: Users, label: '编组', shortcut: 'Ctrl+G', onClick: handleGroupNodes, disabled: selectedNodeIds.length < 2 },
              { id: 'ungroup', icon: UserMinus, label: '解组', shortcut: 'Ctrl+Shift+G', onClick: handleUngroupNodes, disabled: selectedNodeIds.length === 0 },
              {
                id: 'align', icon: Layout, label: '对齐', children: [
                  { id: 'align_left', icon: AlignStartVertical, label: '左侧对齐', shortcut: 'Alt+1', onClick: () => handleAlignNodes('left'), disabled: selectedNodeIds.length < 2 },
                  { id: 'align_right', icon: AlignEndVertical, label: '右侧对齐', shortcut: 'Alt+2', onClick: () => handleAlignNodes('right'), disabled: selectedNodeIds.length < 2 },
                  { id: 'align_top', icon: AlignStartHorizontal, label: '顶部对齐', shortcut: 'Alt+3', onClick: () => handleAlignNodes('top'), disabled: selectedNodeIds.length < 2 },
                  { id: 'align_bottom', icon: AlignEndHorizontal, label: '底部对齐', shortcut: 'Alt+4', onClick: () => handleAlignNodes('bottom'), disabled: selectedNodeIds.length < 2 },
                  { id: 'align_center_h', icon: AlignCenterVertical, label: '水平居中', shortcut: 'Alt+5', onClick: () => handleAlignNodes('centerH'), disabled: selectedNodeIds.length < 2 },
                  { id: 'align_center_v', icon: AlignCenterHorizontal, label: '垂直居中', shortcut: 'Alt+6', onClick: () => handleAlignNodes('centerV'), disabled: selectedNodeIds.length < 2 },
                  { id: 'divider-align', type: 'divider' },
                  { id: 'dist_h', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="10" x="9" y="7" rx="2"/><path d="M4 22V2"/><path d="M20 22V2"/></svg>', customSvg: true, label: '水平均匀分布', shortcut: 'Alt+7', onClick: () => handleDistributeNodes('horizontal'), disabled: selectedNodeIds.length < 3 },
                  { id: 'dist_v', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="6" x="7" y="9" rx="2"/><path d="M22 20H2"/><path d="M22 4H2"/></svg>', customSvg: true, label: '垂直均匀分布', shortcut: 'Alt+8', onClick: () => handleDistributeNodes('vertical'), disabled: selectedNodeIds.length < 3 },
                  { id: 'divider-size', type: 'divider' },
                  { id: 'size_height', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="20" x="4" y="2" rx="2"/><rect width="6" height="20" x="14" y="2" rx="2"/></svg>', customSvg: true, label: '上下高度对齐', shortcut: 'Alt+9', onClick: () => handleSizeAlignNodes('height'), disabled: selectedNodeIds.length < 2 },
                  { id: 'size_width', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="6" x="2" y="4" rx="2"/><rect width="20" height="6" x="2" y="14" rx="2"/></svg>', customSvg: true, label: '左右宽度对齐', shortcut: 'Alt+0', onClick: () => handleSizeAlignNodes('width'), disabled: selectedNodeIds.length < 2 },
                ]
              },
              { id: 'send_text', icon: Type, label: '发送到文本输入', disabled: true },
              { id: 'send_img', icon: ImageIcon, label: '发送到图片输入', disabled: true },
            ];

            const renderItems = (items, depth = 0) => {
              return items.map(item => {
                const hasChildren = item.children && item.children.length > 0;
                const isHovered = activeSubmenu?.id === item.id;

                if (item.type === 'divider') {
                  return <div key={item.id} className="h-px bg-zinc-800 my-1 mx-2" />;
                }

                return (
                  <div key={item.id} className="relative group/item">
                    <button
                      disabled={item.disabled}
                      onPointerOver={() => hasChildren && setActiveSubmenu({ id: item.id, parentDepth: depth })}
                      onClick={(e) => {
                        if (hasChildren) return;
                        if (item.onClick) {
                          item.onClick();
                        } else if (['creation', 'unified_creation', 'unified_creation_forward', 'unified_creation_backward_preview'].includes(contextMenu.type)) {
                          createNode(item.id, contextMenu.x, contextMenu.y, contextMenu.fromId, contextMenu.toId);
                        }
                        setContextMenu(null);
                        setActiveSubmenu(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-[13px] transition-colors ${item.disabled ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon && (
                          item.customSvg ? (
                            <span dangerouslySetInnerHTML={{ __html: item.icon }} className="w-[15px] h-[15px] flex items-center justify-center" />
                          ) : (
                            <item.icon size={15} />
                          )
                        )}
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.shortcut && (
                          <span className="text-[11px] text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">{item.shortcut}</span>
                        )}
                        {hasChildren && <ChevronRight size={14} className="text-zinc-600" />}
                      </div>
                    </button>

                    {hasChildren && isHovered && (
                      <div
                        className="absolute left-full top-0 ml-1 w-48 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-2xl shadow-2xl py-2 animate-in fade-in slide-in-from-left-2 duration-200"
                        onPointerLeave={() => setActiveSubmenu(null)}
                      >
                        {renderItems(item.children, depth + 1)}
                      </div>
                    )}
                  </div>
                );
              });
            };

            return renderItems(menuItems);
          })()}
        </div>
      )}

      {/* --- 全局 UI --- */}
      <div className="absolute inset-0 pointer-events-none p-4">
        {/* Top Row: Branding & Toolbar */}
        <div className="flex justify-between items-start">
          {/* Branding & Project Name */}
          <div className="flex items-center gap-5 pointer-events-auto">
            {/* MindCanvas Logo & Text */}
            <div className="flex items-center gap-4 group/brand select-none">
              {/* Logo Icon - Scaled (0.9x) Rounded Polyline Star (Refined v8) */}
              <div className="relative w-11 h-11 rounded-[16px] bg-gradient-to-br from-[#B4A5FF] via-[#7F6AFF] to-[#3ABEF9] flex items-center justify-center shadow-[0_8px_32px_-6px_rgba(127,106,255,0.8)] border border-white/40 shrink-0 overflow-hidden">
                {/* High-Fidelity Frosted Glass Effect */}
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
                
                <div className="relative flex items-center justify-center translate-y-[0.5px]">
                   <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Straight-Edged Star with Rounded Tips & Stroke */}
                      <path 
                        d="M12 3.5 L14.5 10.5 L21 12 L14.5 13.5 L12 20.5 L9.5 13.5 L3 12 L9.5 10.5 Z" 
                        fill="white" 
                        stroke="white"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      {/* Repositioned Accent: Dot */}
                      <circle cx="5" cy="19" r="2.2" fill="white" />
                      {/* Repositioned Accent: Plus Sign */}
                      <path 
                        d="M19.5 6H23M21.25 4.25V7.75" 
                        stroke="white" 
                        strokeWidth="2.2" 
                        strokeLinecap="round"
                      />
                   </svg>
                </div>
              </div>
              
              {/* Brand Text */}
              <div className="flex flex-col -gap-0.5">
                <span className={`text-[22px] font-bold leading-none tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  MindCanvas
                </span>
                <span className={`text-[9px] font-black tracking-[0.18em] uppercase mt-0.5 ${theme === 'dark' ? 'text-zinc-300 opacity-50' : 'text-zinc-600'}`}>
                  Creative Flow Engine
                </span>
              </div>
            </div>

            {/* Separator */}
            <div className={`h-8 w-px ${theme === 'dark' ? 'bg-zinc-800/60' : 'bg-zinc-300'}`} />

            {/* Project Name Pill */}
            <div
              className={`backdrop-blur-xl border px-5 py-2.5 rounded-full shadow-2xl flex items-center min-w-[140px] transition-all duration-300 ${
                theme === 'dark' 
                ? 'bg-[#0a0a0b]/80 border-zinc-800/80 hover:border-zinc-700/80' 
                : 'bg-white/90 border-zinc-200/80 hover:border-zinc-300/80'
              }`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingProjectName(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isEditingProjectName ? (
                <div className="relative flex items-center w-full">
                  <span className="text-sm font-semibold whitespace-pre opacity-0 pointer-events-none select-none">
                    {projectName || ' '}
                  </span>
                  <input
                    autoFocus
                    className={`absolute inset-0 bg-transparent border-none outline-none text-sm font-semibold w-full ${
                      theme === 'dark' ? 'text-zinc-100 placeholder-zinc-700' : 'text-zinc-900 placeholder-zinc-400'
                    }`}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => setIsEditingProjectName(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setIsEditingProjectName(false);
                      if (e.key === 'Escape') setIsEditingProjectName(false);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                <span className={`text-sm font-semibold cursor-text select-text ${
                  theme === 'dark' ? 'text-zinc-200' : 'text-zinc-600'
                }`}>
                  {projectName}
                </span>
              )}
            </div>
          </div>

          {/* Top Right Toolbar Suite */}
          <div className="pointer-events-auto flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-700/50 rounded-full px-4 py-2 shadow-2xl">
            {/* Group 1: View / Zoom Info */}
            <button
              onClick={() => setIsViewLocked(!isViewLocked)}
              className={`flex items-center gap-2 border-r border-zinc-700/50 pr-4 transition-colors ${isViewLocked ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              title={isViewLocked ? "解锁画布缩放" : "锁定画布缩放 (仅允许平移)"}
            >
              {isViewLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span className="text-xs font-mono">{(view.zoom * 100).toFixed(0)}%</span>
            </button>

            {/* Group 2: Theme, Quality & Undo */}
            <div className="flex items-center gap-4 border-r border-zinc-700/50 pr-4">
              <button onClick={toggleTheme} className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors group">
                {theme === 'dark' ? (
                  <span className="flex items-center gap-1.5"><Sun size={14} className="text-zinc-400 group-hover:text-zinc-100 transition-colors" /> 亮色</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Moon size={14} className="text-zinc-600 group-hover:text-zinc-950 transition-colors" /> 暗色</span>
                )}
              </button>

              <button
                onClick={() => setQualityMode(prev => prev === 'ultra' ? 'performance' : 'ultra')}
                className={`text-xs font-medium transition-colors group flex items-center gap-1.5 ${qualityMode === 'performance' ? 'text-emerald-500/80 hover:text-emerald-400' : 'text-zinc-500 hover:text-blue-400'}`}
                title={qualityMode === 'ultra' ? "切换至性能模式 (节省内存)" : "切换至极致模式 (特效全开)"}
              >
                <Monitor size={14} className={`${qualityMode === 'performance' ? 'text-emerald-500' : 'text-zinc-500 group-hover:text-blue-400'} transition-colors`} />
                {qualityMode === 'performance' ? '性能' : '极致'}
              </button>

              <button
                onClick={undo}
                disabled={undoStack.length === 0}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${undoStack.length === 0 ? 'text-zinc-700 grayscale cursor-not-allowed opacity-50' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="撤回上一步操作 (Ctrl+Z)"
              >
                <Undo2 size={14} />
                <span>撤回</span>
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${redoStack.length === 0 ? 'text-zinc-700 grayscale cursor-not-allowed opacity-50' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="重做下一步操作 (Ctrl+Shift+Z)"
              >
                <Redo2 size={14} />
                <span>重做</span>
              </button>
            </div>

            {/* Group 3: Workflow Operations */}
            <div className="flex items-center gap-4 border-r border-zinc-700/50 pr-4 text-xs font-medium text-zinc-500">
              <button onClick={() => {
                if (window.confirm('确定要清空当前所有画布数据吗？此操作不可逆。')) {
                  takeSnapshot();
                  setNodes([]); setLinks([]); setNodeResults({}); setHasUnsavedChanges(false);
                }
              }} className="flex items-center gap-1.5 hover:text-red-500 transition-colors group" title="清空工作区">
                <Trash2 size={14} className="group-hover:scale-110 transition-transform" /> 清空
              </button>

              <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImport} />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors group" title="从 JSON 文件导入工作流">
                <Download size={14} className="group-hover:-translate-y-0.5 transition-transform" /> 导入
              </button>

              <button onClick={handleExport} className="flex items-center gap-1.5 hover:text-emerald-500 transition-colors group" title="保存工作流至本地 JSON">
                <Save size={14} className="group-hover:scale-110 transition-transform" /> 保存
              </button>
            </div>

            {/* Group 4: System Settings */}
            <div className="flex items-center pl-1 text-xs font-medium text-zinc-500">
              <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors group">
                <Settings size={14} className="group-hover:rotate-45 transition-transform" /> API 设置
              </button>
            </div>
          </div>
        </div>

        {/* --- Left Sidebar: Centered Vertically and Scaled to 9/10 --- */}
        <div className="absolute inset-y-0 left-4 flex items-center">
          <div className="flex flex-col items-center gap-[9px] pointer-events-auto bg-zinc-900/80 backdrop-blur-md border border-zinc-700/50 p-[9px] rounded-[20px] shadow-2xl">
            {/* Group 1: History */}
            <button onClick={() => setIsHistoryOpen(true)} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="历史记录">
              <History size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <div className="h-px w-[18px] bg-zinc-700/50 mx-auto" />

            {/* Group 2: Generation */}
            <button onClick={() => createNode('chat')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="新建AI对话节点">
              <MessageSquarePlus size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <button onClick={() => createNode('generator')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="新建AI绘图节点">
              <Sparkles size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <button onClick={() => createNode('video')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="新建AI视频节点">
              <SquarePlay size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <div className="h-px w-[18px] bg-zinc-700/50 mx-auto" />

            {/* Group 3: Inputs & Outputs */}
            <button onClick={() => createNode('text')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="文本输入">
              <SquarePen size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <button onClick={() => createNode('image')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="图片上传">
              <ImageUp size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <button onClick={() => createNode('preview')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="展示结果">
              <ScanEye size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <div className="h-px w-[18px] bg-zinc-700/50 mx-auto" />

            {/* Group 4: BizyAir */}
            <button onClick={() => createNode('bizyair')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="BizyAir生成器">
              <Component size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <button onClick={() => createNode('bizyair_converter')} className="w-10 h-10 flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 rounded-[13px] transition-all group" title="BizyAir转换器">
              <Biohazard size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-4 bg-zinc-900/40 backdrop-blur px-6 py-2.5 rounded-full border border-zinc-800/50 text-[11px] text-zinc-400 font-mono shadow-2xl">
            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 系统就绪</span>
            <div className="w-px h-3 bg-zinc-800" />
            <span>NODES: {nodes.length}</span>
            <div className="w-px h-3 bg-zinc-800" />
            <span>双击画布快速添加节点 / 连线右侧小圆点快速关联</span>
          </div>
        </div>
      </div>

      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSendToCanvas={(dataUrl) => {
          // Compute the canvas center in canvas-space from the current view
          const containerEl = containerRef.current;
          const cw = containerEl?.clientWidth ?? window.innerWidth;
          const ch = containerEl?.clientHeight ?? window.innerHeight;
          const nodeW = 360, nodeH = 360;
          const canvasX = (cw / 2 - view.x) / view.zoom - nodeW / 2;
          const canvasY = (ch / 2 - view.y) / view.zoom - nodeH / 2;
          const newNode = {
            id: `node-${Date.now()}`,
            type: 'image',
            x: canvasX, y: canvasY,
            w: nodeW, h: nodeH,
            data: { image: dataUrl },
          };
          takeSnapshot();
          setNodes(prev => [...prev, newNode]);
          setIsHistoryOpen(false);
        }}
      />

      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-4 md:p-10"
          onPointerDown={e => e.stopPropagation()}
          onPointerMove={e => e.stopPropagation()}
          onWheel={e => e.stopPropagation()}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-[28px] w-full max-w-[720px] h-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden"
            onPointerDown={e => e.stopPropagation()}
          >
            {/* Header: Centered Title */}
            <div className="relative p-6 shrink-0 border-b border-zinc-900">
              <h2 className="text-xl font-bold text-zinc-100 text-center tracking-wider">API 设置</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Tabs: Horizontal List Distributed Evenly */}
            <div className="flex gap-3 p-5 px-8 shrink-0 bg-zinc-900/5">
              {[
                { id: 'recommended', label: '推荐平台' },
                { id: 'ThirdParty1', label: '三方平台1' },
                { id: 'ThirdParty2', label: '三方平台2' },
                { id: 'ThirdParty3', label: '三方平台3' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id)}
                  className={`flex-1 py-3.5 text-[15px] font-bold rounded-xl border transition-all ${activeSettingsTab === tab.id
                    ? 'bg-zinc-100 border-zinc-100 text-zinc-950 shadow-lg'
                    : 'bg-transparent border-zinc-800/80 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area with Vertical Scrollbar */}
            <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar bg-zinc-950">
              {activeSettingsTab === 'recommended' ? (
                <div className="space-y-6">
                  <div className="border border-zinc-800/80 rounded-[20px] p-6 space-y-8">
                    {[
                      { id: 'BizyAir', name: 'BizyAir(ComfyUI应用)', baseUrl: 'https://api.bizyair.cn' },
                      { id: 'SiliconFlow', name: 'SiliconFlow(硅基流动)', baseUrl: 'https://api.siliconflow.cn' },
                      { id: 'ModelScope', name: 'ModelScope(魔搭平台)', baseUrl: 'https://api-inference.modelscope.cn' },
                      { id: 'Aliyun', name: 'Aliyun(阿里云百炼)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode' },
                      { id: 'Volcengine', name: 'Volcengine(火山引擎)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
                    ].map(platform => (
                      <div key={platform.id} className="space-y-3">
                        <div className="text-[15px] font-bold text-zinc-300 px-1">{platform.name}</div>
                        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
                          {/* Box 1: BASE URL */}
                          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest px-1">BASE URL</span>
                            <span className="text-xs font-mono text-zinc-400 opacity-80">{platform.baseUrl}</span>
                          </div>
                          {/* Box 2: API KEY */}
                          <div className="p-4 bg-zinc-900/30">
                            <div className="flex flex-col gap-2">
                              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest px-1">API KEY</span>
                              <div className="relative">
                                <input
                                  type={showKeys[platform.id] ? "text" : "password"}
                                  value={apiKeys[platform.id] || ''}
                                  onChange={e => setApiKeys(prev => ({ ...prev, [platform.id]: e.target.value }))}
                                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500/40 rounded-lg px-4 py-3 text-sm font-mono text-zinc-200 placeholder-zinc-800 outline-none transition-all shadow-inner"
                                  placeholder={`请输入 ${platform.id} Key...`}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowKeys(prev => ({ ...prev, [platform.id]: !prev[platform.id] }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors p-1.5"
                                >
                                  {showKeys[platform.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Platform Metadata: Outer Box */}
                  <div className="border border-zinc-800 rounded-[20px] p-6 bg-zinc-900/10 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Box: Platform Alias */}
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest px-1">PLATFORM ALIAS</div>
                        <div className="border border-zinc-800 rounded-xl bg-zinc-950 p-2">
                          <input
                            value={apiKeys[activeSettingsTab]?.platform || ''}
                            onChange={e => setApiKeys(prev => ({
                              ...prev,
                              [activeSettingsTab]: { ...prev[activeSettingsTab], platform: e.target.value }
                            }))}
                            className="w-full bg-transparent px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-800 outline-none"
                            placeholder="如: T8star"
                          />
                        </div>
                      </div>
                      {/* Box: API KEY */}
                      <div className="space-y-3">
                        <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest px-1">API KEY</div>
                        <div className="border border-zinc-800 rounded-xl bg-zinc-950 p-2 relative">
                          <input
                            type={showKeys[activeSettingsTab] ? "text" : "password"}
                            value={apiKeys[activeSettingsTab]?.api_key || ''}
                            onChange={e => setApiKeys(prev => ({
                              ...prev,
                              [activeSettingsTab]: { ...prev[activeSettingsTab], api_key: e.target.value }
                            }))}
                            className="w-full bg-transparent px-3 pr-10 py-2.5 text-sm font-mono text-zinc-200 placeholder-zinc-800 outline-none"
                            placeholder="输入 API Key"
                          />
                          <button
                            onClick={() => setShowKeys(prev => ({ ...prev, [activeSettingsTab]: !prev[activeSettingsTab] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 p-1.5"
                          >
                            {showKeys[activeSettingsTab] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sub Tabs: Internal Selector */}
                    <div className="flex gap-4 border-b border-zinc-800 pb-2 mb-2">
                      {[
                        { id: 'chat', label: 'Chat 模型列表' },
                        { id: 'image', label: 'Image 模型列表' },
                        { id: 'video', label: 'Video 模型列表' },
                      ].map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTPSubTab(sub.id)}
                          className={`text-[12px] font-bold pb-2 transition-all relative ${activeTPSubTab === sub.id ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          {sub.label}
                          {activeTPSubTab === sub.id && <div className="absolute bottom-[-1.5px] left-0 right-0 h-[2px] bg-blue-400 rounded-full" />}
                        </button>
                      ))}
                    </div>

                    {/* Dynamic Model Content: List within the outer box */}
                    <div className="space-y-5">
                      {((modelConfigs[activeTPSubTab]?.[activeSettingsTab]?.models && modelConfigs[activeTPSubTab]?.[activeSettingsTab]?.models.length > 0)
                        ? modelConfigs[activeTPSubTab][activeSettingsTab].models
                        : [{ id: '', url: '', statusUrl: '' }]
                      ).map((model, idx) => (
                        <div key={idx} className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/40">
                          <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Model {idx + 1}</span>
                            {/* Optional: Add Remove button here */}
                          </div>
                          <div className="p-4 space-y-4">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold text-zinc-600 ml-1">MODEL ID</span>
                              <input
                                value={model.id}
                                onChange={e => updateTPModel(activeTPSubTab, activeSettingsTab, idx, 'id', e.target.value)}
                                className="w-full bg-zinc-900/20 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-zinc-700"
                                placeholder="例如: gpt-4o"
                              />
                            </div>
                            {activeTPSubTab !== 'video' ? (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-bold text-zinc-600 ml-1">API URL</span>
                                <input
                                  value={model.url}
                                  onChange={e => updateTPModel(activeTPSubTab, activeSettingsTab, idx, 'url', e.target.value)}
                                  className="w-full bg-zinc-900/20 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                                  placeholder={activeTPSubTab === 'chat' ? ".../v1/chat/completions" : ".../v1/images/generations"}
                                />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] font-bold text-zinc-600 ml-1">SUBMIT URL</span>
                                  <input
                                    value={model.url}
                                    onChange={e => updateTPModel(activeTPSubTab, activeSettingsTab, idx, 'url', e.target.value)}
                                    className="w-full bg-zinc-900/20 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                                    placeholder=".../v1/video/submit"
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] font-bold text-zinc-600 ml-1">STATUS URL</span>
                                  <input
                                    value={model.statusUrl}
                                    onChange={e => updateTPModel(activeTPSubTab, activeSettingsTab, idx, 'statusUrl', e.target.value)}
                                    className="w-full bg-zinc-900/20 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-zinc-700 font-mono"
                                    placeholder=".../v1/video/status"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => addTPModel(activeTPSubTab, activeSettingsTab)}
                        className="w-full py-4 border border-dashed border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/30 transition-all gap-2"
                      >
                        <Plus size={16} />
                        <span className="text-[13px] font-bold underline underline-offset-4 decoration-zinc-800">增加一个模型配置</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Save Button */}
            <div className="p-8 shrink-0 border-t border-zinc-900 bg-zinc-950">
              <button
                onClick={handleSaveSettings}
                className="w-full py-4.5 bg-zinc-100 hover:bg-white text-zinc-950 text-base font-bold rounded-xl shadow-xl active:scale-[0.99] transition-all flex items-center justify-center gap-3"
              >
                <span>保存并应用配置</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
