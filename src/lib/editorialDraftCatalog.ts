import type { Project } from './portfolioService';
import { editorialDrafts } from './projectStoryDrafts.ts';

// Read-only local catalog. This never writes to Firestore or changes public routes.
export const editorialDraftCatalog = [
  {
    "id": 1,
    "key": "offick",
    "title": "OFFICK",
    "year": "2026",
    "films": []
  },
  {
    "id": 2,
    "key": "runway collection",
    "title": "Runway Collection",
    "year": "2026",
    "films": []
  },
  {
    "id": 5,
    "key": "doya",
    "title": "Doya",
    "year": "2024",
    "films": []
  },
  {
    "id": 6,
    "key": "foudre",
    "title": "Foudre",
    "year": "2024",
    "films": []
  },
  {
    "id": 7,
    "key": "vaek",
    "title": "Vaek",
    "year": "2024",
    "films": []
  },
  {
    "id": 8,
    "key": "identity camouflager",
    "title": "Identity Camouflager",
    "year": "2024",
    "films": [
      {
        "url": "https://res.cloudinary.com/dwxglojis/video/upload/v1776583425/portfolio/gezbvmkf3tu4kboqhivd.mp4",
        "type": "video"
      }
    ]
  },
  {
    "id": 9,
    "key": "breathless",
    "title": "Breathless",
    "year": "2025",
    "films": [
      {
        "url": "https://res.cloudinary.com/dwxglojis/video/upload/v1776521345/portfolio/sxrzhuw2tgkyvw1wdos9.mp4",
        "type": "video"
      }
    ]
  },
  {
    "id": 10,
    "key": "ev charger",
    "title": "EV charger",
    "year": "2024",
    "films": []
  },
  {
    "id": 11,
    "key": "d-light",
    "title": "D-Light",
    "year": "2023",
    "films": []
  },
  {
    "id": 12,
    "key": "exit",
    "title": "EXIT",
    "year": "2024",
    "films": []
  },
  {
    "id": 13,
    "key": "reckless",
    "title": "Reckless",
    "year": "2026",
    "films": []
  },
  {
    "id": 14,
    "key": "miro",
    "title": "miro",
    "year": "2026",
    "films": []
  }
];

export function draftProjectById(id: string): (Project & { category: string }) | undefined {
  const entry = editorialDraftCatalog.find(item => String(item.id) === id);
  const story = entry && editorialDrafts[entry.key];
  if (!entry || !story) return undefined;
  return { id: entry.id, title: entry.title, year: entry.year, category: 'portfolio',
    desc: story.intro.ko, image: story.hero.src, aspect: 'aspect-[3/4]',
    media: entry.films.map(film => ({ url: film.url, type: 'video' as const })) };
}

