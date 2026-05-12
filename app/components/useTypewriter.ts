import { useEffect, useState } from 'react';

export function useTypewriter(text: string, baseSpeed = 50, start = true): string {
  const [out, setOut] = useState('');

  useEffect(() => {
    if (!start) {
      setOut('');
      return;
    }
    setOut('');
    let i = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function tick() {
      if (cancelled || i >= text.length) return;
      i += 1;
      setOut(text.slice(0, i));
      const c = text[i - 1];
      // jitter so it feels typed, not metronomic
      let delay = baseSpeed + (Math.random() * 20 - 8);
      if (c === '.' || c === '?' || c === '!') delay += 180;
      else if (c === ',' || c === ';' || c === ':') delay += 80;
      else if (c === '\n') delay += 120;
      else if (c === ' ') delay -= 5;
      timer = setTimeout(tick, Math.max(8, delay));
    }
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [text, baseSpeed, start]);

  return out;
}
