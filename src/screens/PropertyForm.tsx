import { useEffect, useMemo, useRef, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "@/components/ui/sonner";
import {
  createProperty,
  deleteProperty,
  getPropertyById,
  updateProperty,
  uploadPropertyImageBlobUrls,
  uploadPropertyVideoFile,
  deletePropertyVideo,
} from "@/modules/properties/property.client";
import { getUsers as fetchUsers } from "@/modules/users/user.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import type { City, Property, PropertyType, User } from "@/types";

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
type PropertyFormState = Omit<Property, "id" | "listing_type" | "ownership_type" | "payment_type">;

const OPTIONAL_LINK_NONE = "__none__";
const MAX_PROPERTY_VIDEO_SELECTION_SIZE_BYTES = 250 * 1024 * 1024;
const ERROR_TOAST_STYLE = {
  background: "hsl(var(--destructive))",
  color: "hsl(var(--destructive-foreground))",
  borderColor: "hsl(var(--destructive))",
};

const TOWER_NUMBER_TYPE_KEYWORDS = ["apartment", "department", "villa", "شقة", "فيلا"];

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
  input: PropertyFormState,
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

function resolvePreferredMainImage(mainImage: string | undefined, images: string[]) {
  if (mainImage && images.includes(mainImage)) {
    return mainImage;
  }

  return images[0];
}

function resolveMainImageAfterUpload(
  preferredMainImage: string | undefined,
  uploadedImages: string[],
  localBlobImages: string[],
  newlyUploadedImages: string[],
) {
  if (preferredMainImage && uploadedImages.includes(preferredMainImage)) {
    return preferredMainImage;
  }

  if (preferredMainImage) {
    const localIndex = localBlobImages.indexOf(preferredMainImage);
    if (localIndex >= 0 && newlyUploadedImages[localIndex]) {
      return newlyUploadedImages[localIndex];
    }
  }

  return [...uploadedImages, ...newlyUploadedImages][0];
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

const defaultProperty: PropertyFormState = {
  title: "", type_id: "", listing_date: "", status: "available",
  price: 0, currency: "USD",
  city_id: "", area: "", address_en: "", address_ku: "", address_ar: "",
  area_size: 0, bedrooms: 0, suit_rooms: 0, bathrooms: 0, balconies: 0, floors: 1, condition: "new",
  amenities: [], description_en: "", description_ku: "", description_ar: "",
  images: [], contact_name: "", primary_mobile_number: "", internal_notes: "",
};

const FormSection = ({ title, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-4">
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <Label>
    {children}
    <span aria-hidden="true" className="ml-1 align-middle text-[1.05rem] font-bold leading-none text-destructive">
      *
    </span>
  </Label>
);

const PropertyForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const [form, setForm] = useState<PropertyFormState>(defaultProperty);
  const [loading, setLoading] = useState(isEdit);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<City[]>([]);
  const [companies, setCompanies] = useState<User[]>([]);
  const [viewers, setViewers] = useState<User[]>([]);
  const [localImageFiles, setLocalImageFiles] = useState<LocalImageFileMap>({});
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
  const [localVideoPreviewUrl, setLocalVideoPreviewUrl] = useState("");
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const canViewAgentContact = user?.role === "admin";
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const activeVideoUrl = localVideoPreviewUrl || form.video_url || "";

  useEffect(() => {
    if (!error) {
      return;
    }

    toast.error(error, { style: ERROR_TOAST_STYLE });
  }, [error]);

  useEffect(() => {
    if (!lookupError) {
      return;
    }

    toast.error(lookupError, { style: ERROR_TOAST_STYLE });
  }, [lookupError]);

  const clearLocalVideoSelection = () => {
    setLocalVideoFile(null);
    setLocalVideoPreviewUrl((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return "";
    });

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_PROPERTY_VIDEO_SELECTION_SIZE_BYTES) {
      setError("Video is too large to process. Please use a file up to 250MB.");
      event.target.value = "";
      return;
    }

    setError(null);
    setLocalVideoFile(selectedFile);
    update("video_url", "");

    setLocalVideoPreviewUrl((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(selectedFile);
    });
  };
  const selectedCoordinates = useMemo<CoordinatesValue | null>(() => {
    if (typeof form.lat === "number" && Number.isFinite(form.lat) && typeof form.lng === "number" && Number.isFinite(form.lng)) {
      return { lat: form.lat, lng: form.lng };
    }

    return null;
  }, [form.lat, form.lng]);
  const selectedTypeSearchText = useMemo(() => {
    const selectedType = propertyTypes.find((item) => item.id === form.type_id);
    if (!selectedType) {
      return "";
    }

    return `${selectedType.id} ${selectedType.name}`.toLowerCase();
  }, [form.type_id, propertyTypes]);
  const showTowerNumber = useMemo(
    () => TOWER_NUMBER_TYPE_KEYWORDS.some((keyword) => selectedTypeSearchText.includes(keyword)),
    [selectedTypeSearchText],
  );
  const areaNames = useMemo(
    () => Array.from(new Set(areas.map((item) => item.name.trim()).filter(Boolean))),
    [areas],
  );

  useEffect(() => {
    return () => {
      if (localVideoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localVideoPreviewUrl);
      }
    };
  }, [localVideoPreviewUrl]);

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
      getVariables("areas"),
    ])
      .then(([types, citiesList, areasList]) => {
        if (cancelled) {
          return;
        }

        setPropertyTypes(types.map((item) => ({ id: item.id, name: item.name })));
        setCities(citiesList.map((item) => ({ id: item.id, name: item.name })));
        setAreas(areasList.map((item) => ({ id: item.id, name: item.name })));
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

    fetchUsers()
      .then((items) => {
        if (!cancelled) {
          const activeUsers = (items as User[]).filter((item) => item.status === "active");

          setCompanies(
            activeUsers.filter((item) => item.role === "company"),
          );
          setViewers(
            activeUsers.filter((item) => item.role === "viewer"),
          );
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load users.";
          setLookupError((prev) => prev || message);
          setCompanies([]);
          setViewers([]);
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
      clearLocalVideoSelection();
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
        clearLocalVideoSelection();
        const {
          id: _id,
          listing_type: _listingType,
          ownership_type: _ownershipType,
          payment_type: _paymentType,
          ...rest
        } = property;
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
      clearLocalVideoSelection();

      setDeleteDialogOpen(false);
      toast.success("Property deleted successfully.");
      router.push("/properties");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete property.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteVideo() {
    if (!isEdit || !id || authLoading || !user || deletingVideo) {
      return;
    }

    setDeletingVideo(true);
    setError(null);

    try {
      await deletePropertyVideo(id);
      
      clearLocalVideoSelection();
      update("video_url", "");
      
      toast.success("Video deleted successfully.");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete video.";
      setError(message);
    } finally {
      setDeletingVideo(false);
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
      const singleAddressValue = getPreferredText(
        form.address_en,
        form.address_ku,
        form.address_ar,
      ).trim();

      const payload: PropertyFormState = {
        ...form,
        currency: form.currency || "USD",
        title: form.title.trim() || buildInternalPropertyTitle(form, propertyTypes, cities),
        address_en: singleAddressValue,
        address_ku: singleAddressValue,
        address_ar: singleAddressValue,
        assigned_viewer_id: (form.assigned_viewer_id || "").trim() || undefined,
        contact_name: form.contact_name.trim(),
        primary_mobile_number: normalizedPrimaryMobileNumber,
        internal_notes: (form.internal_notes || "").trim(),
      };

      if (!payload.type_id) {
        throw new Error("Property type is required.");
      }

      if (payload.price <= 0) {
        throw new Error("Price is required.");
      }

      if (!payload.area.trim()) {
        throw new Error("Area is required.");
      }

      if (payload.area_size <= 0) {
        throw new Error("Area size is required.");
      }

      if (canViewAgentContact && payload.primary_mobile_number && !isValidPhoneNumber(payload.primary_mobile_number)) {
        throw new Error("Primary mobile number is invalid.");
      }

      if (
        hasNegativeNumber(payload.price) ||
        hasNegativeNumber(payload.area_size) ||
        hasNegativeNumber(payload.bedrooms) ||
        hasNegativeNumber(payload.suit_rooms) ||
        hasNegativeNumber(payload.bathrooms) ||
        hasNegativeNumber(payload.balconies) ||
        hasNegativeNumber(payload.floors) ||
        hasNegativeNumber(payload.unit_floor_number)
      ) {
        throw new Error("Numeric fields cannot be negative.");
      }

      if (!isValidCoordinates(payload.lat, payload.lng)) {
        throw new Error("Coordinates must be empty or include valid latitude and longitude.");
      }

      const activeLocalFiles = Object.fromEntries(
        Object.entries(localImageFiles).filter(([imageUrl]) => form.images.includes(imageUrl)),
      ) as LocalImageFileMap;

      const { uploadedImages, localBlobImages } = splitImageUrls(payload.images, activeLocalFiles);
      const preferredMainImage = resolvePreferredMainImage(payload.main_image, payload.images);
      let resolvedVideoUrl = (payload.video_url || "").trim();

      if (isEdit && id) {
        if (localVideoFile) {
          resolvedVideoUrl = await uploadPropertyVideoFile(id, localVideoFile);
        }

        const newlyUploadedImages = await uploadPropertyImageBlobUrls(id, localBlobImages, activeLocalFiles);
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];
        const selectedMainImage = resolveMainImageAfterUpload(
          preferredMainImage,
          uploadedImages,
          localBlobImages,
          newlyUploadedImages,
        );

        await updateProperty(id, {
          ...payload,
          images: allImages,
          main_image: selectedMainImage || allImages[0],
          video_url: resolvedVideoUrl,
        });
      } else {
        const initialMainImage =
          preferredMainImage && uploadedImages.includes(preferredMainImage)
            ? preferredMainImage
            : uploadedImages[0];

        const created = await createProperty({
          ...payload,
          images: uploadedImages,
          main_image: initialMainImage,
          video_url: resolvedVideoUrl || undefined,
        });

        if (localVideoFile) {
          resolvedVideoUrl = await uploadPropertyVideoFile(created.id, localVideoFile);
        }

        const newlyUploadedImages = await uploadPropertyImageBlobUrls(
          created.id,
          localBlobImages,
          activeLocalFiles,
        );
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        if (allImages.length > 0 || localVideoFile) {
          const selectedMainImage = resolveMainImageAfterUpload(
            preferredMainImage,
            uploadedImages,
            localBlobImages,
            newlyUploadedImages,
          );

          await updateProperty(created.id, {
            ...payload,
            images: allImages,
            main_image: selectedMainImage || allImages[0],
            video_url: resolvedVideoUrl,
          });
        }
      }

      Object.keys(activeLocalFiles).forEach((imageUrl) => {
        URL.revokeObjectURL(imageUrl);
      });

      setLocalImageFiles({});
      clearLocalVideoSelection();

      router.push("/properties");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save property.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!authLoading && user?.role === "viewer") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">View Only Access</h1>
        <p className="text-sm text-muted-foreground">
          Viewer accounts can only view assigned properties.
        </p>
        <Button asChild>
          <Link href="/properties">Go to Properties</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-start gap-3 sm:flex-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Property" : "Create Property"}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Fill in the details below to {isEdit ? "update" : "create"} a property listing</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {isEdit ? (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto" disabled={saving || loading || deleting}>
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
          <Button variant="outline" className="w-full sm:w-auto" asChild><Link href="/properties">Cancel</Link></Button>
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={saving || loading || deleting}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Property"}</Button>
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
            <div className="space-y-2"><RequiredLabel>Type</RequiredLabel>
              <Select value={form.type_id} onValueChange={v => update("type_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{propertyTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Date (Optional)</Label><Input type="date" value={form.listing_date || ""} onChange={e => update("listing_date", e.target.value || undefined)} /></div>
          </div>
        </FormSection>

        <FormSection title="Pricing" description="Set the pricing details">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <RequiredLabel>Price</RequiredLabel>
              <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
                {(["USD", "IQD"] as const).map((currencyOption) => (
                  <button
                    key={currencyOption}
                    type="button"
                    onClick={() => update("currency", currencyOption)}
                    className={`h-7 min-w-[46px] rounded px-2 text-[11px] font-semibold transition-colors ${
                      form.currency === currencyOption
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-pressed={form.currency === currencyOption}
                  >
                    {currencyOption}
                  </button>
                ))}
              </div>
            </div>
            <Input type="text" inputMode="numeric" value={formatPriceInput(form.price)} onChange={e => update("price", parsePriceInput(e.target.value))} placeholder="0" />
          </div>
        </FormSection>

        <FormSection title="Location" description="Where is this property located?">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>City (Optional)</Label>
              <Select value={form.city_id} onValueChange={v => update("city_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <RequiredLabel>Area</RequiredLabel>
              <Select value={form.area} onValueChange={(value) => update("area", value)}>
                <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                <SelectContent>
                  {form.area.trim() && !areaNames.includes(form.area.trim()) ? (
                    <SelectItem className="my-1 rounded-md border border-border/60" value={form.area}>Current: {form.area}</SelectItem>
                  ) : null}
                  {areaNames.map((areaName, index) => (
                    <SelectItem className="my-1 rounded-md border border-border/60" key={areaName} value={areaName}>{index + 1}. {areaName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {areaNames.length === 0 ? (
                <p className="text-xs text-muted-foreground">No areas configured. Add values in App Variables.</p>
              ) : null}
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Property Number (Optional)</Label>
              <Input
                value={getPreferredText(form.address_en, form.address_ku, form.address_ar)}
                onChange={(e) => {
                  const value = e.target.value;
                  update("address_en", value);
                  update("address_ku", value);
                  update("address_ar", value);
                }}
                placeholder="Enter property number"
              />
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
            <div className="space-y-2"><RequiredLabel>Area Size (m²)</RequiredLabel><Input type="number" min={0} value={form.area_size || ""} onChange={e => update("area_size", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Bedrooms (Optional)</Label><Input type="number" min={0} value={form.bedrooms || ""} onChange={e => update("bedrooms", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Suit Rooms (Optional)</Label><Input type="number" min={0} value={form.suit_rooms || ""} onChange={e => update("suit_rooms", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Bathrooms (Optional)</Label><Input type="number" min={0} value={form.bathrooms || ""} onChange={e => update("bathrooms", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Balconies (Optional)</Label><Input type="number" min={0} value={form.balconies || ""} onChange={e => update("balconies", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Floors (Optional)</Label><Input type="number" min={0} value={form.floors || ""} onChange={e => update("floors", Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="space-y-2"><Label>Unit Floor Number (Optional)</Label><Input type="number" min={0} value={form.unit_floor_number ?? ""} onChange={e => update("unit_floor_number", parseOptionalNumber(e.target.value))} /></div>
            {showTowerNumber ? (
              <div className="space-y-2"><Label>Tower Number (Optional)</Label><Input value={form.tower_number || ""} onChange={e => update("tower_number", e.target.value)} /></div>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Media" description="Upload property images and video">
          <div className="space-y-5">
            <div>
              <Label className="mb-3 block">Images (Optional)</Label>
              <ImageUpload
                images={form.images}
                mainImage={form.main_image}
                onMainImageChange={(imageUrl) => update("main_image", imageUrl)}
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

                  const nextMainImage =
                    imgs.includes(form.main_image || "") ? form.main_image : imgs[0];

                  update("images", imgs);
                  update("main_image", nextMainImage);
                }}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="block">Video (Optional)</Label>
              <Input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*"
                onChange={handleVideoFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Supported: MP4, MOV, WEBM, MKV. Videos above 30MB are compressed before upload.
              </p>

              {activeVideoUrl ? (
                <div className="space-y-2">
                  <video
                    className="w-full max-h-64 rounded-md border bg-black object-contain"
                    src={activeVideoUrl}
                    controls
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {isEdit && !localVideoPreviewUrl && form.video_url ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="destructive" size="sm" disabled={deletingVideo}>
                            {deletingVideo ? "Deleting..." : "Delete from Server"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Video?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the uploaded video from the server immediately. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={(e) => {
                                e.preventDefault();
                                void handleDeleteVideo();
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          clearLocalVideoSelection();
                          update("video_url", "");
                        }}
                      >
                        Remove Video
                      </Button>
                    )}
                    {localVideoFile ? (
                      <p className="text-xs text-muted-foreground truncate">{localVideoFile.name}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No video uploaded.</p>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title="Contact Information" description="Owner, agent, and assignment details">
          <div className="grid gap-5 sm:grid-cols-2">
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

            <div className="space-y-2">
              <Label>Assigned Viewer (Optional)</Label>
              <Select
                value={form.assigned_viewer_id || OPTIONAL_LINK_NONE}
                onValueChange={(value) =>
                  update("assigned_viewer_id", value === OPTIONAL_LINK_NONE ? undefined : value)
                }
              >
                <SelectTrigger><SelectValue placeholder="Select viewer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>None</SelectItem>
                  {!hasOptionById(viewers, form.assigned_viewer_id) && form.assigned_viewer_id ? (
                    <SelectItem value={form.assigned_viewer_id}>Current: {form.assigned_viewer_id}</SelectItem>
                  ) : null}
                  {viewers.map((viewer) => (
                    <SelectItem key={viewer.id} value={viewer.id}>
                      {viewer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canViewAgentContact ? (
              <>
                <div className="space-y-2"><Label>Contact Name (Optional)</Label><Input value={form.contact_name} onChange={e => update("contact_name", e.target.value)} placeholder="Enter contact person name" /></div>
                <div className="space-y-2"><Label>Primary Mobile Number (Optional)</Label><Input value={form.primary_mobile_number} onChange={e => update("primary_mobile_number", e.target.value)} placeholder="+9647504001122" /></div>
              </>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Internal Notes" description="Private notes not visible to clients (optional)">
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea value={form.internal_notes || ""} onChange={e => update("internal_notes", e.target.value)} placeholder="Add any internal notes here..." rows={4} />
          </div>
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
