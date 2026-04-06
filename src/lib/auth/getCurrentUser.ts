"use client";

import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import type { AuthUser, UserRole, UserStatus } from "@/lib/auth/types";

function isValidRole(role: unknown): role is UserRole {
  return role === "admin" || role === "company";
}

function isValidStatus(status: unknown): status is UserStatus {
  return status === "active" || status === "disabled";
}

async function waitForFirebaseUser(): Promise<FirebaseUser | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getCurrentUser(firebaseUserInput?: FirebaseUser | null): Promise<AuthUser | null> {
  const firebaseUser =
    firebaseUserInput === undefined ? await waitForFirebaseUser() : firebaseUserInput;
  if (!firebaseUser || !firebaseUser.email) {
    return null;
  }

  const idToken = await firebaseUser.getIdToken();

  const response = await fetch("/api/auth/profile", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch user profile.");
  }

  const data = (await response.json()) as Partial<AuthUser>;

  if (
    typeof data.uid !== "string" ||
    typeof data.email !== "string" ||
    typeof data.full_name !== "string" ||
    !isValidRole(data.role) ||
    !isValidStatus(data.status)
  ) {
    return null;
  }

  return {
    uid: data.uid,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    status: data.status,
  };
}
