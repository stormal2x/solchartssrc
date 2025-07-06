import React, { useRef, useState } from 'react';

// A simple draggable wrapper for the trading panel
// DraggablePanel: Only draggable from a handle (default: .drag-handle)
export default function DraggablePanel({
  children,
  bounds = { left: 0, top: 0, right: 0, bottom: 0 },
  defaultPosition = { x: 0, y: 0 },
  handleSelector = '.drag-handle'
}) {
  const panelRef = useRef();
  const [pos, setPos] = useState(defaultPosition);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    if (e.button !== 0) return; // Only left mouse button
    // Prevent drag if starting on a button, input, select, textarea, option, or label
    const tag = e.target.tagName.toLowerCase();
    if ([
      'button', 'input', 'select', 'textarea', 'option', 'label'
    ].includes(tag)) return;
    setDragging(true);
    setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    document.body.style.userSelect = 'none';
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    let x = e.clientX - offset.x;
    let y = e.clientY - offset.y;
    // Clamp to bounds using panel size
    const rect = panelRef.current ? panelRef.current.getBoundingClientRect() : { width: 340, height: 240 };
    x = Math.max(bounds.left, Math.min(x, window.innerWidth - bounds.right - rect.width));
    y = Math.max(bounds.top, Math.min(y, window.innerHeight - bounds.bottom - rect.height));
    setPos({ x, y });
  };
  const onMouseUp = () => {
    setDragging(false);
    document.body.style.userSelect = '';
  };

  // Attach drag handle listener
  React.useEffect(() => {
    const handle = panelRef.current && panelRef.current.querySelector(handleSelector);
    if (handle) {
      handle.addEventListener('mousedown', onMouseDown);
    }
    return () => {
      if (handle) handle.removeEventListener('mousedown', onMouseDown);
    };
    // eslint-disable-next-line
  }, [handleSelector, pos]);

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // eslint-disable-next-line
  }, [dragging, offset]);


  return (
    <div
      ref={panelRef}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: 30,
        userSelect: 'none',
        transition: dragging ? 'none' : 'left 0.18s cubic-bezier(0.4,0,0.2,1), top 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {children}
    </div>
  );
}
