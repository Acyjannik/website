import { Client, GatewayIntentBits, Partials } from "discord.js";

const token=process.env.DISCORD_BOT_TOKEN;
const site=String(process.env.PUBLIC_SITE_URL||"").replace(/\/$/,"");
const secret=process.env.ACY_GAME_DISCOVERY_SECRET;
const guildOnly=process.env.DISCORD_GUILD_ID||"";

if(!token||!site||!secret)throw new Error("DISCORD_BOT_TOKEN, PUBLIC_SITE_URL und ACY_GAME_DISCOVERY_SECRET sind erforderlich.");

const client=new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildPresences,GatewayIntentBits.GuildMembers],
  partials:[Partials.GuildMember]
});

const lastGames=new Map();
const pendingSyncs=new Map();

function pickGame(presence){
  const activities=presence?.activities||[];
  const game=activities.find(a=>a.type===0&&a.name);
  return game?.name?.trim()||null;
}

async function bridgeRequest(userId,gameName,online){
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const res=await fetch(`${site}/api/discord-presence`,{
        method:"POST",
        headers:{"Content-Type":"application/json","X-ACY-GAME-SECRET":secret},
        body:JSON.stringify({discordUserId:userId,gameName:gameName||"",online}),
        signal:AbortSignal.timeout(8000)
      });
      if(res.ok)return true;
      const text=await res.text().catch(()=>"");
      lastError=new Error(`HTTP ${res.status}${text?` · ${text.slice(0,180)}`:""}`);
      if(res.status>=400&&res.status<500&&res.status!==429)break;
    }catch(error){lastError=error;}
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }
  console.warn("ACY presence bridge failed:",lastError?.message||lastError);
  return false;
}

function syncPresence(userId,gameName,online=true){
  const key=`${userId}:${online?"on":"off"}:${gameName||""}`;
  if(pendingSyncs.has(key))return pendingSyncs.get(key);
  const task=bridgeRequest(userId,gameName,online).finally(()=>pendingSyncs.delete(key));
  pendingSyncs.set(key,task);
  return task;
}

client.on("presenceUpdate",async (oldPresence,newPresence)=>{
  if(guildOnly&&newPresence.guild?.id!==guildOnly)return;
  const userId=newPresence.userId;
  const game=pickGame(newPresence);

  if(!game){
    if(lastGames.has(userId)){
      const oldGame=lastGames.get(userId);
      lastGames.delete(userId);
      await syncPresence(userId,oldGame,false).catch(()=>{});
    }
    return;
  }

  if(lastGames.get(userId)===game)return;
  lastGames.set(userId,game);
  await syncPresence(userId,game,true).catch(()=>{});
});

client.once("ready",()=>console.log(`ACY Discord presence bridge online as ${client.user.tag}`));
client.on("error",error=>console.error("ACY Discord client error:",error));
client.on("shardReconnecting",id=>console.warn(`ACY Discord reconnecting shard ${id}`));
client.on("shardReady",id=>console.log(`ACY Discord shard ${id} ready`));
client.on("shardDisconnect",(_,id)=>console.warn(`ACY Discord shard ${id} disconnected`));

process.on("unhandledRejection",error=>console.error("ACY Discord unhandled rejection:",error));
process.on("uncaughtException",error=>console.error("ACY Discord uncaught exception:",error));

client.login(token);
