import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ImageUpload";
import { mockProjects, mockCities, mockUsers } from "@/data/mock";
import type { Project } from "@/types";

const defaultProject: Omit<Project, "id"> = {
  title: "", description: "", status: "active", city_id: "", area: "", address: "",
  total_units: 0, available_units: 0, images: [], has_units: false, internal_notes: "",
};

const ProjectForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id && id !== "new";
  const existing = isEdit ? mockProjects.find(p => p.id === id) : undefined;
  const [form, setForm] = useState<Omit<Project, "id">>(existing ? { ...existing } : defaultProject);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const companies = mockUsers.filter(u => u.role === "company");

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild><Link to="/projects"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Project" : "Create Project"}</h1>
      </div>
      <div className="grid gap-4 max-w-4xl">
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.has_units} onCheckedChange={v => update("has_units", v)} />
              <Label>Has Units</Label>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Location</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>City</Label>
              <Select value={form.city_id} onValueChange={v => update("city_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{mockCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Area</Label><Input value={form.area} onChange={e => update("area", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => update("address", e.target.value)} /></div>
            <div><Label>Latitude</Label><Input type="number" step="any" value={form.lat || ""} onChange={e => update("lat", Number(e.target.value))} /></div>
            <div><Label>Longitude</Label><Input type="number" step="any" value={form.lng || ""} onChange={e => update("lng", Number(e.target.value))} /></div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Units</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>Total Units</Label><Input type="number" value={form.total_units || ""} onChange={e => update("total_units", Number(e.target.value))} /></div>
            <div><Label>Available Units</Label><Input type="number" value={form.available_units || ""} onChange={e => update("available_units", Number(e.target.value))} /></div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Media</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div><Label>Images</Label><ImageUpload images={form.images} onChange={imgs => update("images", imgs)} /></div>
            <div><Label>Video URL</Label><Input value={form.video_url || ""} onChange={e => update("video_url", e.target.value)} placeholder="https://youtube.com/..." /></div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Assignment</CardTitle></CardHeader>
          <CardContent>
            <div><Label>Assigned Company</Label>
              <Select value={form.assigned_company_id || ""} onValueChange={v => update("assigned_company_id", v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
          <CardContent><Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} rows={3} /></CardContent>
        </Card>
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild><Link to="/projects">Cancel</Link></Button>
          <Button onClick={() => navigate("/projects")}>{isEdit ? "Save Changes" : "Create Project"}</Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectForm;
