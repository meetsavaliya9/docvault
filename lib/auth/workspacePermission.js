import "server-only";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/auth/session";
import { getUserRole, hasPermission } from "@/lib/permissions";

export async function requireManagerPermission(permission) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "You are not signed in." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  if (getUserRole(user) !== "MANAGER") {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Manager access is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  if (permission && !(await hasPermission(user, permission))) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "You don't have permission to access this feature." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return { user, response: null };
}
