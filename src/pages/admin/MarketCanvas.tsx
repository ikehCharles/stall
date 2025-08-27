import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Save, Grid, Move, Square, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMarkets } from '@/hooks/useMarkets';
import { useMarketLayout, useUpsertMarketLayout } from '@/hooks/useMarketLayout';
import { useStallTemplates } from '@/hooks/useStallTemplates';
import { useStallInstances } from '@/hooks/useStallInstances';
import { CanvasEditor } from '@/components/admin/CanvasEditor';
import { StallTemplatesPalette } from '@/components/admin/StallTemplatesPalette';
import { StallPropertiesPanel } from '@/components/admin/StallPropertiesPanel';
import { CanvasSettings } from '@/components/admin/CanvasSettings';
import { toast } from '@/hooks/use-toast';

const MarketCanvas = () => {
  const { marketId } = useParams<{ marketId: string }>();
  const [selectedStallId, setSelectedStallId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  
  const { data: markets } = useMarkets();
  const { data: layout } = useMarketLayout(marketId!);
  const { data: templates } = useStallTemplates();
  const { data: stalls } = useStallInstances(marketId!);
  const upsertLayout = useUpsertMarketLayout();

  const market = markets?.find(m => m.id === marketId);

  const handleSaveLayout = async (layoutData: any) => {
    try {
      await upsertLayout.mutateAsync({
        market_id: marketId!,
        ...layoutData,
      });
      toast({
        title: 'Layout Saved',
        description: 'Canvas layout has been saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save layout',
        variant: 'destructive',
      });
    }
  };

  if (!market) {
    return <div className="p-6">Market not found</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{market.name}</h1>
            <p className="text-muted-foreground">Canvas Editor</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
            >
              <Grid className="h-4 w-4 mr-2" />
              Grid: {showGrid ? 'On' : 'Off'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Canvas Settings
            </Button>
            <Button size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Templates Palette */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto">
          <StallTemplatesPalette templates={templates || []} />
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 bg-muted/20 overflow-hidden relative">
          <CanvasEditor
            layout={layout}
            stalls={stalls || []}
            showGrid={showGrid}
            selectedStallId={selectedStallId}
            onStallSelect={setSelectedStallId}
            onSaveLayout={handleSaveLayout}
          />
        </div>

        {/* Right Panel - Properties */}
        <div className="w-80 border-l border-border bg-card overflow-y-auto">
          <StallPropertiesPanel
            stallId={selectedStallId}
            stalls={stalls || []}
            onStallUpdate={() => {
              // Refresh stalls data
            }}
          />
        </div>
      </div>

      {/* Canvas Settings Dialog */}
      {showSettings && (
        <CanvasSettings
          open={showSettings}
          onOpenChange={setShowSettings}
          layout={layout}
          onSave={handleSaveLayout}
        />
      )}
    </div>
  );
};

export default MarketCanvas;