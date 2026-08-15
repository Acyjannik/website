export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization || "";
  if (!supabaseUrl || !anonKey) return res.status(503).json({error:"Pet social service is not configured."});
  if (!authHeader.startsWith("Bearer ")) return res.status(401).json({error:"Unauthorized"});

  try {
    const body = typeof req.body === "object" ? (req.body || {}) : JSON.parse(req.body || "{}");
    const targetUserId = String(body.targetUserId || "").trim();
    const action = String(body.action || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) return res.status(400).json({error:"Invalid target member id."});
    if (!["greet","play","pet"].includes(action)) return res.status(400).json({error:"Invalid pet action."});

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/interact_with_member_pet`,{
      method:"POST",
      headers:{apikey:anonKey,Authorization:authHeader,"Content-Type":"application/json"},
      body:JSON.stringify({p_target_user_id:targetUserId,p_action:action})
    });
    const text=await response.text();
    let payload={}; try{payload=text?JSON.parse(text):{};}catch{payload={error:text};}
    if(!response.ok)return res.status(response.status).json({error:payload?.message||payload?.error||"Pet-Interaktion fehlgeschlagen."});
    return res.status(200).json({ok:true,...payload});
  } catch(error) {
    console.error("club-pet-social:",error);
    return res.status(500).json({error:error?.message||"Pet social service failed."});
  }
}
