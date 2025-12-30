import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Groq from 'groq-sdk';
import crypto from 'crypto';

/**
 * PRPilot API - GitHub Webhook Handler
 * POST: Handle incoming GitHub webhook events for automatic PR reviews
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

// POST /api/prpilot/webhook - Handle GitHub webhook
export async function POST(request) {
  try {
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');
    const deliveryId = request.headers.get('x-github-delivery');

    // Get raw body for signature verification
    const rawBody = await request.text();
    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('Invalid JSON payload:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Log webhook receipt
    console.log(`Received GitHub webhook: event=${event}, delivery=${deliveryId}`);

    // Get repository info from payload
    const repoFullName = payload.repository?.full_name;
    const repoOwner = payload.repository?.owner?.login;
    const repoName = payload.repository?.name;

    if (!repoFullName) {
      return NextResponse.json(
        { error: 'Repository information missing from payload' },
        { status: 400 }
      );
    }

    // Find the registered repository
    const { data: repo, error: repoError } = await supabase
      .from('prpilot_repos')
      .select('*')
      .eq('repo_full_name', repoFullName)
      .eq('status', 'active')
      .single();

    if (repoError || !repo) {
      console.log(`Repository not registered: ${repoFullName}`);
      return NextResponse.json({
        success: false,
        message: 'Repository not registered for PR reviews'
      }, { status: 200 }); // Return 200 to acknowledge receipt
    }

    // Verify webhook signature if secret is configured
    if (repo.webhook_secret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, repo.webhook_secret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }

    // Handle different event types
    switch (event) {
      case 'pull_request':
        return await handlePullRequestEvent(payload, repo);

      case 'pull_request_review':
        return await handlePullRequestReviewEvent(payload, repo);

      case 'push':
        if (repo.review_on_push) {
          return await handlePushEvent(payload, repo);
        }
        return NextResponse.json({
          success: true,
          message: 'Push event received, review_on_push is disabled'
        });

      case 'ping':
        return NextResponse.json({
          success: true,
          message: 'Pong! Webhook configured successfully',
          repository: repoFullName
        });

      default:
        return NextResponse.json({
          success: true,
          message: `Event '${event}' received but not processed`
        });
    }

  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle pull_request events
async function handlePullRequestEvent(payload, repo) {
  const action = payload.action;
  const pr = payload.pull_request;

  // Only review on opened, synchronize (new commits), or reopened
  const reviewableActions = ['opened', 'synchronize', 'reopened'];

  if (!reviewableActions.includes(action)) {
    return NextResponse.json({
      success: true,
      message: `PR action '${action}' does not trigger review`
    });
  }

  if (!repo.auto_review) {
    return NextResponse.json({
      success: true,
      message: 'Auto-review is disabled for this repository'
    });
  }

  // Check if AI is configured
  if (!groq) {
    console.error('Groq API not configured');
    return NextResponse.json({
      success: false,
      message: 'AI service not configured'
    }, { status: 503 });
  }

  // Fetch PR diff from GitHub
  const diffUrl = pr.diff_url;
  let diff;

  try {
    const headers = {
      'Accept': 'application/vnd.github.v3.diff',
      'User-Agent': 'PRPilot-App'
    };

    if (repo.github_token) {
      headers['Authorization'] = `Bearer ${repo.github_token}`;
    }

    const diffResponse = await fetch(diffUrl, { headers });

    if (!diffResponse.ok) {
      throw new Error(`Failed to fetch diff: ${diffResponse.status}`);
    }

    diff = await diffResponse.text();
  } catch (fetchError) {
    console.error('Error fetching PR diff:', fetchError);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch PR diff'
    }, { status: 500 });
  }

  // Check for existing pending review
  const { data: existingReview } = await supabase
    .from('prpilot_reviews')
    .select('id, status')
    .eq('repo_id', repo.id)
    .eq('pr_number', pr.number)
    .eq('status', 'analyzing')
    .single();

  if (existingReview) {
    return NextResponse.json({
      success: true,
      message: 'Review already in progress',
      reviewId: existingReview.id
    });
  }

  // Create review record
  const { data: review, error: insertError } = await supabase
    .from('prpilot_reviews')
    .insert({
      user_id: repo.user_id,
      repo_id: repo.id,
      pr_number: pr.number,
      pr_title: pr.title,
      pr_url: pr.html_url,
      base_branch: pr.base?.ref,
      head_branch: pr.head?.ref,
      pr_author: pr.user?.login,
      status: 'analyzing',
      triggered_by: 'webhook',
      webhook_delivery_id: payload.delivery,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating review record:', insertError);
  }

  // Fetch custom rules for this repo
  const { data: rules } = await supabase
    .from('prpilot_rules')
    .select('*')
    .eq('repo_id', repo.id)
    .eq('enabled', true);

  // Perform AI analysis
  try {
    const analysisResult = await performAnalysis(diff, pr, rules || []);

    // Update review record
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
          metrics: calculateMetrics(analysisResult),
          updated_at: new Date().toISOString()
        })
        .eq('id', review.id);
    }

    // Post review comment to GitHub if token is available
    if (repo.github_token && analysisResult) {
      await postReviewToGitHub(repo, pr.number, analysisResult);
    }

    return NextResponse.json({
      success: true,
      message: 'PR review completed',
      reviewId: review?.id,
      qualityScore: analysisResult.quality_score,
      issueCount: analysisResult.issues?.length || 0
    });

  } catch (analysisError) {
    console.error('Analysis error:', analysisError);

    if (review?.id) {
      await supabase
        .from('prpilot_reviews')
        .update({
          status: 'failed',
          error_message: analysisError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', review.id);
    }

    return NextResponse.json({
      success: false,
      message: 'Review analysis failed',
      error: analysisError.message
    }, { status: 500 });
  }
}

// Handle pull_request_review events
async function handlePullRequestReviewEvent(payload, repo) {
  // Log review events for tracking
  const review = payload.review;
  const pr = payload.pull_request;

  console.log(`PR #${pr.number} received review: ${review.state} from ${review.user.login}`);

  return NextResponse.json({
    success: true,
    message: 'Review event logged'
  });
}

// Handle push events for review_on_push feature
async function handlePushEvent(payload, repo) {
  const ref = payload.ref;
  const commits = payload.commits || [];

  // Only process pushes to the default branch
  if (ref !== `refs/heads/${repo.default_branch}`) {
    return NextResponse.json({
      success: true,
      message: 'Push to non-default branch, skipping review'
    });
  }

  // Log the push event
  console.log(`Push to ${repo.repo_full_name}:${repo.default_branch} with ${commits.length} commits`);

  return NextResponse.json({
    success: true,
    message: 'Push event received',
    commitCount: commits.length
  });
}

// Perform AI analysis on the diff
async function performAnalysis(diff, pr, rules) {
  const rulesContext = rules.length > 0
    ? `\n\nCustom Review Rules to Apply:\n${rules.map(r => `- ${r.name}: ${r.description}`).join('\n')}`
    : '';

  const prContext = `
PR Title: ${pr.title}
PR Description: ${pr.body || 'No description provided'}
Base Branch: ${pr.base?.ref || 'unknown'} <- Head Branch: ${pr.head?.ref || 'unknown'}
Author: ${pr.user?.login || 'unknown'}`;

  const reviewPrompt = `Please review the following pull request diff and provide a comprehensive code review.
${prContext}
${rulesContext}

Diff to review:
\`\`\`diff
${truncateDiff(diff, 15000)}
\`\`\`

Provide your review in the specified JSON format.`;

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
  return parseReviewResponse(responseContent);
}

// Post review comment to GitHub
async function postReviewToGitHub(repo, prNumber, analysisResult) {
  try {
    const reviewBody = formatReviewComment(analysisResult);

    const response = await fetch(
      `https://api.github.com/repos/${repo.repo_full_name}/pulls/${prNumber}/reviews`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${repo.github_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PRPilot-App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          body: reviewBody,
          event: determineReviewAction(analysisResult)
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to post GitHub review:', errorData);
    } else {
      console.log(`Posted review to PR #${prNumber}`);
    }
  } catch (postError) {
    console.error('Error posting to GitHub:', postError);
  }
}

// Format the review comment for GitHub
function formatReviewComment(analysisResult) {
  let comment = `## PRPilot AI Code Review\n\n`;
  comment += `**Quality Score:** ${analysisResult.quality_score}/100\n\n`;
  comment += `### Summary\n${analysisResult.summary}\n\n`;

  if (analysisResult.issues && analysisResult.issues.length > 0) {
    comment += `### Issues Found (${analysisResult.issues.length})\n\n`;

    const issuesBySeverity = {
      critical: analysisResult.issues.filter(i => i.severity === 'critical'),
      high: analysisResult.issues.filter(i => i.severity === 'high'),
      medium: analysisResult.issues.filter(i => i.severity === 'medium'),
      low: analysisResult.issues.filter(i => i.severity === 'low')
    };

    for (const [severity, issues] of Object.entries(issuesBySeverity)) {
      if (issues.length > 0) {
        const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[severity];
        comment += `#### ${emoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${issues.length})\n\n`;

        for (const issue of issues) {
          comment += `- **${issue.title}** (${issue.type})`;
          if (issue.file) comment += ` in \`${issue.file}\``;
          if (issue.line) comment += ` at line ${issue.line}`;
          comment += `\n  ${issue.description}`;
          if (issue.suggestion) comment += `\n  > Suggestion: ${issue.suggestion}`;
          comment += '\n\n';
        }
      }
    }
  }

  if (analysisResult.suggestions && analysisResult.suggestions.length > 0) {
    comment += `### Suggestions for Improvement\n\n`;
    for (const suggestion of analysisResult.suggestions) {
      comment += `- **${suggestion.title}** (${suggestion.type})`;
      if (suggestion.file) comment += ` in \`${suggestion.file}\``;
      comment += `\n  ${suggestion.description}\n\n`;
    }
  }

  if (analysisResult.highlights && analysisResult.highlights.length > 0) {
    comment += `### Highlights\n\n`;
    for (const highlight of analysisResult.highlights) {
      comment += `- ${highlight}\n`;
    }
  }

  comment += `\n---\n*Automated review by PRPilot AI*`;

  return comment;
}

// Determine the review action based on issues
function determineReviewAction(analysisResult) {
  const criticalCount = (analysisResult.issues || []).filter(i => i.severity === 'critical').length;
  const highCount = (analysisResult.issues || []).filter(i => i.severity === 'high').length;

  if (criticalCount > 0) {
    return 'REQUEST_CHANGES';
  } else if (highCount > 0) {
    return 'COMMENT';
  } else if (analysisResult.quality_score >= 80) {
    return 'APPROVE';
  }

  return 'COMMENT';
}

// Verify GitHub webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Helper function to truncate diff
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
  let jsonContent = content;

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1];
  }

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
    return {
      summary: content.substring(0, 500),
      quality_score: 70,
      issues: [],
      suggestions: [],
      highlights: []
    };
  }
}

// Helper function to calculate metrics
function calculateMetrics(analysisResult) {
  const issues = analysisResult.issues || [];

  return {
    totalIssues: issues.length,
    bySeverity: {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    },
    byType: {
      bug: issues.filter(i => i.type === 'bug').length,
      security: issues.filter(i => i.type === 'security').length,
      performance: issues.filter(i => i.type === 'performance').length,
      style: issues.filter(i => i.type === 'style').length,
      maintainability: issues.filter(i => i.type === 'maintainability').length
    },
    suggestionsCount: (analysisResult.suggestions || []).length,
    highlightsCount: (analysisResult.highlights || []).length,
    needsAttention: issues.some(i => i.severity === 'critical' || i.severity === 'high')
  };
}

// GET endpoint for webhook status/configuration info
export async function GET(request) {
  return NextResponse.json({
    status: 'active',
    supportedEvents: ['pull_request', 'pull_request_review', 'push', 'ping'],
    documentation: 'Configure this URL as your GitHub webhook endpoint with Content-Type: application/json',
    requiredHeaders: {
      'x-github-event': 'The GitHub event type',
      'x-hub-signature-256': 'HMAC signature for verification (optional but recommended)',
      'x-github-delivery': 'Unique delivery ID'
    }
  });
}
