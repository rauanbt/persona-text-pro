// Text analysis utilities for AI detection scoring
export interface TextAnalysis {
  complexity: number;
  repetition: number;
  formality: number;
  diversity: number;
  structure: number;
}

export function analyzeText(text: string): TextAnalysis {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Analyze vocabulary diversity
  const uniqueWords = new Set(words);
  const diversity = words.length > 0 ? uniqueWords.size / words.length : 0;
  
  // Analyze sentence length consistency (AI tends to have more uniform sentences)
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length || 0;
  const lengthVariation = sentenceLengths.reduce((sum, len) => sum + Math.abs(len - avgSentenceLength), 0) / sentenceLengths.length || 0;
  const structure = lengthVariation < 3 ? 0.8 : lengthVariation < 6 ? 0.5 : 0.2; // Lower variation = more AI-like
  
  // Analyze repetitive patterns
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  const repetitiveWords = Object.values(wordCounts).filter(count => count > 3).length;
  const repetition = words.length > 0 ? repetitiveWords / uniqueWords.size : 0;
  
  // Analyze formality (AI tends to be more formal)
  const formalWords = ['furthermore', 'therefore', 'consequently', 'additionally', 'moreover', 'specifically', 'particularly', 'essentially', 'ultimately', 'subsequently'];
  const formalCount = words.filter(word => formalWords.includes(word)).length;
  const formality = words.length > 0 ? formalCount / words.length : 0;
  
  // Text complexity based on length and sentence structure
  const complexity = Math.min(1, text.length / 1000) * 0.7 + (avgSentenceLength > 20 ? 0.3 : 0);
  
  return {
    complexity,
    repetition,
    formality,
    diversity,
    structure
  };
}

export function calculateAIScore(analysis: TextAnalysis): number {
  // Base score starts lower (more realistic)
  let score = 25 + Math.random() * 20; // 25-45 base
  
  // Add points for AI-like characteristics
  score += analysis.structure * 30; // Uniform sentence structure
  score += analysis.formality * 25; // Formal language
  score += analysis.repetition * 20; // Repetitive patterns
  score += analysis.complexity * 15; // High complexity
  score += (1 - analysis.diversity) * 10; // Low diversity
  
  // Add some randomness but keep it realistic
  score += (Math.random() - 0.5) * 15;
  
  return Math.max(10, Math.min(95, Math.floor(score)));
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
