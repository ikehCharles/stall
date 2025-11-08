import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { PermissionGate } from "@/components/PermissionGate";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role_key: string | null;
  role_name: string | null;
  role_id: string | null;
}

interface Role {
  id: string;
  key: string;
  name: string;
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canAssignRoles = hasPermission(PERMISSIONS.ROLES.ASSIGN);

  // Fetch all users with their roles
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          full_name,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user roles separately
      const usersWithRoles = await Promise.all(
        (data || []).map(async (user) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select(`
              role_id,
              roles:role_id (
                id,
                key,
                name
              )
            `)
            .eq("user_id", user.id)
            .single();

          return {
            ...user,
            role_key: roleData?.roles?.key || null,
            role_name: roleData?.roles?.name || null,
            role_id: roleData?.role_id || null,
          };
        })
      );

      return usersWithRoles as UserProfile[];
    },
  });

  // Fetch available roles
  const { data: roles } = useQuery({
    queryKey: ["roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, key, name")
        .order("name");

      if (error) throw error;
      return data as Role[];
    },
  });

  // Mutation to update user role
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      // First, delete existing role assignment
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Then insert new role assignment
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast.success("User role updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update user role: " + error.message);
    },
  });

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage user accounts and role assignments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage user roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {user.full_name || "No name"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role_name ? (
                      <Badge variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        {user.role_name}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No role assigned</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <PermissionGate permissions={[PERMISSIONS.ROLES.ASSIGN]}>
                      <Select
                        value={user.role_id || ""}
                        onValueChange={(roleId) =>
                          updateUserRole.mutate({ userId: user.id, roleId })
                        }
                        disabled={updateUserRole.isPending}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Assign role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </PermissionGate>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users && users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
