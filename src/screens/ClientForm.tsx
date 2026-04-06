import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/useAuth";
import { createClient, deleteClient, getClientById, updateClient } from "@/modules/clients/client.client";
import type { Client } from "@/types";

const defaultClient: Omit<Client, "id"> = { full_name: "", primary_phone: "", status: "active" };

const ClientForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const [form, setForm] = useState<Omit<Client, "id">>(defaultClient);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }

    if (authLoading) {
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    if (!id) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getClientById(id)
      .then((client) => {
        if (cancelled) {
          return;
        }

        if (!client) {
          setError("Client not found.");
          return;
        }

        const { id: _id, ...rest } = client;
        setForm({ ...defaultClient, ...rest });
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load client data.";
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
  }, [authLoading, id, isEdit, user]);

  const handleSubmit = async () => {
    if (authLoading || saving || loading || deleting) {
      return;
    }

    if (!user) {
      setError("You must be signed in to save clients.");
      return;
    }

    const fullName = form.full_name.trim();
    const primaryPhone = form.primary_phone.trim();
    const notes = form.notes?.trim();

    if (!fullName) {
      setError("Full name is required.");
      return;
    }

    if (!primaryPhone) {
      setError("Primary phone is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Omit<Client, "id"> = {
      ...form,
      full_name: fullName,
      primary_phone: primaryPhone,
      notes: notes || undefined,
      status: form.status || "active",
    };

    try {
      if (isEdit && id) {
        await updateClient(id, payload);
      } else {
        await createClient(payload);
      }

      router.push("/clients");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save client.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !id || authLoading || !user || deleting) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteClient(id);
      setDeleteDialogOpen(false);
      router.push("/clients");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete client.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild><Link href="/clients"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Client" : "Create Client"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{isEdit ? "Update client information" : "Add a new client to your database"}</p>
        </div>
        <div className="flex gap-2">
          {isEdit ? (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={saving || loading || deleting}>
                  Delete Client
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Client Permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove this client from your database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleting}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleDelete();
                    }}
                  >
                    {deleting ? "Deleting..." : "Delete Client"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button variant="outline" asChild><Link href="/clients">Cancel</Link></Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || loading || deleting}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Client"}</Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {loading && isEdit ? (
        <p className="text-sm text-muted-foreground">Loading client data...</p>
      ) : (
        <div className="grid gap-6 max-w-2xl">
          <Card>
            <CardHeader className="pb-4"><CardTitle className="text-base">Client Information</CardTitle><CardDescription>Personal and contact details</CardDescription></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} /></div>
              <div className="space-y-2"><Label>Primary Phone</Label><Input value={form.primary_phone} onChange={(e) => update("primary_phone", e.target.value)} /></div>
              <div className="sm:col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} rows={4} placeholder="Any notes about this client..." /></div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" asChild><Link href="/clients">Cancel</Link></Button>
            <Button onClick={() => void handleSubmit()} size="lg" disabled={saving || loading || deleting}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Client"}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientForm;
