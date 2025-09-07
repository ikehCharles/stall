import { useState, useRef, useCallback, useEffect } from 'react';
import { useCreateStallInstance, useUpdateStallInstance, useDeleteStallInstance } from '@/hooks/useStallInstances';
import { toast } from '@/hooks/use-toast';

interface StallInstance {
  id: string;
  market_id: string;
  template_id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  price_override: number | null;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
  stall_templates?: {
    name: string;
    shape: 'RECT' | 'CIRCLE' | 'POLY';
    fill_color: string;
    stroke_color: string;
    price: number;
    capacity: number;
  };
}

interface CanvasEditorProps {
  layout: any;
  stalls: StallInstance[];
  showGrid: boolean;
  selectedStallId: string | null;
  onStallSelect: (stallId: string | null) => void;
  onSaveLayout: (layout: any) => void;
}

export const CanvasEditor = ({
  layout,
  stalls,
  showGrid,
  selectedStallId,
  onStallSelect,
  onSaveLayout,
}: CanvasEditorProps) => {
  const [draggedStall, setDraggedStall] = useState<StallInstance | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [stallCounter, setStallCounter] = useState(1);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const createStall = useCreateStallInstance();
  const updateStall = useUpdateStallInstance();
  const deleteStall = useDeleteStallInstance();

  // Canvas dimensions with defaults
  const canvasWidth = layout?.canvas_width || 800;
  const canvasHeight = layout?.canvas_height || 600;
  const gridSize = layout?.grid_size || 20;

  // Snap to grid function
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize]);

  // Handle stall drag start
  const handleStallMouseDown = useCallback((e: React.MouseEvent, stall: StallInstance) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setDraggedStall(stall);
    setDragOffset({
      x: mouseX - stall.x,
      y: mouseY - stall.y,
    });
    onStallSelect(stall.id);
  }, [onStallSelect]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedStall || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = snapToGrid(mouseX - dragOffset.x);
    const newY = snapToGrid(mouseY - dragOffset.y);

    // Update stall position
    updateStall.mutate({
      id: draggedStall.id,
      market_id: draggedStall.market_id,
      x: newX,
      y: newY,
    });
  }, [draggedStall, dragOffset, snapToGrid, updateStall]);

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    setDraggedStall(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // Handle canvas drop from template
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const templateData = JSON.parse(e.dataTransfer.getData('application/json'));
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dropX = snapToGrid(e.clientX - rect.left);
    const dropY = snapToGrid(e.clientY - rect.top);

    // Auto-generate label
    const label = `ST-${stallCounter.toString().padStart(3, '0')}`;
    setStallCounter(prev => prev + 1);

    createStall.mutate({
      market_id: layout?.market_id,
      template_id: templateData.id,
      label,
      x: dropX,
      y: dropY,
      width: templateData.width,
      height: templateData.height,
      rotation: 0,
      price_override: null,
      status: 'AVAILABLE',
    });
  }, [layout?.market_id, snapToGrid, stallCounter, createStall]);

  // Handle key events for stall manipulation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard events if user is typing in an input field
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement || 
          e.target instanceof HTMLSelectElement ||
          (e.target instanceof HTMLElement && e.target.contentEditable === 'true')) {
        return;
      }
      
      if (!selectedStallId) return;
      
      const selectedStall = stalls.find(s => s.id === selectedStallId);
      if (!selectedStall) return;

      const moveDistance = e.shiftKey ? gridSize * 5 : gridSize;
      let newX = selectedStall.x;
      let newY = selectedStall.y;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newX = Math.max(0, selectedStall.x - moveDistance);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newX = Math.min(canvasWidth - selectedStall.width, selectedStall.x + moveDistance);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newY = Math.max(0, selectedStall.y - moveDistance);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newY = Math.min(canvasHeight - selectedStall.height, selectedStall.y + moveDistance);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteStall.mutate({ id: selectedStallId, market_id: selectedStall.market_id });
          onStallSelect(null);
          return;
      }

      if (newX !== selectedStall.x || newY !== selectedStall.y) {
        updateStall.mutate({
          id: selectedStallId,
          market_id: selectedStall.market_id,
          x: newX,
          y: newY,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedStallId, stalls, gridSize, canvasWidth, canvasHeight, handleMouseMove, handleMouseUp, updateStall, deleteStall, onStallSelect]);

  // Render grid
  const renderGrid = () => {
    if (!showGrid) return null;

    const lines = [];
    
    // Vertical lines
    for (let x = 0; x <= canvasWidth; x += gridSize) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={canvasHeight}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          opacity={0.3}
        />
      );
    }
    
    // Horizontal lines
    for (let y = 0; y <= canvasHeight; y += gridSize) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={canvasWidth}
          y2={y}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          opacity={0.3}
        />
      );
    }
    
    return lines;
  };

  // Render stall instance
  const renderStall = (stall: StallInstance) => {
    const template = stall.stall_templates;
    const isSelected = stall.id === selectedStallId;
    const price = stall.price_override ?? template?.price ?? 0;
    
    return (
      <g key={stall.id} className="stall-instance cursor-move">
        {/* Stall shape */}
        {template?.shape === 'CIRCLE' ? (
          <circle
            cx={stall.x + stall.width / 2}
            cy={stall.y + stall.height / 2}
            r={stall.width / 2}
            fill={template.fill_color}
            stroke={isSelected ? 'hsl(var(--ring))' : template.stroke_color}
            strokeWidth={isSelected ? 3 : 2}
            onMouseDown={(e) => handleStallMouseDown(e, stall)}
            className="hover:opacity-80"
          />
        ) : (
          <rect
            x={stall.x}
            y={stall.y}
            width={stall.width}
            height={stall.height}
            fill={template?.fill_color || '#3b82f6'}
            stroke={isSelected ? 'hsl(var(--ring))' : (template?.stroke_color || '#1e40af')}
            strokeWidth={isSelected ? 3 : 2}
            rx={4}
            onMouseDown={(e) => handleStallMouseDown(e, stall)}
            className="hover:opacity-80"
          />
        )}
        
        {/* Stall label */}
        <text
          x={stall.x + stall.width / 2}
          y={stall.y + stall.height / 2 - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="12"
          fontWeight="bold"
          pointerEvents="none"
        >
          {stall.label}
        </text>
        
        {/* Price display */}
        <text
          x={stall.x + stall.width / 2}
          y={stall.y + stall.height / 2 + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="10"
          pointerEvents="none"
        >
          ${price}
        </text>

        {/* Selection handles */}
        {isSelected && (
          <>
            <rect
              x={stall.x - 4}
              y={stall.y - 4}
              width={8}
              height={8}
              fill="hsl(var(--ring))"
              className="cursor-nw-resize"
            />
            <rect
              x={stall.x + stall.width - 4}
              y={stall.y + stall.height - 4}
              width={8}
              height={8}
              fill="hsl(var(--ring))"
              className="cursor-se-resize"
            />
          </>
        )}
      </g>
    );
  };

  return (
    <div 
      className="w-full h-full flex items-center justify-center p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
        <svg
          ref={svgRef}
          width={canvasWidth}
          height={canvasHeight}
          className="bg-background cursor-crosshair"
          onClick={(e) => {
            // Click on empty canvas deselects stalls
            if (e.target === e.currentTarget) {
              onStallSelect(null);
            }
          }}
        >
          {/* Grid */}
          {renderGrid()}
          
          {/* Stalls */}
          {stalls.map(renderStall)}
        </svg>
      </div>
    </div>
  );
};