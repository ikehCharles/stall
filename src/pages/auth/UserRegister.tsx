import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isValidPhoneNumber } from "libphonenumber-js";
import { Select } from "@radix-ui/react-select";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoles } from "@/hooks/useRolesAndPermissions";
import { UserPayload, useUsers } from "@/hooks/useUsers";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useLoading } from "@/contexts/LoadingContext";

interface UserRegisterProps {
  setDialogOpen: (open: boolean) => void;
}
const UserRegister: React.FC<UserRegisterProps> = (props) => {
  const { data: roles } = useRoles();
  const { startLoading, stopLoading } = useLoading();
  const [payload, setPayload] = useState<UserPayload>({
    email: "",
    fullName: "",
    phoneNumber: "",
    roleId: "",
    confirmEmail: false,
    password: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    phone?: string;
    roleId?: string;
    password?: string;
  }>({});

  const { mutate, isPending } = useUsers();

  const handleRegister = async (e: React.FormEvent) => {
    const { email, fullName, phoneNumber, roleId, password, confirmEmail } =
      payload;
    e.preventDefault();

    if (confirmEmail && !password) {
      setFieldErrors({ roleId: "Password is required" });
      return;
    }
    if (!roleId) {
      setFieldErrors({ roleId: "Kindly select a role" });
      return;
    }
    // Validate phone number format
    if (!isValidPhoneNumber(phoneNumber)) {
      setError("Please enter a valid phone number");
      return;
    }
    setError("");
    setFieldErrors({});

    // Normalize inputs
    const normalizedEmail = email.toLowerCase().trim();
    let formattedPhone = phoneNumber;
    if (phoneNumber && !phoneNumber.trim().startsWith("+")) {
      // If no country code, assume UK (+44) for backwards compatibility
      formattedPhone = `+44${phoneNumber.replace(/\D/g, "").slice(-10)}`;
    }

    // Validate the formatted phone number
    if (!isValidPhoneNumber(formattedPhone)) {
      return { error: new Error("Invalid phone number format") };
    }

    startLoading();
    // checks for duplicate phone number
    const { error: profileCheckError, data: val } = await supabase.rpc(
      "profile_checks",
      {
        p_phone: formattedPhone,
      }
    );

    if (profileCheckError) {
      setError(profileCheckError.message);
      stopLoading();
      return;
    }
    stopLoading();

    const userPayload: UserPayload = {
      fullName,
      email: normalizedEmail,
      phoneNumber: formattedPhone,
      roleId,
      confirmEmail,
      password,
    };
    mutate(userPayload, {
      onSuccess: () => {
        props.setDialogOpen(false)
      },
      onError:(err)=>{
        console.error(err, "error creating user");
        setError(err.message);
      }
    });
  };

  return (
    <form onSubmit={handleRegister} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Enter full name"
          value={payload.fullName}
          onChange={(e) => setPayload({ ...payload, fullName: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={payload.email}
          onChange={(e) => setPayload({ ...payload, email: e.target.value })}
          required
          className={fieldErrors.email ? "border-destructive" : ""}
        />
        {fieldErrors.email && (
          <p className="text-sm text-destructive">{fieldErrors.email} </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <div
          className={
            fieldErrors.phone ? "border border-destructive rounded-md" : ""
          }
        >
          <PhoneInput
            id="phoneNumber"
            value={payload.phoneNumber}
            onChange={(value) => setPayload({ ...payload, phoneNumber: value })}
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
              setFieldErrors({ ...fieldErrors, roleId: "" });
              setPayload({ ...payload, roleId });
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

      <div className="space-x-2 flex items-center">
        <Checkbox
          id="confirmEmail"
          checked={payload.confirmEmail}
          onCheckedChange={(e) => setPayload({ ...payload, confirmEmail: !!e })}
        />
        <Label className="" htmlFor="confirmEmail">
          Email Confirmed
        </Label>
      </div>
      {payload.confirmEmail && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div
            className={
              fieldErrors.password ? "border border-destructive rounded-md" : ""
            }
          >
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={payload.password}
              onChange={(e) =>
                setPayload({ ...payload, password: e.target.value })
              }
              required
            />
          </div>
          {fieldErrors.password && (
            <p className="text-sm text-destructive">{fieldErrors.password} </p>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating User..." : "Create User"}
      </Button>
    </form>
  );
};

export default UserRegister;
