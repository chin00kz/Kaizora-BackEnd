import { supabase } from '../config/supabase.js';

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
    const { role, id: userId, department_id: userDeptId } = req.user;
    let query = supabase.from('kaizens').select('*, profiles(full_name, email), departments(name)');

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

    res.status(200).json({ status: 'success', data: { kaizens } });
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
      .select('*, profiles(full_name, email), departments(name), comments(*)')
      .eq('id', kaizenId)
      .single();

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { kaizen } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};
