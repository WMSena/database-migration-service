import { getDb } from '../libraries/mongo.libs.js';
import { formatDate } from '../libraries/date.libs.js';

export const TEMP_2FA_COLLECTION = 'temp_2fa_secrets';
export const TEMP_2FA_TTL_SECONDS = 5 * 60;

const TTL_INDEX = 'temp_2fa_secrets_created_at_ttl';
const USER_INDEX = 'temp_2fa_secrets_user_id_unique';

function normalizeUserId(userId) {
    return String(userId);
}

export function presentTemp2faSecret(doc) {
    if (!doc) {
        return null;
    }

    return {
        id: String(doc._id),
        user_id: doc.user_id,
        '2fa_secret': doc['2fa_secret'],
        created_at: formatDate(doc.created_at),
        updated_at: formatDate(doc.updated_at),
    };
}

export async function migrateTemp2faSecrets(db) {
    const existing = await db.listCollections({ name: TEMP_2FA_COLLECTION }).toArray();

    if (existing.length === 0) {
        await db.createCollection(TEMP_2FA_COLLECTION);
    }

    const collection = db.collection(TEMP_2FA_COLLECTION);
    const indexes = await collection.indexes();
    const ttlIndex = indexes.find((index) => index.name === TTL_INDEX);

    if (ttlIndex && ttlIndex.expireAfterSeconds !== TEMP_2FA_TTL_SECONDS) {
        await collection.dropIndex(TTL_INDEX);
    }

    await collection.createIndex(
        { created_at: 1 },
        { name: TTL_INDEX, expireAfterSeconds: TEMP_2FA_TTL_SECONDS },
    );
    await collection.createIndex(
        { user_id: 1 },
        { name: USER_INDEX, unique: true },
    );
}

async function collection() {
    const db = await getDb();
    return db.collection(TEMP_2FA_COLLECTION);
}

export async function saveTemp2faSecret(userId, secret) {
    const now = new Date();
    const user_id = normalizeUserId(userId);
    const pending = await collection();

    await pending.updateOne(
        { user_id },
        {
            $set: {
                user_id,
                '2fa_secret': secret,
                created_at: now,
                updated_at: now,
            },
        },
        { upsert: true },
    );

    return presentTemp2faSecret(await pending.findOne({ user_id }));
}

export async function findTemp2faSecret(userId) {
    const pending = await collection();
    const doc = await pending.findOne({ user_id: normalizeUserId(userId) });
    return presentTemp2faSecret(doc);
}

export async function deleteTemp2faSecret(userId) {
    const pending = await collection();
    await pending.deleteOne({ user_id: normalizeUserId(userId) });
}
