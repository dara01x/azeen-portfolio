import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Edit, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { getProjectById } from "@/modules/projects/project.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { useAuth } from "@/lib/auth/useAuth";
import type { Project } from "@/types";

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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);

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
