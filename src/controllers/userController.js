import { supabase } from '../config/supabase.js';
import { checkNotSuperAdmin } from '../middleware/auth.js';
import { getCachedData } from '../utils/cache.js';

/**
 * Get current user's own profile
 */
export const getMyProfile = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { profile } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Update current user's own profile
 */
export const updateMyProfile = async (req, res) => {
  try {
    const { full_name, department_id } = req.body;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ full_name, department_id })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { profile } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

// ─── Admin-Only Functions ───────────────────────────────────────────────────

/**
 * Create a new user (Admin / Superadmin only)
 * Bypasses email confirmation using service role
 */
export const adminCreateUser = async (req, res) => {
  try {
    const { email, password, full_name, role, department_id } = req.body;

    const validRoles = ['employee', 'qdm', 'hod', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ status: 'fail', message: `Invalid role. Allowed: ${validRoles.join(', ')}` });
    }

    // 1. Create user in Auth (admin-created users skip email confirmation & are pre-approved)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) throw authError;

    // 2. Profile is automatically created by the DB trigger, but we need to update role/dept
    // Admin-created users are pre-approved (is_approved = true)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({ 
        role: role || 'employee', 
        department_id: department_id || null,
        full_name: full_name,
        is_approved: true
      })
      .eq('id', authUser.user.id)
      .select()
      .single();

    if (profileError) throw profileError;

    res.status(201).json({ status: 'success', data: { user: profile } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Get all users (Admin / Superadmin only)
 */
export const getAllUsers = async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const departments = await getCachedData('departments', async () => {
      const { data } = await supabase.from('departments').select('id, name');
      return data || [];
    });
    
    const deptMap = new Map((departments || []).map(d => [d.id, d]));

    // Map department names manually via O(1) hash map
    const mappedProfiles = profiles.map(profile => {
      const dept = deptMap.get(profile.department_id);
      return {
        ...profile,
        departments: dept ? { name: dept.name } : null
      };
    });

    res.status(200).json({ status: 'success', data: { profiles: mappedProfiles } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Update a user's role (Admin / Superadmin only)
 */
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['employee', 'qdm', 'hod', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid role' });
    }

    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) return res.status(403).json({ status: 'fail', message: guard.message });

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { profile } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Assign user to a department (Admin / Superadmin only)
 */
export const assignDepartment = async (req, res) => {
  try {
    const { userId } = req.params;
    const { department_id } = req.body;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ department_id })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { profile } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Get statistics for a specific user (Userwise Dashboard)
 */
export const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch Kaizen counts by status
    const { data: kaizens, error } = await supabase
      .from('kaizens')
      .select('status')
      .eq('submitted_by', userId);

    if (error) throw error;

    const stats = {
      totalSubmissions: kaizens.length,
      approved: kaizens.filter(k => k.status === 'approved').length,
      pending: kaizens.filter(k => k.status === 'pending').length,
      rejected: kaizens.filter(k => k.status === 'rejected').length,
    };

    res.status(200).json({ status: 'success', data: { stats } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Ban or unban a user
 */
export const toggleBanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_banned } = req.body;

    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) return res.status(403).json({ status: 'fail', message: guard.message });

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ is_banned })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ status: 'success', data: { profile } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) return res.status(403).json({ status: 'fail', message: guard.message });

    // To prevent foreign key constraint errors when deleting a user, we should delete their associated data first (optional but safer if cascade is not enabled)
    await supabase.from('comments').delete().eq('user_id', userId);
    await supabase.from('kaizens').delete().eq('submitted_by', userId);

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      // Sometimes auth deletion fails due to other constraints.
      throw error;
    }
    res.status(200).json({ status: 'success', message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Update user details (Admin / Superadmin only)
 */
export const adminUpdateUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { full_name, email } = req.body;

    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) return res.status(403).json({ status: 'fail', message: guard.message });

    // Update email in Auth if provided
    if (email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email });
      if (authError) throw authError;
    }

    // Update profile
    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (email) updateData.email = email;

    if (Object.keys(updateData).length > 0) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ status: 'success', data: { profile } });
    }

    res.status(200).json({ status: 'success', message: 'No profile details updated.' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Reset user password (Admin / Superadmin only)
 */
export const adminResetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) return res.status(403).json({ status: 'fail', message: guard.message });

    if (!password) return res.status(400).json({ status: 'fail', message: 'Password is required' });

    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Approve or un-approve a user (Admin / Superadmin only)
 */
export const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_approved } = req.body;

    const { data: targetProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) return res.status(403).json({ status: 'fail', message: guard.message });

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ is_approved })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ status: 'success', data: { profile } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};
