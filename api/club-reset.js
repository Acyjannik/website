let supabaseClient=null;
const $=id=>document.getElementById(id);

function status(text,type=''){
  const el=$('reset-status');
  if(!el)return;
  el.textContent=text;
  el.className=`club-auth-status ${type}`.trim();
}

async function init(){
  try{
    const cfg=await (await fetch('/api/config',{cache:'no-store'})).json();
    if(!cfg.configured)throw new Error('Supabase ist noch nicht konfiguriert.');
    supabaseClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
      auth:{persistSession:true,autoRefreshToken:true}
    });

    // Supabase consumes the recovery URL and establishes a recovery session.
    const {data,error}=await supabaseClient.auth.getSession();
    if(error)throw error;

    if(!data?.session){
      throw new Error('Der Passwort-Link ist ungültig oder abgelaufen. Bitte einen neuen Link anfordern.');
    }

    // Only enable password change once a recovery session exists.
    $('reset-submit').disabled=false;
    status('Link ist gültig. Du kannst jetzt dein neues Passwort festlegen.','success');
  }catch(error){
    console.error('Password reset init:',error);
    status(error.message||'Passwort-Link konnte nicht geprüft werden.','error');
  }
}

$('reset-form')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const password=$('new-password').value;
  const confirm=$('new-password-confirm').value;

  if(password.length<10)return status('Das Passwort muss mindestens 10 Zeichen lang sein.','error');
  if(password!==confirm)return status('Die beiden Passwörter stimmen nicht überein.','error');

  $('reset-submit').disabled=true;
  status('Passwort wird geändert…');

  try{
    const {error}=await supabaseClient.auth.updateUser({password});
    if(error)throw error;

    $('reset-form').hidden=true;
    $('reset-success').hidden=false;
  }catch(error){
    console.error('Password reset:',error);
    status(error.message||'Passwort konnte nicht geändert werden.','error');
    $('reset-submit').disabled=false;
  }
});

init();
