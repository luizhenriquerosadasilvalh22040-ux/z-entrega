/**
 * Utilitário para definir/atualizar a senha de um Customer no banco de dados.
 * 
 * Uso:
 *   npx ts-node src/utils/set-customer-password.ts <telefone_ou_email> <nova_senha>
 * 
 * Exemplos:
 *   npx ts-node src/utils/set-customer-password.ts 5515988218568 minhaSenha123
 *   npx ts-node src/utils/set-customer-password.ts boldeler2@gmail.com minhaSenha123
 */
import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/prisma';
import bcrypt from 'bcrypt';
import { normalizePhone } from './phone';

async function main() {
  const identifier = process.argv[2];
  const newPassword = process.argv[3];

  if (!identifier || !newPassword) {
    console.error('❌ Uso: npx ts-node src/utils/set-customer-password.ts <telefone_ou_email> <nova_senha>');
    process.exit(1);
  }

  const isEmail = identifier.includes('@');
  const normalizedPhone = isEmail ? '' : normalizePhone(identifier);

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { email: isEmail ? identifier : undefined },
        { phone: isEmail ? undefined : normalizedPhone }
      ]
    }
  });

  if (!customer) {
    console.error(`❌ Cliente não encontrado para o identificador: ${identifier}`);
    process.exit(1);
  }

  console.log(`📋 Cliente encontrado:`);
  console.log(`   ID: ${customer.id}`);
  console.log(`   Nome: ${customer.name}`);
  console.log(`   E-mail: ${customer.email}`);
  console.log(`   Telefone: ${customer.phone}`);
  console.log(`   Tinha senha antes? ${customer.passwordHash ? 'Sim' : 'Não'}`);

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash }
  });

  console.log(`\n✅ Senha atualizada com sucesso para o cliente "${customer.name}".`);
}

main()
  .catch(err => {
    console.error('❌ Erro ao executar o script:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
