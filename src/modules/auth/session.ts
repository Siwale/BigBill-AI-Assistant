import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { tenants, users, assistantProfiles } from "@/db/schema";
import type { AssistantProfile, Tenant, User } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { ApiError } from "@/lib/http";

export const SESSION_COOKIE = "assistant_session";
const SESSION_TTL = "7d";

export type Session = {
  user: User;
  tenant: Tenant;
  profile: AssistantProfile;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function createSessionToken(user: Pick<User, "id" | "tenantId" | "role">): Promise<string> {
  return new SignJWT({ tid: user.tenantId, role: user.role, v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

type TokenPayload = { tid?: unknown; v?: unknown };

export async function setSessionCookie(user: Pick<User, "id" | "tenantId" | "role">): Promise<void> {
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  let tenantId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const data = payload as TokenPayload;
    if (typeof payload.sub !== "string" || typeof data.tid !== "string") return null;
    userId = payload.sub;
    tenantId = data.tid;
  } catch {
    return null;
  }

  // The token is never sufficient on its own: load the user from storage and
  // verify it still belongs to the tenant encoded in the token.
  const rows = await db
    .select({ user: users, tenant: tenants, profile: assistantProfiles })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .leftJoin(assistantProfiles, eq(assistantProfiles.tenantId, tenants.id))
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    user: row.user,
    tenant: row.tenant,
    // A profile is created during signup. If it is missing, the application
    // fails closed rather than inventing a name.
    profile:
      row.profile ??
      ({
        id: "",
        tenantId: row.tenant.id,
        displayName: null,
        ownerUserId: null,
        personaConfig: {},
        voiceConfig: {},
        onboardingCompletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies AssistantProfile),
  };
}

export async function requireApiSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Please sign in to continue.", "unauthenticated");
  return session;
}

export async function requireOwner(): Promise<Session> {
  const session = await requireApiSession();
  if (session.user.role !== "owner" && session.user.role !== "admin") {
    throw new ApiError(403, "Only a workspace owner or administrator can do that.", "forbidden");
  }
  return session;
}

export async function requirePageSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireOnboardedPageSession(): Promise<Session> {
  const session = await requirePageSession();
  if (!session.profile.onboardingCompletedAt || !session.profile.displayName) {
    redirect("/onboarding");
  }
  return session;
}
