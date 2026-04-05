import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [deletingPropertyIds, setDeletingPropertyIds] = useState<string[]>([]);
  const [statusUpdatingPropertyIds, setStatusUpdatingPropertyIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    propertyIds: [],
    subjectLabel: "",
  });

  const getPropertyCode = (property: Property) =>
    property.property_code || `P${property.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "0")}`;

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

  const filtered = properties.filter((p) => {
    if (search) {
      const term = search.toLowerCase();
      const matchesTitle = p.title.toLowerCase().includes(term);
      const matchesCode = getPropertyCode(p).toLowerCase().includes(term);
      if (!matchesTitle && !matchesCode) {
        return false;
      }
    }

    if (cityFilter !== "all" && p.city_id !== cityFilter) return false;
    if (typeFilter !== "all" && p.type_id !== typeFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const getTypeName = (id: string) => propertyTypes.find((type) => type.id === id)?.name || id;
  const getCityName = (id: string) => cities.find((city) => city.id === id)?.name || id;

  useEffect(() => {
    const availableIds = new Set(properties.map((property) => property.id));
    setSelectedPropertyIds((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [properties]);

  const selectedIdSet = new Set(selectedPropertyIds);
  const filteredIds = filtered.map((property) => property.id);
  const filteredIdSet = new Set(filteredIds);
  const deletingIdSet = new Set(deletingPropertyIds);
  const statusUpdatingIdSet = new Set(statusUpdatingPropertyIds);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id));
  const someFilteredSelected =
    filteredIds.some((id) => selectedIdSet.has(id)) && !allFilteredSelected;
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

  const toggleSelectAllFiltered = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedPropertyIds((current) => {
        const next = new Set(current);
        filteredIds.forEach((id) => next.add(id));
        return Array.from(next);
      });
      return;
    }

    setSelectedPropertyIds((current) => current.filter((id) => !filteredIdSet.has(id)));
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
            <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/50 border-0" />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-0"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-0"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {propertyTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-0"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
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
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAllFiltered}
                    aria-label="Select all properties"
                  />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thumbnail</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property ID</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Listing</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className={`group cursor-pointer ${selectedIdSet.has(p.id) ? "bg-muted/30" : ""}`}
                  onClick={() => router.push(`/properties/${p.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIdSet.has(p.id)}
                      onCheckedChange={(checked) => togglePropertySelection(p.id, checked)}
                      aria-label={`Select ${p.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="h-11 w-16 overflow-hidden rounded-md border bg-muted/20">
                      {p.main_image || p.images[0] ? (
                        <img
                          src={p.main_image || p.images[0]}
                          alt={`${p.title} thumbnail`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                    {getPropertyCode(p)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{getTypeName(p.type_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{getCityName(p.city_id)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.listing_type}</TableCell>
                  <TableCell className="font-medium">{p.currency} {p.price.toLocaleString()}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const statusMeta = STATUS_META[p.status];

                      return (
                    <Select
                      value={p.status}
                      onValueChange={(value) => {
                        void handlePropertyStatusChange(p, value);
                      }}
                      disabled={deletingIdSet.has(p.id) || statusUpdatingIdSet.has(p.id)}
                    >
                      <SelectTrigger className={`h-8 w-[142px] border ${statusMeta.triggerClassName}`}>
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
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={e => e.stopPropagation()}><Link href={`/properties/${p.id}`}>View</Link></Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={e => e.stopPropagation()}><Link href={`/properties/${p.id}/edit`}>Edit</Link></Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSingleDeleteDialog(p);
                        }}
                        disabled={deletingIdSet.has(p.id)}
                      >
                        {deletingIdSet.has(p.id) ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
