"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateArticleIntelligence = generateArticleIntelligence;
exports.classifyArticleImpact = classifyArticleImpact;
const transformers_1 = require("@xenova/transformers");
let summarizer = null;
let classifier = null;
async function getSummarizer() {
    if (!summarizer) {
        console.log('⏳ [intelligenceService]: Initializing Xenova/distilbart-cnn-6-6 summarizer...');
        summarizer = await (0, transformers_1.pipeline)('summarization', 'Xenova/distilbart-cnn-6-6');
        console.log('✅ [intelligenceService]: Summarizer initialized.');
    }
    return summarizer;
}
async function getClassifier() {
    if (!classifier) {
        console.log('⏳ [intelligenceService]: Initializing Xenova/mobilebert-uncased-mnli classifier...');
        classifier = await (0, transformers_1.pipeline)('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
        console.log('✅ [intelligenceService]: Classifier initialized.');
    }
    return classifier;
}
async function generateArticleIntelligence(article, perspectives, timeline) {
    console.log(`🧠 [intelligenceService]: Generating intelligence for article ${article.id}`);
    // 1. Industry Impact (Zero-shot classification)
    const cl = await getClassifier();
    const textToAnalyze = `${article.title}. ${article.summary || article.content?.substring(0, 300) || ''}`;
    const industries = [
        'Technology', 'Healthcare', 'Finance', 'Energy', 'Automotive',
        'Real Estate', 'Retail', 'Agriculture', 'Entertainment', 'Defense', 'Telecommunications'
    ];
    const benefited = [];
    const disadvantaged = [];
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
                    if (!benefited.includes(ind))
                        benefited.push(ind);
                }
                else if (label.endsWith('disadvantaged')) {
                    const ind = label.replace(' industry disadvantaged', '');
                    if (!disadvantaged.includes(ind))
                        disadvantaged.push(ind);
                }
            }
        }
        if (benefited.length === 0 && disadvantaged.length === 0 && result.scores[0] > 0.35) {
            const label = result.labels[0];
            if (label.endsWith('benefited'))
                benefited.push(label.replace(' industry benefited', ''));
            else
                disadvantaged.push(label.replace(' industry disadvantaged', ''));
        }
    }
    catch (error) {
        console.error(`❌ [intelligenceService]: Classification failed: ${error.message}`);
    }
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
        }
        catch (e) {
            console.error(`❌ [intelligenceService]: Perspectives summarization failed: ${e.message}`);
            synthesizedPerspectives = "Could not synthesize perspectives.";
        }
    }
    else {
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
        }
        catch (e) {
            console.error(`❌ [intelligenceService]: Timeline summarization failed: ${e.message}`);
            historicalContext = "Could not synthesize historical context.";
        }
    }
    else {
        historicalContext = "This is a breaking development with no prior history tracked in our system.";
    }
    console.log(`✅ [intelligenceService]: Intelligence generation complete for ${article.id}`);
    return {
        industryImpact: { benefited, disadvantaged },
        synthesizedPerspectives,
        historicalContext
    };
}
async function classifyArticleImpact(text) {
    const cl = await getClassifier();
    try {
        const result = await cl(text.substring(0, 500), ['positive impact', 'negative impact', 'neutral impact']);
        const topLabel = result.labels[0];
        if (topLabel === 'positive impact')
            return 'positive';
        if (topLabel === 'negative impact')
            return 'negative';
        return 'neutral';
    }
    catch (error) {
        return 'neutral';
    }
}
