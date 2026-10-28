import { DataTypes } from 'sequelize';

function pad(value) {
    return String(value).padStart(2, '0');
}

export function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const datePart = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('-');

    const timePart = [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join(':');

    return `${datePart} ${timePart}`;
}

export function formattedTimestamp(field) {
    return {
        type: DataTypes.DATE,
        get() {
            const value = this.getDataValue(field);

            if (!value) {
                return null;
            }

            return formatDate(value);
        },
    };
}
