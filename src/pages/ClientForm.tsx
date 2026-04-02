import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { mockClients } from "@/data/mock";
import type { Client } from "@/types";

const defaultClient: Omit<Client, "id"> = { full_name: "", primary_phone: "", status: "active" };

const ClientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockClients.find(c => c.id === id) : undefined;
  const [form, setForm] = useState<Omit<Client, "id">>(existing ? { ...existing } : defaultClient);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild><Link to="/clients"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Client" : "Create Client"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{isEdit ? "Update client information" : "Add a new client to your database"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/clients">Cancel</Link></Button>
          <Button onClick={() => navigate("/clients")}>{isEdit ? "Save Changes" : "Create Client"}</Button>
        </div>
      </div>
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">Client Information</CardTitle><CardDescription>Personal and contact details</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={e => update("full_name", e.target.value)} /></div>
            <div className="space-y-2"><Label>Primary Phone</Label><Input value={form.primary_phone} onChange={e => update("primary_phone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Secondary Phone</Label><Input value={form.secondary_phone || ""} onChange={e => update("secondary_phone", e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email || ""} onChange={e => update("email", e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={e => update("notes", e.target.value)} rows={4} placeholder="Any notes about this client..." /></div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" asChild><Link to="/clients">Cancel</Link></Button>
          <Button onClick={() => navigate("/clients")} size="lg">{isEdit ? "Save Changes" : "Create Client"}</Button>
        </div>
      </div>
    </div>
  );
};

export default ClientForm;
