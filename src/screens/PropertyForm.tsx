import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { MultilingualInput } from "@/components/MultilingualInput";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "@/components/ui/sonner";
import {
  createProperty,
  deleteProperty,
  getPropertyById,
  updateProperty,
  uploadPropertyImageBlobUrls,
} from "@/modules/properties/property.client";
import { getProjects } from "@/modules/projects/project.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import { mockClients, mockUsers } from "@/data/mock";
import type { Amenity, City, Client, Project, Property, PropertyType, User, ViewType } from "@/types";

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

const OWNERSHIP_TYPE_OPTIONS = [
  { value: "freehold", label: "Freehold" },
  { value: "leasehold", label: "Leasehold" },
  { value: "power_of_attorney", label: "Power of Attorney" },
  { value: "other", label: "Other" },
] as const;

const OPTIONAL_LINK_NONE = "__none__";

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePriceInput(value: string): number {
  const digitsOnly = value.replace(/[^\d]/g, "");
  if (!digitsOnly) {
    return 0;
  }

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPriceInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return value.toLocaleString("en-US");
}

function buildInternalPropertyTitle(
  input: Omit<Property, "id">,
  propertyTypes: PropertyType[],
  cities: City[],
): string {
  const typeName = propertyTypes.find((item) => item.id === input.type_id)?.name?.trim() || "";
  const cityName = cities.find((item) => item.id === input.city_id)?.name?.trim() || "";
  const areaName = input.area.trim();

  const parts = [typeName, cityName || areaName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" - ");
  }

  return `Property ${Date.now()}`;
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

