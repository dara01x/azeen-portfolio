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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { MultilingualInput } from "@/components/MultilingualInput";
import { ImageUpload } from "@/components/ImageUpload";
import { useAuth } from "@/lib/auth/useAuth";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { mockUsers } from "@/data/mock";
import {
  createProject,
  getProjectById,
  updateProject,
  uploadProjectImageBlobUrls,
} from "@/modules/projects/project.client";
import type { Project, User } from "@/types";

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

const OPTIONAL_LINK_NONE = "__none__";

const PROJECT_STATUS_OPTIONS: Array<{ value: Project["status"]; label: string }> = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const CURRENCY_OPTIONS: Array<{ value: Project["currency"]; label: string }> = [
  { value: "USD", label: "USD" },
  { value: "IQD", label: "IQD" },
];

const PAYMENT_TYPE_OPTIONS: Array<{ value: Project["payment_type"]; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "installment", label: "Installment" },
];

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  let normalized = trimmed.replace(/[\s\-()]/g, "");
  normalized = normalized.replace(/(?!^)\+/g, "");

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  return normalized;
}

function isValidPhoneNumber(value: string): boolean {
  return /^\+?\d{7,15}$/.test(value);
}

function isValidCoordinates(lat?: number, lng?: number): boolean {
  const hasLat = typeof lat === "number" && Number.isFinite(lat);
  const hasLng = typeof lng === "number" && Number.isFinite(lng);
  return (!hasLat && !hasLng) || (hasLat && hasLng);
}

