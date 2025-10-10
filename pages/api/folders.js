import { extractVideoMetadata, fetchFolderVideos, VIMEO_DEFAULT_FOLDER_ID } from '@/lib/vimeo';
import { createClient } from '@supabase/supabase-js';

function buildSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  try {
    return createClient(url, serviceKey);
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    return null;
  }
}

function normalizeVideo(video) {
  const metadata = extractVideoMetadata(video?.description);
  const videoUri = video?.uri || '';
  const videoId = videoUri.split('/').pop() || '';

  return {
    id: videoId,
    uri: videoUri,
    name: video?.name || metadata.customer || 'Untitled Recording',
    customerName: metadata.customer || video?.name || 'Unknown Customer',
    customerEmail: metadata.customerEmail || '',
    description: video?.description || '',
    link: video?.link || (videoId ? `https://vimeo.com/${videoId}` : ''),
    pictures: video?.pictures || null,
    duration: video?.duration ?? null,
    created_time: video?.created_time || null,
    recordedBy: metadata.recordedBy || '',
    recordedByEmail: metadata.recordedByEmail || '',
    recordingDate: metadata.recordingDate || video?.created_time || null
  };
}

async function loadUserDirectory() {
  const client = buildSupabaseClient();
  if (!client) {
    return { directory: new Map(), error: null };
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, display_name, email, role');

    if (error) {
      throw error;
    }

    const directory = new Map();
    (data || []).forEach((profile) => {
      const email = profile?.email?.toLowerCase?.();
      if (!email) return;

      directory.set(email, {
        id: profile.id,
        displayName: profile.display_name || profile.email || 'User',
        role: profile.role || 'user'
      });
    });

    return { directory, error: null };
  } catch (error) {
    console.error('❌ Failed to load Supabase user directory:', error);
    return { directory: new Map(), error };
  }
}

function groupVideosByRecorder(videos, userDirectory) {
  const folders = new Map();

  videos.forEach((video) => {
    const email = video.recordedByEmail?.toLowerCase?.() || '';
    const key = email || '__unassigned__';

    if (!folders.has(key)) {
      const directoryEntry = email ? userDirectory.get(email) : null;
      const displayName = directoryEntry?.displayName || video.recordedBy || email || 'Unassigned Recorder';

      folders.set(key, {
        key,
        email,
        displayName,
        role: directoryEntry?.role || (email ? 'user' : 'unknown'),
        userId: directoryEntry?.id || null,
        videos: []
      });
    }

    folders.get(key).videos.push(video);
  });

  return Array.from(folders.values()).map((folder) => ({
    ...folder,
    videoCount: folder.videos.length
  }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Vimeo access token not configured' });
  }

  const folderId = Array.isArray(req.query.folderId)
    ? req.query.folderId[0]
    : req.query.folderId || VIMEO_DEFAULT_FOLDER_ID || '26555277';

  try {
    const rawVideos = await fetchFolderVideos(token, { folderId });
    const normalizedVideos = rawVideos.map(normalizeVideo);

    const { directory: userDirectory, error: directoryError } = await loadUserDirectory();

    const userFolders = groupVideosByRecorder(normalizedVideos, userDirectory)
      .sort((a, b) => {
        if (!a.email && b.email) return 1;
        if (!b.email && a.email) return -1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });

    const response = {
      success: true,
      folderId,
      mainVideos: normalizedVideos,
      userFolders,
      stats: {
        totalVideos: normalizedVideos.length,
        userFolderCount: userFolders.filter((folder) => folder.email).length,
        unassignedCount: userFolders.filter((folder) => !folder.email).reduce((sum, folder) => sum + folder.videoCount, 0)
      }
    };

    if (directoryError) {
      response.directoryWarning = 'User directory unavailable. Some display names may be missing.';
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error assembling folders payload:', error);
    return res.status(500).json({
      error: 'Failed to build folders payload',
      message: error.message
    });
  }
}
