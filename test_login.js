const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/login', {
      username: 'balong',
      password: 'balong123'
    });
    console.log(res.data);
  } catch (err) {
    console.log(err.response?.status, err.response?.data);
  }
}
test();
