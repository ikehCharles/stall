import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X } from "lucide-react";
import { KYCForm } from "@/components/kyc/KYCForm";
import { KYCStatus } from "@/components/kyc/KYCStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";

const VendorProfile = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "personal";
  const { userProfile, refreshProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission(PERMISSIONS.USERS.MANAGE);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    company_name: "",
    address: ""
  });
  const [businessLogo, setBusinessLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [kycData, setKycData] = useState<any>(null);
  const [kycLoading, setKycLoading] = useState(true);
  const [showKYCForm, setShowKYCForm] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setProfile({
        full_name: userProfile.full_name || "",
        email: userProfile.email || "",
        phone_number: userProfile.phone_number || "",
        company_name: userProfile.company_name || "",
        address: userProfile.address || ""
      });
      setBusinessLogo(userProfile.business_logo_url || null);
    }
  }, [userProfile]);

  useEffect(() => {
    loadKYCData();
  }, [userProfile]);

  const loadKYCData = async () => {
    if (!userProfile?.id) return;
    
    setKycLoading(true);
    try {
      const { data, error } = await supabase
        .from('kyc_applications')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setKycData(data);
    } catch (error) {
      console.error('Error loading KYC data:', error);
    } finally {
      setKycLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let logoUrl = businessLogo;

      if (logoFile && userProfile?.id) {
        setUploading(true);
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${userProfile.id}/logo.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('business-logos')
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('business-logos')
          .getPublicUrl(fileName);
        
        logoUrl = data.publicUrl;
        setUploading(false);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          company_name: profile.company_name,
          address: profile.address,
          business_logo_url: logoUrl
        })
        .eq('id', userProfile?.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      setLogoFile(null);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated."
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 5MB",
          variant: "destructive"
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setBusinessLogo(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setBusinessLogo(null);
    setLogoFile(null);
  };

  const handleKYCSubmit = async () => {
    await loadKYCData();
    await refreshProfile();
    setShowKYCForm(false);
  };

  const handleStartKYC = () => {
    setShowKYCForm(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account information and business verification</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <TabsTrigger value="personal">Personal Information</TabsTrigger>
          {!isAdmin && <TabsTrigger value="verification">Business Verification</TabsTrigger>}
        </TabsList>

        <TabsContent value="personal" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={saving || uploading}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Edit Profile"
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Business Logo</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="w-32 h-32 mx-auto mb-4 flex items-center justify-center border rounded-lg overflow-hidden bg-muted">
                    {businessLogo ? (
                      <img 
                        src={businessLogo} 
                        alt="Business logo" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="bg-gradient-to-br from-primary to-primary/80 w-full h-full flex items-center justify-center text-primary-foreground text-2xl font-bold">
                        {profile.full_name ? profile.full_name.split(' ').map(n => n[0]).join('') : '?'}
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <Button variant="outline" size="sm" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              {businessLogo ? 'Change Logo' : 'Upload Logo'}
                            </span>
                          </Button>
                        </label>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </div>
                      {businessLogo && (
                        <Button variant="outline" size="sm" onClick={removeLogo}>
                          <X className="mr-2 h-4 w-4" />
                          Remove Logo
                        </Button>
                      )}
                      {uploading && (
                        <p className="text-sm text-muted-foreground">
                          <Loader2 className="inline mr-1 h-3 w-3 animate-spin" />
                          Uploading...
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={profile.full_name}
                        onChange={(e) => handleChange('full_name', e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        disabled={true}
                        className="opacity-60"
                      />
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone_number">Phone Number</Label>
                      <Input
                        id="phone_number"
                        value={profile.phone_number}
                        onChange={(e) => handleChange('phone_number', e.target.value)}
                        disabled={!isEditing}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        value={profile.company_name}
                        onChange={(e) => handleChange('company_name', e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={profile.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      disabled={!isEditing}
                      rows={3}
                      placeholder="Enter your complete business address"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {!isAdmin && (
          <TabsContent value="verification" className="space-y-6 mt-6">
          {kycLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : showKYCForm ? (
            <KYCForm onSubmit={handleKYCSubmit} />
          ) : kycData ? (
            <div className="space-y-4">
              <KYCStatus onStartKYC={handleStartKYC} kycData={kycData} />
              {kycData.status !== 'APPROVED' && kycData.status !== 'REJECTED' && (
                <div className="flex justify-center">
                  <Button onClick={handleStartKYC}>
                    Update Information
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Business Verification Required</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  To book stalls and access all vendor features, you need to complete business verification.
                </p>
                <Button onClick={handleStartKYC}>
                  Start Verification
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default VendorProfile;
