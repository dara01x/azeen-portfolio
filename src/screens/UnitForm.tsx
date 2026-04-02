import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUpload } from "@/components/ImageUpload";
import { mockUnits, mockProjects, mockPropertyTypes } from "@/data/mock";
import type { Unit } from "@/types";

const defaultUnit: Omit<Unit, "id"> = {
  project_id: "", title: "", type_id: "", status: "available",
  price: 0, currency: "USD", payment_type: "cash",
  area_size: 0, bedrooms: 0, bathrooms: 0, floor_number: 1, images: [],
};

const FormSection = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-4"><CardTitle className="text-base">{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const UnitForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockUnits.find(u => u.id === id) : undefined;
  const [form, setForm] = useState<Omit<Unit, "id">>(existing ? { ...existing } : defaultUnit);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild><Link href="/units"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Unit" : "Create Unit"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in the details for this unit</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/units">Cancel</Link></Button>
          <Button onClick={() => router.push("/units")}>{isEdit ? "Save Changes" : "Create Unit"}</Button>
        </div>
      </div>
      <div className="grid gap-6 max-w-4xl">
        <FormSection title="Basic Information">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>Project</Label>
              <Select value={form.project_id} onValueChange={v => update("project_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} /></div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={form.type_id} onValueChange={v => update("type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{mockPropertyTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="sold">Sold</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>
        <FormSection title="Pricing">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2"><Label>Price</Label><Input type="number" value={form.price || ""} onChange={e => update("price", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => update("currency", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="IQD">IQD</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Payment Type</Label>
              <Select value={form.payment_type} onValueChange={v => update("payment_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="installment">Installment</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>
        <FormSection title="Details">
          <div className="grid gap-5 sm:grid-cols-4">
            <div className="space-y-2"><Label>Area Size (m²)</Label><Input type="number" value={form.area_size || ""} onChange={e => update("area_size", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Bedrooms</Label><Input type="number" value={form.bedrooms || ""} onChange={e => update("bedrooms", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Bathrooms</Label><Input type="number" value={form.bathrooms || ""} onChange={e => update("bathrooms", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Floor Number</Label><Input type="number" value={form.floor_number || ""} onChange={e => update("floor_number", Number(e.target.value))} /></div>
          </div>
        </FormSection>
        <FormSection title="Media">
          <ImageUpload images={form.images} onChange={imgs => update("images", imgs)} />
        </FormSection>
        <FormSection title="Internal Notes">
          <Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} rows={4} placeholder="Add any internal notes..." />
        </FormSection>
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" asChild><Link href="/units">Cancel</Link></Button>
          <Button onClick={() => router.push("/units")} size="lg">{isEdit ? "Save Changes" : "Create Unit"}</Button>
        </div>
      </div>
    </div>
  );
};

export default UnitForm;
