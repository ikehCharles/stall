import { useState } from "react";
import { Plus, Edit, Trash2, Square, Circle, Hexagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  useStallTemplates,
  useDeleteStallTemplate,
} from "@/hooks/useStallTemplates";
import { StallTemplateDialog } from "@/components/admin/StallTemplateDialog";
import { toast } from "@/hooks/use-toast";
import CurrencyWrapper from "@/components/shared/currency";

const StallTemplates = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const { data: templates, isLoading } = useStallTemplates();
  const deleteTemplate = useDeleteStallTemplate();

  const handleDelete = async (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      try {
        await deleteTemplate.mutateAsync(templateId);
        toast({
          title: "Template Deleted",
          description: "Stall template has been deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete template",
          variant: "destructive",
        });
      }
    }
  };

  const getShapeIcon = (shape: string) => {
    switch (shape) {
      case "RECT":
        return <Square className="h-4 w-4" />;
      case "CIRCLE":
        return <Circle className="h-4 w-4" />;
      case "POLY":
        return <Hexagon className="h-4 w-4" />;
      default:
        return <Square className="h-4 w-4" />;
    }
  };

  const TemplatePreview = ({ template }: { template: any }) => {
    const size = 40;
    const props = {
      width: size,
      height: size,
      fill: template.fill_color,
      stroke: template.stroke_color,
      strokeWidth: 2,
    };

    return (
      <svg width={size} height={size} className="border rounded">
        {template.shape === "CIRCLE" ? (
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} {...props} />
        ) : (
          <rect
            x={2}
            y={2}
            width={size - 4}
            height={size - 4}
            rx={4}
            {...props}
          />
        )}
      </svg>
    );
  };

  if (isLoading) {
    return <div className="p-6">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Stall Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Create reusable stall designs
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Square className="h-5 w-5 mr-2" />
            Template Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templates && templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Shape</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <TemplatePreview template={template} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {template.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getShapeIcon(template.shape)}
                        <span className="capitalize">
                          {template.shape.toLowerCase()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.shape === "CIRCLE"
                        ? `r${template.radius}`
                        : `${template.width}×${template.height}`}
                    </TableCell>
                    <TableCell>
                      <CurrencyWrapper amount={template.price} />
                    </TableCell>
                    <TableCell>{template.capacity}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTemplate(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Square className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No templates created yet</p>
              <p className="text-sm">
                Create your first stall template to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <StallTemplateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => setIsCreateDialogOpen(false)}
      />

      <StallTemplateDialog
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
        template={editingTemplate}
        onSuccess={() => setEditingTemplate(null)}
      />
    </div>
  );
};

export default StallTemplates;
