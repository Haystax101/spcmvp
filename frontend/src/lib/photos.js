import { storage, PROFILE_PHOTOS_BUCKET_ID } from './appwrite';

// Photo size presets for different contexts
export const PHOTO_SIZES = {
  thumbnail: { width: 100, height: 100 }, // inbox, chat avatars
  medium: { width: 300, height: 300 },    // compatibility detail
  large: { width: 750, height: 750 },     // full profile, home feed
};

/**
 * Build a photo URL from a file ID
 * @param {string} fileId - The photo file ID from Appwrite Storage
 * @param {Object} options - Optional sizing and quality options
 * @param {number} options.width - Image width (default: 750)
 * @param {number} options.height - Image height (default: 750)
 * @param {number} options.quality - JPEG quality 1-100 (default: 78)
 * @param {string} options.output - Output format 'webp' or 'jpg' (default: 'webp')
 * @returns {string|null} - Preview URL or null if error
 */
export function buildPhotoUrl(fileId, options = {}) {
  if (!fileId || typeof fileId !== 'string' || !fileId.trim()) {
    return null;
  }

  const {
    width = 750,
    height = 750,
    quality = 78,
    output = 'webp',
  } = options;

  try {
    return String(storage.getFilePreview({
      bucketId: PROFILE_PHOTOS_BUCKET_ID,
      fileId: fileId.trim(),
      width,
      height,
      quality,
      output,
    }));
  } catch (err) {
    console.warn('Failed to build photo URL:', err);
    return null;
  }
}

/**
 * Extract photo file IDs from a profile object
 * Handles both top-level photo_file_ids and nested in free_text_responses.profile_ui
 * @param {Object} profile - Profile object from tables or enriched search
 * @returns {Array<string>} - Array of file IDs, empty array if none found
 */
export function extractPhotoFileIds(profile) {
  if (!profile) return [];

  // Try top-level photo_file_ids first
  let ids = profile.photo_file_ids;
  
  // Handle if it's a JSON string
  if (typeof ids === 'string' && ids.startsWith('[')) {
    try {
      ids = JSON.parse(ids);
    } catch (e) {
      ids = null;
    }
  }

  if (Array.isArray(ids) && ids.length > 0) {
    return ids.filter(id => typeof id === 'string' && id.trim());
  }

  // Fallback to singular photo_file_id (often used in flattened gateway responses)
  if (typeof profile.photo_file_id === 'string' && profile.photo_file_id.trim()) {
    return [profile.photo_file_id.trim()];
  }

  // Try nested in free_text_responses.profile_ui
  try {
    let freeText = profile.free_text_responses;
    if (typeof freeText === 'string') {
      freeText = JSON.parse(freeText);
    }
    if (freeText && typeof freeText === 'object' && freeText.profile_ui) {
      let nestedIds = freeText.profile_ui.photo_file_ids;
      if (typeof nestedIds === 'string' && nestedIds.startsWith('[')) {
        nestedIds = JSON.parse(nestedIds);
      }
      if (Array.isArray(nestedIds)) {
        const filtered = nestedIds.filter(id => typeof id === 'string' && id.trim());
        if (filtered.length > 0) return filtered;
      }
    }
  } catch (err) {
    // Silent fail for JSON parse errors
  }

  return [];
}

/**
 * Get the first valid photo URL from a profile
 * Tries to extract file IDs and return first photo at specified size
 * @param {Object} profile - Profile object
 * @param {Object} options - Sizing options (see buildPhotoUrl)
 * @returns {string|null} - Photo URL or null
 */
export function getProfilePhotoUrl(profile, options = {}) {
  const fileIds = extractPhotoFileIds(profile);
  if (fileIds.length === 0) return null;
  return buildPhotoUrl(fileIds[0], options);
}

/**
 * Get all photo URLs from a profile (for carousel/gallery)
 * @param {Object} profile - Profile object
 * @param {Object} options - Sizing options
 * @returns {Array<string|null>} - Array of URLs (may contain nulls for failed photos)
 */
export function getAllProfilePhotoUrls(profile, options = {}) {
  const fileIds = extractPhotoFileIds(profile);
  return fileIds.map(fileId => buildPhotoUrl(fileId, options));
}

/**
 * Build a thumbnail URL (100px for inbox/chat contexts)
 * @param {string} fileId - Photo file ID
 * @returns {string|null}
 */
export function buildThumbnailUrl(fileId) {
  return buildPhotoUrl(fileId, PHOTO_SIZES.thumbnail);
}

/**
 * Build a large URL (750px for full profile/home feed)
 * @param {string} fileId - Photo file ID
 * @returns {string|null}
 */
export function buildLargeUrl(fileId) {
  return buildPhotoUrl(fileId, { ...PHOTO_SIZES.large, quality: 78, output: 'webp' });
}
