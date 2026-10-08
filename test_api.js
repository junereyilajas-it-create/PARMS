// using native fetch
(async () => {
  try {
    // 1. Login to get token
    const loginRes = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'password123' }) // assuming superadmin exists
    });
    
    if (!loginRes.ok) {
      console.log('Login failed:', await loginRes.text());
      return;
    }
    
    const { token } = await loginRes.json();
    console.log('Got token');
    
    // 2. Fetch requests
    const reqsRes = await fetch('http://localhost:5000/api/assessments/requests', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!reqsRes.ok) {
      console.log('Fetch requests failed:', reqsRes.status, await reqsRes.text());
      return;
    }
    
    const data = await reqsRes.json();
    console.log('Requests:', data);
    
  } catch (e) {
    console.error('Script error:', e);
  }
})();
