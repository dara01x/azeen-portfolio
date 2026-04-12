import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, ChevronLeft, ChevronRight, Edit, Eye, Home, Maximize, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { getProjectById } from "@/modules/projects/project.client";
import { getUnits } from "@/modules/units/unit.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { useAuth } from "@/lib/auth/useAuth";
import type { Project, Unit, UnitOption } from "@/types";

const Field = ({ label, value }: { label: string; value: string | number }) => (
  <div className="space-y-0.5">
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-sm font-semibold text-slate-800 break-words">{value}</p>
  </div>
);

function hasText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function firstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    if (hasText(value)) {
      return (value as string).trim();
    }
  }

  return "";
}

function findVariableName(items: AppVariableItem[], id: string) {
  return items.find((item) => item.id === id)?.name || id;
}

function formatEnumLabel(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getUnitOptions(unit: Unit): UnitOption[] {
  if (unit.properties && unit.properties.length > 0) {
    return unit.properties;
  }

  return [
    {
      price: Number(unit.price) || 0,
      currency: unit.currency === "IQD" ? "IQD" : "USD",
      interface: [],
      building_no: "",
      floor_no: unit.floor_number !== undefined ? String(unit.floor_number) : "",
      active: unit.status !== "sold",
      sold: unit.status === "sold",
    },
  ];
}

function getUnitFeatures(unit: Unit) {
  return {
    bedrooms: Number(unit.features?.bedrooms ?? unit.bedrooms ?? 0),
    bathrooms: Number(unit.features?.bathrooms ?? unit.bathrooms ?? 0),
    suitRooms: Number(unit.features?.suit_rooms ?? unit.suit_rooms ?? 0),
  };
}

function formatUnitOptionPrice(option: UnitOption) {
  const price = Number(option.price) || 0;
  const currencyLabel = option.currency === "IQD" ? "IQD" : "USD";

  return `${price.toLocaleString()} ${currencyLabel}`;
}

function getUnitOptionStatusLabel(option: UnitOption) {
  if (option.sold) {
    return "Sold";
  }

  if (option.active) {
    return "Available";
  }

  return "Inactive";
}

function getUnitImages(unit: Unit): string[] {
  if (Array.isArray(unit.images) && unit.images.length > 0) {
    return unit.images;
  }

  if (unit.main_image) {
    return [unit.main_image];
  }

  return [];
}

function getUnitOptionStats(unit: Unit) {
  const options = getUnitOptions(unit);
  const soldCount = options.filter((option) => option.sold).length;
  const availableCount = options.filter((option) => option.active && !option.sold).length;

  return {
    total: options.length,
    sold: soldCount,
    available: availableCount,
  };
}

const ProjectDetail = () => {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [isUnitViewOpen, setIsUnitViewOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [activeUnitImageIndex, setActiveUnitImageIndex] = useState(0);
  const [isUnitImageZoomOpen, setIsUnitImageZoomOpen] = useState(false);

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

    setUnitsLoading(true);
    setUnitsError(null);

    getUnits()
      .then((items) => {
        if (!cancelled) {
          setUnits((items as Unit[]).filter((item) => item.project_id === id));
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load units.";
          setUnitsError(message);
          setUnits([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setUnitsLoading(false);
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

    Promise.all([getVariables("property_types"), getVariables("cities")])
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

  useEffect(() => {
    if (!selectedUnit) {
      setActiveUnitImageIndex(0);
      setIsUnitImageZoomOpen(false);
      return;
    }

    const unitImages = getUnitImages(selectedUnit);
    setActiveUnitImageIndex((current) => {
      if (unitImages.length === 0) {
        return 0;
      }

      return current >= unitImages.length ? 0 : current;
    });
  }, [selectedUnit]);

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

  const projectCode = `PJ${project.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "0")}`;

  const cityLabel = hasText(project.city_id) ? findVariableName(cities, project.city_id) : "";
  const typeNames = (project.property_type_ids || []).map((item) => findVariableName(propertyTypes, item));
  const typeLabel = typeNames.length > 0 ? typeNames.join(", ") : "";
  const statusLabel = formatEnumLabel(project.status);
  const areaLabel = firstNonEmpty(project.area);
  const addressLabel = firstNonEmpty(project.address, project.address_en, project.address_ku, project.address_ar);
  const descriptionLabel = firstNonEmpty(
    project.description,
    project.description_en,
    project.description_ku,
    project.description_ar,
  );
  const notesLabel = firstNonEmpty(project.internal_notes);
  const videoUrl = firstNonEmpty(project.video_url);
  const assignedCompanyLabel = firstNonEmpty(project.assigned_company_id);

  const images = project.images.length > 0 ? project.images : project.main_image ? [project.main_image] : [];
  const hasImages = images.length > 0;
  const safeImageIndex = images.length > 0 && activeImageIndex < images.length ? activeImageIndex : 0;
  const activeImage = images.length > 0 ? images[safeImageIndex] : undefined;
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

  const summaryItems = [
    statusLabel ? { label: "Status", value: statusLabel } : null,
    cityLabel ? { label: "City", value: cityLabel } : null,
    typeLabel ? { label: "Property Types", value: typeLabel } : null,
    areaLabel ? { label: "Area", value: areaLabel } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  const locationItems = [
    cityLabel ? { label: "City", value: cityLabel } : null,
    areaLabel ? { label: "Area", value: areaLabel } : null,
    addressLabel ? { label: "Address", value: addressLabel } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  const overviewItems = [
    { label: "Project ID", value: projectCode },
    statusLabel ? { label: "Status", value: statusLabel } : null,
    cityLabel ? { label: "City", value: cityLabel } : null,
    areaLabel ? { label: "Area", value: areaLabel } : null,
    addressLabel ? { label: "Address", value: addressLabel } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  const showLocationCard = locationItems.length > 0;
  const showDescriptionCard = !!descriptionLabel;
  const showNotesCard = !!notesLabel;
  const showOverviewCard = overviewItems.length > 0;
  const showTypesCard = typeNames.length > 0;
  const showVideoCard = !!videoUrl;
  const showRelationsCard = !!assignedCompanyLabel;
  const showLeftColumn = showLocationCard || showDescriptionCard || showNotesCard;
  const showRightColumn = showOverviewCard || showTypesCard || showVideoCard || showRelationsCard;
  const getUnitTypeLabel = (typeId?: string) => (typeId ? findVariableName(propertyTypes, typeId) : "No type");
  const closeUnitView = () => {
    setIsUnitImageZoomOpen(false);
    setIsUnitViewOpen(false);
    setSelectedUnit(null);
  };

  const selectedUnitImages = selectedUnit ? getUnitImages(selectedUnit) : [];
  const hasSelectedUnitImages = selectedUnitImages.length > 0;
  const safeSelectedUnitImageIndex =
    selectedUnitImages.length > 0 && activeUnitImageIndex < selectedUnitImages.length ? activeUnitImageIndex : 0;
  const selectedUnitActiveImage =
    selectedUnitImages.length > 0 ? selectedUnitImages[safeSelectedUnitImageIndex] : undefined;
  const showSelectedUnitImageControls = selectedUnitImages.length > 1;

  const showPreviousSelectedUnitImage = () => {
    if (!showSelectedUnitImageControls) {
      return;
    }

    setActiveUnitImageIndex((current) => (current - 1 + selectedUnitImages.length) % selectedUnitImages.length);
  };

  const showNextSelectedUnitImage = () => {
    if (!showSelectedUnitImageControls) {
      return;
    }

    setActiveUnitImageIndex((current) => (current + 1) % selectedUnitImages.length);
  };

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
            {statusLabel ? <StatusBadge status={project.status} /> : null}
          </div>

          <Button asChild className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
            <Link href={`/projects/${project.id}/edit`}><Edit className="h-4 w-4" />Edit Project</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}

        <div className={`grid grid-cols-1 ${hasImages ? "xl:grid-cols-[1fr_380px]" : ""} gap-6`}>
          {hasImages ? (
            <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <div className="relative">
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
                <span className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                  {safeImageIndex + 1} / {images.length}
                </span>

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
          ) : null}

          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-6 h-fit">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">PROJECT CODE</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{projectCode}</p>
              <p className="text-sm text-slate-500 mt-1">{project.title}</p>
            </div>

            {summaryItems.length > 0 ? (
              <>
                <Separator />

                <div className={`grid ${summaryItems.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
                  {summaryItems.map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-slate-400 uppercase">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <Button asChild className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
              <Link href={`/projects/${id}/edit`}><Edit className="h-4 w-4" />Edit Project</Link>
            </Button>
          </Card>
        </div>

        {showLeftColumn || showRightColumn ? (
          <div className={`grid grid-cols-1 ${showLeftColumn && showRightColumn ? "xl:grid-cols-[1fr_380px]" : ""} gap-6`}>
            {showLeftColumn ? (
              <div className="space-y-6">
                {showLocationCard ? (
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Location</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`grid ${locationItems.length > 1 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"} gap-4`}>
                        {locationItems.map((item) => (
                          <Field key={item.label} label={item.label} value={item.value} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showDescriptionCard ? (
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[80px]">
                        {descriptionLabel}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showNotesCard ? (
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Internal Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-900 whitespace-pre-wrap">
                        {notesLabel}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {showRightColumn ? (
              <div className="space-y-6">
                {showOverviewCard ? (
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                      <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-4">Overview</p>
                      <div className={`grid ${overviewItems.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
                        {overviewItems.map((item) => (
                          <Field key={item.label} label={item.label} value={item.value} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showTypesCard ? (
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Property Types</p>
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
                    </CardContent>
                  </Card>
                ) : null}

                {showVideoCard ? (
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">Media</p>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider inline-flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5" />
                          Video URL
                        </p>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline break-all"
                        >
                          {videoUrl}
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {showRelationsCard ? (
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                      <p className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3 mb-2">Relations</p>
                      <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                        <span className="text-xs text-slate-400 uppercase">Assigned Company</span>
                        <span className="text-sm font-medium font-mono text-slate-700">{assignedCompanyLabel}</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Available Units</CardTitle>
              {!unitsLoading && !unitsError ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {units.length} {units.length === 1 ? "Unit" : "Units"}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {unitsLoading ? (
              <p className="text-sm text-slate-500">Loading units...</p>
            ) : unitsError ? (
              <p className="text-sm text-destructive">{unitsError}</p>
            ) : units.length === 0 ? (
              <p className="text-sm text-slate-500">No units have been added to this project yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {units.map((unit) => {
                  const unitOptions = getUnitOptions(unit);
                  const optionStats = getUnitOptionStats(unit);
                  const unitFeatures = getUnitFeatures(unit);
                  const unitTypeLabel = getUnitTypeLabel(unit.type_id);
                  const coverImage = unit.main_image || unit.images?.[0];

                  return (
                    <div
                      key={unit.id}
                      className="overflow-hidden rounded-xl border border-slate-200 transition-all hover:border-blue-300 hover:shadow-md"
                    >
                      {coverImage ? (
                        <div className="relative h-44 bg-slate-100">
                          <img src={coverImage} alt={unit.title || unitTypeLabel} className="h-full w-full object-cover" />
                        </div>
                      ) : null}

                      <div className="p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{unit.title || unitTypeLabel}</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                              <Maximize className="h-3.5 w-3.5" />
                              {(Number(unit.area_size) || 0).toLocaleString()} m2
                            </p>
                          </div>
                          <StatusBadge status={unit.status} />
                        </div>

                        <p className="text-xs text-slate-500">
                          {unitTypeLabel}
                          {unit.unit_number ? ` • ${unit.unit_number}` : ""}
                        </p>

                        {unitFeatures.bedrooms > 0 || unitFeatures.bathrooms > 0 || unitFeatures.suitRooms > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                            {unitFeatures.bedrooms > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <BedDouble className="h-3.5 w-3.5" />
                                {unitFeatures.bedrooms} Bed{unitFeatures.bedrooms === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {unitFeatures.bathrooms > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <Bath className="h-3.5 w-3.5" />
                                {unitFeatures.bathrooms} Bath{unitFeatures.bathrooms === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {unitFeatures.suitRooms > 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <Home className="h-3.5 w-3.5" />
                                {unitFeatures.suitRooms} Suite{unitFeatures.suitRooms === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <p className="mb-2 text-xs font-medium text-slate-500">
                            {optionStats.total} {optionStats.total === 1 ? "Option" : "Options"} • {optionStats.available} Available
                            {optionStats.sold > 0 ? ` • ${optionStats.sold} Sold` : ""}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {unitOptions.slice(0, 3).map((option, index) => (
                              <span
                                key={`${unit.id}-option-${index}`}
                                className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                              >
                                {formatUnitOptionPrice(option)}
                              </span>
                            ))}
                            {unitOptions.length > 3 ? (
                              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                +{unitOptions.length - 3} more
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              setSelectedUnit(unit);
                              setIsUnitViewOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/projects/${project.id}/edit`}>Manage</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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

      <Dialog open={isUnitViewOpen} onOpenChange={(open) => (open ? setIsUnitViewOpen(true) : closeUnitView())}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Unit Details</DialogTitle>
          <DialogDescription>Read-only unit information and available options.</DialogDescription>

          {selectedUnit ? (
            <div className="space-y-4">
              {hasSelectedUnitImages ? (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in"
                      onClick={() => setIsUnitImageZoomOpen(true)}
                      aria-label="Zoom unit image"
                    >
                      <img
                        src={selectedUnitActiveImage}
                        alt={selectedUnit.title || getUnitTypeLabel(selectedUnit.type_id)}
                        className="h-56 w-full object-cover"
                      />
                    </button>

                    <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                      {safeSelectedUnitImageIndex + 1} / {selectedUnitImages.length}
                    </span>

                    {showSelectedUnitImageControls ? (
                      <>
                        <button
                          type="button"
                          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
                          onClick={showPreviousSelectedUnitImage}
                          aria-label="Previous unit image"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white"
                          onClick={showNextSelectedUnitImage}
                          aria-label="Next unit image"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                  </div>

                  {selectedUnitImages.length > 1 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedUnitImages.map((imageUrl, index) => (
                        <img
                          key={`${selectedUnit.id}-thumb-${index}`}
                          src={imageUrl}
                          alt={`Unit image ${index + 1}`}
                          className={`h-14 w-20 cursor-pointer rounded border object-cover transition-all ${
                            index === safeSelectedUnitImageIndex
                              ? "border-slate-900 ring-1 ring-slate-900"
                              : "border-slate-200 hover:border-slate-400"
                          }`}
                          onClick={() => setActiveUnitImageIndex(index)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">
                  {selectedUnit.title || getUnitTypeLabel(selectedUnit.type_id)}
                </p>
                <p className="text-sm text-slate-500">
                  {getUnitTypeLabel(selectedUnit.type_id)}
                  {selectedUnit.unit_number ? ` • ${selectedUnit.unit_number}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                  <p className="font-medium text-slate-700 capitalize">{selectedUnit.status}</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Area</p>
                  <p className="font-medium text-slate-700">{(Number(selectedUnit.area_size) || 0).toLocaleString()} m2</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Payment</p>
                  <p className="font-medium text-slate-700 capitalize">{selectedUnit.payment_type}</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Options</p>
                  <p className="font-medium text-slate-700">{getUnitOptions(selectedUnit).length}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" />
                  {Number(selectedUnit.features?.bedrooms ?? selectedUnit.bedrooms ?? 0)} Beds
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5" />
                  {Number(selectedUnit.features?.bathrooms ?? selectedUnit.bathrooms ?? 0)} Baths
                </span>
                <span className="inline-flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  {Number(selectedUnit.features?.suit_rooms ?? selectedUnit.suit_rooms ?? 0)} Suites
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Unit Options</p>
                {getUnitOptions(selectedUnit).map((option, index) => (
                  <div key={`${selectedUnit.id}-view-option-${index}`} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">Option #{index + 1}</p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {getUnitOptionStatusLabel(option)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                      <p>
                        <span className="font-medium text-slate-700">Price:</span> {formatUnitOptionPrice(option)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Building:</span> {option.building_no || "-"}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Floor:</span> {option.floor_no || "-"}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Interface:</span> {option.interface.length > 0 ? option.interface.join(", ") : "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${project.id}/edit`} onClick={closeUnitView}>Manage in Project Edit</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isUnitImageZoomOpen} onOpenChange={setIsUnitImageZoomOpen}>
        <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none [&>button]:right-3 [&>button]:top-3 [&>button]:rounded-full [&>button]:bg-black/70 [&>button]:text-white [&>button]:opacity-100">
          <DialogTitle className="sr-only">Unit image zoom preview</DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged preview for unit image {safeSelectedUnitImageIndex + 1} of {selectedUnitImages.length || 1}.
          </DialogDescription>

          {selectedUnitActiveImage ? (
            <div className="relative">
              <img
                src={selectedUnitActiveImage}
                alt={`Zoomed unit image ${safeSelectedUnitImageIndex + 1}`}
                className="h-[85vh] w-[95vw] rounded-lg bg-black/90 object-contain"
              />

              {showSelectedUnitImageControls ? (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/80"
                    onClick={showPreviousSelectedUnitImage}
                    aria-label="Previous unit image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-black/70 text-white hover:bg-black/80"
                    onClick={showNextSelectedUnitImage}
                    aria-label="Next unit image"
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
