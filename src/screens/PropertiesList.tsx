import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Search, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { AreasOverviewMap, type AreasOverviewPropertyPoint } from "@/components/AreasOverviewMap";
import {
  deleteProperty as deletePropertyById,
  getProperties as fetchProperties,
} from "@/modules/properties/property.client";
import { createStory, getStories, uploadStoryMedia } from "@/modules/stories/story.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import type { Property, Story } from "@/types";
import type { AppVariableItem, AreaBoundaryPoint } from "@/modules/app-variables/types";

type DeleteDialogState = {
  open: boolean;
  propertyIds: string[];
  subjectLabel: string;
};

const PROPERTIES_PAGE_SIZE = 10;
const MAX_STORY_VIDEO_SIZE_BYTES = 30 * 1024 * 1024;
const MAX_STORY_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_STORY_DURATION_MS = 6000;

type StoryGroup = {
  created_by_uid: string;
  created_by_name: string;
  created_by_role: Story["created_by_role"];
  latest_story: Story;
  stories: Story[];
};

function parseIsoTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatStoryAge(value: string | null | undefined): string {
  const createdAt = parseIsoTime(value);

  if (!createdAt) {
    return "Just now";
  }

  const diffMs = Math.max(0, Date.now() - createdAt);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function buildInitials(value: string) {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "ST";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function resolveStoryMedia(story: Story): { type: "video" | "image"; url: string } | null {
  const mediaType = story.media_type;
  const mediaUrl = (story.media_url || "").trim();
  const imageUrl = (story.image_url || "").trim();
  const videoUrl = (story.video_url || "").trim();

  if (mediaType === "image") {
    const resolvedUrl = mediaUrl || imageUrl;
    return resolvedUrl ? { type: "image", url: resolvedUrl } : null;
  }

  if (mediaType === "video") {
    const resolvedUrl = mediaUrl || videoUrl;
    return resolvedUrl ? { type: "video", url: resolvedUrl } : null;
  }

  if (imageUrl && !videoUrl) {
    return { type: "image", url: imageUrl };
  }

  if (videoUrl) {
    return { type: "video", url: videoUrl };
  }

  if (mediaUrl) {
    const lowerMediaUrl = mediaUrl.toLowerCase();
    const looksLikeImage = /\.(png|jpe?g|gif|webp|avif|heic|heif)(\?|#|$)/.test(lowerMediaUrl);
    return {
      type: looksLikeImage ? "image" : "video",
      url: mediaUrl,
    };
  }

  return null;
}

function normalizeAreaBoundaryPoints(points?: AreaBoundaryPoint[]) {
  if (!Array.isArray(points)) {
    return [] as AreaBoundaryPoint[];
  }

  return points.filter(
    (point) =>
      typeof point?.lat === "number" &&
      Number.isFinite(point.lat) &&
      typeof point?.lng === "number" &&
      Number.isFinite(point.lng),
  );
}

function isPointInsidePolygon(point: AreaBoundaryPoint, polygon: AreaBoundaryPoint[]) {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, prevIndex = polygon.length - 1; index < polygon.length; prevIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[prevIndex];

    const intersects =
      (current.lat > point.lat) !== (previous.lat > point.lat) &&
      point.lng <
        ((previous.lng - current.lng) * (point.lat - current.lat)) /
          (previous.lat - current.lat || Number.EPSILON) +
          current.lng;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

const PropertiesList = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyPlaybackProgress, setStoryPlaybackProgress] = useState(0);
  const [imageStoryLoaded, setImageStoryLoaded] = useState(false);
  const [storyMuted, setStoryMuted] = useState(true);
  const [storyPlaybackError, setStoryPlaybackError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [areas, setAreas] = useState<AppVariableItem[]>([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [deletingPropertyIds, setDeletingPropertyIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    propertyIds: [],
    subjectLabel: "",
  });

  const getPropertyCode = (property: Property) =>
    property.property_code || `P${property.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "0")}`;

  const hasActiveFilters =
    cityFilter !== "all" ||
    areaFilter !== "all" ||
    dateFilter.trim() !== "" ||
    minPriceFilter.trim() !== "" ||
    maxPriceFilter.trim() !== "";

  const activeFilterCount =
    (cityFilter !== "all" ? 1 : 0) +
    (areaFilter !== "all" ? 1 : 0) +
    (dateFilter.trim() !== "" ? 1 : 0) +
    (minPriceFilter.trim() !== "" ? 1 : 0) +
    (maxPriceFilter.trim() !== "" ? 1 : 0);

  const resetFilters = () => {
    setCityFilter("all");
    setAreaFilter("all");
    setDateFilter("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchProperties()
      .then((items) => {
        if (!cancelled) {
          setProperties(items);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load properties.";
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
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setStories([]);
      setStoryError(null);
      return;
    }

    let cancelled = false;
    setStoryError(null);

    getStories()
      .then((items) => {
        if (!cancelled) {
          setStories(items);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load stories.";
          setStoryError(message);
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
    setLookupError(null);

    Promise.all([getVariables("property_types"), getVariables("cities"), getVariables("areas")])
      .then(([types, citiesList, areasList]) => {
        if (cancelled) {
          return;
        }

        setPropertyTypes(types);
        setCities(citiesList);
        setAreas(areasList);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load filters.";
          setLookupError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const getTypeName = (id: string) => propertyTypes.find((type) => type.id === id)?.name || id;
  const getCityName = (id: string) => cities.find((city) => city.id === id)?.name || id;

  const parseFilterNumber = (value: string) => {
    const normalized = value.replace(/[,_\s]/g, "").trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed;
  };

  const getPropertyFilterDate = (property: Property) => {
    const listingDate = (property.listing_date || "").trim();
    const normalizedListingDate = listingDate.length >= 10 ? listingDate.slice(0, 10) : listingDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedListingDate)) {
      return normalizedListingDate;
    }

    const createdAt = (property as Property & { created_at?: string | null }).created_at;
    if (!createdAt) {
      return "";
    }

    const parsedCreatedAt = Date.parse(createdAt);
    if (!Number.isFinite(parsedCreatedAt)) {
      return "";
    }

    return new Date(parsedCreatedAt).toISOString().slice(0, 10);
  };

  const selectedAreaItem =
    areaFilter === "all" ? null : areas.find((area) => area.name === areaFilter) || null;
  const selectedAreaBoundary = normalizeAreaBoundaryPoints(selectedAreaItem?.area_boundary);
  const useBoundaryAreaFiltering = selectedAreaBoundary.length >= 3;

  const propertyMatchesSelectedArea = (property: Property) => {
    if (areaFilter === "all") {
      return true;
    }

    if (!useBoundaryAreaFiltering) {
      return property.area === areaFilter;
    }

    if (
      typeof property.lat !== "number" ||
      !Number.isFinite(property.lat) ||
      typeof property.lng !== "number" ||
      !Number.isFinite(property.lng)
    ) {
      return false;
    }

    return isPointInsidePolygon(
      {
        lat: property.lat,
        lng: property.lng,
      },
      selectedAreaBoundary,
    );
  };

  const filtered = properties.filter((p) => {
    if (search) {
      const term = search.toLowerCase();
      const matchesTitle = p.title.toLowerCase().includes(term);
      const matchesId =
        getPropertyCode(p).toLowerCase().includes(term) || p.id.toLowerCase().includes(term);
      const matchesType =
        getTypeName(p.type_id).toLowerCase().includes(term) || p.type_id.toLowerCase().includes(term);
      const matchesCity =
        getCityName(p.city_id).toLowerCase().includes(term) || p.city_id.toLowerCase().includes(term);

      if (!matchesTitle && !matchesId && !matchesType && !matchesCity) {
        return false;
      }
    }

    if (cityFilter !== "all" && p.city_id !== cityFilter) return false;
  if (!propertyMatchesSelectedArea(p)) return false;

    if (dateFilter.trim() !== "") {
      const propertyDate = getPropertyFilterDate(p);
      if (propertyDate !== dateFilter) {
        return false;
      }
    }

    const minPrice = parseFilterNumber(minPriceFilter);
    if (minPrice != null && p.price < minPrice) {
      return false;
    }

    const maxPrice = parseFilterNumber(maxPriceFilter);
    if (maxPrice != null && p.price > maxPrice) {
      return false;
    }

    return true;
  });

  const areaMatchedCount = filtered.length;
  const areaMapPoints: AreasOverviewPropertyPoint[] = useMemo(
    () =>
      filtered.flatMap((property) => {
        if (
          typeof property.lat !== "number" ||
          !Number.isFinite(property.lat) ||
          typeof property.lng !== "number" ||
          !Number.isFinite(property.lng)
        ) {
          return [];
        }

        return [
          {
            id: property.id,
            title: property.title,
            lat: property.lat,
            lng: property.lng,
            propertyCode: getPropertyCode(property),
            priceLabel: `${property.currency} ${property.price.toLocaleString()}`,
          },
        ];
      }),
    [filtered],
  );

  const areasWithBoundary = useMemo(
    () => areas.filter((area) => normalizeAreaBoundaryPoints(area.area_boundary).length >= 3),
    [areas],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    cityFilter,
    areaFilter,
    dateFilter,
    minPriceFilter,
    maxPriceFilter,
  ]);

  useEffect(() => {
    const availableIds = new Set(properties.map((property) => property.id));
    setSelectedPropertyIds((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [properties]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROPERTIES_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PROPERTIES_PAGE_SIZE;
  const endIndexExclusive = startIndex + PROPERTIES_PAGE_SIZE;
  const paginatedProperties = filtered.slice(startIndex, endIndexExclusive);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeStories = useMemo(
    () =>
      stories
        .filter((story) => parseIsoTime(story.expires_at) > Date.now())
        .sort((a, b) => parseIsoTime(b.created_at) - parseIsoTime(a.created_at)),
    [stories],
  );

  const storyGroups = useMemo(() => {
    const grouped = new Map<string, StoryGroup>();

    activeStories.forEach((story) => {
      const key = story.created_by_uid || story.id;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          created_by_uid: story.created_by_uid,
          created_by_name: story.created_by_name,
          created_by_role: story.created_by_role,
          latest_story: story,
          stories: [story],
        });
        return;
      }

      existing.stories.push(story);

      if (parseIsoTime(story.created_at) > parseIsoTime(existing.latest_story.created_at)) {
        existing.latest_story = story;
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        stories: [...group.stories].sort(
          (a, b) => parseIsoTime(a.created_at) - parseIsoTime(b.created_at),
        ),
      }))
      .sort(
        (a, b) => parseIsoTime(b.latest_story.created_at) - parseIsoTime(a.latest_story.created_at),
      );
  }, [activeStories]);

  const canPublishStory = !!user && (user.role === "admin" || user.role === "company");
  const currentDialogStory = activeStoryGroup?.stories[activeStoryIndex] || null;
  const currentDialogStoryMedia = currentDialogStory ? resolveStoryMedia(currentDialogStory) : null;
  const isCurrentDialogImageStory = currentDialogStoryMedia?.type === "image";
  const canGoNextStory =
    !!activeStoryGroup && activeStoryIndex < activeStoryGroup.stories.length - 1;

  const selectedIdSet = new Set(selectedPropertyIds);
  const visiblePropertyIds = paginatedProperties.map((property) => property.id);
  const visiblePropertyIdSet = new Set(visiblePropertyIds);
  const deletingIdSet = new Set(deletingPropertyIds);
  const allVisibleSelected =
    visiblePropertyIds.length > 0 && visiblePropertyIds.every((id) => selectedIdSet.has(id));
  const someVisibleSelected =
    visiblePropertyIds.some((id) => selectedIdSet.has(id)) && !allVisibleSelected;
  const dialogPropertyCount = deleteDialog.propertyIds.length;
  const dialogIsDeleting = deleteDialog.propertyIds.some((id) => deletingIdSet.has(id));
  const dialogIsBulkDelete = dialogPropertyCount > 1;

  const deleteDialogTitle = dialogIsBulkDelete
    ? `Delete ${dialogPropertyCount} Properties Permanently?`
    : "Delete Property Permanently?";

  const deleteDialogDescription = dialogIsBulkDelete
    ? `This will remove ${dialogPropertyCount} selected properties from Firestore and delete all their uploaded images from Firebase Storage. This action cannot be undone.`
    : `This will remove ${deleteDialog.subjectLabel ? `"${deleteDialog.subjectLabel}"` : "this property"} from Firestore and delete all uploaded images from Firebase Storage. This action cannot be undone.`;

  const deleteActionLabel = dialogIsDeleting
    ? "Deleting..."
    : dialogIsBulkDelete
      ? "Delete Selected"
      : "Delete Property";

  const toggleSelectAllVisible = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedPropertyIds((current) => {
        const next = new Set(current);
        visiblePropertyIds.forEach((id) => next.add(id));
        return Array.from(next);
      });
      return;
    }

    setSelectedPropertyIds((current) => current.filter((id) => !visiblePropertyIdSet.has(id)));
  };

  const togglePropertySelection = (propertyId: string, checked: boolean | "indeterminate") => {
    setSelectedPropertyIds((current) => {
      if (checked === true) {
        return current.includes(propertyId) ? current : [...current, propertyId];
      }

      return current.filter((id) => id !== propertyId);
    });
  };

  const markDeletingIds = (ids: string[]) => {
    setDeletingPropertyIds((current) => Array.from(new Set([...current, ...ids])));
  };

  const unmarkDeletingIds = (ids: string[]) => {
    const idsToRemove = new Set(ids);
    setDeletingPropertyIds((current) => current.filter((id) => !idsToRemove.has(id)));
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      open: false,
      propertyIds: [],
      subjectLabel: "",
    });
  };

  const openDeleteDialog = (propertyIds: string[], subjectLabel = "") => {
    if (propertyIds.length === 0) {
      return;
    }

    setDeleteDialog({
      open: true,
      propertyIds: [...propertyIds],
      subjectLabel,
    });
  };

  async function deletePropertiesByIds(propertyIds: string[]) {
    if (propertyIds.length === 0) {
      return;
    }

    markDeletingIds(propertyIds);
    setError(null);

    try {
      const results = await Promise.allSettled(propertyIds.map((propertyId) => deletePropertyById(propertyId)));

      const deletedIds: string[] = [];
      const failedIds: string[] = [];

      results.forEach((result, index) => {
        const propertyId = propertyIds[index];
        if (result.status === "fulfilled") {
          deletedIds.push(propertyId);
        } else {
          failedIds.push(propertyId);
        }
      });

      if (deletedIds.length > 0) {
        const deletedIdSet = new Set(deletedIds);
        setProperties((current) => current.filter((item) => !deletedIdSet.has(item.id)));
        setSelectedPropertyIds((current) => current.filter((id) => !deletedIdSet.has(id)));
      }

      if (failedIds.length > 0) {
        const errorMessage =
          failedIds.length === 1
            ? "1 selected property could not be deleted."
            : `${failedIds.length} selected properties could not be deleted.`;
        setError(errorMessage);
        toast.error(errorMessage, {
          style: {
            background: "hsl(var(--destructive))",
            color: "hsl(var(--destructive-foreground))",
            borderColor: "hsl(var(--destructive))",
          },
        });
      }

      if (deletedIds.length > 0) {
        const successMessage =
          deletedIds.length === 1
            ? "1 property deleted successfully."
            : `${deletedIds.length} properties deleted successfully.`;
        toast.success(successMessage);
      }
    } finally {
      unmarkDeletingIds(propertyIds);
    }
  }

  const openSingleDeleteDialog = (property: Property) => {
    if (deletingIdSet.has(property.id)) {
      return;
    }

    openDeleteDialog([property.id], property.title);
  };

  const openSelectedDeleteDialog = () => {
    if (selectedPropertyIds.length === 0) {
      return;
    }

    openDeleteDialog(selectedPropertyIds);
  };

  async function handleConfirmDeleteDialog() {
    if (dialogPropertyCount === 0 || dialogIsDeleting) {
      return;
    }

    await deletePropertiesByIds([...deleteDialog.propertyIds]);
    closeDeleteDialog();
  }

  function openStoryFilePicker() {
    if (!canPublishStory || uploadingStory) {
      return;
    }

    setStoryError(null);
    storyInputRef.current?.click();
  }

  async function handleStoryFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile || !canPublishStory || uploadingStory) {
      return;
    }

    const isVideo = selectedFile.type.startsWith("video/");
    const isImage = selectedFile.type.startsWith("image/");

    if (!isVideo && !isImage) {
      setStoryError("Please select an image or video file for stories.");
      return;
    }

    if (isVideo && selectedFile.size > MAX_STORY_VIDEO_SIZE_BYTES) {
      setStoryError("Story video must be 30MB or less.");
      return;
    }

    if (isImage && selectedFile.size > MAX_STORY_IMAGE_SIZE_BYTES) {
      setStoryError("Story image must be 10MB or less.");
      return;
    }

    setUploadingStory(true);
    setStoryError(null);

    try {
      const uploadedStoryMedia = await uploadStoryMedia(selectedFile);
      const createdStory = await createStory({
        media_url: uploadedStoryMedia.url,
        media_type: uploadedStoryMedia.media_type,
        ...(uploadedStoryMedia.media_type === "video"
          ? { video_url: uploadedStoryMedia.url }
          : { image_url: uploadedStoryMedia.url }),
      });

      setStories((current) =>
        [createdStory, ...current].sort(
          (a, b) => parseIsoTime(b.created_at) - parseIsoTime(a.created_at),
        ),
      );
    } catch (storyUploadError) {
      const message =
        storyUploadError instanceof Error
          ? storyUploadError.message
          : "Failed to upload story media.";
      setStoryError(message);
    } finally {
      setUploadingStory(false);
    }
  }

  function openStoryViewer(group: StoryGroup) {
    setActiveStoryGroup(group);
    setActiveStoryIndex(0);
    setStoryPlaybackProgress(0);
    setStoryPlaybackError(null);
    setStoryDialogOpen(true);
  }

  function goToPreviousStory() {
    setActiveStoryIndex((current) => (current > 0 ? current - 1 : current));
  }

  function goToNextStory() {
    setActiveStoryIndex((current) => {
      if (!activeStoryGroup) {
        return current;
      }

      return current < activeStoryGroup.stories.length - 1 ? current + 1 : current;
    });
  }

  function goToStoryByTapZone() {
    if (canGoNextStory) {
      goToNextStory();
      return;
    }

    setStoryDialogOpen(false);
  }

  useEffect(() => {
    setStoryPlaybackProgress(0);
    setStoryPlaybackError(null);
    setImageStoryLoaded(false);
  }, [currentDialogStory?.id, storyDialogOpen]);

  useEffect(() => {
    if (!storyDialogOpen || !isCurrentDialogImageStory || !imageStoryLoaded) {
      return;
    }

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const progress = Math.min(1, elapsedMs / IMAGE_STORY_DURATION_MS);
      setStoryPlaybackProgress(progress);

      if (progress < 1) {
        return;
      }

      window.clearInterval(timerId);
      setStoryPlaybackProgress(1);

      if (activeStoryGroup && activeStoryIndex < activeStoryGroup.stories.length - 1) {
        setActiveStoryIndex((current) => current + 1);
        return;
      }

      setStoryDialogOpen(false);
    }, 100);

    return () => {
      window.clearInterval(timerId);
    };
  }, [
    activeStoryIndex,
    activeStoryGroup?.stories.length,
    imageStoryLoaded,
    isCurrentDialogImageStory,
    storyDialogOpen,
  ]);

  return (
    <div>
      {storyError ? <p className="mb-4 text-sm text-destructive">{storyError}</p> : null}

      <Card className="mb-4 overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-rose-50/60 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-white/70 px-4 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Stories</p>
            <p className="mt-1 text-sm font-medium text-slate-700">Tap a story bubble to view.</p>
          </div>
          {canPublishStory ? (
            <Button size="sm" className="rounded-full px-4" onClick={openStoryFilePicker} disabled={uploadingStory}>
              <Plus className="mr-1.5 h-4 w-4" />
              {uploadingStory ? "Uploading..." : "Add Story"}
            </Button>
          ) : null}
          <input
            ref={storyInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => {
              void handleStoryFileSelected(event);
            }}
          />
        </div>
        <div className="px-4 py-4">
          {storyGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active stories yet.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {storyGroups.map((group) => {
                const previewMedia = resolveStoryMedia(group.latest_story);

                return (
                  <button
                    key={group.created_by_uid || group.latest_story.id}
                    type="button"
                    className="group shrink-0 text-left"
                    onClick={() => openStoryViewer(group)}
                  >
                    <span className="relative block h-20 w-20 rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px] transition-transform duration-200 group-hover:scale-[1.03]">
                      <span className="block h-full w-full overflow-hidden rounded-full bg-black ring-2 ring-white/90">
                        {previewMedia?.type === "image" ? (
                          <img
                            src={previewMedia.url}
                            alt={`${group.created_by_name} story`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : previewMedia?.type === "video" ? (
                          <video
                            src={previewMedia.url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-semibold uppercase text-white/80">
                            {buildInitials(group.created_by_name)}
                          </span>
                        )}
                      </span>
                      {group.stories.length > 1 ? (
                        <span className="absolute bottom-0 right-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/85 px-1 text-[10px] font-semibold text-white ring-1 ring-white/30">
                          {group.stories.length}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 block max-w-[88px] truncate text-xs font-semibold text-slate-800">
                      {group.created_by_name}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {formatStoryAge(group.latest_story.created_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <div className="mt-6">
        <PageHeader
          title="Properties"
          description="Manage your property listings"
          actions={<Button asChild><Link href="/properties/new"><Plus className="mr-2 h-4 w-4" />Add Property</Link></Button>}
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold">All Areas Overview</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {areaFilter === "all"
                ? `Showing ${areaMapPoints.length} mapped properties out of ${areaMatchedCount} visible results across all areas.`
                : `Showing ${areaMapPoints.length} mapped properties out of ${areaMatchedCount} matches in area: ${areaFilter}`}
            </p>
          </div>

          <div className="w-full md:w-[260px]">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Area Filter</p>
            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger className="h-9 bg-muted/50 border-0">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {areas.map((area) => <SelectItem key={area.id} value={area.name}>{area.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-4">
          {areasWithBoundary.length > 0 || areaMapPoints.length > 0 ? (
            <AreasOverviewMap
              areas={areas}
              propertyPoints={areaMapPoints}
              selectedAreaName={areaFilter}
              onAreaSelect={setAreaFilter}
            />
          ) : (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              No area boundaries or property coordinates are available yet.
            </div>
          )}
        </div>
      </Card>

      <Card className="p-1.5">
        {lookupError ? <p className="px-3 pt-3 text-sm text-destructive">{lookupError}</p> : null}
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by ID, type, or city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/50 border-0" />
          </div>

          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={`h-9 gap-2 ${hasActiveFilters ? "border-primary text-primary" : ""}`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Filter Properties</p>
                  {hasActiveFilters ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {activeFilterCount} active
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">City</p>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="City" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {cities.map((city) => <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Area filter is controlled from the All Areas Overview map above.
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Date</p>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value)}
                    className="h-9 bg-muted/50 border-0"
                    aria-label="Property date"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Price Range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Min"
                      value={minPriceFilter}
                      onChange={(event) => setMinPriceFilter(event.target.value)}
                      className="h-9 bg-muted/50 border-0"
                      aria-label="Price range minimum"
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Max"
                      value={maxPriceFilter}
                      onChange={(event) => setMaxPriceFilter(event.target.value)}
                      className="h-9 bg-muted/50 border-0"
                      aria-label="Price range maximum"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  className="h-9 w-full gap-2"
                  onClick={() => {
                    resetFilters();
                    setFiltersOpen(false);
                  }}
                  disabled={!hasActiveFilters}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset All Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {selectedPropertyIds.length > 0 ? (
          <div className="px-3 pt-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{selectedPropertyIds.length} selected</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={openSelectedDeleteDialog}
                  disabled={selectedPropertyIds.some((id) => deletingIdSet.has(id))}
                >
                  {selectedPropertyIds.some((id) => deletingIdSet.has(id)) ? "Deleting..." : "Delete Selected"}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedPropertyIds([])}>
                  Clear selection
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {loading ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Loading properties...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState title="Failed to load properties" description={error} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No properties found" description="Try adjusting your filters or add a new property." action={<Button asChild><Link href="/properties/new"><Plus className="mr-2 h-4 w-4" />Add Property</Link></Button>} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all properties on current page"
                />
                <span className="text-xs text-muted-foreground">Select all on this page</span>
              </div>
              <p className="text-xs text-muted-foreground">{paginatedProperties.length} cards on this page</p>
            </div>

            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedProperties.map((p) => {
                const cityName = getCityName(p.city_id);
                const showCity = cityName.trim().length > 0 && !p.title.toLowerCase().includes(cityName.toLowerCase());

                return (
                  <div
                    key={p.id}
                    className={`group cursor-pointer overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-sm ${selectedIdSet.has(p.id) ? "ring-2 ring-primary/35" : ""}`}
                    onClick={() => router.push(`/properties/${p.id}`)}
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-muted/20">
                      {p.main_image || p.images[0] ? (
                        <img
                          src={p.main_image || p.images[0]}
                          alt={`${p.title} thumbnail`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}

                      <div className="absolute left-2 top-2" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIdSet.has(p.id)}
                          onCheckedChange={(checked) => togglePropertySelection(p.id, checked)}
                          aria-label={`Select ${p.title}`}
                        />
                      </div>

                      <div className="absolute right-2 top-2 rounded-md border bg-background/90 px-2 py-1 font-mono text-[11px] font-semibold text-muted-foreground">
                        {getPropertyCode(p)}
                      </div>
                    </div>

                    <div className="space-y-3 p-3">
                      <div className="min-w-0">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold leading-tight">{p.title}</p>
                          {showCity ? <p className="mt-1 truncate text-xs text-muted-foreground">{cityName}</p> : null}
                        </div>
                      </div>

                      <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/70">Price</p>
                        <p className="mt-1 text-[30px] font-bold leading-none text-primary">
                          {p.currency} {p.price.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                          {p.bedrooms} bed • {p.suit_rooms} suit
                        </span>
                        <span className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs capitalize text-muted-foreground">
                          {p.condition.replaceAll("_", " ")}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-1" onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                          <Link href={`/properties/${p.id}`}>View</Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                          <Link href={`/properties/${p.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            openSingleDeleteDialog(p);
                          }}
                          disabled={deletingIdSet.has(p.id)}
                        >
                          {deletingIdSet.has(p.id) ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndexExclusive, filtered.length)} of {filtered.length} properties
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={activePage === 1}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {activePage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={activePage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Dialog
        open={storyDialogOpen}
        onOpenChange={(open) => {
          setStoryDialogOpen(open);

          if (!open) {
            setActiveStoryGroup(null);
            setActiveStoryIndex(0);
          }
        }}
      >
        <DialogContent className="w-full max-w-[26rem] border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
          {currentDialogStory ? (
            <>
              <DialogTitle className="sr-only">Story media</DialogTitle>
              <DialogDescription className="sr-only">
                Story from {currentDialogStory.created_by_name}
              </DialogDescription>
              <div className="relative mx-auto h-[78vh] w-[min(100vw-1.5rem,24rem)] overflow-hidden rounded-3xl bg-black text-white shadow-2xl ring-1 ring-white/20">
                {currentDialogStoryMedia?.type === "image" ? (
                  <img
                    key={currentDialogStory.id}
                    src={currentDialogStoryMedia.url}
                    alt={`${currentDialogStory.created_by_name} story`}
                    className="h-full w-full bg-black object-cover"
                    onLoad={() => {
                      setImageStoryLoaded(true);
                      setStoryPlaybackError(null);
                    }}
                    onError={() => {
                      setImageStoryLoaded(false);
                      setStoryPlaybackError("This story cannot be displayed right now.");
                    }}
                  />
                ) : currentDialogStoryMedia?.type === "video" ? (
                  <video
                    ref={storyVideoRef}
                    key={currentDialogStory.id}
                    src={currentDialogStoryMedia.url}
                    autoPlay
                    playsInline
                    muted={storyMuted}
                    className="h-full w-full bg-black object-cover"
                    onLoadedData={() => {
                      setStoryPlaybackError(null);
                    }}
                    onTimeUpdate={(event) => {
                      const { currentTime, duration } = event.currentTarget;
                      if (!Number.isFinite(duration) || duration <= 0) {
                        setStoryPlaybackProgress(0);
                        return;
                      }

                      setStoryPlaybackProgress(Math.min(1, Math.max(0, currentTime / duration)));
                    }}
                    onError={() => {
                      setStoryPlaybackError("This story cannot be played right now.");
                    }}
                    onEnded={() => {
                      if (canGoNextStory) {
                        goToNextStory();
                        return;
                      }

                      setStoryDialogOpen(false);
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/80 px-6 text-center text-sm text-white/85">
                    Story media is unavailable.
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/65" />

                <button
                  type="button"
                  className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer bg-transparent"
                  onClick={goToPreviousStory}
                  aria-label="Previous story"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer bg-transparent"
                  onClick={goToStoryByTapZone}
                  aria-label="Next story"
                />

                <div className="absolute inset-x-0 top-0 z-20 p-3">
                  <div className="mb-3 flex items-center gap-1.5">
                    {(activeStoryGroup?.stories || []).map((story, index) => {
                      const segmentProgress =
                        index < activeStoryIndex
                          ? 100
                          : index === activeStoryIndex
                            ? storyPlaybackProgress * 100
                            : 0;

                      return (
                        <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                          <div
                            className="h-full rounded-full bg-white transition-[width] duration-150 ease-linear"
                            style={{ width: `${segmentProgress}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px]">
                        <span className="inline-flex h-full w-full items-center justify-center rounded-full bg-black/80 text-xs font-semibold uppercase text-white">
                          {buildInitials(activeStoryGroup?.created_by_name || "")}
                        </span>
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {activeStoryGroup?.created_by_name}
                        </p>
                        <p className="truncate text-xs text-white/75">
                          {formatStoryAge(currentDialogStory.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {currentDialogStoryMedia?.type === "video" ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full bg-black/30 text-white hover:bg-black/45 hover:text-white"
                          onClick={() => setStoryMuted((current) => !current)}
                        >
                          {storyMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full bg-black/30 text-white hover:bg-black/45 hover:text-white"
                        onClick={() => setStoryDialogOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4">
                  <div className="inline-flex items-center rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                    {activeStoryIndex + 1} / {activeStoryGroup?.stories.length || 1}
                  </div>
                </div>

                {storyPlaybackError ? (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6 text-center">
                    <p className="text-sm text-white/90">{storyPlaybackError}</p>
                  </div>
                ) : null}
              </div>
              {activeStoryGroup && activeStoryGroup.stories.length > 1 ? (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousStory}
                    className="border-white/20 bg-black/35 text-white hover:bg-black/50 hover:text-white"
                    disabled={activeStoryIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={goToStoryByTapZone}
                    className="border-white/20 bg-black/35 text-white hover:bg-black/50 hover:text-white"
                  >
                    {canGoNextStory ? "Next" : "Close"}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open && !dialogIsDeleting) {
            closeDeleteDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dialogIsDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={dialogIsDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteDialog();
              }}
            >
              {deleteActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PropertiesList;
