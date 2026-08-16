import { Client, GatewayIntentBits, Partials } from "discord.js";

const token=process.env.DISCORD_BOT_TOKEN;
const site=String(process.env.PUBLIC_SITE_URL||"").replace(/\/$/,"");
const secret=process.env.ACY_GAME_DISCOVERY_SECRET;
const guildOnly=process.env.DISCORD_GUILD_ID||"";

if(!token||!site||!secret){
  throw new Error("DISCORD_BOT_TOKEN, PUBLIC_SITE_URL und ACY_GAME_DISCOVERY_SECRET sind erforderlich.");
}

const client=new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers
  ],
  partials:[Partials.GuildMember]
});

const lastGames=new Map();

function pickGame(presence){
  const activities=presence?.activities||[];
  const game=activities.find(a=>a.type===0 && a.name);
  return game?.name?.trim()||null;
}

async function syncPresence(userId,gameName,online=true){
  const res=await fetch(`${site}/api/discord-presence`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-ACY-GAME-SECRET":secret
    },
    body:JSON.stringify({
      discordUserId:userId,
      gameName:gameName||"",
      online
    })
  });
  if(!res.ok)console.warn("ACY presence bridge:",res.status,await res.text());
}

client.on("presenceUpdate",async (oldPresence,newPresence)=>{
  if(guildOnly && newPresence.guild?.id!==guildOnly)return;

  const userId=newPresence.userId;
  const game=pickGame(newPresence);

  if(!game){
    if(lastGames.has(userId)){
      lastGames.delete(userId);
      await syncPresence(userId,lastGames.get(userId)||"",false).catch(()=>{});
    }
    return;
  }

  if(lastGames.get(userId)===game)return;
  lastGames.set(userId,game);
  await syncPresence(userId,game,true).catch(()=>{});
});

client.once("ready",()=>console.log(`ACY Discord presence bridge online as ${client.user.tag}`));
client.login(token);
