import { supabase } from '../config/supabase.js';
import { logAuditAction } from './auditController.js';

/**
 * Get all departments
 */
export const getAllDepartments = async (req, res) => {
  try {
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.status(200).json({ status: 'success', data: { departments } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Create a new department (Admin only)
 */
export const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;

    const { data: department, error } = await supabase
      .from('departments')
      .insert([{ name, description }])
      .select()
      .single();

    if (error) throw error;

    await logAuditAction(
      req.user.id, 
      req.profile?.full_name || req.profile?.username, 
      'CREATE_DEPARTMENT', 
      'departments', 
      department.id, 
      { name }
    );

    res.status(201).json({ status: 'success', data: { department } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Update a department (Admin only)
 */
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const { data: department, error } = await supabase
      .from('departments')
      .update({ name, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAuditAction(
      req.user.id, 
      req.profile?.full_name || req.profile?.username, 
      'UPDATE_DEPARTMENT', 
      'departments', 
      id, 
      { name }
    );

    res.status(200).json({ status: 'success', data: { department } });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

/**
 * Delete a department (Admin only)
 */
export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logAuditAction(
      req.user.id, 
      req.profile?.full_name || req.profile?.username, 
      'DELETE_DEPARTMENT', 
      'departments', 
      id, 
      {}
    );

    res.status(200).json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};
