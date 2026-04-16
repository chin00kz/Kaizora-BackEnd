import { supabase } from '../config/supabase.js';
import { getCachedData } from '../utils/cache.js';

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

    // Use cached and mapped queries to prevent N+1 hits and array lookup lag
    const profiles = await getCachedData('profiles_basic', async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, avatar_url');
      return data || [];
    });

    const departments = await getCachedData('departments', async () => {
      const { data } = await supabase.from('departments').select('id, name');
      return data || [];
    });

    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const deptMap = new Map(departments.map(d => [d.id, d]));

    const mappedKaizens = kaizens.map(k => {
      const submitter = profileMap.get(k.submitted_by);
      const reviewer = profileMap.get(k.reviewed_by);
      const dept = deptMap.get(k.department_id);

      return {
        ...k,
        departments: dept ? { name: dept.name } : null,
        profiles: submitter ? { full_name: submitter.full_name, email: submitter.email, avatar_url: submitter.avatar_url } : null,
        submitter: submitter || null,
        reviewer: reviewer || null
      };
    });

    res.status(200).json({ status: 'success', data: { kaizens: mappedKaizens } });
  } catch (error) {
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

    // Utilize caching and maps for relation resolution
    const profiles = await getCachedData('profiles_basic', async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, avatar_url');
      return data || [];
    });

    const departments = await getCachedData('departments', async () => {
      const { data } = await supabase.from('departments').select('id, name');
      return data || [];
    });

    // Attempt to grab comments if the table exists
    const { data: comments } = await supabase.from('comments').select('*').eq('kaizen_id', kaizenId).order('created_at', { ascending: true });

    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const deptMap = new Map(departments.map(d => [d.id, d]));

    const submitter = profileMap.get(kaizen.submitted_by);
    const reviewer = profileMap.get(kaizen.reviewed_by);
    const dept = deptMap.get(kaizen.department_id);

    const mappedComments = comments?.map(c => {
      const commenter = profileMap.get(c.user_id);
      return {
        ...c,
        profiles: commenter ? { full_name: commenter.full_name, email: commenter.email } : null
      };
    }) || [];

    const mappedKaizen = {
      ...kaizen,
      departments: dept ? { name: dept.name } : null,
      profiles: submitter ? { full_name: submitter.full_name, email: submitter.email, avatar_url: submitter.avatar_url } : null,
      submitter: submitter || null,
      reviewer: reviewer || null,
      comments: mappedComments
    };

    res.status(200).json({ status: 'success', data: { kaizen: mappedKaizen } });
  } catch (error) {
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
      score,
      reviewed_by: reviewerId,
      updated_at: new Date().toISOString()
    };

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
      .select('*, profiles(full_name, email)')
      .single();

    if (error) throw error;

    res.status(201).json({ status: 'success', data: { comment } });
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
