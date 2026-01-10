
export function isAdminLoggedIn() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("admin_token");
}
