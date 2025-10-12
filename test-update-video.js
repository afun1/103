// Test script to verify update-video API and check video editability
const testData = {
  videoUri: "/videos/123456789",
  comment: "Test comment from API",
  commenterName: "Test User",
  commenterEmail: "test@example.com",
  commentDate: "2024-01-01"
};

async function testUpdateVideo() {
  console.log('🧪 Testing update-video API...');

  try {
    const response = await fetch('http://localhost:3000/api/update-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log('📡 Response status:', response.status);
    console.log('📋 Response data:', result);

    if (response.ok) {
      console.log('✅ Update-video test PASSED');
    } else {
      console.log('❌ Update-video test FAILED');
    }

  } catch (error) {
    console.log('💥 Update-video test ERROR:', error.message);
  }
}

// Run the test
testUpdateVideo();