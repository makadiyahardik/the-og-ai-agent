import { supabase } from '../supabase';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Constants
const CODE_REVIEW_MODEL = 'llama-3.3-70b-versatile';
const MAX_DIFF_LENGTH = 50000; // Limit diff size for API

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const CODE_REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer with deep knowledge of software engineering best practices. Your role is to analyze code diffs and identify:

1. **Bugs and Logic Errors**: Null pointer exceptions, off-by-one errors, race conditions, incorrect logic flow
2. **Security Vulnerabilities**: SQL injection, XSS, insecure authentication, exposed secrets, CSRF
3. **Performance Issues**: N+1 queries, memory leaks, inefficient algorithms, unnecessary re-renders
4. **Style Violations**: Inconsistent naming, poor code organization, missing documentation
5. **Missing Error Handling**: Uncaught exceptions, missing validation, no fallback handling

Respond ONLY with valid JSON in this exact format:
{
  "issues": [
    {
      "type": "bug|security|performance|style|error_handling",
      "severity": "critical|high|medium|low",
      "line": <number or null>,
      "file": "<filename or null>",
      "title": "<brief title>",
      "description": "<detailed explanation>",
      "suggestion": "<how to fix>"
    }
  ],
  "summary": "<2-3 sentence overall assessment>"
}`;

const SUGGESTION_SYSTEM_PROMPT = `You are an expert software engineer. Given a list of code issues, generate specific, actionable fix suggestions with code examples when appropriate.

Respond ONLY with valid JSON in this exact format:
{
  "suggestions": [
    {
      "issueIndex": <number>,
      "priority": "immediate|soon|later",
      "fix": "<detailed fix description>",
      "codeExample": "<optional code snippet showing the fix>"
    }
  ]
}`;

const CUSTOM_RULES_SYSTEM_PROMPT = `You are a code review assistant. Check the provided code diff against custom team rules and report any violations.

Respond ONLY with valid JSON in this exact format:
{
  "violations": [
    {
      "ruleId": "<id of violated rule>",
      "ruleName": "<name of the rule>",
      "line": <number or null>,
      "file": "<filename or null>",
      "description": "<how the code violates the rule>",
      "suggestion": "<how to fix>"
    }
  ]
}`;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate that Groq client is available
 */
function ensureGroqClient() {
  if (!groq) {
    throw new Error('Groq API key not configured. Set GROQ_API_KEY environment variable.');
  }
  return groq;
}

/**
 * Parse JSON response from AI, with fallback handling
 */
function parseAIResponse(content, defaultValue = {}) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return defaultValue;
  } catch (error) {
    console.error('Failed to parse AI response:', error.message);
    return defaultValue;
  }
}

/**
 * Truncate diff if too long
 */
function truncateDiff(diff, maxLength = MAX_DIFF_LENGTH) {
  if (diff.length <= maxLength) {
    return diff;
  }
  const truncated = diff.substring(0, maxLength);
  return truncated + '\n\n... [DIFF TRUNCATED - Too large for analysis]';
}

/**
 * Extract file names from diff
 */
function extractFilesFromDiff(diff) {
  const files = [];
  const filePattern = /^(?:diff --git a\/(.+?) b\/|(?:\+\+\+|---) [ab]\/(.+?)$)/gm;
  let match;

  while ((match = filePattern.exec(diff)) !== null) {
    const file = match[1] || match[2];
    if (file && !files.includes(file)) {
      files.push(file);
    }
  }

  return files;
}

// ============================================================================
// REPO MANAGEMENT
// ============================================================================

/**
 * Add a repository to track for a user
 * @param {string} userId - The user's ID
 * @param {string} repoUrl - The repository URL (GitHub, GitLab, etc.)
 * @returns {Promise<Object>} The created repo record
 */
export async function addRepo(userId, repoUrl) {
  if (!userId || !repoUrl) {
    throw new Error('userId and repoUrl are required');
  }

  // Validate URL format
  const urlPattern = /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w-]+\/[\w.-]+\/?$/i;
  if (!urlPattern.test(repoUrl)) {
    throw new Error('Invalid repository URL. Supported: GitHub, GitLab, Bitbucket');
  }

  // Extract repo info from URL
  const urlParts = new URL(repoUrl);
  const pathParts = urlParts.pathname.split('/').filter(Boolean);
  const owner = pathParts[0];
  const name = pathParts[1]?.replace(/\.git$/, '');
  const provider = urlParts.hostname.replace('.com', '').replace('.org', '');

  const { data, error } = await supabase
    .from('prpilot_repos')
    .insert({
      user_id: userId,
      url: repoUrl,
      owner,
      name,
      provider,
      status: 'pending',
      indexed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Repository already added');
    }
    throw new Error(`Failed to add repository: ${error.message}`);
  }

  return data;
}

/**
 * Remove a repository
 * @param {string} repoId - The repository ID
 * @returns {Promise<boolean>} Success status
 */
export async function removeRepo(repoId) {
  if (!repoId) {
    throw new Error('repoId is required');
  }

  // First delete related reviews
  await supabase
    .from('prpilot_reviews')
    .delete()
    .eq('repo_id', repoId);

  const { error } = await supabase
    .from('prpilot_repos')
    .delete()
    .eq('id', repoId);

  if (error) {
    throw new Error(`Failed to remove repository: ${error.message}`);
  }

  return true;
}

/**
 * Get all repositories for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} List of repositories
 */
export async function getRepos(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const { data, error } = await supabase
    .from('prpilot_repos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch repositories: ${error.message}`);
  }

  return data || [];
}

