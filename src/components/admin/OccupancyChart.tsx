import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useStallOccupancy } from "@/hooks/useStallOccupancy";

export const OccupancyChart = () => {
  const { data, isLoading } = useStallOccupancy();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stall Occupancy</CardTitle>
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
          <span className="mr-2">🏪</span>
          Stall Occupancy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Occupancy Rate</span>
            <span className="font-medium text-foreground">{data?.occupancyRate.toFixed(1)}%</span>
          </div>
          
          <Progress value={data?.occupancyRate || 0} className="h-3" />
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{data?.bookedStalls}</div>
              <div className="text-sm text-muted-foreground">Booked</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-foreground">{data?.availableStalls}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
