"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export async function logout() {
  await signOut(auth);
}
