-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "replaced_by_session_id" UUID,
    "created_user_agent" TEXT,
    "created_ip" TEXT,
    "last_used_user_agent" TEXT,
    "last_used_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_token_family_id_idx" ON "auth_sessions"("token_family_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_active_user_id_idx" ON "auth_sessions"("user_id")
WHERE "revoked_at" IS NULL AND "consumed_at" IS NULL;

-- CreateIndex
CREATE INDEX "auth_sessions_active_token_family_id_idx" ON "auth_sessions"("token_family_id")
WHERE "revoked_at" IS NULL AND "consumed_at" IS NULL;

-- CreateIndex
CREATE INDEX "auth_sessions_active_expires_at_idx" ON "auth_sessions"("expires_at")
WHERE "revoked_at" IS NULL AND "consumed_at" IS NULL;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
