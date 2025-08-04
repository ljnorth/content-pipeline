import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

supabase.from("images").select("aesthetic, colors, season, occasion, additional").limit(10).then(result => {
  console.log("Checking existing data:");
  if (result.data && result.data.length > 0) {
    result.data.forEach((img, i) => {
      console.log(`${i+1}. Aesthetic: "${img.aesthetic || "NULL"}", Colors: "${img.colors || "NULL"}", Season: "${img.season || "NULL"}", Occasion: "${img.occasion || "NULL"}", Additional: "${img.additional || "NULL"}"`);
    });
  } else {
    console.log("No data found");
  }
});
