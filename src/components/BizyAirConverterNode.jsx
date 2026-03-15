import React, { useState } from 'react';
import { Biohazard, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import bizyairLogo from '../assets/bizyair_logo.png';

const BIZYAIR_APPS_URL = '/api/config/bizyair/apps';

export const BizyAirConverterNode = ({ node, updateNode, isInputConnected, isOutputConnected, isSelected, isResizing, isDragging, onDragStart }) => {
  const [appId, setAppId] = useState('');
  const [appName, setAppName] = useState('');
  const [code, setCode] = useState('');

  const [parsedData, setParsedData] = useState(null); // { web_app_id, parameters }
  const [status, setStatus] = useState('idle'); // idle, parsing, parsed, saving, success, error
  const [errorMsg, setErrorMsg] = useState('');

  // ... (handleParse, handleUpdateParamValue, handleDeleteParam, handleSave logic remains same)
  // (Assuming logic is already correct, focusing on UI refactor)

  const handleParse = () => {
    try {
      setStatus('parsing');
      setErrorMsg('');

      if (!appId || !appName) throw new Error('请输入应用 ID 和名称');
      if (!code.trim()) throw new Error('请输入 cURL 或 JSON 示例代码');

      let jsonPayload = null;
      try {
        if (code.includes('curl ') || code.includes('-d \'')) {
          const match = code.match(/-d\s+'({[\s\S]*?})'/);
          if (match && match[1]) {
            jsonPayload = JSON.parse(match[1]);
          } else {
            const match2 = code.match(/-d\s+"({[\s\S]*?})"/);
            if (match2 && match2[1]) jsonPayload = JSON.parse(match2[1].replace(/\\"/g, '"'));
            else throw new Error("无法从 cURL 中匹配到 JSON 数据体");
          }
        } else {
          jsonPayload = JSON.parse(code);
        }
      } catch (e) {
        throw new Error('解析 JSON 数据源失败: ' + e.message);
      }

      if (!jsonPayload.web_app_id) throw new Error('未找到 web_app_id');
      if (!jsonPayload.input_values) throw new Error('未找到 input_values');

      const parameters = [];
      let imageCounter = 1;

      for (const [key, val] of Object.entries(jsonPayload.input_values)) {
        if (key.match(/prompt$/i)) {
          parameters.push({ key, label: "提示词", type: "string", source: "prompt" });
        } else if (key.match(/aspect_ratio$/i)) {
          parameters.push({ key, label: "画幅比例", type: "aspect_ratio", source: "aspect_ratio" });
        } else if (key.match(/resolution$/i)) {
          parameters.push({ key, label: "分辨率", type: "resolution", source: "resolution" });
        } else if (key.match(/image$/i)) {
          parameters.push({ key, label: `参考图${imageCounter}`, type: "image_url", source: `image_${imageCounter}` });
          imageCounter++;
        } else {
          parameters.push({ key, label: key.split('.').pop() || key, type: "constant", value: val });
        }
      }

      setParsedData({ web_app_id: jsonPayload.web_app_id, parameters });
      setStatus('parsed');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const handleUpdateParamValue = (idx, newValue) => {
    const newParams = [...parsedData.parameters];
    newParams[idx].value = newValue;
    setParsedData({ ...parsedData, parameters: newParams });
  };

  const handleDeleteParam = (idx) => {
    const newParams = [...parsedData.parameters];
    newParams.splice(idx, 1);
    let imgCounter = 1;
    for (const p of newParams) {
      if (p.type === 'image_url') {
        p.label = `参考图${imgCounter}`;
        p.source = `image_${imgCounter}`;
        imgCounter++;
      }
    }
    setParsedData({ ...parsedData, parameters: newParams });
  };

  const handleSave = async () => {
    try {
      setStatus('saving');
      setErrorMsg('');

      const appConfig = {
        id: appId,
        name: appName,
        type: 'image',
        web_app_id: parsedData.web_app_id,
        parameters: parsedData.parameters
      };

      const res = await fetch('/api/config/bizyair/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appConfig)
      });

      if (!res.ok) throw new Error('保存失败');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const stopPropagation = e => e.stopPropagation();

  return (
    <div
      id={`node-container-${node.id}`}
      data-node-id={node.id}
      className={`absolute flex flex-col bg-zinc-900/95 backdrop-blur-md rounded-2xl border group/node shadow-2xl ${
        isSelected ? 'node-selected-ring' : 'border-zinc-800/60'
      }`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${Math.max(400, node.w || 400)}px`,
        height: `${Math.max(300, node.h || 400)}px`,
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
            BizyAir 转换器
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1 overflow-hidden relative z-10">
        {/* Basic Settings */}
        <div className="flex gap-2 shrink-0">
          <input
            className="flex-1 bg-zinc-800/40 text-xs text-zinc-200 px-3 py-2 rounded-lg outline-none border border-zinc-800 focus:border-zinc-500/30 transition-all"
            placeholder="应用 ID (如 nb2_multi)"
            value={appId}
            onChange={e => setAppId(e.target.value)}
            onPointerDown={stopPropagation}
            onPointerMove={stopPropagation}
            onContextMenu={e => {
              const target = e.target;
              if (target.selectionStart !== target.selectionEnd) e.stopPropagation();
            }}
          />
          <input
            className="flex-1 bg-zinc-800/40 text-xs text-zinc-200 px-3 py-2 rounded-lg outline-none border border-zinc-800 focus:border-zinc-500/30 transition-all"
            placeholder="应用名称 (如 NanoBanana2)"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            onPointerDown={stopPropagation}
            onPointerMove={stopPropagation}
            onContextMenu={e => {
              const target = e.target;
              if (target.selectionStart !== target.selectionEnd) e.stopPropagation();
            }}
          />
        </div>

        {/* Code Input */}
        <div className="flex-1 min-h-[100px] flex flex-col">
          <textarea
            className="flex-1 w-full bg-zinc-800/20 text-xs text-zinc-300 p-4 rounded-xl border border-zinc-800 focus:border-zinc-500/30 outline-none resize-none custom-scrollbar transition-all"
            placeholder="在此粘贴 cURL 或 JSON 示例代码..."
            value={code}
            onChange={e => setCode(e.target.value)}
            onPointerDown={stopPropagation}
            onPointerMove={stopPropagation}
            onContextMenu={e => {
              const target = e.target;
              if (target.selectionStart !== target.selectionEnd) e.stopPropagation();
            }}
          />
        </div>

        {/* Parse Button */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            handleParse();
          }}
          disabled={status === 'parsing'}
          className={`w-full shrink-0 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
            status === 'parsing' ? 'bg-zinc-800 text-zinc-600' : 'bg-zinc-100 text-zinc-900 hover:bg-white shadow-sm'
          }`}
        >
          {status === 'parsing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '智能解析代码'}
        </button>

        {/* Parsed Results Review */}
        {parsedData && (
          <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/60 flex flex-col gap-2 max-h-[300px] shrink-0">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono border-b border-zinc-800/60 pb-2 mb-1">
              <span className="truncate max-w-[200px]">ID: {parsedData.web_app_id}</span>
              <span>参数: {parsedData.parameters.length}</span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
              {parsedData.parameters.map((param, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] text-zinc-600 truncate uppercase tracking-wider">{param.key}</div>
                    <div className="text-xs text-zinc-300 flex items-center gap-1.5 mt-0.5 font-medium">
                      <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[9px] text-zinc-500">{param.type}</span>
                      <span className="truncate">{param.label}</span>
                    </div>
                  </div>

                  {param.type === 'constant' && (
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => handleUpdateParamValue(idx, e.target.value)}
                      className="w-24 bg-zinc-900 text-xs text-zinc-300 px-2 py-1 rounded border border-zinc-800 focus:border-zinc-500/30 outline-none transition-all"
                      onPointerDown={stopPropagation}
                      onPointerMove={stopPropagation}
                    />
                  )}

                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleDeleteParam(idx);
                    }}
                    className="p-1.5 hover:bg-zinc-800 text-zinc-600 hover:text-red-400 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              disabled={status === 'saving'}
              className="mt-2 w-full py-2.5 bg-zinc-100 text-zinc-900 hover:bg-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
            >
              {status === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '完成并保存配置'}
            </button>
          </div>
        )}

        {/* Status messages */}
        {status === 'success' && (
          <div className="flex items-center justify-center gap-1.5 text-green-500 text-[11px] font-medium mt-1 shrink-0 animate-in fade-in slide-in-from-bottom-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 应用已保存！
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center justify-center gap-1.5 text-red-500 text-[11px] font-medium mt-1 shrink-0 animate-in fade-in slide-in-from-bottom-1">
            <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
          </div>
        )}
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
