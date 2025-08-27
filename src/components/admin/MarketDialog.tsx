import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateMarket, useUpdateMarket } from '@/hooks/useMarkets';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  name: z.string().min(1, 'Market name is required'),
  theme: z.string().min(1, 'Theme is required'),
  start_at: z.date({ required_error: 'Start date is required' }),
  end_at: z.date({ required_error: 'End date is required' }),
  banner_url: z.string().optional(),
}).refine((data) => data.start_at < data.end_at, {
  message: 'End date must be after start date',
  path: ['end_at'],
});

type FormData = z.infer<typeof formSchema>;

interface MarketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market?: any;
  onSuccess: () => void;
}

export const MarketDialog = ({ open, onOpenChange, market, onSuccess }: MarketDialogProps) => {
  const [bannerUrl, setBannerUrl] = useState(market?.banner_url || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const createMarket = useCreateMarket();
  const updateMarket = useUpdateMarket();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: market?.name || '',
      theme: market?.theme || 'default',
      start_at: market?.start_at ? new Date(market.start_at) : undefined,
      end_at: market?.end_at ? new Date(market.end_at) : undefined,
      banner_url: market?.banner_url || '',
    },
  });

  const handleBannerUpload = async (file: File) => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `market-banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('business-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('business-logos')
        .getPublicUrl(filePath);

      setBannerUrl(data.publicUrl);
      form.setValue('banner_url', data.publicUrl);
      
      toast({
        title: 'Banner uploaded',
        description: 'Market banner has been uploaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload banner image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }
      handleBannerUpload(file);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const submitData = {
        name: data.name,
        theme: data.theme,
        start_at: data.start_at.toISOString(),
        end_at: data.end_at.toISOString(),
        banner_url: data.banner_url || null,
      };

      if (market) {
        await updateMarket.mutateAsync({ ...submitData, id: market.id });
        toast({
          title: 'Market updated',
          description: 'Market has been updated successfully',
        });
      } else {
        await createMarket.mutateAsync(submitData);
        toast({
          title: 'Market created',
          description: 'New market has been created successfully',
        });
      }
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: market ? 'Failed to update market' : 'Failed to create market',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{market ? 'Edit Market' : 'Create New Market'}</DialogTitle>
          <DialogDescription>
            {market ? 'Update market details and settings' : 'Set up a new marketplace event'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Market Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Summer Market Festival" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="theme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a theme" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="summer">Summer</SelectItem>
                      <SelectItem value="winter">Winter</SelectItem>
                      <SelectItem value="spring">Spring</SelectItem>
                      <SelectItem value="autumn">Autumn</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_at"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_at"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormLabel>Banner Image</FormLabel>
              {bannerUrl && (
                <div className="relative">
                  <img 
                    src={bannerUrl} 
                    alt="Banner preview" 
                    className="w-full h-32 object-cover rounded-md"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground"
                    onClick={() => {
                      setBannerUrl('');
                      form.setValue('banner_url', '');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : bannerUrl ? 'Change Banner' : 'Upload Banner'}
              </Button>
              <FormDescription>
                Upload a banner image for your market (optional, max 5MB)
              </FormDescription>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMarket.isPending || updateMarket.isPending}>
                {market ? 'Update Market' : 'Create Market'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};