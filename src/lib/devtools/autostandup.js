/**
 * AutoStandup Service Layer
 * Handles business logic for daily standup generation
 *
 * Features:
 * - Activity tracking from multiple sources (GitHub, manual)
 * - AI-powered standup text generation
 * - Custom template management
 * - Daily and weekly statistics
 */

import { supabase } from '../supabase';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

// Default standup template
const DEFAULT_TEMPLATE = `Yesterday:
- [activity summaries]

Today:
- [planned work based on open PRs/issues]

Blockers:
- [any blockers identified, or "None"]`;

// =============================================
// ACTIVITY TRACKING
// =============================================

/**
 * Log an activity for a user
 * @param {string} userId - User UUID
 * @param {Object} activity - Activity data
 * @param {string} activity.type - Activity type (commit, pr_open, pr_merge, pr_review, meeting, etc.)
 * @param {string} [activity.title] - Activity title
 * @param {string} [activity.url] - Related URL
 * @param {Object} [activity.details] - Additional details
 * @param {string} [activity.source] - Source (github, slack, calendar, manual)
 * @returns {Promise<Object>} Created activity record
 */
export async function logActivity(userId, activity) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!activity?.type) {
    throw new Error('Activity type is required');
  }

  try {
    const { data, error } = await supabase
      .from('autostandup_activities')
      .insert({
        user_id: userId,
        activity_type: activity.type,
        activity_title: activity.title || null,
        activity_url: activity.url || null,
        activity_details: activity.details || {},
        source: activity.source || 'manual',
        timestamp: activity.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to log activity: ${error.message}`);
    }

    // Update daily summary counts
    await updateDailySummary(userId, new Date());

    return data;
  } catch (err) {
    console.error('Error logging activity:', err);
    throw err;
  }
}

/**
 * Get activities for a specific date
 * @param {string} userId - User UUID
 * @param {Date|string} date - Date to fetch activities for
 * @returns {Promise<Array>} Array of activities
 */
export async function getActivities(userId, date) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('autostandup_activities')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startOfDay.toISOString())
      .lte('timestamp', endOfDay.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching activities:', err);
    throw err;
  }
}

/**
 * Sync recent GitHub activity for a user
 * @param {string} userId - User UUID
 * @param {string} token - GitHub access token
 * @returns {Promise<Object>} Sync results
 */
export async function syncGitHub(userId, token) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!token) {
    throw new Error('GitHub token is required');
  }

  try {
    // Fetch GitHub username from user settings
    const { data: userData, error: userError } = await supabase
      .from('devtools_users')
      .select('github_username')
      .eq('user_id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user data: ${userError.message}`);
    }

    const username = userData?.github_username;
    if (!username) {
      throw new Error('GitHub username not configured. Please set up your GitHub integration first.');
    }

    // Fetch recent events from GitHub API
    const response = await fetch(
      `https://api.github.com/users/${username}/events?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AutoStandup'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const events = await response.json();

    // Filter events from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentEvents = events.filter(event =>
      new Date(event.created_at) > yesterday
    );

    // Map GitHub events to activities
    const activities = [];

    for (const event of recentEvents) {
      const activity = mapGitHubEventToActivity(event);
      if (activity) {
        activities.push({
          ...activity,
          timestamp: event.created_at
        });
      }
    }

    // Bulk insert activities (avoiding duplicates)
    let inserted = 0;
    let skipped = 0;

    for (const activity of activities) {
      try {
        // Check for existing activity with same URL to avoid duplicates
        if (activity.url) {
          const { data: existing } = await supabase
            .from('autostandup_activities')
            .select('id')
            .eq('user_id', userId)
            .eq('activity_url', activity.url)
            .single();

          if (existing) {
            skipped++;
            continue;
          }
        }

        await logActivity(userId, activity);
        inserted++;
      } catch (err) {
        console.error('Error inserting activity:', err);
        skipped++;
      }
    }

    return {
      total_events: recentEvents.length,
      inserted,
      skipped,
      synced_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error syncing GitHub:', err);
    throw err;
  }
}

/**
 * Map GitHub event to activity format
 * @param {Object} event - GitHub event object
 * @returns {Object|null} Activity object or null if not mappable
 */
function mapGitHubEventToActivity(event) {
  const repo = event.repo?.name || 'unknown';

  switch (event.type) {
    case 'PushEvent':
      const commits = event.payload?.commits || [];
      return {
        type: 'commit',
        title: `Pushed ${commits.length} commit(s) to ${repo}`,
        url: `https://github.com/${repo}/compare/${event.payload?.before?.slice(0, 7)}...${event.payload?.head?.slice(0, 7)}`,
        details: {
          repo,
          commits: commits.map(c => ({
            sha: c.sha?.slice(0, 7),
            message: c.message
          })),
          branch: event.payload?.ref?.replace('refs/heads/', '')
        },
        source: 'github'
      };

    case 'PullRequestEvent':
      const pr = event.payload?.pull_request;
      const action = event.payload?.action;

      if (action === 'opened') {
        return {
          type: 'pr_open',
          title: `Opened PR: ${pr?.title || 'Unknown'}`,
          url: pr?.html_url,
          details: { repo, pr_number: pr?.number, action },
          source: 'github'
        };
      } else if (action === 'closed' && pr?.merged) {
        return {
          type: 'pr_merge',
          title: `Merged PR: ${pr?.title || 'Unknown'}`,
          url: pr?.html_url,
          details: { repo, pr_number: pr?.number, action },
          source: 'github'
        };
      }
      return null;

    case 'PullRequestReviewEvent':
      return {
        type: 'pr_review',
        title: `Reviewed PR: ${event.payload?.pull_request?.title || 'Unknown'}`,
        url: event.payload?.review?.html_url,
        details: {
          repo,
          pr_number: event.payload?.pull_request?.number,
          review_state: event.payload?.review?.state
        },
        source: 'github'
      };

    case 'IssuesEvent':
      if (event.payload?.action === 'opened') {
        return {
          type: 'issue_open',
          title: `Opened issue: ${event.payload?.issue?.title || 'Unknown'}`,
          url: event.payload?.issue?.html_url,
          details: { repo, issue_number: event.payload?.issue?.number },
          source: 'github'
        };
      }
      return null;

    case 'IssueCommentEvent':
      return {
        type: 'comment',
        title: `Commented on issue in ${repo}`,
        url: event.payload?.comment?.html_url,
        details: {
          repo,
          issue_number: event.payload?.issue?.number,
          issue_title: event.payload?.issue?.title
        },
        source: 'github'
      };

    case 'CreateEvent':
      if (event.payload?.ref_type === 'branch') {
        return {
          type: 'branch_create',
          title: `Created branch ${event.payload?.ref} in ${repo}`,
          url: `https://github.com/${repo}/tree/${event.payload?.ref}`,
          details: { repo, branch: event.payload?.ref },
          source: 'github'
        };
      }
      return null;

    default:
      return null;
  }
}

