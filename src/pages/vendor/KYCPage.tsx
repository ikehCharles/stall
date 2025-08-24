import { useState, useEffect } from 'react';
import { KYCForm } from '@/components/kyc/KYCForm';
import { KYCStatus } from '@/components/kyc/KYCStatus';
import { kycStorage, type KYCData } from '@/lib/localStorage';

// Mock user context - in real app this would come from auth
const mockVendorId = 'vendor-1';

export const KYCPage = () => {
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const loadKYCData = () => {
      const data = kycStorage.getByVendorId(mockVendorId);
      setKycData(data || null);
      setShowForm(!data);
    };

    loadKYCData();
  }, []);

  const handleKYCSubmit = () => {
    // Reload KYC data after submission
    const updatedData = kycStorage.getByVendorId(mockVendorId);
    setKycData(updatedData || null);
    setShowForm(false);
  };

  const handleStartKYC = () => {
    setShowForm(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Business Verification</h1>
        <p className="text-muted-foreground mt-2">
          Complete your business verification to access stall booking features
        </p>
      </div>

      <div className="space-y-6">
        {!showForm && (
          <KYCStatus 
            kycData={kycData} 
            onStartKYC={handleStartKYC}
          />
        )}

        {showForm && (
          <div className="flex justify-center">
            <KYCForm 
              vendorId={mockVendorId}
              existingKYC={kycData || undefined}
              onSubmit={handleKYCSubmit}
            />
          </div>
        )}

        {kycData && !showForm && kycData.status !== 'REJECTED' && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowForm(true)}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Update information
            </button>
          </div>
        )}
      </div>
    </div>
  );
};