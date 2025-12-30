import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * PRPilot API - Review Results
 * GET: Fetch a specific review by ID
 * DELETE: Delete a specific review
 */

// GET /api/prpilot/review/[id] - Get review results
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Build query
    let query = supabase
      .from('prpilot_reviews')
      .select('*')
      .eq('id', id);

    // Add user filter if provided for security
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: review, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Review not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching review:', error);
      return NextResponse.json(
        { error: 'Failed to fetch review' },
        { status: 500 }
      );
    }

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Format response
    const formattedReview = {
      id: review.id,
      status: review.status,
      prNumber: review.pr_number,
      prTitle: review.pr_title,
      prUrl: review.pr_url,
      baseBranch: review.base_branch,
      headBranch: review.head_branch,
      summary: review.summary,
      qualityScore: review.quality_score,
      issues: review.issues || [],
      suggestions: review.suggestions || [],
      highlights: review.highlights || [],
      metrics: review.metrics || null,
      errorMessage: review.error_message,
      createdAt: review.created_at,
      updatedAt: review.updated_at
    };

    // Include repo info if available
    if (review.repo_id) {
      const { data: repo } = await supabase
        .from('prpilot_repos')
        .select('repo_full_name, repo_owner, repo_name')
        .eq('id', review.repo_id)
        .single();

      if (repo) {
        formattedReview.repository = {
          fullName: repo.repo_full_name,
          owner: repo.repo_owner,
          name: repo.repo_name
        };
      }
    }

    return NextResponse.json({
      success: true,
      review: formattedReview
    });

  } catch (error) {
    console.error('GET /api/prpilot/review/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/prpilot/review/[id] - Delete a review
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required for authorization' },
        { status: 400 }
      );
    }

    // Verify ownership before deletion
    const { data: review, error: fetchError } = await supabase
      .from('prpilot_reviews')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !review) {
      return NextResponse.json(
        { error: 'Review not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the review
    const { error: deleteError } = await supabase
      .from('prpilot_reviews')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting review:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete review' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('DELETE /api/prpilot/review/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/prpilot/review/[id] - Update review (e.g., add notes)
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, notes, resolved } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Review ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required for authorization' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: review, error: fetchError } = await supabase
      .from('prpilot_reviews')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !review) {
      return NextResponse.json(
        { error: 'Review not found or access denied' },
        { status: 404 }
      );
    }

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (notes !== undefined) {
      updates.user_notes = notes;
    }

    if (resolved !== undefined) {
      updates.resolved = resolved;
      if (resolved) {
        updates.resolved_at = new Date().toISOString();
      }
    }

    const { data: updatedReview, error: updateError } = await supabase
      .from('prpilot_reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating review:', updateError);
      return NextResponse.json(
        { error: 'Failed to update review' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: updatedReview,
      message: 'Review updated successfully'
    });

  } catch (error) {
    console.error('PATCH /api/prpilot/review/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
