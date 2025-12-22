// 🔧 Advanced Socket.io Debug Test
// This test will help us understand the exact connection issue

const testSocketConnection = async () => {
  console.log('🔍 Advanced Socket.io Connection Test');
  console.log('=====================================');
  
  try {
    // Test 1: Check if the server is responding to polling
    console.log('\n1️⃣ Testing Socket.io Polling Endpoint...');
    const pollingResponse = await fetch('https://api.upscholar.in/socket.io/?EIO=4&transport=polling');
    console.log('Polling Status:', pollingResponse.status);
    
    if (pollingResponse.ok) {
      const pollingData = await pollingResponse.text();
      console.log('Polling Response:', pollingData.substring(0, 100) + '...');
      
      // Extract the session ID
      const sessionData = JSON.parse(pollingData.substring(1));
      console.log('Session ID:', sessionData.sid);
      console.log('Available Transports:', sessionData.upgrades);
      console.log('Ping Interval:', sessionData.pingInterval);
      console.log('Ping Timeout:', sessionData.pingTimeout);
    }
    
    // Test 2: Try WebSocket upgrade
    console.log('\n2️⃣ Testing WebSocket Upgrade...');
    const wsTest = new WebSocket('wss://api.upscholar.in/socket.io/?EIO=4&transport=websocket');
    
    wsTest.onopen = () => {
      console.log('✅ WebSocket connection opened successfully!');
      wsTest.close();
    };
    
    wsTest.onerror = (error) => {
      console.log('❌ WebSocket error:', error);
    };
    
    wsTest.onclose = (event) => {
      console.log('🔌 WebSocket closed. Code:', event.code, 'Reason:', event.reason);
    };
    
    // Test 3: Check CORS headers
    console.log('\n3️⃣ Checking CORS Headers...');
    const corsResponse = await fetch('https://api.upscholar.in/socket.io/?EIO=4&transport=polling', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://upscholar.in',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    
    console.log('CORS Status:', corsResponse.status);
    console.log('Access-Control-Allow-Origin:', corsResponse.headers.get('Access-Control-Allow-Origin'));
    console.log('Access-Control-Allow-Methods:', corsResponse.headers.get('Access-Control-Allow-Methods'));
    console.log('Access-Control-Allow-Headers:', corsResponse.headers.get('Access-Control-Allow-Headers'));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testSocketConnection();