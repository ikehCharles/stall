import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { layoutStorage, type StallLayout } from '@/lib/localStorage';
import { Upload, Plus, Edit, Trash2, Eye } from 'lucide-react';

interface LayoutManagerProps {
  onLayoutSelect?: (layout: StallLayout) => void;
  selectedLayoutId?: string;
}

export const LayoutManager = ({ onLayoutSelect, selectedLayoutId }: LayoutManagerProps) => {
  const [layouts, setLayouts] = useState<StallLayout[]>(() => layoutStorage.getAll());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLayout, setEditingLayout] = useState<StallLayout | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    eventId: 'event-1', // Mock event
    backgroundImage: '',
  });

  const handleCreateLayout = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a layout name",
        variant: "destructive",
      });
      return;
    }

    const newLayout = layoutStorage.add({
      name: formData.name,
      eventId: formData.eventId,
      backgroundImage: backgroundImage,
      stalls: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setLayouts(layoutStorage.getAll());
    setIsCreateDialogOpen(false);
    setFormData({ name: '', eventId: 'event-1', backgroundImage: '' });
    setBackgroundImage('');

    toast({
      title: "Layout Created",
      description: `Layout "${newLayout.name}" has been created`,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBackgroundImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteLayout = (layoutId: string) => {
    layoutStorage.delete(layoutId);
    setLayouts(layoutStorage.getAll());
    toast({
      title: "Layout Deleted",
      description: "Layout has been removed",
    });
  };

  const resetForm = () => {
    setFormData({ name: '', eventId: 'event-1', backgroundImage: '' });
    setBackgroundImage('');
    setEditingLayout(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stall Layouts</h2>
          <p className="text-muted-foreground">Manage your stall layouts and configurations</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Layout
        </Button>
      </div>

      {/* Layouts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {layouts.map((layout) => (
          <Card key={layout.id} className={`cursor-pointer transition-all hover:shadow-md ${
            selectedLayoutId === layout.id ? 'ring-2 ring-primary' : ''
          }`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{layout.name}</CardTitle>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayoutSelect?.(layout);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLayout(layout.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Created {new Date(layout.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-gray-100 rounded-md mb-4 relative overflow-hidden">
                {layout.backgroundImage ? (
                  <img 
                    src={layout.backgroundImage} 
                    alt={layout.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No background image
                  </div>
                )}
                
                {/* Render stalls as small rectangles */}
                {layout.stalls.map((stall) => (
                  <div
                    key={stall.id}
                    className={`absolute border-2 ${
                      stall.isBooked ? 'bg-red-200 border-red-400' : 'bg-green-200 border-green-400'
                    }`}
                    style={{
                      left: `${(stall.x / 500) * 100}%`,
                      top: `${(stall.y / 300) * 100}%`,
                      width: `${(stall.width / 500) * 100}%`,
                      height: `${(stall.height / 300) * 100}%`,
                    }}
                  >
                    <div className="text-xs font-medium text-center mt-1">
                      {stall.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {layout.stalls.length} stalls
                </Badge>
                <Badge variant={layout.stalls.some(s => s.isBooked) ? "destructive" : "default"}>
                  {layout.stalls.filter(s => s.isBooked).length} booked
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {layouts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-muted-foreground mb-4">
              <Plus className="h-12 w-12 mx-auto mb-2" />
              <h3 className="text-lg font-medium">No layouts found</h3>
              <p>Create your first stall layout to get started</p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              Create Layout
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Layout Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Layout</DialogTitle>
            <DialogDescription>
              Create a new stall layout for your events
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Layout Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter layout name"
              />
            </div>

            <div>
              <Label htmlFor="eventId">Event</Label>
              <Select 
                value={formData.eventId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, eventId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event-1">Summer Market Festival</SelectItem>
                  <SelectItem value="event-2">Winter Holiday Market</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Background Image (Optional)</Label>
              <div className="mt-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {backgroundImage ? 'Change Image' : 'Upload Image'}
                </Button>
              </div>
              
              {backgroundImage && (
                <div className="mt-2">
                  <img 
                    src={backgroundImage} 
                    alt="Preview" 
                    className="w-full h-32 object-cover rounded-md"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLayout}>
              Create Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};