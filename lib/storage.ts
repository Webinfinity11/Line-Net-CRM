import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Attachment storage.
 * - Local / VPS: files on disk under UPLOAD_DIR (default ./uploads).
 * - Vercel: private Vercel Blob when BLOB_READ_WRITE_TOKEN is set (serverless disks are ephemeral).
 * Stored paths are opaque: "blob:<pathname>" for Blob, "<scope>/<file>" for disk.
 */
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function safeName(name: string) {
  return name.replace(/[^\w.\-Ⴀ-ჿ ]+/g, "_").slice(0, 120) || "file";
}

export async function saveFile(scope: string, fileName: string, data: Buffer | Uint8Array) {
  const stored = `${randomUUID()}-${safeName(fileName)}`;
  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const pathname = path.posix.join(scope, stored);
    await put(pathname, Buffer.from(data), { access: "private", addRandomSuffix: false });
    return `blob:${pathname}`;
  }
  const dir = path.join(ROOT, scope);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), data);
  return path.posix.join(scope, stored);
}

export async function readStoredFile(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith("blob:")) {
    const { get } = await import("@vercel/blob");
    const res = await get(storagePath.slice(5), { access: "private" });
    if (!res || !res.stream) throw new Error("file not found");
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  const full = path.resolve(ROOT, storagePath);
  if (!full.startsWith(ROOT)) throw new Error("invalid path");
  return readFile(full);
}

export async function deleteStoredFile(storagePath: string) {
  if (storagePath.startsWith("blob:")) {
    const { del } = await import("@vercel/blob");
    await del(storagePath.slice(5)).catch(() => {});
    return;
  }
  const full = path.resolve(ROOT, storagePath);
  if (!full.startsWith(ROOT)) return;
  await unlink(full).catch(() => {});
}
