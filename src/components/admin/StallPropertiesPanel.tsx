import { useState } from 'react';
import { Trash2, DollarSign, Tag, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUpdateStallInstance, useDeleteStallInstance } from '@/hooks/useStallInstances';
import { toast } from '@/hooks/use-toast';
import CurrencyWrapper from '../shared/currency';
import { formatCurrency } from '@/lib/utils';
import { useConfirm } from '../ui/confirmDialog';
import { useCategories } from '@/hooks/useCategories';
import { useTags, useStallInstanceTags, useSyncStallInstanceTags } from '@/hooks/useTags';
import { CrudMultiSelect } from '@/components/ui/crud-select';
import { useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/useTags';

interface StallInstance {
  id: string;
  market_id: string;
  template_id: string;
  category_id: string | null;
  category_overridden: boolean;
  tags_overridden: boolean;
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
    category_id: string | null;
    stall_template_tags?: { tag_id: string }[];
  };
  stall_instance_tags?: { tag_id: string }[];
}

interface StallPropertiesPanelProps {
  stallId: string | null;
  stalls: StallInstance[];
  onStallUpdate: () => void;
}

export const StallPropertiesPanel = ({ stallId, stalls, onStallUpdate }: StallPropertiesPanelProps) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const updateStall = useUpdateStallInstance();
  const deleteStall = useDeleteStallInstance();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const { data: instanceTagIds = [] } = useStallInstanceTags(stallId ?? undefined);
  const syncInstanceTags = useSyncStallInstanceTags();

  const stall = stalls.find(s => s.id === stallId);
  const template = stall.stall_templates;
  const effectivePrice = stall.price_override ?? template?.price ?? 0;

  const selectedStall: StallInstance = stall;
  const templateCategoryId = template?.category_id ?? null;
  const templateTagIds = (template?.stall_template_tags ?? []).map((stt) => stt.tag_id);

  // If overridden, use instance value as-is (even if null/empty).
  // If not overridden, fall back to template defaults.
  const displayCategoryId = selectedStall.category_overridden
    ? selectedStall.category_id
    : (selectedStall.category_id ?? templateCategoryId);
  const displayTagIds = selectedStall.tags_overridden
    ? instanceTagIds
    : (instanceTagIds.length > 0 ? instanceTagIds : templateTagIds);

  const handleUpdate = async (field: string, value: string | number | null) => {
    if (!selectedStall) return;

    try {
      await updateStall.mutateAsync({
        id: selectedStall.id,
        market_id: selectedStall.market_id,
        [field]: value,
      });
      
      toast({
        title: 'Stall Updated',
        description: `Stall ${field} has been updated successfully`,
      });
      
      onStallUpdate();
      setEditingField(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update stall',
        variant: 'destructive',
      });
    }
  };

  const confirm = useConfirm();

  const handleDelete = async () => {
    if (!selectedStall) return;
    
    if (await confirm(
      {
        title: 'Confirm Deletion',
        description: `Are you sure you want to delete stall "${selectedStall.label}"? This action cannot be undone.`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          confirmClassName: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      }
    )) {
      try {
        await deleteStall.mutateAsync({
          id: selectedStall.id,
          market_id: selectedStall.market_id,
        });
        
        toast({
          title: 'Stall Deleted',
          description: 'Stall has been deleted successfully',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete stall',
          variant: 'destructive',
        });
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-primary text-primary-foreground';
      case 'BOOKED': return 'bg-destructive text-destructive-foreground';
      case 'BLOCKED': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  if (!selectedStall) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Tag className="h-5 w-5 mr-2" />
            Stall Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stall selected</p>
            <p className="text-sm">Click on a stall to edit its properties</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            Stall Properties
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Label</Label>
            {editingField === 'label' ? (
              <div className="flex space-x-2 mt-1">
                <Input
                  defaultValue={selectedStall.label}
                  onBlur={(e) => handleUpdate('label', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdate('label', e.currentTarget.value);
                    } else if (e.key === 'Escape') {
                      setEditingField(null);
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <div 
                className="mt-1 p-2 border border-border rounded cursor-pointer hover:bg-accent/50"
                onClick={() => setEditingField('label')}
              >
                {selectedStall.label}
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">Status</Label>
            <Select
              value={selectedStall.status}
              onValueChange={(value) => handleUpdate('status', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="BOOKED">Booked</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Badge className={`mt-2 ${getStatusColor(selectedStall.status)}`}>
              {selectedStall.status}
            </Badge>
          </div>

          <div>
            <Label className="text-sm font-medium">Category Override</Label>
            <Select
              value={displayCategoryId || '__none__'}
              onValueChange={async (value) => {
                if (value === '__none__') {
                  // Explicitly clearing → persist the override flag
                  await updateStall.mutateAsync({
                    id: selectedStall.id,
                    market_id: selectedStall.market_id,
                    category_id: null,
                    category_overridden: true,
                  });
                  onStallUpdate();
                  toast({ title: 'Category cleared', description: 'Instance category has been cleared' });
                  return;
                }
                await updateStall.mutateAsync({
                  id: selectedStall.id,
                  market_id: selectedStall.market_id,
                  category_id: value,
                  category_overridden: true,
                });
                onStallUpdate();
                toast({ title: 'Category updated', description: 'Instance category has been updated' });
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Tags Override</Label>
            <CrudMultiSelect
              value={displayTagIds}
              options={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
              onChange={async (newTagIds) => {
                if (!selectedStall) return;
                try {
                  await syncInstanceTags.mutateAsync({
                    stallInstanceId: selectedStall.id,
                    tagIds: newTagIds,
                  });
                  // Mark tags as explicitly overridden
                  await updateStall.mutateAsync({
                    id: selectedStall.id,
                    market_id: selectedStall.market_id,
                    tags_overridden: true,
                  });
                  onStallUpdate();
                  toast({ title: 'Tags Updated', description: 'Instance tags have been updated' });
                } catch {
                  toast({ title: 'Error', description: 'Failed to update tags', variant: 'destructive' });
                }
              }}
              onCreate={async (name, color) => { await createTag.mutateAsync({ name, color }); }}
              onUpdate={async (id, name, color) => { await updateTag.mutateAsync({ id, name, color }); }}
              onDelete={async (id) => { await deleteTag.mutateAsync(id); }}
              placeholder="Select tags…"
            />
          </div>
        </div>

        {/* Position */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            Position
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">X</Label>
              <Input
                type="number"
                value={selectedStall.x}
                onChange={(e) => handleUpdate('x', Number(e.target.value))}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Y</Label>
              <Input
                type="number"
                value={selectedStall.y}
                onChange={(e) => handleUpdate('y', Number(e.target.value))}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Dimensions</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input
                type="number"
                value={selectedStall.width}
                onChange={(e) => handleUpdate('width', Number(e.target.value))}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input
                type="number"
                value={selectedStall.height}
                onChange={(e) => handleUpdate('height', Number(e.target.value))}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center">
            <DollarSign className="h-4 w-4 mr-1" />
            Pricing
          </Label>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Template Price: <CurrencyWrapper amount={template?.price || 0} />
              </Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Price Override</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={`Default: ${formatCurrency(template?.price || 0)}`}
                value={selectedStall.price_override || ''}
                onChange={(e) => handleUpdate('price_override', e.target.value ? Number(e.target.value) : null)}
                className="text-sm"
              />
            </div>
            <div className="p-2 bg-accent/50 rounded text-sm">
              <strong>Effective Price: <CurrencyWrapper amount={effectivePrice} /> </strong>
            </div>
          </div>
        </div>

        {/* Template Info */}
        {template && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Template</Label>
            <div className="p-3 rounded-lg space-y-2">
              <div className="text-sm font-medium">{template.name}</div>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: template.fill_color }}
                />
                <span className="text-xs text-muted-foreground">
                  {template.shape} • Cap: {template.capacity}
                </span>
              </div>
              
              {/* Category (effective) */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Effective Category</Label>
                <div>
                  {(() => {
                    const effectiveCatId = selectedStall.category_overridden
                      ? selectedStall.category_id
                      : (selectedStall.category_id ?? template.category_id);
                    if (effectiveCatId) {
                      const cat = categories.find(c => c.id === effectiveCatId);
                      return (
                        <Badge variant="outline">
                          {cat?.name || 'Unknown'}
                        </Badge>
                      );
                    }
                    return <span className="text-xs text-muted-foreground">No category</span>;
                  })()}
                </div>
              </div>
              
              {/* Tags (effective) */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Effective Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const hasInstanceTags = instanceTagIds.length > 0;
                    const effectiveTagIds = selectedStall.tags_overridden
                      ? instanceTagIds
                      : (hasInstanceTags ? instanceTagIds : (template.stall_template_tags ?? []).map((stt) => stt.tag_id));
                    if (effectiveTagIds.length > 0) {
                      return effectiveTagIds.map((tagId) => {
                        const tag = tags.find(t => t.id === tagId);
                        return tag ? (
                          <Badge key={tagId} variant="secondary" className="text-xs">
                            {tag.name}
                          </Badge>
                        ) : null;
                      });
                    }
                    return <span className="text-xs text-muted-foreground">No tags</span>;
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
          <div><strong>Keyboard Shortcuts:</strong></div>
          <div>Arrow keys: Move stall</div>
          <div>Shift + Arrow: Move 5x faster</div>
          <div>Delete/Backspace: Delete stall</div>
        </div>
      </CardContent>
    </Card>
  );
};