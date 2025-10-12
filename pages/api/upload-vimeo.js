import { VIMEO_DEFAULT_FOLDER_ID } from '@/lib/vimeo';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '100mb' } } };

const DEFAULT_FOLDER_ID = VIMEO_DEFAULT_FOLDER_ID || '26555277';

function buildMetadata({
    description,
    customerName,
    customerEmail,
    recordedBy,
    recordedByEmail
}) {
    return [
        `Customer: ${customerName || ''}`,
        `Customer Email: ${customerEmail || ''}`,
        `Recorded By: ${recordedBy || ''}`,
        `Recorded By Email: ${recordedByEmail || ''}`,
        `Recording Date: ${new Date().toISOString()}`,
        '',
        `${description || ''}`
    ].join('\n');
}

async function createTusUpload({ token, title, size, metadata }) {
    const response = await fetch('https://api.vimeo.com/me/videos', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            upload: { approach: 'tus', size },
            name: title,
            description: metadata,
            privacy: { view: 'unlisted' }
        })
    });

    if (!response.ok) {
        const debug = await response.text().catch(() => '');
        throw new Error(`Vimeo create error (${response.status}): ${debug}`);
    }

    return response.json();
}

async function handleLegacyUpload({ token, videoData, mimeType, title, metadata, folderId }) {
    const buffer = Buffer.from(videoData, 'base64');

    const createResponse = await fetch('https://api.vimeo.com/me/videos', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            upload: { approach: 'post', size: buffer.length },
            name: title,
            description: metadata,
            privacy: { view: 'unlisted' }
        })
    });

    if (!createResponse.ok) {
        const debug = await createResponse.text().catch(() => '');
        throw new Error(`Vimeo create error (${createResponse.status}): ${debug}`);
    }

    const created = await createResponse.json();
    const uploadUrl = created.upload?.upload_link;
    const videoUri = created.uri;

    if (!uploadUrl || !videoUri) {
        throw new Error('Vimeo did not return an upload link');
    }

    const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: buffer,
        headers: {
            'Content-Type': mimeType || 'video/webm'
        }
    });

    if (!uploadResponse.ok) {
        const debug = await uploadResponse.text().catch(() => '');
        throw new Error(`Upload failed (${uploadResponse.status}): ${debug}`);
    }

    const finalizeResponse = await fetch(`https://api.vimeo.com${videoUri}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: title,
            description: metadata,
            privacy: { view: 'unlisted' }
        })
    });

    if (!finalizeResponse.ok) {
        const debug = await finalizeResponse.text().catch(() => '');
        console.warn('⚠️ Vimeo finalize warning:', debug);
    }

    if (folderId) {
        try {
            const folderResponse = await fetch(`https://api.vimeo.com/me/projects/${folderId}/videos`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uris: [videoUri] })
            });

            if (!folderResponse.ok) {
                const debug = await folderResponse.text().catch(() => '');
                console.warn('⚠️ Vimeo folder assignment warning:', debug);
            }
        } catch (error) {
            console.warn('⚠️ Vimeo folder assignment error:', error);
        }
    }

    const videoId = videoUri.split('/').pop();
    return {
        success: true,
        videoUri,
        videoId,
        vimeoUrl: `https://vimeo.com/${videoId}`,
        message: 'Video uploaded successfully'
    };
}

// Unified Vimeo upload endpoint supporting resumable and legacy flows
export default async function handler(req, res) {
    console.log('📤 Upload to Vimeo requested...');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = process.env.VIMEO_ACCESS_TOKEN;
        if (!token) {
            return res.status(500).json({ error: 'Vimeo access token not configured' });
        }

        const {
            title,
            size,
            description,
            customerName,
            customerEmail,
            recordedBy,
            recordedByEmail,
            folderId = DEFAULT_FOLDER_ID,
            videoData,
            mimeType,
            isExistingCustomer = false,
            forceExistingCustomer = false
        } = req.body || {};

        // Strong server-side duplicate email guard using Supabase customers table
        // Skip duplicate check if client explicitly indicates this is for an existing customer
        if (!isExistingCustomer && !forceExistingCustomer) {
            try {
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
                if (customerEmail && supabaseUrl && supabaseKey) {
                    const sb = createClient(supabaseUrl, supabaseKey);
                    const normalized = String(customerEmail).toLowerCase().trim();
                    // Try to find by id first (some rows may use email as id) then by email
                    let { data: existing, error: fetchErr } = await sb.from('customers').select('id,name,email').eq('id', normalized).maybeSingle();
                    if (!existing) {
                        const q = await sb.from('customers').select('id,name,email').eq('email', normalized).maybeSingle();
                        existing = q.data;
                        fetchErr = q.error;
                    }
                    if (fetchErr) {
                        console.warn('Supabase lookup error when checking duplicate email:', fetchErr.message || fetchErr);
                    }
                    if (existing) {
                        // Inform client that the email already exists and provide the existing record
                        return res.status(409).json({ error: 'Email already exists', existingCustomer: existing });
                    }
                }
            } catch (e) {
                console.warn('Duplicate guard check failed:', e?.message || e);
                // Don't block upload if registry check fails; proceed with upload.
            }
        } else {
            console.log('✅ Skipping duplicate email check for existing customer:', customerEmail);
        }

        if (!title) {
            return res.status(400).json({ error: 'Missing required field: title' });
        }

        const metadata = buildMetadata({
            description,
            customerName,
            customerEmail,
            recordedBy,
            recordedByEmail
        });

        // Resumable upload path (preferred)
        if (typeof size === 'number') {
            if (size <= 0) {
                return res.status(400).json({ error: 'Invalid size value' });
            }

            const created = await createTusUpload({ token, title, size, metadata });
            const uploadLink = created?.upload?.upload_link;
            const videoUri = created?.uri;

            if (!uploadLink || !videoUri) {
                throw new Error('Vimeo did not return an upload link');
            }

            return res.status(200).json({
                success: true,
                uploadLink,
                videoUri,
                videoId: videoUri.split('/').pop(),
                folderId
            });
        }

        // Legacy base64 upload fallback
        if (videoData) {
            const result = await handleLegacyUpload({
                token,
                videoData,
                mimeType,
                title,
                metadata,
                folderId
            });
            return res.status(200).json(result);
        }

        return res.status(400).json({
            error: 'Missing required fields. Provide either { size } for resumable upload or { videoData } for legacy upload.'
        });
    } catch (error) {
        console.error('💥 Upload error:', error);
        return res.status(500).json({ error: error.message });
    }
}