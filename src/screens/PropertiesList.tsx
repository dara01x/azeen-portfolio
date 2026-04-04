import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { getProperties as fetchProperties } from "@/modules/properties/property.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import type { Property } from "@/types";
import type { AppVariableItem } from "@/modules/app-variables/types";

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
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
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
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id));
  const someFilteredSelected =
    filteredIds.some((id) => selectedIdSet.has(id)) && !allFilteredSelected;

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
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedPropertyIds([])}>
                Clear selection
              </Button>
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
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</TableHead>
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
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">{getTypeName(p.type_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{getCityName(p.city_id)}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.listing_type}</TableCell>
                  <TableCell className="font-medium">{p.currency} {p.price.toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={e => e.stopPropagation()}><Link href={`/properties/${p.id}`}>View</Link></Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={e => e.stopPropagation()}><Link href={`/properties/${p.id}/edit`}>Edit</Link></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default PropertiesList;
