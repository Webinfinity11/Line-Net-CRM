// Browser-only: phone photos are 3–8 MB, while a server action accepts at most 4 MB (Vercel caps a request at 4.5 MB).
// Shrinks a photo to 1600px on its long side as JPEG before it is uploaded; anything else passes through untouched.

const MAX_SIDE = 1600;
const QUALITY = 0.82;
/** Leaves room under the 4 MB action limit for the multipart overhead. */
export const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024 - 64 * 1024;

export function targetSize(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = targetSize(bitmap.width, bitmap.height);
    if (width === bitmap.width && file.size < 900 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    // an unreadable format (e.g. HEIC in a browser without support) is sent as it is
    return file;
  }
}
