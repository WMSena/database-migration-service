import sequelize from '../src/libraries/sequelize.libs.js';
import { migratePostgres } from '../src/libraries/migrate.libs.js';

async function migrate() {
    try {
        await migratePostgres();
        console.log('PostgreSQL migration completed.');
    } catch (error) {
        console.error('PostgreSQL migration failed:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

await migrate();
