export function getConfiguredManagerEmail() {
  const email = process.env.MANAGER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function isConfiguredManager(user) {
  const email = getConfiguredManagerEmail();
  return Boolean(
    email &&
      user?.role === "MANAGER" &&
      user?.email?.trim().toLowerCase() === email,
  );
}