// =============================================
// STANDUP GENERATION
// =============================================

/**
 * Generate standup for a specific date
 * @param {string} userId - User UUID
 * @param {Date|string} date - Date to generate standup for
 * @returns {Promise<Object>} Generated standup record
 */
export async function generateStandup(userId, date) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get yesterday's activities
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayActivities = await getActivities(userId, yesterday);

    // Get today's activities (if any)
    const todayActivities = await getActivities(userId, targetDate);

    // Get user's default template
    const template = await getDefaultTemplate(userId);

    // Format activities for AI
    const formattedActivities = formatActivities([...yesterdayActivities, ...todayActivities]);

    // Get open PRs/issues for "Today" section
    const openItems = await getOpenWorkItems(userId);

    // Generate standup text using AI
    const standupText = await createStandupText(
      formattedActivities,
      template || DEFAULT_TEMPLATE,
      openItems
    );

    // Calculate stats
    const stats = calculateActivityStats(yesterdayActivities);

    // Upsert daily record
    const { data, error } = await supabase
      .from('autostandup_daily')
      .upsert({
        user_id: userId,
        date: dateStr,
        commits_count: stats.commits,
        prs_opened: stats.prs_opened,
        prs_merged: stats.prs_merged,
        prs_reviewed: stats.prs_reviewed,
        files_changed: stats.files_changed,
        standup_text: standupText,
        raw_activities: yesterdayActivities
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save standup: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Error generating standup:', err);
    throw err;
  }
}

