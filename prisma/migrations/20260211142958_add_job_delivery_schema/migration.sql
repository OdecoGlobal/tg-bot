-- CreateTable
CREATE TABLE "JobDelivery" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jobId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deliveredAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobDelivery_jobId_userId_key" ON "JobDelivery"("jobId", "userId");

-- AddForeignKey
ALTER TABLE "JobDelivery" ADD CONSTRAINT "JobDelivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDelivery" ADD CONSTRAINT "JobDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
