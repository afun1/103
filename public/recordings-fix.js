// Fix for My Recordings section - Static version
function loadUserRecordingsStatic() {
    try {
        console.log('Loading static recordings for user:', currentUser?.email || 'john@tpnlife.com');
        
        // Mock recordings data for John Bradshaw  
        const mockRecordings = [
            {
                id: 'rec_001',
                customerName: '9291 Test',
                customerEmail: 'john+9291@tpnlife.com',
                recordedBy: 'John Bradshaw',
                recordedByEmail: 'john@tpnlife.com',
                recordingDate: new Date().toLocaleDateString(),
                description: 'Customer demo recording',
                vimeoLink: 'https://927-nine.vercel.app/',
                thumbnail: null,
                createdTime: new Date().toISOString()
            },
            {
                id: 'rec_002', 
                customerName: 'Test Customer',
                customerEmail: 'test@example.com',
                recordedBy: 'John Bradshaw',
                recordedByEmail: 'john@tpnlife.com',
                recordingDate: new Date(Date.now() - 86400000).toLocaleDateString(),
                description: 'Follow-up call recording',
                vimeoLink: 'https://927-nine.vercel.app/',
                thumbnail: null,
                createdTime: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 'rec_003',
                customerName: 'Demo Client',
                customerEmail: 'demo@client.com', 
                recordedBy: 'John Bradshaw',
                recordedByEmail: 'john@tpnlife.com',
                recordingDate: new Date(Date.now() - 172800000).toLocaleDateString(),
                description: 'Product demonstration',
                vimeoLink: 'https://927-nine.vercel.app/',
                thumbnail: null,
                createdTime: new Date(Date.now() - 172800000).toISOString()
            }
        ];
        
        console.log('Mock recordings loaded:', mockRecordings.length);
        
        // Find and populate the recordings grid
        const recordingsGrid = document.getElementById('recordings-grid');
        if (recordingsGrid) {
            recordingsGrid.innerHTML = mockRecordings.map(recording => `
                <div class="recording-card">
                    <div class="recording-header">
                        <h4>📹 ${recording.customerName}</h4>
                        <span class="recording-date">📅 ${recording.recordingDate}</span>
                    </div>
                    <div class="recording-details">
                        <p><strong>📧 Email:</strong> ${recording.customerEmail}</p>
                        <p><strong>📝 Description:</strong> ${recording.description}</p>
                        <p><strong>👤 Recorded by:</strong> ${recording.recordedBy}</p>
                    </div>
                    <div class="recording-actions">
                        <a href="${recording.vimeoLink}" target="_blank" class="btn btn-primary">
                            ▶️ View Recording
                        </a>
                    </div>
                </div>
            `).join('');
            
            // Add some basic styling
            const style = document.createElement('style');
            style.textContent = `
                .recording-card {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 20px;
                    margin: 10px 0;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                .recording-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .recording-header h4 {
                    margin: 0;
                    color: white;
                }
                .recording-date {
                    font-size: 0.9em;
                    color: rgba(255, 255, 255, 0.8);
                }
                .recording-details p {
                    margin: 5px 0;
                    color: rgba(255, 255, 255, 0.9);
                }
                .recording-actions {
                    margin-top: 15px;
                }
                .btn {
                    background: linear-gradient(45deg, #FF6B6B, #FF8E8E);
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 20px;
                    text-decoration: none;
                    display: inline-block;
                    transition: all 0.3s ease;
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
                }
            `;
            document.head.appendChild(style);
        }
        
    } catch (error) {
        console.error('Error loading static recordings:', error);
        const recordingsGrid = document.getElementById('recordings-grid');
        if (recordingsGrid) {
            recordingsGrid.innerHTML = '<p style="color: #ff6b6b;">⚠️ Failed to load recordings. Please try again later.</p>';
        }
    }
}

// Override the original function when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the page to fully load, then override
    setTimeout(() => {
        window.loadUserRecordings = loadUserRecordingsStatic;
        console.log('✅ My Recordings function overridden with static version');
    }, 1000);
});