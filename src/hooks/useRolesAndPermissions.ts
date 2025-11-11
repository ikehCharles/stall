import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { QueryKeysEnum } from "@/lib/enums";
import { toast, useToast } from "./use-toast";


export interface RolePayload {
  id?: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
}
export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
}

export interface RoleWithPermissions extends Role {
  permissions: string[];
}
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  role_key: string | null;
  role_name: string | null;
  role_id: string | null;
}

export const useRoles = () => {
  return useQuery({
    queryKey: [QueryKeysEnum.rolesList],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, key, name")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
};
export const usePermissionsList = () => {
  // Fetch all available permissions
  return useQuery({
    queryKey: [QueryKeysEnum.permissionsList],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("id, key, name, description, category")
        .order("category, name");

      if (error) throw error;
      return data as Permission[];
    },
  });
};

export const useRolesWithPermissions = () => {
  return useQuery({
    queryKey: [QueryKeysEnum.rolesManagement],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select(
          `
          id,
          key,
          name,
          description,
          is_system,
          created_at
        `
        )
        .order("name");

      if (error) throw error;

      // Fetch permissions for each role
      const rolesWithPermissions = await Promise.all(
        (data || []).map(async (role) => {
          const { data: permData } = await supabase
            .from("role_permissions")
            .select(
              `
              permissions:permission_id (
                key
              )
            `
            )
            .eq("role_id", role.id);

          return {
            ...role,
            permissions: permData?.map((p) => p.permissions.key) || [],
          };
        })
      );

      return rolesWithPermissions as RoleWithPermissions[];
    },
  });
};

export const useUsersRoles = () => {
  // Fetch all users with their roles
  return useQuery({
    queryKey: [QueryKeysEnum.userManagement],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email,
          full_name,
          created_at
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user roles separately
      const usersWithRoles = await Promise.all(
        (data || []).map(async (user) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select(
              `
              role_id,
              roles:role_id (
                id,
                key,
                name
              )
            `
            )
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
};

export const useCreateOrUpdateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleData: RolePayload) => {
      const { data: role, error: roleError } = await await supabase.rpc("save_role_with_permissions", {
        p_role_id: roleData.id,
        p_key: roleData.key,
        p_name: roleData.name,
        p_description: roleData.description,
        p_permission_keys: roleData.permissions,
      });
      
      if (roleError) throw roleError;
      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeysEnum.rolesManagement] });
      toast({
        title: "Role created",
        description: "The role has been created successfully.",
      });
     
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create role",
        description: error.message,
      });
    },
  });
};




export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      roleId,
    }: {
      userId: string;
      roleId: string;
    }) => {
      // First, delete existing role assignment
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Then insert new role assignment
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role_id: roleId,
        assigned_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeysEnum.userManagement],
      });
      toast({
        title: "User role updated",
        description: "The user role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user role",
        description: error.message,
      });
    },
  });
};
