import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Maximize2 as Maximize, X, Film, ScanEye, Type, AlignLeft, RefreshCw } from 'lucide-react';

// Determine if a URL is a video based on common extensions or OSS/CDN path patterns
const isVideoUrl = (url) => {
  if (!url) return false;
  if (typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();

  // First check if it's an image - if so, return false immediately
  if (/\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?|$|#)/i.test(lowerUrl)) return false;

  // 1. Standard video extension with dot in path or query string
  if (/\.(mp4|webm|ogg|mov|avi|mkv|m4v|flv)(\?|$|#)/i.test(lowerUrl)) return true;

  // 2. Base64-encoded extension names (Grok/ThirdParty2)
  // Use word boundary check to avoid matching substrings in filenames
  if (/\btcdq\b/.test(lowerUrl) || /\bd2vibq\b/.test(lowerUrl)) return true;

  // 3. Common keywords
  if (lowerUrl.includes('/video/') || lowerUrl.includes('generated_video') || lowerUrl.includes('output_video') || lowerUrl.includes('_video_')) return true;

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    // Check if pathname ends with video extension
    return /\.(mp4|webm|ogg|mov|avi|mkv|m4v|flv)$/.test(pathname);
  } catch {
    return false;
  }
};

// Check if it's media (image or video)
const isMedia = (url) => {
  if (!url) return false;
  if (typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  
  // Basic media detection
  const isWebUrl = lowerUrl.startsWith('http') || lowerUrl.startsWith('https');
  const isDataUrl = lowerUrl.startsWith('data:image');
  const isLocalOutput = lowerUrl.startsWith('output/') || lowerUrl.startsWith('/output/');

  if (isWebUrl || isDataUrl || isLocalOutput) {
    // If it's a web URL, check if it looks like a media file
    if (isWebUrl) {
      return isVideoUrl(url) || /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?|$|#)/i.test(lowerUrl);
    }
    return true;
  }
  return false;
};

export default function ResultDisplayNode({ 
  node, onDragStart, isDragging, isResizing, isSelected, 
  inputData, upstreamNode, isInputConnected, isOutputConnected 
}) {
  const [fullscreenItem, setFullscreenItem] = useState(null);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [displayText, setDisplayText] = useState('');
  const [resolution, setResolution] = useState(null);
  const [mode, setMode] = useState('empty'); // 'empty' | 'media' | 'text'

  useEffect(() => {
    if (!inputData || (Array.isArray(inputData) && inputData.length === 0)) {
      // Only reset the node content if it's already empty to avoid losing manual refresh data
      setMode(prev => prev === 'empty' ? prev : prev); 
      return;
    }

    const dataArr = Array.isArray(inputData) ? inputData : [inputData];
    
    // Check first item to determine mode
    const firstItem = dataArr[0];
    if (isMedia(firstItem)) {
      const filteredMedia = dataArr.filter(isMedia);
      setMode(prev => prev === 'media' ? prev : 'media');
      setMediaUrls(prev => JSON.stringify(prev) === JSON.stringify(filteredMedia) ? prev : filteredMedia);
      setDisplayText(prev => prev === '' ? prev : '');
    } else {
      const combinedText = dataArr.join('\n\n');
      setMode(prev => prev === 'text' ? prev : 'text');
      setDisplayText(prev => prev === combinedText ? prev : combinedText);
      setMediaUrls(prev => prev.length === 0 ? prev : []);
    }
  }, [inputData]);

  useEffect(() => {
    if (mode === 'media' && mediaUrls.length > 0) {
      const firstUrl = mediaUrls[0];
      const isVid = isVideoUrl(firstUrl);
      
      if (isVid) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          setResolution(`${video.videoWidth}x${video.videoHeight}`);
        };
        video.src = firstUrl;
      } else {
        const img = new Image();
        img.onload = () => {
          setResolution(`${img.width}x${img.height}`);
        };
        img.src = firstUrl;
      }
    } else {
      setResolution(null);
    }
  }, [mode, mediaUrls]);

  const stopPropagation = (e) => e.stopPropagation();

  const handleDownload = async (url, isVideo) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = isVideo ? 'mp4' : 'png';
      const guessedName = url.split('/').pop().split('?')[0] || `easy-canvas-${Date.now()}.${ext}`;
      a.download = guessedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed', err);
      window.open(url, '_blank');
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper to extract URLs from text
  const extractUrls = (text) => {
    if (!text || typeof text !== 'string') return [];
    // More robust regex for URLs
    const urlRegex = /(https?:\/\/[^\s\n\r\t,;"]+)/g;
    const matches = text.match(urlRegex) || [];
    return matches.map(u => u.trim()).filter(id => id);
  };

  const handleRefresh = async (e) => {
    e.stopPropagation();
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Priority 1: Upstream Manual Refresh (Direct Data Pull)
      if (upstreamNode) {
        if (upstreamNode.type === 'text') {
          const text = upstreamNode.data?.text || '';
          const urls = extractUrls(text);
          
          if (urls.length > 0) {
            // Check if they are media URLs
            const mediaLinks = urls.filter(u => isVideoUrl(u) || isMedia(u));

            if (mediaLinks.length > 0) {
              // Save to temp and update
              const savedPaths = await Promise.all(mediaLinks.map(async (url) => {
                try {
                  const res = await fetch('/api/save-temp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                  });
                  const data = await res.json();
                  return data.success ? data.path : url;
                } catch (err) {
                  return url;
                }
              }));
              setMode('media');
              setMediaUrls(savedPaths);
              setDisplayText('');
              return;
            }
          }
          // No media URLs found, just show text
          setMode('text');
          setDisplayText(text);
          setMediaUrls([]);
        } else if (upstreamNode.type === 'image') {
          const imageUrl = upstreamNode.data?.image;
          if (imageUrl) {
            setMode('media');
            setMediaUrls([imageUrl]);
            setDisplayText('');
            return;
          }
        }
      }

      // Fallback: Validate current media links (previous behavior)
      if (mode === 'media' && mediaUrls.length > 0) {
        const validatedResults = await Promise.all(
          mediaUrls.map(async (url) => {
            try {
              const res = await fetch(url, { method: 'HEAD' });
              return res.ok ? url : null;
            } catch {
              return null;
            }
          })
        );
        
        const validUrls = validatedResults.filter(url => url !== null);
        
        if (validUrls.length === 0) {
          setMode('empty');
          setMediaUrls([]);
          setResolution(null);
        } else if (validUrls.length !== mediaUrls.length) {
          setMediaUrls(validUrls);
        }
      } else if (mode === 'empty') {
          // If empty and we have inputData, try to re-process it
          if (inputData) {
              const dataArr = Array.isArray(inputData) ? inputData : [inputData];
              const firstItem = dataArr[0];
              if (isMedia(firstItem)) {
                setMode('media');
                setMediaUrls(dataArr.filter(isMedia));
              } else {
                setMode('text');
                setDisplayText(dataArr.join('\n\n'));
              }
          }
      }
    } catch (err) {
      console.error('Refresh failed', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const hasVideo = mediaUrls.some(isVideoUrl);
  const hasImage = mediaUrls.some(u => !isVideoUrl(u));
  const badgeLabel = hasVideo && hasImage ? '混合内容' : hasVideo ? '视频结果' : '图片结果';

  return (
    <div
      id={`node-container-${node.id}`}
      onPointerDown={onDragStart}
      className={`absolute flex flex-col bg-zinc-900/95 backdrop-blur-md border rounded-2xl shadow-2xl select-none touch-none group/node ${
        isSelected ? 'node-selected-ring border-zinc-300' : 'border-zinc-800/60'
      }`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${node.w || (mode === 'text' ? 400 : 500)}px`,
        height: `${node.h || (mode === 'text' ? 300 : 400)}px`,
        zIndex: isDragging ? 50 : 10,
      }}
    >
      {/* Glow Effect */}
      {isInputConnected && (
        <div className="absolute top-0 bottom-0 left-0 w-[1.5px] bg-gradient-to-b from-transparent via-zinc-400 to-transparent shadow-[0_0_12px_rgba(161,161,170,0.4)] z-50 pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[42px] border-b border-zinc-800/60 shrink-0 rounded-t-2xl">
        <div className="flex items-center gap-2.5 text-zinc-300">
          {mode === 'text' ? <AlignLeft size={16} className="text-zinc-400" /> : <ScanEye size={16} className="text-zinc-400" />}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tracking-tight text-zinc-200">展示结果</span>
            {resolution && mode === 'media' && (
              <span className="text-[11px] text-zinc-500 font-normal opacity-80">{resolution}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'media' && mediaUrls.length > 0 && (
            <div className="text-[10px] text-zinc-500 font-medium px-2.5 py-0.5 bg-zinc-800/50 border border-zinc-700/50 rounded-full">
              {badgeLabel}
            </div>
          )}
          <button 
            onClick={handleRefresh}
            disabled={mode === 'empty' || isRefreshing}
            className={`p-1.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all ${isRefreshing ? 'opacity-50' : ''}`}
            title="刷新数据 (验证链接是否过期)"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 min-h-0 relative overflow-hidden flex flex-col rounded-b-2xl ${
        mode === 'empty' ? 'bg-zinc-900/40 p-4' : 'bg-transparent'
      }`}>
        {mode === 'empty' ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-4">
            <ScanEye size={32} strokeWidth={1.5} className="opacity-20" />
            <p className="text-[13px] font-medium text-zinc-500">等待输出结果...</p>
          </div>
        ) : mode === 'text' ? (
          /* Text Display Mode with Protective Border */
          <div className="p-4 flex-1 flex flex-col min-h-0">
            <div className="flex-1 bg-zinc-800/20 rounded-xl border border-zinc-800 focus-within:border-zinc-700/50 transition-all overflow-hidden" 
                 onPointerDown={stopPropagation}>
              <textarea
                value={displayText}
                readOnly
                onWheel={(e) => {
                  if (e.currentTarget.scrollHeight > e.currentTarget.clientHeight) {
                    e.stopPropagation();
                  }
                }}
                className="w-full h-full bg-transparent p-4 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none resize-none custom-scrollbar"
                placeholder="正在接收内容..."
              />
            </div>
          </div>
        ) : (
          /* Media Gallery Mode (No TextArea Border) */
          <div className="h-full w-full overflow-y-auto custom-scrollbar">
            <div className={`grid h-full ${mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {mediaUrls.map((url, idx) => {
                const isVid = isVideoUrl(url);
                return (
                  <div
                    key={idx}
                    className="group relative w-full h-full bg-black/20 overflow-hidden"
                    onDoubleClick={() => setFullscreenItem({ url, isVideo: isVid })}
                  >
                    {isVid ? (
                      <video src={url} controls loop playsInline className="w-full h-full object-contain" onClick={stopPropagation} />
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-contain hover:brightness-110 transition-all pointer-events-none" />
                    )}

                    {!isVid && (
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end justify-end p-4 gap-3 pointer-events-none">
                        <button onClick={() => setFullscreenItem({ url, isVideo: isVid })} className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md shadow-xl pointer-events-auto" onPointerDown={stopPropagation}>
                          <Maximize size={16} />
                        </button>
                        <button onClick={() => handleDownload(url, isVid)} className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md shadow-xl pointer-events-auto" onPointerDown={stopPropagation}>
                          <Download size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Input Port */}
      <div 
        data-id={node.id} 
        data-port-input="true" 
        className="absolute top-1/2 -left-3.5 w-7 h-7 -translate-y-1/2 flex items-center justify-center pointer-events-auto cursor-crosshair transition-all duration-200 z-50 opacity-0 scale-90 group-hover/node:opacity-100 group-hover/node:scale-100"
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

      {/* Fullscreen Modal */}
      {fullscreenItem && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-300 pointer-events-auto"
          onClick={() => setFullscreenItem(null)}
        >
          <button className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white z-10" onClick={() => setFullscreenItem(null)}>
            <X size={32} />
          </button>
          <button className="absolute top-6 right-20 p-2 text-zinc-500 hover:text-white z-10" onClick={(e) => { e.stopPropagation(); handleDownload(fullscreenItem.url, fullscreenItem.isVideo); }}>
            <Download size={24} />
          </button>
          {fullscreenItem.isVideo ? (
            <video src={fullscreenItem.url} controls autoPlay loop playsInline className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={stopPropagation} onPointerDown={stopPropagation} />
          ) : (
            <img src={fullscreenItem.url} alt="" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={stopPropagation} />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
