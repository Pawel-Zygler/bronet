export const PAGE_SIZE = 15;

/**
 * Dzieli listę na strony. Numer strony jest przycinany do zakresu 1..totalPages,
 * więc po zawężeniu wyników nie da się zostać na nieistniejącej stronie.
 */
export function paginate(items, requestedPage, pageSize = PAGE_SIZE) {
  const list = items || [];
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, list.length);
  return {
    page,
    totalPages,
    startIndex,
    endIndex,
    pageItems: list.slice(startIndex, endIndex),
  };
}
