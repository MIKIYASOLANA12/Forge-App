(async ()=>{
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const email = process.argv[2];
  if (!email) { console.error('Usage: node checkResetToken.js <email>'); process.exit(2) }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.log('FOUND_USER:false'); await prisma.$disconnect(); process.exit(0) }
  const token = await prisma.authToken.findFirst({ where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null }, orderBy: { createdAt: 'desc' } });
  console.log('FOUND_USER:true');
  console.log('RESET_TOKEN_CREATED:' + (token ? 'yes' : 'no'));
  await prisma.$disconnect();
})();
