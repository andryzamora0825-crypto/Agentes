const url = "https://ecfgazftlrmacpwgxmiq.supabase.co/rest/v1/admins?select=*";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZmdhemZ0bHJtYWNwd2d4bWlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM1NTU0MywiZXhwIjoyMDkwOTMxNTQzfQ.4WdCtbgahppCWZhsCoujcXVLl1QJo3Bv94-f35D382U";

fetch(url, {
  headers: {
    "apikey": key,
    "Authorization": `Bearer ${key}`
  }
}).then(r => r.json()).then(data => {
  console.log("ADMINS:", data);
}).catch(console.error);
