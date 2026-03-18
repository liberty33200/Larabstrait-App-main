
import axios from 'axios';
async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/appointments');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.error(error.message);
  }
}
test();
