import { useEffect } from 'react';

export function usePageMeta(title: string, description: string, image?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionEl = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionEl?.getAttribute('content') ?? '';
    const imageEl = document.querySelector('meta[property="og:image"]');
    const previousImage = imageEl?.getAttribute('content') ?? '';
    document.title = title;
    descriptionEl?.setAttribute('content', description);
    if (image && imageEl) imageEl.setAttribute('content', image);
    return () => {
      document.title = previousTitle;
      descriptionEl?.setAttribute('content', previousDescription);
      if (imageEl) imageEl.setAttribute('content', previousImage);
    };
  }, [title, description, image]);
}
