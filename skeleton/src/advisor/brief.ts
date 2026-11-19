// The game brief: a few plain lines about the game, so the advice fits it (Requirement A1).
//
//   Name: Ghastly Moves
//   Genre: rhythm
//   Theme: haunted
//   Controls: one press
//   Engine: browser
//   Players: children learning times tables
//   Features:
//   - songs with portals
//   - bosses that throw numbers

export const GENRES = ['runner', 'rhythm', 'platformer', 'quiz', 'maze', 'puzzle', 'shooter', 'racing', 'card', 'story', 'other'] as const;
export type Genre = (typeof GENRES)[number];

export const THEMES = ['haunted', 'space', 'forest', 'underwater', 'neutral'] as const;
export type Theme = (typeof THEMES)[number];

export interface Brief {
  name: string;
  genre: Genre;
  /** The genre as written, when it was not one Marrow knows. */
  genreAsWritten?: string;
  theme: Theme;
  themeAsWritten?: string;
  controls: string;
  engine: string;
  players: string;
  features: string[];
}

/** Words that point to a genre, so "endless runner" or "dungeon crawler" still land somewhere useful. */
const GENRE_WORDS: Record<Exclude<Genre, 'other'>, RegExp> = {
  runner: /run(ner)?|endless|dash/,
  rhythm: /rhythm|music|beat|dance/,
  platformer: /platform|jump and run|metroidvania/,
  quiz: /quiz|trivia|lesson|educat|maths?|spelling/,
  maze: /maze|escape|dungeon|explor|crawler|labyrinth/,
  puzzle: /puzzle|match|logic|sokoban/,
  shooter: /shoot|fps|bullet|arena/,
  racing: /rac(e|ing)|kart|driv/,
  card: /card|deck|board game|solitaire/,
  story: /story|narrative|visual novel|adventure|text/,
};
const THEME_WORDS: Record<Exclude<Theme, 'neutral'>, RegExp> = {
  haunted: /haunt|ghost|spook|horror|halloween|grave|crypt|witch|vampire/,
  space: /space|sci-?fi|star|planet|robot|alien|galax/,
  forest: /forest|wood|nature|garden|jungle|meadow|fairy/,
  underwater: /under ?water|ocean|sea|reef|fish|submarine|aquatic/,
};

const field = (lines: string[], name: string): string | undefined => {
  const re = new RegExp(`^\\s*${name}\\s*:\\s*(.*)$`, 'i');
  for (const line of lines) {
    const m = re.exec(line);
    if (m) return m[1]!.replace(/\([^)]*\)/g, '').trim(); // a note in brackets is for the reader
  }
  return undefined;
};

export class BriefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BriefError';
  }
}

/** Read a brief. Throws BriefError, in plain words, with a line to copy, if it cannot. */
export function parseBrief(text: string): Brief {
  const lines = text.split(/\r?\n/);
  const name = field(lines, 'Name');
  if (!name) throw new BriefError('The brief needs a name. Add a line like:  Name: My Game');
  const rawGenre = (field(lines, 'Genre') ?? '').toLowerCase();
  const rawTheme = (field(lines, 'Theme') ?? '').toLowerCase();
  const genre: Genre =
    (GENRES as readonly string[]).includes(rawGenre) ? (rawGenre as Genre) : ((Object.entries(GENRE_WORDS).find(([, re]) => re.test(rawGenre))?.[0] as Genre | undefined) ?? 'other');
  const theme: Theme =
    (THEMES as readonly string[]).includes(rawTheme) ? (rawTheme as Theme) : ((Object.entries(THEME_WORDS).find(([, re]) => re.test(rawTheme))?.[0] as Theme | undefined) ?? 'neutral');

  // Features: every "- item" (or "* item") after a "Features:" line, up to the next field.
  const features: string[] = [];
  let inFeatures = false;
  for (const line of lines) {
    if (/^\s*features\s*:/i.test(line)) {
      inFeatures = true;
      const inline = line.split(':').slice(1).join(':').trim();
      if (inline) features.push(...inline.split(/[,;]/).map((f) => f.trim()).filter(Boolean));
      continue;
    }
    if (inFeatures) {
      const item = /^\s*[-*]\s+(.*)$/.exec(line);
      if (item) features.push(item[1]!.trim());
      else if (/^\s*\w[\w ]*:/.test(line)) inFeatures = false;
    }
  }

  return {
    name,
    genre,
    ...(rawGenre && genre === 'other' && rawGenre !== 'other' ? { genreAsWritten: rawGenre } : {}),
    theme,
    ...(rawTheme && theme === 'neutral' && rawTheme !== 'neutral' ? { themeAsWritten: rawTheme } : {}),
    controls: field(lines, 'Controls') ?? '',
    engine: field(lines, 'Engine') ?? 'browser',
    players: field(lines, 'Players') ?? '',
    features,
  };
}

/** A starter brief to copy, for a new game. */
export function briefTemplate(name = 'My Game'): string {
  return [
    '# Game brief',
    '',
    'Marrow reads this to suggest accessibility features that fit your game. Change any line; the plan follows.',
    '',
    `Name: ${name}`,
    `Genre: runner        (${GENRES.join(', ')})`,
    `Theme: haunted       (${THEMES.join(', ')})`,
    'Controls: one press',
    'Engine: browser',
    'Players: anyone',
    'Features:',
    '- obstacles to jump',
    '- a score',
    '',
  ].join('\n');
}
