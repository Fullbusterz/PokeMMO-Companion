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
function toSquareDataUri(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number = JPEG_QUALITY
): string {
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

  return canvas.toDataURL('image/jpeg', quality);
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

/**
 * Turns an already-chosen file into an upload-ready data URI, re-encoding at a
 * lower quality if the first pass somehow lands over the server's ceiling. At
 * 128px that essentially never happens, but "your photo is too big" is a dead
 * end for someone at a table trying to join a tournament, and trying again at
 * 0.6 costs a millisecond.
 */
export async function fileToAvatarDataUri(file: File): Promise<string> {
  const { source, w, h } = await decodeFile(file);
  if (!w || !h) throw new Error('could not read that image');

  for (const quality of [JPEG_QUALITY, 0.6, 0.45]) {
    const uri = toSquareDataUri(source, w, h, quality);
    if (uri.length <= MAX_AVATAR_CHARS) return uri;
  }
  return toSquareDataUri(source, w, h, 0.3);
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
    // button would stay stuck on "subiendo". Safari does not have it, so the
    // window regaining focus with no file chosen is the backstop — with a
    // delay, because the change event lands just after focus returns.
    input.oncancel = () => finish(null);
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files || input.files.length === 0) finish(null);
      }, 600);
      window.removeEventListener('focus', onFocus);
    };
    window.addEventListener('focus', onFocus);

    document.body.appendChild(input);
    input.click();
  });
}

// The native path. Both modules are real dependencies now (expo-image-picker
// and expo-image-manipulator, added for SDK 57 — the picker for the gallery,
// the manipulator for the resize, since ImagePicker only compresses and a
// compressed 12-megapixel photo is still far too big to send).
//
// They are still resolved at call time rather than imported at the top: they
// are native modules, so an already-installed APK built before they were added
// simply does not have them, and reporting that plainly beats crashing on a
// missing native module. The web path, which is what the share link opens,
// never touches either.
type ImagePickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
    canceled: boolean;
    assets?: { uri: string }[];
  }>;
};

type ManipulatorModule = {
  ImageManipulator: {
    manipulate: (uri: string) => {
      resize: (size: { width: number; height: number }) => unknown;
      renderAsync: () => Promise<{
        saveAsync: (options: Record<string, unknown>) => Promise<{ base64?: string | null }>;
      }>;
    };
  };
  SaveFormat: { JPEG: string };
};

async function pickOnNative(): Promise<string | null> {
  let picker: ImagePickerModule;
  let manipulator: ManipulatorModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    picker = require('expo-image-picker') as ImagePickerModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    manipulator = require('expo-image-manipulator') as ManipulatorModule;
  } catch {
    throw new AvatarPickerUnavailable();
  }

  const permission = await picker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  // `mediaTypes` takes an array of strings in SDK 57 — the MediaTypeOptions
  // enum this used to take is gone (checked against the v57 docs, not memory).
  const result = await picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return null;

  // Contextual API, also SDK 57: manipulate() schedules, renderAsync() does the
  // work, saveAsync() encodes. manipulateAsync() still exists but is deprecated.
  const context = manipulator.ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: manipulator.SaveFormat.JPEG,
    base64: true,
    compress: JPEG_QUALITY,
  });
  if (!saved.base64) throw new Error('could not read that image');
  return `data:image/jpeg;base64,${saved.base64}`;
}

/**
 * Opens the platform's picker and returns an upload-ready data URI, or null if
 * the person backed out.
 */
export function pickAvatar(): Promise<string | null> {
  return Platform.OS === 'web' ? pickOnWeb() : pickOnNative();
}
