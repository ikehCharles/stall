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
export type Role = {
  id: string;
  key: string;
  name: string;
};

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
  phone_number: string | null;
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

export const useUsersRoles = (page: number, pageSize: number, roleFilter: string, search: string) => {
  return useQuery({
    queryKey: [QueryKeysEnum.userManagement, page, pageSize, roleFilter, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profiles_with_roles", {
        p_page:      page,
        p_page_size: pageSize,
        p_search:    search || "",
        p_role_id:   roleFilter && roleFilter !== "none" ? roleFilter : null,
      });

      if (error) throw error;

      return {
        users: data.users as User[],
        total: data.total as number,
      };
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