/**
 * Get standup for a specific date
 * @param {string} userId - User UUID
 * @param {Date|string} date - Date to fetch standup for
 * @returns {Promise<Object|null>} Standup record or null
 */
export async function getStandup(userId, date) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('autostandup_daily')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch standup: ${error.message}`);
    }

    return data || null;
  } catch (err) {
    console.error('Error fetching standup:', err);
    throw err;
  }
}

/**
 * Regenerate standup with fresh data
 * @param {string} userId - User UUID
 * @param {Date|string} date - Date to regenerate standup for
 * @returns {Promise<Object>} Regenerated standup record
 */
export async function regenerateStandup(userId, date) {
  // Delete existing standup first
  try {
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().split('T')[0];

    await supabase
      .from('autostandup_daily')
      .delete()
      .eq('user_id', userId)
      .eq('date', dateStr);
  } catch (err) {
    console.error('Error deleting existing standup:', err);
    // Continue with regeneration even if delete fails
  }

  // Generate fresh standup
  return generateStandup(userId, date);
}

// =============================================
// AI GENERATION
// =============================================

/**
 * Format activities for AI processing
 * @param {Array} activities - Array of activity records
 * @returns {string} Formatted activities text
 */
export function formatActivities(activities) {
  if (!activities || activities.length === 0) {
    return 'No activities recorded.';
  }

  // Group activities by type
  const grouped = {};
  for (const activity of activities) {
    const type = activity.activity_type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(activity);
  }

  // Format each group
  const lines = [];

  const typeLabels = {
    commit: 'Commits',
    pr_open: 'Pull Requests Opened',
    pr_merge: 'Pull Requests Merged',
    pr_review: 'Code Reviews',
    issue_open: 'Issues Opened',
    comment: 'Comments',
    branch_create: 'Branches Created',
    meeting: 'Meetings',
    other: 'Other Activities'
  };

  for (const [type, items] of Object.entries(grouped)) {
    const label = typeLabels[type] || type;
    lines.push(`\n${label}:`);

    for (const item of items) {
      const title = item.activity_title || 'No title';
      const time = new Date(item.timestamp).toLocaleTimeString();
      lines.push(`  - ${title} (${time})`);

      // Add commit messages if available
      if (type === 'commit' && item.activity_details?.commits) {
        for (const commit of item.activity_details.commits.slice(0, 3)) {
          lines.push(`      * ${commit.message}`);
        }
        if (item.activity_details.commits.length > 3) {
          lines.push(`      * ... and ${item.activity_details.commits.length - 3} more`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Create standup text using AI
 * @param {string} activities - Formatted activities text
 * @param {string} template - Standup template
 * @param {Object} openItems - Open PRs and issues
 * @returns {Promise<string>} Generated standup text
 */
export async function createStandupText(activities, template, openItems = {}) {
  if (!groq) {
    // Fallback to simple text generation if AI not available
    return generateFallbackStandup(activities, template, openItems);
  }

  try {
    const systemPrompt = `You are a helpful assistant that generates concise daily standup updates for developers.
Your standups should be:
- Clear and to the point
- Professional but not overly formal
- Focused on completed work and planned tasks
- Honest about blockers

Use the provided template format exactly. Replace placeholder text with actual content.
If no activities are provided, indicate that it was a light day or mention any meetings/planning work.`;

    const userPrompt = `Generate a standup update based on the following:

ACTIVITIES FROM YESTERDAY:
${activities}

OPEN WORK ITEMS (for "Today" section):
${formatOpenItems(openItems)}

