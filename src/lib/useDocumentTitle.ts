import { useEffect } from 'react';

import { isNative } from '@/lib/animation';

// Sets the browser tab title while a screen wants to say something, and puts
// the original back when it stops.
//
// This is the app's only way to reach someone who is not currently looking at
// it, and it stays inside the project's rule against notifications on purpose:
// nothing pops up, nothing buzzes, nothing is sent anywhere. A tab that reads
// "⚔️ vs Miki" is only visible to somebody who already has the tournament
// open — which at a table is exactly the person who needs to know their match
// has been paired.
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (isNative || typeof document === 'undefined') return;
    if (!title) return;

    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
