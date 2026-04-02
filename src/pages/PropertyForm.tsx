import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MultilingualInput } from "@/components/MultilingualInput";
import { ImageUpload } from "@/components/ImageUpload";
import { PageHeader } from "@/components/PageHeader";
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

const PropertyForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockProperties.find(p => p.id === id) : undefined;
  const [form, setForm] = useState<Omit<Property, "id">>(existing ? { ...existing } : defaultProperty);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const companies = mockUsers.filter(u => u.role === "company");

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild><Link to="/properties"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Property" : "Create Property"}</h1>
      </div>
      <div className="grid gap-4 max-w-4xl">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} /></div>
            <div><Label>Type</Label>
              <Select value={form.type_id} onValueChange={v => update("type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{mockPropertyTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Listing Type</Label>
              <Select value={form.listing_type} onValueChange={v => update("listing_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sale">Sale</SelectItem><SelectItem value="rent">Rent</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="sold">Sold</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Condition</Label>
              <Select value={form.condition} onValueChange={v => update("condition", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="used">Used</SelectItem><SelectItem value="under_construction">Under Construction</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
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

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Location</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>City</Label>
              <Select value={form.city_id} onValueChange={v => update("city_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{mockCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Area</Label><Input value={form.area} onChange={e => update("area", e.target.value)} /></div>
            <div className="sm:col-span-2">
              <MultilingualInput label="Address" values={{ en: form.address_en, ku: form.address_ku, ar: form.address_ar }} onChange={v => { update("address_en", v.en); update("address_ku", v.ku); update("address_ar", v.ar); }} />
            </div>
            <div><Label>Latitude</Label><Input type="number" step="any" value={form.lat || ""} onChange={e => update("lat", Number(e.target.value))} /></div>
            <div><Label>Longitude</Label><Input type="number" step="any" value={form.lng || ""} onChange={e => update("lng", Number(e.target.value))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div><Label>Area Size (m²)</Label><Input type="number" value={form.area_size || ""} onChange={e => update("area_size", Number(e.target.value))} /></div>
            <div><Label>Bedrooms</Label><Input type="number" value={form.bedrooms || ""} onChange={e => update("bedrooms", Number(e.target.value))} /></div>
            <div><Label>Bathrooms</Label><Input type="number" value={form.bathrooms || ""} onChange={e => update("bathrooms", Number(e.target.value))} /></div>
            <div><Label>Floors</Label><Input type="number" value={form.floors || ""} onChange={e => update("floors", Number(e.target.value))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Features</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div><Label>View</Label>
              <Select value={form.view_id || ""} onValueChange={v => update("view_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select view (optional)" /></SelectTrigger>
                <SelectContent>{mockViews.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amenities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {mockAmenities.map(a => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.amenities.includes(a.id)} onCheckedChange={(c) => {
                      update("amenities", c ? [...form.amenities, a.id] : form.amenities.filter(id => id !== a.id));
                    }} />
                    {a.name}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Building Info</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>Building Name</Label><Input value={form.building_name || ""} onChange={e => update("building_name", e.target.value)} /></div>
            <div><Label>Land Number</Label><Input value={form.land_number || ""} onChange={e => update("land_number", e.target.value)} /></div>
            <div><Label>Total Floors</Label><Input type="number" value={form.total_floors || ""} onChange={e => update("total_floors", Number(e.target.value))} /></div>
            <div><Label>Unit Floor Number</Label><Input type="number" value={form.unit_floor_number || ""} onChange={e => update("unit_floor_number", Number(e.target.value))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent>
            <MultilingualInput label="Description" multiline values={{ en: form.description_en, ku: form.description_ku, ar: form.description_ar }} onChange={v => { update("description_en", v.en); update("description_ku", v.ku); update("description_ar", v.ar); }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Media</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div><Label>Images</Label><ImageUpload images={form.images} onChange={imgs => update("images", imgs)} /></div>
            <div><Label>Video URL (YouTube)</Label><Input value={form.video_url || ""} onChange={e => update("video_url", e.target.value)} placeholder="https://youtube.com/..." /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Relations</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><Label>Project</Label>
              <Select value={form.project_id || ""} onValueChange={v => update("project_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Owner Client</Label>
              <Select value={form.owner_client_id || ""} onValueChange={v => update("owner_client_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{mockClients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Assigned Company</Label>
              <Select value={form.assigned_company_id || ""} onValueChange={v => update("assigned_company_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} placeholder="Internal notes (not visible to clients)" rows={3} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link to="/properties">Cancel</Link></Button>
          <Button onClick={() => navigate("/properties")}>{isEdit ? "Save Changes" : "Create Property"}</Button>
        </div>
      </div>
    </div>
  );
};

export default PropertyForm;
