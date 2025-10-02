module.exports = async (req, res) => {
    // Enable CORS for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { pathname } = new URL(req.url, `https://${req.headers.host}`);
    
    // Handle different API endpoints
    try {
        // Test environment variables endpoint
        if (pathname === '/api/test-env') {
            return res.json({
                vimeo_client_id: process.env.VIMEO_CLIENT_ID ? 'SET' : 'MISSING',
                vimeo_client_secret: process.env.VIMEO_CLIENT_SECRET ? 'SET' : 'MISSING', 
                vimeo_access_token: process.env.VIMEO_ACCESS_TOKEN ? 'SET' : 'MISSING',
                vimeo_folder_id: process.env.VIMEO_FOLDER_ID ? 'SET' : 'MISSING',
                vimeo_folder_id_value: process.env.VIMEO_FOLDER_ID,
                supabase_url: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
                supabase_key: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING'
            });
        }

        // Customer search endpoint - with real Vimeo integration
        if (pathname === '/api/search-customers') {
            if (req.method !== 'GET') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const url = new URL(req.url, `https://${req.headers.host}`);
            const query = url.searchParams.get('q');
            
            if (!query || query.length < 1) {
                return res.json([]);
            }

            try {
                const { Vimeo } = require('@vimeo/vimeo');
                
                const vimeo = new Vimeo(
                    process.env.VIMEO_CLIENT_ID,
                    process.env.VIMEO_CLIENT_SECRET,
                    process.env.VIMEO_ACCESS_TOKEN
                );

                // Search Vimeo videos for customer metadata
                const searchResponse = await new Promise((resolve, reject) => {
                    vimeo.request(
                        {
                            method: 'GET',
                            path: `/me/folders/${process.env.VIMEO_FOLDER_ID}/videos`,
                            query: {
                                per_page: 100,
                                fields: 'name,description,metadata.connections.comments.total'
                            }
                        },
                        (error, body, statusCode, headers) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(body);
                            }
                        }
                    );
                });

                // Extract customer data from video descriptions and titles
                const customers = [];
                const customerMap = new Map();
                
                if (searchResponse.data) {
                    searchResponse.data.forEach(video => {
                        const description = video.description || '';
                        const title = video.name || '';
                        
                        // Extract customer info from description format
                        const emailMatch = description.match(/Customer Email:\s*([^\n]+)/);
                        
                        if (emailMatch && title) {
                            const name = title.trim();
                            const email = emailMatch[1].trim();
                            const key = `${name}_${email}`;
                            
                            // Check if this customer matches the search query
                            const nameMatches = name.toLowerCase().includes(query.toLowerCase());
                            const emailMatches = email.toLowerCase().includes(query.toLowerCase());
                            const exactEmailMatch = email.toLowerCase() === query.toLowerCase();
                            
                            if (!customerMap.has(key) && (nameMatches || emailMatches)) {
                                const customer = {
                                    name,
                                    email,
                                    id: key,
                                    exactEmailMatch
                                };
                                
                                customerMap.set(key, customer);
                                customers.push(customer);
                            }
                        }
                    });
                }
                
                // Sort by name and limit results
                customers.sort((a, b) => a.name.localeCompare(b.name));
                return res.json(customers.slice(0, 20));
                
            } catch (searchError) {
                console.error('Customer search error:', searchError);
                return res.status(500).json({ error: 'Search failed', message: searchError.message });
            }
        }

        // Video upload endpoint - temporarily disabled to prevent crashes
        if (pathname === '/api/upload-vimeo') {
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const { videoData, title, description, customerData, recordedBy } = req.body;

            if (!videoData) {
                return res.status(400).json({ error: 'No video data provided' });
            }

            // Extract proper user information from recordedBy object
            const recordedByName = recordedBy?.displayName || 'John Bradshaw';
            const recordedByEmail = recordedBy?.email || 'john@tpnlife.com';
            
            console.log('📊 Upload request received:', {
                customerName: customerData.name,
                customerEmail: customerData.email,
                recordedByName,
                recordedByEmail,
                videoSize: videoData.length,
                title: title
            });

            // Return success response without actual upload to prevent crashes
            // This allows the screen recorder to function while we debug upload issues
            return res.json({
                success: true,
                message: 'Video recorded successfully! Upload feature temporarily disabled for stability.',
                vimeoUrl: 'https://vimeo.com/placeholder', // Placeholder URL
                videoId: 'temp-' + Date.now(),
                customerData,
                recordedBy,
                metadata: {
                    title,
                    description,
                    recordedByName,
                    recordedByEmail,
                    customerName: customerData.name,
                    customerEmail: customerData.email,
                    recordingDate: new Date().toLocaleString()
                },
                note: 'Upload to Vimeo temporarily disabled. Your screen recording was successful!'
            });
        }

        // Default response for unknown endpoints
        return res.status(404).json({ 
            error: 'Endpoint not found',
            path: pathname,
            method: req.method,
            available: ['/api/test-env', '/api/search-customers', '/api/upload-vimeo'],
            message: 'Check the path and method of your request'
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            endpoint: pathname
        });
    }
};