import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { createClient } from "@supabase/supabase-js";

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const p = profile as { email?: string; name?: string };
        token.email = p?.email ?? token.email;
        token.name = p?.name ?? token.name;
        const supabase = getSupabaseService();
        if (supabase && token.email) {
          const { data } = await supabase
            .from("app_users")
            .select("roles, role, employee_id, division_id")
            .ilike("email", String(token.email))
            .maybeSingle();
          const dbRoles = Array.isArray(data?.roles) ? data.roles.map((r) => String(r)) : [];
          const fallbackRole = typeof data?.role === "string" ? data.role : null;
          token.roles =
            dbRoles.length > 0
              ? dbRoles
              : fallbackRole && fallbackRole !== "individual"
                ? [fallbackRole]
                : [];
          token.employee_id = data?.employee_id ?? null;
          token.division_id = data?.division_id ?? null;
        } else {
          token.roles = [];
          token.employee_id = null;
          token.division_id = null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email ?? null;
        session.user.name = (token.name as string) ?? session.user.name ?? null;
        session.user.roles = ((token.roles as string[] | undefined) ?? []);
        session.user.employee_id = (token.employee_id as string | null | undefined) ?? null;
        session.user.division_id = (token.division_id as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
