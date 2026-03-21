import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateStallInstance, useUpdateStallInstance, useDeleteStallInstance } from '@/hooks/useStallInstances';
import { toast } from '@/hooks/use-toast';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

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

interface TemplateDropData {
  id: string;
  width?: number;
  height?: number;
  radius?: number;
}

interface CanvasEditorProps {
  layout: unknown;
  stalls: StallInstance[];
  showGrid: boolean;
  selectedStallId: string | null;
  onStallSelect: (stallId: string | null) => void;
  onSaveLayout: (layout: unknown) => void;
  touchDragPoint?: { clientX: number; clientY: number } | null;
  pendingTemplateDrop?: { template: TemplateDropData; clientX: number; clientY: number } | null;
  onPendingTemplateDropHandled?: () => void;
}

export const CanvasEditor = ({
  layout,
  stalls,
  showGrid,
  selectedStallId,
  onStallSelect,
  onSaveLayout,
  touchDragPoint,
  pendingTemplateDrop,
  onPendingTemplateDropHandled,
}: CanvasEditorProps) => {
  const [draggedStall, setDraggedStall] = useState<StallInstance | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [stallCounter, setStallCounter] = useState(1);
  const [zoom, setZoom] = useState(1);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
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

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);

  const getCanvasCoordinatesFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return null;

    const containerRect = scrollEl.getBoundingClientRect();
    const isInsideVisibleCanvas =
      clientX >= containerRect.left &&
      clientX <= containerRect.right &&
      clientY >= containerRect.top &&
      clientY <= containerRect.bottom;

    if (!isInsideVisibleCanvas) return null;

    const rawX = (clientX - containerRect.left + scrollEl.scrollLeft) / zoom;
    const rawY = (clientY - containerRect.top + scrollEl.scrollTop) / zoom;

    let x = snapToGrid(rawX);
    let y = snapToGrid(rawY);
    x = Math.max(0, Math.min(canvasWidth - 1, x));
    y = Math.max(0, Math.min(canvasHeight - 1, y));

    return { x, y };
  }, [zoom, snapToGrid, canvasWidth, canvasHeight]);

  const touchDropPreview = touchDragPoint
    ? getCanvasCoordinatesFromClientPoint(touchDragPoint.clientX, touchDragPoint.clientY)
    : null;

  // Handle stall drag start (pointer events for mouse + touch)
  const handleStallPointerDown = useCallback((e: React.PointerEvent, stall: StallInstance) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Capture pointer to receive events even outside the element
    (e.target as Element).setPointerCapture(e.pointerId);
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointerX = (e.clientX - rect.left) / zoom;
    const pointerY = (e.clientY - rect.top) / zoom;
    
    setDraggedStall(stall);
    setDragPosition({ x: stall.x, y: stall.y });
    setDragOffset({
      x: pointerX - stall.x,
      y: pointerY - stall.y,
    });
    onStallSelect(stall.id);
  }, [onStallSelect, zoom]);

  // Handle pointer move during drag (update local position only; persist on pointer up)
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!draggedStall || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const pointerX = (e.clientX - rect.left) / zoom;
    const pointerY = (e.clientY - rect.top) / zoom;

    let newX = snapToGrid(pointerX - dragOffset.x);
    let newY = snapToGrid(pointerY - dragOffset.y);
    newX = Math.max(0, Math.min(canvasWidth - draggedStall.width, newX));
    newY = Math.max(0, Math.min(canvasHeight - draggedStall.height, newY));

    setDragPosition({ x: newX, y: newY });

    // Auto-scroll when dragging near container edges
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      const scrollRect = scrollEl.getBoundingClientRect();
      const edgeThreshold = 40;
      const scrollSpeed = 12;
      let scrollX = 0;
      let scrollY = 0;
      if (e.clientX < scrollRect.left + edgeThreshold) scrollX = -scrollSpeed;
      else if (e.clientX > scrollRect.right - edgeThreshold) scrollX = scrollSpeed;
      if (e.clientY < scrollRect.top + edgeThreshold) scrollY = -scrollSpeed;
      else if (e.clientY > scrollRect.bottom - edgeThreshold) scrollY = scrollSpeed;
      if (scrollX !== 0 || scrollY !== 0) {
        scrollEl.scrollLeft += scrollX;
        scrollEl.scrollTop += scrollY;
      }
    }
  }, [draggedStall, dragOffset, snapToGrid, zoom, canvasWidth, canvasHeight]);

  // Handle pointer up to end drag: persist position, optimistically update cache, then clear so no flicker
  const handlePointerUp = useCallback(() => {
    if (draggedStall && dragPosition) {
      const payload = {
        id: draggedStall.id,
        market_id: draggedStall.market_id,
        x: dragPosition.x,
        y: dragPosition.y,
      };
      updateStall.mutate(payload, {
        onSuccess: (updatedStall) => {
          queryClient.setQueryData(
            ['stall-instances', draggedStall.market_id],
            (old: StallInstance[] | undefined) =>
              old?.map((s) => (s.id === draggedStall.id ? { ...s, ...updatedStall } : s)) ?? old
          );
          setDraggedStall(null);
          setDragOffset({ x: 0, y: 0 });
          setDragPosition(null);
        },
        onError: () => {
          setDraggedStall(null);
          setDragOffset({ x: 0, y: 0 });
          setDragPosition(null);
        },
      });
    } else {
      setDraggedStall(null);
      setDragOffset({ x: 0, y: 0 });
      setDragPosition(null);
    }
  }, [draggedStall, dragPosition, updateStall, queryClient]);

  // Handle canvas drop from template
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const templateData = JSON.parse(e.dataTransfer.getData('application/json'));

    const coords = getCanvasCoordinatesFromClientPoint(e.clientX, e.clientY);
    if (!coords) return;

    const templateWidth = templateData.width ?? (templateData.radius ? templateData.radius * 2 : 80);
    const templateHeight = templateData.height ?? (templateData.radius ? templateData.radius * 2 : 80);

    let dropX = coords.x;
    let dropY = coords.y;
    dropX = Math.max(0, Math.min(canvasWidth - templateWidth, dropX));
    dropY = Math.max(0, Math.min(canvasHeight - templateHeight, dropY));

    // Auto-generate label
    const label = `ST-${stallCounter.toString().padStart(3, '0')}`;
    setStallCounter(prev => prev + 1);



    createStall.mutate({
      market_id: layout?.market_id,
      template_id: templateData.id,
      label,
      x: dropX,
      y: dropY,
      width: templateWidth,
      height: templateHeight,
      rotation: 0,
      price_override: null,
      status: 'AVAILABLE',
    });
  }, [layout?.market_id, stallCounter, createStall, canvasWidth, canvasHeight, getCanvasCoordinatesFromClientPoint]);

  // Handle pending template drop from touch drag (palette → canvas)
  useEffect(() => {
    if (!pendingTemplateDrop) return;

    const { template: templateData, clientX, clientY } = pendingTemplateDrop;
    const coords = getCanvasCoordinatesFromClientPoint(clientX, clientY);

    if (coords) {
      const templateWidth = templateData.width ?? (templateData.radius ? templateData.radius * 2 : 80);
      const templateHeight = templateData.height ?? (templateData.radius ? templateData.radius * 2 : 80);

      let dropX = coords.x;
      let dropY = coords.y;
      dropX = Math.max(0, Math.min(canvasWidth - templateWidth, dropX));
      dropY = Math.max(0, Math.min(canvasHeight - templateHeight, dropY));

      const label = `ST-${stallCounter.toString().padStart(3, '0')}`;
      setStallCounter(prev => prev + 1);

      createStall.mutate({
        market_id: layout?.market_id,
        template_id: templateData.id,
        label,
        x: dropX,
        y: dropY,
        width: templateWidth,
        height: templateHeight,
        rotation: 0,
        price_override: null,
        status: 'AVAILABLE',
      });
    }

    onPendingTemplateDropHandled?.();
  }, [pendingTemplateDrop, getCanvasCoordinatesFromClientPoint, canvasWidth, canvasHeight, stallCounter, createStall, layout?.market_id, onPendingTemplateDropHandled]);

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
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [selectedStallId, stalls, gridSize, canvasWidth, canvasHeight, handlePointerMove, handlePointerUp, updateStall, deleteStall, onStallSelect]);

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

  // Render stall instance (use local drag position while dragging)
  const renderStall = (stall: StallInstance) => {
    const template = stall.stall_templates;
    const isSelected = stall.id === selectedStallId;
    const price = stall.price_override ?? template?.price ?? 0;
    const isDragging = draggedStall?.id === stall.id && dragPosition !== null;
    const x = isDragging ? dragPosition!.x : stall.x;
    const y = isDragging ? dragPosition!.y : stall.y;

    return (
      <g key={stall.id} className="stall-instance cursor-move" style={{ touchAction: 'none' }}>
        {/* Stall shape */}
        {template?.shape === 'CIRCLE' ? (
          <circle
            cx={x + stall.width / 2}
            cy={y + stall.height / 2}
            r={stall.width / 2}
            fill={template.fill_color}
            stroke={isSelected ? 'hsl(var(--ring))' : template.stroke_color}
            strokeWidth={isSelected ? 3 : 2}
            onPointerDown={(e) => handleStallPointerDown(e, stall)}
            style={{ touchAction: 'none' }}
            className="hover:opacity-80"
          />
        ) : (
          <rect
            x={x}
            y={y}
            width={stall.width}
            height={stall.height}
            fill={template?.fill_color || '#3b82f6'}
            stroke={isSelected ? 'hsl(var(--ring))' : (template?.stroke_color || '#1e40af')}
            strokeWidth={isSelected ? 3 : 2}
            rx={4}
            onPointerDown={(e) => handleStallPointerDown(e, stall)}
            style={{ touchAction: 'none' }}
            className="hover:opacity-80"
          />
        )}
        
        {/* Stall label */}
        <text
          x={x + stall.width / 2}
          y={y + stall.height / 2 - 6}
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
          x={x + stall.width / 2}
          y={y + stall.height / 2 + 8}
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
              x={x - 4}
              y={y - 4}
              width={8}
              height={8}
              fill="hsl(var(--ring))"
              className="cursor-nw-resize"
            />
            <rect
              x={x + stall.width - 4}
              y={y + stall.height - 4}
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

  // Ctrl/Cmd + wheel for zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => {
          const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
          return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta));
        });
      }
    };
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('wheel', handleWheel, { passive: false });
      return () => scrollEl.removeEventListener('wheel', handleWheel);
    }
  }, []);

  return (
    <div 
      className="flex-1 h-full flex flex-col items-center justify-center p-2 md:p-4 min-w-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div
          ref={scrollContainerRef}
          className="w-full h-full md:w-[70vw] md:h-[70vh] lg:w-[50vw] bg-background border border-border rounded-lg shadow-lg overflow-auto"
        >
          <div
            style={{
              width: canvasWidth * zoom,
              height: canvasHeight * zoom,
              minWidth: canvasWidth * zoom,
              minHeight: canvasHeight * zoom,
            }}
          >
            <svg
              ref={svgRef}
              width={canvasWidth}
              height={canvasHeight}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
                touchAction: 'none',
              }}
              className="bg-background cursor-crosshair"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  onStallSelect(null);
                }
              }}
            >
              {renderGrid()}
              {touchDropPreview && (
                <g pointerEvents="none">
                  <circle
                    cx={touchDropPreview.x}
                    cy={touchDropPreview.y}
                    r={12}
                    fill="hsl(var(--primary) / 0.25)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </g>
              )}
              {stalls.map(renderStall)}
            </svg>
          </div>
        </div>
        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-background/95 border border-border rounded-md shadow-sm p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};