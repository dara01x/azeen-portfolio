import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
import { useAuth } from "@/lib/auth/useAuth";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import {
  createProject,
  getProjectById,
  updateProject,
  uploadProjectImageBlobUrls,
} from "@/modules/projects/project.client";
import type { Project } from "@/types";

const LocationPickerMap = dynamic(
  () => import("@/components/PropertyLocationMap").then((mod) => mod.PropertyLocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full rounded-lg border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

type CoordinatesValue = {
  lat: number;
  lng: number;
};

type LocalImageFileMap = Record<string, File>;

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitImageUrls(images: string[], localFilesByUrl: LocalImageFileMap) {
  const uploadedImages: string[] = [];
  const localBlobImages: string[] = [];

  images.forEach((image) => {
    if (!image) {
      return;
    }

    if (localFilesByUrl[image] || image.startsWith("blob:") || image.startsWith("data:")) {
      localBlobImages.push(image);
    } else {
      uploadedImages.push(image);
    }
  });

  return { uploadedImages, localBlobImages };
}

const defaultProject: Omit<Project, "id"> = {
  title: "",
  description: "",
  status: "active",
  city_id: "",
  area: "",
  address: "",
  total_units: 0,
  available_units: 0,
  images: [],
  has_units: false,
  internal_notes: "",
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
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const [form, setForm] = useState<Omit<Project, "id">>(defaultProject);
  const [loading, setLoading] = useState(isEdit);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [localImageFiles, setLocalImageFiles] = useState<LocalImageFileMap>({});
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const selectedCoordinates = useMemo<CoordinatesValue | null>(() => {
    if (
      typeof form.lat === "number" &&
      Number.isFinite(form.lat) &&
      typeof form.lng === "number" &&
      Number.isFinite(form.lng)
    ) {
      return { lat: form.lat, lng: form.lng };
    }

    return null;
  }, [form.lat, form.lng]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLookupsLoading(false);
      return;
    }

    let cancelled = false;
    setLookupsLoading(true);
    setLookupError(null);

    getVariables("cities")
      .then((cityItems) => {
        if (!cancelled) {
          setCities(cityItems);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message =
            fetchError instanceof Error ? fetchError.message : "Failed to load city variables.";
          setLookupError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLookupsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      setLocalImageFiles({});
      return;
    }

    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getProjectById(id)
      .then((project) => {
        if (cancelled) {
          return;
        }

        if (!project) {
          setError("Project not found.");
          return;
        }

        setLocalImageFiles({});
        const { id: _id, ...rest } = project;
        setForm({
          ...defaultProject,
          ...rest,
          has_units: typeof rest.has_units === "boolean" ? rest.has_units : false,
        });
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load project data.";
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, id, isEdit, user]);

  async function handleSubmit() {
    if (authLoading || !user) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const activeLocalFiles = Object.fromEntries(
        Object.entries(localImageFiles).filter(([imageUrl]) => form.images.includes(imageUrl)),
      ) as LocalImageFileMap;

      const { uploadedImages, localBlobImages } = splitImageUrls(form.images, activeLocalFiles);

      if (isEdit && id) {
        const newlyUploadedImages = await uploadProjectImageBlobUrls(id, localBlobImages, activeLocalFiles);
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        await updateProject(id, {
          ...form,
          images: allImages,
          main_image: allImages[0],
        });
      } else {
        const created = await createProject({
          ...form,
          images: uploadedImages,
          main_image: uploadedImages[0],
        });

        const newlyUploadedImages = await uploadProjectImageBlobUrls(
          created.id,
          localBlobImages,
          activeLocalFiles,
        );
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        if (allImages.length > 0) {
          await updateProject(created.id, {
            ...form,
            images: allImages,
            main_image: allImages[0],
          });
        }
      }

      Object.keys(activeLocalFiles).forEach((imageUrl) => {
        URL.revokeObjectURL(imageUrl);
      });

      setLocalImageFiles({});

      router.push("/projects");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save project.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

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
          <Button onClick={handleSubmit} disabled={saving || loading}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}</Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {lookupError && <p className="mb-4 text-sm text-destructive">{lookupError}</p>}

      {lookupsLoading ? (
        <p className="mb-4 text-sm text-muted-foreground">Loading app variables...</p>
      ) : null}

      {loading && isEdit ? (
        <p className="text-sm text-muted-foreground">Loading project data...</p>
      ) : (
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
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Area</Label><Input value={form.area} onChange={e => update("area", e.target.value)} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => update("address", e.target.value)} /></div>
            <Separator className="sm:col-span-2" />
            <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={form.lat ?? ""} onChange={e => update("lat", parseOptionalNumber(e.target.value))} /></div>
            <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={form.lng ?? ""} onChange={e => update("lng", parseOptionalNumber(e.target.value))} /></div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Map Location</Label>
              <LocationPickerMap
                coordinates={selectedCoordinates}
                onChange={(coordinates) => {
                  update("lat", coordinates.lat);
                  update("lng", coordinates.lng);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Click on the map to set the exact location. Latitude and longitude update automatically.
              </p>
            </div>
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
            <div>
              <Label className="mb-3 block">Images</Label>
              <ImageUpload
                images={form.images}
                onLocalFilesAdded={(entries) => {
                  setLocalImageFiles((prev) => {
                    const next = { ...prev };
                    entries.forEach((entry) => {
                      next[entry.url] = entry.file;
                    });
                    return next;
                  });
                }}
                onChange={(imgs) => {
                  const removedLocalUrls = form.images.filter(
                    (url) => url.startsWith("blob:") && !imgs.includes(url),
                  );

                  removedLocalUrls.forEach((imageUrl) => {
                    URL.revokeObjectURL(imageUrl);
                  });

                  setLocalImageFiles((prev) => {
                    const next: LocalImageFileMap = {};
                    imgs.forEach((imageUrl) => {
                      if (prev[imageUrl]) {
                        next[imageUrl] = prev[imageUrl];
                      }
                    });
                    return next;
                  });

                  update("images", imgs);
                }}
              />
            </div>
            <Separator />
            <div className="space-y-2"><Label>Video URL</Label><Input value={form.video_url || ""} onChange={e => update("video_url", e.target.value)} placeholder="https://youtube.com/..." /></div>
          </div>
        </FormSection>
        <FormSection title="Assignment">
          <div className="space-y-2 sm:w-1/2"><Label>Assigned Company ID</Label>
            <Input
              value={form.assigned_company_id || ""}
              onChange={e => update("assigned_company_id", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </FormSection>
        <FormSection title="Internal Notes">
          <Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} rows={4} placeholder="Add any internal notes..." />
        </FormSection>
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
          <Button onClick={handleSubmit} size="lg" disabled={saving || loading}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}</Button>
        </div>
      </div>
      )}
    </div>
  );
};

export default ProjectForm;
