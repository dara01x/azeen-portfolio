import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockUsers } from "@/data/mock";
import type { User } from "@/types";

const defaultUser: Omit<User, "id"> = {
  full_name: "", email: "", role: "manager", status: "active", phone: "",
};

const UserForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockUsers.find(u => u.id === id) : undefined;
  const [form, setForm] = useState<Omit<User, "id">>(existing ? { ...existing } : defaultUser);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild><Link to="/users"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit User" : "Create User"}</h1>
      </div>
      <div className="grid gap-4 max-w-2xl">
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">User Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Full Name</Label><Input value={form.full_name} onChange={e => update("full_name", e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => update("email", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => update("phone", e.target.value)} /></div>
            <div><Label>Role</Label>
              <Select value={form.role} onValueChange={v => update("role", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        {form.role === "company" && (
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Company Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Company Name</Label><Input value={form.company_name || ""} onChange={e => update("company_name", e.target.value)} /></div>
              <div><Label>Company Phone</Label><Input value={form.company_phone || ""} onChange={e => update("company_phone", e.target.value)} /></div>
              <div><Label>Company Address</Label><Input value={form.company_address || ""} onChange={e => update("company_address", e.target.value)} /></div>
            </CardContent>
          </Card>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link to="/users">Cancel</Link></Button>
          <Button onClick={() => navigate("/users")}>{isEdit ? "Save Changes" : "Create User"}</Button>
        </div>
      </div>
    </div>
  );
};

export default UserForm;
