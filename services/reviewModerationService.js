/**
 * Review Moderation Service
 *
 * Provides auto-moderation for reviews including:
 * - Profanity detection
 * - Spam detection
 * - Quality score calculation
 * - Auto-flagging logic
 */

// Common profanity words (basic list - can be extended)
const PROFANITY_LIST = [
  // English
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'bastard', 'dick', 'pussy',
  // Hindi (transliterated)
  'chutiya', 'madarchod', 'bhenchod', 'gandu', 'bhosdike', 'lund', 'chut',
  'harami', 'kamina', 'kutti', 'randi', 'sala', 'saala', 'behenchod',
  // Add more as needed
];

// Spam patterns
const SPAM_PATTERNS = [
  /(.)\1{4,}/g,                    // Repeated characters (aaaaa)
  /(\b\w+\b)(\s+\1){2,}/gi,        // Repeated words
  /https?:\/\/[^\s]+/gi,           // URLs
  /[A-Z]{10,}/g,                   // Long caps
  /\b(buy|click|free|winner|prize|cash|money)\b/gi,  // Spam keywords
  /\b\d{10,}\b/g,                  // Phone numbers
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,  // Email addresses
];

/**
 * Check text for profanity
 * @param {string} text - Text to check
 * @returns {{ hasProfanity: boolean, words: string[] }}
 */
function checkForProfanity(text) {
  if (!text) return { hasProfanity: false, words: [] };

  const lowerText = text.toLowerCase();
  const foundWords = [];

  for (const word of PROFANITY_LIST) {
    // Check for whole word match
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(lowerText)) {
      foundWords.push(word);
    }
  }

  return {
    hasProfanity: foundWords.length > 0,
    words: foundWords,
  };
}

/**
 * Check text for spam patterns
 * @param {string} text - Text to check
 * @returns {{ isSpam: boolean, reason: string | null, patterns: string[] }}
 */
function checkForSpam(text) {
  if (!text) return { isSpam: false, reason: null, patterns: [] };

  const foundPatterns = [];

  // Check for repeated characters
  if (/(.)\1{4,}/g.test(text)) {
    foundPatterns.push('repeated_characters');
  }

  // Check for repeated words
  if (/(\b\w+\b)(\s+\1){2,}/gi.test(text)) {
    foundPatterns.push('repeated_words');
  }

  // Check for URLs
  if (/https?:\/\/[^\s]+/gi.test(text)) {
    foundPatterns.push('contains_urls');
  }

  // Check for excessive caps (more than 50% of text is uppercase)
  const capsCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 10 && capsCount / letterCount > 0.5) {
    foundPatterns.push('excessive_caps');
  }

  // Check for spam keywords
  const spamKeywords = ['buy now', 'click here', 'free money', 'winner', 'prize'];
  for (const keyword of spamKeywords) {
    if (text.toLowerCase().includes(keyword)) {
      foundPatterns.push('spam_keywords');
      break;
    }
  }

  // Check for phone numbers
  if (/\b\d{10,}\b/g.test(text)) {
    foundPatterns.push('phone_number');
  }

  // Check for email addresses
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g.test(text)) {
    foundPatterns.push('email_address');
  }

  const isSpam = foundPatterns.length > 0;
  const reason = isSpam ? foundPatterns[0] : null;

  return {
    isSpam,
    reason,
    patterns: foundPatterns,
  };
}

/**
 * Calculate quality score for a review
 * @param {Object} review - Review object
 * @returns {number} Quality score (0-100)
 */
function calculateQualityScore(review) {
  let score = 0;

  // Word count (max 30 points)
  const wordCount = review.comment ? review.comment.split(/\s+/).length : 0;
  if (wordCount >= 50) score += 30;
  else if (wordCount >= 20) score += 20;
  else if (wordCount >= 10) score += 10;

  // Has images (25 points)
  if (review.images && review.images.length > 0) score += 25;

  // Has detailed ratings (25 points)
  const hasDetailedRatings = !!(
    review.detailedRatings?.quality ||
    review.detailedRatings?.valueForMoney ||
    review.detailedRatings?.delivery ||
    review.detailedRatings?.accuracy
  );
  if (hasDetailedRatings) score += 25;

  // Has title (20 points)
  if (review.title && review.title.length >= 10) score += 20;

  return Math.min(score, 100);
}

