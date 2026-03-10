import { Square, Circle, Hexagon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CurrencyWrapper from '../shared/currency';
import type { StallTemplate } from '@/hooks/useStallTemplates';

interface StallTemplatesPaletteProps {
  templates: StallTemplate[];
}

export const StallTemplatesPalette = ({ templates }: StallTemplatesPaletteProps) => {
  const handleDragStart = (e: React.DragEvent, template: StallTemplate) => {
    e.dataTransfer.setData('application/json', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Square className="h-5 w-5 mr-2" />
          Template Palette
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Drag templates onto the canvas to create stalls
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Square className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No templates available</p>
            <p className="text-sm">Create templates first</p>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              draggable
              onDragStart={(e) => handleDragStart(e, template)}
              className="p-3 border border-border rounded-lg cursor-grab hover:bg-accent/50 transition-colors"
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
                      <CurrencyWrapper amount={template.price} /></span>
                    <span className="text-xs text-muted-foreground">
                      Cap: {template.capacity}
                    </span>
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
          ))
        )}
      </CardContent>
    </Card>
  );
};