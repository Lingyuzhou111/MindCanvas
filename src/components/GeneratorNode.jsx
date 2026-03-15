import React, { useState, useRef, useEffect, useMemo } from 'react';
import { generateImage } from '../api/image_api';
import { Loader2, Sparkles, Play, CheckCircle2, AlertCircle, X, Copy, Check } from 'lucide-react';

const RATIO_OPTIONS = ['1:1', '2:3', '3:4', '9:16', '16:9', '4:3', '3:2', '21:9'];
const RES_OPTIONS = ['Auto', '1K', '1.5K', '2K', '4K'];
const QUANTITY_OPTIONS = [1, 2, 4, 9];

// 通用下拉选择器组件 (受控模式)
const ParameterDropdown = ({ value, options, onChange, isOpen, onToggle, formatLabel = v => v }) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onToggle(false);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef} onPointerDown={e => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!isOpen);
        }}
        className={`h-7 px-2.5 rounded-lg border flex items-center justify-center text-[11px] font-medium transition-colors ${isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200'
          }`}
      >
        {formatLabel(value)}
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 left-0 w-fit flex flex-col items-stretch max-w-[240px] max-h-[300px] overflow-y-auto custom-scrollbar bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-200">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt);
                onToggle(false);
              }}
              className={`px-1.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${value === opt ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
            >
              {formatLabel(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Cascading Dropdown for Model Selection ---
const CascadingModelDropdown = ({ value, modelGroups, onChange, isOpen, onToggle, formatLabel = v => v }) => {
  const dropdownRef = useRef(null);
  const [hoveredPlatform, setHoveredPlatform] = useState(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onToggle(false);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    } else {
      setHoveredPlatform(null);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef} onPointerDown={e => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(!isOpen);
        }}
        className={`h-7 px-3 rounded-lg border flex items-center justify-center text-[11px] font-medium transition-colors ${isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-transparent border-zinc-700/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200'
          }`}
      >
        <span className="truncate max-w-[140px] block">{formatLabel(value)}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 left-0 w-max min-w-[120px] bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] py-1 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {Object.keys(modelGroups).map((platform) => (
            <div
              key={platform}
              onMouseEnter={() => setHoveredPlatform(platform)}
              className="relative w-full text-left px-4 py-2 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors flex justify-between items-center cursor-default group/menu"
            >
              <span>{platform}</span>
              <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[4px] border-l-zinc-500 group-hover/menu:border-l-zinc-300 border-b-[3px] border-b-transparent ml-3"></div>

              {/* Secondary Sub Menu */}
              {hoveredPlatform === platform && (
                <div
                  className="absolute bottom-[-5px] left-full ml-1 w-max min-w-[150px] max-w-[280px] max-h-[300px] overflow-y-auto custom-scrollbar bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] py-1 z-[101] animate-in fade-in zoom-in-95 duration-200"
                  onMouseEnter={() => setHoveredPlatform(platform)}
                >
                  {modelGroups[platform].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(opt.label);
                        onToggle(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[11px] font-medium transition-colors whitespace-nowrap overflow-hidden text-ellipsis block ${value === opt.label ? 'bg-zinc-800 text-blue-400' : 'hover:bg-zinc-800/80 hover:text-zinc-200 text-zinc-400'
                        }`}
                      title={opt.label}
                    >
                      {formatLabel(opt.displayName)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function GeneratorNode({ node, updateNode, apiKeys, modelConfigs, onDragStart, isDragging, isResizing, isSelected, isInputConnected, isOutputConnected, onOutput,
  inputText, inputImages = [], onDisconnect
}) {
  const [prompt, setPrompt] = useState(node.data?.prompt || '');
  const [status, setStatus] = useState('idle');
  const [ratio, setRatio] = useState(node.data?.ratio || '1:1');
  const [resolution, setResolution] = useState(node.data?.resolution || '1K');
  const [quantity, setQuantity] = useState(node.data?.quantity || 1);
  const [openMenu, setOpenMenu] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copiedStatus, setCopiedStatus] = useState(false);
  const handledTriggerRef = useRef(node.data?.runTrigger || 0);

  // Parse dynamic modelConfigs into grouped format
  const groupedModels = useMemo(() => {
    const groups = {};
    if (!modelConfigs) return groups;

    for (const [platformKey, config] of Object.entries(modelConfigs)) {
      // Determine display platform name
      let displayPlatform = platformKey;
      if (platformKey.startsWith('ThirdParty')) {
        const customName = apiKeys?.[platformKey]?.platform;
        if (customName) displayPlatform = customName;
      }

      if (Array.isArray(config.model)) {
        groups[displayPlatform] = config.model.map(mId => ({
          platformKey,
          displayPlatform,
          id: mId,
          displayName: mId,
          label: `${displayPlatform}/${mId}`,
          url: config.base_url
        }));
      } else if (Array.isArray(config.models)) {
        groups[displayPlatform] = config.models
          .filter(m => m.id && m.id.trim() !== '')
          .map(m => ({
            platformKey,
            displayPlatform,
            id: m.id,
            displayName: m.id,
            label: `${displayPlatform}/${m.id}`,
            url: m.url
          }));
      }
    }
    return groups;
  }, [modelConfigs, apiKeys]);

  const [selectedModelLabel, setSelectedModelLabel] = useState(() => {
    if (node.data?.modelLabel) return node.data.modelLabel;
    const platforms = Object.keys(groupedModels);
    if (platforms.length > 0 && groupedModels[platforms[0]].length > 0) {
      return groupedModels[platforms[0]][0].label;
    }
    return '';
  });

  useEffect(() => {
    let interval;
    if (status === 'generating' && startTime) {
      interval = setInterval(() => setElapsedTime(Date.now() - startTime), 100);
    } else if (status !== 'generating') {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  // Sync status to node.data for group orchestration
  useEffect(() => {
    if (node.data?.status !== status) {
      updateNode(node.id, { status });
    }
  }, [status, node.id, node.data?.status, updateNode]);

  // Handle external run trigger
  useEffect(() => {
    const trigger = node.data?.runTrigger;
    if (trigger && trigger > handledTriggerRef.current && status !== 'generating') {
      handledTriggerRef.current = trigger;
      handleGenerate();
    }
  }, [node.data?.runTrigger, status]);

  const stopPropagation = (e) => e.stopPropagation();

  const handleGenerate = async () => {
    try {
      let modelInfo = null;
      for (const models of Object.values(groupedModels)) {
        const found = models.find(m => m.label === selectedModelLabel);
        if (found) {
          modelInfo = found;
          break;
        }
      }

      if (!modelInfo) {
        alert("找不到对应模型: " + selectedModelLabel);
        return;
      }

      const { platformKey, id: selectedModelId, url: endpoint } = modelInfo;
      const displayPlatform = modelInfo.displayPlatform;

      const apiKeyRaw = apiKeys?.[platformKey];
      const currentApiKey = typeof apiKeyRaw === 'object' ? apiKeyRaw.api_key : apiKeyRaw;
      const actualPrompt = inputText !== undefined ? inputText : prompt;

      // Input Validation: Need either prompt OR image
      if (!actualPrompt.trim() && inputImages.length === 0) {
        setStatus('error');
        setErrorMsg('请提供必要的输入条件');
        return;
      }

      if (!currentApiKey) {
        setStatus('error');
        setErrorMsg(`请先配置 ${displayPlatform} 的 API Key`);
        return;
      }

      setStatus('generating');
      setErrorMsg('');
      setProgressMsg('等待服务端响应...');
      setStartTime(Date.now());

      const results = [];
      const platform = platformKey; // Code uses platformKey internally for logic often, but for API we send the model ID
      const model = selectedModelId;

      const activeImages = inputImages;

      let saveUrl = '';
      for (let i = 0; i < quantity; i++) {
        const loopStartTime = Date.now();
        setProgressMsg(`任务已成功提交, 正在轮询结果... (${i + 1}/${quantity})`);
        console.dir({
          action: 'Calling generateImage',
          platform,
          model,
          endpoint,
          currentApiKey: currentApiKey ? `${currentApiKey.substring(0, 4)}...` : 'undefined',
          prompt: actualPrompt,
          ratio,
          resolution,
          inputImagesCount: inputImages.length
        });

        const url = await generateImage(
          currentApiKey,
          actualPrompt,
          { ratio, resolution, platform, model, inputImages: activeImages, endpoint },
          (info) => {
            if (info.status === 'RUNNING') setProgressMsg(`正在轮询异步查询生成结果... (${i + 1}/${quantity})`);
            else setProgressMsg(`${info.message} (${i + 1}/${quantity})`);
          }
        );

        setProgressMsg(`下载并保存图片... (${i + 1}/${quantity})`);

        saveUrl = url;
        let isLocalSaved = false;
        try {
          const saveRes = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: url,
              platform,
              model,
              prompt: actualPrompt,
              generationTime: Number(((Date.now() - loopStartTime) / 1000).toFixed(1))
            })
          });

          if (!saveRes.ok) {
            console.warn('Backend save API returned status:', saveRes.status);
          } else {
            const saveData = await saveRes.json();
            if (saveData.path) {
              saveUrl = `/${saveData.path}`;
              isLocalSaved = true;
            }
          }
        } catch (saveErr) {
          console.error('Failed to save image locally:', saveErr);
          // Fallback to the original URL if local save fails
        }

        results.push(saveUrl);
        if (onOutput) onOutput([...results]);
      }

      setStatus('success');
      setProgressMsg(`生成完成！${saveUrl}`);
      updateNode(node.id, { prompt, ratio, resolution, quantity, modelLabel: selectedModelLabel });

    } catch (err) {
      console.error("DEBUG CAUGHT ERROR:", err);
      // alert(`Error: ${err.message}`); // uncomment if needed for hard debugging
      setStatus('error');
      setErrorMsg(err.message || '生成失败');
      setProgressMsg('');
    }
  };

  return (
    <div
      id={`node-container-${node.id}`}
      className={`absolute flex flex-col bg-zinc-900/95 backdrop-blur-md rounded-2xl border group/node shadow-2xl select-none touch-none ${
        isSelected ? 'node-selected-ring border-zinc-300' : 'border-zinc-800/60'
      } ${status === 'generating' ? 'running-node-effect' : ''}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${Math.max(300, node.w || 500)}px`,
        height: `${Math.max(400, node.h || 520)}px`,
        transition: isDragging ? 'none' : undefined,
        zIndex: isDragging ? 50 : 10,
      }}
    >
      {/* Input Connected State Glow Effect */}
      {isInputConnected && (
        <div className="absolute top-0 bottom-0 left-0 w-[1.5px] bg-gradient-to-b from-transparent via-zinc-400 to-transparent shadow-[0_0_12px_rgba(161,161,170,0.4)] z-50 pointer-events-none" />
      )}

      {/* Output Connected State Glow Effect */}
      {isOutputConnected && (
        <div className="absolute top-0 bottom-0 right-0 w-[1.5px] bg-gradient-to-b from-transparent via-zinc-400 to-transparent shadow-[0_0_12px_rgba(161,161,170,0.4)] z-50 pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[42px] border-b border-zinc-800/60 cursor-grab active:cursor-grabbing shrink-0" onPointerDown={onDragStart}>
        <div className="flex items-center gap-2.5 text-zinc-300">
          <Sparkles size={16} className="text-zinc-400" />
          <span className="text-sm font-medium tracking-tight text-zinc-200">AI 绘图</span>
        </div>
        {status === 'generating' && <Loader2 size={14} className="animate-spin text-zinc-400" />}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
        {/* Prompt Input Area */}
        <div data-port-visual={`${node.id}-txt`} className="flex-1 bg-zinc-800/20 rounded-xl border border-zinc-800/50 focus-within:border-zinc-500/30 transition-all flex flex-col overflow-hidden relative" onPointerDown={stopPropagation}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入提示词..."
            className="flex-1 w-full bg-transparent p-4 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none resize-none custom-scrollbar"
            style={{ resize: 'none' }}
            disabled={status === 'generating' || inputText !== undefined}
            onPointerMove={e => e.stopPropagation()}
            onContextMenu={e => {
              const target = e.target;
              if (target.selectionStart !== target.selectionEnd) {
                e.stopPropagation();
              }
            }}
          />
          {inputText !== undefined && (
            <div className="absolute inset-0 bg-zinc-900/60 flex items-center justify-center text-xs text-zinc-500 font-medium pointer-events-none backdrop-blur-[2px] z-10">
              输入已接管
            </div>
          )}
        </div>

        {/* Dynamic Image Thumbnails Area */}
        {inputImages.length > 0 && (
          <div className="flex flex-wrap gap-3 px-1 py-1 shrink-0 animate-in fade-in slide-in-from-top-1 duration-300">
            {inputImages.map((img, idx) => (
              <div key={idx} data-port-visual={`${node.id}-img${idx+1}`} className="relative w-[60px] h-[60px] rounded-xl border-2 border-dashed border-zinc-700/50 bg-zinc-800/30 flex items-center justify-center overflow-hidden group/thumb hover:border-zinc-500 transition-colors">
                <img src={img.url} className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105" alt={`Input ${idx + 1}`} />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                  <span className="text-zinc-200 text-lg font-light">+</span>
                </div>
                <div className="absolute top-1 left-1 px-1.5 bg-zinc-900/90 rounded-md text-[9px] font-bold text-zinc-400 border border-zinc-800 pointer-events-none shadow-sm">
                  IMG{idx + 1}
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisconnect?.(img.fromId);
                  }}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-lg"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              </div>
            ))}
            {/* Adding placeholder if less than 6 images */}
            {inputImages.length < 6 && (
              <div className="relative w-[60px] h-[60px] rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 flex items-center justify-center hover:border-zinc-700 transition-colors">
                <span className="text-zinc-700 text-lg font-light">+</span>
              </div>
            )}
          </div>
        )}


        {/* Parameters & Action Bar */}
        <div className="flex items-center justify-between shrink-0 h-9 px-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <CascadingModelDropdown
              value={selectedModelLabel} modelGroups={groupedModels} onChange={setSelectedModelLabel}
              isOpen={openMenu === 'model'} onToggle={(open) => setOpenMenu(open ? 'model' : null)}
            />
            <ParameterDropdown
              value={ratio} options={RATIO_OPTIONS} onChange={setRatio}
              isOpen={openMenu === 'ratio'} onToggle={(open) => setOpenMenu(open ? 'ratio' : null)}
            />
            <ParameterDropdown
              value={resolution} options={RES_OPTIONS} onChange={setResolution}
              isOpen={openMenu === 'resolution'} onToggle={(open) => setOpenMenu(open ? 'resolution' : null)}
            />
            <ParameterDropdown
              value={quantity} options={QUANTITY_OPTIONS} onChange={setQuantity} formatLabel={v => `${v}张`}
              isOpen={openMenu === 'quantity'} onToggle={(open) => setOpenMenu(open ? 'quantity' : null)}
            />
          </div>
          <button
            onClick={handleGenerate}
            onPointerDown={stopPropagation}
            disabled={status === 'generating' || (!prompt.trim() && !inputText?.trim())}
            className={`h-7 w-8 flex items-center justify-center rounded-lg transition-all shrink-0 ml-2 ${status === 'generating' || (!prompt.trim() && !inputText?.trim())
              ? 'bg-zinc-800/50 text-zinc-600'
              : 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              }`}
          >
            {status === 'generating' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="ml-0.5 fill-current" />}
          </button>
        </div>

        {/* Status Bar */}
        <div className="relative group/statusbar shrink-0" onPointerDown={stopPropagation}>
          <div className="min-h-[32px] px-3 py-2 rounded-xl bg-zinc-800/30 border border-zinc-800/60 flex items-start gap-2.5 max-h-[150px] overflow-y-auto custom-scrollbar relative">
            <div className="mt-[2.5px] shrink-0">
              {status === 'generating' && <Loader2 size={12} className="animate-spin text-zinc-500" />}
              {status === 'success' && <CheckCircle2 size={12} className="text-green-500" />}
              {status === 'error' && <AlertCircle size={12} className="text-red-500" />}
            </div>

            <div className="flex-1 text-[11px] break-all leading-normal whitespace-pre-wrap">
              {status === 'generating' && <span className="text-zinc-500">{progressMsg}</span>}
              {status === 'success' && <span className="text-green-500 font-medium">{progressMsg}</span>}
              {status === 'error' && <span className="text-red-500 font-medium">{errorMsg}</span>}
              {status === 'idle' && <span className="text-zinc-600">已就绪 (Ready)</span>}
            </div>

            {status === 'generating' && (
              <div className="text-[10px] font-mono text-zinc-500 shrink-0 font-medium bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800">
                {(elapsedTime / 1000).toFixed(1)}s
              </div>
            )}
          </div>
          {status !== 'idle' && (
            <button
                className="absolute bottom-1.5 right-1.5 opacity-0 group-hover/statusbar:opacity-100 transition-opacity p-1 rounded-md bg-zinc-800 text-zinc-500 hover:text-zinc-200"
                onClick={(e) => {
                    e.stopPropagation();
                    const textToCopy = status === 'error' ? errorMsg : progressMsg;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        setCopiedStatus(true);
                        setTimeout(() => setCopiedStatus(false), 2000);
                    });
                }}
            >
                {copiedStatus ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Standard Input Port (Left) */}
      <div
        data-port-input="true"
        data-id={node.id}
        className="absolute top-1/2 -left-3.5 w-7 h-7 -translate-y-1/2 flex items-center justify-center pointer-events-auto cursor-crosshair transition-all duration-200 z-50 opacity-0 scale-90 group-hover/node:opacity-100 group-hover/node:scale-100"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all shadow-xl">
          <span className="text-xl font-light leading-none mb-0.5">+</span>
        </div>
      </div>

      {/* Standard Output Port (Right) */}
      <div
        data-port-output="true"
        data-id={node.id}
        className="absolute top-1/2 -right-3.5 w-7 h-7 -translate-y-1/2 flex items-center justify-center pointer-events-auto cursor-crosshair transition-all duration-200 z-50 opacity-0 scale-90 group-hover/node:opacity-100 group-hover/node:scale-100"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all shadow-xl">
          <span className="text-xl font-light leading-none mb-0.5">+</span>
        </div>
      </div>

      {/* Resize Handles */}
      <div data-resize="left" data-id={node.id} className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize group/resize">
        <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-l border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
      </div>
      <div data-resize="right" data-id={node.id} className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group/resize">
        <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-r border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
      </div>
    </div>
  );
}
