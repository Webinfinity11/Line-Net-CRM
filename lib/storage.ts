import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");

function safeName(name: string) {
  return name.replace(/[^\w.\-Ⴀ-ჿ ]+/g, "_").slice(0, 120) || "file";
}

export async function saveFile(scope: string, fileName: string, data: Buffer | Uint8Array) {
  const dir = path.join(ROOT, scope);
  await mkdir(dir, { recursive: true });
  const stored = `${randomUUID()}-${safeName(fileName)}`;
  await writeFile(path.join(dir, stored), data);
  return path.posix.join(scope, stored);
}

export async function readStoredFile(storagePath: string) {
  const full = path.resolve(ROOT, storagePath);
  if (!full.startsWith(ROOT)) throw new Error("invalid path");
  return readFile(full);
}

export async function deleteStoredFile(storagePath: string) {
  const full = path.resolve(ROOT, storagePath);
  if (!full.startsWith(ROOT)) return;
  await unlink(full).catch(() => {});
}