/**
 * Auto-moderate a review
 * @param {Object} review - Review object with title and comment
 * @returns {{ isFlagged: boolean, flagReason: string | null, confidence: number }}
 */
function autoModerateReview(review) {
  const { title, comment } = review;
  const fullText = `${title || ''} ${comment || ''}`;

  // Check for profanity
  const profanityCheck = checkForProfanity(fullText);
  if (profanityCheck.hasProfanity) {
    return {
      isFlagged: true,
      flagReason: 'profanity',
      confidence: 0.95,
      details: { words: profanityCheck.words },
    };
  }

  // Check for spam
  const spamCheck = checkForSpam(fullText);
  if (spamCheck.isSpam) {
    return {
      isFlagged: true,
      flagReason: spamCheck.reason,
      confidence: 0.85,
      details: { patterns: spamCheck.patterns },
    };
  }

  // Check for suspicious patterns
  // Rating mismatch (e.g., 1 star with "great product" text)
  if (review.rating) {
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'perfect'];
    const negativeWords = ['terrible', 'worst', 'horrible', 'bad', 'awful', 'hate', 'disappointed', 'waste'];

    const lowerComment = comment?.toLowerCase() || '';

    const hasPositiveWords = positiveWords.some(word => lowerComment.includes(word));
    const hasNegativeWords = negativeWords.some(word => lowerComment.includes(word));

    // Low rating with positive words
    if (review.rating <= 2 && hasPositiveWords && !hasNegativeWords) {
      return {
        isFlagged: true,
        flagReason: 'rating_mismatch',
        confidence: 0.7,
        details: { ratingMismatch: 'positive_words_low_rating' },
      };
    }

    // High rating with negative words
    if (review.rating >= 4 && hasNegativeWords && !hasPositiveWords) {
      return {
        isFlagged: true,
        flagReason: 'rating_mismatch',
        confidence: 0.7,
        details: { ratingMismatch: 'negative_words_high_rating' },
      };
    }
  }

  // Not flagged
  return {
    isFlagged: false,
    flagReason: null,
    confidence: 0,
    details: {},
  };
}

/**
 * Sanitize review text (remove profanity with asterisks)
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (!text) return text;

  let sanitized = text;
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const replacement = word[0] + '*'.repeat(word.length - 2) + word[word.length - 1];
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}

/**
 * Get word count from text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
function getWordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Analyze sentiment (basic implementation)
 * @param {string} text - Text to analyze
 * @returns {{ sentiment: 'positive' | 'negative' | 'neutral', score: number }}
 */
function analyzeSentiment(text) {
  if (!text) return { sentiment: 'neutral', score: 0 };

  const positiveWords = [
    'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best',
    'perfect', 'awesome', 'good', 'nice', 'happy', 'satisfied', 'recommend',
    'quality', 'value', 'worth', 'beautiful', 'easy', 'fast',
  ];

  const negativeWords = [
    'terrible', 'worst', 'horrible', 'bad', 'awful', 'hate', 'disappointed',
    'waste', 'poor', 'slow', 'broken', 'defective', 'cheap', 'fake', 'scam',
    'fraud', 'useless', 'regret', 'return', 'refund',
  ];

  const lowerText = text.toLowerCase();

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveCount++;
  }

  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return { sentiment: 'neutral', score: 0 };

  const score = (positiveCount - negativeCount) / total;

  if (score > 0.3) return { sentiment: 'positive', score };
  if (score < -0.3) return { sentiment: 'negative', score };
  return { sentiment: 'neutral', score };
}

module.exports = {
  checkForProfanity,
  checkForSpam,
  calculateQualityScore,
  autoModerateReview,
  sanitizeText,
  getWordCount,
  analyzeSentiment,
  PROFANITY_LIST,
  SPAM_PATTERNS,
};
