export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// Create a Vimeo tus upload and return the upload link + video uri
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: 'Vimeo access token not configured' });

    const {
      title,
      size, // file size in bytes
      description,
      customerName,
      customerEmail,
      recordedBy,
      recordedByEmail,
      folderId
    } = req.body || {};

    if (!title || typeof size !== 'number') {
      return res.status(400).json({ error: 'Missing required fields: title, size' });
    }

    const metaDescription = [
      `Customer: ${customerName || ''}`,
      `Customer Email: ${customerEmail || ''}`,
      `Recorded By: ${recordedBy || ''}`,
      `Recorded By Email: ${recordedByEmail || ''}`,
      `Recording Date: ${new Date().toISOString()}`,
      '',
      `${description || ''}`
    ].join('\n');

    // Request a tus upload
    const createResp = await fetch('https://api.vimeo.com/me/videos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        upload: { approach: 'tus', size },
        name: title,
        description: metaDescription,
        privacy: { view: 'unlisted' }
      })
    });

    if (!createResp.ok) {
      const txt = await createResp.text();
      return res.status(createResp.status).json({ error: 'Vimeo create error', debug: txt });
    }

    const data = await createResp.json();
    const uploadLink = data?.upload?.upload_link;
    const videoUri = data?.uri; // /videos/{id}

    if (!uploadLink || !videoUri) {
      return res.status(500).json({ error: 'Vimeo did not return an upload link' });
    }

    // Optionally store folderId and meta on client to send on finalize
    return res.status(200).json({
      success: true,
      uploadLink,
      videoUri,
      videoId: videoUri.split('/').pop(),
      folderId: folderId || '26555277'
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}