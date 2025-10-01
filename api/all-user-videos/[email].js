export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    // TODO: Replace with your actual database/storage integration
    // For now, return sample user videos
    const sampleUserVideos = [
      {
        customerName: 'Test Customer 1',
        vimeoLink: 'https://vimeo.com/123456789',
        description: 'Sample recording 1\n\n--- RECORDING DETAILS ---\nCustomer: Test Customer 1\nCustomer Email: test1@example.com\nRecorded By: ' + email + '\nRecording Date: ' + new Date().toISOString(),
        customerEmail: 'test1@example.com',
        recordingDate: new Date().toISOString(),
        thumbnail: null,
        recordedBy: {
          displayName: 'Test User',
          email: email
        }
      },
      {
        customerName: 'Test Customer 2', 
        vimeoLink: 'https://vimeo.com/987654321',
        description: 'Sample recording 2\n\n--- RECORDING DETAILS ---\nCustomer: Test Customer 2\nCustomer Email: test2@example.com\nRecorded By: ' + email + '\nRecording Date: ' + new Date().toISOString(),
        customerEmail: 'test2@example.com',
        recordingDate: new Date().toISOString(), 
        thumbnail: null,
        recordedBy: {
          displayName: 'Test User',
          email: email
        }
      }
    ];

    res.status(200).json(sampleUserVideos);
    
  } catch (error) {
    console.error('Error fetching user videos:', error);
    res.status(500).json({ error: 'Failed to fetch user videos: ' + error.message });
  }
}