USE THIS TEMPLATE FORMAT:
${template}

Generate the standup now. Be concise and specific.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 500
    });

    return completion.choices[0]?.message?.content || generateFallbackStandup(activities, template, openItems);
  } catch (err) {
    console.error('Error generating standup with AI:', err);
    return generateFallbackStandup(activities, template, openItems);
  }
}

/**
 * Format open work items for AI prompt
 * @param {Object} openItems - Open PRs and issues
 * @returns {string} Formatted text
 */
function formatOpenItems(openItems) {
  const lines = [];

  if (openItems.prs?.length > 0) {
    lines.push('Open PRs:');
    for (const pr of openItems.prs) {
      lines.push(`  - ${pr.title}`);
    }
  }

  if (openItems.issues?.length > 0) {
    lines.push('Assigned Issues:');
    for (const issue of openItems.issues) {
      lines.push(`  - ${issue.title}`);
    }
  }

  if (lines.length === 0) {
    return 'No specific open items tracked.';
  }

  return lines.join('\n');
}

/**
 * Generate fallback standup without AI
 * @param {string} activities - Formatted activities
 * @param {string} template - Template to use
 * @param {Object} openItems - Open work items
 * @returns {string} Generated standup
 */
function generateFallbackStandup(activities, template, openItems) {
  // Simple template filling without AI
  let standup = 'Yesterday:\n';

  if (activities === 'No activities recorded.') {
    standup += '- No activities recorded\n';
  } else {
    // Extract key activities
    const lines = activities.split('\n').filter(l => l.trim().startsWith('-'));
    for (const line of lines.slice(0, 5)) {
      standup += `${line}\n`;
    }
    if (lines.length > 5) {
      standup += `- ... and ${lines.length - 5} more items\n`;
    }
  }

  standup += '\nToday:\n';
  if (openItems.prs?.length > 0 || openItems.issues?.length > 0) {
    if (openItems.prs) {
      for (const pr of openItems.prs.slice(0, 3)) {
        standup += `- Continue work on: ${pr.title}\n`;
      }
    }
    if (openItems.issues) {
      for (const issue of openItems.issues.slice(0, 3)) {
        standup += `- Work on: ${issue.title}\n`;
      }
    }
  } else {
    standup += '- Continue current work\n';
  }

  standup += '\nBlockers:\n- None\n';

  return standup;
}

/**
 * Get open work items for a user (PRs and issues)
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Open items
 */
async function getOpenWorkItems(userId) {
  // This would ideally fetch from GitHub API
  // For now, return empty to be filled by GitHub sync
  return {
    prs: [],
    issues: []
  };
}

/**
 * Get user's default template
 * @param {string} userId - User UUID
 * @returns {Promise<string|null>} Template format or null
 */
async function getDefaultTemplate(userId) {
  try {
    const { data, error } = await supabase
      .from('autostandup_templates')
      .select('template_format')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching default template:', error);
    }

    return data?.template_format || null;
  } catch (err) {
    return null;
  }
}

/**
 * Update daily summary counts
 * @param {string} userId - User UUID
 * @param {Date} date - Date to update
 */
async function updateDailySummary(userId, date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const activities = await getActivities(userId, date);
    const stats = calculateActivityStats(activities);

    await supabase
      .from('autostandup_daily')
      .upsert({
        user_id: userId,
        date: dateStr,
        commits_count: stats.commits,
        prs_opened: stats.prs_opened,
        prs_merged: stats.prs_merged,
        prs_reviewed: stats.prs_reviewed,
        files_changed: stats.files_changed,
        raw_activities: activities
      }, {
        onConflict: 'user_id,date',
        ignoreDuplicates: false
      });
  } catch (err) {
    console.error('Error updating daily summary:', err);
    // Non-critical, don't throw
  }
}

/**
 * Calculate stats from activities
 * @param {Array} activities - Array of activities
 * @returns {Object} Stats object
 */
