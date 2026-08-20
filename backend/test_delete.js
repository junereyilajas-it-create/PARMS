import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function test() {
  const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'your_secret_key_here', { expiresIn: '1d' });
  const headers = { Authorization: `Bearer ${token}` };

  try {
    console.log("Testing DELETE...");
    const res = await axios.delete('http://localhost:5000/api/properties/1', { headers });
    console.log("DELETE Success:", res.status);
  } catch (err) {
    console.error("DELETE Error:", err.response ? err.response.data : err.message);
  }
}

test();
