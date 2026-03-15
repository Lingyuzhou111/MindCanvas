import React, { useState } from 'react';
import { SquarePen } from 'lucide-react';

export default function TextNode({ node, updateNode, onDragStart, isDragging, isResizing, isSelected, isInputConnected, isOutputConnected }) {
  const [text, setText] = useState(node.data?.text || '');

  const handleChange = (e) => {
    setText(e.target.value);
    updateNode(node.id, { text: e.target.value });
  };

  const stopPropagation = (e) => e.stopPropagation();

  return (
    <div
      id={`node-container-${node.id}`}
      className={`absolute flex flex-col bg-zinc-900/95 backdrop-blur-md border border-zinc-800/60 ${
        isSelected ? 'node-selected-ring' : ''
      } rounded-2xl shadow-2xl select-none touch-none group/node`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${Math.max(300, node.w || 300)}px`,
        height: `${Math.max(150, node.h || 150)}px`,
        transition: isDragging ? 'none' : undefined,
        zIndex: isDragging ? 50 : 10,
      }}
    >
      {/* Output Connected State Glow Effect */}
      {isOutputConnected && (
        <div className="absolute top-0 bottom-0 right-0 w-[1.5px] bg-gradient-to-b from-transparent via-zinc-400 to-transparent shadow-[0_0_12px_rgba(161,161,170,0.4)] z-50 pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex items-center px-4 h-[42px] border-b border-zinc-800/60 cursor-grab active:cursor-grabbing shrink-0" onPointerDown={onDragStart}>
        <div className="flex items-center gap-2.5 text-zinc-300">
          <SquarePen size={16} className="text-zinc-400" />
          <span className="text-sm font-medium tracking-tight text-zinc-200">文本输入</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col min-h-0" onPointerDown={stopPropagation}>
        <div className="flex-1 bg-zinc-800/30 rounded-xl border border-zinc-800/50 focus-within:border-zinc-500/30 transition-all flex flex-col overflow-hidden">
          <textarea
            value={text}
            onChange={handleChange}
            onWheel={(e) => {
              if (e.currentTarget.scrollHeight > e.currentTarget.clientHeight) {
                e.stopPropagation();
              }
            }}
            onPointerMove={e => e.stopPropagation()}
            onContextMenu={e => {
              const target = e.target;
              if (target.selectionStart !== target.selectionEnd) {
                e.stopPropagation();
              }
            }}
            placeholder="在此输入文本内容作为其他节点的提示词输入..."
            className="flex-1 w-full bg-transparent p-4 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none resize-none custom-scrollbar"
          />
        </div>
      </div>


      {/* Output Port (Right) */}
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
