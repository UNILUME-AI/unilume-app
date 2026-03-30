import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDb } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !account.providerAccountId) {
        return false;
      }

      const sql = getDb();
      const id = `google_${account.providerAccountId}`;

      // Upsert user
      await sql`
        INSERT INTO users (id, google_id, email, name, avatar_url)
        VALUES (${id}, ${account.providerAccountId}, ${user.email ?? ""}, ${user.name ?? ""}, ${user.image ?? ""})
        ON CONFLICT (google_id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          avatar_url = EXCLUDED.avatar_url
      `;

      return true;
    },
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.userId = `google_${account.providerAccountId}`;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
