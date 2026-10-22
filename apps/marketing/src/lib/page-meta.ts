import { useEffect } from 'react';

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionEl = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionEl?.getAttribute('content') ?? '';
    document.title = title;
    descriptionEl?.setAttribute('content', description);
    return () => {
      document.title = previousTitle;
      descriptionEl?.setAttribute('content', previousDescription);
    };
  }, [title, description]);
}
