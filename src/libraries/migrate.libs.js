import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sequelize from './sequelize.libs.js';

const modelsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '../models');

function isSequelizeModel(value) {
    return Boolean(
        value
        && typeof value.getTableName === 'function'
        && typeof value.sync === 'function'
        && value.rawAttributes
    );
}

function tableNameOf(model) {
    const table = model.getTableName();
    return typeof table === 'string' ? table : table.tableName;
}

function referencedTables(model) {
    const names = [];

    for (const attribute of Object.values(model.rawAttributes)) {
        const referenced = attribute.references?.model;
        if (!referenced || referenced === tableNameOf(model)) {
            continue;
        }

        names.push(typeof referenced === 'string' ? referenced : referenced.tableName);
    }

    return names;
}

function sortModels(models) {
    const byTable = new Map(models.map((model) => [tableNameOf(model), model]));
    const remaining = [...models];
    const ordered = [];

    while (remaining.length > 0) {
        const nextIndex = remaining.findIndex((model) => {
            return referencedTables(model).every((name) => {
                const dependency = byTable.get(name);
                return !dependency || ordered.includes(dependency);
            });
        });

        if (nextIndex === -1) {
            ordered.push(...remaining);
            break;
        }

        ordered.push(remaining.splice(nextIndex, 1)[0]);
    }

    return ordered;
}

async function loadModels() {
    const files = (await readdir(modelsDirectory))
        .filter((file) => file.endsWith('.js'))
        .sort();
    const models = [];

    for (const file of files) {
        const imported = await import(pathToFileURL(path.join(modelsDirectory, file)).href);

        for (const value of [imported.default, ...Object.values(imported)]) {
            if (isSequelizeModel(value) && !models.includes(value)) {
                models.push(value);
            }
        }
    }

    return sortModels(models);
}

function existingTableNames(tables) {
    return new Set(tables.map((table) => {
        if (typeof table === 'string') {
            return table;
        }

        return table.tableName || table.table_name;
    }));
}

function columnNameOf(attributeName, attribute) {
    return attribute.field || attributeName;
}

function isStoredColumn(attribute) {
    return Boolean(attribute?.type) && attribute.type.key !== 'VIRTUAL';
}

async function tableHasRows(tableName) {
    const quoted = sequelize.getQueryInterface().queryGenerator.quoteTable(tableName);
    const [rows] = await sequelize.query(
        `SELECT EXISTS (SELECT 1 FROM ${quoted}) AS present`
    );

    return Boolean(rows[0]?.present);
}

function columnDefinition(attribute, hasRows) {
    const definition = {
        type: attribute.type,
        allowNull: attribute.allowNull !== false,
    };

    if (attribute.defaultValue !== undefined) {
        definition.defaultValue = attribute.defaultValue;
    }

    if (attribute.unique) {
        definition.unique = attribute.unique;
    }

    if (attribute.references) {
        definition.references = attribute.references;
        if (attribute.onUpdate) {
            definition.onUpdate = attribute.onUpdate;
        }
        if (attribute.onDelete) {
            definition.onDelete = attribute.onDelete;
        }
    }

    const required = attribute.allowNull === false;
    const hasDefault = attribute.defaultValue !== undefined;

    if (required && !hasDefault && hasRows) {
        definition.allowNull = true;
        definition.relaxed = true;
    }

    return definition;
}

export async function migratePostgres() {
    await sequelize.authenticate();

    const queryInterface = sequelize.getQueryInterface();
    const models = await loadModels();
    const existing = existingTableNames(await queryInterface.showAllTables());
    const created = [];
    const added = [];
    const removed = [];

    for (const model of models) {
        const tableName = tableNameOf(model);

        if (existing.has(tableName)) {
            continue;
        }

        await model.sync();
        existing.add(tableName);
        created.push(tableName);
        console.log(`[MIGRATE] Created table ${tableName}`);
    }

    for (const model of models) {
        const tableName = tableNameOf(model);
        const currentColumns = await queryInterface.describeTable(tableName);
        const hasRows = await tableHasRows(tableName);

        for (const [attributeName, attribute] of Object.entries(model.rawAttributes)) {
            if (!isStoredColumn(attribute)) {
                continue;
            }

            const columnName = columnNameOf(attributeName, attribute);

            if (currentColumns[columnName]) {
                continue;
            }

            const definition = columnDefinition(attribute, hasRows);
            const relaxed = definition.relaxed === true;
            delete definition.relaxed;

            await queryInterface.addColumn(tableName, columnName, definition);
            added.push(`${tableName}.${columnName}`);

            if (relaxed) {
                console.log(
                    `[MIGRATE] Added nullable column ${tableName}.${columnName}. Existing rows have no value yet.`
                );
            } else {
                console.log(`[MIGRATE] Added column ${tableName}.${columnName}`);
            }
        }

        const modelColumns = new Set(
            Object.entries(model.rawAttributes)
                .filter(([, attribute]) => isStoredColumn(attribute))
                .map(([attributeName, attribute]) => columnNameOf(attributeName, attribute).toLowerCase())
        );

        for (const [columnName, column] of Object.entries(currentColumns)) {
            if (modelColumns.has(columnName.toLowerCase())) {
                continue;
            }

            if (column.primaryKey) {
                console.log(`[MIGRATE] Kept primary key ${tableName}.${columnName}`);
                continue;
            }

            await queryInterface.removeColumn(tableName, columnName);
            removed.push(`${tableName}.${columnName}`);
            console.log(`[MIGRATE] Removed column ${tableName}.${columnName}`);
        }
    }

    if (created.length === 0 && added.length === 0 && removed.length === 0) {
        console.log('[MIGRATE] PostgreSQL schema is already up to date.');
    }

    return { created, added, removed };
}
