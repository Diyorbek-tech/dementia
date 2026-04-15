import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// In Docker: uses internal network (backend:8000)
// In dev:    uses localhost:8000
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.google_access_token = account.access_token;

        try {
          const response = await fetch(`${BACKEND_URL}/api/auth/google/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: account.access_token }),
          });
          const data = await response.json();
          if (data.access) {
            token.backend_access_token = data.access;
          }
        } catch (error) {
          console.error("Backend token exchange failed:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).backend_access_token = token.backend_access_token;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
