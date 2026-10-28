import 'dotenv/config';
import sequelize from '../src/libraries/sequelize.libs.js';
import { migratePostgres } from '../src/libraries/migrate.libs.js';
import User from '../src/models/User.js';
import User2faSecret from '../src/models/User2faSecret.js';

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('Connected to PostgreSQL for seeding.');

        const initialUsers = [
            {
                username: 'admin',
                email: 'admin@example.com',
                password_hash: 'AdminPassword123!',
                '2fa_enabled': false,
            },
            {
                username: 'johndoe',
                email: 'john@example.com',
                password_hash: 'SecretPass123!',
                '2fa_enabled': true,
                '2fa_secret': 'JBSWY3DPEHPK3PXP',
            },
        ];

        // Helper function to create user with encrypted email
        async function createUser(userData) {
            const existingUsers = await User.findAll();
            const exists = existingUsers.some(
                (u) => u.email === userData.email || u.username === userData.username
            );

            if (!exists) {
                await User.create({
                    username: userData.username,
                    email: userData.email,
                    password_hash: userData.password_hash, // Plain string - no JSON.stringify
                    '2fa_enabled': userData['2fa_enabled'],
                });
                console.log(`[SEED] Created user: ${userData.username} <${userData.email}>`);
            } else {
                console.log(`[SKIP] User ${userData.username} already exists.`);
            }
        }

        await migratePostgres();

        for (const userData of initialUsers) {
            // Check if user already exists (fetches all and compares decrypted emails)
            const existingUsers = await User.findAll();
            const exists = existingUsers.some(
                (u) => u.email === userData.email || u.username === userData.username
            );

            if (!exists) {
                await createUser(userData);
            } else {
                console.log(`[SKIP] User ${userData.username} already exists.`);
            }
        }

        for (const userData of initialUsers) {
            if (!userData['2fa_enabled']) {
                continue;
            }

            const user = await User.findOne({
                where: { username: userData.username },
            });

            if (!user) {
                console.log(`[SKIP] 2FA secret skipped, user ${userData.username} was not found.`);
                continue;
            }

            const existingSecret = await User2faSecret.findOne({
                where: { user_id: user.id },
            });

            if (existingSecret) {
                console.log(`[SKIP] 2FA secret for ${userData.username} already exists.`);
                continue;
            }

            const secret = await User2faSecret.create({
                user_id: user.id,
                '2fa_secret': userData['2fa_secret'],
            });

            console.log(
                `[SEED] Created 2FA secret for: ${userData.username} (created_at=${secret.created_at}, updated_at=${secret.updated_at})`
            );
        }

        console.log('Seeding completed successfully.');
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

await seed();