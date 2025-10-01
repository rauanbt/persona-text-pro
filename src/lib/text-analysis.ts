// Text analysis utilities for AI detection scoring
export interface TextAnalysis {
  complexity: number;
  repetition: number;
  formality: number;
  diversity: number;
  structure: number;
}

export function analyzeText(text: string): TextAnalysis {
  const words: string[] = text.toLowerCase().match(/\b\w+\b/g) || [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Analyze vocabulary diversity (AI tends to have lower diversity)
  const uniqueWords = new Set(words);
  const diversity = words.length > 0 ? uniqueWords.size / words.length : 0;
  
  // Analyze sentence length consistency (AI tends to have more uniform sentences)
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / (sentenceLengths.length || 1);
  
  // Calculate variance in sentence length
  const lengthVariance = sentenceLengths.reduce((sum, len) => 
    sum + Math.pow(len - avgSentenceLength, 2), 0) / (sentenceLengths.length || 1);
  
  // AI typically has variance < 20, human writing > 50
  const structure = lengthVariance < 20 ? 0.8 : lengthVariance < 50 ? 0.5 : 0.2;
  
  // Analyze repetitive patterns (more sophisticated)
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    if (word.length > 3) { // Only count meaningful words
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });
  
  const overusedWords = Object.values(wordCounts).filter(count => count > 4).length;
  const repetition = words.length > 0 ? overusedWords / (uniqueWords.size || 1) : 0;
  
  // Enhanced formality analysis (AI tends to be overly formal)
  const formalWords = [
    'furthermore', 'therefore', 'consequently', 'additionally', 'moreover',
    'specifically', 'particularly', 'essentially', 'ultimately', 'subsequently',
    'nevertheless', 'notwithstanding', 'henceforth', 'heretofore', 'aforementioned',
    'delve', 'leverage', 'utilize', 'facilitate', 'implement', 'comprehensive',
    'robust', 'seamless', 'synergy', 'paradigm', 'holistic', 'optimize'
  ];
  
  // AI cliché phrases
  const aiPhrases = ['in conclusion', 'in summary', 'to summarize', 'it is important to note',
    'it should be noted', 'in other words', 'as a result', 'in today\'s world'];
  
  const formalCount = words.filter(word => formalWords.includes(word)).length;
  const phraseCount = aiPhrases.filter(phrase => text.toLowerCase().includes(phrase)).length;
  
  const formality = words.length > 0 ? 
    (formalCount / words.length) * 0.7 + (phraseCount / sentences.length) * 0.3 : 0;
  
  // Text complexity based on length and structure
  const avgWordLength = words.length > 0 
    ? words.reduce((sum: number, w) => sum + w.length, 0) / words.length
    : 0;
  const complexity = Math.min(1, text.length / 1000) * 0.5 + 
    (avgSentenceLength > 20 ? 0.3 : 0) + 
    (avgWordLength > 6 ? 0.2 : 0);
  
  return {
    complexity,
    repetition,
    formality,
    diversity,
    structure
  };
}

export function calculateAIScore(analysis: TextAnalysis): number {
  // More sophisticated base score calculation
  let score = 30; // Start with moderate baseline
  
  // Weighted factors (more realistic than simple addition)
  score += analysis.structure * 28; // Uniform sentence structure (strong indicator)
  score += analysis.formality * 22; // Formal/cliché language (strong indicator)
  score += analysis.repetition * 15; // Repetitive word usage
  score += (1 - analysis.diversity) * 18; // Low lexical diversity (strong indicator)
  score += analysis.complexity * 12; // Complexity can indicate AI polish
  
  // Add controlled randomness (±10 points)
  score += (Math.random() - 0.5) * 20;
  
  // Human writing tends to be more chaotic - if metrics are too perfect, boost score
  const metricsVariance = Math.abs(analysis.structure - 0.5) + 
                          Math.abs(analysis.formality - 0.3) + 
                          Math.abs(analysis.diversity - 0.6);
  
  if (metricsVariance < 0.3) {
    score += 12; // Too consistent = likely AI
  }
  
  return Math.max(15, Math.min(90, Math.floor(score)));
}

export const detectorProfiles = {
  gptzero: {
    sensitivity: 1.2, // More sensitive to AI patterns
    bias: 5, // Tends to score higher
    variance: 8
  },
  originality: {
    sensitivity: 1.0, // Balanced
    bias: 0,
    variance: 10
  },
  copyleaks: {
    sensitivity: 0.8, // More conservative
    bias: -3, // Tends to score lower
    variance: 12
  },
  zerogpt: {
    sensitivity: 1.1, // Slightly sensitive
    bias: 3, // Tends to score higher
    variance: 12
  },
  writer: {
    sensitivity: 0.9, // Focus on professional writing
    bias: 2,
    variance: 15
  }
};

export function getDetectorScore(baseScore: number, detectorId: keyof typeof detectorProfiles): number {
  const profile = detectorProfiles[detectorId];
  let score = baseScore * profile.sensitivity + profile.bias;
  
  // Add detector-specific variance
  score += (Math.random() - 0.5) * profile.variance;
  
  return Math.max(5, Math.min(98, Math.floor(score)));
}
