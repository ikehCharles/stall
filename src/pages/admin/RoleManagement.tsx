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
import { Loader2, Plus, Shield, Lock, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { PermissionGate } from "@/components/PermissionGate";

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
}

interface RoleWithPermissions extends Role {
  permissions: string[];
}

export default function RoleManagement() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [newRole, setNewRole] = useState({
    key: "",
    name: "",
    description: "",
    permissions: [] as string[],
  });

  // Fetch all roles with their permissions
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select(`
          id,
          key,
          name,
          description,
          is_system,
          created_at
        `)
        .order("name");

      if (error) throw error;

      // Fetch permissions for each role
      const rolesWithPermissions = await Promise.all(
        (data || []).map(async (role) => {
          const { data: permData } = await supabase
            .from("role_permissions")
            .select(`
              permissions:permission_id (
                key
              )
            `)
            .eq("role_id", role.id);

          return {
            ...role,
            permissions: permData?.map((p: any) => p.permissions.key) || [],
          };
        })
      );

      return rolesWithPermissions as RoleWithPermissions[];
    },
  });

  // Fetch all available permissions
  const { data: permissions } = useQuery({
    queryKey: ["permissions-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("id, key, name, description, category")
        .order("category, name");

      if (error) throw error;
      return data as Permission[];
    },
  });

  // Group permissions by category
  const permissionsByCategory = permissions?.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Create role mutation
  const createRole = useMutation({
    mutationFn: async (roleData: typeof newRole) => {
      // Create role
      const { data: role, error: roleError } = await supabase
        .from("roles")
        .insert({
          key: roleData.key,
          name: roleData.name,
          description: roleData.description,
          is_system: false,
        })
        .select()
        .single();

      if (roleError) throw roleError;

      // Assign permissions
      if (roleData.permissions.length > 0) {
        const permissionIds = permissions
          ?.filter((p) => roleData.permissions.includes(p.key))
          .map((p) => p.id);

        const { error: permError } = await supabase
          .from("role_permissions")
          .insert(
            permissionIds?.map((permId) => ({
              role_id: role.id,
              permission_id: permId,
            })) || []
          );

        if (permError) throw permError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles-management"] });
      toast.success("Role created successfully");
      setIsCreateDialogOpen(false);
      setNewRole({ key: "", name: "", description: "", permissions: [] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create role: " + error.message);
    },
  });

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

  const handleCreateRole = () => {
    if (!newRole.key || !newRole.name) {
      toast.error("Please fill in all required fields");
      return;
    }
    createRole.mutate(newRole);
  };

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
          <h1 className="text-3xl font-bold text-foreground">Role Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage roles and their associated permissions
          </p>
        </div>
        <PermissionGate permissions={[PERMISSIONS.ROLES.CREATE]}>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>
                  Define a new role and assign permissions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="key">Role Key *</Label>
                  <Input
                    id="key"
                    placeholder="e.g., moderator"
                    value={newRole.key}
                    onChange={(e) => setNewRole({ ...newRole, key: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="name">Role Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Moderator"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe this role..."
                    value={newRole.description}
                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="mt-2 space-y-4 border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    {Object.entries(permissionsByCategory || {}).map(([category, perms]) => (
                      <div key={category}>
                        <h4 className="font-semibold text-sm mb-2 capitalize">
                          {category}
                        </h4>
                        <div className="space-y-2 ml-4">
                          {perms.map((perm) => (
                            <div key={perm.id} className="flex items-start space-x-2">
                              <Checkbox
                                id={perm.id}
                                checked={newRole.permissions.includes(perm.key)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewRole({
                                      ...newRole,
                                      permissions: [...newRole.permissions, perm.key],
                                    });
                                  } else {
                                    setNewRole({
                                      ...newRole,
                                      permissions: newRole.permissions.filter(
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
                    ))}
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
                <Button onClick={handleCreateRole} disabled={createRole.isPending}>
                  {createRole.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create Role
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
