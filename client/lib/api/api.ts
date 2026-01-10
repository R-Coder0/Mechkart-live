export async function apiGet(url: string) {
  const token = localStorage.getItem("admin_token");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed request");
  }

  return res.json();
}
