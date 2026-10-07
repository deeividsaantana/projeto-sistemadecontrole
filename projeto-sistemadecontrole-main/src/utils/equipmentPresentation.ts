import {
  Construction,
  Droplets,
  Forklift,
  Hammer,
  Truck,
  Tractor,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Equipamento } from '../types';

export type EquipmentFamily =
  | 'basculante'
  | 'escavadeira'
  | 'pesada'
  | 'perfuratriz'
  | 'apoio'
  | 'carga'
  | 'generico';

export interface EquipmentPresentation {
  family: EquipmentFamily;
  Icon: LucideIcon;
  label: string;
}

const FAMILY_ICONS: Record<EquipmentFamily, LucideIcon> = {
  basculante: Truck,
  escavadeira: Construction,
  pesada: Tractor,
  perfuratriz: Hammer,
  apoio: Droplets,
  carga: Forklift,
  generico: Wrench,
};

export const EQUIPMENT_FAMILY_LABELS: Record<EquipmentFamily, string> = {
  basculante: 'Caminhão basculante',
  escavadeira: 'Escavadeira',
  pesada: 'Máquina pesada',
  perfuratriz: 'Perfuratriz',
  apoio: 'Apoio e abastecimento',
  carga: 'Carga e transporte',
  generico: 'Equipamento',
};

/** Ordem em que as famílias aparecem nos filtros e relatórios. */
export const EQUIPMENT_FAMILIES = Object.keys(FAMILY_ICONS) as EquipmentFamily[];

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase('pt-BR');

/**
 * Classifica o equipamento pela descrição livre do cadastro. A família é o
 * que dá o ícone na tela e agrupa os relatórios — a operação reconhece a
 * máquina pelo desenho antes de ler o prefixo.
 *
 * A ordem dos testes importa: "caminhão pipa" precisa cair em apoio, não em
 * basculante, e "caminhão munck" em carga.
 */
export const classifyEquipment = (equipment?: Pick<Equipamento, 'prefixo' | 'nome' | 'tipo' | 'familia'>): EquipmentFamily => {
  const text = normalize(`${equipment?.prefixo || ''} ${equipment?.familia || ''} ${equipment?.tipo || ''} ${equipment?.nome || ''}`);
  if (!text.trim()) return 'generico';

  if (/pipa|comboio|lubrific|abastec|tanque/.test(text)) return 'apoio';
  if (/munck|guindaste|prancha|cegonha|empilhadeira|plataforma/.test(text)) return 'carga';
  if (/perfuratriz|rompedor|martelo|bate.?estaca|cravacao/.test(text)) return 'perfuratriz';
  if (/escavadeira|retroescavadeira|carregadeira|pa\s?carregadeira/.test(text)) return 'escavadeira';
  if (/trator|motoniveladora|patrol|rolo|compactador|esteira|vibroacabadora|usina|britador/.test(text)) return 'pesada';
  if (/basculante|cacamba|^cb[\s-]?\d|\bcb[\s-]?\d/.test(text)) return 'basculante';
  if (/caminhao|carreta|cavalo|truck|toco|van|onibus/.test(text)) return 'carga';

  return 'generico';
};

export const presentEquipment = (
  equipment?: Pick<Equipamento, 'prefixo' | 'nome' | 'tipo' | 'familia'>,
): EquipmentPresentation => {
  const family = classifyEquipment(equipment);
  return {
    family,
    Icon: FAMILY_ICONS[family],
    // O tipo cadastrado é mais específico que o rótulo da família; só cai no
    // genérico quando o cadastro não tem nem tipo nem nome.
    label: family === 'generico'
      ? (equipment?.tipo || equipment?.nome || EQUIPMENT_FAMILY_LABELS.generico)
      : EQUIPMENT_FAMILY_LABELS[family],
  };
};

export const equipmentFamilyIcon = (family: EquipmentFamily): LucideIcon => FAMILY_ICONS[family];
