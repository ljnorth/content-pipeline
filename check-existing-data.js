import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

supabase.from("images").select("aesthetic, colors, season, occasion, additional_themes").limit(5).then(result => {
  console.log("Sample image data:");
  if (result.data && result.data.length > 0) {
    result.data.forEach((img, i) => {
      console.log(`${i+1}. Aesthetic: ${img.aesthetic || "NULL"}, Colors: ${img.colors || "NULL"}, Season: ${img.season || "NULL"}`);
    });
  } else {
    console.log("No data found or all fields are NULL");
  }
});
