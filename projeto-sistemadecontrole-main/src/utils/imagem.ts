/** Acima disto a foto começa a ameaçar o bloco de sincronização. */
export const LIMITE_FOTO_BYTES = 400_000;

const LADO_MAXIMO = 1280;
const QUALIDADE = 0.7;

/** Tamanho real de uma data URL base64, sem materializar o binário. */
export const bytesDeDataUrl = (dataUrl: string) => {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  if (!base64) return 0;
  const preenchimento = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - preenchimento);
};

/**
 * Foto grande demais não é só peso: o backup viaja em blocos de 700 kB, então
 * uma foto de celular inteira dentro do JSON quebra a sincronização de todo
 * mundo, não só de quem tirou a foto.
 */
export const validarFoto = (dataUrl: string): string | null => {
  if (!dataUrl.startsWith('data:image/')) return 'O arquivo precisa ser uma imagem.';
  if (bytesDeDataUrl(dataUrl) > LIMITE_FOTO_BYTES) {
    return 'A imagem ficou grande demais mesmo depois de reduzida. Tire a foto com menos zoom ou use outra.';
  }
  return null;
};

const lerComoDataUrl = (arquivo: File) => new Promise<string>((resolve, reject) => {
  const leitor = new FileReader();
  leitor.onload = () => resolve(String(leitor.result || ''));
  leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
  leitor.readAsDataURL(arquivo);
});

/**
 * Reduz a foto no próprio navegador antes de guardar: 1280 px no maior lado e
 * JPEG a 70%. Uma foto de celular sai de vários MB para poucas centenas de kB
 * sem deixar de servir como evidência — e ninguém do campo precisa saber disso.
 */
export const comprimirImagem = async (arquivo: File): Promise<string> => {
  const original = await lerComoDataUrl(arquivo);
  if (typeof document === 'undefined' || typeof Image === 'undefined') return original;

  try {
    const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
      const elemento = new Image();
      elemento.onload = () => resolve(elemento);
      elemento.onerror = () => reject(new Error('Imagem inválida.'));
      elemento.src = original;
    });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagem.width * escala));
    canvas.height = Math.max(1, Math.round(imagem.height * escala));
    const contexto = canvas.getContext('2d');
    if (!contexto) return original;
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const reduzida = canvas.toDataURL('image/jpeg', QUALIDADE);
    // Só troca se realmente ficou menor: PNG pequeno pode crescer como JPEG.
    return bytesDeDataUrl(reduzida) < bytesDeDataUrl(original) ? reduzida : original;
  } catch {
    return original;
  }
};
