"use client";

import { auth } from "@/lib/firebase/client";
import type { User } from "@/types";

type UserApiItem = User & {
  created_at?: string | null;
  updated_at?: string | null;
};

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

async function authorizedJsonFetch<TResponse>(
  url: string,
  init: RequestInit = {},
  body?: JsonObject,
): Promise<TResponse> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }

  const token = await user.getIdToken();

  const response = await fetch(url, {
    ...init,
    method: init.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  } & TResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

export async function getUsers(): Promise<UserApiItem[]> {
  const payload = await authorizedJsonFetch<{ users: UserApiItem[] }>("/api/users/list", {
    method: "GET",
  });

  return Array.isArray(payload.users) ? payload.users : [];
}

export async function getUserById(id: string): Promise<UserApiItem | undefined> {
  const users = await getUsers();
  return users.find((user) => user.id === id);
}

export async function createUser(data: Partial<User>, password: string): Promise<UserApiItem> {
  const payload = await authorizedJsonFetch<{ user: UserApiItem }>(
    "/api/users/create",
    {
      method: "POST",
    },
    { data, password },
  );

  return payload.user;
}

export async function updateUser(id: string, data: Partial<User>, password?: string): Promise<UserApiItem> {
  const body: JsonObject = password ? { id, data, password } : { id, data };

  const payload = await authorizedJsonFetch<{ user: UserApiItem }>(
    "/api/users/update",
    {
      method: "PUT",
    },
    body,
  );

  return payload.user;
}

export async function deleteUser(id: string): Promise<void> {
  await authorizedJsonFetch<{ success: boolean }>(
    "/api/users/delete",
    {
      method: "DELETE",
    },
    { id },
  );
}
