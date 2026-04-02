import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { mockPropertyTypes, mockCities, mockAmenities, mockViews } from "@/data/mock";

interface SimpleItem { id: string; name: string; }

function VariableTable({ title, items: initialItems }: { title: string; items: SimpleItem[] }) {
  const [items, setItems] = useState<SimpleItem[]>(initialItems);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<SimpleItem | null>(null);
  const [name, setName] = useState("");

  const openNew = () => { setEditItem(null); setName(""); setDialogOpen(true); };
  const openEdit = (item: SimpleItem) => { setEditItem(item); setName(item.name); setDialogOpen(true); };
  const save = () => {
    if (editItem) {
      setItems(items.map(i => i.id === editItem.id ? { ...i, name } : i));
    } else {
      setItems([...items, { id: String(Date.now()), name }]);
    }
    setDialogOpen(false);
  };
  const remove = (id: string) => setItems(items.filter(i => i.id !== id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-3 w-3" />Add</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-[100px]"></TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editItem ? "Edit" : "Add"} {title}</DialogTitle></DialogHeader>
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
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
      <TabsContent value="types"><VariableTable title="Property Types" items={mockPropertyTypes} /></TabsContent>
      <TabsContent value="cities"><VariableTable title="Cities" items={mockCities} /></TabsContent>
      <TabsContent value="amenities"><VariableTable title="Amenities" items={mockAmenities} /></TabsContent>
      <TabsContent value="views"><VariableTable title="Views" items={mockViews} /></TabsContent>
    </Tabs>
  </div>
);

export default AppVariables;
