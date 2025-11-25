import { Database } from "@/integrations/supabase/types";
import { Badge } from "../ui/badge";

export const getKycStatusColor = (status: string) => {
  switch (status) {
    case "APPROVED":
      return "default";
    case "PENDING":
      return "secondary";
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
};


export const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Pending
          </Badge>
        );
      case "reserved":
        return (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            Reserved
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Approved
          </Badge>
        );
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "expired":
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  export const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "authorized":
        return <Badge variant="default">Authorized</Badge>;
      case "success":
        return <Badge variant="success">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Captured</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "refunded":
        return <Badge variant="destructive">Refunded</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  export const getKycBadge = (status:Database['public']['Tables']['kyc_applications']['Row']['status']) => {
    if (status === 'REJECTED')
      return <Badge variant="destructive">Pending</Badge>;
    if (status === "APPROVED")
      return (
        <Badge className="bg-green-100 text-green-800">Approved</Badge>
      );
    if (status === "PENDING")
      return (
        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      );
    return <Badge variant="secondary">Not Started</Badge>;
  };