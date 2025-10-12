// Test script to verify customer registry API
const testCustomer = {
  name: "Test Customer",
  email: "test@example.com",
  videoUri: "/videos/123456789",
  recordedBy: "tester@example.com"
};

async function testCustomerRegistry() {
  console.log('🧪 Testing customer registry API...');
  
  try {
    const response = await fetch('http://localhost:3000/api/customer-registry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCustomer)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Customer registry test PASSED');
      console.log('📋 Response:', result);
    } else {
      console.log('❌ Customer registry test FAILED');
      console.log('📋 Response:', result);
    }
    
  } catch (error) {
    console.log('💥 Customer registry test ERROR:', error.message);
  }
}

// Run the test
testCustomerRegistry();