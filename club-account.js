let supabaseClient = null;
const $ = (id) => document.getElementById(id);

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_) {
    // Never let an HTML error page replace the useful error message.
    return { error: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() };
  }
}

async function init() {
  try {
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    const cfg = await configResponse.json();

    supabaseClient = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabaseAnonKey
    );

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (!data.session) {
      window.location.href = "/club.html";
      return;
    }

    $("account-email").textContent = data.session.user.email || "–";
    $("account-id").textContent = data.session.user.id || "–";
  } catch (error) {
    console.error(error);
    $("account-status").textContent = "Account konnte nicht geladen werden.";
  }
}

$("delete-account")?.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Möchtest du deinen ACY Club Account wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden."
  );

  if (!confirmed) return;

  const button = $("delete-account");
  const status = $("account-status");

  button.disabled = true;
  status.textContent = "Account wird gelöscht…";
  status.classList.remove("error", "success");

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    const token = data?.session?.access_token;
    if (!token) throw new Error("Keine aktive Sitzung.");

    const response = await fetch(
      "/api/club-notifications?action=delete_account",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const payload = await readJsonResponse(response);

    if (!response.ok || !payload.deleted) {
      throw new Error(
        payload.error || `Account konnte nicht gelöscht werden (${response.status}).`
      );
    }

    // The Auth user is gone at this point. Local session cleanup is best effort.
    await supabaseClient.auth.signOut();

    status.textContent = "Account erfolgreich gelöscht.";
    status.classList.add("success");

    setTimeout(() => {
      window.location.href = "/club.html?deleted=1";
    }, 700);
  } catch (error) {
    console.error("Account deletion:", error);
    status.textContent =
      error.message || "Account konnte nicht gelöscht werden.";
    status.classList.add("error");
    button.disabled = false;
  }
});

init();
