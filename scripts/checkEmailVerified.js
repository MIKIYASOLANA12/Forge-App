(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const email = process.argv[2];
  if (!email) { console.error('Usage: node checkEmailVerified.js <email>'); process.exit(2) }
  const user = await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } });
  console.log(JSON.stringify({ email, emailVerified: user ? user.emailVerified : null }));
  await prisma.$disconnect();
})();
