import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Eye, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { kycStorage, type KYCData } from '@/lib/localStorage';

export const KYCReview = () => {
  const [kycApplications, setKycApplications] = useState<KYCData[]>([]);
  const [selectedKYC, setSelectedKYC] = useState<KYCData | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadKYCApplications();
  }, []);

  const loadKYCApplications = () => {
    const applications = kycStorage.getAll();
    setKycApplications(applications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
  };

  const handleViewKYC = (kyc: KYCData) => {
    setSelectedKYC(kyc);
    setReviewNotes(kyc.reviewNotes || '');
    setIsReviewDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedKYC) return;

    kycStorage.update(selectedKYC.id, {
      status: 'APPROVED',
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes.trim() || undefined,
    });

    toast({
      title: "KYC Approved",
      description: `${selectedKYC.businessName} has been approved for stall booking`,
    });

    loadKYCApplications();
    setIsReviewDialogOpen(false);
    setSelectedKYC(null);
    setReviewNotes('');
  };

  const handleReject = () => {
    if (!selectedKYC) return;

    if (!reviewNotes.trim()) {
      toast({
        title: "Review Notes Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    kycStorage.update(selectedKYC.id, {
      status: 'REJECTED',
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes.trim(),
    });

    toast({
      title: "KYC Rejected",
      description: `${selectedKYC.businessName} application has been rejected`,
    });

    loadKYCApplications();
    setIsReviewDialogOpen(false);
    setSelectedKYC(null);
    setReviewNotes('');
  };

  const getStatusBadge = (status: KYCData['status']) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  const pendingCount = kycApplications.filter(kyc => kyc.status === 'PENDING').length;
  const approvedCount = kycApplications.filter(kyc => kyc.status === 'APPROVED').length;
  const rejectedCount = kycApplications.filter(kyc => kyc.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KYC Applications</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve vendor business verification applications
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Applications</CardTitle>
          <CardDescription>
            Manage vendor business verification applications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kycApplications.map((kyc) => (
                <TableRow key={kyc.id}>
                  <TableCell className="font-medium">{kyc.businessName}</TableCell>
                  <TableCell>{kyc.contactDetails.email}</TableCell>
                  <TableCell>{kyc.contactDetails.phone}</TableCell>
                  <TableCell>{new Date(kyc.submittedAt).toLocaleDateString()}</TableCell>
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

          {kycApplications.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No KYC applications found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review KYC Application</DialogTitle>
            <DialogDescription>
              Review the business information and approve or reject the application
            </DialogDescription>
          </DialogHeader>

          {selectedKYC && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Business Name</Label>
                  <p className="text-sm text-muted-foreground">{selectedKYC.businessName}</p>
                </div>
                <div>
                  <Label className="font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedKYC.status)}</div>
                </div>
                <div>
                  <Label className="font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{selectedKYC.contactDetails.email}</p>
                </div>
                <div>
                  <Label className="font-medium">Phone</Label>
                  <p className="text-sm text-muted-foreground">{selectedKYC.contactDetails.phone}</p>
                </div>
              </div>

              <div>
                <Label className="font-medium">Business Address</Label>
                <p className="text-sm text-muted-foreground mt-1">{selectedKYC.contactDetails.address}</p>
              </div>

              {selectedKYC.idDocumentUpload && (
                <div>
                  <Label className="font-medium">ID Document</Label>
                  <div className="mt-2 p-4 border rounded-lg">
                    {selectedKYC.idDocumentUpload.startsWith('data:image') ? (
                      <img 
                        src={selectedKYC.idDocumentUpload} 
                        alt="ID Document" 
                        className="max-w-full h-auto max-h-64 object-contain"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Document uploaded</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="reviewNotes">Review Notes</Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your review decision..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
              Cancel
            </Button>
            {selectedKYC?.status === 'PENDING' && (
              <>
                <Button variant="destructive" onClick={handleReject}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button onClick={handleApprove}>
                  <CheckCircle className="h-4 w-4 mr-1" />
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