export default async function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600');

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
