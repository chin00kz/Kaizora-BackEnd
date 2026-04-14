import { supabase } from '../config/supabase.js';
import { checkNotSuperAdmin } from '../middleware/auth.js';

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
 * Get all users (Admin / Superadmin only)
 * Superadmin is always visible but marked as protected
 */
export const getAllUsers = async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { profiles } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Update a user's role (Admin / Superadmin only)
 * Superadmin is immune to this action
 */
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['employee', 'management', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ status: 'fail', message: `Invalid role. Allowed: ${validRoles.join(', ')}` });
    }

    // Fetch the target profile first to check if they're superadmin
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) {
      return res.status(403).json({ status: 'fail', message: guard.message });
    }

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
 * Ban or unban a user (Admin / Superadmin only)
 * Superadmin is immune to this action
 */
export const toggleBanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_banned } = req.body;

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) {
      return res.status(403).json({ status: 'fail', message: guard.message });
    }

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
 * Delete a user (Superadmin only)
 * Superadmin cannot delete themselves or another superadmin
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const guard = checkNotSuperAdmin(targetProfile);
    if (guard.blocked) {
      return res.status(403).json({ status: 'fail', message: guard.message });
    }

    // Delete from auth (cascades to profiles via trigger)
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) throw error;

    res.status(200).json({ status: 'success', message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};
