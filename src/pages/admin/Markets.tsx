import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Eye, Edit, Archive, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMarkets, useUpdateMarket } from '@/hooks/useMarkets';
import { MarketDialog } from '@/components/admin/MarketDialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PERMISSIONS } from '@/lib/permissions';
import { PermissionGate } from '@/components/PermissionGate';

const Markets = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState(null);
  const { data: markets, isLoading } = useMarkets();
  const updateMarket = useUpdateMarket();

  const handleStatusChange = async (marketId: string, newStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    try {
      await updateMarket.mutateAsync({ id: marketId, status: newStatus });
      toast({
        title: 'Market Updated',
        description: `Market status changed to ${newStatus.toLowerCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update market status',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-primary text-primary-foreground';
      case 'DRAFT': return 'bg-secondary text-secondary-foreground';
      case 'ARCHIVED': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading markets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Markets</h1>
          <p className="text-muted-foreground mt-1">Manage your marketplace events</p>
        </div>
        <PermissionGate permissions={[PERMISSIONS.MARKETS.MANAGE]}>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Market
        </Button>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            All Markets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {markets && markets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <PermissionGate permissions={[PERMISSIONS.MARKETS.MANAGE]}>

                  <TableHead>Actions</TableHead>
                  </PermissionGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {markets.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell className="font-medium">{market.name}</TableCell>
                    <TableCell className="capitalize">{market.theme}</TableCell>
                    <TableCell>
                      {format(new Date(market.start_at), 'MMM dd')} - {format(new Date(market.end_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(market.status)}>
                        {market.status}
                      </Badge>
                    </TableCell>
                    <PermissionGate permissions={[PERMISSIONS.MARKETS.MANAGE]}>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMarket(market)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/markets/${market.id}/canvas`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {market.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(market.id, 'PUBLISHED')}
                            title="Publish market"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {market.status === 'PUBLISHED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(market.id, 'DRAFT')}
                            title="Unpublish market"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {market.status !== 'ARCHIVED' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(market.id, 'ARCHIVED')}
                            title="Archive market"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(market.id, 'DRAFT')}
                            title="Unarchive market"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    </PermissionGate>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No markets created yet</p>
              <p className="text-sm">Create your first market to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      <MarketDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => setIsCreateDialogOpen(false)}
      />

      <MarketDialog
        open={!!editingMarket}
        onOpenChange={(open) => !open && setEditingMarket(null)}
        market={editingMarket}
        onSuccess={() => setEditingMarket(null)}
      />
    </div>
  );
};

export default Markets;