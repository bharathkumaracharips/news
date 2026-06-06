import { generateEmbedding, cosineSimilarity } from './src/services/embeddingService';
import prisma from './src/config/db';

async function main() {
  // Get an article
  const a1 = await prisma.article.findFirst({
    where: { title: { contains: 'RBI keeps repo rate unchanged' } }
  });
  
  const a2 = await prisma.article.findFirst({
    where: { title: { contains: 'repo rate unchanged' }, id: { not: a1?.id } }
  });

  if (!a1 || !a2) {
    console.log("Articles not found");
    return;
  }

  console.log("Article 1:", a1.title);
  console.log("Article 2:", a2.title);

  const e1 = await generateEmbedding(a1.title + ' — ' + (a1.summary || ''));
  const e2 = await generateEmbedding(a2.title + ' — ' + (a2.summary || ''));

  const sim = cosineSimilarity(e1, e2);
  console.log("Similarity:", sim);
}

main().catch(console.error).finally(() => process.exit(0));
