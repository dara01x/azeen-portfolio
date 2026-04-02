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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { MultilingualInput } from "@/components/MultilingualInput";
import { ImageUpload } from "@/components/ImageUpload";
import { mockProperties, mockPropertyTypes, mockCities, mockAmenities, mockViews, mockProjects, mockClients, mockUsers } from "@/data/mock";
import type { Property } from "@/types";

const defaultProperty: Omit<Property, "id"> = {
  title: "", type_id: "", listing_type: "sale", status: "available",
  price: 0, currency: "USD", payment_type: "cash",
  city_id: "", area: "", address_en: "", address_ku: "", address_ar: "",
  area_size: 0, bedrooms: 0, bathrooms: 0, floors: 1, condition: "new",
  amenities: [], description_en: "", description_ku: "", description_ar: "",
  images: [], internal_notes: "",
};

const FormSection = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-4">
      <CardTitle className="text-base">{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const PropertyForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockProperties.find(p => p.id === id) : undefined;
  const [form, setForm] = useState<Omit<Property, "id">>(existing ? { ...existing } : defaultProperty);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const companies = mockUsers.filter(u => u.role === "company");

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Property" : "Create Property"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in the details below to {isEdit ? "update" : "create"} a property listing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/properties">Cancel</Link></Button>
          <Button onClick={() => router.push("/properties")}>{isEdit ? "Save Changes" : "Create Property"}</Button>
        </div>
      </div>

      <div className="grid gap-6 max-w-4xl">
        <FormSection title="Basic Information" description="Core details about the property">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g. Luxury Apartment in Downtown" /></div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={form.type_id} onValueChange={v => update("type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{mockPropertyTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Listing Type</Label>
              <Select value={form.listing_type} onValueChange={v => update("listing_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sale">Sale</SelectItem><SelectItem value="rent">Rent</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="sold">Sold</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Condition</Label>
              <Select value={form.condition} onValueChange={v => update("condition", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="used">Used</SelectItem><SelectItem value="under_construction">Under Construction</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Pricing" description="Set the price and payment terms">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2"><Label>Price</Label><Input type="number" value={form.price || ""} onChange={e => update("price", Number(e.target.value))} placeholder="0" /></div>
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

        <FormSection title="Location" description="Where is this property located?">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>City</Label>
              <Select value={form.city_id} onValueChange={v => update("city_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{mockCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Area</Label><Input value={form.area} onChange={e => update("area", e.target.value)} placeholder="e.g. Downtown" /></div>
            <div className="sm:col-span-2">
              <MultilingualInput label="Address" values={{ en: form.address_en, ku: form.address_ku, ar: form.address_ar }} onChange={v => { update("address_en", v.en); update("address_ku", v.ku); update("address_ar", v.ar); }} />
            </div>
            <Separator className="sm:col-span-2" />
            <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={form.lat || ""} onChange={e => update("lat", Number(e.target.value))} placeholder="36.204824" /></div>
            <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={form.lng || ""} onChange={e => update("lng", Number(e.target.value))} placeholder="44.009167" /></div>
          </div>
        </FormSection>

        <FormSection title="Property Details" description="Physical characteristics">
          <div className="grid gap-5 sm:grid-cols-4">
            <div className="space-y-2"><Label>Area Size (m²)</Label><Input type="number" value={form.area_size || ""} onChange={e => update("area_size", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Bedrooms</Label><Input type="number" value={form.bedrooms || ""} onChange={e => update("bedrooms", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Bathrooms</Label><Input type="number" value={form.bathrooms || ""} onChange={e => update("bathrooms", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Floors</Label><Input type="number" value={form.floors || ""} onChange={e => update("floors", Number(e.target.value))} /></div>
          </div>
        </FormSection>

        <FormSection title="Features & Amenities" description="What does this property offer?">
          <div className="space-y-5">
            <div className="space-y-2"><Label>View</Label>
              <Select value={form.view_id || ""} onValueChange={v => update("view_id", v)}>
                <SelectTrigger className="sm:w-1/2"><SelectValue placeholder="Select view (optional)" /></SelectTrigger>
                <SelectContent>{mockViews.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Separator />
            <div>
              <Label className="mb-3 block">Amenities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mockAmenities.map(a => (
                  <label key={a.id} className="flex items-center gap-2.5 text-sm rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                    <Checkbox checked={form.amenities.includes(a.id)} onCheckedChange={(c) => {
                      update("amenities", c ? [...form.amenities, a.id] : form.amenities.filter(id => id !== a.id));
                    }} />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Building Info" description="Building-specific details (optional)">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>Building Name</Label><Input value={form.building_name || ""} onChange={e => update("building_name", e.target.value)} /></div>
            <div className="space-y-2"><Label>Land Number</Label><Input value={form.land_number || ""} onChange={e => update("land_number", e.target.value)} /></div>
            <div className="space-y-2"><Label>Total Floors</Label><Input type="number" value={form.total_floors || ""} onChange={e => update("total_floors", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Unit Floor Number</Label><Input type="number" value={form.unit_floor_number || ""} onChange={e => update("unit_floor_number", Number(e.target.value))} /></div>
          </div>
        </FormSection>

        <FormSection title="Description" description="Property description in multiple languages">
          <MultilingualInput label="Description" multiline values={{ en: form.description_en, ku: form.description_ku, ar: form.description_ar }} onChange={v => { update("description_en", v.en); update("description_ku", v.ku); update("description_ar", v.ar); }} />
        </FormSection>

        <FormSection title="Media" description="Upload images and add video links">
          <div className="space-y-5">
            <div><Label className="mb-3 block">Images</Label><ImageUpload images={form.images} onChange={imgs => update("images", imgs)} /></div>
            <Separator />
            <div className="space-y-2"><Label>Video URL (YouTube)</Label><Input value={form.video_url || ""} onChange={e => update("video_url", e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
          </div>
        </FormSection>

        <FormSection title="Relations" description="Link to project, client, or company">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2"><Label>Project</Label>
              <Select value={form.project_id || ""} onValueChange={v => update("project_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Owner Client</Label>
              <Select value={form.owner_client_id || ""} onValueChange={v => update("owner_client_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{mockClients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Assigned Company</Label>
              <Select value={form.assigned_company_id || ""} onValueChange={v => update("assigned_company_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Internal Notes" description="Private notes not visible to clients">
          <Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} placeholder="Add any internal notes here..." rows={4} />
        </FormSection>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" asChild><Link href="/properties">Cancel</Link></Button>
          <Button onClick={() => router.push("/properties")} size="lg">{isEdit ? "Save Changes" : "Create Property"}</Button>
        </div>
      </div>
    </div>
  );
};

export default PropertyForm;
