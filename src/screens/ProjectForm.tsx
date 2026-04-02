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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ImageUpload";
import { mockProjects, mockCities, mockUsers } from "@/data/mock";
import type { Project } from "@/types";

const defaultProject: Omit<Project, "id"> = {
  title: "", description: "", status: "active", city_id: "", area: "", address: "",
  total_units: 0, available_units: 0, images: [], has_units: false, internal_notes: "",
};

const FormSection = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-4"><CardTitle className="text-base">{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const ProjectForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockProjects.find(p => p.id === id) : undefined;
  const [form, setForm] = useState<Omit<Project, "id">>(existing ? { ...existing } : defaultProject);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const companies = mockUsers.filter(u => u.role === "company");

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild><Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Project" : "Create Project"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in the details to {isEdit ? "update" : "create"} a project</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
          <Button onClick={() => router.push("/projects")}>{isEdit ? "Save Changes" : "Create Project"}</Button>
        </div>
      </div>
      <div className="grid gap-6 max-w-4xl">
        <FormSection title="Basic Information" description="Core project details">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.has_units} onCheckedChange={v => update("has_units", v)} />
              <Label>Has Units</Label>
            </div>
          </div>
        </FormSection>
        <FormSection title="Location">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>City</Label>
              <Select value={form.city_id} onValueChange={v => update("city_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{mockCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Area</Label><Input value={form.area} onChange={e => update("area", e.target.value)} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => update("address", e.target.value)} /></div>
            <Separator className="sm:col-span-2" />
            <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={form.lat || ""} onChange={e => update("lat", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={form.lng || ""} onChange={e => update("lng", Number(e.target.value))} /></div>
          </div>
        </FormSection>
        <FormSection title="Units">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>Total Units</Label><Input type="number" value={form.total_units || ""} onChange={e => update("total_units", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>Available Units</Label><Input type="number" value={form.available_units || ""} onChange={e => update("available_units", Number(e.target.value))} /></div>
          </div>
        </FormSection>
        <FormSection title="Media">
          <div className="space-y-5">
            <div><Label className="mb-3 block">Images</Label><ImageUpload images={form.images} onChange={imgs => update("images", imgs)} /></div>
            <Separator />
            <div className="space-y-2"><Label>Video URL</Label><Input value={form.video_url || ""} onChange={e => update("video_url", e.target.value)} placeholder="https://youtube.com/..." /></div>
          </div>
        </FormSection>
        <FormSection title="Assignment">
          <div className="space-y-2 sm:w-1/2"><Label>Assigned Company</Label>
            <Select value={form.assigned_company_id || ""} onValueChange={v => update("assigned_company_id", v)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </FormSection>
        <FormSection title="Internal Notes">
          <Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} rows={4} placeholder="Add any internal notes..." />
        </FormSection>
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
          <Button onClick={() => router.push("/projects")} size="lg">{isEdit ? "Save Changes" : "Create Project"}</Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectForm;
