import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { AreaBoundaryPickerMap } from "@/components/AreaBoundaryPickerMap";
import {
  createVariable,
  deleteVariable,
  getVariables,
  updateVariable,
} from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import type { AppVariableItem, AppVariableType, AreaBoundaryPoint } from "@/modules/app-variables/types";

const MIN_AREA_BOUNDARY_POINTS = 3;

function normalizeAreaBoundaryPoints(points?: AreaBoundaryPoint[]) {
  if (!Array.isArray(points)) {
    return [] as AreaBoundaryPoint[];
  }

  return points
    .filter(
      (point) =>
        typeof point?.lat === "number" &&
        Number.isFinite(point.lat) &&
        typeof point?.lng === "number" &&
        Number.isFinite(point.lng),
    )
    .map((point) => ({
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
    }));
}

function VariableTable({ title, type }: { title: string; type: AppVariableType }) {
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<AppVariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedItem, setSelectedItem] = useState<AppVariableItem | null>(null);
  const [boundaryPoints, setBoundaryPoints] = useState<AreaBoundaryPoint[]>([]);
  const [editBoundaryPoints, setEditBoundaryPoints] = useState<AreaBoundaryPoint[]>([]);
  const isAreaType = type === "areas";

  const loadItems = useCallback(async () => {
    if (authLoading || !user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const variables = await getVariables(type);
      setItems(variables);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load values.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authLoading, type, user]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || authLoading || !user) {
      return;
    }

    const normalizedBoundary = normalizeAreaBoundaryPoints(boundaryPoints);
    if (isAreaType && normalizedBoundary.length < MIN_AREA_BOUNDARY_POINTS) {
      setError("Area boundary must contain at least 3 points.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createVariable(
        type,
        trimmed,
        isAreaType ? { area_boundary: normalizedBoundary } : undefined,
      );
      setName("");
      setBoundaryPoints([]);
      setDialogOpen(false);
      await loadItems();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create value.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: AppVariableItem) {
    setSelectedItem(item);
    setEditName(item.name);
    setEditBoundaryPoints(normalizeAreaBoundaryPoints(item.area_boundary));
    setEditDialogOpen(true);
  }

  function openDelete(item: AppVariableItem) {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  }

  async function saveEdit() {
    const trimmed = editName.trim();
    if (!selectedItem || !trimmed || authLoading || !user) {
      return;
    }

    const normalizedBoundary = normalizeAreaBoundaryPoints(editBoundaryPoints);
    if (isAreaType && normalizedBoundary.length < MIN_AREA_BOUNDARY_POINTS) {
      setError("Area boundary must contain at least 3 points.");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      await updateVariable(
        type,
        selectedItem.id,
        trimmed,
        isAreaType ? { area_boundary: normalizedBoundary } : undefined,
      );
      setEditDialogOpen(false);
      setSelectedItem(null);
      setEditName("");
      setEditBoundaryPoints([]);
      await loadItems();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update value.";
      setError(message);
    } finally {
      setUpdating(false);
    }
  }

  async function confirmDelete() {
    if (!selectedItem || authLoading || !user) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteVariable(type, selectedItem.id);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      await loadItems();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete value.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={authLoading || !user}><Plus className="mr-1 h-3 w-3" />Add</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading values...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {isAreaType ? <TableHead className="w-[160px]">Map Boundary</TableHead> : null}
                  <TableHead className="w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground" colSpan={isAreaType ? 3 : 2}>No values yet.</TableCell>
                  </TableRow>
                ) : items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    {isAreaType ? (
                      <TableCell>
                        {normalizeAreaBoundaryPoints(item.area_boundary).length >= MIN_AREA_BOUNDARY_POINTS ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Set
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Missing
                          </span>
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => openEdit(item)}
                          disabled={authLoading || !user}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => openDelete(item)}
                          disabled={authLoading || !user}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setBoundaryPoints([]);
          }
        }}
      >
        <DialogContent className={isAreaType ? "max-w-3xl" : undefined}><DialogHeader><DialogTitle>Add {title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>

            {isAreaType ? (
              <div className="space-y-3">
                <Label>Area Boundary on Map</Label>
                <AreaBoundaryPickerMap points={boundaryPoints} onChange={setBoundaryPoints} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Click on map to add boundary points. First point is Start (S), last point is End (E), and the boundary closes automatically. Minimum {MIN_AREA_BOUNDARY_POINTS} points required.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBoundaryPoints((current) => current.slice(0, -1))}
                      disabled={boundaryPoints.length === 0}
                    >
                      Undo Point
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBoundaryPoints([])}
                      disabled={boundaryPoints.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setDialogOpen(false); setBoundaryPoints([]); }}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSelectedItem(null);
            setEditName("");
            setEditBoundaryPoints([]);
          }
        }}
      >
        <DialogContent className={isAreaType ? "max-w-3xl" : undefined}>
          <DialogHeader><DialogTitle>Edit {title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            {isAreaType ? (
              <div className="space-y-3">
                <Label>Area Boundary on Map</Label>
                <AreaBoundaryPickerMap points={editBoundaryPoints} onChange={setEditBoundaryPoints} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Click on map to update boundary points. First point is Start (S), last point is End (E), and the boundary closes automatically. Minimum {MIN_AREA_BOUNDARY_POINTS} points required.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditBoundaryPoints((current) => current.slice(0, -1))}
                      disabled={editBoundaryPoints.length === 0}
                    >
                      Undo Point
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditBoundaryPoints([])}
                      disabled={editBoundaryPoints.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updating}>{updating ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setSelectedItem(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedItem ? `"${selectedItem.name}"` : "this value"}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const AppVariables = () => (
  <div>
    <PageHeader title="App Variables" description="Manage system lookup values" />
    <Tabs defaultValue="types">
      <TabsList>
        <TabsTrigger value="types">Property Types</TabsTrigger>
        <TabsTrigger value="cities">Cities</TabsTrigger>
        <TabsTrigger value="areas">Areas</TabsTrigger>
        <TabsTrigger value="amenities">Amenities</TabsTrigger>
        <TabsTrigger value="views">Views</TabsTrigger>
      </TabsList>
      <TabsContent value="types"><VariableTable title="Property Types" type="property_types" /></TabsContent>
      <TabsContent value="cities"><VariableTable title="Cities" type="cities" /></TabsContent>
      <TabsContent value="areas"><VariableTable title="Areas" type="areas" /></TabsContent>
      <TabsContent value="amenities"><VariableTable title="Amenities" type="amenities" /></TabsContent>
      <TabsContent value="views"><VariableTable title="Views" type="views" /></TabsContent>
    </Tabs>
  </div>
);

export default AppVariables;
