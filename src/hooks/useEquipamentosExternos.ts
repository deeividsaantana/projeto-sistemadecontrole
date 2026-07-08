import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface EquipamentosExternos {
  total: number | null;
  operando: number | null;
  mobilizacao: number | null;
  manutencao: number | null;
  paradas: number | null;
  disponibilidade: number | null;
  fonte?: string;
  atualizadoEm?: string;
}

const initialState: EquipamentosExternos = {
  total: null,
  operando: null,
  mobilizacao: null,
  manutencao: null,
  paradas: null,
  disponibilidade: null,
};

export function useEquipamentosExternos(): EquipamentosExternos {
  const [dados, setDados] = useState<EquipamentosExternos>(initialState);

  useEffect(() => {
    const ref = doc(db, 'sistemarenea_cloud', 'equipamentos_externos');

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDados(initialState);
          return;
        }

        const data = snapshot.data() as Partial<EquipamentosExternos>;
        setDados({
          total: typeof data.total === 'number' ? data.total : null,
          operando: typeof data.operando === 'number' ? data.operando : null,
          mobilizacao: typeof data.mobilizacao === 'number' ? data.mobilizacao : null,
          manutencao: typeof data.manutencao === 'number' ? data.manutencao : null,
          paradas: typeof data.paradas === 'number' ? data.paradas : null,
          disponibilidade: typeof data.disponibilidade === 'number' ? data.disponibilidade : null,
          fonte: data.fonte,
          atualizadoEm: data.atualizadoEm,
        });
      },
      (error) => {
        console.error('Erro ao ler equipamentos externos:', error);
        setDados(initialState);
      }
    );

    return () => unsubscribe();
  }, []);

  return dados;
}