function hasNegativeNumber(value: number | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value < 0;
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

function hasOptionById(items: Array<{ id: string }>, id?: string) {
  if (!id) {
    return false;
  }

  return items.some((item) => item.id === id);
}

function isProjectStatus(value: string): value is Project["status"] {
  return value === "active" || value === "completed" || value === "archived";
}

function isCurrency(value: string): value is Project["currency"] {
  return value === "USD" || value === "IQD";
}

function isPaymentType(value: string): value is Project["payment_type"] {
  return value === "cash" || value === "installment";
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
  total_units: 0,
  available_units: 0,
  images: [],
  has_units: false,
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
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [amenities, setAmenities] = useState<AppVariableItem[]>([]);
  const [companies] = useState<User[]>(() => mockUsers.filter((item) => item.role === "company"));
  const [localImageFiles, setLocalImageFiles] = useState<LocalImageFileMap>({});

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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

    Promise.all([getVariables("cities"), getVariables("property_types"), getVariables("amenities")])
      .then(([cityItems, propertyTypeItems, amenityItems]) => {
        if (cancelled) {
          return;
        }

        setCities(cityItems);
        setPropertyTypes(propertyTypeItems);
        setAmenities(amenityItems);
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
      const normalizedPrimaryMobileNumber = normalizePhoneNumber(form.primary_mobile_number || "");
      const normalizedSecondaryMobileNumber = normalizePhoneNumber(form.secondary_mobile_number || "");

      const payload: Omit<Project, "id"> = {
        ...form,
        title: form.title.trim(),
        description: form.description_en.trim() || form.description.trim(),
        description_en: form.description_en.trim(),
        description_ku: form.description_ku.trim(),
        description_ar: form.description_ar.trim(),
        area: form.area.trim(),
        address: form.address_en.trim() || form.address.trim(),
        address_en: form.address_en.trim(),
        address_ku: form.address_ku.trim(),
        address_ar: form.address_ar.trim(),
        property_type_ids: Array.from(new Set(form.property_type_ids.map((item) => item.trim()).filter(Boolean))),
        amenities: Array.from(new Set(form.amenities.map((item) => item.trim()).filter(Boolean))),
        area_size: Number(form.area_size) || 0,
        starting_price: Number(form.starting_price) || 0,
        contact_name: form.contact_name.trim(),
        primary_mobile_number: normalizedPrimaryMobileNumber,
        secondary_mobile_number: normalizedSecondaryMobileNumber || undefined,
        total_units: Math.max(0, Number(form.total_units) || 0),
        available_units: Math.max(0, Number(form.available_units) || 0),
        assigned_company_id: form.assigned_company_id || undefined,
        video_url: form.video_url?.trim() || undefined,
        internal_notes: form.internal_notes?.trim() || undefined,
      };

      if (!payload.title) {
        throw new Error("Project name is required.");
      }

      if (!payload.city_id) {
        throw new Error("City is required.");
      }

      if (payload.property_type_ids.length === 0) {
        throw new Error("Please select at least one property type.");
      }

      if (!Number.isFinite(payload.area_size) || payload.area_size <= 0) {
        throw new Error("Area (m2) is required.");
      }

      if (!Number.isFinite(payload.starting_price) || payload.starting_price <= 0) {
        throw new Error("Starting price is required.");
      }

      if (!payload.payment_type) {
        throw new Error("Payment method is required.");
      }

      if (hasNegativeNumber(payload.total_units) || hasNegativeNumber(payload.available_units)) {
        throw new Error("Unit counts cannot be negative.");
      }

      if (payload.available_units > payload.total_units) {
        throw new Error("Available units cannot exceed total units.");
      }

      if (!isValidCoordinates(payload.lat, payload.lng)) {
        throw new Error("Coordinates must be empty or include valid latitude and longitude.");
      }

      if (payload.primary_mobile_number && !isValidPhoneNumber(payload.primary_mobile_number)) {
        throw new Error("Primary mobile number is invalid.");
      }

      if (payload.secondary_mobile_number && !isValidPhoneNumber(payload.secondary_mobile_number)) {
        throw new Error("Secondary mobile number is invalid.");
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
                <Label>Status</Label>
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

              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.has_units} onCheckedChange={(value) => update("has_units", value)} />
                <Label>Has Units</Label>
              </div>

              <div className="sm:col-span-2">
                <Label className="mb-2 block">Property Types *</Label>
                <p className="mb-3 text-xs text-muted-foreground">Please select at least one property type.</p>
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

          <FormSection title="Pricing" description="Project commercial details">
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Starting Price *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.starting_price || ""}
                  onChange={(e) => update("starting_price", Math.max(0, Number(e.target.value) || 0))}
                />
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(value) => {
                    if (isCurrency(value)) {
                      update("currency", value);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select
                  value={form.payment_type}
                  onValueChange={(value) => {
                    if (isPaymentType(value)) {
                      update("payment_type", value);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Area (m2) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.area_size || ""}
                  onChange={(e) => update("area_size", Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Location">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City *</Label>
                <Select value={form.city_id} onValueChange={(value) => update("city_id", value)}>
                  <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {cities.map((cityItem) => (
                      <SelectItem key={cityItem.id} value={cityItem.id}>{cityItem.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Area</Label>
                <Input value={form.area} onChange={(e) => update("area", e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <MultilingualInput
                  label="Address"
                  values={{ en: form.address_en, ku: form.address_ku, ar: form.address_ar }}
                  onChange={(value) => {
                    update("address_en", value.en);
                    update("address_ku", value.ku);
                    update("address_ar", value.ar);
                    update("address", value.en);
                  }}
                />
              </div>

              <Separator className="sm:col-span-2" />

              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.lat ?? ""}
                  onChange={(e) => update("lat", parseOptionalNumber(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.lng ?? ""}
                  onChange={(e) => update("lng", parseOptionalNumber(e.target.value))}
                />
              </div>

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

          <FormSection title="Features & Amenities">
            <div>
              <Label className="mb-3 block">Amenities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {amenities.map((amenityItem) => (
                  <label key={amenityItem.id} className="flex items-center gap-2.5 text-sm rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                    <Checkbox
                      checked={form.amenities.includes(amenityItem.id)}
                      onCheckedChange={(checked) => {
                        update(
                          "amenities",
                          checked
                            ? [...form.amenities, amenityItem.id]
                            : form.amenities.filter((idValue) => idValue !== amenityItem.id),
                        );
                      }}
                    />
                    {amenityItem.name}
                  </label>
                ))}
              </div>
            </div>
          </FormSection>

          <FormSection title="Description" description="Project description in multiple languages">
            <MultilingualInput
              label="Description"
              multiline
              values={{ en: form.description_en, ku: form.description_ku, ar: form.description_ar }}
              onChange={(value) => {
                update("description_en", value.en);
                update("description_ku", value.ku);
                update("description_ar", value.ar);
                update("description", value.en);
              }}
            />
          </FormSection>

          <FormSection title="Contact Information" description="Agent contact details">
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label>Agent Name</Label>
                <Input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Primary Mobile Number</Label>
                <Input
                  value={form.primary_mobile_number}
                  onChange={(e) => update("primary_mobile_number", e.target.value)}
                  placeholder="+9647..."
                />
              </div>

              <div className="space-y-2">
                <Label>Secondary Mobile Number</Label>
                <Input
                  value={form.secondary_mobile_number || ""}
                  onChange={(e) => update("secondary_mobile_number", e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Units">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Total Units</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.total_units || ""}
                  onChange={(e) => update("total_units", Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="space-y-2">
                <Label>Available Units</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.available_units || ""}
                  onChange={(e) => update("available_units", Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
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
                <Label>Video URL</Label>
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
              <Label>Assigned Company</Label>
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
            <Textarea
              value={form.internal_notes || ""}
              onChange={(e) => update("internal_notes", e.target.value)}
              rows={4}
              placeholder="Add any internal notes..."
            />
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
