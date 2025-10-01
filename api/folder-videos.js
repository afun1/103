export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: Replace with your actual database/storage integration
    // For now, return sample data to test customer search
    const sampleVideos = [
      {
        name: 'John Smith',
        description: 'Customer Email: john.smith@example.com\nSample video description',
        customerEmail: 'john.smith@example.com'
      },
      {
        name: 'Jane Doe', 
        description: 'Customer Email: jane.doe@example.com\nAnother sample video',
        customerEmail: 'jane.doe@example.com'
      },
      {
        name: 'Bob Johnson',
        description: 'Customer Email: bob.johnson@example.com\nTest recording session',
        customerEmail: 'bob.johnson@example.com'
      }
    ];

    res.status(200).json({ videos: sampleVideos });
    
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos: ' + error.message });
  }
}