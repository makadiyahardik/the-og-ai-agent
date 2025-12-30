import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * GitHub API base URL
 */
const GITHUB_API_URL = 'https://api.github.com'

/**
 * POST /api/autostandup/sync
 * Syncs activities from GitHub (commits, PRs, issues)
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      userId,
      githubToken,
      repositories,
      syncTypes = ['commits', 'pull_requests', 'issues'],
      since
    } = body

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!githubToken) {
      return NextResponse.json(
        { error: 'githubToken is required for GitHub sync' },
        { status: 400 }
      )
    }

    // Default to past 24 hours if not specified
    const sinceDate = since
      ? new Date(since)
      : new Date(Date.now() - 24 * 60 * 60 * 1000)

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AutoStandup-App'
    }

    // Fetch GitHub user info
    const userResponse = await fetch(`${GITHUB_API_URL}/user`, { headers })
    if (!userResponse.ok) {
      const error = await userResponse.json()
      return NextResponse.json(
        { error: `GitHub authentication failed: ${error.message || 'Invalid token'}` },
        { status: 401 }
      )
    }
    const githubUser = await userResponse.json()

    // Get repositories to sync
    let reposToSync = repositories || []

    // If no specific repos provided, fetch user's recent repos
    if (reposToSync.length === 0) {
      const reposResponse = await fetch(
        `${GITHUB_API_URL}/user/repos?sort=pushed&per_page=10`,
        { headers }
      )
      if (reposResponse.ok) {
        const repos = await reposResponse.json()
        reposToSync = repos.map(r => r.full_name)
      }
    }

    const syncResults = {
      commits: [],
      pull_requests: [],
      issues: [],
      errors: []
    }

    // Sync each repository
    for (const repoFullName of reposToSync) {
      try {
        // Sync commits
        if (syncTypes.includes('commits')) {
          const commits = await fetchCommits(
            repoFullName,
            githubUser.login,
            sinceDate,
            headers
          )
          syncResults.commits.push(...commits)
        }

        // Sync pull requests
        if (syncTypes.includes('pull_requests')) {
          const prs = await fetchPullRequests(
            repoFullName,
            githubUser.login,
            sinceDate,
            headers
          )
          syncResults.pull_requests.push(...prs)
        }

        // Sync issues
        if (syncTypes.includes('issues')) {
          const issues = await fetchIssues(
            repoFullName,
            githubUser.login,
            sinceDate,
            headers
          )
          syncResults.issues.push(...issues)
        }
      } catch (repoError) {
        syncResults.errors.push({
          repository: repoFullName,
          error: repoError.message
        })
      }
    }

    // Convert GitHub data to activities and save
    const activities = []

    // Process commits
    for (const commit of syncResults.commits) {
      activities.push({
        user_id: userId,
        type: 'commit',
        title: commit.message.split('\n')[0].substring(0, 200),
        description: commit.message,
        repository: commit.repository,
        metadata: {
          sha: commit.sha,
          url: commit.url,
          files_changed: commit.stats?.total || null
        },
        created_at: commit.date
      })
    }

    // Process pull requests
    for (const pr of syncResults.pull_requests) {
      activities.push({
        user_id: userId,
        type: 'pull_request',
        title: pr.title,
        description: pr.body?.substring(0, 500) || null,
        repository: pr.repository,
        metadata: {
          number: pr.number,
          url: pr.url,
          status: pr.state,
          merged: pr.merged || false
        },
        created_at: pr.updated_at || pr.created_at
      })
    }

    // Process issues
    for (const issue of syncResults.issues) {
      activities.push({
        user_id: userId,
        type: 'issue',
        title: issue.title,
        description: issue.body?.substring(0, 500) || null,
        repository: issue.repository,
        metadata: {
          number: issue.number,
          url: issue.url,
          status: issue.state,
          labels: issue.labels || []
        },
        created_at: issue.updated_at || issue.created_at
      })
    }

    // Deduplicate activities (avoid re-adding same commits/PRs)
    const existingActivities = await getExistingActivityKeys(userId, sinceDate)
    const newActivities = activities.filter(a => {
      const key = generateActivityKey(a)
      return !existingActivities.has(key)
    })

    // Save new activities
    let savedCount = 0
    if (newActivities.length > 0) {
      const { data, error } = await supabase
        .from('activities')
        .insert(newActivities)
        .select()

      if (error) {
        console.error('Error saving synced activities:', error)
        syncResults.errors.push({
          operation: 'save',
          error: 'Failed to save some activities to database'
        })
      } else {
        savedCount = data?.length || 0
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        repositories_synced: reposToSync.length,
        commits_found: syncResults.commits.length,
        pull_requests_found: syncResults.pull_requests.length,
        issues_found: syncResults.issues.length,
        new_activities_saved: savedCount,
        duplicates_skipped: activities.length - newActivities.length
      },
      errors: syncResults.errors.length > 0 ? syncResults.errors : undefined
    })

  } catch (error) {
    console.error('GitHub sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/autostandup/sync
 * Gets sync status and history for a user
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Get the most recent activities grouped by type
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { data: recentActivities, error } = await supabase
      .from('activities')
      .select('type, created_at, repository')
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sync status:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sync status' },
        { status: 500 }
      )
    }

    // Calculate summary
    const summary = {
      last_24_hours: {
        total: recentActivities?.length || 0,
        by_type: {},
        by_repository: {}
      }
    }

    if (recentActivities) {
      for (const activity of recentActivities) {
        // Count by type
        summary.last_24_hours.by_type[activity.type] =
          (summary.last_24_hours.by_type[activity.type] || 0) + 1

        // Count by repository
        if (activity.repository) {
          summary.last_24_hours.by_repository[activity.repository] =
            (summary.last_24_hours.by_repository[activity.repository] || 0) + 1
        }
      }
    }

    // Get last sync time (most recent GitHub activity)
    const { data: lastGithubActivity } = await supabase
      .from('activities')
      .select('created_at')
      .eq('user_id', userId)
      .in('type', ['commit', 'pull_request', 'issue'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      success: true,
      summary,
      last_github_sync: lastGithubActivity?.created_at || null
    })

  } catch (error) {
    console.error('GET sync status error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Fetch commits from a repository
 */