/**
 * Start indexing a repository (placeholder for future implementation)
 * @param {string} repoId - The repository ID
 * @returns {Promise<Object>} Indexing job status
 */
export async function indexRepo(repoId) {
  if (!repoId) {
    throw new Error('repoId is required');
  }

  // Update status to indexing
  const { data, error } = await supabase
    .from('prpilot_repos')
    .update({
      status: 'indexing',
      updated_at: new Date().toISOString()
    })
    .eq('id', repoId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to start indexing: ${error.message}`);
  }

  // TODO: Implement actual indexing logic
  // This would typically:
  // 1. Clone or fetch the repository
  // 2. Parse and analyze code structure
  // 3. Build embeddings for semantic search
  // 4. Store metadata for context

  // For now, simulate completion after a delay
  setTimeout(async () => {
    await supabase
      .from('prpilot_repos')
      .update({
        status: 'indexed',
        indexed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', repoId);
  }, 5000);

  return {
    repoId,
    status: 'indexing',
    message: 'Repository indexing started. This may take a few minutes.'
  };
}

// ============================================================================
// CODE REVIEW
// ============================================================================

/**
 * Review a pull request using AI
 * @param {string} repoId - The repository ID
 * @param {number} prNumber - The PR number
 * @param {string} diff - The PR diff content
 * @returns {Promise<Object>} The review results
 */
export async function reviewPR(repoId, prNumber, diff) {
  if (!repoId || !prNumber || !diff) {
    throw new Error('repoId, prNumber, and diff are required');
  }

  const client = ensureGroqClient();

  // Get repo info for context
  const { data: repo, error: repoError } = await supabase
    .from('prpilot_repos')
    .select('*')
    .eq('id', repoId)
    .single();

  if (repoError || !repo) {
    throw new Error('Repository not found');
  }

  // Get user's custom rules
  const { data: rules } = await supabase
    .from('prpilot_rules')
    .select('*')
    .eq('user_id', repo.user_id)
    .eq('enabled', true);

  const repoContext = {
    name: repo.name,
    owner: repo.owner,
    provider: repo.provider
  };

  // Analyze the diff
  const truncatedDiff = truncateDiff(diff);
  const issues = await analyzeDiff(truncatedDiff, repoContext);

  // Check custom rules if any exist
  let ruleViolations = [];
  if (rules && rules.length > 0) {
    ruleViolations = await checkCustomRules(truncatedDiff, rules);
  }

  // Generate suggestions
  const suggestions = await generateSuggestions(issues);

  // Calculate score
  const score = calculateScore(issues);

  // Extract affected files
  const files = extractFilesFromDiff(diff);

  // Create review record
  const { data: review, error: reviewError } = await supabase
    .from('prpilot_reviews')
    .insert({
      repo_id: repoId,
      user_id: repo.user_id,
      pr_number: prNumber,
      status: 'completed',
      score,
      issues,
      suggestions,
      rule_violations: ruleViolations,
      files_reviewed: files,
      diff_size: diff.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (reviewError) {
    throw new Error(`Failed to save review: ${reviewError.message}`);
  }

  return review;
}

/**
 * Get a specific review by ID
 * @param {string} reviewId - The review ID
 * @returns {Promise<Object>} The review record
 */
export async function getReview(reviewId) {
  if (!reviewId) {
    throw new Error('reviewId is required');
  }

  const { data, error } = await supabase
    .from('prpilot_reviews')
    .select(`
      *,
      prpilot_repos (
        id,
        name,
        owner,
        provider,
        url
      )
    `)
    .eq('id', reviewId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch review: ${error.message}`);
  }

  return data;
}

