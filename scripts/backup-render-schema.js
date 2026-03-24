const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function quoteIdentifier(name) {
  if (/^[a-z_][a-z0-9_]*$/i.test(name)) {
    return name;
  }
  return `"${String(name).replace(/"/g, '""')}"`;
}

function formatType(column) {
  const dataType = column.data_type;

  if (dataType === 'USER-DEFINED') {
    return quoteIdentifier(column.udt_name);
  }

  if (dataType === 'ARRAY') {
    const element = column.udt_name.startsWith('_')
      ? column.udt_name.slice(1)
      : column.udt_name;
    return `${quoteIdentifier(element)}[]`;
  }

  if (dataType === 'character varying') {
    return column.character_maximum_length
      ? `VARCHAR(${column.character_maximum_length})`
      : 'VARCHAR';
  }

  if (dataType === 'character') {
    return column.character_maximum_length
      ? `CHAR(${column.character_maximum_length})`
      : 'CHAR';
  }

  if (dataType === 'numeric') {
    if (column.numeric_precision && column.numeric_scale !== null) {
      return `DECIMAL(${column.numeric_precision},${column.numeric_scale})`;
    }
    return 'DECIMAL';
  }

  if (dataType === 'timestamp without time zone') return 'TIMESTAMP';
  if (dataType === 'timestamp with time zone') return 'TIMESTAMPTZ';
  if (dataType === 'double precision') return 'DOUBLE PRECISION';
  if (dataType === 'boolean') return 'BOOLEAN';
  if (dataType === 'integer') return 'INTEGER';
  if (dataType === 'bigint') return 'BIGINT';
  if (dataType === 'smallint') return 'SMALLINT';
  if (dataType === 'text') return 'TEXT';
  if (dataType === 'date') return 'DATE';
  if (dataType === 'json') return 'JSON';
  if (dataType === 'jsonb') return 'JSONB';

  return dataType.toUpperCase();
}

