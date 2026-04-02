import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockClients } from "@/data/mock";
import type { Client } from "@/types";

const defaultClient: Omit<Client, "id"> = {
  full_name: "", primary_phone: "", status: "active",
};

const ClientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockClients.find(c => c.id === id) : undefined;
  const [form, setForm] = useState<Omit<Client, "id">>(existing ? { ...existing } : defaultClient);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild><Link to="/clients"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Client" : "Create Client"}</h1>
      </div>
      <div className="grid gap-4 max-w-2xl">
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Full Name</Label><Input value={form.full_name} onChange={e => update("full_name", e.target.value)} /></div>
            <div><Label>Primary Phone</Label><Input value={form.primary_phone} onChange={e => update("primary_phone", e.target.value)} /></div>
            <div><Label>Secondary Phone</Label><Input value={form.secondary_phone || ""} onChange={e => update("secondary_phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={e => update("email", e.target.value)} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={e => update("notes", e.target.value)} rows={3} /></div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link to="/clients">Cancel</Link></Button>
          <Button onClick={() => navigate("/clients")}>{isEdit ? "Save Changes" : "Create Client"}</Button>
        </div>
      </div>
    </div>
  );
};

export default ClientForm;
