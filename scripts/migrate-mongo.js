import { getDb, closeMongo } from '../src/libraries/mongo.libs.js';
import { migrateTemp2faSecrets, TEMP_2FA_TTL_SECONDS } from '../src/models/Temp2faSecret.js';

async function migrate() {
    try {
        const db = await getDb();
        await migrateTemp2faSecrets(db);
        console.log(
            `MongoDB migration completed: temp_2fa_secrets expires ${TEMP_2FA_TTL_SECONDS} seconds after created_at.`
        );
    } catch (error) {
        console.error('MongoDB migration failed:', error);
        process.exitCode = 1;
    } finally {
        await closeMongo();
    }
}

await migrate();
