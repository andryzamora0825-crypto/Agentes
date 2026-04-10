const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if(!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking scammers table...");
  const { data, error } = await supabase.from('scammers').select('*').limit(1);
  if (error) {
    console.error("Table error:", error.message);
  } else {
    console.log("Table exists, data:", data);
  }

  console.log("Checking bucket...");
  const { data: buckets, error: bError } = await supabase.storage.listBuckets();
  if (bError) {
    console.error("Bucket error:", bError.message);
  } else {
    console.log("Buckets:", buckets.map(b => b.name));
  }
}

check();
