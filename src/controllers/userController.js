import { supabase } from '../config/supabase.js';

/**
 * Get current user profile
 */
export const getMyProfile = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      data: { profile }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

/**
 * Update current user profile
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

    res.status(200).json({
      status: 'success',
      data: { profile }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};
