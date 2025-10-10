const API_ROOT = 'https://api.vimeo.com';
const DEFAULT_FOLDER_ID = process.env.VIMEO_FOLDER_ID || '26555277';
const DEFAULT_OWNER_ID = process.env.VIMEO_OWNER_ID || '112996063';

const DEFAULT_QUERY = {
  per_page: '100',
  sort: 'date',
  direction: 'desc'
};

function buildCandidatePaths(folderId, ownerId) {
  return [
    `/users/${ownerId}/projects/${folderId}/videos`,
    `/me/projects/${folderId}/videos`,
    `/me/folders/${folderId}/videos`,
    `/folders/${folderId}/videos`
  ];
}

function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  try {
    return new URL(pathOrUrl, API_ROOT).toString();
  } catch {
    return null;
  }
}

async function fetchJson(url, token, signal) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.vimeo.*+json;version=3.4'
    },
    signal
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`[${response.status}] ${body.slice(0, 400)}`.trim());
  }

  return response.json();
}

async function fetchPaginated(path, token, { query = {}, signal } = {}) {
  let url = new URL(path, API_ROOT);
  const params = new URLSearchParams({
    ...DEFAULT_QUERY,
    ...Object.fromEntries(Object.entries(query).filter(([, value]) => value != null))
  });
  url.search = params.toString();

  const videos = [];
  let guard = 0;

  while (url && guard < 25) {
    const payload = await fetchJson(url, token, signal);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    videos.push(...data);

    const next = toAbsoluteUrl(payload?.paging?.next);
    url = next ? new URL(next) : null;
    guard += 1;
  }

  return videos;
}

export async function fetchFolderVideos(token, options = {}) {
  const {
    folderId = DEFAULT_FOLDER_ID,
    ownerId = DEFAULT_OWNER_ID,
    query,
    signal
  } = options;

  if (!token) {
    throw new Error('Vimeo access token is required');
  }

  const candidates = buildCandidatePaths(folderId, ownerId);
  const errors = [];
  let emptyResult;

  for (const path of candidates) {
    try {
      const videos = await fetchPaginated(path, token, { query, signal });
      if (videos.length > 0) {
        return videos;
      }
      if (emptyResult === undefined) {
        emptyResult = videos;
      }
    } catch (error) {
      errors.push(`${path}: ${error.message}`);
    }
  }

  if (emptyResult !== undefined) {
    return emptyResult;
  }

  const message = errors.length
    ? `Unable to fetch videos for folder ${folderId}. Attempts: ${errors.join(' | ')}`
    : `Unable to fetch videos for folder ${folderId}.`;
  throw new Error(message);
}

export function extractVideoMetadata(description = '') {
  const metadata = {};
  if (!description) return metadata;

  const patterns = {
    customer: /Customer\s*:\s*(.+)/i,
    customerEmail: /Customer Email\s*:\s*(.+)/i,
    recordedBy: /Recorded By\s*:\s*(.+)/i,
    recordedByEmail: /Recorded By Email\s*:\s*(.+)/i,
    recordingDate: /Recording Date\s*:\s*(.+)/i
  };

  for (const [key, regex] of Object.entries(patterns)) {
    const match = description.match(regex);
    if (match) {
      metadata[key] = match[1].trim();
    }
  }

  return metadata;
}

export function summarizeCustomersFromVideos(videos = []) {
  const customersMap = new Map();

  videos.forEach((video) => {
    const metadata = extractVideoMetadata(video?.description);
    const email = metadata.customerEmail?.trim();
    if (!email) return;

    const normalizedEmail = email.toLowerCase();
    const displayName = metadata.customer || video?.name || 'Unknown Customer';
    const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);
    const lastName = rest.join(' ');
    const created = video?.created_time ? new Date(video.created_time).toISOString() : null;

    if (!customersMap.has(normalizedEmail)) {
      customersMap.set(normalizedEmail, {
        id: normalizedEmail.replace(/[^a-z0-9]/gi, ''),
        name: displayName,
        email,
        firstName,
        lastName,
        videoCount: 0,
        lastRecordingDate: created
      });
    }

    const customer = customersMap.get(normalizedEmail);
    customer.videoCount += 1;
    if (!customer.lastRecordingDate || (created && created > customer.lastRecordingDate)) {
      customer.lastRecordingDate = created;
    }
  });

  return Array.from(customersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomersCache(token, folderId) {
  try {
    // Use dedicated cache folder
    const cacheFolderId = '26918583';
    const videos = await fetchFolderVideos(token, { folderId: cacheFolderId, query: { query: 'CUSTOMERS_CACHE', sort: 'date', direction: 'desc' } });
    const cacheVideo = videos.find(v => v.name === 'CUSTOMERS_CACHE');
    if (!cacheVideo) return null;

    const description = cacheVideo.description || '';
    const cacheMatch = description.match(/CACHE_DATA:\s*(\{.*\})/s);
    if (!cacheMatch) return null;

    const cacheData = JSON.parse(cacheMatch[1]);
    const cacheAge = Date.now() - cacheData.timestamp;
    if (cacheAge > 24 * 60 * 60 * 1000) return null; // 24 hours

    return cacheData.customers;
  } catch (error) {
    console.log('⚠️ Failed to load customers cache from Vimeo:', error.message);
    return null;
  }
}

export async function setCustomersCache(token, folderId, customers) {
  try {
    // Use dedicated cache folder
    const cacheFolderId = '26918583';
    // Find existing cache video
    const videos = await fetchFolderVideos(token, { folderId: cacheFolderId, query: { query: 'CUSTOMERS_CACHE' } });
    const cacheVideo = videos.find(v => v.name === 'CUSTOMERS_CACHE');

    const cacheData = {
      customers,
      timestamp: Date.now(),
      folderId
    };
    const description = `CACHE_DATA: ${JSON.stringify(cacheData)}\n\nThis video contains cached customer data. Do not delete.`;

    if (cacheVideo) {
      // Update existing
      await fetchJson(`${API_ROOT}/videos/${cacheVideo.uri.split('/').pop()}`, token, null, {
        method: 'PATCH',
        body: JSON.stringify({ description })
      });
    } else {
      // Create new cache video (upload a placeholder)
      // For simplicity, assume we have a way, but for now, skip creating new
      console.log('⚠️ No existing cache video found, skipping cache save');
    }
  } catch (error) {
    console.log('⚠️ Failed to save customers cache to Vimeo:', error.message);
  }
}

export const VIMEO_DEFAULT_FOLDER_ID = DEFAULT_FOLDER_ID;
export const VIMEO_DEFAULT_OWNER_ID = DEFAULT_OWNER_ID;
