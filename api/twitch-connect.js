import crypto from "node:crypto";

function json(res,status,p){res.status(status).json(p);}
function base64url(value){return Buffer.from(value).toString("base64url");}
function signState(payload){
  const secret=process.env.TWITCH_OAUTH_STATE_SECRET||"";
  if(!secret)throw new Error("TWITCH_OAUTH_STATE_SECRET fehlt.");
  const body=base64url(JSON.stringify(payload));
  const sig=crypto.createHmac("sha256",secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export default async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"GET only"});
  const clientId=process.env.TWITCH_CLIENT_ID||"";
  const redirect=process.env.TWITCH_REDIRECT_URI || `${process.env.PUBLIC_SITE_URL||""}/api/twitch-callback`;
  if(!clientId||!redirect)return json(res,503,{error:"Twitch OAuth ist noch nicht konfiguriert."});

  const auth=String(req.headers.authorization||"");
  if(!auth.startsWith("Bearer "))return json(res,401,{error:"Nicht angemeldet."});

  const verify=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{
    headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:auth}
  });
  if(!verify.ok)return json(res,401,{error:"Ungültige ACY-Sitzung."});
  const user=await verify.json();

  const state=signState({uid:user.id,nonce:crypto.randomUUID(),iat:Date.now()});
  const scopes=[]; // User identity only. Request additional scopes only when a feature needs them.
  const params=new URLSearchParams({
    client_id:clientId,
    redirect_uri:redirect,
    response_type:"code",
    scope:scopes.join(" "),
    state
  });
  return json(res,200,{ok:true,url:`https://id.twitch.tv/oauth2/authorize?${params.toString()}`});
}
