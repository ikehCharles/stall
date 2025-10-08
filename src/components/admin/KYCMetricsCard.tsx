import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKYCAnalytics } from "@/hooks/useKYCAnalytics";

export const KYCMetricsCard = () => {
  const { data, isLoading } = useKYCAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>KYC Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <span className="mr-2">🪪</span>
          KYC Applications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{data?.approvalRate}%</div>
            <div className="text-sm text-muted-foreground">Approval Rate</div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{data?.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{data?.approved}</div>
              <div className="text-xs text-muted-foreground">Approved</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{data?.rejected}</div>
              <div className="text-xs text-muted-foreground">Rejected</div>
            </div>
          </div>
          
          <div className="text-center pt-2 border-t border-border">
            <div className="text-sm text-muted-foreground">Total Applications</div>
            <div className="text-2xl font-bold text-foreground">{data?.total}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
