import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

/**
 * Fetches the current vendor's KYC category (business_type_id) and tags from vendor_tags
 * so the frontend can determine stall eligibility before the user clicks.
 */
export const useVendorEligibility = () => {
  return useQuery({
    queryKey: ["vendor-eligibility"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Fetch approved KYC business_type_id
      const { data: kyc } = await supabase
        .from("kyc_applications")
        .select("business_type_id")
        .eq("user_id", user.id)
        .eq("status", "APPROVED")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch vendor tags from vendor_tags junction table
      const { data: vendorTagRows } = await supabase
        .from("vendor_tags")
        .select("tag_id")
        .eq("user_id", user.id);

      return {
        categoryId: kyc?.business_type_id || null,
        tagIds: (vendorTagRows ?? []).map((r) => r.tag_id),
      };
    },
  });
};

/**
 * Client-side eligibility check for a stall given vendor data.
 * Mirrors the DB function logic for instant UI feedback.
 *
 * Resolution order (same as DB COALESCE):
 *   effective category = instance.category_id ?? template.category_id
 *   effective tags     = instance.stall_instance_tags if any, else template.stall_template_tags
 *   All fields can be null – a null effective value means "open to everyone".
 */
export function checkStallEligibility(
  stall: {
    category_id?: string | null;
    category_overridden?: boolean;
    tags_overridden?: boolean;
    stall_instance_tags?: { tag_id: string }[];
    stall_templates?: {
      category_id?: string | null;
      stall_template_tags?: { tag_id: string }[];
    };
  },
  vendor: { categoryId: string | null; tagIds: string[] } | null | undefined,
): { eligible: boolean; reason?: string; message?: string } {
  // Resolve effective category:
  //   If category_overridden → use instance value as-is (even if null)
  //   Otherwise → instance ?? template
  const effectiveCategoryId = stall.category_overridden
    ? (stall.category_id ?? null)
    : (stall.category_id ?? stall.stall_templates?.category_id ?? null);

  // No effective category → stall is open to everyone
  if (!effectiveCategoryId) {
    return { eligible: true };
  }

  // Vendor has no eligibility data (no approved KYC)
  if (!vendor || !vendor.categoryId) {
    return {
      eligible: false,
      reason: "no_approved_kyc",
      message: "Approved KYC required to book this stall",
    };
  }

  // Category mismatch
  if (vendor.categoryId !== effectiveCategoryId) {
    return {
      eligible: false,
      reason: "category_mismatch",
      message: "Your business category does not match this stall type",
    };
  }

  // Resolve effective tags:
  //   If tags_overridden → use instance tags only (even if empty)
  //   Otherwise → instance tags if any, else template tags
  const instanceTagIds = stall.stall_instance_tags?.map((t) => t.tag_id) || [];
  const templateTagIds =
    stall.stall_templates?.stall_template_tags?.map((t) => t.tag_id) || [];
  const stallTagIds = stall.tags_overridden
    ? instanceTagIds
    : instanceTagIds.length > 0
      ? instanceTagIds
      : templateTagIds;

  // No tags on stall → category match is sufficient
  if (stallTagIds.length === 0) {
    return { eligible: true };
  }

  // Check vendor has ALL stall tags
  const missingTags = stallTagIds.filter(
    (tagId) => !vendor.tagIds.includes(tagId),
  );

  if (missingTags.length > 0) {
    return {
      eligible: false,
      reason: "missing_tags",
      message: "You do not have the required tags for this stall",
    };
  }

  return { eligible: true };
}

/**
 * FCA-side eligibility check for a stall given vendor data.
 * Mirrors the DB function logic for instant UI feedback.
 *
 * Resolution order (same as DB COALESCE):
 *   effective category = instance.category_id ?? template.category_id
 *   effective tags     = instance.stall_instance_tags if any, else template.stall_template_tags
 *   All fields can be null – a null effective value means "open to everyone".
 */
export function checkStallEligibilityByFCA(
  stall: {
    category_id?: string | null;
    category_overridden?: boolean;
    tags_overridden?: boolean;
    stall_instance_tags?: { tag_id: string }[];
    stall_templates?: {
      category_id?: string | null;
      stall_template_tags?: { tag_id: string }[];
    };
  },
  vendor:
    | {
        categoryId: string | null;
        tagIds: string[];
        last_login_at: string | null;
        kyc_status: Database["public"]["Tables"]["kyc_applications"]["Row"]["status"];
      }
    | null
    | undefined,
): { eligible: boolean; reason?: string; message?: string } {
  // Resolve effective tags:
  //   If tags_overridden → use instance tags only (even if empty)
  //   Otherwise → instance tags if any, else template tags
  const instanceTagIds = stall.stall_instance_tags?.map((t) => t.tag_id) || [];
  const templateTagIds =
    stall.stall_templates?.stall_template_tags?.map((t) => t.tag_id) || [];
  const stallTagIds = stall.tags_overridden
    ? instanceTagIds
    : instanceTagIds.length > 0
      ? instanceTagIds
      : templateTagIds;

  // check if vendor have logged in for the first time
  if (vendor && vendor.last_login_at === null) {
    return {
      eligible: false,
      reason: "first_time_login",
      message: "Please complete your profile to book this stall",
    };
  }

  // check if vendor have no KYC or pending KYC, allow them to book but show a warning in the UI
  if (
    vendor &&
    (vendor.kyc_status === null || vendor.kyc_status === "PENDING")
  ) {
    // hide stalls that require tags
    if (stallTagIds.length) {
      return {
        eligible: false,
        reason: "pending_kyc_missing_tags",
        message:
          "KYC application for this vendor is pending. Tags are required for this stall.",
      };
    }
    return {
      eligible: true,
    };
  }

  // check if vendor have rejected KYC, do not allow them to book and show a warning in the UI
  if (vendor && vendor.kyc_status === "REJECTED") {
    return {
      eligible: false,
      reason: "rejected_kyc",
      message:
        "Your KYC application was rejected. Please contact support for assistance.",
    };
  }

  // Resolve effective category:
  //   If category_overridden → use instance value as-is (even if null)
  //   Otherwise → instance ?? template
  const effectiveCategoryId = stall.category_overridden
    ? (stall.category_id ?? null)
    : (stall.category_id ?? stall.stall_templates?.category_id ?? null);

  // No effective category → stall is open to everyone
  if (!effectiveCategoryId) {
    return { eligible: true };
  }

  // Vendor has no eligibility data (no approved KYC)
  if (!vendor || !vendor.categoryId) {
    return {
      eligible: false,
      reason: "no_approved_kyc",
      message: "Approved KYC required to book this stall",
    };
  }

  // Category mismatch
  if (vendor.categoryId !== effectiveCategoryId) {
    return {
      eligible: false,
      reason: "category_mismatch",
      message: "Your business category does not match this stall type",
    };
  }

  // No tags on stall → category match is sufficient
  if (stallTagIds.length === 0) {
    return { eligible: true };
  }

  // Check vendor has ALL stall tags
  const missingTags = stallTagIds.filter(
    (tagId) => !vendor.tagIds.includes(tagId),
  );

  if (missingTags.length > 0) {
    return {
      eligible: false,
      reason: "missing_tags",
      message: "You do not have the required tags for this stall",
    };
  }

  return { eligible: true };
}
