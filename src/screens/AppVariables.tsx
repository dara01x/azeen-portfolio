import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { createVariable, getVariables } from "@/modules/app-variables/appVariables.client";
import { useAuth } from "@/lib/auth/useAuth";
import type { AppVariableItem, AppVariableType } from "@/modules/app-variables/types";

function VariableTable({ title, type }: { title: string; type: AppVariableType }) {
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<AppVariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

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

    setSaving(true);
    setError(null);

    try {
      await createVariable(type, trimmed);
      setName("");
      setDialogOpen(false);
      await loadItems();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create value.";
      setError(message);
    } finally {
      setSaving(false);
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
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell className="text-sm text-muted-foreground">No values yet.</TableCell>
              </TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </CardContent>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add {title}</DialogTitle></DialogHeader>
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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
        <TabsTrigger value="amenities">Amenities</TabsTrigger>
        <TabsTrigger value="views">Views</TabsTrigger>
      </TabsList>
      <TabsContent value="types"><VariableTable title="Property Types" type="property_types" /></TabsContent>
      <TabsContent value="cities"><VariableTable title="Cities" type="cities" /></TabsContent>
      <TabsContent value="amenities"><VariableTable title="Amenities" type="amenities" /></TabsContent>
      <TabsContent value="views"><VariableTable title="Views" type="views" /></TabsContent>
    </Tabs>
  </div>
);

export default AppVariables;