const defaultProperty: Omit<Property, "id"> = {
  title: "", type_id: "", listing_type: "sale", status: "available",
  price: 0, currency: "USD", payment_type: "cash",
  city_id: "", area: "", address_en: "", address_ku: "", address_ar: "",
  area_size: 0, bedrooms: 0, bathrooms: 0, balconies: 0, floors: 1, condition: "new",
  ownership_type: "",
  amenities: [], description_en: "", description_ku: "", description_ar: "",
  images: [], contact_name: "", primary_mobile_number: "", internal_notes: "",
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
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const [form, setForm] = useState<Omit<Property, "id">>(defaultProperty);
  const [loading, setLoading] = useState(isEdit);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [views, setViews] = useState<ViewType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients] = useState<Client[]>(mockClients);
  const [companies] = useState<User[]>(() => mockUsers.filter((item) => item.role === "company"));
  const [localImageFiles, setLocalImageFiles] = useState<LocalImageFileMap>({});
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const selectedCoordinates = useMemo<CoordinatesValue | null>(() => {
    if (typeof form.lat === "number" && Number.isFinite(form.lat) && typeof form.lng === "number" && Number.isFinite(form.lng)) {
      return { lat: form.lat, lng: form.lng };
    }

    return null;
  }, [form.lat, form.lng]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;
    setLookupsLoading(true);
    setLookupError(null);

    Promise.all([
      getVariables("property_types"),
      getVariables("cities"),
      getVariables("amenities"),
      getVariables("views"),
    ])
      .then(([types, citiesList, amenitiesList, viewsList]) => {
        if (cancelled) {
          return;
        }

        setPropertyTypes(types.map((item) => ({ id: item.id, name: item.name })));
        setCities(citiesList.map((item) => ({ id: item.id, name: item.name })));
        setAmenities(amenitiesList.map((item) => ({ id: item.id, name: item.name })));
        setViews(viewsList.map((item) => ({ id: item.id, name: item.name })));
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load app variables.";
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

    getProjects()
      .then((items) => {
        if (!cancelled) {
          setProjects(items as Project[]);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load projects.";
          setLookupError((prev) => prev || message);
          setProjects([]);
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

    getPropertyById(id)
      .then((property) => {
        if (cancelled) {
          return;
        }

        if (!property) {
          setError("Property not found.");
          return;
        }

        setLocalImageFiles({});
        const { id: _id, ...rest } = property;
        setForm({ ...defaultProperty, ...rest });
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load property data.";
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

  async function handleDeleteProperty() {
    if (!isEdit || !id || authLoading || !user || deleting) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteProperty(id);

      Object.keys(localImageFiles).forEach((imageUrl) => {
        URL.revokeObjectURL(imageUrl);
      });
      setLocalImageFiles({});

      setDeleteDialogOpen(false);
      toast.success("Property deleted successfully.");
      router.push("/properties");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete property.";
      setError(message);
      toast.error(message, {
        style: {
          background: "hsl(var(--destructive))",
          color: "hsl(var(--destructive-foreground))",
          borderColor: "hsl(var(--destructive))",
        },
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit() {
    if (authLoading || !user) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const normalizedPrimaryMobileNumber = normalizePhoneNumber(form.primary_mobile_number);
      const normalizedSecondaryMobileNumber = normalizePhoneNumber(form.secondary_mobile_number || "");

      const payload: Omit<Property, "id"> = {
        ...form,
        title: form.title.trim() || buildInternalPropertyTitle(form, propertyTypes, cities),
        contact_name: form.contact_name.trim(),
        primary_mobile_number: normalizedPrimaryMobileNumber,
        secondary_mobile_number: normalizedSecondaryMobileNumber || undefined,
      };

      if (!payload.type_id) {
        throw new Error("Property type is required.");
      }

      if (!payload.city_id) {
        throw new Error("City is required.");
      }

      if (payload.primary_mobile_number && !isValidPhoneNumber(payload.primary_mobile_number)) {
        throw new Error("Primary mobile number is invalid.");
      }

      if (payload.secondary_mobile_number && !isValidPhoneNumber(payload.secondary_mobile_number)) {
        throw new Error("Secondary mobile number is invalid.");
      }

      if (
        hasNegativeNumber(payload.price) ||
        hasNegativeNumber(payload.area_size) ||
        hasNegativeNumber(payload.bedrooms) ||
        hasNegativeNumber(payload.bathrooms) ||
        hasNegativeNumber(payload.balconies) ||
        hasNegativeNumber(payload.floors) ||
        hasNegativeNumber(payload.total_floors) ||
        hasNegativeNumber(payload.unit_floor_number)
      ) {
        throw new Error("Numeric fields cannot be negative.");
      }

      if (!isValidCoordinates(payload.lat, payload.lng)) {
        throw new Error("Coordinates must be empty or include valid latitude and longitude.");
      }

      const hasTotalFloors =
        typeof payload.total_floors === "number" && Number.isFinite(payload.total_floors);
      const hasUnitFloorNumber =
        typeof payload.unit_floor_number === "number" && Number.isFinite(payload.unit_floor_number);

      if (hasUnitFloorNumber && !hasTotalFloors) {
        throw new Error("Total floors is required when unit floor number is provided.");
      }

      if (
        hasUnitFloorNumber &&
        hasTotalFloors &&
        (payload.unit_floor_number as number) > (payload.total_floors as number)
      ) {
        throw new Error("Unit floor number cannot be greater than total floors.");
      }

      const activeLocalFiles = Object.fromEntries(
        Object.entries(localImageFiles).filter(([imageUrl]) => form.images.includes(imageUrl)),
      ) as LocalImageFileMap;

      const { uploadedImages, localBlobImages } = splitImageUrls(payload.images, activeLocalFiles);

      if (isEdit && id) {
        const newlyUploadedImages = await uploadPropertyImageBlobUrls(id, localBlobImages, activeLocalFiles);
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        await updateProperty(id, {
          ...payload,
          images: allImages,
          main_image: allImages[0],
        });
      } else {
        const created = await createProperty({
          ...payload,
          images: uploadedImages,
          main_image: uploadedImages[0],
        });

        const newlyUploadedImages = await uploadPropertyImageBlobUrls(
          created.id,
          localBlobImages,
          activeLocalFiles,
        );
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        if (allImages.length > 0) {
          await updateProperty(created.id, {
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

      router.push("/properties");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save property.";
      setError(message);
      toast.error(message, {
        style: {
          background: "hsl(var(--destructive))",
          color: "hsl(var(--destructive-foreground))",
          borderColor: "hsl(var(--destructive))",
        },
      });
    } finally {
      setSaving(false);
    }
  }

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
          {isEdit ? (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={saving || loading || deleting}>
                  Delete Property
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Property Permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove this property from Firestore and delete all uploaded images from Firebase
                    Storage. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleting}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleDeleteProperty();
                    }}
                  >
                    {deleting ? "Deleting..." : "Delete Property"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button variant="outline" asChild><Link href="/properties">Cancel</Link></Button>
          <Button onClick={handleSubmit} disabled={saving || loading || deleting}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Property"}</Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {lookupError && <p className="mb-4 text-sm text-destructive">{lookupError}</p>}

      {lookupsLoading ? (
        <p className="mb-4 text-sm text-muted-foreground">Loading app variables...</p>
      ) : null}

      {loading && isEdit ? (
        <p className="text-sm text-muted-foreground">Loading property data...</p>
      ) : (

      <div className="grid gap-6 max-w-4xl">
        <FormSection title="Basic Information" description="Core details about the property">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>Type *</Label>
              <Select value={form.type_id} onValueChange={v => update("type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{propertyTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Listing Type *</Label>
              <Select value={form.listing_type} onValueChange={v => update("listing_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sale">Sale</SelectItem><SelectItem value="rent">Rent</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Status *</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="available">Available</SelectItem><SelectItem value="sold">Sold</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Condition *</Label>
              <Select value={form.condition} onValueChange={v => update("condition", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="used">Used</SelectItem><SelectItem value="under_construction">Under Construction</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Ownership Type (Optional)</Label>
              <Select value={form.ownership_type || ""} onValueChange={v => update("ownership_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select ownership type" /></SelectTrigger>
                <SelectContent>
                  {OWNERSHIP_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Pricing" description="Set the price and payment terms">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2"><Label>Price *</Label><Input type="text" inputMode="numeric" value={formatPriceInput(form.price)} onChange={e => update("price", parsePriceInput(e.target.value))} placeholder="0" /></div>
            <div className="space-y-2"><Label>Currency *</Label>
              <Select value={form.currency} onValueChange={v => update("currency", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="IQD">IQD</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Payment Type *</Label>
              <Select value={form.payment_type} onValueChange={v => update("payment_type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="installment">Installment</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Location" description="Where is this property located?">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>City *</Label>
              <Select value={form.city_id} onValueChange={v => update("city_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Area (Optional)</Label><Input value={form.area} onChange={e => update("area", e.target.value)} placeholder="e.g. Downtown" /></div>
            <div className="sm:col-span-2">
              <MultilingualInput label="Address (Optional)" values={{ en: form.address_en, ku: form.address_ku, ar: form.address_ar }} onChange={v => { update("address_en", v.en); update("address_ku", v.ku); update("address_ar", v.ar); }} />
            </div>
            <Separator className="sm:col-span-2" />
            <div className="space-y-2"><Label>Latitude (Optional)</Label><Input type="number" step="any" value={form.lat ?? ""} onChange={e => update("lat", parseOptionalNumber(e.target.value))} placeholder="36.204824" /></div>
            <div className="space-y-2"><Label>Longitude (Optional)</Label><Input type="number" step="any" value={form.lng ?? ""} onChange={e => update("lng", parseOptionalNumber(e.target.value))} placeholder="44.009167" /></div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Map Location (Optional)</Label>
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

        <FormSection title="Property Details" description="Physical characteristics">
          <div className="grid gap-5 sm:grid-cols-4">
            <div className="space-y-2"><Label>Area Size (m²) *</Label><Input type="number" min={0} value={form.area_size || ""} onChange={e => update("area_size", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Bedrooms (Optional)</Label><Input type="number" min={0} value={form.bedrooms || ""} onChange={e => update("bedrooms", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Bathrooms (Optional)</Label><Input type="number" min={0} value={form.bathrooms || ""} onChange={e => update("bathrooms", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Balconies (Optional)</Label><Input type="number" min={0} value={form.balconies || ""} onChange={e => update("balconies", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Property Floors (Optional)</Label><Input type="number" min={0} value={form.floors || ""} onChange={e => update("floors", Math.max(0, Number(e.target.value) || 0))} /></div>
          </div>
        </FormSection>

        <FormSection title="Features & Amenities" description="What does this property offer?">
          <div className="space-y-5">
            <div className="space-y-2"><Label>View (Optional)</Label>
              <Select value={form.view_id || ""} onValueChange={v => update("view_id", v)}>
                <SelectTrigger className="sm:w-1/2"><SelectValue placeholder="Select view (optional)" /></SelectTrigger>
                <SelectContent>{views.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Separator />
            <div>
              <Label className="mb-3 block">Amenities (Optional)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {amenities.map(a => (
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
          <p className="mb-4 text-xs text-muted-foreground">
            For apartments: use Total Floors and Unit Floor Number. For standalone properties: use Property Floors.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>Building Name (Optional)</Label><Input value={form.building_name || ""} onChange={e => update("building_name", e.target.value)} /></div>
            <div className="space-y-2"><Label>Tower Number (Optional)</Label><Input value={form.tower_number || ""} onChange={e => update("tower_number", e.target.value)} /></div>
            <div className="space-y-2"><Label>Land Number (Optional)</Label><Input value={form.land_number || ""} onChange={e => update("land_number", e.target.value)} /></div>
            <div className="space-y-2"><Label>Total Floors (Optional)</Label><Input type="number" min={0} value={form.total_floors ?? ""} onChange={e => update("total_floors", parseOptionalNumber(e.target.value))} /></div>
            <div className="space-y-2"><Label>Unit Floor Number (Optional)</Label><Input type="number" min={0} value={form.unit_floor_number ?? ""} onChange={e => update("unit_floor_number", parseOptionalNumber(e.target.value))} /></div>
          </div>
        </FormSection>

        <FormSection title="Description" description="Property description in multiple languages">
          <MultilingualInput label="Description (Optional)" multiline values={{ en: form.description_en, ku: form.description_ku, ar: form.description_ar }} onChange={v => { update("description_en", v.en); update("description_ku", v.ku); update("description_ar", v.ar); }} />
        </FormSection>

        <FormSection title="Media" description="Upload images and add video links">
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
            <div className="space-y-2"><Label>Video URL (YouTube) (Optional)</Label><Input value={form.video_url || ""} onChange={e => update("video_url", e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
          </div>
        </FormSection>

        <FormSection title="Relations" description="Link this property with related records by their document IDs">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Project (Optional)</Label>
              <Select
                value={form.project_id || OPTIONAL_LINK_NONE}
                onValueChange={(value) => update("project_id", value === OPTIONAL_LINK_NONE ? undefined : value)}
              >
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>None</SelectItem>
                  {!hasOptionById(projects, form.project_id) && form.project_id ? (
                    <SelectItem value={form.project_id}>Current: {form.project_id}</SelectItem>
                  ) : null}
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Owner Client (Optional)</Label>
              <Select
                value={form.owner_client_id || OPTIONAL_LINK_NONE}
                onValueChange={(value) =>
                  update("owner_client_id", value === OPTIONAL_LINK_NONE ? undefined : value)
                }
              >
                <SelectTrigger><SelectValue placeholder="Select owner client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>None</SelectItem>
                  {!hasOptionById(clients, form.owner_client_id) && form.owner_client_id ? (
                    <SelectItem value={form.owner_client_id}>Current: {form.owner_client_id}</SelectItem>
                  ) : null}
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name} - {client.primary_phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned Company (Optional)</Label>
              <Select
                value={form.assigned_company_id || OPTIONAL_LINK_NONE}
                onValueChange={(value) =>
                  update("assigned_company_id", value === OPTIONAL_LINK_NONE ? undefined : value)
                }
              >
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>None</SelectItem>
                  {!hasOptionById(companies, form.assigned_company_id) && form.assigned_company_id ? (
                    <SelectItem value={form.assigned_company_id}>Current: {form.assigned_company_id}</SelectItem>
                  ) : null}
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.company_name || company.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Contact Information" description="Owner or agent contact details">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>Contact Name (Optional)</Label><Input value={form.contact_name} onChange={e => update("contact_name", e.target.value)} placeholder="Enter contact person name" /></div>
            <div className="space-y-2"><Label>Primary Mobile Number (Optional)</Label><Input value={form.primary_mobile_number} onChange={e => update("primary_mobile_number", e.target.value)} placeholder="+9647504001122" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Secondary Mobile Number (Optional)</Label><Input value={form.secondary_mobile_number || ""} onChange={e => update("secondary_mobile_number", e.target.value)} placeholder="+9647504001122" /></div>
          </div>
        </FormSection>

        <FormSection title="Internal Notes" description="Private notes not visible to clients">
          <Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} placeholder="Add any internal notes here..." rows={4} />
        </FormSection>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" asChild><Link href="/properties">Cancel</Link></Button>
          <Button onClick={handleSubmit} size="lg" disabled={saving || loading}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Property"}</Button>
        </div>
      </div>
      )}
    </div>
  );
};

export default PropertyForm;
