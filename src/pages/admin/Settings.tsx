
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const [settings, setSettings] = useState({
    depositPercentage: 50,
    platformFee: 5,
    autoConfirmBookings: true,
    emailNotifications: true,
    smsNotifications: false,
    maxStallsPerVendor: 10,
    cancellationWindow: 48,
    refundPolicy: "Cancellations made 48 hours before the event are eligible for full refund minus processing fees.",
    termsAndConditions: "By booking a stall, vendors agree to follow all marketplace guidelines and policies."
  });

  const handleSave = () => {
    toast({
      title: "Settings Updated",
      description: "Your platform settings have been successfully saved."
    });
  };

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure platform settings and policies</p>
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
                value={settings.depositPercentage}
                onChange={(e) => handleChange('depositPercentage', Number(e.target.value))}
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
                value={settings.platformFee}
                onChange={(e) => handleChange('platformFee', Number(e.target.value))}
                min="0"
                max="50"
              />
              <p className="text-sm text-gray-600">
                Commission charged on each booking
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancellationWindow">Cancellation Window (hours)</Label>
              <Input
                id="cancellationWindow"
                type="number"
                value={settings.cancellationWindow}
                onChange={(e) => handleChange('cancellationWindow', Number(e.target.value))}
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
                value={settings.maxStallsPerVendor}
                onChange={(e) => handleChange('maxStallsPerVendor', Number(e.target.value))}
                min="1"
              />
              <p className="text-sm text-gray-600">
                Maximum number of stalls one vendor can book
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
                onCheckedChange={(checked) => handleChange('autoConfirmBookings', checked)}
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
                onCheckedChange={(checked) => handleChange('emailNotifications', checked)}
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
                onCheckedChange={(checked) => handleChange('smsNotifications', checked)}
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
                onChange={(e) => handleChange('refundPolicy', e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
              <Textarea
                id="termsAndConditions"
                value={settings.termsAndConditions}
                onChange={(e) => handleChange('termsAndConditions', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;
