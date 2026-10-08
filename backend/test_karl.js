async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'karl', password: 'karl123' })
    });
    const data = await res.json();
    console.log('Login:', data.user?.role || data);
    
    if (data.token) {
      const statsRes = await fetch('http://localhost:5000/api/stats/super_admin', {
        headers: { 'Authorization': 'Bearer ' + data.token }
      });
      const statsData = await statsRes.json();
      console.log('Stats:', statsData);
    }
  } catch (err) {
    console.error('Error in test:', err);
  }
}
test();
