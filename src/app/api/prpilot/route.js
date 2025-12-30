import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * PRPilot API - Repository Management
 * GET: List all connected repositories
 * POST: Add a new repository for PR reviews
 */

// GET /api/prpilot - List all repositories
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const { data: repos, error } = await supabase
      .from('prpilot_repos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching repos:', error);
      return NextResponse.json(
        { error: 'Failed to fetch repositories' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      repos: repos || [],
      count: repos?.length || 0
    });

  } catch (error) {
    console.error('GET /api/prpilot error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/prpilot - Add a new repository
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      userId,
      repoOwner,
      repoName,
      githubToken,
      autoReview = true,
      reviewOnPush = false,
      defaultBranch = 'main'
    } = body;

    // Validate required fields
    if (!userId || !repoOwner || !repoName) {
      return NextResponse.json(
        { error: 'userId, repoOwner, and repoName are required' },
        { status: 400 }
      );
    }

    // Check if repo already exists
    const { data: existingRepo } = await supabase
      .from('prpilot_repos')
      .select('id')
      .eq('user_id', userId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName)
      .single();

    if (existingRepo) {
      return NextResponse.json(
        { error: 'Repository already connected' },
        { status: 409 }
      );
    }

    // Validate GitHub access if token provided
    if (githubToken) {
      const repoCheckResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}`,
        {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'PRPilot-App'
          }
        }
      );

      if (!repoCheckResponse.ok) {
        const errorData = await repoCheckResponse.json().catch(() => ({}));
        return NextResponse.json(
          {
            error: 'Unable to access repository',
            details: errorData.message || 'Repository not found or access denied'
          },
          { status: 403 }
        );
      }
    }

    // Generate webhook secret for secure webhook verification
    const webhookSecret = generateWebhookSecret();

    // Insert new repository
    const { data: newRepo, error: insertError } = await supabase
      .from('prpilot_repos')
      .insert({
        user_id: userId,
        repo_owner: repoOwner,
        repo_name: repoName,
        repo_full_name: `${repoOwner}/${repoName}`,
        github_token: githubToken || null,
        webhook_secret: webhookSecret,
        auto_review: autoReview,
        review_on_push: reviewOnPush,
        default_branch: defaultBranch,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Supabase error inserting repo:', insertError);
      return NextResponse.json(
        { error: 'Failed to add repository' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      repo: {
        id: newRepo.id,
        repoFullName: newRepo.repo_full_name,
        autoReview: newRepo.auto_review,
        reviewOnPush: newRepo.review_on_push,
        webhookSecret: newRepo.webhook_secret,
        status: newRepo.status,
        createdAt: newRepo.created_at
      },
      message: 'Repository added successfully',
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/prpilot/webhook`
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/prpilot error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/prpilot - Remove a repository
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repoId');
    const userId = searchParams.get('userId');

    if (!repoId || !userId) {
      return NextResponse.json(
        { error: 'repoId and userId are required' },
        { status: 400 }
      );
    }

    // Verify ownership before deletion
    const { data: repo, error: fetchError } = await supabase
      .from('prpilot_repos')
      .select('id')
      .eq('id', repoId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !repo) {
      return NextResponse.json(
        { error: 'Repository not found or access denied' },
        { status: 404 }
      );
    }

    // Delete associated reviews first
    await supabase
      .from('prpilot_reviews')
      .delete()
      .eq('repo_id', repoId);

    // Delete associated rules
    await supabase
      .from('prpilot_rules')
      .delete()
      .eq('repo_id', repoId);

    // Delete the repository
    const { error: deleteError } = await supabase
      .from('prpilot_repos')
      .delete()
      .eq('id', repoId);

    if (deleteError) {
      console.error('Supabase error deleting repo:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete repository' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Repository removed successfully'
    });

  } catch (error) {
    console.error('DELETE /api/prpilot error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/prpilot - Update repository settings
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { repoId, userId, ...updates } = body;

    if (!repoId || !userId) {
      return NextResponse.json(
        { error: 'repoId and userId are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: repo, error: fetchError } = await supabase
      .from('prpilot_repos')
      .select('id')
      .eq('id', repoId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !repo) {
      return NextResponse.json(
        { error: 'Repository not found or access denied' },
        { status: 404 }
      );
    }

    // Allowed update fields
    const allowedFields = ['auto_review', 'review_on_push', 'default_branch', 'github_token', 'status'];
    const sanitizedUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        sanitizedUpdates[snakeKey] = value;
      }
    }

    sanitizedUpdates.updated_at = new Date().toISOString();

    const { data: updatedRepo, error: updateError } = await supabase
      .from('prpilot_repos')
      .update(sanitizedUpdates)
      .eq('id', repoId)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase error updating repo:', updateError);
      return NextResponse.json(
        { error: 'Failed to update repository' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      repo: updatedRepo,
      message: 'Repository updated successfully'
    });

  } catch (error) {
    console.error('PATCH /api/prpilot error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate webhook secret
function generateWebhookSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