async function fetchCommits(repoFullName, username, since, headers) {
  const commits = []
  const url = new URL(`${GITHUB_API_URL}/repos/${repoFullName}/commits`)
  url.searchParams.set('author', username)
  url.searchParams.set('since', since.toISOString())
  url.searchParams.set('per_page', '50')

  const response = await fetch(url.toString(), { headers })
  if (!response.ok) {
    if (response.status === 404) {
      return [] // Repo not found or no access
    }
    throw new Error(`Failed to fetch commits: ${response.status}`)
  }

  const data = await response.json()

  for (const commit of data) {
    commits.push({
      sha: commit.sha,
      message: commit.commit.message,
      date: commit.commit.author.date,
      url: commit.html_url,
      repository: repoFullName,
      stats: commit.stats
    })
  }

  return commits
}

/**
 * Fetch pull requests from a repository
 */
async function fetchPullRequests(repoFullName, username, since, headers) {
  const pullRequests = []
  const url = new URL(`${GITHUB_API_URL}/repos/${repoFullName}/pulls`)
  url.searchParams.set('state', 'all')
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('direction', 'desc')
  url.searchParams.set('per_page', '30')

  const response = await fetch(url.toString(), { headers })
  if (!response.ok) {
    if (response.status === 404) {
      return []
    }
    throw new Error(`Failed to fetch pull requests: ${response.status}`)
  }

  const data = await response.json()
  const sinceTime = since.getTime()

  for (const pr of data) {
    // Filter by author and date
    if (pr.user.login !== username) continue
    const updatedAt = new Date(pr.updated_at).getTime()
    if (updatedAt < sinceTime) continue

    pullRequests.push({
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      merged: pr.merged_at !== null,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      url: pr.html_url,
      repository: repoFullName
    })
  }

  return pullRequests
}

/**
 * Fetch issues from a repository
 */
async function fetchIssues(repoFullName, username, since, headers) {
  const issues = []
  const url = new URL(`${GITHUB_API_URL}/repos/${repoFullName}/issues`)
  url.searchParams.set('state', 'all')
  url.searchParams.set('creator', username)
  url.searchParams.set('since', since.toISOString())
  url.searchParams.set('per_page', '30')

  const response = await fetch(url.toString(), { headers })
  if (!response.ok) {
    if (response.status === 404) {
      return []
    }
    throw new Error(`Failed to fetch issues: ${response.status}`)
  }

  const data = await response.json()

  for (const issue of data) {
    // Skip pull requests (GitHub API returns PRs as issues too)
    if (issue.pull_request) continue

    issues.push({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      url: issue.html_url,
      repository: repoFullName,
      labels: issue.labels.map(l => l.name)
    })
  }

  return issues
}

/**
 * Get existing activity keys to prevent duplicates
 */
async function getExistingActivityKeys(userId, since) {
  const { data } = await supabase
    .from('activities')
    .select('type, metadata')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .in('type', ['commit', 'pull_request', 'issue'])

  const keys = new Set()
  if (data) {
    for (const activity of data) {
      if (activity.metadata?.sha) {
        keys.add(`commit:${activity.metadata.sha}`)
      } else if (activity.metadata?.number && activity.metadata?.url) {
        keys.add(`${activity.type}:${activity.metadata.url}`)
      }
    }
  }
  return keys
}

/**
 * Generate a unique key for an activity to detect duplicates
 */
function generateActivityKey(activity) {
  if (activity.type === 'commit' && activity.metadata?.sha) {
    return `commit:${activity.metadata.sha}`
  }
  if (activity.metadata?.url) {
    return `${activity.type}:${activity.metadata.url}`
  }
  return `${activity.type}:${activity.title}:${activity.created_at}`
}
