import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Edit,
  ImageIcon,
  Layers3,
  PhoneCall,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/EmptyState";
import { getPropertyById } from "@/modules/properties/property.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { getUsers as fetchUsers } from "@/modules/users/user.client";
import { useAuth } from "@/lib/auth/useAuth";
import { DUHOK_DEFAULT_CENTER } from "@/lib/constants/map";
import type { Property, User } from "@/types";
import type { AppVariableItem } from "@/modules/app-variables/types";

type PropertyViewRecord = Property & {
  created_at?: string | null;
};

function GoogleMapPreview({
  coordinates,
}: {
  coordinates: { lat: number; lng: number } | null;
}) {
  const mapCoordinates = coordinates || DUHOK_DEFAULT_CENTER;
  const coordinateQuery = `${mapCoordinates.lat},${mapCoordinates.lng}`;
  const googleMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    coordinateQuery,
  )}&z=16&output=embed`;

  return (
    <div className="h-72 md:h-80 w-full overflow-hidden rounded-xl border shadow-sm bg-slate-100">
      <iframe
        title="Property location map"
        src={googleMapEmbedUrl}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="space-y-0.5">
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-sm font-semibold text-slate-800 break-words">
      {value === null || value === undefined || value === "" ? (
        <span className="text-slate-300 font-normal">—</span>
      ) : value}
    </p>
  </div>
);

function findVariableName(items: AppVariableItem[], id?: string) {
  if (!id) {
    return "—";
  }

  return items.find((item) => item.id === id)?.name || id;
}

function formatOptionalMetric(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : "—";
}

function formatPropertyDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString();
}

const PropertyDetail = () => {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const [property, setProperty] = useState<PropertyViewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [companies, setCompanies] = useState<User[]>([]);

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
    ])
      .then(([types, citiesList]) => {
        if (cancelled) {
          return;
        }

        setPropertyTypes(types);
        setCities(citiesList);
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
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;

    fetchUsers()
      .then((items) => {
        if (!cancelled) {
          setCompanies((items as User[]).filter((item) => item.role === "company"));
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load companies.";
          setLookupError((prev) => prev || message);
          setCompanies([]);
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400 text-sm">Loading property...</div>
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load property" description={error} />;
  }

  if (!property) {
    return <EmptyState title="Property not found" description="The property you're looking for doesn't exist." />;
  }

  const typeName = findVariableName(propertyTypes, property.type_id);
  const cityName = findVariableName(cities, property.city_id);
  const assignedCompanyName = (() => {
    if (!property.assigned_company_id) {
      return "—";
    }

    const assignedCompany = companies.find((item) => item.id === property.assigned_company_id);
    if (!assignedCompany) {
      return "—";
    }

    return assignedCompany.company_name || assignedCompany.full_name || "—";
  })();
  const images = property.images.length > 0 ? property.images : property.main_image ? [property.main_image] : [];
  const safeImageIndex = images.length > 0 && activeImageIndex < images.length ? activeImageIndex : 0;
  const activeImage = images.length > 0 ? images[safeImageIndex] : undefined;
  const priceLabel = `${property.currency} ${property.price.toLocaleString()}`;
  const propertyCode =
    property.property_code ||
    `P${property.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "0")}`;
  const coordinates =
    typeof property.lat === "number" && Number.isFinite(property.lat) && typeof property.lng === "number" && Number.isFinite(property.lng)
      ? { lat: property.lat, lng: property.lng }
      : null;
  const canViewAgentContact = user?.role === "admin";
  const propertyDateLabel = formatPropertyDate(property.listing_date || property.created_at || null);

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
    <div className="min-h-screen bg-slate-50/50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/properties"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <p className="text-xs text-slate-400 font-medium">Properties / Property Details</p>
          </div>

          <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
            <p className="font-semibold text-slate-800 truncate">{typeName}</p>
          </div>

          <Button asChild className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
            <Link href={`/properties/${id}/edit`}><Edit className="h-4 w-4" />Edit Property</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="relative">
              {activeImage ? (
                <>
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in"
                    onClick={() => setIsImageZoomOpen(true)}
                    aria-label="Zoom image"
                  >
                    <img
                      src={activeImage}
                      alt={`Property image ${safeImageIndex + 1}`}
                      className="h-[420px] w-full object-cover"
                    />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                  {images.length > 0 ? (
                    <span className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                      {safeImageIndex + 1} / {images.length}
                    </span>
                  ) : null}
                </>
              ) : (
                <div className="h-[420px] w-full flex items-center justify-center text-muted-foreground bg-slate-50">
                  <div className="text-center">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No image uploaded</p>
                  </div>
                </div>
              )}

              {showImageControls ? (
                <>
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg hover:bg-white flex items-center justify-center transition-all"
                    onClick={showPreviousImage}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg hover:bg-white flex items-center justify-center transition-all"
                    onClick={showNextImage}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div className="flex gap-2 p-3 overflow-x-auto bg-slate-50 border-t border-slate-100">
                {images.map((imageUrl, index) => (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className={`w-20 h-16 flex-shrink-0 rounded-lg object-cover cursor-pointer ring-2 transition-all ${
                      index === safeImageIndex
                        ? "ring-slate-800 ring-offset-1"
                        : "ring-transparent hover:ring-slate-300"
                    }`}
                    onClick={() => setActiveImageIndex(index)}
                  />
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-6 h-fit">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">ASKING PRICE</p>
              <p className="text-4xl font-bold text-slate-900 mt-1">{priceLabel}</p>
              <p className="text-sm text-slate-500 mt-1">Date Listed: {propertyDateLabel}</p>
              <p className="text-xs font-mono text-slate-500 mt-2">ID: {propertyCode}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase">City</p>
                <p className="text-sm font-semibold text-slate-700">{cityName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Area</p>
                <p className="text-sm font-semibold text-slate-700">{property.area || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Type</p>
                <p className="text-sm font-semibold text-slate-700">{typeName}</p>
              </div>
            </div>

            {canViewAgentContact ? (
              <>
                <Separator />

                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-slate-600">
                    <PhoneCall className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Contact</span>
                  </div>
                  <p className="font-semibold text-slate-800">{property.contact_name || "—"}</p>
                  <p className="text-sm text-slate-500">{property.primary_mobile_number || "—"}</p>
                </div>
              </>
            ) : null}

            <Button asChild className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
              <Link href={`/properties/${id}/edit`}><Edit className="h-4 w-4" />Edit Property</Link>
            </Button>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Ruler className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{property.area_size} m2</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Area Size</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <BedDouble className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatOptionalMetric(property.bedrooms)}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Bedrooms</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <DoorOpen className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatOptionalMetric(property.suit_rooms)}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Suit Rooms</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Bath className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatOptionalMetric(property.bathrooms)}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Bathrooms</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Layers3 className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatOptionalMetric(property.floors)}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Floors</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Layers3 className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatOptionalMetric(property.balconies)}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Balconies</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <GoogleMapPreview coordinates={coordinates} />

                {coordinates ? (
                  <p className="text-xs text-slate-400 font-mono">
                    {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {property.internal_notes ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900 whitespace-pre-wrap">
                    {property.internal_notes}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm italic">No internal notes.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Video</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {property.video_url ? (
                  <>
                    <video
                      className="w-full max-h-72 rounded-xl border bg-black object-contain"
                      src={property.video_url}
                      controls
                    />
                    <a
                      href={property.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline break-all"
                    >
                      Open video in new tab
                    </a>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm italic">No video uploaded.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">Overview</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Property ID" value={propertyCode} />
                  <Field label="Type" value={typeName} />
                  <Field label="Area" value={property.area} />
                  <Field label="Date" value={propertyDateLabel} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">Building Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Property Number" value={property.land_number} />
                  <Field label="Unit Floor Number" value={property.unit_floor_number} />
                  <Field label="Tower Number" value={property.tower_number} />
                </div>
              </CardContent>
            </Card>

            {canViewAgentContact ? (
              <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">Contact Information</p>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Contact Name" value={property.contact_name} />
                    <Field label="Primary Mobile Number" value={property.primary_mobile_number} />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Pricing</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Price" value={property.price.toLocaleString()} />
                  <Field label="Currency" value={property.currency} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">Assignment</p>
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Assigned Company" value={assignedCompanyName} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default PropertyDetail;