/**
 * Get recent reviews for a user
 * @param {string} userId - The user's ID
 * @param {number} limit - Maximum number of reviews to return
 * @returns {Promise<Array>} List of reviews
 */
export async function getReviews(userId, limit = 20) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const { data, error } = await supabase
    .from('prpilot_reviews')
    .select(`
      *,
      prpilot_repos (
        id,
        name,
        owner,
        provider
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch reviews: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

/**
 * Analyze a diff to find issues
 * @param {string} diff - The code diff
 * @param {Object} repoContext - Repository context information
 * @returns {Promise<Array>} List of issues found
 */
export async function analyzeDiff(diff, repoContext = {}) {
  if (!diff) {
    throw new Error('diff is required');
  }

  const client = ensureGroqClient();

  const contextInfo = repoContext.name
    ? `Repository: ${repoContext.owner}/${repoContext.name} (${repoContext.provider})\n\n`
    : '';

  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: CODE_REVIEW_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${contextInfo}Please review this code diff and identify any issues:\n\n\`\`\`diff\n${diff}\n\`\`\``
        }
      ],
      model: CODE_REVIEW_MODEL,
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 4096
    });

    const content = completion.choices[0]?.message?.content || '';
    const result = parseAIResponse(content, { issues: [], summary: '' });

    return result.issues || [];
  } catch (error) {
    console.error('AI analysis failed:', error.message);
    throw new Error(`Failed to analyze diff: ${error.message}`);
  }
}

/**
 * Generate fix suggestions for issues
 * @param {Array} issues - List of issues to generate suggestions for
 * @returns {Promise<Array>} List of suggestions
 */
