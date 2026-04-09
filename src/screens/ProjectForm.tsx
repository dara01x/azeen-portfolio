import { useEffect, useMemo, useState } from "react";
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
import { ImageUpload } from "@/components/ImageUpload";
import { useAuth } from "@/lib/auth/useAuth";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { getUsers as fetchUsers } from "@/modules/users/user.client";
import {
  createProject,
  getProjectById,
  updateProject,
  uploadProjectImageBlobUrls,
} from "@/modules/projects/project.client";
import type { Project, User } from "@/types";

type LocalImageFileMap = Record<string, File>;

const OPTIONAL_LINK_NONE = "__none__";

const PROJECT_STATUS_OPTIONS: Array<{ value: Project["status"]; label: string }> = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

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

function hasOptionById(items: Array<{ id: string }>, id?: string) {
  if (!id) {
    return false;
  }

  return items.some((item) => item.id === id);
}

function getPreferredText(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function isProjectStatus(value: string): value is Project["status"] {
  return value === "active" || value === "completed" || value === "archived";
}

const defaultProject: Omit<Project, "id"> = {
  title: "",
  description: "",
  description_en: "",
  description_ku: "",
  description_ar: "",
  status: "active",
  city_id: "",
  area: "",
  address: "",
  address_en: "",
  address_ku: "",
  address_ar: "",
  property_type_ids: [],
  area_size: 0,
  starting_price: 0,
  currency: "USD",
  payment_type: "cash",
  amenities: [],
  contact_name: "",
  primary_mobile_number: "",
  images: [],
  internal_notes: "",
};

const FormSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-4">
      <CardTitle className="text-base">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
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
  const [areas, setAreas] = useState<AppVariableItem[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [companies, setCompanies] = useState<User[]>([]);
  const [localImageFiles, setLocalImageFiles] = useState<LocalImageFileMap>({});

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const areaNames = useMemo(
    () => Array.from(new Set(areas.map((item) => item.name.trim()).filter(Boolean))),
    [areas],
  );

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

    Promise.all([
      getVariables("cities"),
      getVariables("areas"),
      getVariables("property_types"),
    ])
      .then(([cityItems, areaItems, propertyTypeItems]) => {
        if (cancelled) {
          return;
        }

        setCities(cityItems);
        setAreas(areaItems);
        setPropertyTypes(propertyTypeItems);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message =
            fetchError instanceof Error ? fetchError.message : "Failed to load app variables.";
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
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;

    fetchUsers()
      .then((items) => {
        if (!cancelled) {
          setCompanies(
            (items as User[]).filter((item) => item.role === "company" && item.status === "active"),
          );
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load users.";
          setLookupError((prev) => prev || message);
          setCompanies([]);
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
      const singleAddressValue = getPreferredText(
        form.address_en,
        form.address_ku,
        form.address_ar,
        form.address,
      ).trim();
      const singleDescriptionValue = getPreferredText(
        form.description_en,
        form.description_ku,
        form.description_ar,
        form.description,
      ).trim();

      const payload: Omit<Project, "id"> = {
        ...form,
        title: form.title.trim(),
        description: singleDescriptionValue,
        description_en: singleDescriptionValue,
        description_ku: singleDescriptionValue,
        description_ar: singleDescriptionValue,
        area: form.area.trim(),
        address: singleAddressValue,
        address_en: singleAddressValue,
        address_ku: singleAddressValue,
        address_ar: singleAddressValue,
        property_type_ids: Array.from(new Set(form.property_type_ids.map((item) => item.trim()).filter(Boolean))),
        amenities: Array.from(new Set((form.amenities || []).map((item) => item.trim()).filter(Boolean))),
        area_size: Number(form.area_size) || 0,
        starting_price: Number(form.starting_price) || 0,
        assigned_company_id: form.assigned_company_id || undefined,
        video_url: form.video_url?.trim() || undefined,
        internal_notes: (form.internal_notes || "").trim(),
      };

      if (!payload.title) {
        throw new Error("Project name is required.");
      }

      if (!payload.area) {
        throw new Error("Area is required.");
      }

      if (!payload.internal_notes) {
        throw new Error("Internal notes are required.");
      }

      const activeLocalFiles = Object.fromEntries(
        Object.entries(localImageFiles).filter(([imageUrl]) => payload.images.includes(imageUrl)),
      ) as LocalImageFileMap;

      const { uploadedImages, localBlobImages } = splitImageUrls(payload.images, activeLocalFiles);

      if (isEdit && id) {
        const newlyUploadedImages = await uploadProjectImageBlobUrls(id, localBlobImages, activeLocalFiles);
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        await updateProject(id, {
          ...payload,
          images: allImages,
          main_image: allImages[0],
        });
      } else {
        const created = await createProject({
          ...payload,
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
            ...payload,
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
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Project" : "Create Project"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fill in the details to {isEdit ? "update" : "create"} a project
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
          <Button onClick={handleSubmit} disabled={saving || loading}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {lookupError ? <p className="mb-4 text-sm text-destructive">{lookupError}</p> : null}
      {lookupsLoading ? <p className="mb-4 text-sm text-muted-foreground">Loading app variables...</p> : null}

      {loading && isEdit ? (
        <p className="text-sm text-muted-foreground">Loading project data...</p>
      ) : (
        <div className="grid gap-6 max-w-4xl">
          <FormSection title="Basic Information" description="Core project details">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Project Name *</Label>
                <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Status (Optional)</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => {
                    if (isProjectStatus(value)) {
                      update("status", value);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label className="mb-2 block">Property Types (Optional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {propertyTypes.map((typeItem) => (
                    <label key={typeItem.id} className="flex items-center gap-2.5 text-sm rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                      <Checkbox
                        checked={form.property_type_ids.includes(typeItem.id)}
                        onCheckedChange={(checked) => {
                          update(
                            "property_type_ids",
                            checked
                              ? [...form.property_type_ids, typeItem.id]
                              : form.property_type_ids.filter((idValue) => idValue !== typeItem.id),
                          );
                        }}
                      />
                      {typeItem.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Location">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City (Optional)</Label>
                <Select
                  value={form.city_id || OPTIONAL_LINK_NONE}
                  onValueChange={(value) => update("city_id", value === OPTIONAL_LINK_NONE ? "" : value)}
                >
                  <SelectTrigger><SelectValue placeholder="Select city (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPTIONAL_LINK_NONE}>None</SelectItem>
                    {!hasOptionById(cities, form.city_id) && form.city_id ? (
                      <SelectItem value={form.city_id}>Current: {form.city_id}</SelectItem>
                    ) : null}
                    {cities.map((cityItem) => (
                      <SelectItem key={cityItem.id} value={cityItem.id}>{cityItem.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Area *</Label>
                <Select value={form.area} onValueChange={(value) => update("area", value)}>
                  <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                  <SelectContent>
                    {form.area.trim() && !areaNames.includes(form.area.trim()) ? (
                      <SelectItem value={form.area}>Current: {form.area}</SelectItem>
                    ) : null}
                    {areaNames.map((areaName) => (
                      <SelectItem key={areaName} value={areaName}>{areaName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {areaNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No areas configured. Add values in App Variables.</p>
                ) : null}
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label>Address (Optional)</Label>
                <Input
                  value={getPreferredText(form.address_en, form.address_ku, form.address_ar, form.address)}
                  onChange={(e) => {
                    const value = e.target.value;
                    update("address", value);
                    update("address_en", value);
                    update("address_ku", value);
                    update("address_ar", value);
                  }}
                  placeholder="Enter address in any language"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Description" description="Project description in any language">
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={getPreferredText(
                  form.description_en,
                  form.description_ku,
                  form.description_ar,
                  form.description,
                )}
                onChange={(e) => {
                  const value = e.target.value;
                  update("description", value);
                  update("description_en", value);
                  update("description_ku", value);
                  update("description_ar", value);
                }}
                rows={4}
                placeholder="Enter description in any language"
              />
            </div>
          </FormSection>

          <FormSection title="Media">
            <div className="space-y-5">
              <div>
                <Label className="mb-3 block">Images (Optional)</Label>
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
                  onChange={(images) => {
                    const removedLocalUrls = form.images.filter(
                      (url) => url.startsWith("blob:") && !images.includes(url),
                    );

                    removedLocalUrls.forEach((imageUrl) => {
                      URL.revokeObjectURL(imageUrl);
                    });

                    setLocalImageFiles((prev) => {
                      const next: LocalImageFileMap = {};
                      images.forEach((imageUrl) => {
                        if (prev[imageUrl]) {
                          next[imageUrl] = prev[imageUrl];
                        }
                      });
                      return next;
                    });

                    update("images", images);
                  }}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Video URL (Optional)</Label>
                <Input
                  value={form.video_url || ""}
                  onChange={(e) => update("video_url", e.target.value)}
                  placeholder="https://youtube.com/..."
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Assignment">
            <div className="space-y-2 sm:w-1/2">
              <Label>Assigned Company (Optional)</Label>
              <Select
                value={form.assigned_company_id || OPTIONAL_LINK_NONE}
                onValueChange={(value) =>
                  update("assigned_company_id", value === OPTIONAL_LINK_NONE ? undefined : value)
                }
              >
                <SelectTrigger><SelectValue placeholder="Select company (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>Unassigned</SelectItem>
                  {!hasOptionById(companies, form.assigned_company_id) && form.assigned_company_id ? (
                    <SelectItem value={form.assigned_company_id}>Current: {form.assigned_company_id}</SelectItem>
                  ) : null}
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.full_name} ({company.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormSection>

          <FormSection title="Internal Notes">
            <div className="space-y-2">
              <Label>Notes *</Label>
              <Textarea
                value={form.internal_notes || ""}
                onChange={(e) => update("internal_notes", e.target.value)}
                rows={4}
                placeholder="Add any internal notes..."
              />
            </div>
          </FormSection>

          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
            <Button onClick={handleSubmit} size="lg" disabled={saving || loading}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectForm;