function calculateActivityStats(activities) {
  const stats = {
    commits: 0,
    prs_opened: 0,
    prs_merged: 0,
    prs_reviewed: 0,
    files_changed: 0
  };

  for (const activity of activities) {
    switch (activity.activity_type) {
      case 'commit':
        stats.commits += activity.activity_details?.commits?.length || 1;
        break;
      case 'pr_open':
        stats.prs_opened++;
        break;
      case 'pr_merge':
        stats.prs_merged++;
        break;
      case 'pr_review':
        stats.prs_reviewed++;
        break;
    }
  }

  return stats;
}

// =============================================
// TEMPLATE MANAGEMENT
// =============================================

/**
 * Create a new standup template
 * @param {string} userId - User UUID
 * @param {Object} template - Template data
 * @param {string} template.name - Template name
 * @param {string} template.format - Template format text
 * @param {boolean} [template.isDefault] - Set as default
 * @returns {Promise<Object>} Created template
 */
export async function createTemplate(userId, template) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!template?.name || !template?.format) {
    throw new Error('Template name and format are required');
  }

  try {
    // If this is set as default, unset other defaults first
    if (template.isDefault) {
      await supabase
        .from('autostandup_templates')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { data, error } = await supabase
      .from('autostandup_templates')
      .insert({
        user_id: userId,
        template_name: template.name,
        template_format: template.format,
        is_default: template.isDefault || false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Error creating template:', err);
    throw err;
  }
}

/**
 * Update an existing template
 * @param {string} templateId - Template UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated template
 */
export async function updateTemplate(templateId, updates) {
  if (!templateId) {
    throw new Error('Template ID is required');
  }

  try {
    const updateData = {};

    if (updates.name !== undefined) {
      updateData.template_name = updates.name;
    }
    if (updates.format !== undefined) {
      updateData.template_format = updates.format;
    }
    if (updates.isDefault !== undefined) {
      updateData.is_default = updates.isDefault;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid updates provided');
    }

    // If setting as default, get user_id first and unset other defaults
    if (updateData.is_default) {
      const { data: existing } = await supabase
        .from('autostandup_templates')
        .select('user_id')
        .eq('id', templateId)
        .single();

      if (existing) {
        await supabase
          .from('autostandup_templates')
          .update({ is_default: false })
          .eq('user_id', existing.user_id)
          .neq('id', templateId);
      }
    }

    const { data, error } = await supabase
      .from('autostandup_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Error updating template:', err);
    throw err;
  }
}

/**
 * Delete a template
 * @param {string} templateId - Template UUID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTemplate(templateId) {
  if (!templateId) {
    throw new Error('Template ID is required');
  }

  try {
    const { error } = await supabase
      .from('autostandup_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }

    return true;
  } catch (err) {
    console.error('Error deleting template:', err);
    throw err;
  }
}

/**
 * Get all templates for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of templates
 */
export async function getTemplates(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('autostandup_templates')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching templates:', err);
    throw err;
  }
}

/**
 * Set a template as the default
 * @param {string} userId - User UUID
 * @param {string} templateId - Template UUID to set as default
 * @returns {Promise<Object>} Updated template
 */
export async function setDefaultTemplate(userId, templateId) {
  if (!userId || !templateId) {
    throw new Error('User ID and Template ID are required');
  }

  try {
    // Verify template belongs to user
    const { data: template, error: fetchError } = await supabase
      .from('autostandup_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !template) {
      throw new Error('Template not found or access denied');
    }

    // Unset all other defaults for this user
    await supabase
      .from('autostandup_templates')
      .update({ is_default: false })
      .eq('user_id', userId);

    // Set the new default
    const { data, error } = await supabase
      .from('autostandup_templates')
      .update({ is_default: true })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set default template: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Error setting default template:', err);
    throw err;
  }
}

// =============================================
// STATS
// =============================================

/**
 * Get stats for a specific day
 * @param {string} userId - User UUID
 * @param {Date|string} date - Date to get stats for
 * @returns {Promise<Object>} Daily stats
 */
export async function getDailyStats(userId, date) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Try to get from daily summary first
    const { data: daily, error: dailyError } = await supabase
      .from('autostandup_daily')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .single();

    if (daily) {
      return {
        date: dateStr,
        commits: daily.commits_count || 0,
        prs_opened: daily.prs_opened || 0,
        prs_merged: daily.prs_merged || 0,
        prs_reviewed: daily.prs_reviewed || 0,
        files_changed: daily.files_changed || 0,
        meetings: daily.meetings_attended || 0,
        has_standup: !!daily.standup_text,
        standup_generated_at: daily.created_at
      };
    }

    // Calculate from activities if no daily record
    const activities = await getActivities(userId, targetDate);
    const stats = calculateActivityStats(activities);

    return {
      date: dateStr,
      commits: stats.commits,
      prs_opened: stats.prs_opened,
      prs_merged: stats.prs_merged,
      prs_reviewed: stats.prs_reviewed,
      files_changed: stats.files_changed,
      meetings: 0,
      has_standup: false,
      standup_generated_at: null
    };
  } catch (err) {
    console.error('Error fetching daily stats:', err);
    throw err;
  }
}

