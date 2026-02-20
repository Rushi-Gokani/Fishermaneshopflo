import { sectionRenderer } from '@theme/section-renderer';
import { onDocumentReady, requestIdleCallback } from '@theme/utilities';

const STORAGE_KEY = 'viewedProducts';
const MAX_PRODUCTS = 10;
const SECTION_SELECTOR = '[data-section-type="recently-viewed-products"]';

/**
 * @returns {string[]}
 */
function getStoredProducts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

/**
 * @param {string[]} ids
 */
function storeProducts(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_PRODUCTS)));
}

/**
 * @param {string} sectionId
 * @param {string[]} ids
 */
function buildSearchUrl(sectionId, ids) {
  const shopifyRoot = /** @type {any} */ (window.Shopify)?.routes?.root;
  const baseSearch = Theme?.routes?.search_url || `${shopifyRoot || '/'}search`;
  const url = new URL(baseSearch, window.location.origin);
  url.searchParams.set('q', ids.map((id) => `id:${id}`).join(' OR '));
  url.searchParams.set('resources[type]', 'product');
  url.searchParams.set('section_id', sectionId);
  return url;
}

/**
 * @param {HTMLElement} section
 * @param {string} markup
 */
function renderSectionFromMarkup(section, markup) {
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  const freshSection = /** @type {HTMLElement | null} */ (parsed.querySelector(SECTION_SELECTOR));
  if (!freshSection) return;

  section.innerHTML = freshSection.innerHTML;
  section.dataset.hydrated = 'true';

  // Show the section after products are loaded
  section.style.display = 'block';
}

export const RecentlyViewed = {
  /**
   * @param {string} productId
   */
  addProduct(productId) {
    if (!productId) return;

    const viewed = getStoredProducts().filter((id) => id !== productId);
    viewed.unshift(productId);
    storeProducts(viewed);

    requestIdleCallback(() => this.renderSections(productId));
  },

  clearProducts() {
    localStorage.removeItem(STORAGE_KEY);
  },

  getProducts() {
    return getStoredProducts();
  },

  /**
   * @param {string} [currentProductId]
   */
  renderSections(currentProductId) {
    const ids = getStoredProducts().filter((id) => id !== currentProductId);
    if (!ids.length) return;

    const sections = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SECTION_SELECTOR));
    sections.forEach((section) => {
      if (section.dataset.hydrated === 'true') return;

      const sectionId = section.dataset.sectionId;
      if (!sectionId) return;

      const url = buildSearchUrl(sectionId, ids);
      sectionRenderer
        .getSectionHTML(sectionId, false, url)
        .then((markup) => {
          if (!markup) return;
          renderSectionFromMarkup(section, markup);
        })
        .catch(() => {
          /* no-op: silently ignore failed fetch */
        });
    });
  }
};

onDocumentReady(() => {
  requestIdleCallback(() => RecentlyViewed.renderSections());
});
