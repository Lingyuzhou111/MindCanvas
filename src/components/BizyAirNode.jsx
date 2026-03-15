import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle, X, Copy, Check } from 'lucide-react';
import { generateBizyAirTask } from '../api/bizyair_api';
import bizyairLogo from '../assets/bizyair_logo.png';

// API route for the config fetch, proxies to backend via Vite
const BIZYAIR_APPS_URL = '/api/config/bizyair/apps';

// Determine if a URL is a video based on common extensions
const isVideoUrl = (url) => {
  if (!url) return false;
  if (typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  // 1. Standard extension or known video keywords in query
  if (/\.(mp4|webm|ogg|mov|avi|mkv|m4v|flv)(\?|$|#)/i.test(lowerUrl)) return true;
  // 2. Specific keywords from proxy/bridge
  if (lowerUrl.includes('/video/') || lowerUrl.includes('generated_video') || lowerUrl.includes('output_video')) return true;
  return false;
};

// Reusable Dropdown for Parameter selection
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
        className={`px-2 py-1 h-7 rounded-lg border flex items-center justify-center text-[11px] font-medium transition-colors ${isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-transparent border-zinc-700/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200'}`}
      >
        <span className="truncate max-w-[150px] block">{formatLabel(value)}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 left-0 w-fit flex flex-col items-stretch max-h-[260px] overflow-y-auto custom-scrollbar bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-200">
          {options.map(opt => (
            <button
              key={opt.value || opt}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value || opt);
                onToggle(false);
              }}
              className={`px-2 text-left py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${value === (opt.value || opt) ? 'bg-zinc-800 text-purple-400' : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'}`}
              title={opt.label || opt}
            >
              {opt.label || opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const BizyAirNode = ({ node, updateNode, inputImages = [], isInputConnected, isOutputConnected, apiKey, isSelected, isDragging, onDragStart, onOutput, inputText, theme, onDisconnect }) => {
  const [status, setStatus] = useState('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);
  const handledTriggerRef = useRef(node.data?.runTrigger || 0);
  const [copiedStatus, setCopiedStatus] = useState(false);

  const [prompt, setPrompt] = useState(node.data?.prompt || '');
  const [openMenu, setOpenMenu] = useState(null); // 'appSelect', 'ratio', 'res'

  // Dynamic Config fetching
  const [apps, setApps] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState(node.data?.selectedAppId || 'nb2_txt2img');

  useEffect(() => {
    // Fetch apps dynamically from the backend to ensure we get the latest generated apps
    fetch(BIZYAIR_APPS_URL)
      .then(res => res.json())
      .catch((err) => {
        console.warn("Could not fetch from backend directly, falling back to local file via Vite", err);
        return import('../../config/bizyair_apps.json');
      })
      .then(data => {
        // data might be {apps: []} from our new API, or the raw JSON default export from vite logic
        const loadedApps = data.apps || data.default?.apps || [];
        setApps(loadedApps);

        if (loadedApps.length > 0 && !loadedApps.find(a => a.id === selectedAppId)) {
          setSelectedAppId(loadedApps[0].id);
        }
      })
      .catch(console.error);
  }, []);
  const currentApp = useMemo(() => apps.find(a => a.id === selectedAppId) || apps[0], [apps, selectedAppId]);

  // Dynamic state for parameters
  const [resolution, setResolution] = useState(node.data?.resolution || '1K');
  const [aspectRatio, setAspectRatio] = useState(node.data?.aspectRatio || '1:1');

  // Sync state to node.data (useful for saved workflows)
  useEffect(() => {
    updateNode(node.id, { selectedAppId, prompt, resolution, aspectRatio });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId, prompt, resolution, aspectRatio, node.id]);

  // Handle external run trigger
  useEffect(() => {
    const trigger = node.data?.runTrigger;
    if (trigger && trigger > handledTriggerRef.current && status !== 'generating') {
      handledTriggerRef.current = trigger;
      handleGenerate();
    }
  }, [node.data?.runTrigger, status]);

  // Sync status to node.data for group orchestration
  useEffect(() => {
    if (node.data?.status !== status) {
      updateNode(node.id, { status });
    }
  }, [status, node.id, node.data?.status, updateNode]);

  const stopPropagation = (e) => e.stopPropagation();

  const handleGenerate = async () => {
    const needsPrompt = currentApp?.parameters?.some(p => p.source === 'prompt') || false;
    const hasInput = (needsPrompt && (prompt.trim() || inputText !== undefined)) || inputImages.length > 0;

    if (!hasInput) {
      setStatus('error');
      setErrorMsg('请提供必要的输入条件');
      return;
    }

    setStatus('generating');
    setProgressMsg('准备中...');
    setErrorMsg('');
    setElapsedTime(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    try {
      if (!apiKey) {
        throw new Error('请先在设置中配置 BIZYAIR API Key');
      }

      // Assemble generic params needed by bizyair_api mapping
      const actualPrompt = inputText !== undefined ? inputText : prompt;
      const dynamicParams = {
        prompt: actualPrompt,
        resolution,
        aspect_ratio: aspectRatio,
        image_1: inputImages[0]?.base64 || inputImages[0]?.file,
        image_2: inputImages[1]?.base64 || inputImages[1]?.file,
        image_3: inputImages[2]?.base64 || inputImages[2]?.file,
        image_4: inputImages[3]?.base64 || inputImages[3]?.file,
        image_5: inputImages[4]?.base64 || inputImages[4]?.file,
        image_6: inputImages[5]?.base64 || inputImages[5]?.file,
      };

      const resultUrl = await generateBizyAirTask(
        apiKey,
        currentApp,
        dynamicParams,
        (progressEvent) => {
          if (progressEvent.status === 'success') {
            clearInterval(timerRef.current);
          }
          setProgressMsg(progressEvent.message);
        }
      );

      setStatus('success');
      setProgressMsg(`生成完成！${resultUrl}`);

      // Attempt to save history
      try {
        const generationTimeSeconds = (Date.now() - startTime) / 1000;
        const isVid = isVideoUrl(resultUrl);
        const saveReq = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: resultUrl,
            platform: 'BizyAir',
            model: currentApp.name,
            prompt: prompt || '（无提示词）',
            generationTime: generationTimeSeconds.toFixed(1),
            type: isVid ? 'video' : 'image'
          })
        });
        const saveData = await saveReq.json();

        // Pass output forward
        if (saveData.success) {
          updateNode(node.id, { outputUrl: saveData.path, resultDetails: { width: 0, height: 0, scale: 1 } });
          if (onOutput) onOutput([saveData.path]);
        } else {
          updateNode(node.id, { outputUrl: resultUrl, resultDetails: { width: 0, height: 0, scale: 1 } });
          if (onOutput) onOutput([resultUrl]);
        }

      } catch (saveWaitErr) {
        updateNode(node.id, { outputUrl: resultUrl, resultDetails: { width: 0, height: 0, scale: 1 } });
        if (onOutput) onOutput([resultUrl]);
      }

    } catch (error) {
      clearInterval(timerRef.current);
      setStatus('error');
      setErrorMsg(error.message);
    }
  };

  const needsPrompt = currentApp?.parameters?.some(p => p.source === 'prompt') || false;

  const hasInput = (needsPrompt && (prompt.trim() || inputText !== undefined)) || inputImages.length > 0;

  // Format App selector for UI
  const formatAppLabel = (id) => apps.find(a => a.id === id)?.name || id;

  if (!currentApp) {
    return (
      <div
        id={`node-container-${node.id}`}
        className="absolute flex flex-col bg-zinc-900/95 backdrop-blur-md rounded-2xl border border-zinc-800/60 shadow-2xl items-center justify-center transition-all duration-300"
        style={{
          transform: `translate(${node.x}px, ${node.y}px)`,
          width: `${Math.max(400, node.w || 400)}px`,
          height: `${Math.max(400, node.h || 400)}px`,
        }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500 mb-2" />
        <div className="text-xs text-zinc-500">正在加载配置...</div>
      </div>
    );
  }

  return (
    <div
      id={`node-container-${node.id}`}
      className={`absolute flex flex-col bg-zinc-900/95 backdrop-blur-md rounded-2xl border group/node shadow-2xl ${
        isSelected ? 'node-selected-ring' : 'border-zinc-800/60'
      } ${status === 'generating' ? 'running-node-effect' : ''}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${Math.max(400, node.w || 400)}px`,
        height: `${Math.max(400, node.h || 520)}px`,
        transition: isDragging ? 'none' : undefined,
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

      <div
        className="flex items-center justify-between px-4 h-[42px] border-b border-zinc-800/60 shrink-0 cursor-grab active:cursor-grabbing"
        onPointerDown={onDragStart}
      >
        <div className="flex items-center gap-2.5">
          <img src={bizyairLogo} alt="BizyAir" className="w-3.5 h-3.5 object-contain" />
          <span className="text-sm font-medium tracking-tight text-zinc-200">
            BizyAir 生成器
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3 relative overflow-hidden z-10">
        {/* Dynamic Inputs: Text Prompt */}
        <div className="flex-1 bg-zinc-800/20 rounded-xl border border-zinc-800/50 focus-within:border-zinc-500/30 transition-all flex flex-col overflow-hidden relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="在此输入您的提示词或指令..."
            className="flex-1 w-full bg-transparent text-zinc-300 text-sm p-4 outline-none resize-none custom-scrollbar"
            disabled={status === 'generating' || inputText !== undefined}
            onPointerDown={e => e.stopPropagation()}
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
              <div key={idx} className="relative w-[60px] h-[60px] rounded-xl border-2 border-dashed border-zinc-700/50 bg-zinc-800/30 flex items-center justify-center overflow-hidden group/thumb hover:border-zinc-500 transition-colors">
                <img src={img.base64 || img.file} className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105" alt={`Input ${idx + 1}`} />
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


        {/* Dynamic Toolbar */}
        <div className="flex items-center justify-between shrink-0 h-9 px-1 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <ParameterDropdown
              value={selectedAppId}
              options={apps.map(a => ({ value: a.id, label: a.name }))}
              onChange={(val) => {
                setSelectedAppId(val);
                updateNode(node.id, { selectedAppId: val });
              }}
              isOpen={openMenu === 'appSelect'}
              onToggle={v => setOpenMenu(v ? 'appSelect' : null)}
              formatLabel={formatAppLabel}
            />
            {currentApp.parameters.some(p => p.source === 'aspect_ratio') && (
              <ParameterDropdown
                value={aspectRatio} options={['1:1', '1:4', '4:1', '1:8', '8:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9', 'auto']} onChange={setAspectRatio}
                isOpen={openMenu === 'ratio'} onToggle={o => setOpenMenu(o ? 'ratio' : null)}
              />
            )}
            {currentApp.parameters.some(p => p.source === 'resolution') && (
              <ParameterDropdown
                value={resolution} options={['1K', '2K', '4K', 'auto']} onChange={setResolution}
                isOpen={openMenu === 'res'} onToggle={o => setOpenMenu(o ? 'res' : null)}
              />
            )}
          </div>
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
            disabled={status === 'generating'}
            className={`h-7 w-8 flex items-center justify-center rounded-lg transition-all shrink-0 ml-2 ${status === 'generating'
              ? 'bg-zinc-800/50 text-zinc-600'
              : hasInput
                ? 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                : 'bg-zinc-800/30 text-zinc-500 border border-zinc-800/60'
              }`}
          >
            {status === 'generating' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} className={`ml-0.5 fill-current`} />
            )}
          </button>
        </div>

        {/* Status Bar */}
        <div className="relative group/statusbar shrink-0" onPointerDown={stopPropagation}>
          <div className="min-h-[32px] px-3 py-2 rounded-xl bg-zinc-800/30 border border-zinc-800/60 flex items-start gap-2.5 max-h-[100px] overflow-y-auto custom-scrollbar relative">
            <div className="mt-[2.5px] shrink-0">
              {status === 'generating' && <Loader2 size={12} className="animate-spin text-zinc-500" />}
              {status === 'success' && <CheckCircle2 size={12} className="text-green-500" />}
              {status === 'error' && <AlertCircle size={12} className="text-red-500" />}
            </div>
            <div className="flex-1 text-[11px] leading-normal break-all whitespace-pre-wrap">
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
      <div data-resize="left" data-id={node.id} className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize group/resize z-40">
        <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-l border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
      </div>
      <div data-resize="right" data-id={node.id} className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group/resize z-40">
        <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-r border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
      </div>
    </div>
  );
};
