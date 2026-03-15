import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Loader2, SquarePlay, Play, CheckCircle2, AlertCircle, Copy, Check, X } from 'lucide-react';
import { generateVideo } from '../api/video_api';

const RATIO_OPTIONS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const DURATION_OPTIONS = ['5s', '6s', '8s', '10s', '15s'];
const QUALITY_OPTIONS = ['480P', '720P', '1080P'];
const MODE_OPTIONS = ['文生视频', '首帧模式', '首尾帧模式', '多参模式'];

// ---------- Shared ParameterDropdown ----------
const ParameterDropdown = ({
    value, options, onChange, isOpen, onToggle,
    formatLabel = v => v, formatDropdownItem = v => v,
}) => {
    const ref = useRef(null);
    useEffect(() => {
        if (!isOpen) return;
        const fn = e => { if (ref.current && !ref.current.contains(e.target)) onToggle(false); };
        document.addEventListener('pointerdown', fn);
        return () => document.removeEventListener('pointerdown', fn);
    }, [isOpen, onToggle]);

    return (
        <div className="relative" ref={ref} onPointerDown={e => e.stopPropagation()}>
            <button
                onClick={e => { e.stopPropagation(); onToggle(!isOpen); }}
                className={`h-7 px-2.5 rounded-lg border flex items-center justify-center text-[11px] font-medium transition-colors ${isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                    : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
            >
                {formatLabel(value)}
            </button>
            {isOpen && (
                <div className="absolute bottom-full mb-1 left-[50%] -translate-x-[50%] w-fit flex flex-col items-stretch max-h-[260px] overflow-y-auto custom-scrollbar bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl py-1 z-[100] animate-in fade-in zoom-in-95 duration-200">
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={e => { e.stopPropagation(); onChange(opt); onToggle(false); }}
                            className={`px-1.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${value === opt ? 'bg-zinc-800 text-zinc-300' : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                                }`}
                        >
                            {formatDropdownItem ? formatDropdownItem(opt) : opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ---------- Cascading Model Dropdown ----------
const CascadingModelDropdown = ({ value, modelGroups, onChange, isOpen, onToggle }) => {
    const ref = useRef(null);
    const [hoveredPlatform, setHoveredPlatform] = useState(null);

    useEffect(() => {
        if (!isOpen) { setHoveredPlatform(null); return; }
        const fn = e => { if (ref.current && !ref.current.contains(e.target)) onToggle(false); };
        document.addEventListener('pointerdown', fn);
        return () => document.removeEventListener('pointerdown', fn);
    }, [isOpen, onToggle]);

    // Derive display label from value
    const displayLabel = value ? value.split('/').slice(1).join('/') : '选择模型';

    return (
        <div className="relative" ref={ref} onPointerDown={e => e.stopPropagation()}>
            <button
                onClick={e => { e.stopPropagation(); onToggle(!isOpen); }}
                className={`h-7 px-2 rounded-lg border flex items-center text-[11px] font-medium transition-colors min-w-0 ${isOpen ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                    : 'bg-transparent border-zinc-700/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200'
                    }`}
            >
                <span className="truncate max-w-[80px] block">{displayLabel}</span>
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-1 left-0 w-max min-w-[120px] bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] py-1 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {Object.keys(modelGroups).map(platform => (
                        <div
                            key={platform}
                            onMouseEnter={() => setHoveredPlatform(platform)}
                            className="relative px-4 py-2 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 transition-colors flex justify-between items-center cursor-default group/menu"
                        >
                            <span>{platform}</span>
                            <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[4px] border-l-zinc-500 group-hover/menu:border-l-zinc-300 border-b-[3px] border-b-transparent ml-3" />
                            {hoveredPlatform === platform && (
                                <div
                                    className="absolute bottom-[-5px] left-full ml-1 w-max min-w-[150px] max-w-[280px] max-h-[300px] overflow-y-auto custom-scrollbar bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] py-1 z-[101] animate-in fade-in zoom-in-95 duration-200"
                                    onMouseEnter={() => setHoveredPlatform(platform)}
                                >
                                    {modelGroups[platform].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={e => { e.stopPropagation(); onChange(opt.label); onToggle(false); }}
                                            className={`w-full text-left px-4 py-2 text-[11px] font-medium transition-colors whitespace-nowrap overflow-hidden text-ellipsis block ${value === opt.label ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                                                }`}
                                            title={opt.label}
                                        >
                                            {opt.displayName}
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

// ---------- Main VideoNode Component ----------
export default function VideoNode({
    node, updateNode, apiKeys, modelConfigs,
    onDragStart, isDragging, isResizing, isSelected,
    onOutput,
    inputText, inputImages = [],
    isInputConnected, isOutputConnected, onDisconnect
}) {
    const [prompt, setPrompt] = useState(node.data?.prompt || '');
    const [status, setStatus] = useState('idle');
    const [openMenu, setOpenMenu] = useState(null);
    const [progressMsg, setProgressMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [startTime, setStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [copiedStatus, setCopiedStatus] = useState(false);
    const handledTriggerRef = useRef(node.data?.runTrigger || 0);

    // Parameters
    const [ratio, setRatio] = useState(node.data?.ratio || '16:9');
    const [duration, setDuration] = useState(node.data?.duration || '5s');
    const [quality, setQuality] = useState(node.data?.quality || '720P');
    const [mode, setMode] = useState(node.data?.mode || '文生视频');
    // Parse dynamic modelConfigs into cascading groups
    const modelGroups = useMemo(() => {
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
                // Standard format (SiliconFlow, etc.)
                groups[displayPlatform] = config.model
                    .filter(m => m)
                    .map(mId => ({
                        platformKey,
                        displayPlatform,
                        id: mId,
                        displayName: mId,
                        label: `${displayPlatform}/${mId}`,
                        submitUrl: config.submit_url,
                        statusUrl: config.status_url
                    }));
            } else if (Array.isArray(config.models)) {
                // Custom format (ThirdParty)
                groups[displayPlatform] = config.models
                    .filter(m => m.id && m.id.trim() !== '')
                    .map(m => ({
                        platformKey,
                        displayPlatform,
                        id: m.id,
                        displayName: m.id,
                        label: `${displayPlatform}/${m.id}`,
                        submitUrl: m.url,
                        statusUrl: m.statusUrl
                    }));
            }
        }
        return groups;
    }, [modelConfigs, apiKeys]);

    const [selectedModelLabel, setSelectedModelLabel] = useState(() => {
        if (node.data?.modelLabel) return node.data.modelLabel;
        const platforms = Object.keys(modelGroups);
        if (platforms.length > 0 && modelGroups[platforms[0]].length > 0) {
            return modelGroups[platforms[0]][0].label;
        }
        return '';
    });

    // Timer for generation progress
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

    const stopPropagation = e => e.stopPropagation();

    const handleGenerate = async () => {
        let modelInfo = null;
        for (const models of Object.values(modelGroups)) {
            const found = models.find(m => m.label === selectedModelLabel);
            if (found) {
                modelInfo = found;
                break;
            }
        }

        if (!modelInfo) { setStatus('error'); setErrorMsg('未找到选中的模型配置，请重新选择'); return; }

        const { platformKey, id: selectedModelId, submitUrl, statusUrl, displayPlatform } = modelInfo;
        const apiKeyRaw = apiKeys?.[platformKey];
        const currentApiKey = typeof apiKeyRaw === 'object' ? apiKeyRaw.api_key : apiKeyRaw;

        if (!currentApiKey || currentApiKey.trim() === '') {
            setStatus('error');
            setErrorMsg(`请先配置 ${displayPlatform} 的 API Key`);
            return;
        }
        const currentPrompt = inputText !== undefined ? inputText : prompt;
        if (!currentPrompt.trim() && inputImages.length === 0) {
            setStatus('error');
            setErrorMsg('请提供必要的输入条件');
            return;
        }

        setStatus('generating'); setErrorMsg(''); setProgressMsg('正在初始化...'); setStartTime(Date.now());
        try {
            const videoUrl = await generateVideo(
                currentApiKey, currentPrompt,
                {
                    platform: platformKey,
                    model: selectedModelId,
                    submitUrl,
                    statusUrl,
                    ratio,
                    duration,
                    quality,
                    mode,
                    img1Data: inputImages[0]?.url,
                    img2Data: inputImages[1]?.url
                },
                ({ message }) => setProgressMsg(message)
            );
            const finalUrl = videoUrl;

            // Save history
            try {
                const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
                const saveRes = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageUrl: finalUrl, // we pass the video URL here
                        type: 'video',
                        platform: platformKey,
                        model: selectedModelId,
                        prompt: currentPrompt,
                        generationTime: elapsedSeconds
                    })
                });

                if (saveRes.ok) {
                    const savedData = await saveRes.json();
                    if (savedData.success) {
                        console.log('Video auto-saved to history:', savedData.path);
                    }
                }
            } catch (saveErr) {
                console.error('Failed to auto-save video to history:', saveErr);
            }

            setStatus('success');
            setProgressMsg(`生成完成！${finalUrl}`);
            if (typeof onOutput === 'function') onOutput([finalUrl]);
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message || '生成失败');
        }
    };

    const actualPrompt = inputText !== undefined ? inputText : prompt;

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
            <div className="flex items-center px-4 h-[42px] border-b border-zinc-800/60 cursor-grab active:cursor-grabbing shrink-0" onPointerDown={onDragStart}>
                <div className="flex items-center gap-2.5">
                    <SquarePlay size={16} className="text-zinc-400" />
                    <span className="text-sm font-medium tracking-tight text-zinc-200">AI 视频</span>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col gap-3 overflow-hidden p-4 min-h-0">
                {/* Prompt Area */}
                <div className="relative flex-1 group/promptarea min-h-0">
                    <div className="h-full bg-zinc-800/20 rounded-xl border border-zinc-800/50 focus-within:border-zinc-500/30 transition-all flex flex-col overflow-hidden relative" onPointerDown={stopPropagation}>
                        <textarea
                            value={prompt}
                            onChange={e => { setPrompt(e.target.value); updateNode(node.id, { prompt: e.target.value }); }}
                            onWheel={e => { if (e.currentTarget.scrollHeight > e.currentTarget.clientHeight) e.stopPropagation(); }}
                            onPointerMove={e => e.stopPropagation()}
                            onContextMenu={e => {
                                const target = e.target;
                                if (target.selectionStart !== target.selectionEnd) {
                                    e.stopPropagation();
                                }
                            }}
                            placeholder="描述你想要生成的视频内容..."
                            className="flex-1 w-full bg-transparent p-4 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none custom-scrollbar"
                            style={{ resize: 'none' }}
                            disabled={status === 'generating' || inputText !== undefined}
                        />
                        {inputText !== undefined && (
                            <div className="absolute inset-0 bg-zinc-900/60 flex items-center justify-center text-xs text-zinc-500 font-medium pointer-events-none backdrop-blur-[2px] z-10">
                                输入已接管
                            </div>
                        )}
                    </div>
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


                {/* Parameter Bar */}
                <div className="flex items-center justify-between shrink-0 h-9 px-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <CascadingModelDropdown
                            value={selectedModelLabel}
                            modelGroups={modelGroups}
                            onChange={v => { setSelectedModelLabel(v); updateNode(node.id, { modelLabel: v }); }}
                            isOpen={openMenu === 'model'}
                            onToggle={o => setOpenMenu(o ? 'model' : null)}
                        />
                        <ParameterDropdown
                            value={ratio}
                            options={RATIO_OPTIONS}
                            onChange={v => { setRatio(v); updateNode(node.id, { ratio: v }); }}
                            isOpen={openMenu === 'ratio'}
                            onToggle={o => setOpenMenu(o ? 'ratio' : null)}
                        />
                        <ParameterDropdown
                            value={duration}
                            options={DURATION_OPTIONS}
                            onChange={v => { setDuration(v); updateNode(node.id, { duration: v }); }}
                            isOpen={openMenu === 'duration'}
                            onToggle={o => setOpenMenu(o ? 'duration' : null)}
                        />
                        <ParameterDropdown
                            value={quality}
                            options={QUALITY_OPTIONS}
                            onChange={v => { setQuality(v); updateNode(node.id, { quality: v }); }}
                            isOpen={openMenu === 'quality'}
                            onToggle={o => setOpenMenu(o ? 'quality' : null)}
                        />
                        <ParameterDropdown
                            value={mode}
                            options={MODE_OPTIONS}
                            onChange={v => { setMode(v); updateNode(node.id, { mode: v }); }}
                            isOpen={openMenu === 'mode'}
                            onToggle={o => setOpenMenu(o ? 'mode' : null)}
                            formatLabel={v => v.length > 5 ? v.slice(0, 4) + '…' : v}
                        />
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={status === 'generating' || !actualPrompt.trim()}
                        className={`h-7 w-8 flex items-center justify-center rounded-lg transition-all shrink-0 ml-2 ${status === 'generating' || !actualPrompt.trim()
                            ? 'bg-zinc-800/50 text-zinc-600'
                            : 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                            }`}
                    >
                        {status === 'generating' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="ml-0.5 fill-current" />}
                    </button>
                </div>

                {/* Status Bar */}
                <div className="relative group/statusbar shrink-0" onPointerDown={stopPropagation}>
                    <div className="min-h-[32px] px-3 py-2 rounded-xl bg-zinc-800/30 border border-zinc-800/60 flex items-start gap-2.5 max-h-[100px] overflow-y-auto custom-scrollbar">
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
            <div data-resize="left" data-id={node.id} className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize group/resize">
                <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-l border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
            </div>
            <div data-resize="right" data-id={node.id} className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group/resize">
                <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-r border-b border-zinc-700 group-hover/resize:border-zinc-500 transition-colors" />
            </div>
        </div>
    );
}
