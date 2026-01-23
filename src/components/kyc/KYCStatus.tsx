import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
import { useKYCAuditHistory } from "@/hooks/useKYCAuditHistory";
import { MAXKYCREVIEWCOUNT } from "@/lib/utils";

interface KYCApplication {
  id: string;
  business_name: string;
  contact_email: string;
  contact_phone: string;
  business_type?: string;
  business_address?: string;
  tax_id?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  review_notes?: string;
  submitted_at: string;
}

interface KYCStatusProps {
  kycData: KYCApplication | null;
  onStartKYC?: () => void;
}

export const KYCStatus = ({ kycData, onStartKYC }: KYCStatusProps) => {
  const {data: auditHistory, isLoading:isKYCLoading} = useKYCAuditHistory(kycData?.id);
  const maxKYCReviewReached = isKYCLoading || auditHistory?.length >= MAXKYCREVIEWCOUNT;

  if (!kycData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Business verification is required to access all features.</span>
          <Button onClick={onStartKYC} size="sm">
            Start Verification
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusConfig = (status: KYCApplication['status']) => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          title: 'Verification Approved',
          description: 'Your business has been successfully verified. You now have full access to all platform features.',
          badgeVariant: 'default' as const
        };
      case 'PENDING':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          title: 'Verification Under Review',
          description: 'Your business verification is currently being reviewed by our team. We will notify you once the review is complete.',
          badgeVariant: 'secondary' as const
        };
      case 'REJECTED':
        return {
          icon: XCircle,
          color: 'text-red-600',
          title: 'Verification Rejected',
          description: 'Your business verification was rejected. Please review the feedback below and submit updated information.',
          badgeVariant: 'destructive' as const
        };
    }
  };

  const config = getStatusConfig(kycData.status);
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            Business Verification Status
          </CardTitle>
          <Badge variant={config.badgeVariant}>
            {kycData.status}  {kycData.status ==='APPROVED' ? '': '(' + maxKYCReviewReached + ')' ? maxKYCReviewReached ? '(FINAL)': '' : '(' + auditHistory?.length + `/${MAXKYCREVIEWCOUNT}` + ')' }
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{config.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {config.description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Business Name</p>
            <p className="text-sm text-muted-foreground">{kycData.business_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Contact Email</p>
            <p className="text-sm text-muted-foreground">{kycData.contact_email}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Phone Number</p>
            <p className="text-sm text-muted-foreground">{kycData.contact_phone}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Submitted</p>
            <p className="text-sm text-muted-foreground">
              {new Date(kycData.submitted_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {kycData.review_notes && (
          <Alert>
            <AlertDescription>
              <strong>Review Notes:</strong> {kycData.review_notes}
            </AlertDescription>
          </Alert>
        )}

        {kycData.status === 'REJECTED' && !maxKYCReviewReached && (
          <Button onClick={onStartKYC} className="w-full">
            Update Information
          </Button>
        )}
      </CardContent>
    </Card>
  );
};