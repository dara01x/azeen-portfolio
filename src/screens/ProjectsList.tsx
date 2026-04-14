import { useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth/useAuth";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import {
  deleteProject as deleteProjectById,
  getProjects as fetchProjects,
} from "@/modules/projects/project.client";
import { getUnits as fetchUnits } from "@/modules/units/unit.client";
import type { Project, Unit } from "@/types";

type DeleteDialogState = {
  open: boolean;
  projectIds: string[];
  subjectLabel: string;
};

const PROJECTS_PAGE_SIZE = 10;

const ProjectsList = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingProjectIds, setDeletingProjectIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    projectIds: [],
    subjectLabel: "",
  });

  const getProjectCode = (project: Project) =>
    `PJ${project.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "0")}`;

  const getCityName = (id: string) => cities.find((city) => city.id === id)?.name || id;
  const getPropertyTypeName = (id: string) => propertyTypes.find((type) => type.id === id)?.name || id;

  const getProjectTypeLabel = (project: Project) => {
    if (!project.property_type_ids || project.property_type_ids.length === 0) {
      return "-";
    }

    return project.property_type_ids.map(getPropertyTypeName).join(", ");
  };

  const areaOptions = useMemo(
    () =>
      Array.from(new Set(projects.map((project) => project.area.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [projects],
  );

  const hasActiveFilters =
    cityFilter !== "all" || areaFilter !== "all";
  const canManageProjects = !!user && user.role !== "viewer";

  const resetFilters = () => {
    setCityFilter("all");
    setAreaFilter("all");
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setProjects([]);
      setUnits([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadProjects() {
      try {
        setLoading(true);
        setError("");
        const [projectsResult, unitsResult] = await Promise.allSettled([
          fetchProjects(),
          fetchUnits(),
        ]);

        if (!mounted) {
          return;
        }

        setProjects(projectsResult.status === "fulfilled" ? (projectsResult.value as Project[]) : []);
        setUnits(unitsResult.status === "fulfilled" ? (unitsResult.value as Unit[]) : []);

        if (projectsResult.status === "rejected" || unitsResult.status === "rejected") {
          setError("Some project data could not be loaded.");
        }
      } catch (fetchError) {
        if (!mounted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to load projects.";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  const projectUnitStats = useMemo(() => {
    const statsMap = new Map<string, { total: number; available: number; sold: number }>();

    units.forEach((unit) => {
      const projectId = unit.project_id;
      if (!projectId) {
        return;
      }

      const current = statsMap.get(projectId) || { total: 0, available: 0, sold: 0 };
      const options = unit.properties && unit.properties.length > 0
        ? unit.properties
        : [
            {
              price: unit.price,
              currency: unit.currency,
              interface: [],
              building_no: undefined,
              floor_no: undefined,
              active: unit.status === "available",
              sold: unit.status === "sold",
            },
          ];

      current.total += options.length;

      options.forEach((option) => {
        if (option.sold) {
          current.sold += 1;
          return;
        }

        if (option.active) {
          current.available += 1;
        }
      });

      statsMap.set(projectId, current);
    });

    return statsMap;
  }, [units]);

  const getProjectUnitStats = (projectId: string) =>
    projectUnitStats.get(projectId) || { total: 0, available: 0, sold: 0 };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let mounted = true;

    Promise.all([getVariables("cities"), getVariables("property_types")])
      .then(([cityItems, typeItems]) => {
        if (!mounted) {
          return;
        }

        setLookupError("");
        setCities(cityItems);
        setPropertyTypes(typeItems);
      })
      .catch((fetchError) => {
        if (!mounted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to load filters.";
        setLookupError(message);
      });

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  const filtered = projects.filter((project) => {
    if (search) {
      const term = search.toLowerCase();

      const matchesTitle = project.title.toLowerCase().includes(term);
      const matchesId =
        getProjectCode(project).toLowerCase().includes(term) || project.id.toLowerCase().includes(term);

      if (!matchesTitle && !matchesId) {
        return false;
      }
    }

    if (cityFilter !== "all" && project.city_id !== cityFilter) {
      return false;
    }

    if (areaFilter !== "all" && project.area !== areaFilter) {
      return false;
    }

    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    cityFilter,
    areaFilter,
  ]);

  useEffect(() => {
    const availableIds = new Set(projects.map((project) => project.id));
    setSelectedProjectIds((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [projects]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROJECTS_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PROJECTS_PAGE_SIZE;
  const endIndexExclusive = startIndex + PROJECTS_PAGE_SIZE;
  const paginatedProjects = filtered.slice(startIndex, endIndexExclusive);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectedIdSet = new Set(selectedProjectIds);
  const visibleProjectIds = paginatedProjects.map((project) => project.id);
  const visibleProjectIdSet = new Set(visibleProjectIds);
  const deletingIdSet = new Set(deletingProjectIds);
  const allVisibleSelected =
    visibleProjectIds.length > 0 && visibleProjectIds.every((id) => selectedIdSet.has(id));
  const someVisibleSelected =
    visibleProjectIds.some((id) => selectedIdSet.has(id)) && !allVisibleSelected;
  const dialogProjectCount = deleteDialog.projectIds.length;
  const dialogIsDeleting = deleteDialog.projectIds.some((id) => deletingIdSet.has(id));
  const dialogIsBulkDelete = dialogProjectCount > 1;

  const deleteDialogTitle = dialogIsBulkDelete
    ? `Delete ${dialogProjectCount} Projects Permanently?`
    : "Delete Project Permanently?";

  const deleteDialogDescription = dialogIsBulkDelete
    ? `This will remove ${dialogProjectCount} selected projects from Firestore and delete all their uploaded images from Firebase Storage. This action cannot be undone.`
    : `This will remove ${deleteDialog.subjectLabel ? `"${deleteDialog.subjectLabel}"` : "this project"} from Firestore and delete all uploaded images from Firebase Storage. This action cannot be undone.`;

  const deleteActionLabel = dialogIsDeleting
    ? "Deleting..."
    : dialogIsBulkDelete
      ? "Delete Selected"
      : "Delete Project";

  const toggleSelectAllVisible = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedProjectIds((current) => {
        const next = new Set(current);
        visibleProjectIds.forEach((id) => next.add(id));
        return Array.from(next);
      });
      return;
    }

    setSelectedProjectIds((current) => current.filter((id) => !visibleProjectIdSet.has(id)));
  };

  const toggleProjectSelection = (projectId: string, checked: boolean | "indeterminate") => {
    setSelectedProjectIds((current) => {
      if (checked === true) {
        return current.includes(projectId) ? current : [...current, projectId];
      }

      return current.filter((id) => id !== projectId);
    });
  };

  const markDeletingIds = (ids: string[]) => {
    setDeletingProjectIds((current) => Array.from(new Set([...current, ...ids])));
  };

  const unmarkDeletingIds = (ids: string[]) => {
    const idsToRemove = new Set(ids);
    setDeletingProjectIds((current) => current.filter((id) => !idsToRemove.has(id)));
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      open: false,
      projectIds: [],
      subjectLabel: "",
    });
  };

  const openDeleteDialog = (projectIds: string[], subjectLabel = "") => {
    if (projectIds.length === 0) {
      return;
    }

    setDeleteDialog({
      open: true,
      projectIds: [...projectIds],
      subjectLabel,
    });
  };

  async function deleteProjectsByIds(projectIds: string[]) {
    if (projectIds.length === 0) {
      return;
    }

    markDeletingIds(projectIds);
    setError("");

    try {
      const results = await Promise.allSettled(projectIds.map((projectId) => deleteProjectById(projectId)));

      const deletedIds: string[] = [];
      const failedIds: string[] = [];

      results.forEach((result, index) => {
        const projectId = projectIds[index];
        if (result.status === "fulfilled") {
          deletedIds.push(projectId);
        } else {
          failedIds.push(projectId);
        }
      });

      if (deletedIds.length > 0) {
        const deletedIdSet = new Set(deletedIds);
        setProjects((current) => current.filter((item) => !deletedIdSet.has(item.id)));
        setSelectedProjectIds((current) => current.filter((id) => !deletedIdSet.has(id)));
      }

      if (failedIds.length > 0) {
        const errorMessage =
          failedIds.length === 1
            ? "1 selected project could not be deleted."
            : `${failedIds.length} selected projects could not be deleted.`;

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
            ? "1 project deleted successfully."
            : `${deletedIds.length} projects deleted successfully.`;

        toast.success(successMessage);
      }
    } finally {
      unmarkDeletingIds(projectIds);
    }
  }

  const openSingleDeleteDialog = (project: Project) => {
    if (!canManageProjects) {
      return;
    }

    if (deletingIdSet.has(project.id)) {
      return;
    }

    openDeleteDialog([project.id], project.title);
  };

  const openSelectedDeleteDialog = () => {
    if (!canManageProjects) {
      return;
    }

    if (selectedProjectIds.length === 0) {
      return;
    }

    openDeleteDialog(selectedProjectIds);
  };

  async function handleConfirmDeleteDialog() {
    if (dialogProjectCount === 0 || dialogIsDeleting) {
      return;
    }

    await deleteProjectsByIds([...deleteDialog.projectIds]);
    closeDeleteDialog();
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Manage your development projects"
        actions={
          canManageProjects ? (
            <Button asChild>
              <Link href="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link>
            </Button>
          ) : undefined
        }
      />

      <Card className="p-1.5">
        {lookupError ? <div className="px-3 pt-3 text-sm text-destructive">{lookupError}</div> : null}

        <div className="flex flex-wrap gap-2 p-3 pb-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="SEARCH BY ID OR NAME OF THE PROJECT"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0"
            />
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
                  <p className="text-sm font-semibold">Filter Projects</p>
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
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Area</p>
                  <Select value={areaFilter} onValueChange={setAreaFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Area" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem className="my-1 rounded-md border border-border/60" value="all">All Areas</SelectItem>
                      {areaOptions.map((areaName, index) => (
                        <SelectItem className="my-1 rounded-md border border-border/60" key={areaName} value={areaName}>{index + 1}. {areaName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {canManageProjects && selectedProjectIds.length > 0 ? (
          <div className="px-3 pt-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{selectedProjectIds.length} selected</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={openSelectedDeleteDialog}
                  disabled={selectedProjectIds.some((id) => deletingIdSet.has(id))}
                >
                  {selectedProjectIds.some((id) => deletingIdSet.has(id)) ? "Deleting..." : "Delete Selected"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedProjectIds([])}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading projects...</div>
        ) : error ? (
          <div className="p-6">
            <EmptyState
              title="Unable to load projects"
              description={error}
              action={
                canManageProjects ? (
                  <Button asChild>
                    <Link href="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No projects found"
              description="Try adjusting filters or add a new project."
              action={
                canManageProjects ? (
                  <Button asChild>
                    <Link href="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3">
              {canManageProjects ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAllVisible}
                    aria-label="Select all projects on current page"
                  />
                  <span className="text-xs text-muted-foreground">Select all on this page</span>
                </div>
              ) : <div />}
              <p className="text-xs text-muted-foreground">{paginatedProjects.length} cards on this page</p>
            </div>

            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {paginatedProjects.map((project) => {
                const unitStats = getProjectUnitStats(project.id);

                return (
                  <div
                    key={project.id}
                    className={`group cursor-pointer overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-sm ${selectedIdSet.has(project.id) ? "ring-2 ring-primary/35" : ""}`}
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-muted/20">
                      {project.main_image || project.images[0] ? (
                        <img
                          src={project.main_image || project.images[0]}
                          alt={`${project.title} thumbnail`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}

                      {canManageProjects ? (
                        <div className="absolute left-2 top-2" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedIdSet.has(project.id)}
                            onCheckedChange={(checked) => toggleProjectSelection(project.id, checked)}
                            aria-label={`Select ${project.title}`}
                          />
                        </div>
                      ) : null}

                      <div className="absolute right-2 top-2 rounded-md border bg-background/90 px-2 py-1 font-mono text-[11px] font-semibold text-muted-foreground">
                        {getProjectCode(project)}
                      </div>
                    </div>

                    <div className="space-y-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold">{project.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {getProjectTypeLabel(project)} • {getCityName(project.city_id)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-md border bg-muted/30 px-2 py-1">
                          Total Units {unitStats.total}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-1" onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                          <Link href={`/projects/${project.id}`}>View</Link>
                        </Button>
                        {canManageProjects ? (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                              <Link href={`/projects/${project.id}/edit`}>Edit</Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                openSingleDeleteDialog(project);
                              }}
                              disabled={deletingIdSet.has(project.id)}
                            >
                              {deletingIdSet.has(project.id) ? "Deleting..." : "Delete"}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndexExclusive, filtered.length)} of {filtered.length} projects
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

      {canManageProjects ? (
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
      ) : null}
    </div>
  );
};

export default ProjectsList;
