const accounts = [
  {u:'karl', p:'karl123', r:'SUPER_ADMIN'},
  {u:'maria', p:'maria123', r:'ASSESSOR'},
  {u:'jose', p:'jose123', r:'ASSESSOR'},
  {u:'christine', p:'christine123', r:'STAFF'},
  {u:'randrei', p:'randrei123', r:'STAFF'},
  {u:'angela', p:'angela123', r:'STAFF'}
];

async function test() {
  for (const acc of accounts) {
    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:acc.u, password:acc.p})
      });
      const data = await res.json();
      if(res.ok && data.user.role === acc.r.toLowerCase()) {
        console.log(`PASS: ${acc.u} logged in successfully as ${data.user.role}`);
      } else {
        console.log(`FAIL: ${acc.u} failed:`, data);
      }
    } catch (e) {
      console.log(`FAIL: ${acc.u} fetch failed:`, e.message);
    }
  }
}

test();
