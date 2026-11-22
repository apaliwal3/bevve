export const userId = '00000000-0000-0000-0000-0000000000aa';
export const otherUserId = '00000000-0000-0000-0000-0000000000bb';
export const barId = '00000000-0000-0000-0000-000000000001';
export const drinkId = '00000000-0000-0000-0000-000000000101';
export const at = '2026-11-22T18:00:00.000Z';
export function venue(overrides = {}) {
  return { id: barId, name: 'Database venue', address: 'Database address', latitude: 45.46, longitude: 9.19,
    is_demo: true, area: null, city: null, vibe: null, image_url: null, opening_hours_label: null, is_popular: false,
    crowd: { score: null, report_count: 0, newest_report_at: null, classification: null },
    bathrooms: { review_count: 0, cleanliness: null, accessibility: null, wait_time: null, accessibility_count: 0, wait_time_count: 0 },
    opinions: { available: false, liked_count: 0, fine_count: 0, disliked_count: 0, total_opinions: 0, liked_percentage: null },
    languages: [], drinks: [], ...overrides };
}
export function impression(value = 'liked', overrides = {}) {
  return { user_id: userId, bar_id: barId, impression: value, eligible_for_community: true, created_at: at, updated_at: at, ...overrides };
}
export const drink = { id: drinkId, name: 'Backend lager', category: 'beer', serving_ml: 330 };
