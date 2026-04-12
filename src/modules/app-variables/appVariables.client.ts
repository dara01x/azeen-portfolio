"use client";

import { auth } from "@/lib/firebase/client";
import type { AppVariableItem, AppVariableType, AreaBoundaryPoint } from "@/modules/app-variables/types";

async function authorizedJsonFetch(url: string, options: RequestInit = {}) {
  const idToken = await auth.currentUser?.getIdToken();

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.error === "string" ? payload.error : `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

export async function getVariables(type: AppVariableType): Promise<AppVariableItem[]> {
  const payload = await authorizedJsonFetch(`/api/app-variables/list?type=${encodeURIComponent(type)}`, {
    method: "GET",
  });

  return Array.isArray(payload.variables) ? payload.variables : [];
}

type VariablePayload = {
  area_boundary?: AreaBoundaryPoint[];
};

export async function createVariable(
  type: AppVariableType,
  name: string,
  payload?: VariablePayload,
): Promise<AppVariableItem> {
  const responsePayload = await authorizedJsonFetch("/api/app-variables/create", {
    method: "POST",
    body: JSON.stringify({ type, name, payload }),
  });

  return responsePayload.variable as AppVariableItem;
}

export async function updateVariable(
  type: AppVariableType,
  id: string,
  name: string,
  payload?: VariablePayload,
): Promise<AppVariableItem> {
  const responsePayload = await authorizedJsonFetch("/api/app-variables/update", {
    method: "PUT",
    body: JSON.stringify({ type, id, name, payload }),
  });

  return responsePayload.variable as AppVariableItem;
}

export async function deleteVariable(type: AppVariableType, id: string): Promise<void> {
  await authorizedJsonFetch("/api/app-variables/delete", {
    method: "DELETE",
    body: JSON.stringify({ type, id }),
  });
}
