export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// Finalize a Vimeo upload: set metadata and move to folder
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.VIMEO_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: 'Vimeo access token not configured' });

    const { videoUri, title, description, customerName, customerEmail, recordedBy, recordedByEmail, folderId } = req.body || {};
    if (!videoUri) return res.status(400).json({ error: 'Missing videoUri' });

    const metaDescription = [
      `Customer: ${customerName || ''}`,
      `Customer Email: ${customerEmail || ''}`,
      `Recorded By: ${recordedBy || ''}`,
      `Recorded By Email: ${recordedByEmail || ''}`,
      `Recording Date: ${new Date().toISOString()}`,
      '',
      `${description || ''}`
    ].join('\n');

    // Update metadata
    const patchResp = await fetch(`https://api.vimeo.com${videoUri}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: title, description: metaDescription, privacy: { view: 'unlisted' } })
    });
    if (!patchResp.ok) {
      const t = await patchResp.text();
      return res.status(patchResp.status).json({ error: 'Failed to set metadata', debug: t });
    }

    // Move to folder
    const targetFolder = folderId || '26555277';
    const videoId = videoUri.split('/').pop();
    const moveResp = await fetch(`https://api.vimeo.com/users/112996063/projects/${targetFolder}/videos/${videoId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!moveResp.ok) {
      const mt = await moveResp.text();
      return res.status(moveResp.status).json({ error: 'Failed to move to folder', debug: mt });
    }

    // Register customer in the registry
    try {
      if (customerEmail && customerEmail.trim()) {
        const registryResp = await fetch(`${req.protocol || 'http'}://${req.get('host')}/api/customer-registry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customerName,
            email: customerEmail,
            videoUri,
            recordedBy: recordedByEmail
          })
        });

        if (!registryResp.ok) {
          console.warn('⚠️ Failed to update customer registry, but video upload succeeded');
        } else {
          console.log('✅ Customer registered successfully');
        }
      }
    } catch (registryError) {
      console.warn('⚠️ Customer registry update failed:', registryError.message);
      // Don't fail the whole request if registry update fails
    }

    return res.status(200).json({ success: true, videoId, vimeoUrl: `https://vimeo.com/${videoId}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}