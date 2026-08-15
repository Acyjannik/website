export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store,max-age=0");
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});

  const url=process.env.SUPABASE_URL;
  const anon=process.env.SUPABASE_ANON_KEY;
  const auth=req.headers.authorization||"";
  if(!url||!anon||!auth.startsWith("Bearer "))return res.status(401).json({error:"Unauthorized"});

  try{
    const response=await fetch(`${url}/rest/v1/rpc/get_my_pet_duo_achievements`,{
      method:"POST",
      headers:{apikey:anon,Authorization:auth,"Content-Type":"application/json"},
      body:"{}"
    });
    const text=await response.text();
    const payload=text?JSON.parse(text):[];
    if(!response.ok)return res.status(response.status).json({error:payload?.message||payload?.error||"Duo-Achievements konnten nicht geladen werden."});
    return res.status(200).json({ok:true,achievements:Array.isArray(payload)?payload:[]});
  }catch(error){
    return res.status(500).json({error:error?.message||"Duo achievement service failed."});
  }
}
