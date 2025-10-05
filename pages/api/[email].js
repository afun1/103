// Fixed API endpoint for user videos
export default async function handler(req, res) {
  const { email } = req.query;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  try {
    const vimeoAccessToken = process.env.VIMEO_ACCESS_TOKEN;
    if (!vimeoAccessToken) {
      return res.status(500).json({ error: 'Vimeo access token not configured' });
    }

    // Fetch all videos from the main folder
    const response = await fetch(`https://api.vimeo.com/folders/26555277/videos?per_page=100&sort=date&direction=desc`, {
      headers: {
        'Authorization': `Bearer ${vimeoAccessToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vimeo user videos error:', errorText);
      return res.status(500).json({ error: 'Failed to fetch user videos from Vimeo' });
    }

    const data = await response.json();
    
    // Filter videos by the user's email and transform them
    const userVideos = (data.data || [])
      .map(video => {
        const description = video.description || '';
        
        // Extract metadata from description
        const extractMetadata = (desc) => {
          const metadata = {};
          const lines = desc.split('\n');
          
          lines.forEach(line => {
            const emailMatch = line.match(/Customer Email:\s*(.+)/i);
            const recordedByMatch = line.match(/Recorded By:\s*(.+)/i);
            const recordedByEmailMatch = line.match(/Recorded By Email:\s*(.+)/i);
            const dateMatch = line.match(/Recording Date:\s*(.+)/i);
            
            if (emailMatch) metadata.customerEmail = emailMatch[1].trim();
            if (recordedByMatch) metadata.recordedBy = recordedByMatch[1].trim();
            if (recordedByEmailMatch) metadata.recordedByEmail = recordedByEmailMatch[1].trim();
            if (dateMatch) metadata.recordingDate = dateMatch[1].trim();
          });
          
          return metadata;
        };

        const metadata = extractMetadata(description);
        
        return {
          id: video.uri.split('/').pop(),
          name: video.name,
          customerName: video.name,
          customerEmail: metadata.customerEmail || '',
          description: description,
          vimeoLink: video.link,
          thumbnail: video.pictures?.sizes?.[0]?.link || null,
          recordedBy: {
            displayName: metadata.recordedBy || '',
            email: metadata.recordedByEmail || ''
          },
          recordingDate: metadata.recordingDate || video.created_time,
          duration: video.duration,
          created_time: video.created_time,
          metadata: metadata
        };
      })
      .filter(video => {
        // Filter by recorded by email
        return video.recordedBy.email.toLowerCase() === email.toLowerCase();
      });

    return res.status(200).json(userVideos);
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'Failed to fetch recordings' });
    }
}