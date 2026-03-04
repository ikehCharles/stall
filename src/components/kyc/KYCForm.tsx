import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isValidPhoneNumber } from 'libphonenumber-js';
import { KYCApplication } from "@/hooks/useKYCAnalytics";

interface KYCFormProps {
  onSubmit?: () => void;
  existingKYC?: Partial<KYCApplication>;
  externalUserId?: string;
  partialUpload?: boolean
}

export const KYCForm = ({ onSubmit, existingKYC, externalUserId }: KYCFormProps) => {
  
  const [formData, setFormData] = useState({
    businessName: "",
    contactEmail: "",
    contactPhone: "",
    businessType: "",
    businessAddress: "",
    taxId: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { user, userProfile } = useAuth();

  // Initialize form with existing KYC data or user profile defaults
  useEffect(() => {
    if (existingKYC) {
      // Load existing KYC data (draft or pending)
      const initialData = {
        businessName: existingKYC.business_name || "",
        contactEmail: existingKYC.contact_email || "",
        contactPhone: existingKYC.contact_phone || "",
        businessType: existingKYC.business_type || "",
        businessAddress: existingKYC.business_address || "",
        taxId: existingKYC.tax_id || ""
      };
      setFormData(initialData);
    } else if (userProfile) {
      // Pre-populate with profile data for first-time users
      setFormData(prev => ({
        ...prev,
        contactEmail: userProfile.email || "",
        contactPhone: userProfile.phone_number || ""
      }));
    }
  }, [existingKYC, userProfile]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {

// if external (on user creation) or logged in user (vendor creation)
    const userId = externalUserId || user.id

    e.preventDefault();
    
    if (!user) {
      setError("You must be logged in to submit verification");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.contactEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    // Validate phone number if provided
    if (formData.contactPhone && !isValidPhoneNumber(formData.contactPhone)) {
      setError("Please enter a valid phone number");
      return;
    }

    // Check if KYC is approved (view-only mode)
    if (existingKYC?.status === 'APPROVED') {
      setError("Your KYC is already approved and cannot be modified");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Check if KYC application already exists
      const { data: existingKYCData, error: fetchError } = await supabase
        .from('kyc_applications')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing KYC:', fetchError);
        throw new Error('Failed to check existing verification data');
      }

      if (existingKYCData) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('kyc_applications')
          .update({
            business_name: formData.businessName,
            contact_email: formData.contactEmail,
            contact_phone: formData.contactPhone,
            business_type: formData.businessType || null,
            business_address: formData.businessAddress || null,
            tax_id: formData.taxId || null,
            status: 'PENDING'
          })
          .eq('id', existingKYCData.id);

        if (updateError) {
          console.error('Error updating KYC data:', updateError);
          throw new Error('Failed to update verification data');
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('kyc_applications')
          .insert({
            user_id: userId,
            business_name: formData.businessName,
            contact_email: formData.contactEmail,
            contact_phone: formData.contactPhone,
            business_type: formData.businessType || null,
            business_address: formData.businessAddress || null,
            tax_id: formData.taxId || null,
            status: 'PENDING'
          });

        if (insertError) {
          console.error('Error inserting KYC data:', insertError);
          throw new Error('Failed to submit verification data');
        }
      }

      onSubmit?.();
    } catch (error) {
      setError(error.message || "Failed to submit verification");
      toast.error(error.message || "Failed to submit verification");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Business Verification (KYC)</CardTitle>
        <CardDescription>
          {existingKYC?.status === 'APPROVED' ? 
            'Your business verification has been approved.' :
            'Please provide your business information to start booking stalls. All information will be verified before approval.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {existingKYC?.status === 'APPROVED' ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800">Verification Complete</h3>
              <p className="text-sm text-green-700 mt-1">
                Your business information has been verified and approved.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Business Name</Label>
                <p className="font-medium">{existingKYC.business_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Contact Email</Label>
                <p className="font-medium">{existingKYC.contact_email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Phone Number</Label>
                <p className="font-medium">{existingKYC.contact_phone}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Business Type</Label>
                <p className="font-medium">{existingKYC.business_type || 'Not specified'}</p>
              </div>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              placeholder="Enter your business name"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                placeholder="business@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone Number *</Label>
              <PhoneInput
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(value) => handleInputChange('contactPhone', value)}
                placeholder="Enter your phone number"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessType">Business Type</Label>
            <Select 
              value={formData.businessType}
              onValueChange={(value) => handleInputChange('businessType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                <SelectItem value="services">Services</SelectItem>
                <SelectItem value="crafts">Arts & Crafts</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAddress">Business Address</Label>
            <Textarea
              id="businessAddress"
              value={formData.businessAddress}
              onChange={(e) => handleInputChange('businessAddress', e.target.value)}
              placeholder="Enter your complete business address"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxId">Tax ID / Registration Number</Label>
            <Input
              id="taxId"
              value={formData.taxId}
              onChange={(e) => handleInputChange('taxId', e.target.value)}
              placeholder="Enter your tax ID or business registration number"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "Submit for Verification"}
          </Button>
        </form>
        )}
      </CardContent>
    </Card>
  );
};