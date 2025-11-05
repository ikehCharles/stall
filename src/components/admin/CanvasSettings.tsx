import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

const formSchema = z.object({
  canvas_width: z.number().min(100, 'Width must be at least 100'),
  canvas_height: z.number().min(100, 'Height must be at least 100'),
  unit: z.enum(['px', 'm']),
  grid_size: z.number().min(1, 'Grid size must be at least 1'),
});

type FormData = z.infer<typeof formSchema>;

interface CanvasSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: any;
  onSave: (layout: FormData) => Promise<void>;
}

export const CanvasSettings = ({ open, onOpenChange, layout, onSave }: CanvasSettingsProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      canvas_width: layout?.canvas_width || 800,
      canvas_height: layout?.canvas_height || 600,
      unit: layout?.unit || 'px',
      grid_size: layout?.grid_size || 20,
    },
  });

  const onSubmit = async (data: FormData) => {
    await onSave(data);
    onOpenChange(false);
  };

  const navigate = useNavigate();

  const onCancel = () => {
    if(layout){
      onOpenChange(false);
    }else{
      navigate('/admin/markets');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent disableClose className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Canvas Settings</DialogTitle>
          <DialogDescription>
            Configure the canvas dimensions and grid settings
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="canvas_width"
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
                name="canvas_height"
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

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="px">Pixels (px)</SelectItem>
                      <SelectItem value="m">Meters (m)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="grid_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grid Size</FormLabel>
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

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};