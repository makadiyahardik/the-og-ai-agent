import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * PRPilot API - Custom Review Rules
 * GET: List all custom rules
 * POST: Create a new rule
 * PUT: Update an existing rule
 * DELETE: Delete a rule
 */

// Predefined rule templates
const RULE_TEMPLATES = {
  'no-console': {
    name: 'No Console Logs',
    description: 'Flag console.log, console.warn, console.error statements that should be removed before production',
    category: 'code-quality',
    severity: 'medium'
  },
  'require-error-handling': {
    name: 'Require Error Handling',
    description: 'Ensure async functions have try-catch blocks or proper error handling',
    category: 'reliability',
    severity: 'high'
  },
  'no-hardcoded-secrets': {
    name: 'No Hardcoded Secrets',
    description: 'Flag any hardcoded API keys, passwords, tokens, or secrets',
    category: 'security',
    severity: 'critical'
  },
  'require-input-validation': {
    name: 'Require Input Validation',
    description: 'Ensure all user inputs are validated and sanitized',
    category: 'security',
    severity: 'high'
  },
  'max-function-length': {
    name: 'Maximum Function Length',
    description: 'Flag functions that exceed 50 lines - should be broken down',
    category: 'maintainability',
    severity: 'medium'
  },
  'require-tests': {
    name: 'Require Test Coverage',
    description: 'New functions and significant changes should include tests',
    category: 'testing',
    severity: 'medium'
  },
  'no-deprecated-apis': {
    name: 'No Deprecated APIs',
    description: 'Flag usage of deprecated APIs or methods',
    category: 'maintenance',
    severity: 'medium'
  },
  'accessibility-check': {
    name: 'Accessibility Requirements',
    description: 'Ensure UI components have proper ARIA labels and accessibility attributes',
    category: 'accessibility',
    severity: 'medium'
  }
};

