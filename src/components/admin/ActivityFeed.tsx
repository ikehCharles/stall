import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityFeed } from "@/hooks/useActivityFeed";

export const ActivityFeed = () => {
  const { data: activities, isLoading } = useActivityFeed(20);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'booking': return '📋';
      case 'kyc': return '🪪';
      case 'payment': return '💳';
      default: return '•';
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('completed') || statusLower.includes('approved') || statusLower.includes('paid') || statusLower.includes('success')) {
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400';
    }
    if (statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400';
    }
    if (statusLower.includes('cancelled') || statusLower.includes('rejected') || statusLower.includes('failed')) {
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400';
    }
    return 'bg-muted text-muted-foreground';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <span className="mr-2">🕒</span>
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {activities?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity
              </div>
            ) : (
              activities?.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <span className="text-xl">{getActivityIcon(activity.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {activity.actor}
                    </p>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={getStatusColor(activity.status)}>
                    {activity.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
