// Pomocnicze funkcje e2e: API rozpoznaje użytkownika po ciasteczku sesji, więc przed
// operacją na profilu trzeba się na niego zalogować w danym kontekście żądań.

async function loginAs(ctx, email, password) {
  const res = await ctx.post("/api/profiles/login", { data: { email, password } });
  if (!res.ok()) {
    throw new Error(`Logowanie ${email} nie powiodło się: ${res.status()}`);
  }
  return res.json();
}

async function deleteOwnProfile(ctx, profile, password) {
  try {
    await loginAs(ctx, profile.email, password);
    await ctx.delete(`/api/profiles/${profile.id}`, { data: { password } });
  } catch (_) {
    // sprzątanie po teście nie może zasłonić właściwego błędu
  }
}

module.exports = { loginAs, deleteOwnProfile };
