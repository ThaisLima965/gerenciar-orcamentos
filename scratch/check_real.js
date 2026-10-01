import { initDatabase, db } from '../src/config/database.js';

async function checkRealUsers() {
  await initDatabase();
  const tkeUsers = db.prepare("SELECT * FROM usuarios WHERE email LIKE '%@tkelevator.com'").all();
  console.log('TKE users count:', tkeUsers.length);
  console.log('TKE users profiles:', tkeUsers.map(u => ({ id: u.id, nome: u.nome, email: u.email, matricula: u.matricula, perfil: u.perfil })));

  const fakeUsers = db.prepare("SELECT * FROM usuarios WHERE email NOT LIKE '%@tkelevator.com'").all();
  console.log('\nFake / Non-TKE users count:', fakeUsers.length);
  console.log('Fake / Non-TKE users:', fakeUsers.map(u => ({ id: u.id, nome: u.nome, email: u.email, matricula: u.matricula, perfil: u.perfil })));

  const fakeTecnicos = db.prepare("SELECT * FROM tecnicos WHERE email NOT LIKE '%@tkelevator.com' OR email IS NULL").all();
  console.log('\nFake tecnicos count:', fakeTecnicos.length);

  const fakeClientes = db.prepare("SELECT * FROM clientes WHERE numero_contrato LIKE 'CT-TEST%' OR numero_contrato LIKE 'CT-2024%'").all();
  console.log('\nClientes count:', fakeClientes.length);

  process.exit(0);
}

checkRealUsers();
