import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_PLACEHOLDER",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET_PLACEHOLDER",
    }),
  ],
  pages: {
    signIn: '/',
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.google_access_token = account.access_token;
        
        // Exchange Google token for Backend JWT
        try {
          const response = await fetch("http://localhost:8000/api/auth/google/", {
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
