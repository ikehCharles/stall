import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { type KYCData } from '@/lib/localStorage';

interface KYCStatusProps {
  kycData: KYCData | null;
  onStartKYC?: () => void;
}

export const KYCStatus = ({ kycData, onStartKYC }: KYCStatusProps) => {
  if (!kycData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Business verification required to start booking stalls</span>
          <Button onClick={onStartKYC} size="sm">
            Start Verification
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusConfig = (status: KYCData['status']) => {
    switch (status) {
      case 'APPROVED':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          badgeVariant: 'default' as const,
          title: 'Verification Approved',
          description: 'Your business has been verified. You can now book stalls.',
        };
      case 'PENDING':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          badgeVariant: 'secondary' as const,
          title: 'Under Review',
          description: 'Your submission is being reviewed. This usually takes 1-2 business days.',
        };
      case 'REJECTED':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          badgeVariant: 'destructive' as const,
          title: 'Verification Rejected',
          description: 'Please review the notes below and resubmit your information.',
        };
    }
  };

  const config = getStatusConfig(kycData.status);
  const StatusIcon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            Business Verification Status
          </CardTitle>
          <Badge variant={config.badgeVariant}>
            {kycData.status}
          </Badge>
        </div>
        <CardDescription>
          {config.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Business Name:</span>
              <div className="text-muted-foreground">{kycData.businessName}</div>
            </div>
            <div>
              <span className="font-medium">Contact Email:</span>
              <div className="text-muted-foreground">{kycData.contactDetails.email}</div>
            </div>
            <div>
              <span className="font-medium">Phone:</span>
              <div className="text-muted-foreground">{kycData.contactDetails.phone}</div>
            </div>
            <div>
              <span className="font-medium">Submitted:</span>
              <div className="text-muted-foreground">
                {new Date(kycData.submittedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {kycData.reviewNotes && (
            <Alert>
              <AlertDescription>
                <strong>Review Notes:</strong> {kycData.reviewNotes}
              </AlertDescription>
            </Alert>
          )}

          {kycData.status === 'REJECTED' && (
            <Button onClick={onStartKYC} className="w-full">
              Update Information
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};