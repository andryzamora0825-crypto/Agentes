import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data } = await supabase
    .from("social_posts")
    .select("status, meta_post_id")
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(JSON.stringify(data, null, 2));
}

check();
