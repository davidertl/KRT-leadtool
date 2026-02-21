import React, { useRef, useCallback, useEffect } from 'react';
import { usePopupStore } from '../stores/popupStore';

const MIN_W = 260;
const MIN_H = 180;

/**
 * Floating, draggable, resizable popup window.
 * Wraps any panel content. Managed by popupStore.
 *
 * Props:
 *  - id: popup store key
 *  - children: panel content
 *  - className: extra classes for the content area
 */
export default function PopupWindow({ id, children, className = '' }) {
  const popup = usePopupStore((s) => s.popups[id]);
  const { movePopup, resizePopup, focusPopup, closePopup, toggleMinimize } = usePopupStore();
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const frameRef = useRef(null);

  // Drag handler
  const onDragStart = useCallback(
    (e) => {
      // Ignore if target is a button/input inside the title bar
      if (e.target.closest('button') || e.target.closest('input')) return;
      e.preventDefault();
      focusPopup(id);
      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = popup.position.x;
      const startPosY = popup.position.y;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        movePopup(id, Math.max(0, startPosX + dx), Math.max(0, startPosY + dy));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [id, popup?.position, focusPopup, movePopup]
  );

  // Resize handler (bottom-right corner)
  const onResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusPopup(id);
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = popup.size.w;
      const startH = popup.size.h;

      const onMove = (ev) => {
        const dw = ev.clientX - startX;
        const dh = ev.clientY - startY;
        resizePopup(id, Math.max(MIN_W, startW + dw), Math.max(MIN_H, startH + dh));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [id, popup?.size, focusPopup, resizePopup]
  );

  if (!popup || !popup.open) return null;

  const { position, size, zIndex, minimized, label, icon } = popup;

  return (
    <div
      ref={frameRef}
      className="fixed shadow-2xl rounded-lg border border-krt-border bg-krt-panel/95 backdrop-blur-sm flex flex-col overflow-hidden select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.w,
        height: minimized ? 36 : size.h,
        zIndex,
        transition: 'height 0.15s ease',
      }}
      onMouseDown={() => focusPopup(id)}
    >
      {/* Title bar */}
      <div
        ref={dragRef}
        onMouseDown={onDragStart}
        className="flex items-center gap-2 px-3 py-1.5 bg-krt-bg/80 border-b border-krt-border cursor-move shrink-0"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-bold text-gray-300 flex-1 truncate">{label}</span>
        <button
          onClick={() => toggleMinimize(id)}
          className="text-gray-500 hover:text-gray-300 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-krt-border/40"
          title={minimized ? 'Restore' : 'Minimize'}
        >
          {minimized ? '□' : '─'}
        </button>
        <button
          onClick={() => closePopup(id)}
          className="text-gray-500 hover:text-red-400 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      {!minimized && (
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-3 ${className}`}>
          {children}
        </div>
      )}

      {/* Resize handle (bottom-right) */}
      {!minimized && (
        <div
          ref={resizeRef}
          onMouseDown={onResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          title="Resize"
        >
          <svg viewBox="0 0 16 16" className="w-full h-full text-gray-600">
            <path d="M14 14L8 14L14 8Z" fill="currentColor" opacity="0.4" />
            <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.6" />
          </svg>
        </div>
      )}
    </div>
  );
}