// GET /api/prpilot/rules - List all rules
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const repoId = searchParams.get('repoId');
    const includeTemplates = searchParams.get('includeTemplates') === 'true';

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Build query for custom rules
    let query = supabase
      .from('prpilot_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (repoId) {
      query = query.eq('repo_id', repoId);
    }

    const { data: rules, error } = await query;

    if (error) {
      console.error('Error fetching rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }

    const response = {
      success: true,
      rules: rules || [],
      count: rules?.length || 0
    };

    // Include templates if requested
    if (includeTemplates) {
      response.templates = Object.entries(RULE_TEMPLATES).map(([key, template]) => ({
        id: key,
        ...template,
        isTemplate: true
      }));
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('GET /api/prpilot/rules error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/prpilot/rules - Create a new rule
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      userId,
      repoId,
      name,
      description,
      category,
      severity = 'medium',
      pattern,
      templateId,
      enabled = true
    } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // If using a template, merge template values
    let ruleName = name;
    let ruleDescription = description;
    let ruleCategory = category;
    let ruleSeverity = severity;

    if (templateId && RULE_TEMPLATES[templateId]) {
      const template = RULE_TEMPLATES[templateId];
      ruleName = name || template.name;
      ruleDescription = description || template.description;
      ruleCategory = category || template.category;
      ruleSeverity = severity || template.severity;
    }

    if (!ruleName || !ruleDescription) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (!validSeverities.includes(ruleSeverity)) {
      return NextResponse.json(
        { error: 'severity must be one of: critical, high, medium, low' },
        { status: 400 }
      );
    }

    // Check for duplicate rule name for this user/repo
    const { data: existingRule } = await supabase
      .from('prpilot_rules')
      .select('id')
      .eq('user_id', userId)
      .eq('name', ruleName)
      .eq('repo_id', repoId || null)
      .single();

    if (existingRule) {
      return NextResponse.json(
        { error: 'A rule with this name already exists' },
        { status: 409 }
      );
    }

    // Insert the new rule
    const { data: newRule, error: insertError } = await supabase
      .from('prpilot_rules')
      .insert({
        user_id: userId,
        repo_id: repoId || null,
        name: ruleName,
        description: ruleDescription,
        category: ruleCategory || 'general',
        severity: ruleSeverity,
        pattern: pattern || null,
        template_id: templateId || null,
        enabled: enabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating rule:', insertError);
      return NextResponse.json(
        { error: 'Failed to create rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rule: newRule,
      message: 'Rule created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/prpilot/rules error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/prpilot/rules - Update an existing rule
export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      ruleId,
      userId,
      name,
      description,
      category,
      severity,
      pattern,
      enabled
    } = body;

    if (!ruleId || !userId) {
      return NextResponse.json(
        { error: 'ruleId and userId are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingRule, error: fetchError } = await supabase
      .from('prpilot_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingRule) {
      return NextResponse.json(
        { error: 'Rule not found or access denied' },
        { status: 404 }
      );
    }

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (severity !== undefined) {
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      if (!validSeverities.includes(severity)) {
        return NextResponse.json(
          { error: 'severity must be one of: critical, high, medium, low' },
          { status: 400 }
        );
      }
      updates.severity = severity;
    }
    if (pattern !== undefined) updates.pattern = pattern;
    if (enabled !== undefined) updates.enabled = enabled;

    const { data: updatedRule, error: updateError } = await supabase
      .from('prpilot_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating rule:', updateError);
      return NextResponse.json(
        { error: 'Failed to update rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rule: updatedRule,
      message: 'Rule updated successfully'
    });

  } catch (error) {
    console.error('PUT /api/prpilot/rules error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/prpilot/rules - Delete a rule
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');
    const userId = searchParams.get('userId');

    if (!ruleId || !userId) {
      return NextResponse.json(
        { error: 'ruleId and userId are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: rule, error: fetchError } = await supabase
      .from('prpilot_rules')
      .select('id')
      .eq('id', ruleId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !rule) {
      return NextResponse.json(
        { error: 'Rule not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the rule
    const { error: deleteError } = await supabase
      .from('prpilot_rules')
      .delete()
      .eq('id', ruleId);

    if (deleteError) {
      console.error('Error deleting rule:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully'
    });

  } catch (error) {
    console.error('DELETE /api/prpilot/rules error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/prpilot/rules - Bulk enable/disable rules
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { userId, ruleIds, enabled } = body;

    if (!userId || !Array.isArray(ruleIds) || enabled === undefined) {
      return NextResponse.json(
        { error: 'userId, ruleIds array, and enabled boolean are required' },
        { status: 400 }
      );
    }

    if (ruleIds.length === 0) {
      return NextResponse.json(
        { error: 'ruleIds array cannot be empty' },
        { status: 400 }
      );
    }

    // Verify ownership of all rules
    const { data: ownedRules, error: fetchError } = await supabase
      .from('prpilot_rules')
      .select('id')
      .eq('user_id', userId)
      .in('id', ruleIds);

    if (fetchError) {
      console.error('Error verifying rules:', fetchError);
      return NextResponse.json(
        { error: 'Failed to verify rules' },
        { status: 500 }
      );
    }

    const ownedRuleIds = (ownedRules || []).map(r => r.id);
    const unauthorizedIds = ruleIds.filter(id => !ownedRuleIds.includes(id));

    if (unauthorizedIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Some rules not found or access denied',
          unauthorizedIds
        },
        { status: 403 }
      );
    }

    // Update all rules
    const { error: updateError } = await supabase
      .from('prpilot_rules')
      .update({
        enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .in('id', ruleIds);

    if (updateError) {
      console.error('Error updating rules:', updateError);
      return NextResponse.json(
        { error: 'Failed to update rules' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${ruleIds.length} rule(s) ${enabled ? 'enabled' : 'disabled'} successfully`,
      updatedCount: ruleIds.length
    });

  } catch (error) {
    console.error('PATCH /api/prpilot/rules error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
