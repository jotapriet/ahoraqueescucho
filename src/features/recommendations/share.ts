import type { Review, ReviewsPage } from "./schema";

export function recommendationPath(albumId: string, reviewId: string) {
  return `/albumes/${albumId}?resena=${reviewId}#resena-${reviewId}`;
}

export function prioritizeSharedReview(page: ReviewsPage, review: Review | null): ReviewsPage {
  return review ? { ...page, reviews: [review, ...page.reviews.filter(item => item.id !== review.id)] } : page;
}
