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
import { deleteUser as deleteUserById, getUsers as fetchUsers } from "@/modules/users/user.client";
import type { User } from "@/types";

const roleColors: Record<User["role"], string> = {
  owner: "bg-violet-100 text-violet-700 border-violet-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  company: "bg-amber-100 text-amber-700 border-amber-200",
};

const UsersList = () => {
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchUsers()
      .then((items) => {
        if (!cancelled) {
          setUsers(items as User[]);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load users.";
          setError(message);
          setUsers([]);
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

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (search) {
          const term = search.toLowerCase();
          const matchesName = u.full_name.toLowerCase().includes(term);
          const matchesEmail = u.email.toLowerCase().includes(term);
          const matchesPhone = u.phone.toLowerCase().includes(term);
          const matchesCompany = (u.company_name || "").toLowerCase().includes(term);

          if (!matchesName && !matchesEmail && !matchesPhone && !matchesCompany) {
            return false;
          }
        }

        if (roleFilter !== "all" && u.role !== roleFilter) {
          return false;
        }

        if (statusFilter !== "all" && u.status !== statusFilter) {
          return false;
        }

        return true;
      }),
    [users, search, roleFilter, statusFilter],
  );

  function openDeleteDialog(item: User) {
    setSelectedUser(item);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedUser || authLoading || !user) {
      return;
    }

    setDeletingUserId(selectedUser.id);
    setError(null);

    try {
      await deleteUserById(selectedUser.id);
      setUsers((current) => current.filter((item) => item.id !== selectedUser.id));
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete user.";
      setError(message);
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Users" description="Manage system users" actions={<Button asChild><Link href="/users/new"><Plus className="mr-2 h-4 w-4" />Add User</Link></Button>} />
      <Card className="p-1.5">
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/50 border-0" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-0"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-0"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Loading users...</p>
          </div>
        ) : error ? (
          <div className="p-6">
            <EmptyState title="Failed to load users" description={error} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState title="No users found" description="Try adjusting filters or add a new user." action={<Button asChild><Link href="/users/new"><Plus className="mr-2 h-4 w-4" />Add User</Link></Button>} /></div>
        ) : (
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="w-[140px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="group">
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${roleColors[u.role] || ""}`}>{u.role}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{u.company_name || "-"}</TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                        <Link href={`/users/${u.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(u)}
                        disabled={deletingUserId === u.id}
                      >
                        {deletingUserId === u.id ? "Deleting..." : "Delete"}
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
          if (!open && deletingUserId) {
            return;
          }

          setDeleteDialogOpen(open);

          if (!open) {
            setSelectedUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedUser ? `"${selectedUser.full_name}"` : "this user"} from your user
              records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingUserId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingUserId}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deletingUserId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersList;
