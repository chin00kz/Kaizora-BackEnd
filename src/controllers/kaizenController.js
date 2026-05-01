import { supabase } from '../config/supabase.js';
import { getCachedData } from '../utils/cache.js';

/**
 * Resolve a set of user IDs to profile objects.
 * First tries public.profiles, then falls back to auth.users for any not found.
 */
async function resolveProfiles(userIds) {
  const profileMap = new Map();
  if (userIds.size === 0) return profileMap;

  const ids = [...userIds];

  // 1. Try public.profiles first
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', ids);

  if (profiles) {
    profiles.forEach(p => profileMap.set(p.id, p));
  }

  // 2. For any IDs still missing, fall back to auth.users (admin API)
  const missingIds = ids.filter(id => !profileMap.has(id));
  if (missingIds.length > 0) {
    console.log(`[resolveProfiles] ${missingIds.length} IDs not in profiles table, fetching from auth.users`);
    await Promise.all(missingIds.map(async (id) => {
      try {
        const { data: { user }, error } = await supabase.auth.admin.getUserById(id);
        if (!error && user) {
          profileMap.set(id, {
            id: user.id,
            full_name: user.user_metadata?.full_name || null,
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url || null
          });
        }
      } catch (e) {
        console.warn(`[resolveProfiles] Could not resolve user ${id}:`, e.message);
      }
    }));
  }

  return profileMap;
}

/**
 * Submit a new Kaizen (Any logged in user)
 */