/**
 * Get weekly summary stats
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Weekly stats
 */
export async function getWeeklyStats(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get all activities for the week
    const { data: activities, error } = await supabase
      .from('autostandup_activities')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', weekAgo.toISOString())
      .lte('timestamp', today.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch weekly activities: ${error.message}`);
    }

    // Get daily records for the week
    const { data: dailyRecords } = await supabase
      .from('autostandup_daily')
      .select('*')
      .eq('user_id', userId)
      .gte('date', weekAgo.toISOString().split('T')[0])
      .lte('date', today.toISOString().split('T')[0])
      .order('date', { ascending: false });

    // Calculate totals
    const stats = calculateActivityStats(activities || []);

    // Group by day
    const byDay = {};
    for (const activity of (activities || [])) {
      const day = new Date(activity.timestamp).toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = [];
      }
      byDay[day].push(activity);
    }

    // Calculate per-day stats
    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayActivities = byDay[dateStr] || [];
      const dayStats = calculateActivityStats(dayActivities);
      const dailyRecord = dailyRecords?.find(d => d.date === dateStr);

      dailyBreakdown.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        ...dayStats,
        has_standup: !!dailyRecord?.standup_text
      });
    }

    // Find most productive day
    const mostProductive = dailyBreakdown.reduce((max, day) => {
      const dayScore = day.commits + day.prs_opened * 2 + day.prs_merged * 3 + day.prs_reviewed;
      const maxScore = max.commits + max.prs_opened * 2 + max.prs_merged * 3 + max.prs_reviewed;
      return dayScore > maxScore ? day : max;
    }, dailyBreakdown[0]);

    return {
      period: {
        start: weekAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      },
      totals: {
        commits: stats.commits,
        prs_opened: stats.prs_opened,
        prs_merged: stats.prs_merged,
        prs_reviewed: stats.prs_reviewed,
        total_activities: activities?.length || 0
      },
      averages: {
        commits_per_day: Math.round((stats.commits / 7) * 10) / 10,
        prs_per_day: Math.round(((stats.prs_opened + stats.prs_merged) / 7) * 10) / 10
      },
      daily_breakdown: dailyBreakdown.reverse(), // Oldest to newest
      most_productive_day: mostProductive?.date || null,
      standups_generated: dailyRecords?.filter(d => d.standup_text).length || 0
    };
  } catch (err) {
    console.error('Error fetching weekly stats:', err);
    throw err;
  }
}

// =============================================
// EXPORTS
// =============================================

export default {
  // Activity Tracking
  logActivity,
  getActivities,
  syncGitHub,

  // Standup Generation
  generateStandup,
  getStandup,
  regenerateStandup,

  // AI Generation
  formatActivities,
  createStandupText,

  // Template Management
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplates,
  setDefaultTemplate,

  // Stats
  getDailyStats,
  getWeeklyStats,

  // Constants
  DEFAULT_TEMPLATE
};
