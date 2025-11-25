import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Briefcase, Calendar, Search, ArrowLeft, Camera } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isPast } from "date-fns";
import { useFetchBookingDetails } from "@/hooks/useBookings";
import { ScanModal } from "@/components/shared/ScanModal";

const FCAMarketView = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: markets, isLoading } = useMarkets();
  const filteredMarkets = markets?.filter((market) => {
    const matchesSearch =
      !searchQuery ||
      market.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const activeMarkets = filteredMarkets?.filter(
    (market) =>
      market.status === "PUBLISHED" && !isPast(new Date(market.end_at))
  );

  const closedMarkets = filteredMarkets?.filter(
    (market) => market.status === "DRAFT" || isPast(new Date(market.end_at))
  );

 

  const renderMarketCards = (marketList: typeof markets) => {
    if (!marketList || marketList.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Markets Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try a different search term"
                  : "No markets available"}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {marketList.map((market) => {
          const isActive =
            market.status === "PUBLISHED" && !isPast(new Date(market.end_at));
          const isClosed =
            market.status === "DRAFT" || isPast(new Date(market.end_at));

          return (
            <Card key={market.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{market.name}</CardTitle>
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Active" : "Closed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(market.start_at), "MMM d")} -{" "}
                      {format(new Date(market.end_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  {market.theme && (
                    <div className="text-muted-foreground">
                      Theme:{" "}
                      <span className="font-medium capitalize">
                        {market.theme}
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={() => navigate(`/admin/fca/markets/${market.id}`)}
                  disabled={isClosed}
                >
                  {isClosed ? "View Details" : "View Stalls"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">
              Field Collections Agent
            </h1>
            <Badge variant="outline">
              <Briefcase className="h-4 w-4 mr-2" />
              FCA Mode
            </Badge>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/admin")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit FCA Mode
          </Button>
        </div>

        <div className="flex justify-between items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search markets by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeMarkets?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed ({closedMarkets?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {renderMarketCards(activeMarkets)}
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {renderMarketCards(closedMarkets)}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default FCAMarketView;
