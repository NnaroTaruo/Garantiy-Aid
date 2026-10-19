-- CreateTable
CREATE TABLE "claims" (
    "claim_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "distribution_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "claim_status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "verification_method" VARCHAR(32),
    "biometric_verified" BOOLEAN NOT NULL DEFAULT false,
    "biometric_score" DECIMAL(5,4),
    "qr_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_duplicate_flag" BOOLEAN NOT NULL DEFAULT false,
    "claimed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "wallet_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "account_status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "last_transaction_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transaction_type" VARCHAR(32) NOT NULL,
    "reference_no" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'posted',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claims_schedule_id_key" ON "claims"("schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_beneficiary_id_distribution_id_key" ON "claims"("beneficiary_id", "distribution_id");

-- CreateIndex
CREATE INDEX "claims_beneficiary_id_claim_status_created_at_idx" ON "claims"("beneficiary_id", "claim_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_beneficiary_id_key" ON "wallet_accounts"("beneficiary_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_claim_id_key" ON "transactions"("claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_no_key" ON "transactions"("reference_no");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_created_at_idx" ON "transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_beneficiary_id_created_at_idx" ON "transactions"("beneficiary_id", "created_at");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distributions"("distribution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("schedule_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("claim_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallet_accounts"("wallet_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE CASCADE ON UPDATE CASCADE;
