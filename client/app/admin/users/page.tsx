/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  emailVerified?: boolean;
  createdAt?: string;
};

type ApiResponse = {
  data: {
    users: UserRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message: string;
};

function formatDate(v?: string) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    // Use your existing admin token key here:
    // e.g. "admin_token" / "token" / "adminToken"
    return localStorage.getItem("admin_token") || "";
  }, []);

  const fetchUsers = async (p: number, query: string) => {
    setLoading(true);
    setErr(null);
    try {
      const url = new URL(`${API_BASE}/admin/users`);
      url.searchParams.set("page", String(p));
      url.searchParams.set("limit", String(limit));
      if (query.trim()) url.searchParams.set("q", query.trim());

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Request failed: ${res.status}`);
      }

      const json = (await res.json()) as ApiResponse;

      setUsers(json.data.users || []);
      setPage(json.data.page || 1);
      setTotalPages(json.data.totalPages || 1);
      setTotal(json.data.total || 0);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If token missing, you can redirect to admin login page if you have one.
    if (!token) {
      setErr("Admin token not found. Please login as admin.");
      return;
    }
    fetchUsers(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSearch = () => fetchUsers(1, q);

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-gray-600">
            Total: <span className="font-medium">{total}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone"
            className="w-64 rounded-md border px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={onSearch}
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
            disabled={loading}
          >
            Search
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-white">
        {err ? (
          <div className="p-4 text-sm text-red-600">{err}</div>
        ) : null}

        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-600" colSpan={6}>
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="border-t">
                    <td className="px-4 py-3">{u.name || "-"}</td>
                    <td className="px-4 py-3">{u.email || "-"}</td>
                    <td className="px-4 py-3">{u.phone || "-"}</td>
                    <td className="px-4 py-3">{u.role || "-"}</td>
                    <td className="px-4 py-3">{u.emailVerified ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="text-sm text-gray-600">
            Page <span className="font-medium">{page}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={loading || page <= 1}
              onClick={() => fetchUsers(page - 1, q)}
            >
              Prev
            </button>
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={loading || page >= totalPages}
              onClick={() => fetchUsers(page + 1, q)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
