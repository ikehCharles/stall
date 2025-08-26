import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KYCStatus } from "@/components/kyc/KYCStatus";
import { KYCForm } from "@/components/kyc/KYCForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface KYCApplication {
  id: string;
  business_name: string;
  contact_email: string;
  contact_phone: string;
  business_type?: string;
  business_address?: string;
  tax_id?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  review_notes?: string;
  submitted_at: string;
}

export const KYCPage = () => {
  const [kycData, setKycData] = useState<KYCApplication | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { user, refreshProfile } = useAuth();

  const loadKYCData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('kyc_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading KYC data:', error);
        toast.error('Failed to load verification status');
        return;
      }

      setKycData(data);
      setShowForm(!data);
    } catch (error) {
      console.error('Error loading KYC data:', error);
      toast.error('Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKYCData();
  }, [user]);

  const handleKYCSubmit = async () => {
    await loadKYCData();
    await refreshProfile();
    setShowForm(false);
    toast.success('Business verification submitted successfully!');
  };

  const handleStartKYC = () => {
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
              onSubmit={handleKYCSubmit} 
              existingKYC={kycData}
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