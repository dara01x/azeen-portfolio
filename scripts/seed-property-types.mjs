#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PROPERTY_TYPES = [
  "Tower",
  "Esse reprehenderit",
  "Land",
  "Penthouse",
  "Building",
  "Warehouse",
  "Farm",
  "Office",
  "Shop",
  "Apartment",
  "Studio",
  "Restaurant",
  "Duplex Apartment",
  "House",
  "Villa",
];

function loadEnvFromFile(fileName) {
  const envPath = path.resolve(process.cwd(), fileName);

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex < 0) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!projectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

async function seedPropertyTypes() {
  loadEnvFromFile(".env.local");
  loadEnvFromFile(".env");

  const app = getAdminApp();
  const db = getFirestore(app);

  const collectionRef = db.collection("property_types");
  const existingSnapshot = await collectionRef.get();

  const existingNames = new Set(
    existingSnapshot.docs
      .map((doc) => doc.data()?.name)
      .filter((name) => typeof name === "string")
      .map((name) => name.trim().toLowerCase()),
  );

  const toCreate = PROPERTY_TYPES.filter((name) => !existingNames.has(name.trim().toLowerCase()));

  if (toCreate.length === 0) {
    console.log("No new property types to add. Everything is already present.");
    return;
  }

  const batch = db.batch();

  for (const name of toCreate) {
    const docRef = collectionRef.doc();
    batch.set(docRef, {
      name,
      created_at: Timestamp.now(),
    });
  }

  await batch.commit();

  console.log(`Added ${toCreate.length} property types:`);
  for (const name of toCreate) {
    console.log(`- ${name}`);
  }
}

seedPropertyTypes().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to seed property types: ${message}`);
  process.exit(1);
});
