import { describe, expect, it } from 'vitest';
import { createSessionLog, type Attempt } from '../src/log';

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  level: 7,
  obstacle: 1,
  kind: 'grave',
  result: 'cleared',
  offsetMs: 12.34,
  windowMs: 716.67,
  speed: 'slow',
  picture: true,
  ...over,
});

describe('session log (Req 10)', () => {
  it('records each attempt and hands back copies', () => {
    const log = createSessionLog();
    log.record(attempt());
    const [first] = log.entries();
    first!.kind = 'changed';
    expect(log.entries()[0]!.kind).toBe('grave');
  });

  it('exports CSV with a header, picture mode, ms values and an empty offset when nothing was pressed', () => {
    const log = createSessionLog();
    log.record(attempt());
    log.record(attempt({ obstacle: 2, kind: 'fence', result: 'none', offsetMs: null, picture: false, speed: 'fast', windowMs: 430 }));
    expect(log.toCsv()).toBe(
      [
        'attempt,level,obstacle,kind,result,offset_ms,window_ms,speed,picture',
        '1,7,1,grave,cleared,12.3,716.7,slow,on',
        '2,7,2,fence,none,,430,fast,off',
        '',
      ].join('\n'),
    );
  });

  it('keeps negative offsets as numbers, quotes awkward text and defuses spreadsheet formulas', () => {
    const log = createSessionLog();
    log.record(attempt({ offsetMs: -250.5, kind: 'big, "bad" crypt' }));
    log.record(attempt({ kind: '=SUM(A1)' }));
    const lines = log.toCsv().split('\n');
    expect(lines[1]).toBe('1,7,1,"big, ""bad"" crypt",cleared,-250.5,716.7,slow,on');
    expect(lines[2]).toContain(",'=SUM(A1),");
  });

  it('summarises completion, falls and distance from the beat', () => {
    const log = createSessionLog();
    expect(log.summary()).toEqual({ attempts: 0, cleared: 0, falls: 0, meanAbsOffsetMs: null });
    log.record(attempt({ offsetMs: 100 }));
    log.record(attempt({ result: 'early', offsetMs: -300 }));
    log.record(attempt({ result: 'none', offsetMs: null }));
    expect(log.summary()).toEqual({ attempts: 3, cleared: 1, falls: 2, meanAbsOffsetMs: 200 });
  });

  it('clears', () => {
    const log = createSessionLog();
    log.record(attempt());
    log.clear();
    expect(log.entries()).toEqual([]);
    expect(log.toCsv()).toBe('attempt,level,obstacle,kind,result,offset_ms,window_ms,speed,picture\n');
  });
});
