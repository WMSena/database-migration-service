# database-migration-service

Durable accounts live in PostgreSQL. A pending two-factor secret lives in MongoDB until the user verifies it, then it is removed. PostgreSQL is managed with Sequelize. MongoDB is managed with the official driver, because Sequelize does not support MongoDB.

## Requirements

- Node.js 20
- Docker with Compose

## Start the databases

`compose.yml` is local and is not committed. Copy the example, then set the database users and passwords to the same values you put in `.env`.

```powershell
Copy-Item compose.yml.example compose.yml
docker compose up -d
```

| Service | Image | Host port | Database | User |
|---|---|---|---|---|
| `my-api-postgres` | `postgres:16` | `5432` | `my_api` | `postgres` |
| `my-api-mongo` | `mongo:7` | `27018` | `my_api` | `mongo` |

MongoDB is published on **27018** because a MongoDB server installed on Windows often already owns `127.0.0.1:27017`. Connecting to port 27017 reaches that local server, not this container.

`docker compose up -d` starts only the services that are missing. It does not wipe either database. Data is kept in the `postgres_data` and `mongo_data` volumes. A container restart does not require seeding again.

`docker compose down -v` deletes those volumes. After that, run the MongoDB migration and the seed again.

## Configure the application

```powershell
Copy-Item .env.example .env
npm install
```

Fill in `.env`:

| Variable | Purpose |
|---|---|
| `PG_HOST`, `PG_PORT`, `PG_NAME`, `PG_USER`, `PG_PASSWORD` | PostgreSQL connection |
| `MONGO_HOST`, `MONGO_PORT`, `MONGO_NAME`, `MONGO_USER`, `MONGO_PASSWORD` | MongoDB connection |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM email encryption |
| `HMAC_SECRET` | Secret for the email blind index. Any string is valid |

`ENCRYPTION_KEY` must be 32 bytes, written as hex. This command prints that value:

```powershell
openssl rand -hex 32
```

`HMAC_SECRET` does not have to be 32-byte hex. The same command is a good way to create one:

```powershell
openssl rand -hex 32
```

For the Compose file in this project, the matching local values are `PG_USER=postgres`, `PG_PASSWORD=postgres`, `MONGO_PORT=27018`, `MONGO_USER=mongo`, and `MONGO_PASSWORD=mongo`.

## Create the schema and sample data

```powershell
npm run migrate
npm run migrate:mongo
npm run seed
```

`npm run migrate` updates PostgreSQL from the Sequelize models:

- A missing table is created.
- A column added inside the first object of `.init` is added. The attribute name is the column name. Set `field` only when the database column should use a different name.
- A column removed from that object is dropped. The values in that column are deleted. The table and every other column stay. Primary keys are not dropped.
- A model file removed from `src/models` does not drop its table.

Run it again after adding or removing an attribute. A required new column with no default is added as nullable when the table already has rows, so those rows are kept. Renaming an attribute drops the old column and adds the new one; the old values are not copied.

`npm run migrate:mongo` creates the `temp_2fa_secrets` collection and its indexes. It is safe to run more than once.

`npm run seed` runs the PostgreSQL migration, then inserts the sample users. Existing users and existing verified secrets are left in place.

| Username | Email | Password | 2FA |
|---|---|---|---|
| `admin` | `admin@example.com` | `AdminPassword123!` | disabled |
| `johndoe` | `john@example.com` | `SecretPass123!` | enabled, secret `JBSWY3DPEHPK3PXP` |

These accounts are for local development.

## Project layout

```
src/models/User.js              PostgreSQL users
src/models/User2faSecret.js     Verified 2FA secrets
src/models/Temp2faSecret.js     Pending 2FA secrets and the MongoDB migration
src/libraries/sequelize.libs.js PostgreSQL connection
src/libraries/mongo.libs.js     MongoDB connection
src/libraries/migrate.libs.js   PostgreSQL migration used by the script and the seed
src/libraries/crypto.libs.js    Email encryption and blind index
src/libraries/date.libs.js      Shared timestamp format
scripts/migrate.js              Add or remove PostgreSQL columns without dropping tables
scripts/seed.js                 Insert sample users
scripts/migrate-mongo.js        Create the pending-secret collection
```

## Security

Keep `.env` out of version control. Create a new `ENCRYPTION_KEY` with `openssl rand -hex 32`. `HMAC_SECRET` can be any secret string; the same command is a good way to create one. Changing `ENCRYPTION_KEY` makes existing email ciphertext unreadable. Changing `HMAC_SECRET` makes existing blind indexes unusable for lookup.
