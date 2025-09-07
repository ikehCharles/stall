import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { format } from "date-fns";

const MarketSelection = () => {
  const { data: markets, isLoading, error } = useMarkets();

  // Only show published markets for vendor booking
  const publishedMarkets = markets?.filter(market => market.status === 'PUBLISHED') || [];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Available Markets</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Available Markets</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error loading markets. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Available Markets</h1>
        <p className="text-muted-foreground mt-1">Choose a market to book your stalls</p>
      </div>

      {publishedMarkets.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Markets Available</h3>
              <p className="text-gray-600">There are currently no published markets available for booking.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publishedMarkets.map((market) => (
            <Card key={market.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl">{market.name}</CardTitle>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {market.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  {format(new Date(market.start_at), "PPP")} - {format(new Date(market.end_at), "PPP")}
                </div>

                {market.banner_url && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <img 
                      src={market.banner_url} 
                      alt={`${market.name} banner`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <Button asChild className="w-full">
                  <Link to={`/vendor/book-stall/${market.id}`}>
                    View Stalls & Book
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketSelection;