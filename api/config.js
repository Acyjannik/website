export default async function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(200).json({
      configured: false,
      supabaseUrl: "",
      supabaseAnonKey: ""
    });
  }

  return res.status(200).json({
    configured: true,
    supabaseUrl,
    supabaseAnonKey
  });
}
