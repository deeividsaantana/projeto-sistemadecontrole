# SDD ledger — plan: docs/superpowers/plans/2026-09-24-fase-2-modo-campo-redesign.md

## Pre-flight scan

Task interfaces:
- Task 1 (Presença) → Task 2 (ModoCampo): filterEquipesByFrente(), sortEquipesByNome(), calculatePresencaResumo()
- Task 2 (ModoCampo) → Task 3 (Usability): ModoCampo component renders with PageHeader, Filtros, Cards, DataTable
- Task 3 (Tests) → Task 4 (Verify): No interface dependencies

Status: Clean, all interfaces align.

## Tasks
- [x] Task 1: Extrair e testar funções de presença
- [ ] Task 2: Refatorar ModoCampo.tsx para novo padrão
- [ ] Task 3: Testes e2e de usabilidade
- [ ] Task 4: Verificação final e merge

Task 1: complete (commits ca33182..e360481, tests: modoCampoPresenca.test.ts → 4/4 pass)
- ✅ Funções puras: filterEquipesByFrente, sortEquipesByNome, calculatePresencaResumo
- ✅ Interface PresencaResumo definida
- ✅ 4 testes validando cada função
- ✅ Lint OK, build OK
