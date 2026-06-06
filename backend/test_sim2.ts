import { generateEmbedding, cosineSimilarity } from './src/services/embeddingService';

async function testSim(t1: string, t2: string) {
  const e1 = await generateEmbedding(t1);
  const e2 = await generateEmbedding(t2);
  console.log(`Sim: ${cosineSimilarity(e1, e2).toFixed(3)} | "${t1}" vs "${t2}"`);
}

async function main() {
  await testSim(
    "Kerala HC rejects CMRL appeal, allows ED to continue probe linked to Pinarayi’s daughter T. Veena",
    "CMRL appeal rejected by High Court in Veena case"
  );
  await testSim(
    "Kerala's Plus One admissions see 4.44 lakh applications",
    "Kerala HC rejects CMRL appeal, allows ED to continue probe linked to Pinarayi’s daughter T. Veena"
  );
  await testSim(
    "Display fee structure at entrance by June 5, private scho...",
    "Kerala's Plus One admissions see 4.44 lakh applications"
  );
  await testSim(
    "Narendra Modi to take oath as PM for 3rd term on June 9",
    "Modi swearing-in ceremony scheduled for Sunday evening"
  );
}

main().catch(console.error).finally(() => process.exit(0));
