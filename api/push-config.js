export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  const key=process.env.VAPID_PUBLIC_KEY||"";
  res.setHeader("Cache-Control","public,max-age=300");
  return res.status(200).json({publicKey:key,configured:Boolean(key)});
}
