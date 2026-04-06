import { useEffect, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/useAuth";
import { deleteClient as deleteClientById, getClients as fetchClients } from "@/modules/clients/client.client";
import type { Client } from "@/types";

const ClientsList = () => {
  const { user, loading: authLoading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setClients([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchClients()
      .then((items) => {
        if (!cancelled) {
          setClients(items as Client[]);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load clients.";
          setError(message);
          setClients([]);
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

  const filtered = clients.filter((c) => {
    if (search && !c.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function openDeleteDialog(client: Client) {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedClient || authLoading || !user) {
      return;
    }

    setDeletingClientId(selectedClient.id);
    setError(null);

    try {
      await deleteClientById(selectedClient.id);

      setClients((current) => current.filter((client) => client.id !== selectedClient.id));
      setDeleteDialogOpen(false);
      setSelectedClient(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete client.";
      setError(message);
    } finally {
      setDeletingClientId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Clients" description="Manage your client database" actions={<Button asChild><Link href="/clients/new"><Plus className="mr-2 h-4 w-4" />Add Client</Link></Button>} />
      <Card className="p-1.5">
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by client name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/50 border-0" />
          </div>
        </div>
        {loading ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Loading clients...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState title="Failed to load clients" description={error} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState title="No clients found" description="Try searching by client name or add a new client." action={<Button asChild><Link href="/clients/new"><Plus className="mr-2 h-4 w-4" />Add Client</Link></Button>} /></div>
        ) : (
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</TableHead>
              <TableHead className="w-[140px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="group">
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.primary_phone}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[320px] truncate">{c.notes || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <Link href={`/clients/${c.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(c)}
                        disabled={deletingClientId === c.id}
                      >
                        {deletingClientId === c.id ? "Deleting..." : "Delete"}
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
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && deletingClientId) {
            return;
          }

          setDeleteDialogOpen(open);
          if (!open) {
            setSelectedClient(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedClient ? `"${selectedClient.full_name}"` : "this client"} from your
              database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingClientId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingClientId}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deletingClientId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsList;
