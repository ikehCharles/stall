import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { kycStorage, type KYCData } from '@/lib/localStorage';

interface KYCFormProps {
  vendorId: string;
  existingKYC?: KYCData;
  onSubmit?: () => void;
}

export const KYCForm = ({ vendorId, existingKYC, onSubmit }: KYCFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    businessName: existingKYC?.businessName || '',
    email: existingKYC?.contactDetails.email || '',
    phone: existingKYC?.contactDetails.phone || '',
    address: existingKYC?.contactDetails.address || '',
    idDocument: null as File | null,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      setFormData(prev => ({ ...prev, idDocument: file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.businessName || !formData.email || !formData.phone || !formData.address) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert file to base64 for storage
      let idDocumentBase64 = '';
      if (formData.idDocument) {
        const reader = new FileReader();
        idDocumentBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(formData.idDocument!);
        });
      }

      const kycData = {
        vendorId,
        businessName: formData.businessName,
        contactDetails: {
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
        },
        idDocumentUpload: idDocumentBase64,
        status: 'PENDING' as const,
        submittedAt: new Date().toISOString(),
      };

      if (existingKYC) {
        kycStorage.update(existingKYC.id, kycData);
        toast({
          title: "KYC Updated",
          description: "Your business information has been updated and is under review",
        });
      } else {
        kycStorage.add(kycData);
        toast({
          title: "KYC Submitted",
          description: "Your business information has been submitted for review",
        });
      }

      onSubmit?.();
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReadOnly = existingKYC?.status === 'APPROVED' || existingKYC?.status === 'PENDING';

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Business Verification (KYC)</CardTitle>
        <CardDescription>
          Please provide your business information to start booking stalls. All information will be verified before approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter your business name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Business Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isReadOnly}
                placeholder="business@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                disabled={isReadOnly}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Business Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              disabled={isReadOnly}
              placeholder="Enter your complete business address"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idDocument">ID Document Upload</Label>
            <Input
              id="idDocument"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={isReadOnly}
            />
            <p className="text-sm text-muted-foreground">
              Upload a business license, tax ID, or government-issued business registration (Max 5MB)
            </p>
          </div>

          {existingKYC && (
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2">Submission Status</h4>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  existingKYC.status === 'APPROVED' ? 'bg-green-500' :
                  existingKYC.status === 'PENDING' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="capitalize font-medium">{existingKYC.status.toLowerCase()}</span>
              </div>
              {existingKYC.reviewNotes && (
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Review Notes:</strong> {existingKYC.reviewNotes}
                </p>
              )}
            </div>
          )}

          {!isReadOnly && (
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Submitting...' : existingKYC ? 'Update Information' : 'Submit for Review'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
};