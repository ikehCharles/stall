import { useEffect, useRef, useState } from "react";
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
import { Loader2, Shield, Mail, User, Plus } from "lucide-react";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { PermissionGate } from "@/components/PermissionGate";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UserRegister from "../auth/UserRegister";
import { useRoles, useUpdateUserRole, useUsersRoles } from "@/hooks/useRolesAndPermissions";
import ModalUserActions from "./ModalUserActions";




export default function UserManagement() {
    const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: roles } = useRoles();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => {
      clearTimeout(handler);
    };
  }, [search]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch users (server-side pagination)
  const { data, isLoading: usersLoading, refetch } = useUsersRoles(currentPage, pageSize, roleFilter, debouncedSearch);
  const userList = data?.users || [];
  const totalUsers = data?.total || 0;


  // Server-side pagination: userList is already paginated
  const paginatedUsers = userList;
  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="container mx-auto py-8 space-y-6">
            <div className="flex justify-between items-center">

      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage user accounts and role assignments
        </p>
      </div>
      <PermissionGate permissions={[PERMISSIONS.USERS.INVITE]}>
          <Dialog modal={true} open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account and assign roles
                </DialogDescription>
              </DialogHeader>
              
              <UserRegister onUserCreated={()=>setIsCreateDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </PermissionGate>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage user roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex justify-between items-center flex-wrap">

          <div className="flex gap-4">
            <Select value={roleFilter} onValueChange={value => { setRoleFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All Roles</SelectItem>
                {roles?.map(role => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={searchInputRef}
              type="text"
              className="input border rounded px-3 text-sm py-2 w-64"
              placeholder="Search by username or email"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
          </div>


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
              
              {usersLoading ? (
                Array.from({ length: pageSize }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
                        <span className="h-4 w-24 bg-muted rounded animate-pulse" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
                        <span className="h-4 w-32 bg-muted rounded animate-pulse" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <span className="h-4 w-16 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="h-4 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                paginatedUsers.map((user) => (
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
                      <ModalUserActions user={user} roles={roles} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {paginatedUsers && paginatedUsers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users found
            </div>
          )}

          <div className="mt-6">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
