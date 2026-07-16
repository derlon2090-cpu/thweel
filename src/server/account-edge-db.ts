export async function ensureAccountTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS "Profile" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "fullName" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "emailVerifiedAt" TIMESTAMP(3),
      "lastLoginAt" TIMESTAMP(3),
      "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
      "lockedUntil" TIMESTAMP(3),
      "xpBalance" INTEGER NOT NULL DEFAULT 50,
      "xpLevel" INTEGER NOT NULL DEFAULT 1,
      "totalXpUsed" INTEGER NOT NULL DEFAULT 0,
      "totalXpEarned" INTEGER NOT NULL DEFAULT 50,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "Profile_email_key" ON "Profile"("email")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "UserSession" (
      "id" TEXT NOT NULL,
      "sessionToken" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "userAgent" TEXT,
      "ipAddress" TEXT,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "revokedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_sessionToken_key" ON "UserSession"("sessionToken")`;
  await sql`CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession"("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx" ON "UserSession"("expiresAt")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "XpTransaction" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "jobId" TEXT,
      "type" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "balanceAfter" INTEGER NOT NULL,
      "description" TEXT NOT NULL,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "XpTransaction_userId_createdAt_idx" ON "XpTransaction"("userId", "createdAt")`;
}
