import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, User, Mail, Phone, Building, AlertCircle } from 'lucide-react';
import { useVendorLookup, VendorLookupResult } from '@/hooks/useVendorLookup';
import { Loader2 } from 'lucide-react';

interface VendorLookupProps {
  onVendorFound: (vendor: VendorLookupResult) => void;
  onVendorNotFound: () => void;
}

export const VendorLookup = ({ onVendorFound, onVendorNotFound }: VendorLookupProps) => {
  const [email, setEmail] = useState('');
  const vendorLookup = useVendorLookup();

  const handleSearch = () => {
    if (!email.trim()) return;
    
    vendorLookup.mutate(email, {
      onSuccess: (vendor) => {
        if (vendor) {
          onVendorFound(vendor);
        } else {
          onVendorNotFound();
        }
      }
    });
  };

  const getKycStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default';
      case 'PENDING': return 'secondary';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="email"
            placeholder="Enter vendor email..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            disabled={vendorLookup.isPending}
          />
        </div>
        <Button 
          onClick={handleSearch}
          disabled={!email.trim() || vendorLookup.isPending}
        >
          {vendorLookup.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {vendorLookup.isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Failed to lookup vendor. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {vendorLookup.isSuccess && vendorLookup.data && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Vendor Found
              </h4>
              <Badge variant={getKycStatusColor(vendorLookup.data.kyc_status)}>
                KYC: {vendorLookup.data.kyc_status}
              </Badge>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{vendorLookup.data.full_name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{vendorLookup.data.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{vendorLookup.data.phone_number || 'N/A'}</span>
              </div>
              {vendorLookup.data.company_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-3 w-3" />
                  <span>{vendorLookup.data.company_name}</span>
                </div>
              )}
            </div>

            {vendorLookup.data.has_unpaid_bookings && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
                Has Unpaid Bookings
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {vendorLookup.isSuccess && !vendorLookup.data && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No vendor found with email: <strong>{email}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Scenario C (new vendor registration) is not available in this MVP.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
