/**
 * Endereço de uma foto do link do campo. As fotos ficam no Storage, que só a
 * equipe logada lê; o pacote do Storage só carrega quando há foto.
 */
export const enderecoDaFoto = async (caminho: string) => {
  if (/^(data:|https?:)/.test(caminho)) return caminho;
  const [{ getDownloadURL, ref }, { storage }] = await Promise.all([import('firebase/storage'), import('../firebaseStorage')]);
  return getDownloadURL(ref(storage, caminho));
};
