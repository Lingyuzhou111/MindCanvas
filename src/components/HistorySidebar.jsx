import React, { useState, useEffect } from 'react';
import { History, X, Clock, ExternalLink, RefreshCw, FolderOpen, Trash2, Copy, Check, ImagePlus, Loader2 } from 'lucide-react';

export default function HistorySidebar({ isOpen, onClose, onSendToCanvas }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sendingId, setSendingId] = useState(null); // timestamp of image being sent

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const handleDelete = async (url) => {
    if (!window.confirm('确定要删除此生成记录吗？')) return;
    try {
      const res = await fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) fetchHistory();
      else alert('删除失败');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleOpenFolder = async (url) => {
    try {
      await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
    } catch (err) {
      console.error('Open folder failed:', err);
    }
  };

  const handleSendToCanvas = async (item) => {
    if (!onSendToCanvas || sendingId === item.timestamp) return;
    setSendingId(item.timestamp);
    try {
      // Fetch the image and convert to dataURL for the ImageNode
      const res = await fetch(item.url);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      onSendToCanvas(dataUrl);
    } catch (err) {
      console.error('Send to canvas failed:', err);
      alert('发送失败，请检查文件是否可访问');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[60] backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* 侧边栏 */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-zinc-50 border-r border-zinc-200/80 z-[70] transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-zinc-200/80 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2 text-zinc-900">
            <History size={18} className="text-blue-500" />
            <span className="font-bold tracking-tight">历史记录</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchHistory} className={`p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors ${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {loading && history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-zinc-600">
              <RefreshCw size={24} className="animate-spin" />
              <p className="text-xs">加载历史中...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-zinc-600 text-xs italic">暂无历史记录</p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="group relative bg-white border border-zinc-200 rounded-lg overflow-hidden hover:border-zinc-300 transition-all shadow-sm">
                <div
                  className="aspect-square w-full bg-black flex items-center justify-center relative cursor-pointer"
                  onDoubleClick={(e) => { e.stopPropagation(); window.open(item.url, '_blank'); }}
                  title={item.type === 'video' ? "双击查看原视频" : "双击查看原图"}
                >
                  {item.type === 'video' ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      autoPlay loop muted playsInline
                    />
                  ) : (
                    <img src={item.url} alt="History" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenFolder(item.url); }}
                      className="p-1.5 bg-black/60 backdrop-blur-sm rounded-md text-white hover:bg-black/80 border border-white/10"
                      title="打开所在文件夹"
                    >
                      <FolderOpen size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSendToCanvas(item); }}
                      className="p-1.5 bg-black/60 backdrop-blur-sm rounded-md text-white hover:bg-blue-500/80 border border-white/10 transition-colors"
                      title="发送至画布"
                      disabled={sendingId === item.timestamp}
                    >
                      {sendingId === item.timestamp
                        ? <Loader2 size={14} className="animate-spin" />
                        : <ImagePlus size={14} />}
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed italic mb-3">
                    "{item.prompt}"
                  </p>
                  <div className="flex items-center justify-between">
                    {/* Left: Time and Model */}
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 truncate max-w-[50%]">
                      <span className="shrink-0">{new Date(item.timestamp).toLocaleTimeString()}</span>
                      <span className="shrink-0">·</span>
                      <span className="truncate" title={item.model || 'Unknown'}>{(item.model || 'Unknown').split('/').pop()}</span>
                    </div>

                    {/* Right: Badges & Hover Actions */}
                    <div className="flex items-center justify-end shrink-0 relative flex-1">
                      {/* Default Badges */}
                      <div className="flex items-center gap-1.5 group-hover:opacity-0 transition-opacity duration-200">
                        {item.generationTime && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/5 px-1.5 py-0.5 rounded border border-emerald-400/30">
                            {item.generationTime}s
                          </span>
                        )}
                        <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <FolderOpen size={10} />
                          本地缓存
                        </span>
                      </div>

                      {/* Hover Actions (Replaces Badges on Hover) */}
                      <div className="absolute right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white pl-4 py-0.5">
                        <button onClick={() => handleDelete(item.url)} className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors border border-zinc-200 rounded hover:border-red-400 bg-zinc-100" title="删除记录">
                          <Trash2 size={12} />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.prompt);
                            setCopiedId(item.timestamp);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className={`p-1.5 transition-colors border rounded bg-zinc-100 ${copiedId === item.timestamp
                            ? 'text-green-600 border-green-500/50 hover:bg-green-50'
                            : 'text-zinc-500 hover:text-blue-500 border-zinc-200'
                            }`}
                          title="复制提示词"
                        >
                          {copiedId === item.timestamp ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
