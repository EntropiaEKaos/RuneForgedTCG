export interface FormatDef {
  id: string;
  name: string;
  description: string;
  collectionKeys: string[];
  active: boolean;
  rankedEligible: boolean;
  rotationAt?: string | null;
}

export const BUILTIN_FORMATS: FormatDef[] = [
  { id: "vanilla", name: "Vanilla", description: "Somente a coleção inaugural Vanilla.", collectionKeys: ["vanilla"], active: true, rankedEligible: false },
  { id: "standard", name: "Standard", description: "Formato rotativo principal. Hoje contém Vanilla e está preparado para próximas coleções.", collectionKeys: ["vanilla"], active: true, rankedEligible: false },
  { id: "eternal", name: "Eternal", description: "Todas as coleções publicadas são legais.", collectionKeys: ["*"], active: true, rankedEligible: false },
  { id: "ranked-precon", name: "Ranked Precon", description: "Pool competitivo imutável de decks pré-construídos certificados por matriz determinística.", collectionKeys: ["vanilla"], active: true, rankedEligible: true },
];
