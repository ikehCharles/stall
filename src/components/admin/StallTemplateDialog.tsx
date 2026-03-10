import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CrudMultiSelect, CrudSelect } from '@/components/ui/crud-select';
import { useCreateStallTemplate, useUpdateStallTemplate } from '@/hooks/useStallTemplates';
import type { StallTemplate } from '@/hooks/useStallTemplates';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, useStallTemplateTags, useSyncStallTemplateTags } from '@/hooks/useTags';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { toast } from '@/hooks/use-toast';
import CurrencyWrapper from '../shared/currency';

const formSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  shape: z.enum(['RECT', 'CIRCLE', 'POLY']),
  fill_color: z.string().min(1, 'Fill color is required'),
  stroke_color: z.string().min(1, 'Stroke color is required'),
  width: z.number().min(10, 'Width must be at least 10'),
  height: z.number().min(10, 'Height must be at least 10'),
  radius: z.number().min(5, 'Radius must be at least 5'),
  price: z.number().min(0, 'Price must be non-negative'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  category_id: z.string().nullable().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface StallTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: StallTemplate;
  onSuccess: () => void;
}

export const StallTemplateDialog = ({ open, onOpenChange, template, onSuccess }: StallTemplateDialogProps) => {
  const createTemplate = useCreateStallTemplate();
  const updateTemplate = useUpdateStallTemplate();

  console.warn("Template Library", template)
  // Tags CRUD
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const { data: existingTagIds = [] } = useStallTemplateTags(template?.id);
  const syncTags = useSyncStallTemplateTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Categories CRUD
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // Sync existing tag ids into local state when editing
  const existingTagIdsKey = JSON.stringify(existingTagIds);
  useEffect(() => {
    const parsed: string[] = JSON.parse(existingTagIdsKey);
    setSelectedTagIds(parsed);
  }, [existingTagIdsKey]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: template?.name || '',
      shape: template?.shape || 'RECT',
      fill_color: template?.fill_color || '#3b82f6',
      stroke_color: template?.stroke_color || '#1e40af',
      width: template?.width || 80,
      height: template?.height || 60,
      radius: template?.radius || 30,
      price: template?.price || 100,
      capacity: template?.capacity || 1,
      category_id: template?.category_id || null,
    },
  });

  const shape = form.watch('shape');

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        shape: data.shape,
        fill_color: data.fill_color,
        stroke_color: data.stroke_color,
        width: data.width,
        height: data.height,
        radius: data.radius || null,
        price: data.price,
        capacity: data.capacity,
        category_id: data.category_id || null,
        tags: [] as string[],
      };

      if (template) {
        await updateTemplate.mutateAsync({ ...payload, id: template.id });
        await syncTags.mutateAsync({ stallTemplateId: template.id, tagIds: selectedTagIds });
        toast({
          title: 'Template updated',
          description: 'Stall template has been updated successfully',
        });
      } else {
        const created = await createTemplate.mutateAsync(payload);
        if (created?.id && selectedTagIds.length > 0) {
          await syncTags.mutateAsync({ stallTemplateId: created.id, tagIds: selectedTagIds });
        }
        toast({
          title: 'Template created',
          description: 'New stall template has been created successfully',
        });
      }
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: template ? 'Failed to update template' : 'Failed to create template',
        variant: 'destructive',
      });
    }
  };

  const TemplatePreview = () => {
    const width = form.watch('width') || 80;
    const height = form.watch('height') || 60;
    const radius = form.watch('radius') || 30;
    const fillColor = form.watch('fill_color') || '#3b82f6';
    const strokeColor = form.watch('stroke_color') || '#1e40af';
    
    const svgSize = 120;
    const scale = Math.min(svgSize / Math.max(width, height, radius * 2), 1);
    
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="w-32 h-32 border rounded-lg flex items-center justify-center bg-muted/20">
          <svg width={svgSize} height={svgSize}>
            {shape === 'CIRCLE' ? (
              <circle
                cx={svgSize/2}
                cy={svgSize/2}
                r={radius * scale}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={2}
              />
            ) : (
              <rect
                x={(svgSize - width * scale) / 2}
                y={(svgSize - height * scale) / 2}
                width={width * scale}
                height={height * scale}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={2}
                rx={4}
              />
            )}
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">Preview</p>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          <DialogDescription>
            {template ? 'Update template properties' : 'Design a reusable stall template'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Standard Stall" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shape"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shape</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a shape" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RECT">Rectangle</SelectItem>
                        <SelectItem value="CIRCLE">Circle</SelectItem>
                        <SelectItem value="POLY">Polygon</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fill_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fill Color</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                          <Input {...field} placeholder="#3b82f6" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stroke_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stroke Color</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                          <Input {...field} placeholder="#1e40af" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {shape === 'CIRCLE' ? (
                <FormField
                  control={form.control}
                  name="radius"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Radius</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="width"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Width</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Price <CurrencyWrapper /></FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Category</FormLabel>
                    <FormControl>
                      <CrudSelect
                        value={field.value ?? null}
                        options={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
                        onChange={(id) => field.onChange(id)}
                        onCreate={async (name, color) => { await createCategory.mutateAsync({ name, color }); }}
                        onUpdate={async (id, name, color) => { await updateCategory.mutateAsync({ id, name, color }); }}
                        onDelete={async (id) => { await deleteCategory.mutateAsync(id); }}
                        placeholder="Select category…"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Tags</FormLabel>
                <CrudMultiSelect
                  value={selectedTagIds}
                  options={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
                  onChange={setSelectedTagIds}
                  onCreate={async (name, color) => { await createTag.mutateAsync({ name, color }); }}
                  onUpdate={async (id, name, color) => { await updateTag.mutateAsync({ id, name, color }); }}
                  onDelete={async (id) => { await deleteTag.mutateAsync(id); }}
                  placeholder="Select tags…"
                />
              </FormItem>

              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending}>
                  {template ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </form>
          </Form>

          <div className="flex items-center justify-center">
            <TemplatePreview />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};