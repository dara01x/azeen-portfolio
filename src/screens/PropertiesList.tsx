import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  deleteProperty as deletePropertyById,
  getProperties as fetchProperties,
  updateProperty as updatePropertyById,
} from "@/modules/properties/property.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import type { Property } from "@/types";
import type { AppVariableItem } from "@/modules/app-variables/types";

type DeleteDialogState = {
  open: boolean;
  propertyIds: string[];
  subjectLabel: string;
};

const STATUS_META: Record<
  Property["status"],
  { label: string; dotClassName: string; triggerClassName: string }
> = {
  available: {
    label: "Available",
    dotClassName: "bg-emerald-500",
    triggerClassName: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  sold: {
    label: "Sold",
    dotClassName: "bg-amber-500",
    triggerClassName: "bg-amber-50 text-amber-800 border-amber-200",
  },
  archived: {
    label: "Archived",
    dotClassName: "bg-slate-500",
    triggerClassName: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

const PROPERTIES_PAGE_SIZE = 10;

const PropertiesList = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [listingTypeFilter, setListingTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [minBedroomsFilter, setMinBedroomsFilter] = useState("any");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [deletingPropertyIds, setDeletingPropertyIds] = useState<string[]>([]);
  const [statusUpdatingPropertyIds, setStatusUpdatingPropertyIds] = useState<string[]>([]);
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
    typeFilter !== "all" ||
    listingTypeFilter !== "all" ||
    statusFilter !== "all" ||
    conditionFilter !== "all" ||
    minBedroomsFilter !== "any" ||
    minPriceFilter.trim() !== "" ||
    maxPriceFilter.trim() !== "";

  const resetFilters = () => {
    setCityFilter("all");
    setTypeFilter("all");
    setListingTypeFilter("all");
    setStatusFilter("all");
    setConditionFilter("all");
    setMinBedroomsFilter("any");
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
    if (typeFilter !== "all" && p.type_id !== typeFilter) return false;
    if (listingTypeFilter !== "all" && p.listing_type !== listingTypeFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (conditionFilter !== "all" && p.condition !== conditionFilter) return false;

    if (minBedroomsFilter !== "any") {
      const minBedrooms = Number(minBedroomsFilter);
      if (Number.isFinite(minBedrooms) && p.bedrooms < minBedrooms) {
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

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    cityFilter,
    typeFilter,
    listingTypeFilter,
    statusFilter,
    conditionFilter,
    minBedroomsFilter,
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

  const selectedIdSet = new Set(selectedPropertyIds);
  const visiblePropertyIds = paginatedProperties.map((property) => property.id);
  const visiblePropertyIdSet = new Set(visiblePropertyIds);
  const deletingIdSet = new Set(deletingPropertyIds);
  const statusUpdatingIdSet = new Set(statusUpdatingPropertyIds);
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
    : `This will remove ${deleteDialog.subjectLabel ? `\"${deleteDialog.subjectLabel}\"` : "this property"} from Firestore and delete all uploaded images from Firebase Storage. This action cannot be undone.`;

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

  const markStatusUpdatingId = (id: string) => {
    setStatusUpdatingPropertyIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const unmarkStatusUpdatingId = (id: string) => {
    setStatusUpdatingPropertyIds((current) => current.filter((currentId) => currentId !== id));
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

  async function handlePropertyStatusChange(property: Property, nextStatusValue: string) {
    if (
      nextStatusValue !== "available" &&
      nextStatusValue !== "sold" &&
      nextStatusValue !== "archived"
    ) {
      return;
    }

    const nextStatus = nextStatusValue as Property["status"];
    if (property.status === nextStatus || statusUpdatingIdSet.has(property.id) || deletingIdSet.has(property.id)) {
      return;
    }

    const previousStatus = property.status;
    markStatusUpdatingId(property.id);
    setError(null);

    setProperties((current) =>
      current.map((item) => (item.id === property.id ? { ...item, status: nextStatus } : item)),
    );

    try {
      const { id: _id, ...propertyPayload } = property;
      const updated = await updatePropertyById(property.id, {
        ...propertyPayload,
        status: nextStatus,
      });

      setProperties((current) => current.map((item) => (item.id === property.id ? updated : item)));
      toast.success("Property status updated.");
    } catch (updateError) {
      setProperties((current) =>
        current.map((item) => (item.id === property.id ? { ...item, status: previousStatus } : item)),
      );

      const message = updateError instanceof Error ? updateError.message : "Failed to update property status.";
      setError(message);
      toast.error(message, {
        style: {
          background: "hsl(var(--destructive))",
          color: "hsl(var(--destructive-foreground))",
          borderColor: "hsl(var(--destructive))",
        },
      });
    } finally {
      unmarkStatusUpdatingId(property.id);
    }
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Manage your property listings"
        actions={<Button asChild><Link href="/properties/new"><Plus className="mr-2 h-4 w-4" />Add Property</Link></Button>}
      />
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
                {hasActiveFilters ? <span className="text-xs">Active</span> : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Filter Properties</p>
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={resetFilters}
                    >
                      Reset
                    </Button>
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

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Property Type</p>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Property Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Property Types</SelectItem>
                      {propertyTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Listing Type</p>
                  <Select value={listingTypeFilter} onValueChange={setListingTypeFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Listing Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Listing Types</SelectItem>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Condition</p>
                  <Select value={conditionFilter} onValueChange={setConditionFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Condition" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conditions</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                      <SelectItem value="under_construction">Under Construction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Min Bedrooms</p>
                  <Select value={minBedroomsFilter} onValueChange={setMinBedroomsFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Min Bedrooms" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Bedrooms</SelectItem>
                      <SelectItem value="1">1+</SelectItem>
                      <SelectItem value="2">2+</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5+</SelectItem>
                    </SelectContent>
                  </Select>
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
                const statusMeta = STATUS_META[p.status];

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
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{p.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {getTypeName(p.type_id)} • {getCityName(p.city_id)}
                          </p>
                        </div>
                        <p className="whitespace-nowrap text-sm font-semibold">
                          {p.currency} {p.price.toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-md border bg-muted/30 px-2 py-1 capitalize">{p.listing_type}</span>
                        <span>{p.bedrooms} bd</span>
                        <span>{p.suit_rooms} sr</span>
                        <span className="capitalize">{p.condition.replaceAll("_", " ")}</span>
                      </div>

                      <div onClick={(event) => event.stopPropagation()}>
                        <Select
                          value={p.status}
                          onValueChange={(value) => {
                            void handlePropertyStatusChange(p, value);
                          }}
                          disabled={deletingIdSet.has(p.id) || statusUpdatingIdSet.has(p.id)}
                        >
                          <SelectTrigger className={`h-8 w-full border ${statusMeta.triggerClassName}`}>
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${statusMeta.dotClassName}`} />
                              <SelectValue placeholder="Status" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">{STATUS_META.available.label}</SelectItem>
                            <SelectItem value="sold">{STATUS_META.sold.label}</SelectItem>
                            <SelectItem value="archived">{STATUS_META.archived.label}</SelectItem>
                          </SelectContent>
                        </Select>
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
