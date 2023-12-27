import { createContext } from 'preact';

// Create a Context for the character ID
export const CharacterContext = createContext({
  characterId: '',
  setCharacterId: (id: string) => {}
});
