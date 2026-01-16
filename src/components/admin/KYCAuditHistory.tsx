import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useKYCAuditHistory } from '@/hooks/useKYCAuditHistory';

interface AuditEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  reviewed_by: string | null;
  reason: string | null;
  created_at: string;
  reviewer_name?: string;
}

interface KYCAuditHistoryProps {
  kycId: string;
}

export function KYCAuditHistory({ kycId }: KYCAuditHistoryProps) {
  const {data: auditHistory, isLoading:loading} = useKYCAuditHistory(kycId);


  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'default';
      case 'REJECTED':
        return 'destructive';
      case 'PENDING':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Review History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Review History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!auditHistory?.length ? (
          <p className="text-sm text-muted-foreground">No review history available</p>
        ) : (
          <div className="space-y-4">
            {auditHistory.map((entry) => (
              <div key={entry.id} className="flex items-start space-x-3 pb-4 border-b last:border-0">
                <div className="flex-shrink-0 p-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {entry.from_status && (
                      <>
                        <Badge variant={getStatusBadgeVariant(entry.from_status)} className="text-xs">
                          {entry.from_status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">→</span>
                      </>
                    )}
                    <Badge variant={getStatusBadgeVariant(entry.to_status)} className="text-xs">
                      {entry.to_status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    by {entry.reviewer_name} • {format(new Date(entry.created_at), 'MMM d, y h:mm a')}
                  </p>
                  {entry.reason && (
                    <p className="text-sm mt-1 p-2 bg-muted rounded text-muted-foreground">
                      "{entry.reason}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}