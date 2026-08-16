import crypto from "node:crypto";

function fail(res,message){
  const site=process.env.PUBLIC_SITE_URL||"/";
  return res.redirect(`${site}/club-profile.html?twitch_error=${encodeURIComponent(message)}`);
}
function verifyState(state){
  const secret=process.env.TWITCH_OAUTH_STATE_SECRET||"";
  if(!secret)throw new Error("Twitch OAuth ist nicht konfiguriert.");
  const parts=String(state||"").split(".");
  if(parts.length!==2)throw new Error("Ungültiger OAuth State.");
  const [body,sig]=parts;
  const expected=crypto.createHmac("sha256",secret).update(body).digest("base64url");
  if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))throw new Error("Ungültiger OAuth State.");
  const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  if(!payload.uid||Date.now()-Number(payload.iat||0)>10*60*1000)throw new Error("OAuth State ist abgelaufen.");
  return payload;
}

export default async function handler(req,res){
  const code=String(req.query?.code||"");
  const state=String(req.query?.state||"");
  if(req.query?.error)return fail(res,String(req.query.error_description||req.query.error));
  if(!code||!state)return fail(res,"Twitch-Verbindung unvollständig.");

  try{
    const payload=verifyState(state);
    const clientId=process.env.TWITCH_CLIENT_ID||"";
    const clientSecret=process.env.TWITCH_CLIENT_SECRET||"";
    const redirect=process.env.TWITCH_REDIRECT_URI || `${process.env.PUBLIC_SITE_URL||""}/api/twitch-callback`;
    if(!clientId||!clientSecret||!redirect)throw new Error("Twitch OAuth Environment Variables fehlen.");

    const tokenRes=await fetch("https://id.twitch.tv/oauth2/token",{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({
        client_id:clientId,
        client_secret:clientSecret,
        code,
        grant_type:"authorization_code",
        redirect_uri:redirect
      })
    });
    if(!tokenRes.ok)throw new Error(`Twitch Token ${tokenRes.status}`);
    const token=await tokenRes.json();

    const userRes=await fetch("https://api.twitch.tv/helix/users",{
      headers:{Authorization:`Bearer ${token.access_token}`,"Client-Id":clientId}
    });
    if(!userRes.ok)throw new Error(`Twitch User ${userRes.status}`);
    const user=(await userRes.json()).data?.[0];
    if(!user?.id)throw new Error("Twitch-Konto konnte nicht gelesen werden.");

    const headers={
      apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type":"application/json",
      Prefer:"resolution=merge-duplicates,return=minimal"
    };
    const upsert=await fetch(`${process.env.SUPABASE_URL}/rest/v1/club_twitch_accounts`,{
      method:"POST",
      headers,
      body:JSON.stringify({
        user_id:payload.uid,
        twitch_user_id:user.id,
        login:user.login,
        display_name:user.display_name,
        profile_image_url:user.profile_image_url||null,
        email:user.email||null,
        access_token:token.access_token,
        refresh_token:token.refresh_token,
        expires_at:new Date(Date.now()+Number(token.expires_in||0)*1000).toISOString(),
        scopes:Array.isArray(token.scope)?token.scope:[],
        updated_at:new Date().toISOString()
      })
    });
    if(!upsert.ok)throw new Error(`Supabase Twitch link ${upsert.status}: ${await upsert.text()}`);

    return res.redirect(`${process.env.PUBLIC_SITE_URL||"/"}/club-profile.html?twitch_connected=1#twitch-section`);
  }catch(error){
    console.error("twitch-callback",error);
    return fail(res,error?.message||"Twitch-Verbindung fehlgeschlagen.");
  }
}
