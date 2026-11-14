import { cleanString, functionErrorResponse, getSupabaseAdmin, jsonResponse, requireSupabaseUser } from './_shared/supabase-admin.js';
import { assertHttpMethod } from './_shared/api-security.js';
import { assertProcurementPermission, procurementActorFromStaff } from './_shared/procurement-authorization.js';

export const handler = async event => {
  try {
    assertHttpMethod(event, ['GET']);
    const staff = await requireSupabaseUser(event);
    const actor = procurementActorFromStaff(staff);
    assertProcurementPermission(actor, 'view');
    const limit = Math.min(Math.max(Number(event.queryStringParameters?.limit) || 500, 1), 2000);
    const sheet = cleanString(event.queryStringParameters?.sheet, 40);
    let query = getSupabaseAdmin().from('erp_procurement_sheet_rows').select('*').eq('organization_id', staff.organizationId).order('request_date', { ascending: false }).limit(limit);
    if (sheet) query = query.eq('sheet_name', sheet);
    const { data, error } = await query;
    if (error) throw error;
    return jsonResponse(200, { success: true, data: data || [] });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
