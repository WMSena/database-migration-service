import 'dotenv/config';
import { MongoClient } from 'mongodb';

let client;

export function getMongoConfig() {
    return {
        host: process.env.MONGO_HOST || 'localhost',
        port: process.env.MONGO_PORT || '27018',
        database: process.env.MONGO_NAME || 'my_api',
        user: process.env.MONGO_USER || 'mongo',
        password: process.env.MONGO_PASSWORD || 'mongo',
    };
}

export function getMongoUri(config = getMongoConfig()) {
    const user = encodeURIComponent(config.user);
    const password = encodeURIComponent(config.password);

    return `mongodb://${user}:${password}@${config.host}:${config.port}/${config.database}?authSource=admin`;
}

export async function connectMongo() {
    if (client) {
        return client;
    }

    client = new MongoClient(getMongoUri());
    await client.connect();
    return client;
}

export async function getDb() {
    const mongo = await connectMongo();
    return mongo.db(getMongoConfig().database);
}

export async function closeMongo() {
    if (!client) {
        return;
    }

    await client.close();
    client = null;
}
