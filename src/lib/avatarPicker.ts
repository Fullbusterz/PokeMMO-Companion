import { Platform } from 'react-native';

// Picking a profile picture, and — just as important — shrinking it before it
// ever leaves the device.
//
// A photo straight out of a phone gallery is 3-8 MB. Every viewer's picture is
// downloaded by every other device at the table, so the size of this file is
// the difference between "a face next to each name" and "the tournament page
// takes twenty seconds to open on the venue's wifi". Everything is therefore
// cropped square and resampled to AVATAR_SIZE before upload, which lands a
// typical photo at 4-8 KB — small enough that the whole table's avatars cost
// less than one screenshot.

export const AVATAR_SIZE = 128;
const JPEG_QUALITY = 0.72;
/** Mirrors the server-side ceiling in supabase/avatars.sql. */
export const MAX_AVATAR_CHARS = 65536;

export class AvatarPickerUnavailable extends Error {
  constructor() {
    super('avatar picking is not available on this platform build');
    this.name = 'AvatarPickerUnavailable';
  }
}

/**
 * Draws `source` cropped to a centred square and resampled to AVATAR_SIZE,
 * returning a JPEG data URI. Web only — the canvas API is what does the work.
 */
function toSquareDataUri(source: CanvasImageSource, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  // Centre-crop: take the largest square that fits, so a portrait photo keeps
  // the middle of the frame instead of being squashed into a circle.
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;

  // A flat fill behind the photo means a transparent PNG doesn't come out with
  // a black square where the background should be.
  ctx.fillStyle = '#122530';
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

async function decodeFile(file: File): Promise<{ source: CanvasImageSource; w: number; h: number }> {
  // createImageBitmap is both faster and the only route that lets us ask for
  // EXIF orientation to be applied, so a photo taken sideways on a phone is
  // not stored sideways forever.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, w: bitmap.width, h: bitmap.height };
    } catch {
      // Older Safari rejects the options bag; fall through to the <img> path,
      // where the browser applies orientation itself these days.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('could not read that image'));
      el.src = url;
    });
    return { source: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Turns an already-chosen file into an upload-ready data URI. */
export async function fileToAvatarDataUri(file: File): Promise<string> {
  const { source, w, h } = await decodeFile(file);
  if (!w || !h) throw new Error('could not read that image');
  return toSquareDataUri(source, w, h);
}

function pickOnWeb(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    // On a phone browser this opens the gallery (with a camera option); on a
    // desktop it opens the file dialog. Same code path for both, which is why
    // the web build covers "from my gallery" and "from my PC" at once.
    input.accept = 'image/png,image/jpeg,image/webp,image/*';
    input.style.display = 'none';

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      fileToAvatarDataUri(file)
        .then(finish)
        .catch((error) => {
          if (settled) return;
          settled = true;
          input.remove();
          reject(error);
        });
    };
    // Cancelling the dialog fires no event in most browsers; `cancel` exists in
    // newer ones, and without it the promise would simply never settle and the
    // button would stay stuck on "subiendo".
    input.oncancel = () => finish(null);

    document.body.appendChild(input);
    input.click();
  });
}

type ImagePickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets?: { base64?: string | null; uri: string }[];
  }>;
  MediaTypeOptions?: { Images: unknown };
};

// The native path needs expo-image-picker (gallery access) and
// expo-image-manipulator (the resize, since ImagePicker only compresses and a
// compressed 12-megapixel photo is still far too big). Both are native modules:
// installing them is not enough, the APK has to be rebuilt. Rather than pretend
// otherwise, this resolves them at call time and reports honestly when the
// running build does not have them — the web/PWA path, which is what the share
// link opens, works regardless.
async function pickOnNative(): Promise<string | null> {
  let picker: ImagePickerModule;
  let manipulator: {
    manipulateAsync: (
      uri: string,
      actions: unknown[],
      options: Record<string, unknown>
    ) => Promise<{ base64?: string | null }>;
    SaveFormat: { JPEG: unknown };
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    picker = require('expo-image-picker') as ImagePickerModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    manipulator = require('expo-image-manipulator');
  } catch {
    throw new AvatarPickerUnavailable();
  }

  const permission = await picker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await picker.launchImageLibraryAsync({
    mediaTypes: picker.MediaTypeOptions?.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return null;

  const resized = await manipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
    { compress: JPEG_QUALITY, format: manipulator.SaveFormat.JPEG, base64: true }
  );
  if (!resized.base64) throw new Error('could not read that image');
  return `data:image/jpeg;base64,${resized.base64}`;
}

/**
 * Opens the platform's picker and returns an upload-ready data URI, or null if
 * the person backed out.
 */
export function pickAvatar(): Promise<string | null> {
  return Platform.OS === 'web' ? pickOnWeb() : pickOnNative();
}
