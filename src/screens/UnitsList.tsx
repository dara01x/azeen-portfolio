import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/useAuth";
import { getProjects as fetchProjects } from "@/modules/projects/project.client";
import { deleteUnit as deleteUnitById, getUnits as fetchUnits } from "@/modules/units/unit.client";
import type { Project, Unit, UnitOption } from "@/types";

const UnitsList = () => {
  const { user, loading: authLoading } = useAuth();

  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setUnits([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.allSettled([fetchUnits(), fetchProjects()])
      .then(([unitsResult, projectsResult]) => {
        if (cancelled) {
          return;
        }

        setUnits(unitsResult.status === "fulfilled" ? (unitsResult.value as Unit[]) : []);
        setProjects(projectsResult.status === "fulfilled" ? (projectsResult.value as Project[]) : []);

        if (unitsResult.status === "rejected" || projectsResult.status === "rejected") {
          setError("Some unit data could not be loaded.");
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load units.";
          setError(message);
          setUnits([]);
          setProjects([]);
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

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();

    projects.forEach((project) => {
      map.set(project.id, project.title);
    });

    return map;
  }, [projects]);

  const getProjectName = (projectId: string) => projectNameById.get(projectId) || "Unknown project";

  const getUnitOptions = (unit: Unit): UnitOption[] => {
    if (unit.properties && unit.properties.length > 0) {
      return unit.properties;
    }

    return [
      {
        price: unit.price,
        currency: unit.currency,
        interface: [],
        building_no: undefined,
        floor_no: unit.floor_number == null ? undefined : String(unit.floor_number),
        active: unit.status === "available",
        sold: unit.status === "sold",
      },
    ];
  };

  const getUnitOptionStats = (unit: Unit) => {
    const options = getUnitOptions(unit);

    return {
      total: options.length,
      sold: options.filter((item) => item.sold).length,
      available: options.filter((item) => item.active && !item.sold).length,
    };
  };

  const getUnitPriceLabel = (unit: Unit) => {
    const options = getUnitOptions(unit);
    const prices = options.map((item) => Number(item.price) || 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const currencies = Array.from(new Set(options.map((item) => item.currency)));
    const currencyLabel = currencies.length === 1 ? currencies[0] : "Mixed";

    if (minPrice === maxPrice) {
      return `${currencyLabel} ${minPrice.toLocaleString()}`;
    }

    return `${currencyLabel} ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
  };

  const filtered = useMemo(
    () =>
      units.filter((unit) => {
        const projectName = projectNameById.get(unit.project_id) || "Unknown project";

        if (search) {
          const term = search.toLowerCase();
          const matchesNumber = (unit.unit_number || "").toLowerCase().includes(term);
          const matchesTitle = (unit.title || "").toLowerCase().includes(term);
          const matchesCode = (unit.unit_code || "").toLowerCase().includes(term);
          const matchesProject = projectName.toLowerCase().includes(term);
          const matchesType = (unit.type_id || "").toLowerCase().includes(term);

          if (!matchesNumber && !matchesTitle && !matchesCode && !matchesProject && !matchesType) {
            return false;
          }
        }

        if (projectFilter !== "all" && unit.project_id !== projectFilter) {
          return false;
        }

        if (statusFilter !== "all" && unit.status !== statusFilter) {
          return false;
        }

        return true;
      }),
    [units, search, projectFilter, statusFilter, projectNameById],
  );

  function openDeleteDialog(item: Unit) {
    setSelectedUnit(item);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedUnit || authLoading || !user) {
      return;
    }

    setDeletingUnitId(selectedUnit.id);
    setError(null);

    try {
      await deleteUnitById(selectedUnit.id);
      setUnits((current) => current.filter((item) => item.id !== selectedUnit.id));
      setDeleteDialogOpen(false);
      setSelectedUnit(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete unit.";
      setError(message);
    } finally {
      setDeletingUnitId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Units"
        description="Manage individual project units"
        actions={
          <Button asChild>
            <Link href="/units/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Link>
          </Button>
        }
      />

      <Card className="p-1.5">
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search units..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0"
            />
          </div>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[190px] h-9 bg-muted/50 border-0">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Loading units...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState title="Failed to load units" description={error} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No units found"
              description="Try adjusting filters or add a new unit."
              action={
                <Button asChild>
                  <Link href="/units/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Unit
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layout</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="w-[160px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((unit) => {
                const optionStats = getUnitOptionStats(unit);

                return (
                  <TableRow key={unit.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-10 w-14 shrink-0 rounded-md border bg-muted overflow-hidden">
                          {unit.main_image || unit.images[0] ? (
                            <img
                              src={unit.main_image || unit.images[0]}
                              alt={`${unit.unit_number} thumbnail`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{unit.title || unit.unit_number || "Unit"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {unit.type_id || "No type"}
                            {unit.unit_number || unit.unit_code ? ` • ${unit.unit_number || unit.unit_code}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getProjectName(unit.project_id)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getUnitPriceLabel(unit)}
                      <p className="text-[11px] text-muted-foreground mt-0.5">Price range</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {unit.features?.bedrooms ?? unit.bedrooms} BR • {unit.features?.suit_rooms ?? unit.suit_rooms} SR • {unit.features?.bathrooms ?? unit.bathrooms} BA
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {optionStats.available}/{optionStats.total} available
                        {optionStats.sold > 0 ? ` • ${optionStats.sold} sold` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={unit.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                          <Link href={`/units/${unit.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(unit)}
                          disabled={deletingUnitId === unit.id}
                        >
                          {deletingUnitId === unit.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && deletingUnitId) {
            return;
          }

          setDeleteDialogOpen(open);

          if (!open) {
            setSelectedUnit(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedUnit ? `"${selectedUnit.title || selectedUnit.unit_number || "Unit"}"` : "this unit"}. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingUnitId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingUnitId}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deletingUnitId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UnitsList;
