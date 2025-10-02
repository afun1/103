// Mock API data for local testing
const mockUserVideos = [
    {
        vimeoLink: "https://vimeo.com/123456789",
        customerName: "Test Customer 1",
        customerEmail: "customer1@example.com",
        recordingDate: "2024-01-15",
        description: "Test recording for John Bradshaw",
        thumbnail: "https://via.placeholder.com/300x200",
        recordedBy: {
            displayName: "John Bradshaw",
            email: "john@tpnlife.com"
        }
    },
    {
        vimeoLink: "https://vimeo.com/123456790",
        customerName: "Test Customer 2", 
        customerEmail: "customer2@example.com",
        recordingDate: "2024-01-14",
        description: "Another test recording",
        thumbnail: "https://via.placeholder.com/300x200",
        recordedBy: {
            displayName: "John Bradshaw",
            email: "john@tpnlife.com"
        }
    }
];

// Check if we're running locally (not on production domain)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🔧 Running in local development mode with mock data');
    
    // Override fetch for API calls during local development
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (url.includes('/api/user-videos/')) {
            console.log('🎭 Mock API: Returning test data for', url);
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockUserVideos)
            });
        }
        return originalFetch(url, options);
    };
}