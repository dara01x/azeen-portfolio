import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import { mockSettings } from "@/data/mock";

const SettingsPage = () => {
  const [settings, setSettings] = useState(mockSettings);

  return (
    <div>
      <PageHeader title="Settings" description="Configure system permissions and preferences" />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Permissions</CardTitle>
            <CardDescription>Control what company users can do in the system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex items-center justify-between py-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Allow companies to create properties</Label>
                <p className="text-sm text-muted-foreground">Companies will be able to add new property listings</p>
              </div>
              <Switch checked={settings.allow_company_create_properties} onCheckedChange={v => setSettings(s => ({ ...s, allow_company_create_properties: v }))} />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Allow companies to edit properties</Label>
                <p className="text-sm text-muted-foreground">Companies will be able to modify their assigned properties</p>
              </div>
              <Switch checked={settings.allow_company_edit_properties} onCheckedChange={v => setSettings(s => ({ ...s, allow_company_edit_properties: v }))} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
