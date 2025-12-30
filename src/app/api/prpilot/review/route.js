import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Groq from 'groq-sdk';

/**
 * PRPilot API - Code Review
 * POST: Trigger a PR review with AI analysis
 */

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const CODE_REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer with deep knowledge of software engineering best practices, security, performance optimization, and clean code principles.

Your role is to analyze pull request diffs and provide comprehensive, actionable feedback.

When reviewing code, you must:
1. Identify potential bugs and logical errors
2. Flag security vulnerabilities (SQL injection, XSS, authentication issues, etc.)
3. Highlight performance issues and optimization opportunities
4. Check for code style and maintainability concerns
5. Suggest improvements for readability and documentation
6. Identify potential edge cases and error handling gaps

Respond ONLY with valid JSON in the following format:
{
  "summary": "Brief overview of the changes and overall assessment",
  "quality_score": <number 1-100>,
  "issues": [
    {
      "type": "bug|security|performance|style|maintainability",
      "severity": "critical|high|medium|low",
      "file": "filename",
      "line": <line number or null>,
      "title": "Short issue title",
      "description": "Detailed explanation of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "suggestions": [
    {
      "type": "improvement|refactor|documentation|testing",
      "file": "filename",
      "title": "Suggestion title",
      "description": "What could be improved and why"
    }
  ],
  "highlights": [
    "List of positive aspects of the code"
  ]
}`;

// POST /api/prpilot/review - Trigger a PR review
export async function POST(request) {
  try {
    if (!groq) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      userId,
      repoId,
      prNumber,
      prTitle,
      prDescription,
      prUrl,
      baseBranch,
      headBranch,
      diff,
      files,
      customRules
    } = body;

    // Validate required fields
    if (!userId || !diff) {
      return NextResponse.json(
        { error: 'userId and diff are required' },
        { status: 400 }
      );
    }

    // Fetch custom rules if repoId provided
    let rules = customRules || [];
    if (repoId && !customRules) {
      const { data: repoRules } = await supabase
        .from('prpilot_rules')
        .select('*')
        .eq('repo_id', repoId)
        .eq('enabled', true);

      if (repoRules) {
        rules = repoRules;
      }
    }

    // Build the review prompt
    const rulesContext = rules.length > 0
      ? `\n\nCustom Review Rules to Apply:\n${rules.map(r => `- ${r.name}: ${r.description}`).join('\n')}`
      : '';

    const prContext = prTitle
      ? `\nPR Title: ${prTitle}\nPR Description: ${prDescription || 'No description provided'}\nBase Branch: ${baseBranch || 'unknown'} <- Head Branch: ${headBranch || 'unknown'}`
      : '';

    const filesContext = files && files.length > 0
      ? `\n\nFiles Changed:\n${files.map(f => `- ${f.filename} (+${f.additions || 0}/-${f.deletions || 0})`).join('\n')}`
      : '';

    const reviewPrompt = `Please review the following pull request diff and provide a comprehensive code review.
${prContext}
${filesContext}
${rulesContext}

Diff to review:
\`\`\`diff
${truncateDiff(diff, 15000)}
\`\`\`

Provide your review in the specified JSON format.`;

    // Create review record before analysis
    const reviewRecord = {
      user_id: userId,
      repo_id: repoId || null,
      pr_number: prNumber || null,
      pr_title: prTitle || null,
      pr_url: prUrl || null,
      base_branch: baseBranch || null,
      head_branch: headBranch || null,
      status: 'analyzing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: review, error: insertError } = await supabase
      .from('prpilot_reviews')
      .insert(reviewRecord)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating review record:', insertError);
      // Continue without database record for standalone reviews
    }

    // Perform AI analysis
    let analysisResult;
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: CODE_REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: reviewPrompt }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 4000
      });

      const responseContent = completion.choices[0]?.message?.content || '';
      analysisResult = parseReviewResponse(responseContent);
    } catch (aiError) {
      console.error('AI analysis error:', aiError);

      // Update review status to failed
      if (review?.id) {
        await supabase
          .from('prpilot_reviews')
          .update({
            status: 'failed',
            error_message: aiError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', review.id);
      }

      return NextResponse.json(
        { error: 'AI analysis failed', details: aiError.message },
        { status: 500 }
      );
    }

    // Calculate metrics
    const metrics = calculateMetrics(analysisResult);

    // Update review record with results
    if (review?.id) {
      await supabase
        .from('prpilot_reviews')
        .update({
          status: 'completed',
          quality_score: analysisResult.quality_score,
          summary: analysisResult.summary,
          issues: analysisResult.issues,
          suggestions: analysisResult.suggestions,
          highlights: analysisResult.highlights,
          metrics: metrics,
          updated_at: new Date().toISOString()
        })
        .eq('id', review.id);
    }

    return NextResponse.json({
      success: true,
      reviewId: review?.id || null,
      review: {
        summary: analysisResult.summary,
        qualityScore: analysisResult.quality_score,
        issues: analysisResult.issues,
        suggestions: analysisResult.suggestions,
        highlights: analysisResult.highlights,
        metrics: metrics
      },
      createdAt: review?.created_at || new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/prpilot/review error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/prpilot/review - List reviews
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const repoId = searchParams.get('repoId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('prpilot_reviews')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (repoId) {
      query = query.eq('repo_id', repoId);
    }

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reviews: reviews || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('GET /api/prpilot/review error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to truncate diff to avoid token limits
function truncateDiff(diff, maxLength) {
  if (!diff || diff.length <= maxLength) {
    return diff;
  }

  const truncated = diff.substring(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');

  return truncated.substring(0, lastNewline) + '\n\n... [diff truncated due to size] ...';
}

// Helper function to parse AI response
function parseReviewResponse(content) {
  // Try to extract JSON from the response
  let jsonContent = content;

  // Handle markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1];
  }

  // Try to find JSON object in the content
  const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonContent = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonContent);
    return {
      summary: parsed.summary || 'No summary provided',
      quality_score: Math.min(100, Math.max(0, parseInt(parsed.quality_score) || 70)),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : []
    };
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    // Return a default structure with the raw content as summary
    return {
      summary: content.substring(0, 500),
      quality_score: 70,
      issues: [],
      suggestions: [],
      highlights: []
    };
  }
}

// Helper function to calculate review metrics
function calculateMetrics(analysisResult) {
  const issues = analysisResult.issues || [];

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  const bugCount = issues.filter(i => i.type === 'bug').length;
  const securityCount = issues.filter(i => i.type === 'security').length;
  const performanceCount = issues.filter(i => i.type === 'performance').length;
  const styleCount = issues.filter(i => i.type === 'style').length;
  const maintainabilityCount = issues.filter(i => i.type === 'maintainability').length;

  return {
    totalIssues: issues.length,
    bySeverity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount
    },
    byType: {
      bug: bugCount,
      security: securityCount,
      performance: performanceCount,
      style: styleCount,
      maintainability: maintainabilityCount
    },
    suggestionsCount: (analysisResult.suggestions || []).length,
    highlightsCount: (analysisResult.highlights || []).length,
    needsAttention: criticalCount > 0 || highCount > 0
  };
}
