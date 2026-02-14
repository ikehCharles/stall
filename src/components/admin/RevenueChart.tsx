import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenueData } from "@/hooks/useRevenueData";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";

export const RevenueChart = () => {
  const { data, isLoading } = useRevenueData(30);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <span className="mr-2">💰</span>
          Revenue Trends (Last 30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer 
          config={{ 
            revenue: { 
              label: "Gross Revenue", 
              color: "hsl(var(--primary))" 
            },
            vat: {
              label: "VAT",
              color: "#f97316"
            },
            net: {
              label: "Net Revenue",
              color: "#22c55e"
            }
          }}
          className="aspect-auto h-48 sm:h-64 md:h-80 w-full"
        >
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => formatCurrency(value)}
              width={60}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              type="monotone" 
              dataKey="vat" 
              stroke="#f97316" 
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={{ fill: "#f97316", r: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="net" 
              stroke="#22c55e" 
              strokeWidth={1.5}
              dot={{ fill: "#22c55e", r: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
