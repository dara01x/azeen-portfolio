import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <p className="text-sm font-medium">{value === null || value === undefined || value === "" ? "—" : value}</p>
  </div>
);

function findVariableName(items: AppVariableItem[], id?: string) {
  if (!id) {
    return "—";
  }

  return items.find((item) => item.id === id)?.name || id;
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
  const conditionLabel = property.condition.replace(/_/g, " ");
  const images = property.images.length > 0 ? property.images : property.main_image ? [property.main_image] : [];
  const mainImage = property.main_image || images[0];
  const coordinates =
    typeof property.lat === "number" && Number.isFinite(property.lat) && typeof property.lng === "number" && Number.isFinite(property.lng)
      ? { lat: property.lat, lng: property.lng }
      : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight truncate">{property.title}</h1>
            <StatusBadge status={property.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{typeName} · {listingTypeLabel} · {cityName}</p>
          <p className="text-lg font-semibold mt-1">{property.currency} {property.price.toLocaleString()}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/properties/${id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit Property</Link>
        </Button>
      </div>

      {lookupError ? <p className="mb-4 text-sm text-destructive">{lookupError}</p> : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Images</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mainImage ? (
              <img src={mainImage} alt={property.title} className="w-full aspect-[16/9] rounded-lg object-cover border" />
            ) : (
              <div className="w-full aspect-[16/9] rounded-lg border bg-muted/40 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No main image</p>
                </div>
              </div>
            )}

            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((imageUrl, index) => (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt={`${property.title} gallery ${index + 1}`}
                    className="w-full aspect-video rounded-md border object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No gallery images uploaded.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Type" value={typeName} />
              <Field label="Listing Type" value={listingTypeLabel} />
              <Field label="Condition" value={conditionLabel} />
              <Field label="Status" value={property.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Price" value={property.price.toLocaleString()} />
              <Field label="Currency" value={property.currency} />
              <Field label="Payment Type" value={property.payment_type} />
              <Field label="Video URL" value={property.video_url} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Location</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <LocationPreviewMap coordinates={coordinates} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" value={cityName} />
                <Field label="Area" value={property.area} />
                <Field label="Latitude" value={property.lat} />
                <Field label="Longitude" value={property.lng} />
              </div>
              <Separator />
              <div className="grid gap-4">
                <Field label="Address (EN)" value={property.address_en} />
                <Field label="Address (KU)" value={property.address_ku} />
                <Field label="Address (AR)" value={property.address_ar} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Area Size (m2)" value={property.area_size} />
              <Field label="Bedrooms" value={property.bedrooms} />
              <Field label="Bathrooms" value={property.bathrooms} />
              <Field label="Floors" value={property.floors} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Features</CardTitle></CardHeader>
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

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Building Info</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Land Number" value={property.land_number} />
              <Field label="Total Floors" value={property.total_floors} />
              <Field label="Unit Floor Number" value={property.unit_floor_number} />
              <Field label="Building Name" value={property.building_name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="English" value={property.description_en} />
              <Field label="Kurdish" value={property.description_ku} />
              <Field label="Arabic" value={property.description_ar} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Relations</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Project" value={property.project_id} />
              <Field label="Owner Client" value={property.owner_client_id} />
              <Field label="Assigned Company" value={property.assigned_company_id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.internal_notes || "—"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
