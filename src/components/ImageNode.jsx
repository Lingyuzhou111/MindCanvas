import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, X, Minimize2, ImageUp } from 'lucide-react';

export default function ImageNode({ node, updateNode, onDragStart, isDragging, isResizing, isSelected, isConnected }) {
    const [image, setImage] = useState(node.data?.image || null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [compress, setCompress] = useState(node.data?.compress || false);
    const [resolution, setResolution] = useState(node.data?.resolution || null);
    const fileInputRef = useRef(null);

    // Auto-detect resolution when image changes
    useEffect(() => {
        if (!image) {
            setResolution(null);
            return;
        }

        if (image.startsWith('data:video/') || image.toLowerCase().endsWith('.mp4') || image.toLowerCase().endsWith('.webm')) {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                const res = `${video.videoWidth}x${video.videoHeight}`;
                setResolution(res);
                updateNode(node.id, { resolution: res });
            };
            video.src = image;
        } else {
            const img = new Image();
            img.onload = () => {
                const res = `${img.width}x${img.height}`;
                setResolution(res);
                updateNode(node.id, { resolution: res });
            };
            img.src = image;
        }
    }, [image, node.id, updateNode]);

    // 压缩图片至1K像素以内（最大边不超过1024）
    const compressImage = (dataUrl, maxSize = 1024) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                const max = Math.max(width, height);
                if (max <= maxSize) {
                    // 不需要压缩
                    resolve(dataUrl);
                    return;
                }
                // 计算压缩后的尺寸
                const ratio = maxSize / max;
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
                // 创建canvas进行压缩
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // 转换为DataURL
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(compressedDataUrl);
            };
            img.src = dataUrl;
        });
    };

    const handleImageLoad = async (file) => {
        if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            let dataUrl = e.target.result;
            // 如果是图片且开启了压缩，则进行压缩处理
            if (file.type.startsWith('image/') && compress) {
                dataUrl = await compressImage(dataUrl);
            }
            
            try {
                // 上传图片到服务器
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataUrl, filename: file.name })
                });
                const result = await response.json();
                
                if (result.success) {
                    const serverPath = result.path;
                    setImage(serverPath);
                    
                    // Detect resolution
                    const img = new Image();
                    img.onload = () => {
                        const resolution = `${img.width}x${img.height}`;
                        updateNode(node.id, { image: serverPath, resolution });
                    };
                    img.src = dataUrl; // 使用本地 dataUrl 测量尺寸，避免跨域或延迟
                } else {
                    throw new Error(result.error || '上传失败');
                }
            } catch (error) {
                console.error('Image Upload Failed:', error);
                // 降级使用本地 DataURL，但此时可能无法持久化（如过大）
                setImage(dataUrl);
                updateNode(node.id, { image: dataUrl });
            }
        };
        reader.readAsDataURL(file);
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const onDragLeave = () => {
        setIsDragOver(false);
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageLoad(e.dataTransfer.files[0]);
        }
    };

    useEffect(() => {
        const handlePaste = (e) => {
            if (!isSelected) return;
            if (e.clipboardData.files && e.clipboardData.files.length > 0) {
                handleImageLoad(e.clipboardData.files[0]);
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isSelected]);

    const stopPropagation = (e) => e.stopPropagation();

    return (
        <div
            id={`node-container-${node.id}`}
            onPointerDown={onDragStart}
            className={`absolute flex flex-col bg-zinc-900/95 backdrop-blur-md border border-zinc-800/60 ${
                isSelected ? 'node-selected-ring' : ''
            } rounded-2xl shadow-2xl select-none touch-none group/node`}
            style={{
                transform: `translate(${node.x}px, ${node.y}px)`,
                width: `${Math.max(300, node.w || 300)}px`,
                height: `${Math.max(300, node.h || 300)}px`,
                transition: isDragging ? 'none' : undefined,
                zIndex: isDragging ? 50 : 10,
            }}
        >
            {/* Connected State Glow Effect */}
            {isConnected && (
                <div className="absolute top-0 bottom-0 right-0 w-[1.5px] bg-gradient-to-b from-transparent via-zinc-400 to-transparent shadow-[0_0_12px_rgba(161,161,170,0.4)] z-50 pointer-events-none" />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 h-[42px] border-b border-zinc-800/60 shrink-0">
                <div className="flex items-center gap-2.5 text-zinc-300">
                    <ImageUp size={15} className="text-zinc-400" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tracking-tight text-zinc-200">图片上传</span>
                        {resolution && (
                            <span className="text-[11px] text-zinc-500 font-normal opacity-80">{resolution}</span>
                        )}
                    </div>
                </div>
                {/* 压缩开关 - 保留功能但改为更简洁的样式 */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const newCompress = !compress;
                        setCompress(newCompress);
                        updateNode(node.id, { compress: newCompress });
                    }}
                    onPointerDown={stopPropagation}
                    className={`p-1.5 rounded-lg transition-all ${
                        compress 
                            ? 'text-sky-400 bg-sky-500/10' 
                            : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title={compress ? '已开启压缩：最大1024px' : '原图上传'}
                >
                    <Minimize2 size={13} />
                </button>
            </div>

            {/* Content */}
            <div
                className={`flex-1 flex flex-col min-h-0 transition-colors ${!image ? 'p-4 bg-zinc-900/40' : 'bg-transparent'} ${isDragOver ? 'bg-zinc-800/50' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <div 
                    className={`flex-1 transition-all flex flex-col items-center justify-center overflow-hidden relative group/img ${
                        !image ? 'rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 cursor-pointer' : 'bg-transparent'
                    }`}
                    onClick={() => !image && fileInputRef.current?.click()}
                >
                    {image ? (
                        <>
                            {(image.startsWith('data:video/') || image.toLowerCase().endsWith('.mp4') || image.toLowerCase().endsWith('.webm')) ? (
                                <video
                                    src={image}
                                    className="w-full h-full object-contain pointer-events-none"
                                    autoPlay loop muted playsInline
                                />
                            ) : (
                                <img
                                    src={image}
                                    alt="Uploaded"
                                    className="w-full h-full object-contain pointer-events-none"
                                />
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setImage(null);
                                    updateNode(node.id, { image: null });
                                }}
                                className="absolute top-2 right-2 w-7 h-7 bg-zinc-950/80 hover:bg-red-500/80 text-white rounded-lg flex items-center justify-center backdrop-blur-md transition-all opacity-0 group-hover/img:opacity-100 border border-zinc-800"
                            >
                                <X size={14} />
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4">
                            <ImageIcon size={32} className="text-zinc-600 mb-5" />
                            <div className="text-[13px] text-zinc-500 font-medium tracking-wide">
                                点击上传图片
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,video/*"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        handleImageLoad(e.target.files[0]);
                                    }
                                    e.target.value = null; // reset
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Output Port */}
            <div
                data-port-output="true"
                data-id={node.id}
                data-port-visual={node.id}
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
