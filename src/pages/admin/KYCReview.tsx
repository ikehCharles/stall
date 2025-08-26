import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { KYCSearchFilter, type KYCFilters } from '@/components/admin/KYCSearchFilter';
import { KYCPagination } from '@/components/admin/KYCPagination';
import { KYCAuditHistory } from '@/components/admin/KYCAuditHistory';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface KYCApplication {
  id: string;
  user_id: string;
  business_name: string;
  contact_email: string;
  contact_phone: string;
  business_type: string | null;
  business_address: string | null;
  tax_id: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface KYCStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export const KYCReview = () => {
  const [applications, setApplications] = useState<KYCApplication[]>([]);
  const [selectedKYC, setSelectedKYC] = useState<KYCApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState<KYCStats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<KYCFilters>({
    search: '',
    status: 'all',
    dateFrom: null,
    dateTo: null,
  });

  const { toast } = useToast();
  const { user } = useAuth();

  // Load applications with filters and pagination
  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query
      let query = supabase
        .from('kyc_applications')
        .select(`
          *,
          profiles!user_id (
            full_name,
            email
          )
        `);

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status as 'PENDING' | 'APPROVED' | 'REJECTED');
      }

      if (filters.search) {
        query = query.or(`business_name.ilike.%${filters.search}%,contact_email.ilike.%${filters.search}%`);
      }

      if (filters.dateFrom) {
        query = query.gte('submitted_at', filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('submitted_at', toDate.toISOString());
      }

      // Get total count
      const { count } = await supabase
        .from('kyc_applications')
        .select('id', { count: 'exact', head: true });
      setTotalCount(count || 0);

      // Get paginated data
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await query
        .order('submitted_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Handle the data with proper type conversion
      const processedData = (data || []).map((item: any) => ({
        ...item,
        profiles: item.profiles && typeof item.profiles === 'object' && !('error' in item.profiles) 
          ? item.profiles 
          : null
      }));

      setApplications(processedData);
      
      // Calculate stats
      await loadStats();
    } catch (err) {
      console.error('Error loading KYC applications:', err);
      setError('Failed to load KYC applications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize]);

  // Load statistics
  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('kyc_applications')
        .select('status');

      if (error) throw error;

      const stats = {
        total: data.length,
        pending: data.filter(item => item.status === 'PENDING').length,
        approved: data.filter(item => item.status === 'APPROVED').length,
        rejected: data.filter(item => item.status === 'REJECTED').length,
      };

      setStats(stats);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  // Handle filters change
  const handleFiltersChange = (newFilters: KYCFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      dateFrom: null,
      dateTo: null,
    });
    setCurrentPage(1);
  };

  // Open review dialog
  const handleViewKYC = (kyc: KYCApplication) => {
    setSelectedKYC(kyc);
    setReviewNotes(kyc.review_notes || '');
    setIsReviewDialogOpen(true);
  };

  // Create audit log entry
  const createAuditEntry = async (kycId: string, fromStatus: string | null, toStatus: 'PENDING' | 'APPROVED' | 'REJECTED', reason?: string) => {
    try {
      const { error } = await supabase
        .from('kyc_audit_log')
        .insert([{
          kyc_id: kycId,
          from_status: fromStatus as 'PENDING' | 'APPROVED' | 'REJECTED' | null,
          to_status: toStatus,
          reviewed_by: user?.id,
          reason: reason || null,
        }]);

      if (error) throw error;
    } catch (err) {
      console.error('Error creating audit entry:', err);
    }
  };

  // Handle approval
  const handleApprove = async () => {
    if (!selectedKYC || !user) return;

    try {
      setActionLoading(true);
      
      const { error } = await supabase
        .from('kyc_applications')
        .update({
          status: 'APPROVED',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          review_notes: reviewNotes.trim() || null,
        })
        .eq('id', selectedKYC.id);

      if (error) throw error;

      // Create audit entry
      await createAuditEntry(selectedKYC.id, selectedKYC.status, 'APPROVED', reviewNotes.trim() || undefined);

      toast({
        title: "KYC Approved",
        description: `${selectedKYC.business_name} has been approved for stall booking`,
      });

      // Refresh data
      await loadApplications();
      setIsReviewDialogOpen(false);
      setSelectedKYC(null);
      setReviewNotes('');
    } catch (err) {
      console.error('Error approving KYC:', err);
      toast({
        title: "Error",
        description: "Failed to approve KYC application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle rejection
  const handleReject = async () => {
    if (!selectedKYC || !user) return;

    if (!reviewNotes.trim() || reviewNotes.trim().length < 10) {
      toast({
        title: "Review Notes Required",
        description: "Please provide a detailed reason for rejection (minimum 10 characters)",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading(true);
      
      const { error } = await supabase
        .from('kyc_applications')
        .update({
          status: 'REJECTED',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          review_notes: reviewNotes.trim(),
        })
        .eq('id', selectedKYC.id);

      if (error) throw error;

      // Create audit entry
      await createAuditEntry(selectedKYC.id, selectedKYC.status, 'REJECTED', reviewNotes.trim());

      toast({
        title: "KYC Rejected",
        description: `${selectedKYC.business_name} application has been rejected`,
      });

      // Refresh data
      await loadApplications();
      setIsReviewDialogOpen(false);
      setSelectedKYC(null);
      setReviewNotes('');
    } catch (err) {
      console.error('Error rejecting KYC:', err);
      toast({
        title: "Error",
        description: "Failed to reject KYC application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: KYCApplication['status']) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4" 
              onClick={() => loadApplications()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KYC Applications</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve vendor business verification applications
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <KYCSearchFilter
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Applications</CardTitle>
              <CardDescription>
                Manage vendor business verification applications
              </CardDescription>
            </div>
            <Button variant="outline" onClick={loadApplications} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[120px]" />
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-4 w-[80px]" />
                  <Skeleton className="h-8 w-[100px]" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Contact Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((kyc) => (
                    <TableRow key={kyc.id}>
                      <TableCell className="font-medium">
                        {kyc.profiles?.full_name || 'Unknown Vendor'}
                      </TableCell>
                      <TableCell>{kyc.business_name}</TableCell>
                      <TableCell>{kyc.contact_email}</TableCell>
                      <TableCell>{kyc.contact_phone}</TableCell>
                      <TableCell>{format(new Date(kyc.submitted_at), 'MMM d, y')}</TableCell>
                      <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewKYC(kyc)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {applications.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No KYC applications found matching your criteria
                </div>
              )}

              {/* Pagination */}
              {totalCount > 0 && (
                <div className="mt-4">
                  <KYCPagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(totalCount / pageSize)}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(newSize) => {
                      setPageSize(newSize);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review KYC Application</DialogTitle>
            <DialogDescription>
              Review the business information and approve or reject the application
            </DialogDescription>
          </DialogHeader>

          {selectedKYC && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-medium">Vendor Name</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedKYC.profiles?.full_name || 'Unknown Vendor'}
                    </p>
                  </div>
                  <div>
                    <Label className="font-medium">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedKYC.status)}</div>
                  </div>
                  <div>
                    <Label className="font-medium">Business Name</Label>
                    <p className="text-sm text-muted-foreground">{selectedKYC.business_name}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Business Type</Label>
                    <p className="text-sm text-muted-foreground">{selectedKYC.business_type || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Contact Email</Label>
                    <p className="text-sm text-muted-foreground">{selectedKYC.contact_email}</p>
                  </div>
                  <div>
                    <Label className="font-medium">Phone</Label>
                    <p className="text-sm text-muted-foreground">{selectedKYC.contact_phone}</p>
                  </div>
                </div>

                <div>
                  <Label className="font-medium">Business Address</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedKYC.business_address || 'Not provided'}
                  </p>
                </div>

                {selectedKYC.tax_id && (
                  <div>
                    <Label className="font-medium">Tax ID</Label>
                    <p className="text-sm text-muted-foreground mt-1">{selectedKYC.tax_id}</p>
                  </div>
                )}

                <div>
                  <Label className="font-medium">Submitted</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedKYC.submitted_at), 'MMMM d, y at h:mm a')}
                  </p>
                </div>

                <div>
                  <Label htmlFor="reviewNotes">Review Notes</Label>
                  <Textarea
                    id="reviewNotes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your review decision (required for rejection, minimum 10 characters)..."
                    className="mt-1"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {reviewNotes.length} characters
                  </p>
                </div>
              </div>

              <div className="lg:col-span-1">
                <KYCAuditHistory kycId={selectedKYC.id} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsReviewDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            {selectedKYC?.status === 'PENDING' && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={handleReject}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-1" />
                  )}
                  Reject
                </Button>
                <Button 
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};