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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/useAuth";
import {
  createUser,
  deleteUser,
  getUserById,
  updateUser,
} from "@/modules/users/user.client";
import type { User } from "@/types";

const defaultUser: Omit<User, "id"> = { full_name: "", email: "", role: "admin", status: "active", phone: "" };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const UserForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";
  const [form, setForm] = useState<Omit<User, "id">>(defaultUser);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }

    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getUserById(id)
      .then((item) => {
        if (cancelled) {
          return;
        }

        if (!item) {
          setError("User not found.");
          return;
        }

        const { id: _id, ...rest } = item;
        setForm({ ...defaultUser, ...rest });
        setPassword("");
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load user data.";
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

  async function handleSubmit() {
    if (authLoading || !user || loading || saving || deleting) {
      return;
    }

    const fullName = form.full_name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const nextPassword = password;

    if (!fullName) {
      setError("Full name is required.");
      return;
    }

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Email format is invalid.");
      return;
    }

    if (!phone) {
      setError("Phone is required.");
      return;
    }

    if (!isEdit && !nextPassword) {
      setError("Password is required.");
      return;
    }

    if (nextPassword && nextPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Omit<User, "id"> = {
      ...form,
      full_name: fullName,
      email,
      phone,
      company_name: form.role === "company" ? form.company_name?.trim() || undefined : undefined,
      company_phone: form.role === "company" ? form.company_phone?.trim() || undefined : undefined,
      company_address: form.role === "company" ? form.company_address?.trim() || undefined : undefined,
    };

    try {
      if (isEdit && id) {
        await updateUser(id, payload, nextPassword || undefined);
      } else {
        await createUser(payload, nextPassword);
      }

      router.push("/users");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save user.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !id || authLoading || !user || deleting) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteUser(id);
      setDeleteDialogOpen(false);
      router.push("/users");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete user.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild><Link href="/users"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit User" : "Create User"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{isEdit ? "Update user account" : "Add a new system user"}</p>
        </div>
        <div className="flex gap-2">
          {isEdit ? (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={saving || loading || deleting}>
                  Delete User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove this user from your records. This action cannot be undone.
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
                    {deleting ? "Deleting..." : "Delete User"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button variant="outline" asChild><Link href="/users">Cancel</Link></Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || loading || deleting}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create User"}
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {loading && isEdit ? (
        <p className="text-sm text-muted-foreground">Loading user data...</p>
      ) : (
      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">User Information</CardTitle><CardDescription>Account and role details</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={e => update("full_name", e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => update("email", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>{isEdit ? "New Password" : "Password"}</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? "Leave blank to keep current password" : "Minimum 6 characters"}
              />
              <p className="text-xs text-muted-foreground">
                {isEdit ? "Set a new value only when you want to reset login password." : "Share this password with the user so they can sign in."}
              </p>
            </div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => update("phone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Role</Label>
              <Select value={form.role} onValueChange={v => update("role", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        {form.role === "company" && (
          <Card>
            <CardHeader className="pb-4"><CardTitle className="text-base">Company Details</CardTitle><CardDescription>Additional information for company users</CardDescription></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2"><Label>Company Name</Label><Input value={form.company_name || ""} onChange={e => update("company_name", e.target.value)} /></div>
              <div className="space-y-2"><Label>Company Phone</Label><Input value={form.company_phone || ""} onChange={e => update("company_phone", e.target.value)} /></div>
              <div className="space-y-2"><Label>Company Address</Label><Input value={form.company_address || ""} onChange={e => update("company_address", e.target.value)} /></div>
            </CardContent>
          </Card>
        )}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" asChild><Link href="/users">Cancel</Link></Button>
          <Button onClick={() => void handleSubmit()} size="lg" disabled={saving || loading || deleting}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create User"}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
};

export default UserForm;
