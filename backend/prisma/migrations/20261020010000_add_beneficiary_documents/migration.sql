CREATE TABLE "beneficiary_documents" (
    "document_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "doc_type" VARCHAR(32) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(64) NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "beneficiary_documents_pkey" PRIMARY KEY ("document_id")
);

CREATE UNIQUE INDEX "beneficiary_documents_file_path_key" ON "beneficiary_documents"("file_path");
CREATE UNIQUE INDEX "beneficiary_documents_beneficiary_id_doc_type_content_hash_key" ON "beneficiary_documents"("beneficiary_id", "doc_type", "content_hash");
CREATE INDEX "beneficiary_documents_beneficiary_id_created_at_idx" ON "beneficiary_documents"("beneficiary_id", "created_at");
ALTER TABLE "beneficiary_documents" ADD CONSTRAINT "beneficiary_documents_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE CASCADE ON UPDATE CASCADE;
