import { useState, useEffect } from "react";
import { useTags } from "@/hooks/useTags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronRight } from "lucide-react";
import { CrudMultiSelect } from "@/components/ui/crud-select";
import { Role, UserProfile } from "@/hooks/useRolesAndPermissions";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { UserPayload } from "@/hooks/useUsers";
import { useUpdateUser } from "@/hooks/useUsers";
import { Input } from "@/components/ui/input";
import { UserPayloadSchema, ValidatePayload } from "@/lib/schemaValidation";
import { supabase } from "@/integrations/supabase/client";



interface ModalUserActionsProps {
  user: UserProfile;
  roles: Role[];
}

export default function ModalUserActions({ user, roles }: ModalUserActionsProps) {
  const updateUser = useUpdateUser();
  const [open, setOpen] = useState(false);
  const { data: tagOptions = [] } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    roleId?: string;
    password?: string;
  }>({});
  const [payload, setPayload] = useState<UserPayload>({
    id: user.id,
    email: user.email,
    fullName: user.full_name || "",
    phoneNumber: user.phone_number || "",
    roleId: user.role_id || "",
    confirmEmail: false,
    password: "",
    tags: [],
  });

  // Load vendor tags from vendor_tags junction table when dialog opens
  useEffect(() => {
    if (!open) return;
    supabase
      .from("vendor_tags")
      .select("tag_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const tagIds = (data ?? []).map((r) => r.tag_id);
        setSelectedTagIds(tagIds);
        setPayload((prev) => ({ ...prev, tags: tagIds }));
      });
  }, [open, user.id]);


  // Save both role and tags
  const handleSave = async () => {

    const validationResult = ValidatePayload(UserPayloadSchema, payload);
    if (validationResult.hasError) {
      setFieldErrors(validationResult.fieldErrors);
      return;
    }
    setFieldErrors({});

    const user = {
      ...payload,
      tags: selectedTagIds,
    }
    console.error(user, "here user")
    // Update user profile and tags
    await updateUser.mutateAsync(user);

    setOpen(false);


  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Edit user">
        <ChevronRight className="w-5 h-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              disabled
              placeholder="Enter your email"
              value={payload.email}
              onChange={(e) => {
                setPayload({ ...payload, email: e.target.value });
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
              }}
              required
              className={fieldErrors.email ? "border-destructive" : ""}
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive">{fieldErrors.email} </p>
            )}
          </div>
          {/* Role */}


          {/* Fullname */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              disabled
              id="fullName"
              type="text"
              placeholder="Enter full name"
              value={payload.fullName}
              onChange={(e) => {
                setPayload({ ...payload, fullName: e.target.value });
                if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: undefined });
              }}
              required
            />
            {fieldErrors.fullName && (
              <p className="text-sm text-destructive">{fieldErrors.fullName} </p>
            )}
          </div>
          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <div
              className={
                fieldErrors.phone ? "border border-destructive rounded-md" : ""
              }
            >
              <PhoneInput
                disabled
                id="phoneNumber"
                value={payload.phoneNumber}
                onChange={(value) => {
                  setPayload({ ...payload, phoneNumber: value });
                  if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                }}
                placeholder="Enter your phone number"
                required
              />
            </div>
            {fieldErrors.phone && (
              <p className="text-sm text-destructive">{fieldErrors.phone} </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleId">Role</Label>
            <div
              className={
                fieldErrors.roleId ? "border border-destructive rounded-md" : ""
              }
            >
              <Select
                value={payload.roleId || ""}
                onValueChange={(roleId) => {
                  setPayload({ ...payload, roleId });
                  if (fieldErrors.roleId) setFieldErrors({ ...fieldErrors, roleId: undefined });
                }}
              >
                <SelectTrigger className="w-full">
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
            </div>
            {fieldErrors.roleId && (
              <p className="text-sm text-destructive">{fieldErrors.roleId}</p>
            )}
          </div>
          {/* Tags */}
          <div>
            <div className="mb-2 text-sm font-medium">Tags</div>
            <CrudMultiSelect
              value={selectedTagIds}
              options={tagOptions.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
              onChange={setSelectedTagIds}
              placeholder="Select tags…"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button className="ml-2" onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>

      </Dialog >
    </>
  );
}