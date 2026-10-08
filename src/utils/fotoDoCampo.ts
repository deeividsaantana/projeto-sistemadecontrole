/**
 * Endereço de uma foto do link do campo. As fotos ficam no Storage, que só a
 * equipe logada lê; o pacote do Storage só carrega quando há foto.
 */
export const enderecoDaFoto = async (caminho: string) => {
  if (/^(data:|https?:)/.test(caminho)) return caminho;
  const bucket = String(import.meta.env.VITE_SUPABASE_OPERATIONAL_ATTACHMENTS_BUCKET || 'operational-attachments');
  const { data, error } = await (await import('../supabase/client')).getSupabaseClient().storage
    .from(bucket)
    .createSignedUrl(caminho, 3600);
  if (error || !data?.signedUrl) throw error || new Error('Não foi possível gerar o endereço da foto.');
  return data.signedUrl;
};
