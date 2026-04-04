import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit,
  ImageIcon,
  Layers3,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { getPropertyById } from "@/modules/properties/property.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import type { Property } from "@/types";
import type { AppVariableItem } from "@/modules/app-variables/types";

const LocationPreviewMap = dynamic(
  () => import("@/components/PropertyLocationMap").then((mod) => mod.PropertyLocationPreviewMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 w-full rounded-lg border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium break-words">
      {value === null || value === undefined || value === "" ? "—" : value}
    </p>
  </div>
);

function findVariableName(items: AppVariableItem[], id?: string) {
  if (!id) {
    return "—";
  }

  return items.find((item) => item.id === id)?.name || id;
}

function formatEnumLabel(value?: string | null) {
  if (!value) {
    return "—";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const PropertyDetail = () => {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [amenities, setAmenities] = useState<AppVariableItem[]>([]);
  const [views, setViews] = useState<AppVariableItem[]>([]);

  useEffect(() => {
    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getPropertyById(id)
      .then((item) => {
        if (!cancelled) {
          setProperty(item);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load property.";
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
  }, [authLoading, id, user]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;
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

        setPropertyTypes(types);
        setCities(citiesList);
        setAmenities(amenitiesList);
        setViews(viewsList);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load lookup values.";
          setLookupError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!property) {
      setActiveImageIndex(0);
      return;
    }

    const availableImages =
      property.images.length > 0 ? property.images : property.main_image ? [property.main_image] : [];

    setActiveImageIndex((current) => {
      if (availableImages.length === 0) {
        return 0;
      }

      return current >= availableImages.length ? 0 : current;
    });
  }, [property]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading property...</p>;
  }

  if (error) {
    return <EmptyState title="Failed to load property" description={error} />;
  }

  if (!property) {
    return <EmptyState title="Property not found" description="The property you're looking for doesn't exist." />;
  }

  const typeName = findVariableName(propertyTypes, property.type_id);
  const cityName = findVariableName(cities, property.city_id);
  const viewName = findVariableName(views, property.view_id);
  const amenityNames = property.amenities.map((amenityId) => findVariableName(amenities, amenityId));
  const listingTypeLabel = property.listing_type === "sale" ? "For Sale" : "For Rent";
  const conditionLabel = formatEnumLabel(property.condition);
  const statusLabel = formatEnumLabel(property.status);
  const paymentTypeLabel = formatEnumLabel(property.payment_type);
  const ownershipTypeLabel = formatEnumLabel(property.ownership_type);
  const images = property.images.length > 0 ? property.images : property.main_image ? [property.main_image] : [];
  const safeImageIndex = images.length > 0 && activeImageIndex < images.length ? activeImageIndex : 0;
  const activeImage = images.length > 0 ? images[safeImageIndex] : undefined;
  const priceLabel = `${property.currency} ${property.price.toLocaleString()}`;
  const coordinates =
    typeof property.lat === "number" && Number.isFinite(property.lat) && typeof property.lng === "number" && Number.isFinite(property.lng)
      ? { lat: property.lat, lng: property.lng }
      : null;

  const showImageControls = images.length > 1;

  const showPreviousImage = () => {
    if (!showImageControls) {
      return;
    }

    setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
  };

  const showNextImage = () => {
    if (!showImageControls) {
      return;
    }

    setActiveImageIndex((current) => (current + 1) % images.length);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight truncate">Property Details</h1>
            <StatusBadge status={property.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{typeName} · {listingTypeLabel} · {cityName}</p>
        </div>

        <Button asChild className="shrink-0">
          <Link href={`/properties/${id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit Property</Link>
        </Button>
      </div>

      {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="bg-muted/20 p-4 md:p-6">
          <div className="flex flex-col space-y-4">
            <div className="relative w-full">
              {activeImage ? (
                <button
                  type="button"
                  className="block w-full cursor-zoom-in"
                  onClick={() => setIsImageZoomOpen(true)}
                  aria-label="Zoom image"
                >
                  <img
                    src={activeImage}
                    alt={`Property image ${safeImageIndex + 1}`}
                    className="w-full rounded-lg h-[18rem] md:h-[34rem] object-contain bg-muted/30"
                  />
                </button>
              ) : (
                <div className="h-[18rem] w-full rounded-lg border bg-muted/30 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <ImageIcon className="h-9 w-9 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No image uploaded</p>
                  </div>
                </div>
              )}

              {showImageControls ? (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-background/90"
                    onClick={showPreviousImage}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-background/90"
                    onClick={showNextImage}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div className="grid w-full grid-cols-4 gap-4">
                {images.map((imageUrl, index) => (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className={`rounded-lg md:h-24 h-14 w-full object-cover cursor-pointer hover:opacity-80 ${
                      index === safeImageIndex ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                    }`}
                    onClick={() => setActiveImageIndex(index)}
                  />
                ))}
              </div>
            ) : null}

            {images.length > 0 ? (
              <div className="w-full flex justify-end text-xs text-muted-foreground">
                <span>
                  {safeImageIndex + 1} / {images.length}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-6 bg-gradient-to-br from-background via-background to-muted/25">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asking Price</p>
          <p className="text-3xl font-bold leading-tight mt-1">{priceLabel}</p>

          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
              {listingTypeLabel}
            </span>
            <span className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
              {statusLabel}
            </span>
            <span className="inline-flex items-center rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
              {conditionLabel}
            </span>
          </div>

          <Separator className="my-5" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Bedrooms</p>
              <p className="text-lg font-semibold mt-1">{property.bedrooms}</p>
            </div>
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Bathrooms</p>
              <p className="text-lg font-semibold mt-1">{property.bathrooms}</p>
            </div>
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Area Size</p>
              <p className="text-lg font-semibold mt-1">{property.area_size} m2</p>
            </div>
            <div className="rounded-lg border bg-background/75 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Floors</p>
              <p className="text-lg font-semibold mt-1">{property.floors}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isImageZoomOpen} onOpenChange={setIsImageZoomOpen}>
        <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none [&>button]:right-3 [&>button]:top-3 [&>button]:rounded-full [&>button]:bg-black/70 [&>button]:text-white [&>button]:opacity-100">
          <DialogTitle className="sr-only">Image zoom preview</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged preview for property image {safeImageIndex + 1} of {images.length || 1}.
          </DialogDescription>
          {activeImage ? (
            <div className="relative">
              <img
                src={activeImage}
                alt={`Zoomed property image ${safeImageIndex + 1}`}
                className="h-[85vh] w-[95vw] rounded-lg bg-black/90 object-contain"
              />

              {showImageControls ? (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/80"
                    onClick={showPreviousImage}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/80"
                    onClick={showNextImage}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Ruler className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Area Size</span>
            </div>
            <p className="text-lg font-semibold">{property.area_size} m2</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BedDouble className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Bedrooms</span>
            </div>
            <p className="text-lg font-semibold">{property.bedrooms}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Bath className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Bathrooms</span>
            </div>
            <p className="text-lg font-semibold">{property.bathrooms}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Layers3 className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Floors</span>
            </div>
            <p className="text-lg font-semibold">{property.floors}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Layers3 className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Balconies</span>
            </div>
            <p className="text-lg font-semibold">{property.balconies}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <LocationPreviewMap coordinates={coordinates} />

              <div className="grid grid-cols-2 gap-4">
                <Field label="City" value={cityName} />
                <Field label="Area" value={property.area} />
                <Field label="Latitude" value={property.lat} />
                <Field label="Longitude" value={property.lng} />
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address (EN)</p>
                  <p className="text-sm font-medium mt-1 break-words">{property.address_en || "—"}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address (KU)</p>
                  <p className="text-sm font-medium mt-1 break-words">{property.address_ku || "—"}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address (AR)</p>
                  <p className="text-sm font-medium mt-1 break-words">{property.address_ar || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">English</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{property.description_en || "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kurdish</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{property.description_ku || "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arabic</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{property.description_ar || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.internal_notes || "—"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Type" value={typeName} />
              <Field label="Listing Type" value={listingTypeLabel} />
              <Field label="Status" value={statusLabel} />
              <Field label="Condition" value={conditionLabel} />
              <Field label="Ownership Type" value={ownershipTypeLabel} />
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Features & Amenities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="View" value={viewName} />
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Amenities</p>
                {amenityNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {amenityNames.map((amenityName) => (
                      <span
                        key={amenityName}
                        className="inline-flex items-center rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {amenityName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No amenities selected.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Building Info</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Land Number" value={property.land_number} />
              <Field label="Total Floors" value={property.total_floors} />
              <Field label="Unit Floor Number" value={property.unit_floor_number} />
              <Field label="Building Name" value={property.building_name} />
              <Field label="Tower Number" value={property.tower_number} />
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field label="Contact Name" value={property.contact_name} />
              <Field label="Primary Mobile Number" value={property.primary_mobile_number} />
              <Field label="Secondary Mobile Number" value={property.secondary_mobile_number} />
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing & Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Price" value={property.price.toLocaleString()} />
                <Field label="Currency" value={property.currency} />
                <Field label="Payment Type" value={paymentTypeLabel} />
                <Field label="Listing" value={listingTypeLabel} />
              </div>

              <Separator />

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video URL</p>
                {property.video_url ? (
                  <a
                    href={property.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline break-all"
                  >
                    {property.video_url}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">No video attached.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Relations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Linked Records</span>
              </div>

              <div className="grid gap-4">
                <Field label="Project" value={property.project_id} />
                <Field label="Owner Client" value={property.owner_client_id} />
                <Field label="Assigned Company" value={property.assigned_company_id} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
