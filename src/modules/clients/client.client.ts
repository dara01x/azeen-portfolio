"use client";

import { auth } from "@/lib/firebase/client";
import type { Client } from "@/types";

type ClientApiItem = Client & {
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

export async function getClients(): Promise<ClientApiItem[]> {
  const payload = await authorizedJsonFetch<{ clients: ClientApiItem[] }>("/api/clients/list", {
    method: "GET",
  });

  return Array.isArray(payload.clients) ? payload.clients : [];
}

export async function getClientById(id: string): Promise<ClientApiItem | undefined> {
  const clients = await getClients();
  return clients.find((client) => client.id === id);
}

export async function createClient(data: Partial<Client>): Promise<ClientApiItem> {
  const payload = await authorizedJsonFetch<{ client: ClientApiItem }>(
    "/api/clients/create",
    {
      method: "POST",
    },
    { data },
  );

  return payload.client;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<ClientApiItem> {
  const payload = await authorizedJsonFetch<{ client: ClientApiItem }>(
    "/api/clients/update",
    {
      method: "PUT",
    },
    { id, data },
  );

  return payload.client;
}

export async function deleteClient(id: string): Promise<void> {
  await authorizedJsonFetch<{ success: boolean }>(
    "/api/clients/delete",
    {
      method: "DELETE",
    },
    { id },
  );
}
