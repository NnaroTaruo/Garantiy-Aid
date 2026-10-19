CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "schedule_id" UUID,
    "channel" VARCHAR(32) NOT NULL DEFAULT 'in_app',
    "title" VARCHAR(160) NOT NULL,
    "title_bs" VARCHAR(160),
    "message" TEXT NOT NULL,
    "message_bs" TEXT,
    "notification_type" VARCHAR(32) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

CREATE INDEX "notifications_beneficiary_id_created_at_idx" ON "notifications"("beneficiary_id", "created_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("schedule_id") ON DELETE SET NULL ON UPDATE CASCADE;
