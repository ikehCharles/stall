import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useCreateCred, usePlatformSettings, useSaveSingleSetting, PlatformSettings } from "@/hooks/useSettings";
import { useConfirm } from "@/components/ui/confirmDialog";

const Settings = () => {
  const { data: settingsData, isLoading, error } = usePlatformSettings();
  const saveSingleSetting = useSaveSingleSetting();
  const createCredentials = useCreateCred();
  const confirm = useConfirm();
  const [zettleWebhookUrl, setZettleWebhookUrl] = useState("");

  // Local state for form fields (initialized from fetched data)
  const [settings, setSettings] = useState<PlatformSettings>({
    depositPercentage: 50,
    platformFee: 5,
    autoConfirmBookings: true,
    emailNotifications: true,
    smsNotifications: false,
    maxStallsPerVendor: 10,
    minBookings: 1,
    minBookingsActive: true,
    bookingExpiration: 5,
    bookingExpirationActive: true,
    cancellationWindow: 48,
    refundPolicy:
      "Cancellations made 48 hours before the event are eligible for full refund minus processing fees.",
    termsAndConditions:
      "By booking a stall, vendors agree to follow all marketplace guidelines and policies.",
  });

  // Track original settings to detect changes
  const originalSettingsRef = useRef<PlatformSettings>({ ...settings });

  // Update local state when data is fetched
  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
      originalSettingsRef.current = { ...settingsData };
    }
  }, [settingsData]);

  const handleChange = (field: keyof PlatformSettings, value: string | number | boolean | "") => {
    // Allow empty strings for number fields (will be validated on blur)
    // Convert empty string to 0 for number fields to maintain type safety
    const finalValue = value === "" && typeof settings[field] === "number" ? 0 : value;
    setSettings((prev) => ({ ...prev, [field]: finalValue as PlatformSettings[keyof PlatformSettings] }));
  };

  const handleBlur = async (field: keyof PlatformSettings) => {
    const currentValue = settings[field];
    const originalValue = originalSettingsRef.current[field];

    // Check if value is empty/invalid and revert immediately
    const isStringField = typeof originalValue === "string";
    const isNumberField = typeof originalValue === "number";
    
    // Check for empty string fields
    if (isStringField && (currentValue === "" || currentValue === null || currentValue === undefined)) {
      // Revert empty string fields to original value
      setSettings((prev) => ({ ...prev, [field]: originalValue }));
      return;
    }
    
    // Check for empty/invalid number fields
    // For number fields, check if value is 0 (which represents empty) AND original is not 0
    // Also check for null, undefined, or NaN
    if (isNumberField) {
      const isCurrentValueEmpty = currentValue === 0 && originalValue !== 0;
      const isInvalid = currentValue === null || currentValue === undefined || isNaN(currentValue as number);
      if (isCurrentValueEmpty || isInvalid) {
        // Revert empty/invalid number fields to original value
        setSettings((prev) => ({ ...prev, [field]: originalValue }));
        return;
      }
    }

    // Check if value has changed
    if (currentValue === originalValue) {
      return; // No changes, skip saving
    }

    // Get field label for confirmation message
    const fieldLabels: Record<keyof PlatformSettings, string> = {
      depositPercentage: "Required Deposit",
      platformFee: "Platform Fee",
      autoConfirmBookings: "Auto-confirm Bookings",
      emailNotifications: "Email Notifications",
      smsNotifications: "SMS Notifications",
      maxStallsPerVendor: "Max Stalls per Vendor",
      minBookings: "Minimum Bookings for Pay Later",
      minBookingsActive: "Minimum Bookings (Active)",
      bookingExpiration: "Booking Expiration",
      bookingExpirationActive: "Booking Expiration (Active)",
      cancellationWindow: "Cancellation Window",
      refundPolicy: "Refund Policy",
      termsAndConditions: "Terms and Conditions",
    };

    const fieldLabel = fieldLabels[field] || field;

    // Show confirmation dialog
    const confirmed = await confirm({
      title: "Confirm Setting Change",
      description: `Are you sure you want to change "${fieldLabel}" from "${originalValue}" to "${currentValue}"?`,
      confirmText: "Save",
      cancelText: "Cancel",
    });

    if (!confirmed) {
      // Revert to original value
      setSettings((prev) => ({ ...prev, [field]: originalValue }));
      return;
    }

    // Save the setting
    try {
      const payload: { key: keyof PlatformSettings; value: string | number | boolean; isActive?: boolean } = {
        key: field,
        value: currentValue,
      };
      if (field === "minBookings") payload.isActive = settings.minBookingsActive;
      if (field === "bookingExpiration") payload.isActive = settings.bookingExpirationActive;
      await saveSingleSetting.mutateAsync(payload);

      // Update original settings ref
      originalSettingsRef.current = { ...originalSettingsRef.current, [field]: currentValue };

      toast({
        title: "Setting Updated",
        description: `${fieldLabel} has been successfully updated.`,
      });
    } catch (error) {
      // Revert on error
      setSettings((prev) => ({ ...prev, [field]: originalValue }));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save setting.",
        variant: "destructive",
      });
    }
  };

  const handleSwitchChange = async (field: keyof PlatformSettings, checked: boolean) => {
    const originalValue = originalSettingsRef.current[field];

    // Update state immediately for UI responsiveness
    handleChange(field, checked);

    // Check if value has changed
    if (checked === originalValue) {
      return; // No changes, skip saving
    }

    // Get field label for confirmation message
    const fieldLabels: Record<keyof PlatformSettings, string> = {
      depositPercentage: "Required Deposit",
      platformFee: "Platform Fee",
      autoConfirmBookings: "Auto-confirm Bookings",
      emailNotifications: "Email Notifications",
      smsNotifications: "SMS Notifications",
      maxStallsPerVendor: "Max Stalls per Vendor",
      minBookings: "Minimum Bookings for Pay Later",
      minBookingsActive: "Minimum Bookings (Active)",
      bookingExpiration: "Booking Expiration",
      bookingExpirationActive: "Booking Expiration (Active)",
      cancellationWindow: "Cancellation Window",
      refundPolicy: "Refund Policy",
      termsAndConditions: "Terms and Conditions",
    };

    const fieldLabel = fieldLabels[field] || field;

    // Show confirmation dialog
    const confirmed = await confirm({
      title: "Confirm Setting Change",
      description: `Are you sure you want to ${checked ? "enable" : "disable"} "${fieldLabel}"?`,
      confirmText: "Save",
      cancelText: "Cancel",
    });

    if (!confirmed) {
      // Revert to original value
      setSettings((prev) => ({ ...prev, [field]: originalValue }));
      return;
    }

    // Save the setting
    try {
      if (field === "minBookingsActive") {
        await saveSingleSetting.mutateAsync({
          key: "minBookings",
          value: settings.minBookings,
          isActive: checked,
        });
      } else if (field === "bookingExpirationActive") {
        await saveSingleSetting.mutateAsync({
          key: "bookingExpiration",
          value: settings.bookingExpiration,
          isActive: checked,
        });
      } else {
        await saveSingleSetting.mutateAsync({
          key: field,
          value: checked,
        });
      }

      // Update original settings ref
      originalSettingsRef.current = { ...originalSettingsRef.current, [field]: checked };

      toast({
        title: "Setting Updated",
        description: `${fieldLabel} has been ${checked ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      // Revert on error
      setSettings((prev) => ({ ...prev, [field]: originalValue }));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save setting.",
        variant: "destructive",
      });
    }
  };

  const saveZettleWebhook = async () => {
    if(!zettleWebhookUrl) return;
    const webhookUrlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    if (!webhookUrlRegex.test(zettleWebhookUrl)) {
      setZettleWebhookUrl('')
      toast({
        title: "Invalid URL",
        description: "Please enter a valid webhook URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createCredentials.mutateAsync({
        source: "zettle",
        key: "webhook_signing_key",
        meta: {
          url: zettleWebhookUrl,
        },
      });
      toast({
        title: "Webhook URL Saved",
        description: "Zettle webhook URL has been successfully saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save webhook URL.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure platform settings and policies
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure platform settings and policies
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-red-500">
            Error loading settings: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure platform settings and policies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Settings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">💰</span>
              Payment Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="deposit">Required Deposit (%)</Label>
              <Input
                id="deposit"
                type="number"
                value={settings.depositPercentage === 0 ? "" : settings.depositPercentage}
                onChange={(e) =>
                  handleChange("depositPercentage", e.target.value === "" ? "" : Number(e.target.value))
                }
                onBlur={() => handleBlur("depositPercentage")}
                min="0"
                max="100"
              />
              <p className="text-sm text-gray-600">
                Percentage of total booking that must be paid upfront
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformFee">Platform Fee (%)</Label>
              <Input
                id="platformFee"
                type="number"
                value={settings.platformFee === 0 ? "" : settings.platformFee}
                onChange={(e) =>
                  handleChange("platformFee", e.target.value === "" ? "" : Number(e.target.value))
                }
                onBlur={() => handleBlur("platformFee")}
                min="0"
                max="50"
              />
              <p className="text-sm text-gray-600">
                Commission charged on each booking
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancellationWindow">
                Cancellation Window (hours)
              </Label>
              <Input
                id="cancellationWindow"
                type="number"
                value={settings.cancellationWindow === 0 ? "" : settings.cancellationWindow}
                onChange={(e) =>
                  handleChange("cancellationWindow", e.target.value === "" ? "" : Number(e.target.value))
                }
                onBlur={() => handleBlur("cancellationWindow")}
                min="1"
              />
              <p className="text-sm text-gray-600">
                Minimum hours before event for cancellations
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Booking Settings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">🏪</span>
              Booking Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="maxStalls">Max Stalls per Vendor</Label>
              <Input
                id="maxStalls"
                type="number"
                value={settings.maxStallsPerVendor === 0 ? "" : settings.maxStallsPerVendor}
                onChange={(e) =>
                  handleChange("maxStallsPerVendor", e.target.value === "" ? "" : Number(e.target.value))
                }
                onBlur={() => handleBlur("maxStallsPerVendor")}
                min="1"
              />
              <p className="text-sm text-gray-600">
                Maximum number of stalls one vendor can book
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minBookings">Minimum Bookings for Pay Later</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="minBookingsActive"
                  checked={settings.minBookingsActive}
                  onCheckedChange={(c) =>
                    handleSwitchChange("minBookingsActive", c === true)
                  }
                />
               
                <Input
                  id="minBookings"
                  type="number"
                  value={settings.minBookings === 0 ? "" : settings.minBookings}
                  onChange={(e) =>
                    handleChange("minBookings", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  onBlur={() => handleBlur("minBookings")}
                  min="1"
                />
              </div>
              <p className="text-sm text-gray-600">
                Minimum number of bookings before pay later is available for all vendors
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookingExpiration">Booking Expiration (minutes)</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bookingExpirationActive"
                  checked={settings.bookingExpirationActive}
                  onCheckedChange={(c) =>
                    handleSwitchChange("bookingExpirationActive", c === true)
                  }
                />
                <Input
                  id="bookingExpiration"
                  type="number"
                  value={settings.bookingExpiration === 0 ? "" : settings.bookingExpiration}
                  onChange={(e) =>
                    handleChange("bookingExpiration", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  onBlur={() => handleBlur("bookingExpiration")}
                  min="1"
                />
              </div>
              <p className="text-sm text-gray-600">
                Minutes an unpaid booking is reserved before expiring
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoConfirm">Auto-confirm Bookings</Label>
                <p className="text-sm text-gray-600">
                  Automatically confirm bookings upon payment
                </p>
              </div>
              <Switch
                id="autoConfirm"
                checked={settings.autoConfirmBookings}
                onCheckedChange={(checked) =>
                  handleSwitchChange("autoConfirmBookings", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">🔔</span>
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <p className="text-sm text-gray-600">
                  Send booking confirmations via email
                </p>
              </div>
              <Switch
                id="emailNotifications"
                checked={settings.emailNotifications}
                onCheckedChange={(checked) =>
                  handleSwitchChange("emailNotifications", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="smsNotifications">SMS Notifications</Label>
                <p className="text-sm text-gray-600">
                  Send booking confirmations via SMS
                </p>
              </div>
              <Switch
                id="smsNotifications"
                checked={settings.smsNotifications}
                onCheckedChange={(checked) =>
                  handleSwitchChange("smsNotifications", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Policy Settings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">📋</span>
              Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="refundPolicy">Refund Policy</Label>
              <Textarea
                id="refundPolicy"
                value={settings.refundPolicy}
                onChange={(e) => handleChange("refundPolicy", e.target.value)}
                onBlur={() => handleBlur("refundPolicy")}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
              <Textarea
                id="termsAndConditions"
                value={settings.termsAndConditions}
                onChange={(e) =>
                  handleChange("termsAndConditions", e.target.value)
                }
                onBlur={() => handleBlur("termsAndConditions")}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Integration Settings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="mr-2">📋</span>
              Integration Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-col gap-2 w-full">
              <Label htmlFor="refundPolicy">Zettle Webhook Url</Label>
              <Input
              className="w-full"
                id="maxStalls"
                value={zettleWebhookUrl}
                onChange={(e) => {
                  setZettleWebhookUrl(e.target.value);
                }}
                onBlur={saveZettleWebhook}
              />
              </div>
            </div>

            
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


export default Settings;