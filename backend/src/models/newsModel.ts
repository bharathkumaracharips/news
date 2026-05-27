export enum NewsCategory {
  POLITICS = 'Politics & Governance',
  BUSINESS = 'Business & Economy',
  CRIME = 'Crime & Justice',
  WORLD = 'World Affairs',
  TECHNOLOGY = 'Technology & Infrastructure',
  SCIENCE = 'Science & Environment',
  SECURITY = 'National Security & Defense',
}

export interface Article {
  id: string;
  title: string;
  excerpt?: string;
  category: NewsCategory;
  source: string;
  time: string;
  isTopStory?: boolean;
  isTopDevelopment?: boolean;
}
