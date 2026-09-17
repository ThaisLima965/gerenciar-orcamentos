import { initDatabase, db } from '../src/config/database.js';

await initDatabase();

console.log('CLIENTES COUNT:', db.prepare('SELECT COUNT(*) as c FROM clientes').get());
console.log('CLIENTES:', db.prepare('SELECT * FROM clientes').all());

console.log('TECNICOS COUNT:', db.prepare('SELECT COUNT(*) as c FROM tecnicos').get());
console.log('TECNICOS:', db.prepare('SELECT matricula, funcao, nome_sobrenome, email FROM tecnicos').all());

console.log('USUARIOS COUNT:', db.prepare('SELECT COUNT(*) as c FROM usuarios').get());
console.log('USUARIOS:', db.prepare('SELECT id, matricula, nome, perfil, email, grupo, ativo FROM usuarios').all());

console.log('ORCAMENTOS COUNT:', db.prepare('SELECT COUNT(*) as c FROM chamados_orcamentos').get());
console.log('ORCAMENTOS:', db.prepare('SELECT id, matricula_tecnico, nome_tecnico, numero_pgo, nome_cliente, valor_total FROM chamados_orcamentos').all());
