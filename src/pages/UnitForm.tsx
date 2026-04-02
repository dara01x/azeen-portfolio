import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ImageUpload";
import { mockUnits, mockProjects, mockPropertyTypes } from "@/data/mock";
import type { Unit } from "@/types";

const defaultUnit: Omit<Unit, "id"> = {
  project_id: "", title: "", type_id: "", status: "available",
  price: 0, currency: "USD", payment_type: "cash",
  area_size: 0, bedrooms: 0, bathrooms: 0, floor_number: 1, images: [],
};

const UnitForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockUnits.find(u => u.id === id) : undefined;
  const [form, setForm] = useState<Omit<Unit, "id">>(existing ? { ...existing } : defaultUnit);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild><Link to="/units"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Unit" : "Create Unit"}</h1>
      </div>
      <div className="grid gap-4 max-w-4xl">
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>Project</Label>
              <Select value={form.project_id} onValueChange={v => update("project_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} /></div>
            <div><Label>Type</Label>
              <Select value={form.type_id} onValueChange={v => update("type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{mockPropertyTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="sold">Sold</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><Label>Price</Label><Input type="number" value={form.price || ""} onChange={e => update("price", Number(e.target.value))} /></div>
            <div><Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => update("currency", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="IQD">IQD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Payment Type</Label>
              <Select value={form.payment_type} onValueChange={v => update("payment_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="installment">Installment</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div><Label>Area Size (m²)</Label><Input type="number" value={form.area_size || ""} onChange={e => update("area_size", Number(e.target.value))} /></div>
            <div><Label>Bedrooms</Label><Input type="number" value={form.bedrooms || ""} onChange={e => update("bedrooms", Number(e.target.value))} /></div>
            <div><Label>Bathrooms</Label><Input type="number" value={form.bathrooms || ""} onChange={e => update("bathrooms", Number(e.target.value))} /></div>
            <div><Label>Floor Number</Label><Input type="number" value={form.floor_number || ""} onChange={e => update("floor_number", Number(e.target.value))} /></div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Media</CardTitle></CardHeader>
          <CardContent><ImageUpload images={form.images} onChange={imgs => update("images", imgs)} /></CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
          <CardContent><Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} rows={3} /></CardContent>
        </Card>
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link to="/units">Cancel</Link></Button>
          <Button onClick={() => navigate("/units")}>{isEdit ? "Save Changes" : "Create Unit"}</Button>
        </div>
      </div>
    </div>
  );
};

export default UnitForm;
