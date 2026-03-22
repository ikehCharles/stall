import { useState, useRef, useCallback, useEffect } from 'react';
import { Square, Circle, Hexagon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CurrencyWrapper from '../shared/currency';
import type { StallTemplate } from '@/hooks/useStallTemplates';

interface StallTemplatesPaletteProps {
  templates: StallTemplate[];
  onTemplateTouchDrop?: (template: StallTemplate, clientX: number, clientY: number) => void;
  onTemplateTouchMove?: (clientX: number, clientY: number) => void;
  onTemplateTouchEnd?: () => void;
  onTemplateSelect?: (template: StallTemplate) => void;
  selectedTemplateId?: string | null;
  enableTapToPlace?: boolean;
  /** Compact horizontal scrollable strip for mobile/tablet */
  compact?: boolean;
}

export const StallTemplatesPalette = ({
  templates,
  onTemplateTouchDrop,
  onTemplateTouchMove,
  onTemplateTouchEnd,
  onTemplateSelect,
  selectedTemplateId,
  enableTapToPlace = false,
  compact = false,
}: StallTemplatesPaletteProps) => {
  const touchTemplateRef = useRef<StallTemplate | null>(null);
  const [touchDragPos, setTouchDragPos] = useState<{ x: number; y: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, template: StallTemplate) => {
    e.dataTransfer.setData('application/json', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Touch drag start: store template and initial position
  const handleTemplateTouchStart = useCallback((e: React.TouchEvent, template: StallTemplate) => {
    e.preventDefault();
    e.stopPropagation();

    if (enableTapToPlace) {
      onTemplateSelect?.(template);
      return;
    }

    const touch = e.touches[0];
    touchTemplateRef.current = template;
    setTouchDragPos({ x: touch.clientX, y: touch.clientY });
    onTemplateTouchMove?.(touch.clientX, touch.clientY);
  }, [enableTapToPlace, onTemplateSelect, onTemplateTouchMove]);

  // Attach window-level touch listeners while a touch drag is in progress
  useEffect(() => {
    if (!touchDragPos) return;

    const handleMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      setTouchDragPos({ x: touch.clientX, y: touch.clientY });
      onTemplateTouchMove?.(touch.clientX, touch.clientY);
    };

    const handleEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (touchTemplateRef.current && onTemplateTouchDrop) {
        onTemplateTouchDrop(touchTemplateRef.current, touch.clientX, touch.clientY);
      }
      touchTemplateRef.current = null;
      setTouchDragPos(null);
      onTemplateTouchEnd?.();
    };

    const handleCancel = () => {
      touchTemplateRef.current = null;
      setTouchDragPos(null);
      onTemplateTouchEnd?.();
    };

    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleCancel);

    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleCancel);
    };
    // Only re-attach when drag starts/ends (not on every position update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!touchDragPos, onTemplateTouchDrop, onTemplateTouchMove, onTemplateTouchEnd]);

  // Read ref during render for floating proxy visual
  const dragTemplate = touchTemplateRef.current;

  const getShapeIcon = (shape: string) => {
    switch (shape) {
      case 'RECT': return <Square className="h-4 w-4" />;
      case 'CIRCLE': return <Circle className="h-4 w-4" />;
      case 'POLY': return <Hexagon className="h-4 w-4" />;
      default: return <Square className="h-4 w-4" />;
    }
  };

  const TemplatePreview = ({ template }: { template: StallTemplate }) => {
    const size = 60;
    const props = {
      fill: template.fill_color,
      stroke: template.stroke_color,
      strokeWidth: 2,
    };

    return (
      <svg width={size} height={size} className="border rounded bg-muted/20">
        {template.shape === 'CIRCLE' ? (
          <circle cx={size/2} cy={size/2} r={size/2 - 4} {...props} />
        ) : (
          <rect x={4} y={4} width={size-8} height={size-8} rx={4} {...props} />
        )}
      </svg>
    );
  };

  // ─── Compact horizontal strip for mobile/tablet ───
  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 scrollbar-thin">
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground whitespace-nowrap py-1">No templates — create one first</p>
          ) : (
            templates.map((template) => {
              const isSelected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onTemplateSelect?.(template)}
                  onTouchStart={(e) => handleTemplateTouchStart(e, template)}
                  className={`shrink-0 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-accent/50'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  <svg width={32} height={32} className="shrink-0 rounded bg-muted/20">
                    {template.shape === 'CIRCLE' ? (
                      <circle cx={16} cy={16} r={13} fill={template.fill_color} stroke={template.stroke_color} strokeWidth={2} />
                    ) : (
                      <rect x={3} y={3} width={26} height={26} rx={3} fill={template.fill_color} stroke={template.stroke_color} strokeWidth={2} />
                    )}
                  </svg>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-medium leading-tight truncate max-w-[5rem]">{template.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      <CurrencyWrapper amount={template.price} />
                    </p>
                  </div>
                  {isSelected && enableTapToPlace && (
                    <Badge variant="default" className="text-[10px] px-1 py-0 leading-tight">✓</Badge>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Touch drag floating proxy */}
        {touchDragPos && dragTemplate && (
          <div
            className="fixed pointer-events-none z-50 opacity-75"
            style={{ left: touchDragPos.x - 30, top: touchDragPos.y - 30 }}
          >
            <svg width={60} height={60}>
              {dragTemplate.shape === 'CIRCLE' ? (
                <circle cx={30} cy={30} r={26} fill={dragTemplate.fill_color} stroke={dragTemplate.stroke_color} strokeWidth={2} />
              ) : (
                <rect x={4} y={4} width={52} height={52} rx={4} fill={dragTemplate.fill_color} stroke={dragTemplate.stroke_color} strokeWidth={2} />
              )}
            </svg>
          </div>
        )}
      </>
    );
  }

  // ─── Full vertical palette for desktop ───
  return (
    <Card className="h-full min-h-0 flex flex-col border-none shadow-none rounded-none lg:rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Square className="h-5 w-5 mr-2" />
          Template Palette
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {enableTapToPlace
            ? 'Tap a template to select it, then tap the canvas to place a stall'
            : 'Drag templates onto the canvas to create stalls'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto flex-1">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Square className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No templates available</p>
            <p className="text-sm">Create templates first</p>
          </div>
        ) : (
          templates.map((template) => {
            const isSelected = selectedTemplateId === template.id;

            return (
              <div
                key={template.id}
                draggable={!enableTapToPlace}
                onDragStart={(e) => handleDragStart(e, template)}
                onClick={() => enableTapToPlace && onTemplateSelect?.(template)}
                onTouchStart={(e) => handleTemplateTouchStart(e, template)}
                className={`p-3 border rounded-lg transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:bg-accent/50'
                } ${enableTapToPlace ? 'cursor-pointer' : 'cursor-grab'}`}
                style={{ touchAction: 'none' }}
              >
                <div className="flex items-center space-x-3">
                  <TemplatePreview template={template} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      {getShapeIcon(template.shape)}
                    </div>

                    <div className="text-xs text-muted-foreground mb-2">
                      {template.shape === 'CIRCLE'
                        ? `r${template.radius}`
                        : `${template.width}×${template.height}`
                      }
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        <CurrencyWrapper amount={template.price} />
                      </span>
                      <div className="flex items-center gap-2">
                        {isSelected && enableTapToPlace && (
                          <Badge variant="default" className="text-xs">Selected</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Cap: {template.capacity}
                        </span>
                      </div>
                    </div>

                    {template.tags && template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Touch drag floating proxy */}
      {touchDragPos && dragTemplate && (
        <div
          className="fixed pointer-events-none z-50 opacity-75"
          style={{
            left: touchDragPos.x - 30,
            top: touchDragPos.y - 30,
          }}
        >
          <svg width={60} height={60}>
            {dragTemplate.shape === 'CIRCLE' ? (
              <circle cx={30} cy={30} r={26} fill={dragTemplate.fill_color} stroke={dragTemplate.stroke_color} strokeWidth={2} />
            ) : (
              <rect x={4} y={4} width={52} height={52} rx={4} fill={dragTemplate.fill_color} stroke={dragTemplate.stroke_color} strokeWidth={2} />
            )}
          </svg>
        </div>
      )}
    </Card>
  );
};