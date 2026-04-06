const fs = require('fs');

const envVars = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].trim();
  return acc;
}, {});

async function check() {
  const apiKey = envVars.GEMINI_API_KEY;
  console.log("Key:", apiKey.substring(0, 10));
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    console.log(data.models.map(m => m.name).join(', '));
  } catch(e) {
    console.error("Error fetching models:", e);
  }
}

check();
