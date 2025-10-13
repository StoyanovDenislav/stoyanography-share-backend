const cron = require("node-cron");
const SoftDeleteService = require("./services/softDeleteService");

/**
 * Schedule daily cleanup of soft-deleted entities
 * Runs every day at 3:00 AM
 */
function startCleanupCron() {
  const softDeleteService = new SoftDeleteService();

  // Schedule: Run every day at 3:00 AM
  // Format: second minute hour day month weekday
  cron.schedule("0 3 * * *", async () => {
    console.log(
      "\n⏰ Scheduled cleanup job started at:",
      new Date().toISOString()
    );

    try {
      const summary = await softDeleteService.cleanupScheduledDeletions();

      if (summary.totalDeleted === 0) {
        console.log("   ℹ️  No entities scheduled for deletion");
      }
    } catch (error) {
      console.error("❌ Scheduled cleanup job failed:", error);
    }
  });

  console.log("🔔 Cleanup cron job scheduled (daily at 3:00 AM)");
}

module.exports = { startCleanupCron };
