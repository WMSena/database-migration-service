import 'dotenv/config';
import { Sequelize } from 'sequelize';

const MainConfig = {
    username: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_NAME,
    host: process.env.PG_HOST,
    dialect: 'postgres',
    timezone: '+07:00',
    port : process.env.PG_PORT,
    define: {
        underscored: true,
        freezeTableName: true,
        timestamps: false
    },
    logging: false
}
const sequelize = new Sequelize(MainConfig.database, MainConfig.username, MainConfig.password, MainConfig);

export async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

export default sequelize;