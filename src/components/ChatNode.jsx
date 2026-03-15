import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquarePlus, Play, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { generateChat } from '../api/chat_api';

// --- Parameter Dropdown Component ---
const ParameterDropdown = ({ value, options, onChange, isOpen, onToggle, formatLabel = v => v, formatDropdownItem }) => {
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
        <span className="font-mono">{formatLabel(value)}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 left-[50%] -translate-x-[50%] w-fit flex flex-col items-stretch max-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-200">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt);
                onToggle(false);
              }}
              className={`px-4 py-1.5 text-[11px] font-medium font-mono transition-colors whitespace-nowrap ${value === opt ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
            >
              {formatDropdownItem ? formatDropdownItem(opt) : formatLabel(opt)}
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
        className={`h-7 px-2 rounded-lg border flex items-center justify-center text-[11px] font-medium transition-colors min-w-0 ${isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-transparent border-zinc-700/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200'
          }`}
      >
        <span className="truncate max-w-[170px] block">{formatLabel(value)}</span>
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
                      className={`w-full text-left px-4 py-2 text-[11px] font-medium transition-colors whitespace-nowrap overflow-hidden text-ellipsis block ${value === opt.label ? 'bg-zinc-800 text-purple-400' : 'hover:bg-zinc-800/80 hover:text-zinc-200 text-zinc-400'
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


export default function ChatNode({
  node, apiKeys, modelConfigs, updateNode, onDragStart, isDragging, isResizing, isSelected,
  inputText, // This would be the first text or an array, but we are getting sys/user specifically from App.jsx for ease
  systemInputText, userInputText, inputImages = [], onOutput, onDisconnect,
  isInputConnected, isOutputConnected,
}) {
  const [sysPrompt, setSysPrompt] = useState(node.data?.sysPrompt || '');
  const [userPrompt, setUserPrompt] = useState(node.data?.userPrompt || '');
  const [status, setStatus] = useState('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const handledTriggerRef = useRef(node.data?.runTrigger || 0);

  // Model Config
  const [maxTokens, setMaxTokens] = useState(node.data?.maxTokens || 512);
  const [temperature, setTemperature] = useState(node.data?.temperature || 0.8);
  const [topP, setTopP] = useState(node.data?.topP || 0.6);

  const [openMenu, setOpenMenu] = useState(null);

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

  // Parse dynamic modelConfigs into grouped format
  const groupedModels = useMemo(() => {
    const groups = {};
    if (!modelConfigs) return groups;

    for (const [platformKey, config] of Object.entries(modelConfigs)) {
      // Determine display platform name (e.g. ThirdParty1 -> T8star)
      let displayPlatform = platformKey;
      if (platformKey.startsWith('ThirdParty')) {
        const customName = apiKeys?.[platformKey]?.platform;
        if (customName) displayPlatform = customName;
      }

      if (Array.isArray(config.model)) {
        // Standard format: base_url + string array
        groups[displayPlatform] = config.model.map(mId => ({
          platformKey,
          displayPlatform,
          id: mId,
          displayName: mId,
          label: `${displayPlatform}/${mId}`,
          url: config.base_url
        }));
      } else if (Array.isArray(config.models)) {
        // Custom format: models array with { id, url }
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

  const handleGenerate = async () => {
    const actualSysPrompt = systemInputText !== undefined ? systemInputText : sysPrompt;
    const actualUserPrompt = userInputText !== undefined ? userInputText : userPrompt;

    try {
      if (!actualUserPrompt.trim() && inputImages.length === 0) {
        setStatus('error');
        setErrorMsg('请提供必要的输入条件');
        return;
      }

      let modelInfo = null;
      for (const models of Object.values(groupedModels)) {
        const found = models.find(m => m.label === selectedModelLabel);
        if (found) {
          modelInfo = found;
          break;
        }
      }

      if (!modelInfo) {
        alert("未找到选中的模型配置，请重新选择: " + selectedModelLabel);
        return;
      }

      const { platformKey, id: selectedModelId, url: endpoint } = modelInfo;

      const apiKeyRaw = apiKeys[platformKey];
      const apiKey = typeof apiKeyRaw === 'object' ? apiKeyRaw.api_key : apiKeyRaw;

      if (!apiKey || apiKey.trim() === '') {
        alert(`当前平台 "${modelInfo.displayPlatform}" 未填写 API Key`);
        return;
      }

      if (!endpoint) {
        alert(`模型 "${selectedModelId}" 未配置 API URL`);
        return;
      }

      setStatus('generating');
      setErrorMsg('');
      setProgressMsg('等待流式响应...');
      setStartTime(Date.now());

      updateNode(node.id, {
        sysPrompt, userPrompt, maxTokens, temperature, topP, modelLabel: selectedModelLabel
      });

      // Pass the effective endpoint to the API
      const activeImages = inputImages.map(img => img.url || img.base64 || img.file).filter(img => img);

      const finalText = await generateChat({
        endpoint,
        apiKey,
        model: selectedModelId,
        systemPrompt: actualSysPrompt,
        userPrompt: actualUserPrompt,
        images: activeImages,
        maxTokens,
        temperature,
        topP,
        onPartialResponse: (partialText) => {
          setProgressMsg('正在接收流式回复...');
          if (onOutput) onOutput([partialText]);
        }
      });
      setStatus('success');
      setProgressMsg(`完成`);
      setTimeout(() => setStatus('idle'), 3000);
      if (onOutput) onOutput([finalText]);
    } catch (err) {
      console.error("DEBUG ChatNode handleGenerate error:", err);
      setStatus('error');
      setErrorMsg(err.message || '申请失败');
      setProgressMsg('');
      alert("执行出错: " + (err.message || "未知错误"));
    }
  };

  return (
    <div
      id={`node-container-${node.id}`}
      className={`absolute flex flex-col bg-zinc-900/95 backdrop-blur-md border border-zinc-800/60 ${
        isSelected ? 'node-selected-ring' : ''
      } ${status === 'generating' ? 'running-node-effect' : ''} rounded-2xl shadow-2xl select-none touch-none group/node`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${Math.max(300, node.w || 500)}px`,
        height: `${Math.max(400, node.h || 520)}px`,
        zIndex: isDragging ? 50 : 10,
        pointerEvents: isDragging ? 'none' : 'auto'
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
      <div className="flex items-center justify-between px-4 h-[42px] border-b border-zinc-800/60 shrink-0 cursor-grab active:cursor-grabbing" onPointerDown={onDragStart}>
        <div className="flex items-center gap-2.5">
          <MessageSquarePlus size={14} className="text-zinc-400" />
          <span className="text-sm font-medium tracking-tight text-zinc-200">AI 对话</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-3 min-h-0 relative z-10">
        {/* Texts Area */}
        <div className="flex-1 flex flex-col gap-3 min-h-[120px]">
          {/* System Prompt */}
          <div data-port-visual={`${node.id}-sys`} className="flex-1 bg-zinc-800/20 rounded-xl border border-zinc-800 focus-within:border-zinc-700/50 transition-all flex flex-col overflow-visible relative">
            {(!sysPrompt && systemInputText === undefined) && (
              <label className="absolute top-2.5 left-3.5 text-[10px] text-zinc-600 font-bold uppercase tracking-wider pointer-events-none">SYSTEM</label>
            )}
            <textarea
              value={sysPrompt}
              onChange={(e) => setSysPrompt(e.target.value)}
              disabled={status === 'generating' || systemInputText !== undefined}
              onPointerDown={stopPropagation}
              onPointerMove={stopPropagation}
              className={`flex-1 w-full bg-transparent px-3 pb-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none resize-none custom-scrollbar ${(!sysPrompt && systemInputText === undefined) ? 'pt-7' : 'pt-3'}`}
              placeholder={(!sysPrompt && systemInputText === undefined) ? "系统指令..." : ""}
            />
            {systemInputText !== undefined && (
              <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                输入已接管
              </div>
            )}
          </div>

          {/* User Prompt */}
          <div data-port-visual={`${node.id}-user`} className="flex-1 bg-zinc-800/20 rounded-xl border border-zinc-800 focus-within:border-zinc-700/50 transition-all flex flex-col overflow-visible relative">
            {(!userPrompt && userInputText === undefined) && (
              <label className="absolute top-2.5 left-3.5 text-[10px] text-zinc-600 font-bold uppercase tracking-wider pointer-events-none">USER</label>
            )}
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              disabled={status === 'generating' || userInputText !== undefined}
              onPointerDown={stopPropagation}
              onPointerMove={stopPropagation}
              className={`flex-1 w-full bg-transparent px-3 pb-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none resize-none custom-scrollbar ${(!userPrompt && userInputText === undefined) ? 'pt-7' : 'pt-3'}`}
              placeholder={(!userPrompt && userInputText === undefined) ? "在此输入您的提示词..." : ""}
            />
            {userInputText !== undefined && (
              <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                输入已接管
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Image Thumbnails Area - Only show if images are connected */}
        {inputImages.length > 0 && (
          <div className="flex flex-wrap gap-3 px-1 py-1 shrink-0 animate-in fade-in slide-in-from-top-1 duration-300">
            {inputImages.map((img, idx) => (
              <div key={idx} data-port-visual={`${node.id}-img${idx+1}`} className="relative w-[60px] h-[60px] rounded-xl border-2 border-dashed border-zinc-700/50 bg-zinc-800/30 flex items-center justify-center overflow-hidden group/thumb hover:border-zinc-500 transition-colors">
                <img
                  src={img.url}
                  alt={`Input ${idx}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDisconnect) onDisconnect(img.fromId);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-all scale-75 hover:scale-100 z-10"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
            {inputImages.length < 6 && (
              <div className="w-[60px] h-[60px] rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 flex items-center justify-center hover:border-zinc-700 transition-colors">
                <span className="text-zinc-700 text-lg font-light">+</span>
              </div>
            )}
          </div>
        )}

        {/* Parameters & Action Bar */}
        <div className="flex items-center justify-between shrink-0 h-9 gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <CascadingModelDropdown
              value={selectedModelLabel} modelGroups={groupedModels} onChange={setSelectedModelLabel}
              isOpen={openMenu === 'model'} onToggle={(open) => setOpenMenu(open ? 'model' : null)}
            />
            <div className="flex items-center gap-1">
              <ParameterDropdown
                value={maxTokens} options={[512, 1024, 2048, 4096, 8192]} onChange={setMaxTokens}
                isOpen={openMenu === 'maxTokens'} onToggle={o => setOpenMenu(o ? 'maxTokens' : null)}
              />
              <ParameterDropdown
                value={temperature} options={[0.2, 0.4, 0.6, 0.8, 1.0]} onChange={setTemperature}
                isOpen={openMenu === 'temp'} onToggle={o => setOpenMenu(o ? 'temp' : null)}
                formatLabel={v => v.toFixed(1)}
                formatDropdownItem={v => `temperature: ${v.toFixed(1)}`}
              />
              <ParameterDropdown
                value={topP} options={[0.2, 0.4, 0.6, 0.8, 1.0]} onChange={setTopP}
                isOpen={openMenu === 'topP'} onToggle={o => setOpenMenu(o ? 'topP' : null)}
                formatLabel={v => v.toFixed(1)}
                formatDropdownItem={v => `top_p: ${v.toFixed(1)}`}
              />
            </div>
          </div>
          <button
            onClick={handleGenerate}
            onPointerDown={stopPropagation}
            disabled={status === 'generating' || (!userPrompt.trim() && !userInputText?.trim())}
            className={`h-7 w-8 flex items-center justify-center rounded-lg transition-all shrink-0 ${status === 'generating' || (!userPrompt.trim() && !userInputText?.trim())
              ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
              }`}
          >
            {status === 'generating' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="ml-0.5 fill-current" />}
          </button>
        </div>

        {/* Status Bar */}
        <div className="shrink-0 min-h-[32px] px-3 py-2 rounded-xl bg-zinc-800/30 border border-zinc-800/60 flex items-start gap-2 max-h-[100px] overflow-y-auto custom-scrollbar">
          <div className="mt-0.5 shrink-0">
            {status === 'generating' && <Loader2 size={11} className="animate-spin text-zinc-500" />}
            {status === 'success' && <CheckCircle2 size={11} className="text-green-500" />}
            {status === 'error' && <AlertCircle size={11} className="text-red-500" />}
          </div>
          <div className="flex-1 text-[10px] font-medium leading-relaxed tracking-tight">
            {status === 'generating' && <span className="text-zinc-400">{progressMsg}</span>}
            {status === 'success' && <span className="text-green-500">{progressMsg}</span>}
            {status === 'error' && <span className="text-red-500">{errorMsg}</span>}
            {status === 'idle' && <span className="text-zinc-600 font-medium">已就绪 (Ready)</span>}
          </div>
          {status === 'generating' && (
            <div className="text-[9px] font-bold font-mono text-zinc-500 shrink-0 mt-0.5">
              {(elapsedTime / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </div>

      {/* Standard Input Port (Left - Unified) */}
      <div
        data-port-input="true" data-id={node.id}
        className="absolute top-1/2 -left-3.5 w-7 h-7 -translate-y-1/2 flex items-center justify-center pointer-events-auto cursor-crosshair transition-all duration-200 z-50 opacity-0 scale-90 group-hover/node:opacity-100 group-hover/node:scale-100"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all shadow-xl">
          <span className="text-xl font-light leading-none mb-0.5">+</span>
        </div>
      </div>

      {/* Output Port (Right) */}
      <div
        data-port-output="true" data-id={node.id}
        className="absolute top-1/2 -right-3.5 w-7 h-7 -translate-y-1/2 flex items-center justify-center pointer-events-auto cursor-crosshair transition-all duration-200 z-50 opacity-0 scale-90 group-hover/node:opacity-100 group-hover/node:scale-100"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all shadow-xl">
          <span className="text-xl font-light leading-none mb-0.5">+</span>
        </div>
      </div>

      {/* Resize Handles */}
      <div data-resize="left" data-id={node.id} className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize group/resize z-40">
        <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-l border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
      </div>
      <div data-resize="right" data-id={node.id} className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group/resize z-40">
        <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-r border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
      </div>
    </div>
  );
}

