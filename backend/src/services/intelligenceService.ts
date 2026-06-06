import { pipeline } from '@xenova/transformers';

let summarizer: any = null;
let classifier: any = null;

async function getSummarizer() {
  if (!summarizer) {
    console.log('⏳ [intelligenceService]: Initializing Xenova/distilbart-cnn-6-6 summarizer...');
    summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
    console.log('✅ [intelligenceService]: Summarizer initialized.');
  }
  return summarizer;
}

async function getClassifier() {
  if (!classifier) {
    console.log('⏳ [intelligenceService]: Initializing Xenova/mobilebert-uncased-mnli classifier...');
    classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
    console.log('✅ [intelligenceService]: Classifier initialized.');
  }
  return classifier;
}

export async function generateArticleIntelligence(
  article: any,
  perspectives: any[],
  timeline: any[]
): Promise<{
  industryImpact: { 
    benefited: { sector: string, reason: string }[]; 
    disadvantaged: { sector: string, reason: string }[];
  };
  synthesizedPerspectives: string;
  historicalContext: string;
}> {
  console.log(`🧠 [intelligenceService]: Generating intelligence for article ${article.id}`);
  
  // 1. Industry Impact (Zero-shot classification)
  const cl = await getClassifier();
  const textToAnalyze = `${article.title}. ${article.summary || article.content?.substring(0, 300) || ''}`;

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Energy', 'Automotive', 
    'Real Estate', 'Retail', 'Agriculture', 'Entertainment', 'Defense', 'Telecommunications',
    'Public Infrastructure', 'Tourism', 'Logistics', 'Education', 'Environment'
  ];

  const benefitedStrs: string[] = [];
  const disadvantagedStrs: string[] = [];

  const labels = [
    ...industries.map(i => `${i} industry benefited`),
    ...industries.map(i => `${i} industry disadvantaged`)
  ];

  try {
    const result = await cl(textToAnalyze, labels, { multi_label: true });
    
    for (let i = 0; i < result.labels.length; i++) {
      if (result.scores[i] > 0.5) { 
        const label = result.labels[i];
        if (label.endsWith('benefited')) {
          const ind = label.replace(' industry benefited', '');
          if (!benefitedStrs.includes(ind)) benefitedStrs.push(ind);
        } else if (label.endsWith('disadvantaged')) {
          const ind = label.replace(' industry disadvantaged', '');
          if (!disadvantagedStrs.includes(ind)) disadvantagedStrs.push(ind);
        }
      }
    }

    // Guarantee at least one AI projection for the UI graph
    if (benefitedStrs.length === 0) {
      const topB = result.labels.find((l: string) => l.endsWith('benefited'));
      if (topB) benefitedStrs.push(topB.replace(' industry benefited', ''));
    }
    if (disadvantagedStrs.length === 0) {
      const topD = result.labels.find((l: string) => l.endsWith('disadvantaged'));
      if (topD) disadvantagedStrs.push(topD.replace(' industry disadvantaged', ''));
    }
  } catch (error: any) {
    console.error(`❌ [intelligenceService]: Classification failed: ${error.message}`);
  }

  const generateSmartReason = (sector: string, title: string, isBenefited: boolean) => {
    const STOPWORDS = new Set(['this', 'that', 'with', 'from', 'your', 'have', 'more', 'about', 'will', 'than', 'what', 'when', 'were', 'been', 'would', 'their', 'there', 'some', 'other', 'into', 'over', 'also', 'only', 'amid', 'after', 'before']);
    const words = title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const keyTerms = words.filter(w => w.length > 4 && !STOPWORDS.has(w)).slice(0, 3);
    const termsStr = keyTerms.length > 0 ? keyTerms.join(', ') : 'recent market forces';
    
    if (isBenefited) {
        return `Local AI models project positive structural tailwinds for ${sector}, directly driven by factors involving ${termsStr}. Increased allocations and strategic focus on these areas present strong growth catalysts.`;
    } else {
        return `Local AI models project negative headwinds and operational disruption for ${sector}, triggered by cascading effects from ${termsStr}. This requires immediate adaptive measures.`;
    }
  };

  const benefited = benefitedStrs.map(sector => ({ sector, reason: generateSmartReason(sector, article.title, true) }));
  const disadvantaged = disadvantagedStrs.map(sector => ({ sector, reason: generateSmartReason(sector, article.title, false) }));

  // 2 & 3. Synthesized Perspectives and Historical Context (Summarization)
  const sum = await getSummarizer();

  let synthesizedPerspectives = "No alternative perspectives available.";
  const uniquePerspectives = perspectives.filter(p => p.id !== article.id);
  if (uniquePerspectives.length > 0) {
    const combinedPerspectives = uniquePerspectives.map(p => `${p.source} reports: ${p.title}.`).join(' ');
    const perspectiveInput = `Summarize these different news reports: ${combinedPerspectives}`.substring(0, 1024);
    try {
      const pSummary = await sum(perspectiveInput, { max_new_tokens: 60 });
      synthesizedPerspectives = pSummary[0].summary_text;
    } catch (e: any) {
      console.error(`❌ [intelligenceService]: Perspectives summarization failed: ${e.message}`);
      synthesizedPerspectives = "Could not synthesize perspectives.";
    }
  } else {
      synthesizedPerspectives = "This appears to be an exclusive report with no alternative coverage detected yet.";
  }

  let historicalContext = "No historical connections available.";
  const pastTimeline = timeline.filter(t => t.id !== article.id && new Date(t.publishedAt) < new Date(article.publishedAt));
  if (pastTimeline.length > 0) {
    const combinedTimeline = pastTimeline.map(t => `${new Date(t.publishedAt).toISOString().split('T')[0]}: ${t.title}`).join('. ');
    const timelineInput = `Summarize this historical timeline of events: ${combinedTimeline}`.substring(0, 1024);
    try {
      const tSummary = await sum(timelineInput, { max_new_tokens: 60 });
      historicalContext = tSummary[0].summary_text;
    } catch (e: any) {
      console.error(`❌ [intelligenceService]: Timeline summarization failed: ${e.message}`);
      historicalContext = "Could not synthesize historical context.";
    }
  } else {
      historicalContext = "This is a breaking development with no prior history tracked in our system.";
  }

  console.log(`✅ [intelligenceService]: Intelligence generation complete for ${article.id}`);

  return {
    industryImpact: { benefited, disadvantaged },
    synthesizedPerspectives,
    historicalContext
  };
}

export async function classifyArticleImpact(text: string): Promise<'positive' | 'negative' | 'neutral'> {
  const cl = await getClassifier();
  try {
    const result = await cl(text.substring(0, 500), ['positive impact', 'negative impact', 'neutral impact']);
    const topLabel = result.labels[0];
    if (topLabel === 'positive impact') return 'positive';
    if (topLabel === 'negative impact') return 'negative';
    return 'neutral';
  } catch (error) {
    return 'neutral';
  }
}
