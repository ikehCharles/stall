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
import { supabase } from "@/integrations/supabase/client";
import { useLoading } from "@/contexts/LoadingContext";
import { toast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { UserPayloadSchema, ValidatePayload } from "@/lib/schemaValidation";

interface UserRegisterProps {
  onUserCreated: (user: { user: User }) => void;
  user?: Partial<UserPayload>;
  isVendor?: boolean;
  disabled?: boolean;
}

const initialPayload: UserPayload = {
  id:"",
  email: "",
  fullName: "",
  phoneNumber: "",
  roleId: "",
  confirmEmail: false,
  password: "",
  tags: [],
};
const UserRegister: React.FC<UserRegisterProps> = (props) => {
  const { data: roles } = useRoles();
  const { startLoading, stopLoading } = useLoading();
  const [payload, setPayload] = useState<UserPayload>(initialPayload);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    roleId?: string;
    password?: string;
  }>({});

  const { mutate, isPending } = useUsers();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (props.disabled) return;
    const { email, fullName, phoneNumber, roleId, password, confirmEmail } =
      payload;

    const validationResult = ValidatePayload(UserPayloadSchema, payload);
    if (validationResult.hasError) {
      setFieldErrors(validationResult.fieldErrors);
      return;
    }

    if (confirmEmail && !password) {
      setFieldErrors({ password: "Password is required" });
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
      const friendlyMsg = profileCheckError.message?.includes("phone") || profileCheckError.details === "phone_taken"
        ? "This phone number is already registered."
        : profileCheckError.message;
      setError(friendlyMsg);
      toast({
        title: friendlyMsg,
        variant: "destructive",
      });
      stopLoading();
      return;
    }
    stopLoading();

    const userPayload: UserPayload = {
      id:"0",
      fullName,
      email: normalizedEmail,
      phoneNumber: formattedPhone,
      roleId,
      confirmEmail,
      password,
      tags: payload.tags || [],
    };
    mutate(userPayload, {
      onSuccess: (data) => {
        props.onUserCreated(data);
      },
      onError: (err) => {
        console.error(err, "error creating user");
        const msg = err?.message || "";
        if (
          msg.includes("profiles_phone_number_unique") ||
          msg.includes("phone number is already registered") ||
          (msg.includes("duplicate") && msg.includes("phone"))
        ) {
          setError("This phone number is already registered.");
        } else if (
          msg.includes("profiles_email_unique") ||
          msg.includes("email is already registered") ||
          (msg.includes("duplicate") && msg.includes("email"))
        ) {
          setError("This email is already registered.");
        } else {
          setError(msg);
        }
      },
    });
  };


  useEffect(() => {
    setPayload({ ...initialPayload, ...props.user });
  }, [props.user]);

  return (
    <form onSubmit={handleRegister} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          disabled={props.disabled}
          type="text"
          placeholder="Enter full name"
          value={payload.fullName}
          onChange={(e) => setPayload({ ...payload, fullName: e.target.value })}
          required
        />
        {fieldErrors.fullName && (
          <p className="text-sm text-destructive">{fieldErrors.fullName} </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          disabled={props.disabled}
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
            disabled={props.disabled}
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

      {!props.isVendor && <div className="space-y-2">
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
      </div>}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!props.disabled && !props.isVendor && <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating User..." : "Create User"}
      </Button>}
      {!props.disabled && props.isVendor && <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating Vendor..." : "Create Vendor"}
      </Button>}
    </form>
  );
};

export default UserRegister;
