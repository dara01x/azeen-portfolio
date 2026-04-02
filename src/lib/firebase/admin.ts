import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (typeof window !== "undefined") {
  throw new Error("firebase-admin must only be used in server-side code.");
}

function getAdminApp() {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase admin environment variables.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function getAdminDb() {
  return getFirestore(getAdminApp());
}

function getAdminAuth() {
  return getAuth(getAdminApp());
}

function normalizeStorageBucketName(value: string) {
  return value
    .trim()
    .replace(/^gs:\/\//, "")
    .replace(/^https?:\/\/[\w.-]+\//, "")
    .replace(/\/$/, "");
}

function getAdminStorageBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "";

  if (!bucketName) {
    throw new Error("Missing Firebase storage bucket environment variable.");
  }

  const normalizedBucket = normalizeStorageBucketName(bucketName);
  return getStorage(getAdminApp()).bucket(normalizedBucket);
}

export { getAdminDb, getAdminAuth, getAdminStorageBucket };
