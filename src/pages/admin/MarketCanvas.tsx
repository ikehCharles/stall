import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Settings, Save, Grid, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMarkets } from '@/hooks/useMarkets';
import { useMarketLayout, useUpsertMarketLayout } from '@/hooks/useMarketLayout';
import { useStallTemplates, type StallTemplate } from '@/hooks/useStallTemplates';
import { useStallInstances } from '@/hooks/useStallInstances';
import { CanvasEditor } from '@/components/admin/CanvasEditor';
import { StallTemplatesPalette } from '@/components/admin/StallTemplatesPalette';
import { StallPropertiesPanel } from '@/components/admin/StallPropertiesPanel';
import { CanvasSettings } from '@/components/admin/CanvasSettings';
import { toast } from '@/hooks/use-toast';

const MarketCanvas = () => {

const navigate = useNavigate();
  
  const { marketId } = useParams<{ marketId: string }>();
  const [selectedStallId, setSelectedStallId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isTouchTabletMode, setIsTouchTabletMode] = useState(false);
  const [selectedTemplateForPlacement, setSelectedTemplateForPlacement] = useState<StallTemplate | null>(null);
  const [touchDragPoint, setTouchDragPoint] = useState<{ clientX: number; clientY: number } | null>(null);
  type PendingTemplateDrop = { template: StallTemplate; clientX: number; clientY: number } | null;
  const [pendingTemplateDrop, setPendingTemplateDrop] = useState<PendingTemplateDrop>(null);
  const [showMobileProperties, setShowMobileProperties] = useState(false);
  
  const { data: markets } = useMarkets();
  const { data: layout, isLoading:layoutLoading } = useMarketLayout(marketId!);
  const { data: templates } = useStallTemplates();
  const { data: stalls, refetch: refetchStalls } = useStallInstances(marketId!);
  const upsertLayout = useUpsertMarketLayout();


  const market = markets?.find(m => m.id === marketId);
  const selectedStall = (stalls || []).find(s => s.id === selectedStallId);

  // Close mobile properties drawer when stall is deselected
  useEffect(() => {
    if (!selectedStallId) setShowMobileProperties(false);
  }, [selectedStallId]);

  // Select template → deselect canvas stall
  const handleTemplateSelect = (template: StallTemplate) => {
    setSelectedStallId(null);
    setSelectedTemplateForPlacement(template);
  };

  // Select stall on canvas → deselect template
  const handleStallSelect = (id: string | null) => {
    if (id) setSelectedTemplateForPlacement(null);
    setSelectedStallId(id);
  };

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const tabletWidthQuery = window.matchMedia('(max-width: 1024px)');

    const updateMode = () => {
      setIsTouchTabletMode(coarsePointerQuery.matches || tabletWidthQuery.matches);
    };

    updateMode();
    coarsePointerQuery.addEventListener('change', updateMode);
    tabletWidthQuery.addEventListener('change', updateMode);

    return () => {
      coarsePointerQuery.removeEventListener('change', updateMode);
      tabletWidthQuery.removeEventListener('change', updateMode);
    };
  }, []);

  useEffect(() => {
    if (layout || layoutLoading) {
      setShowSettings(false);
    }else{
      setShowSettings(true);
    }
  }, [layout, layoutLoading]);
  const handleSaveLayout = async (layoutData, navigateToMarket: boolean = false) => {
    try {
      await upsertLayout.mutateAsync({
        market_id: marketId!,
        ...layoutData,
      });
      toast({
        title: 'Layout Saved',
        description: 'Canvas layout has been saved successfully',
      });
      // navigate to market details
      if(!navigateToMarket) return;
      navigate(`/admin/markets`);
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-4 md:px-6 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{market.name}</h1>
            <p className="text-muted-foreground">Canvas Editor</p>
          </div>
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showGrid ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowGrid(!showGrid)}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid: {showGrid ? 'On' : 'Off'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Canvas Settings</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleSaveLayout(layout || {}, true)}
                    disabled={upsertLayout.isPending}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save &amp; Exit</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-h-0">
        {/* ─── Desktop side panel (xl+) ─── */}
        <div className="hidden xl:flex w-80 shrink-0 border-r border-border bg-card flex-col overflow-hidden">
          {selectedStallId ? (
            <StallPropertiesPanel
              stallId={selectedStallId}
              stalls={stalls || []}
              onStallUpdate={refetchStalls}
            />
          ) : (
            <StallTemplatesPalette
              templates={templates || []}
              enableTapToPlace={isTouchTabletMode}
              selectedTemplateId={selectedTemplateForPlacement?.id || null}
              onTemplateSelect={handleTemplateSelect}
              onTemplateTouchMove={isTouchTabletMode ? undefined : (clientX, clientY) => setTouchDragPoint({ clientX, clientY })}
              onTemplateTouchEnd={isTouchTabletMode ? undefined : () => setTouchDragPoint(null)}
              onTemplateTouchDrop={isTouchTabletMode ? undefined : (template, clientX, clientY) =>
                setPendingTemplateDrop({ template, clientX, clientY })
              }
            />
          )}
        </div>

        {/* ─── Mobile/Tablet: compact horizontal template strip ─── */}
        <div className="xl:hidden border-b border-border bg-card shrink-0">
          <StallTemplatesPalette
            templates={templates || []}
            enableTapToPlace={isTouchTabletMode}
            compact
            selectedTemplateId={selectedTemplateForPlacement?.id || null}
            onTemplateSelect={handleTemplateSelect}
            onTemplateTouchMove={isTouchTabletMode ? undefined : (clientX, clientY) => setTouchDragPoint({ clientX, clientY })}
            onTemplateTouchEnd={isTouchTabletMode ? undefined : () => setTouchDragPoint(null)}
            onTemplateTouchDrop={isTouchTabletMode ? undefined : (template, clientX, clientY) =>
              setPendingTemplateDrop({ template, clientX, clientY })
            }
          />
        </div>

        {/* ─── Mobile/Tablet: info bar ─── */}
        {selectedTemplateForPlacement && !selectedStallId && (
          <div className="xl:hidden border-b border-border bg-card shrink-0 flex items-center px-3 py-2 gap-2">
            <span className="text-sm text-foreground">
              <span className="font-medium">{selectedTemplateForPlacement.name}</span> — Tap on the canvas to place
            </span>
          </div>
        )}

        {selectedStallId && selectedStall && (
          <div className="xl:hidden border-b border-border bg-card shrink-0 flex items-center justify-between px-3 py-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {selectedStall.stall_templates && (
                <div
                  className="w-5 h-5 shrink-0 rounded border"
                  style={{ backgroundColor: selectedStall.stall_templates.fill_color }}
                />
              )}
              <span className="text-sm font-medium truncate">{selectedStall.label}</span>
              <Badge
                className={`shrink-0 text-[10px] px-1.5 py-0 ${
                  selectedStall.status === 'AVAILABLE'
                    ? 'bg-primary text-primary-foreground'
                    : selectedStall.status === 'BOOKED'
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {selectedStall.status}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-7 gap-1 text-xs"
              onClick={() => setShowMobileProperties(true)}
            >
              View
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* ─── Canvas ─── */}
        <div className="flex-1 min-w-0 min-h-0 bg-muted/20 overflow-hidden relative mt-1 xl:mt-0">
          <CanvasEditor
            layout={layout}
            stalls={stalls || []}
            showGrid={showGrid}
            selectedStallId={selectedStallId}
            onStallSelect={handleStallSelect}
            onSaveLayout={handleSaveLayout}
            touchDragPoint={touchDragPoint}
            tapToPlaceTemplate={isTouchTabletMode ? selectedTemplateForPlacement : null}
            onTapToPlaceCompleted={() => setSelectedTemplateForPlacement(null)}
            pendingTemplateDrop={pendingTemplateDrop}
            onPendingTemplateDropHandled={() => {
              setPendingTemplateDrop(null);
              setTouchDragPoint(null);
            }}
          />

          {/* ─── Mobile/Tablet: slide-in properties panel from right ─── */}
          {showMobileProperties && selectedStallId && (
            <>
              {/* Backdrop */}
              <div
                className="xl:hidden fixed inset-0 z-30 bg-black/40"
                onClick={() => setShowMobileProperties(false)}
              />
              {/* Panel */}
              <div
                className="xl:hidden fixed top-0 right-0 bottom-0 z-40 w-[85vw] max-w-sm bg-card border-l border-border shadow-xl overflow-y-auto animate-in slide-in-from-right duration-300"
              >
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                  <span className="text-sm font-semibold">Stall Properties</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowMobileProperties(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <StallPropertiesPanel
                  stallId={selectedStallId}
                  stalls={stalls || []}
                  onStallUpdate={refetchStalls}
                />
              </div>
            </>
          )}
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