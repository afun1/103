const { Vimeo } = require('@vimeo/vimeo');

// Initialize Vimeo client
const vimeo = new Vimeo(
    process.env.VIMEO_CLIENT_ID,
    process.env.VIMEO_CLIENT_SECRET,
    process.env.VIMEO_ACCESS_TOKEN
);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const query = req.query.q;
        
        console.log('Search customers API called with query:', query);
        
        if (!query || query.length < 1) {
            return res.json([]);
        }
        
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
        
        console.log(`Found ${searchResponse.data ? searchResponse.data.length : 0} videos to search through`);
        
        // Extract customer data from video descriptions and titles
        const customers = [];
        const customerMap = new Map();
        
        if (searchResponse.data) {
            searchResponse.data.forEach(video => {
                const description = video.description || '';
                const title = video.name || '';
                
                // Extract customer info from new description format
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
                        
                        if (exactEmailMatch) {
                            console.log('Found exact email match:', customer);
                        }
                    }
                }
            });
        }
        
        console.log(`Returning ${customers.length} matching customers`);
        
        // Sort by name and limit results
        customers.sort((a, b) => a.name.localeCompare(b.name));
        res.json(customers.slice(0, 20));
        
    } catch (error) {
        console.error('Customer search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};