export async function generateSuggestions(issues) {
  if (!issues || issues.length === 0) {
    return [];
  }

  const client = ensureGroqClient();

  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: SUGGESTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate fix suggestions for these issues:\n\n${JSON.stringify(issues, null, 2)}`
        }
      ],
      model: CODE_REVIEW_MODEL,
      temperature: 0.4,
      max_tokens: 3000
    });

    const content = completion.choices[0]?.message?.content || '';
    const result = parseAIResponse(content, { suggestions: [] });

    return result.suggestions || [];
  } catch (error) {
    console.error('Failed to generate suggestions:', error.message);
    // Return basic suggestions derived from issues
    return issues.map((issue, index) => ({
      issueIndex: index,
      priority: issue.severity === 'critical' ? 'immediate' :
                issue.severity === 'high' ? 'soon' : 'later',
      fix: issue.suggestion || 'Review and address this issue.',
      codeExample: null
    }));
  }
}

/**
 * Calculate a quality score based on issues found
 * @param {Array} issues - List of issues
 * @returns {number} Score from 1-10
 */
export function calculateScore(issues) {
  if (!issues || issues.length === 0) {
    return 10; // Perfect score if no issues
  }

  // Deduction weights by severity
  const weights = {
    critical: 3.0,
    high: 2.0,
    medium: 1.0,
    low: 0.5
  };

  // Type multipliers (security and bugs are more severe)
  const typeMultipliers = {
    security: 1.5,
    bug: 1.3,
    performance: 1.0,
    error_handling: 0.9,
    style: 0.6
  };

  let totalDeduction = 0;

  for (const issue of issues) {
    const severityWeight = weights[issue.severity] || 1;
    const typeMultiplier = typeMultipliers[issue.type] || 1;
    totalDeduction += severityWeight * typeMultiplier;
  }

  // Calculate score (start at 10, deduct based on issues)
  // Cap deduction to avoid negative scores
  const maxDeduction = 9; // Minimum score of 1
  const normalizedDeduction = Math.min(totalDeduction, maxDeduction);
  const score = 10 - normalizedDeduction;

  // Round to one decimal place
  return Math.round(score * 10) / 10;
}

/**
 * Check diff against custom rules
 * @param {string} diff - The code diff
 * @param {Array} rules - List of custom rules to check
 * @returns {Promise<Array>} List of rule violations
 */
export async function checkCustomRules(diff, rules) {
  if (!diff || !rules || rules.length === 0) {
    return [];
  }

  const client = ensureGroqClient();

  // Format rules for the prompt
  const rulesDescription = rules.map(rule =>
    `- ID: ${rule.id}, Name: "${rule.name}", Rule: "${rule.pattern}", Description: "${rule.description || 'No description'}"`
  ).join('\n');

  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: 'system', content: CUSTOM_RULES_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Check this diff against these custom rules:\n\nRules:\n${rulesDescription}\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``
        }
      ],
      model: CODE_REVIEW_MODEL,
      temperature: 0.2, // Very low temperature for rule checking
      max_tokens: 2000
    });

    const content = completion.choices[0]?.message?.content || '';
    const result = parseAIResponse(content, { violations: [] });

    return result.violations || [];
  } catch (error) {
    console.error('Failed to check custom rules:', error.message);
    return [];
  }
}

// ============================================================================
// RULES MANAGEMENT
// ============================================================================

/**
 * Create a new custom rule
 * @param {string} userId - The user's ID
 * @param {Object} rule - The rule definition
 * @returns {Promise<Object>} The created rule
 */
export async function createRule(userId, rule) {
  if (!userId || !rule) {
    throw new Error('userId and rule are required');
  }

  if (!rule.name || !rule.pattern) {
    throw new Error('Rule must have a name and pattern');
  }

  const { data, error } = await supabase
    .from('prpilot_rules')
    .insert({
      user_id: userId,
      name: rule.name,
      pattern: rule.pattern,
      description: rule.description || null,
      severity: rule.severity || 'medium',
      category: rule.category || 'custom',
      enabled: rule.enabled !== false, // Default to enabled
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create rule: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing rule
 * @param {string} ruleId - The rule ID
 * @param {Object} updates - The fields to update
 * @returns {Promise<Object>} The updated rule
 */
export async function updateRule(ruleId, updates) {
  if (!ruleId || !updates) {
    throw new Error('ruleId and updates are required');
  }

  // Only allow specific fields to be updated
  const allowedFields = ['name', 'pattern', 'description', 'severity', 'category', 'enabled'];
  const sanitizedUpdates = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      sanitizedUpdates[field] = updates[field];
    }
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  sanitizedUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('prpilot_rules')
    .update(sanitizedUpdates)
    .eq('id', ruleId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update rule: ${error.message}`);
  }

  return data;
}

/**
 * Delete a rule
 * @param {string} ruleId - The rule ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRule(ruleId) {
  if (!ruleId) {
    throw new Error('ruleId is required');
  }

  const { error } = await supabase
    .from('prpilot_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    throw new Error(`Failed to delete rule: ${error.message}`);
  }

  return true;
}

/**
 * Get all rules for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} List of rules
 */
export async function getRules(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const { data, error } = await supabase
    .from('prpilot_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch rules: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

export default {
  // Repo Management
  addRepo,
  removeRepo,
  getRepos,
  indexRepo,

  // Code Review
  reviewPR,
  getReview,
  getReviews,

  // AI Analysis
  analyzeDiff,
  generateSuggestions,
  calculateScore,
  checkCustomRules,

  // Rules Management
  createRule,
  updateRule,
  deleteRule,
  getRules
};
