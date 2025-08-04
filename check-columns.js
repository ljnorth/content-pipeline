import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// First, let's see what columns exist
supabase.from("images").select("*").limit(1).then(result => {
  console.log("Available columns in images table:");
  if (result.data && result.data.length > 0) {
    const columns = Object.keys(result.data[0]);
    columns.forEach(col => console.log(`- ${col}`));
  } else {
    console.log("No data found");
  }
});
