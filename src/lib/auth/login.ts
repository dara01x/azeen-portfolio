"use client";

import { browserLocalPersistence, setPersistence, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logout } from "@/lib/auth/logout";

export async function login(email: string, password: string) {
  await setPersistence(auth, browserLocalPersistence);
  await signInWithEmailAndPassword(auth, email, password);

  const user = await getCurrentUser();

  if (!user) {
    await logout();
    throw new Error("Your account profile was not found. Please contact an administrator.");
  }

  if (user.status !== "active") {
    await logout();
    throw new Error("Your account is disabled. Please contact an administrator.");
  }

  return user;
}
