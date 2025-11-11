import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Shield, Lock, Edit, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { PermissionGate } from "@/components/PermissionGate";
import { RolePayload, Permission, RoleWithPermissions, useCreateOrUpdateRole, usePermissionsList, useRolesWithPermissions } from "@/hooks/useRolesAndPermissions";


export default function RoleManagement() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(
    null
  );
  const [role, setRole] = useState<RolePayload>({
    key: "",
    name: "",
    description: "",
    permissions: [] as string[],
  });

  // Fetch all roles with their permissions
  const { data: roles, isLoading: rolesLoading } = useRolesWithPermissions();

  // Fetch all available permissions
  const { data: permissions } = usePermissionsList();

  // Group permissions by category
  const permissionsByCategory = permissions?.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Create role mutation
  const createOrUpdateRole = useCreateOrUpdateRole();

  // Delete role mutation
  const deleteRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles-management"] });
      toast.success("Role deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete role: " + error.message);
    },
  });

  const handleCreateRole = async () => {
    if (!role.key || !role.name) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      if(editingRole){
        setRole({...role, id: editingRole.id})
      }
      await createOrUpdateRole.mutate(role);
      setIsCreateDialogOpen(false);
      setRole({ key: "", name: "", description: "", permissions: [] });

    } catch (error) {
      setIsCreateDialogOpen(false);
      setRole({ key: "", name: "", description: "", permissions: [] });

    }
  };

  const editRole = (role: RoleWithPermissions) => {
    setRole(role);
    setEditingRole(role);
    setIsCreateDialogOpen(true);
  }

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Role Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage roles and their associated permissions
          </p>
        </div>
        <PermissionGate permissions={[PERMISSIONS.ROLES.CREATE, PERMISSIONS.ROLES.MANAGE]}>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open)=>{
              setIsCreateDialogOpen(open);
              setEditingRole(null);
              setRole({ key: "", name: "", description: "", permissions: [] });
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRole ? 'Edit' : 'Create New'} Role</DialogTitle>
                <DialogDescription>
                 {editingRole ? 'Edit role' : 'Define a new role'}  and assign permissions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="key">Role Key *</Label>
                  <Input
                    id="key"
                    placeholder="e.g., moderator"
                    value={role.key}
                    onChange={(e) =>
                      setRole({ ...role, key: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="name">Role Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Moderator"
                    value={role.name}
                    onChange={(e) =>
                      setRole({ ...role, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe this role..."
                    value={role.description}
                    onChange={(e) =>
                      setRole({ ...role, description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="mt-2 space-y-4 border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                    {Object.entries(permissionsByCategory || {}).map(
                      ([category, perms]) => (
                        <div key={category}>
                          <h4 className="font-semibold text-sm mb-2 capitalize">
                            {category}
                          </h4>
                          <div className="space-y-2 ml-4">
                            {perms.map((perm) => (
                              <div
                                key={perm.id}
                                className="flex items-start space-x-2"
                              >
                                <Checkbox
                                  id={perm.id}
                                  checked={role.permissions.includes(
                                    perm.key
                                  )}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setRole({
                                        ...role,
                                        permissions: [
                                          ...role.permissions,
                                          perm.key,
                                        ],
                                      });
                                    } else {
                                      setRole({
                                        ...role,
                                        permissions: role.permissions.filter(
                                          (k) => k !== perm.key
                                        ),
                                      });
                                    }
                                  }}
                                />
                                <div className="grid gap-1 leading-none">
                                  <label
                                    htmlFor={perm.id}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {perm.name}
                                  </label>
                                  {perm.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={ handleCreateRole}
                  disabled={createOrUpdateRole.isPending}
                >
                  {createOrUpdateRole.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingRole ? 'Update' : 'Create'} Role
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      <div className="grid gap-6">
        {roles?.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {role.name}
                      {role.is_system && (
                        <Badge variant="secondary">
                          <Lock className="h-3 w-3 mr-1" />
                          System Role
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {role.description || "No description"}
                    </CardDescription>
                  </div>
                </div>
                <PermissionGate permissions={[PERMISSIONS.ROLES.MANAGE]}>
                  {!role.is_system && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                            editRole(role)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete role "${role.name}"?`)) {
                            deleteRole.mutate(role.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </PermissionGate>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <h4 className="text-sm font-semibold mb-2">Permissions:</h4>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.length > 0 ? (
                    role.permissions.map((permKey) => (
                      <Badge key={permKey} variant="outline">
                        {permKey}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No permissions assigned
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {roles && roles.length === 0 && (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No roles found
          </CardContent>
        </Card>
      )}
    </div>
  );
}