export const createKaizen = async (req, res) => {
  try {
    const { title, description, category, impact_level, department_id } = req.body;

    const { data: kaizen, error } = await supabase
      .from('kaizens')
      .insert([
        {
          title,
          description,
          category,
          impact_level,
          department_id,
          submitted_by: req.user.id,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ status: 'success', data: { kaizen } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Get Kaizens based on user role (RBAC filtering)
 */
export const getKaizens = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { role, department_id: userDeptId } = req.profile;

    let query = supabase.from('kaizens').select('*');

    // 1. Employee: only see their own submissions
    if (role === 'employee') {
      query = query.eq('submitted_by', userId);
    }
    // 2. HOD: see their own submissions AND submissions from their department
    else if (role === 'hod') {
      query = query.or(`submitted_by.eq.${userId},department_id.eq.${userDeptId}`);
    }
    // 3. QDM/Admin/SuperAdmin: see all submissions
    else if (['qdm', 'admin', 'superadmin'].includes(role)) {
      // No filter needed for broad access
    }

    const { data: kaizens, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Collect all unique user IDs from this result set
    const userIds = new Set();
    kaizens.forEach(k => {
      if (k.submitted_by) userIds.add(k.submitted_by);
      if (k.reviewed_by) userIds.add(k.reviewed_by);
    });

    // Resolve all user profiles (falls back to auth.users if not in profiles table)
    const profileMap = await resolveProfiles(userIds);

    const departments = await getCachedData('departments', async () => {
      const { data } = await supabase.from('departments').select('id, name');
      return data || [];
    });
    const deptMap = new Map(departments.map(d => [d.id, d]));

    const mappedKaizens = kaizens.map(k => {
      const submitter = profileMap.get(k.submitted_by) || null;
      const reviewer = profileMap.get(k.reviewed_by) || null;
      const dept = deptMap.get(k.department_id) || null;

      return {
        ...k,
        departments: dept ? { name: dept.name } : null,
        profiles: submitter ? { full_name: submitter.full_name, email: submitter.email, avatar_url: submitter.avatar_url } : null,
        submitter: submitter,
        reviewer: reviewer
      };
    });

    res.status(200).json({ status: 'success', data: { kaizens: mappedKaizens } });
  } catch (error) {
    console.error('[getKaizens] Error:', error);
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Update Kaizen status (QDM / HOD / Admin only)
 */
export const updateKaizenStatus = async (req, res) => {
  try {
    const { kaizenId } = req.params;
    const { status, rejection_reason, impact_level } = req.body;

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (rejection_reason) updateData.rejection_reason = rejection_reason;
    if (impact_level) updateData.impact_level = impact_level;

    const { data: kaizen, error } = await supabase
      .from('kaizens')
      .update(updateData)
      .eq('id', kaizenId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { kaizen } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Get a single Kaizen detail
 */
export const getKaizenById = async (req, res) => {
  try {
    const { kaizenId } = req.params;

    const { data: kaizen, error } = await supabase
      .from('kaizens')
      .select('*')
      .eq('id', kaizenId)
      .single();

    if (error) throw error;

    // Fetch comments
    const { data: comments } = await supabase
      .from('comments')
      .select('*')
      .eq('kaizen_id', kaizenId)
      .order('created_at', { ascending: true });

    // Collect all unique user IDs we need to resolve
    const userIds = new Set();
    if (kaizen.submitted_by) userIds.add(kaizen.submitted_by);
    if (kaizen.reviewed_by) userIds.add(kaizen.reviewed_by);
    comments?.forEach(c => { if (c.user_id) userIds.add(c.user_id); });

    // Resolve all user profiles (falls back to auth.users if not in profiles table)
    const profileMap = await resolveProfiles(userIds);

    const departments = await getCachedData('departments', async () => {
      const { data } = await supabase.from('departments').select('id, name');
      return data || [];
    });
    const deptMap = new Map(departments.map(d => [d.id, d]));

    const submitter = profileMap.get(kaizen.submitted_by) || null;
    const reviewer = profileMap.get(kaizen.reviewed_by) || null;
    const dept = deptMap.get(kaizen.department_id) || null;

    const mappedComments = comments?.map(c => {
      const commenter = profileMap.get(c.user_id);
      return {
        ...c,
        profiles: commenter
          ? { full_name: commenter.full_name, email: commenter.email, avatar_url: commenter.avatar_url }
          : null
      };
    }) || [];

    const mappedKaizen = {
      ...kaizen,
      departments: dept ? { name: dept.name } : null,
      profiles: submitter ? { full_name: submitter.full_name, email: submitter.email, avatar_url: submitter.avatar_url } : null,
      submitter: submitter,
      reviewer: reviewer,
      comments: mappedComments
    };

    res.status(200).json({ status: 'success', data: { kaizen: mappedKaizen } });
  } catch (error) {
    console.error('[getKaizenById] Error:', error);
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Get EXCLUSIVELY the current user's Kaizens (For My Kaizens portal)
 */
export const getMyKaizens = async (req, res) => {
  try {
    const { id: userId } = req.user;

    const { data: kaizens, error } = await supabase
      .from('kaizens')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const departments = await getCachedData('departments', async () => {
      const { data } = await supabase.from('departments').select('id, name');
      return data || [];
    });
    const deptMap = new Map(departments.map(d => [d.id, d]));

    const mappedKaizens = kaizens.map(k => {
      const dept = deptMap.get(k.department_id);
      return {
        ...k,
        departments: dept ? { name: dept.name } : null
      };
    });

    res.status(200).json({ status: 'success', data: { kaizens: mappedKaizens } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Advanced Review & Evaluate
 */
export const evaluateKaizen = async (req, res) => {
  try {
    const { kaizenId } = req.params;
    const { status, score, rejection_reason } = req.body;
    const reviewerId = req.user.id;

    const updateData = {
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Only update score when explicitly provided (approvals), not on rejections
    if (score !== undefined && score !== null) {
      updateData.score = score;
    }

    if (rejection_reason !== undefined) {
      updateData.rejection_reason = rejection_reason;
    }

    const { data: kaizen, error } = await supabase
      .from('kaizens')
      .update(updateData)
      .eq('id', kaizenId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { kaizen } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Add a comment to the discussion thread
 */
export const addComment = async (req, res) => {
  try {
    const { kaizenId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ status: 'fail', message: 'Comment content is required' });
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert([
        {
          kaizen_id: kaizenId,
          user_id: userId,
          content
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Manually fetch the commenter's profile (avoids relying on FK join)
    const { data: commenterProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', userId)
      .single();

    const enrichedComment = {
      ...comment,
      profiles: commenterProfile
        ? { full_name: commenterProfile.full_name, email: commenterProfile.email, avatar_url: commenterProfile.avatar_url }
        : null
    };

    res.status(201).json({ status: 'success', data: { comment: enrichedComment } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Delete a Kaizen completely
 */
export const deleteKaizen = async (req, res) => {
  try {
    const { kaizenId } = req.params;

    // Optional but safe: delete associated comments first
    await supabase.from('comments').delete().eq('kaizen_id', kaizenId);

    const { error } = await supabase
      .from('kaizens')
      .delete()
      .eq('id', kaizenId);

    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Kaizen deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};
