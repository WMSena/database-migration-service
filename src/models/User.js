import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcrypt';
import sequelize from '../libraries/sequelize.libs.js'; // Your Sequelize instance
import { encrypt, decrypt, generateBlindIndex } from '../libraries/crypto.libs.js'
import { formattedTimestamp } from '../libraries/date.libs.js';

class User extends Model {
    // Override toJSON to ensure sensitive data NEVER leaks in API responses
    toJSON() {
        const values = Object.assign({}, this.get());
        delete values.password_hash;
        delete values.email_blind_index;
        delete values.email_iv;
        delete values.email_tag;
        return values;
    }
}

User.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        email: {
            type: DataTypes.TEXT,
            allowNull: false,
            get() {
                const email = this.getDataValue('email').replaceAll('"','');
                const emailIv = this.getDataValue('email_iv').replaceAll('"','');
                const emailTag = this.getDataValue('email_tag').replaceAll('"','');
                const rawValue =  `${emailIv}:${emailTag}:${email}`
                return rawValue ? decrypt(rawValue) : rawValue;
            },
            set(value) {
                if (!value) {
                    return;
                }

                const normalizedEmail = value.toLowerCase().trim();
                const enc = encrypt(normalizedEmail);

                this.setDataValue('email', JSON.stringify(enc.encrypted));
                this.setDataValue('email_iv', JSON.stringify(enc.iv));
                this.setDataValue('email_tag', JSON.stringify(enc.authTag));
                this.setDataValue('email_blind_index', generateBlindIndex(normalizedEmail));
            },
        },
        email_iv: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        email_tag: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        email_blind_index: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        password_hash: {
            type: DataTypes.STRING(255),
            allowNull: false,
            set(value) {
                if (value) {
                    const salt = bcrypt.genSaltSync(10);
                    const hash = bcrypt.hashSync(value, salt);
                    this.setDataValue('password_hash', hash);
                }
            },
        },
        '2fa_enabled': {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: '2fa_enabled',
        },
        created_at: formattedTimestamp('created_at'),
        updated_at: formattedTimestamp('updated_at'),
    },
    {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        defaultScope: {
            attributes: {
                exclude: ['password_hash', 'email_blind_index'],
            },
        },
        scopes: {
            withSecrets: {
                attributes: {
                    include: ['password_hash', 'email_blind_index'],
                },
            },
        },
    },
);

User.prototype.verifyPassword = async function(password) {
    return await bcrypt.compare(password, this.getDataValue('password_hash'));
};

export default User;