import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit,
  ImageIcon,
  Layers3,
  PhoneCall,
  Ruler,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { getProperties } from "@/modules/properties/property.client";
import { getProjectById } from "@/modules/projects/project.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { useAuth } from "@/lib/auth/useAuth";
import type { Project, Property } from "@/types";

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="space-y-0.5">
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-sm font-semibold text-slate-800 break-words">
      {value === null || value === undefined || value === "" ? (
        <span className="text-slate-300 font-normal">N/A</span>
      ) : value}
    </p>
  </div>
);

function findVariableName(items: AppVariableItem[], id?: string) {
  if (!id) {
    return "N/A";
  }

  return items.find((item) => item.id === id)?.name || id;
}

function formatEnumLabel(value?: string | null) {
  if (!value) {
    return "N/A";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function GoogleMapPreview({
  coordinates,
}: {
  coordinates: { lat: number; lng: number } | null;
}) {
  if (!coordinates) {
    return (
      <div className="h-72 md:h-80 w-full rounded-xl border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        No coordinates available.
      </div>
    );
  }

  const coordinateQuery = `${coordinates.lat},${coordinates.lng}`;
  const googleMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    coordinateQuery,
  )}&z=16&output=embed`;

  return (
    <div className="h-72 md:h-80 w-full overflow-hidden rounded-xl border shadow-sm bg-slate-100">
      <iframe
        title="Project location map"
        src={googleMapEmbedUrl}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}

const ProjectDetail = () => {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;

  const [project, setProject] = useState<Project | null>(null);
  const [projectProperties, setProjectProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [unitDataError, setUnitDataError] = useState<string | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [amenities, setAmenities] = useState<AppVariableItem[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [activeDescriptionLang, setActiveDescriptionLang] = useState<"en" | "ku" | "ar">("en");

  useEffect(() => {
    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getProjectById(id)
      .then((item) => {
        if (!cancelled) {
          setProject(item || null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load project.";
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
    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;

    setUnitDataError(null);

    getProperties()
      .then((items) => {
        if (cancelled) {
          return;
        }

        const relatedProperties = (items as Property[]).filter((property) => property.project_id === id);
        setProjectProperties(relatedProperties);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load project units.";
          setUnitDataError(message);
          setProjectProperties([]);
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

    Promise.all([getVariables("property_types"), getVariables("cities"), getVariables("amenities")])
      .then(([types, citiesList, amenitiesList]) => {
        if (cancelled) {
          return;
        }

        setPropertyTypes(types);
        setCities(citiesList);
        setAmenities(amenitiesList);
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
    if (!project) {
      setActiveImageIndex(0);
      return;
    }

    const availableImages =
      project.images.length > 0 ? project.images : project.main_image ? [project.main_image] : [];

    setActiveImageIndex((current) => {
      if (availableImages.length === 0) {
        return 0;
      }

      return current >= availableImages.length ? 0 : current;
    });
  }, [project]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400 text-sm">Loading project...</div>
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load project" description={error} />;
  }

  if (!project) {
    return <EmptyState title="Project not found" description="The project you are looking for does not exist." />;
  }

  const descriptionEn = project.description_en || project.description || "";
  const descriptionKu = project.description_ku || "";
  const descriptionAr = project.description_ar || "";

  const projectCode = `PJ${project.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "0")}`;
  const cityName = findVariableName(cities, project.city_id);
  const typeNames = (project.property_type_ids || []).map((item) => findVariableName(propertyTypes, item));
  const amenityNames = (project.amenities || []).map((item) => findVariableName(amenities, item));
  const typeLabel = typeNames.length > 0 ? typeNames.join(", ") : "N/A";
  const statusLabel = formatEnumLabel(project.status);
  const paymentTypeLabel = formatEnumLabel(project.payment_type);
  const totalUnits = projectProperties.length;
  const availableUnits = projectProperties.filter((property) => property.status === "available").length;
  const soldUnits = projectProperties.filter((property) => property.status === "sold").length;
  const hasUnitsLabel = totalUnits > 0 ? "Yes" : "No";
  const priceLabel = `${project.currency} ${project.starting_price.toLocaleString()}`;

  const activeDescription =
    activeDescriptionLang === "en"
      ? descriptionEn
      : activeDescriptionLang === "ku"
        ? descriptionKu
        : descriptionAr;

  const images = project.images.length > 0 ? project.images : project.main_image ? [project.main_image] : [];
  const safeImageIndex = images.length > 0 && activeImageIndex < images.length ? activeImageIndex : 0;
  const activeImage = images.length > 0 ? images[safeImageIndex] : undefined;
  const showImageControls = images.length > 1;

  const coordinates =
    typeof project.lat === "number" &&
    Number.isFinite(project.lat) &&
    typeof project.lng === "number" &&
    Number.isFinite(project.lng)
      ? { lat: project.lat, lng: project.lng }
      : null;
  const canViewAgentContact = user?.role === "admin";

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

  const relationRows = [
    { label: "Assigned Company", value: project.assigned_company_id || "N/A" },
    { label: "Area", value: project.area || "N/A" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <p className="text-xs text-slate-400 font-medium">Projects / Project Details</p>
          </div>

          <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
            <p className="font-semibold text-slate-800 truncate">{project.title}</p>
            <StatusBadge status={project.status} />
          </div>

          <Button asChild className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
            <Link href={`/projects/${project.id}/edit`}><Edit className="h-4 w-4" />Edit Project</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}
        {unitDataError ? <p className="text-sm text-destructive">{unitDataError}</p> : null}

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
                      alt={`Project image ${safeImageIndex + 1}`}
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
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">STARTING PRICE</p>
              <p className="text-4xl font-bold text-slate-900 mt-1">{priceLabel}</p>
              <p className="text-sm text-slate-500 mt-1">{paymentTypeLabel}</p>
              <p className="text-xs font-mono text-slate-500 mt-2">ID: {projectCode}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase">City</p>
                <p className="text-sm font-semibold text-slate-700">{cityName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Status</p>
                <p className="text-sm font-semibold text-slate-700">{statusLabel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Property Types</p>
                <p className="text-sm font-semibold text-slate-700">{typeLabel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Has Units</p>
                <p className="text-sm font-semibold text-slate-700">{hasUnitsLabel}</p>
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
                  <p className="font-semibold text-slate-800">{project.contact_name || "N/A"}</p>
                  <p className="text-sm text-slate-500">{project.primary_mobile_number || "N/A"}</p>
                  {project.secondary_mobile_number ? (
                    <p className="text-sm text-slate-500">{project.secondary_mobile_number}</p>
                  ) : null}
                </div>
              </>
            ) : null}

            <Button asChild className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
              <Link href={`/projects/${id}/edit`}><Edit className="h-4 w-4" />Edit Project</Link>
            </Button>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Ruler className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{project.area_size.toLocaleString()} m2</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Area Size</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Layers3 className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{totalUnits}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Units</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{availableUnits}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Available Units</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col items-start gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{soldUnits}</p>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sold Units</p>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Address (EN)</p>
                    <p className="text-sm text-slate-700">{project.address_en || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Address (KU)</p>
                    <p className="text-sm text-slate-700">{project.address_ku || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Address (AR)</p>
                    <p className="text-sm text-slate-700">{project.address_ar || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      activeDescriptionLang === "en"
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setActiveDescriptionLang("en")}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      activeDescriptionLang === "ku"
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setActiveDescriptionLang("ku")}
                  >
                    KU
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                      activeDescriptionLang === "ar"
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setActiveDescriptionLang("ar")}
                  >
                    AR
                  </button>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[80px]">
                  {activeDescription || "N/A"}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {project.internal_notes ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900 whitespace-pre-wrap">
                    {project.internal_notes}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm italic">No internal notes.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">Overview</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Project ID" value={projectCode} />
                  <Field label="Status" value={statusLabel} />
                  <Field label="City" value={cityName} />
                  <Field label="Area" value={project.area || "N/A"} />
                  <Field label="Area Size" value={`${project.area_size.toLocaleString()} m2`} />
                  <Field label="Has Units" value={hasUnitsLabel} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Features & Amenities</p>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Property Types</p>
                  {typeNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {typeNames.map((typeName, index) => (
                        <span
                          key={`${typeName}-${index}`}
                          className="bg-slate-100 text-slate-700 rounded-lg px-3 py-1 text-xs font-medium"
                        >
                          {typeName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">No property types selected.</p>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Amenities</p>
                  {amenityNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {amenityNames.map((amenityName, index) => (
                        <span
                          key={`${amenityName}-${index}`}
                          className="bg-slate-100 text-slate-700 rounded-lg px-3 py-1 text-xs font-medium"
                        >
                          {amenityName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">No amenities selected.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">Units & Pricing</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Starting Price" value={project.starting_price.toLocaleString()} />
                  <Field label="Currency" value={project.currency} />
                  <Field label="Payment Type" value={paymentTypeLabel} />
                  <Field label="Total Units" value={totalUnits} />
                  <Field label="Available Units" value={availableUnits} />
                  <Field label="Sold Units" value={soldUnits} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
                  {canViewAgentContact ? "Contact & Media" : "Media"}
                </p>

                {canViewAgentContact ? (
                  <>
                    <div className="grid grid-cols-1 gap-4">
                      <Field label="Contact Name" value={project.contact_name} />
                      <Field label="Primary Mobile Number" value={project.primary_mobile_number} />
                      <Field label="Secondary Mobile Number" value={project.secondary_mobile_number} />
                    </div>

                    <Separator />
                  </>
                ) : null}

                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" />
                    Video URL
                  </p>
                  {project.video_url ? (
                    <a
                      href={project.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline break-all"
                    >
                      {project.video_url}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-400">No video attached.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-2">Relations</p>
                <div>
                  {relationRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-400 uppercase">{row.label}</span>
                      <span className={`text-sm font-medium font-mono ${row.value === "N/A" ? "text-slate-300" : "text-slate-700"}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
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
            Enlarged preview for project image {safeImageIndex + 1} of {images.length || 1}.
          </DialogDescription>
          {activeImage ? (
            <div className="relative">
              <img
                src={activeImage}
                alt={`Zoomed project image ${safeImageIndex + 1}`}
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

export default ProjectDetail;
