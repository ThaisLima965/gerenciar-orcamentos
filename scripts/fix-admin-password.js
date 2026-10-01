import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../database/database.sqlite');

async function fixPassword() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const sqlDb = new SQL.Database(fileBuffer);

  const hash = bcrypt.hashSync('Senha@12345', 10);
  console.log('Generated hash for Senha@12345:', hash);

  sqlDb.run(
    'INSERT OR REPLACE INTO usuarios (id, nome, email, matricula, senha_hash, perfil, ativo, primeiro_acesso, grupo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      1,
      'Camila Mendes (Consultora Admin)',
      'consultora@empresa.com',
      'CONS001',
      hash,
      'CONSULTORA',
      1,
      0,
      'G11'
    ]
  );

  const data = sqlDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));

  // Test match
  const res = sqlDb.exec("SELECT email, senha_hash, ativo FROM usuarios WHERE email = 'consultora@empresa.com'");
  const row = res[0].values[0];
  console.log('User in DB:', row[0], 'Active:', row[2]);
  console.log('Password match test:', bcrypt.compareSync('Senha@12345', row[1]));
}

fixPassword().catch(console.error);
