import prisma from './src/config/db';

async function main() {
  const referenceArticle = await prisma.article.findFirst({
    where: { title: { contains: 'Kerala HC rejects CMRL' } }
  });

  if (!referenceArticle) return;

  const matchedArticles = await prisma.article.findMany({
    where: {
      eventId: referenceArticle.eventId
    },
    orderBy: { publishedAt: 'asc' }
  });

  console.log(`Timeline for: ${referenceArticle.title}`);
  for (const a of matchedArticles) {
    console.log(`- ${a.title} (${a.source})`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