function formatColumnDefinition(column) {
  const isSerial =
    column.column_default &&
    /^nextval\(/.test(column.column_default) &&
    ['integer', 'bigint', 'smallint'].includes(column.data_type);

  let type = formatType(column);
  if (isSerial) {
    if (column.data_type === 'bigint') type = 'BIGSERIAL';
    else if (column.data_type === 'smallint') type = 'SMALLSERIAL';
    else type = 'SERIAL';
  }

  const parts = [quoteIdentifier(column.column_name), type];

  if (!isSerial && column.column_default !== null) {
    parts.push(`DEFAULT ${column.column_default}`);
  }

  if (column.is_nullable === 'NO') {
    parts.push('NOT NULL');
  }

  return parts.join(' ');
}

function topoSort(tables, fkRows) {
  const inDegree = new Map();
  const graph = new Map();

  tables.forEach((t) => {
    inDegree.set(t, 0);
    graph.set(t, new Set());
  });

  for (const row of fkRows) {
    const referencing = row.table_name;
    const referenced = row.foreign_table_name;

    if (!inDegree.has(referencing) || !inDegree.has(referenced)) continue;

    if (!graph.get(referenced).has(referencing)) {
      graph.get(referenced).add(referencing);
      inDegree.set(referencing, inDegree.get(referencing) + 1);
    }
  }

  const queue = tables.filter((t) => inDegree.get(t) === 0).sort();
  const ordered = [];

  while (queue.length > 0) {
    const current = queue.shift();
    ordered.push(current);

    const nextNodes = [...graph.get(current)].sort();
    for (const next of nextNodes) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
    queue.sort();
  }

  if (ordered.length !== tables.length) {
    return [...tables].sort();
  }

  return ordered;
}

function timestampName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function formatSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';

  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }

  if (Buffer.isBuffer(value)) {
    return `'\\x${value.toString('hex')}'`;
  }

  if (Array.isArray(value)) {
    const escaped = JSON.stringify(value).replace(/'/g, "''");
    return `'${escaped}'::jsonb`;
  }

  if (typeof value === 'object') {
    const escaped = JSON.stringify(value).replace(/'/g, "''");
    return `'${escaped}'::jsonb`;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in environment.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const tablesResult = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    const tables = tablesResult.rows.map((r) => r.table_name);

    if (tables.length === 0) {
      throw new Error('No tables found in public schema.');
    }

    const fkResult = await pool.query(
      `SELECT
         tc.table_name,
         ccu.table_name AS foreign_table_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.constraint_column_usage AS ccu
         ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'`
    );

    const orderedTables = topoSort(tables, fkResult.rows);
    const dropOrder = [...orderedTables].reverse();

    const lines = [];
    lines.push('-- PostgreSQL backup generated from Render database');
    lines.push(`-- Generated at: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('-- Drop tables');

    for (const tableName of dropOrder) {
      lines.push(`DROP TABLE IF EXISTS ${quoteIdentifier(tableName)} CASCADE;`);
    }

    lines.push('');
    lines.push('-- Create tables');

    for (const tableName of orderedTables) {
      const columnsResult = await pool.query(
        `SELECT
           column_name,
           is_nullable,
           data_type,
           udt_name,
           character_maximum_length,
           numeric_precision,
           numeric_scale,
           column_default,
           ordinal_position
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      );

      const constraintsResult = await pool.query(
        `SELECT con.contype, con.conname, pg_get_constraintdef(con.oid) AS def
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         WHERE nsp.nspname = 'public'
           AND rel.relname = $1
           AND con.contype IN ('p', 'u', 'f')
         ORDER BY CASE con.contype
           WHEN 'p' THEN 1
           WHEN 'u' THEN 2
           WHEN 'f' THEN 3
           ELSE 4
         END, con.conname`,
        [tableName]
      );

      const defs = [];
      for (const col of columnsResult.rows) {
        defs.push(`  ${formatColumnDefinition(col)}`);
      }

      for (const con of constraintsResult.rows) {
        defs.push(`  ${con.def}`);
      }

      lines.push(`CREATE TABLE ${quoteIdentifier(tableName)} (`);
      lines.push(defs.join(',\n'));
      lines.push(');');
      lines.push('');
    }

    lines.push('-- Insert data');

    for (const tableName of orderedTables) {
      const columnsResult = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      );

      const columnNames = columnsResult.rows.map((r) => r.column_name);
      if (columnNames.length === 0) {
        continue;
      }

      const selectSql = `SELECT * FROM ${quoteIdentifier(tableName)}`;
      const dataResult = await pool.query(selectSql);

      if (dataResult.rows.length === 0) {
        continue;
      }

      const columnList = columnNames.map(quoteIdentifier).join(', ');
      for (const row of dataResult.rows) {
        const values = columnNames.map((col) => formatSqlValue(row[col])).join(', ');
        lines.push(
          `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${values});`
        );
      }
      lines.push('');
    }

    lines.push('-- Reset sequences after insert');
    for (const tableName of orderedTables) {
      const serialColsResult = await pool.query(
        `SELECT
           a.attname AS column_name,
           pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS seq_name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid
         WHERE n.nspname = 'public'
           AND c.relname = $1
           AND a.attnum > 0
           AND NOT a.attisdropped`,
        [tableName]
      );

      for (const row of serialColsResult.rows) {
        if (!row.seq_name) continue;

        lines.push(
          `SELECT setval('${row.seq_name.replace(/'/g, "''")}', COALESCE((SELECT MAX(${quoteIdentifier(row.column_name)}) FROM ${quoteIdentifier(tableName)}), 1), TRUE);`
        );
      }
    }
    lines.push('');

    const backupDir = path.resolve(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const fileName = `backup_${timestampName()}.sql`;
    const outputPath = path.join(backupDir, fileName);

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

    console.log(`Backup created: ${outputPath}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Failed to create backup:', error.message);
  process.exitCode = 1;
});
