/**
 * Upsert ISO country reference rows only — safe for live.
 * Run: npm run seed:countries --workspace=@npha/database
 */
import { PrismaClient } from '@prisma/client';
import { COUNTRIES } from './countries-data.js';

const prisma = new PrismaClient();

async function main() {
  for (const c of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, code2: c.code2 },
      create: { code: c.code, code2: c.code2, name: c.name },
    });
  }
  console.log(`✓ ${COUNTRIES.length} countries upserted`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
