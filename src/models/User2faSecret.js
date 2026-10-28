import { DataTypes, Model } from 'sequelize';
import sequelize from '../libraries/sequelize.libs.js';
import { formattedTimestamp } from '../libraries/date.libs.js';
import User from './User.js';

class User2faSecret extends Model {}

User2faSecret.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            unique: true,
            references: {
                model: 'users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        '2fa_secret': {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: '2fa_secret',
        },
        created_at: formattedTimestamp('created_at'),
        updated_at: formattedTimestamp('updated_at'),
    },
    {
        sequelize,
        modelName: 'User2faSecret',
        tableName: 'user_2fa_secrets',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
);

User.hasOne(User2faSecret, {
    foreignKey: 'user_id',
    sourceKey: 'id',
    as: 'user2faSecret',
    constraints: false,
});

User2faSecret.belongsTo(User, {
    foreignKey: 'user_id',
    targetKey: 'id',
    as: 'user',
    constraints: false,
});

export default User2faSecret;
