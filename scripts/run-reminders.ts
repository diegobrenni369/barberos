import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runReminderProcessor } from "../src/lib/notifications/cron";
import { NotificationConfigurationError } from "../src/lib/notifications/config";

runReminderProcessor(prisma).then(result => console.info(JSON.stringify({ event: "reminder_batch", ...result })))
  .catch(error => { console.error(error instanceof NotificationConfigurationError ? error.message : "Reminder processor failed"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
