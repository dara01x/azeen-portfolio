import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth/useAuth";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { getProjects as fetchProjects, updateProject as updateProjectById } from "@/modules/projects/project.client";
import type { Project } from "@/types";

const PROJECTS_PAGE_SIZE = 10;

const STATUS_META: Record<
  Project["status"],
  { label: string; dotClassName: string; triggerClassName: string }
> = {
  active: {
    label: "Active",
    dotClassName: "bg-emerald-500",
    triggerClassName: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  completed: {
    label: "Completed",
    dotClassName: "bg-blue-500",
    triggerClassName: "bg-blue-50 text-blue-800 border-blue-200",
  },
  archived: {
    label: "Archived",
    dotClassName: "bg-slate-500",
    triggerClassName: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

function parseFilterNumber(value: string) {
  const normalized = value.replace(/[,_\s]/g, "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function isProjectStatus(value: string): value is Project["status"] {
  return value === "active" || value === "completed" || value === "archived";
}

const ProjectsList = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hasUnitsFilter, setHasUnitsFilter] = useState("all");
  const [minAreaFilter, setMinAreaFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusUpdatingProjectIds, setStatusUpdatingProjectIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

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

  const hasActiveFilters =
    cityFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    hasUnitsFilter !== "all" ||
    minAreaFilter.trim() !== "" ||
    minPriceFilter.trim() !== "" ||
    maxPriceFilter.trim() !== "";

  const resetFilters = () => {
    setCityFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setHasUnitsFilter("all");
    setMinAreaFilter("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadProjects() {
      try {
        setLoading(true);
        setError("");
        const result = await fetchProjects();

        if (!mounted) {
          return;
        }

        setProjects(result as Project[]);
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
      const typeNames = (project.property_type_ids || []).map(getPropertyTypeName).join(" ").toLowerCase();
      const typeIds = (project.property_type_ids || []).join(" ").toLowerCase();

      const matchesTitle = project.title.toLowerCase().includes(term);
      const matchesId =
        getProjectCode(project).toLowerCase().includes(term) || project.id.toLowerCase().includes(term);
      const matchesCity =
        getCityName(project.city_id).toLowerCase().includes(term) || project.city_id.toLowerCase().includes(term);
      const matchesType = typeNames.includes(term) || typeIds.includes(term);

      if (!matchesTitle && !matchesId && !matchesCity && !matchesType) {
        return false;
      }
    }

    if (cityFilter !== "all" && project.city_id !== cityFilter) {
      return false;
    }

    if (typeFilter !== "all" && !(project.property_type_ids || []).includes(typeFilter)) {
      return false;
    }

    if (statusFilter !== "all" && project.status !== statusFilter) {
      return false;
    }

    if (hasUnitsFilter === "yes" && !project.has_units) {
      return false;
    }

    if (hasUnitsFilter === "no" && project.has_units) {
      return false;
    }

    const minArea = parseFilterNumber(minAreaFilter);
    if (minArea != null && project.area_size < minArea) {
      return false;
    }

    const minPrice = parseFilterNumber(minPriceFilter);
    if (minPrice != null && project.starting_price < minPrice) {
      return false;
    }

    const maxPrice = parseFilterNumber(maxPriceFilter);
    if (maxPrice != null && project.starting_price > maxPrice) {
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
    statusFilter,
    hasUnitsFilter,
    minAreaFilter,
    minPriceFilter,
    maxPriceFilter,
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
  const statusUpdatingIdSet = new Set(statusUpdatingProjectIds);
  const allVisibleSelected =
    visibleProjectIds.length > 0 && visibleProjectIds.every((id) => selectedIdSet.has(id));
  const someVisibleSelected =
    visibleProjectIds.some((id) => selectedIdSet.has(id)) && !allVisibleSelected;

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

  const markStatusUpdatingId = (id: string) => {
    setStatusUpdatingProjectIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const unmarkStatusUpdatingId = (id: string) => {
    setStatusUpdatingProjectIds((current) => current.filter((currentId) => currentId !== id));
  };

  async function handleProjectStatusChange(project: Project, nextStatusValue: string) {
    if (!isProjectStatus(nextStatusValue)) {
      return;
    }

    if (statusUpdatingIdSet.has(project.id) || project.status === nextStatusValue) {
      return;
    }

    const previousStatus = project.status;
    markStatusUpdatingId(project.id);
    setError("");

    setProjects((current) =>
      current.map((item) => (item.id === project.id ? { ...item, status: nextStatusValue } : item)),
    );

    try {
      const { id: _id, ...projectPayload } = project;
      const updated = await updateProjectById(project.id, {
        ...projectPayload,
        status: nextStatusValue,
      });

      setProjects((current) => current.map((item) => (item.id === project.id ? updated : item)));
      toast.success("Project status updated.");
    } catch (updateError) {
      setProjects((current) =>
        current.map((item) => (item.id === project.id ? { ...item, status: previousStatus } : item)),
      );

      const message = updateError instanceof Error ? updateError.message : "Failed to update project status.";
      setError(message);
      toast.error(message, {
        style: {
          background: "hsl(var(--destructive))",
          color: "hsl(var(--destructive-foreground))",
          borderColor: "hsl(var(--destructive))",
        },
      });
    } finally {
      unmarkStatusUpdatingId(project.id);
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Manage your development projects"
        actions={
          <Button asChild>
            <Link href="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link>
          </Button>
        }
      />

      <Card className="p-1.5">
        {lookupError ? <div className="px-3 pt-3 text-sm text-destructive">{lookupError}</div> : null}

        <div className="flex flex-wrap gap-2 p-3 pb-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, type, or city..."
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
                  <p className="text-xs font-medium text-muted-foreground">Property Type</p>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Property Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Property Types</SelectItem>
                      {propertyTypes.map((typeItem) => (
                        <SelectItem key={typeItem.id} value={typeItem.id}>{typeItem.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Has Units</p>
                  <Select value={hasUnitsFilter} onValueChange={setHasUnitsFilter}>
                    <SelectTrigger className="h-9 bg-muted/50 border-0"><SelectValue placeholder="Has Units" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Min Area (m2)</p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Min"
                    value={minAreaFilter}
                    onChange={(event) => setMinAreaFilter(event.target.value)}
                    className="h-9 bg-muted/50 border-0"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Starting Price Range</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Min"
                      value={minPriceFilter}
                      onChange={(event) => setMinPriceFilter(event.target.value)}
                      className="h-9 bg-muted/50 border-0"
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="Max"
                      value={maxPriceFilter}
                      onChange={(event) => setMaxPriceFilter(event.target.value)}
                      className="h-9 bg-muted/50 border-0"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {selectedProjectIds.length > 0 ? (
          <div className="px-3 pt-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{selectedProjectIds.length} selected</p>
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
        ) : null}

        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading projects...</div>
        ) : error ? (
          <div className="p-6">
            <EmptyState
              title="Unable to load projects"
              description={error}
              action={
                <Button asChild>
                  <Link href="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link>
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No projects found"
              description="Try adjusting filters or add a new project."
              action={
                <Button asChild>
                  <Link href="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[44px]">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAllVisible}
                      aria-label="Select all projects on current page"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thumbnail</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project ID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Units</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Starting Price</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[90px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    className={`group cursor-pointer ${selectedIdSet.has(project.id) ? "bg-muted/30" : ""}`}
                    onClick={() => router.push(`/projects/${project.id}/edit`)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedIdSet.has(project.id)}
                        onCheckedChange={(checked) => toggleProjectSelection(project.id, checked)}
                        aria-label={`Select ${project.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="h-16 w-24 overflow-hidden rounded-md border bg-muted/20">
                        {project.main_image || project.images[0] ? (
                          <img
                            src={project.main_image || project.images[0]}
                            alt={`${project.title} thumbnail`}
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
                      {getProjectCode(project)}
                    </TableCell>
                    <TableCell className="font-medium">{project.title}</TableCell>
                    <TableCell className="text-muted-foreground">{getProjectTypeLabel(project)}</TableCell>
                    <TableCell className="text-muted-foreground">{getCityName(project.city_id)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.available_units}/{project.total_units}
                    </TableCell>
                    <TableCell className="font-medium">
                      {project.currency} {project.starting_price.toLocaleString()}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {(() => {
                        const statusMeta = STATUS_META[project.status];

                        return (
                          <Select
                            value={project.status}
                            onValueChange={(value) => {
                              void handleProjectStatusChange(project, value);
                            }}
                            disabled={statusUpdatingIdSet.has(project.id)}
                          >
                            <SelectTrigger className={`h-8 w-[142px] border ${statusMeta.triggerClassName}`}>
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${statusMeta.dotClassName}`} />
                                <SelectValue placeholder="Status" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">{STATUS_META.active.label}</SelectItem>
                              <SelectItem value="completed">{STATUS_META.completed.label}</SelectItem>
                              <SelectItem value="archived">{STATUS_META.archived.label}</SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          asChild
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Link href={`/projects/${project.id}/edit`}>Edit</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

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
    </div>
  );
};

export default ProjectsList;
