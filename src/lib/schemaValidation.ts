import { UserPayload } from "@/hooks/useUsers";
import { z } from "zod";


// Zod schema for validation
export const UserPayloadSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  fullName: z.string().min(1, "Full name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  roleId: z.string().min(1, "Role is required"),
  password: z.string().optional(),
  confirmEmail: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// Validate and sanitize payload
export const ValidatePayload = <T extends z.ZodTypeAny>(schema: T, data: unknown) => {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors: { [key: string]: string } = {};
        result.error.errors.forEach((err) => {
            if (err.path.length) errors[err.path[0]] = err.message;
        });
        return { hasError: true, fieldErrors: errors };
    }
    return { hasError: false, sanitized: result.data };
};
