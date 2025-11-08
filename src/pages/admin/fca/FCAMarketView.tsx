import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMarkets } from '@/hooks/useMarkets';
import { Briefcase, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const FCAMarketView = () => {
  const navigate = useNavigate();
  const { data: markets, isLoading } = useMarkets();

  const publishedMarkets = markets?.filter(m => m.status === 'PUBLISHED') || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Field Collections Agent</h1>
          <p className="text-muted-foreground mt-1">Select a market to start offline booking</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Briefcase className="h-4 w-4 mr-2" />
          FCA Mode
        </Badge>
      </div>

      {publishedMarkets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Markets</h3>
            <p className="text-muted-foreground">There are no published markets available for booking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {publishedMarkets.map((market) => (
            <Card key={market.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/admin/fca/markets/${market.id}`)}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{market.name}</span>
                  <Badge variant={market.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                    {market.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start:</span>
                    <span className="font-medium">{format(new Date(market.start_at), 'PPP')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End:</span>
                    <span className="font-medium">{format(new Date(market.end_at), 'PPP')}</span>
                  </div>
                  {market.theme && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Theme:</span>
                      <span className="font-medium capitalize">{market.theme}</span>
                    </div>
                  )}
                </div>
                <Button className="w-full" onClick={() => navigate(`/admin/fca/markets/${market.id}`)}>
                  View Stalls
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FCAMarketView;
