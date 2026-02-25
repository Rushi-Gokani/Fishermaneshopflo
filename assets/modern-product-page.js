/**
 * Modern Product Page JavaScript
 * Handles gallery, zoom, variants, quantity, and add to cart
 */

import Drift from '@theme/drift-zoom';
import { mediaQueryLarge, isDesktopBreakpoint } from '@theme/utilities';

class ModernProductPage {
  constructor(section) {
    this.section = section;
    this.container = section; // The section element IS the container
    this.productJSON = JSON.parse(section.querySelector('[data-product-json]').textContent);

    this.initGallery();
    this.initDriftZoom();
    this.initVariants();
    this.initQuantity();
    this.initAddToCart();
    this.initPickupAvailability();
    this.initReadMore();
    this.initTableScroll();
    this.initThumbnailNav();
  }


  // ========== Gallery ==========
  initGallery() {
    this.slides = this.container.querySelectorAll('.modern-gallery__slide');
    this.thumbnails = this.container.querySelectorAll('.modern-gallery__thumbnail');
    this.prevBtn = this.container.querySelector('.modern-gallery__nav--prev');
    this.nextBtn = this.container.querySelector('.modern-gallery__nav--next');
    this.currentIndex = 0;

    // Thumbnail clicks
    this.thumbnails.forEach((thumb, index) => {
      thumb.addEventListener('click', () => this.goToSlide(index));
    });

    // Arrow navigation
    this.prevBtn?.addEventListener('click', () => this.previousSlide());
    this.nextBtn?.addEventListener('click', () => this.nextSlide());

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.previousSlide();
      if (e.key === 'ArrowRight') this.nextSlide();
    });

    // Touch swipe support
    this.initSwipe();
  }

  goToSlide(index) {
    if (index < 0) index = this.slides.length - 1;
    if (index >= this.slides.length) index = 0;

    this.currentIndex = index;

    // Update slides
    this.slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });

    // Update thumbnails
    this.thumbnails.forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === index);
      thumb.setAttribute('aria-current', i === index ? 'true' : 'false');
    });

    // Update counter
    const counter = this.container.querySelector('[data-current-index]');
    if (counter) counter.textContent = index + 1;

    // Scroll thumbnail into view
    this.scrollThumbnailIntoView(index);

    // Update zoom image
    this.#setupDrift();
  }

  previousSlide() {
    this.goToSlide(this.currentIndex - 1);
  }

  nextSlide() {
    this.goToSlide(this.currentIndex + 1);
  }

  initSwipe() {
    const viewport = this.container.querySelector('.modern-gallery__viewport');
    const mainGallery = this.container.querySelector('.modern-gallery__main');
    if (!viewport || !mainGallery) return;

    let startX = 0;
    let endX = 0;
    let isDragging = false;

    // Touch events for mobile
    viewport.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      endX = e.touches[0].clientX;
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      const diff = startX - endX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) this.nextSlide();
        else this.previousSlide();
      }
    });

    // Mouse events for desktop drag
    let isMouseDown = false;

    mainGallery.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      startX = e.clientX;
      mainGallery.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      endX = e.clientX;
    });

    document.addEventListener('mouseup', () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      mainGallery.style.cursor = '';
      const diff = startX - endX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) this.nextSlide();
        else this.previousSlide();
      }
    });

    // Prevent image drag
    viewport.addEventListener('dragstart', (e) => {
      e.preventDefault();
    });
  }

  // ========== Thumbnail Navigation ==========
  initThumbnailNav() {
    this.thumbScroller = this.container.querySelector('[data-thumbnails-scroller]');
    this.thumbPrevBtn = this.container.querySelector('[data-thumbnails-nav="prev"]');
    this.thumbNextBtn = this.container.querySelector('[data-thumbnails-nav="next"]');

    if (!this.thumbScroller) return;

    this.thumbPrevBtn?.addEventListener('click', () => {
      this.thumbScroller.scrollBy({ left: -200, behavior: 'smooth' });
    });

    this.thumbNextBtn?.addEventListener('click', () => {
      this.thumbScroller.scrollBy({ left: 200, behavior: 'smooth' });
    });

    // Update button states on scroll
    this.thumbScroller.addEventListener('scroll', () => this.updateThumbnailNavButtons());
    window.addEventListener('resize', () => this.updateThumbnailNavButtons());
    this.updateThumbnailNavButtons();
  }

  updateThumbnailNavButtons() {
    if (!this.thumbScroller || !this.thumbPrevBtn || !this.thumbNextBtn) return;

    const { scrollLeft, scrollWidth, clientWidth } = this.thumbScroller;
    this.thumbPrevBtn.disabled = scrollLeft <= 2;
    this.thumbNextBtn.disabled = scrollLeft + clientWidth >= scrollWidth - 2;

    // Hide arrows if not scrollable
    const isScrollable = scrollWidth > clientWidth + 2;
    this.thumbPrevBtn.style.display = isScrollable ? '' : 'none';
    this.thumbNextBtn.style.display = isScrollable ? '' : 'none';
  }

  scrollThumbnailIntoView(index) {
    const thumb = this.thumbnails[index];
    if (!thumb || !this.thumbScroller) return;

    const scrollerRect = this.thumbScroller.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();

    if (thumbRect.left < scrollerRect.left || thumbRect.right > scrollerRect.right) {
      thumb.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  // ========== Drift Hover Zoom ==========
  initDriftZoom() {
    this.driftInstances = [];
    this.zoomWrapperSelector = this.container.querySelector('.modern-gallery__main')?.dataset.zoomWrapper;
    mediaQueryLarge.addEventListener('change', () => this.#setupDrift());
    this.#setupDrift();
  }

  #setupDrift() {
    this.#destroyDrift();

    const gallery = this.container.querySelector('.modern-gallery__main');
    if (!gallery) return;
    if (gallery.dataset.zoomEnabled !== 'true') return;
    if (!isDesktopBreakpoint()) return;

    const paneContainer = document.querySelector(this.zoomWrapperSelector || '');
    if (!paneContainer) return;

    const images = this.container.querySelectorAll('.modern-gallery__image[data-zoom]');
    if (!images.length) return;

    const useInlinePane = window.innerWidth < 1024;
    const inlineOffsetY = useInlinePane ? -85 : 0;

    this.driftInstances = Array.from(images).map(
      (image) =>
        new Drift(image, {
          containInline: true,
          inlinePane: useInlinePane,
          hoverBoundingBox: !useInlinePane,
          handleTouch: false,
          inlineOffsetY,
          paneContainer,
        })
    );
  }

  #destroyDrift() {
    this.driftInstances?.forEach((instance) => instance.destroy?.());
    this.driftInstances = [];
  }

  // ========== Variants ==========
  initVariants() {
    this.variantSelects = this.container.querySelector('[data-variant-picker]');
    if (!this.variantSelects) return;

    this.variantInputs = this.variantSelects.querySelectorAll('input[name^="option"]');

    this.variantInputs.forEach(input => {
      input.addEventListener('change', () => this.handleVariantChange());
    });

    // Swatch selection - the radio input is a SIBLING of the label, not a child
    this.variantSelects.querySelectorAll('.modern-variant-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        e.preventDefault();
        // Input is the previous sibling of the label/swatch
        const input = swatch.previousElementSibling;
        if (input && input.type === 'radio') {
          input.checked = true;

          // Update visual states for all swatches in this option group
          const optionWrapper = swatch.closest('.modern-variant-options');
          if (optionWrapper) {
            optionWrapper.querySelectorAll('.modern-variant-swatch').forEach(sw => {
              const swInput = sw.previousElementSibling;
              if (swInput && swInput.type === 'radio') {
                sw.classList.toggle('is-selected', swInput.checked);
              }
            });
          }

          this.handleVariantChange();
        }
      });

      swatch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          swatch.click();
        }
      });
    });
  }

  handleVariantChange() {
    const selectedOptions = Array.from(this.variantInputs)
      .filter(input => input.checked)
      .map(input => input.value);

    // Update selected option labels
    selectedOptions.forEach((value, index) => {
      const label = this.container.querySelector(`.modern-variant-selected-value[data-option-index="${index}"]`);
      if (label) label.textContent = value;
    });

    const variant = this.productJSON.variants.find(v => {
      return selectedOptions.every((option, index) => {
        return v.options[index] === option;
      });
    });

    if (variant) {
      this.updateVariantState(variant);
    } else {
      // Variant not found (e.g. invalid combination)
      // Create a dummy variant object with the selected options so we can still update availability visuals
      const dummyVariant = {
        id: null,
        available: false,
        options: selectedOptions,
        price: 0,
        compare_at_price: null
      };

      this.updateVariantState(dummyVariant);
    }
  }

  updateVariantState(variant) {
    // Update image if variant has a featured media
    if (variant.id && variant.featured_media) {
      const mediaId = variant.featured_media.id.toString();
      const targetSlide = this.container.querySelector('.modern-gallery__slide[data-media-id="' + mediaId + '"]');

      if (targetSlide) {
        const slideIndex = parseInt(targetSlide.getAttribute('data-index'));
        this.goToSlide(slideIndex);
      }
    }

    // Update price (only for real variants)
    const priceWrapper = this.container.querySelector('.modern-product__price-wrapper');
    if (priceWrapper && variant.id) {

      const priceEl = priceWrapper.querySelector('[data-product-price]');
      const compareEl = priceWrapper.querySelector('[data-compare-price]');
      const saveBadge = priceWrapper.querySelector('[data-save-badge]');
      const soldBadge = priceWrapper.querySelector('.modern-product__sold-badge');

      // FALLBACK: Try variant compare_at_price first, then product-level
      let comparePrice = variant.compare_at_price;
      if (comparePrice === null || comparePrice === undefined || comparePrice === 0 || comparePrice === '') {
        comparePrice = this.productJSON.compare_at_price || 0;
      }

      const hasDiscount = comparePrice > 0 && comparePrice > variant.price;
      const discountPercent = hasDiscount ? Math.round((comparePrice - variant.price) / comparePrice * 100) : 0;

      if (priceEl) {
        priceEl.textContent = this.formatMoney(variant.price);
        priceEl.classList.toggle('modern-product__price--sale', hasDiscount);
      }

      if (compareEl) {
        if (hasDiscount) {
          compareEl.textContent = this.formatMoney(comparePrice);
          compareEl.style.display = '';
        } else {
          compareEl.style.display = 'none';
        }
      }

      if (saveBadge) {
        if (hasDiscount) {
          saveBadge.textContent = `Save ${discountPercent}%`;
          saveBadge.style.display = '';
        } else {
          saveBadge.style.display = 'none';
        }
      }

      if (soldBadge) {
        soldBadge.style.display = variant.available ? 'none' : '';
      }
    }


    // Update Add to Cart button state
    const addToCart = this.container.querySelector('[data-add-to-cart]');
    if (addToCart) {
      const btnText = addToCart.querySelector('.modern-add-to-cart__default');
      if (btnText) {
        if (!variant.id) {
           btnText.textContent = 'Unavailable';
        } else {
           btnText.textContent = variant.available
            ? (window.theme?.strings?.addToCart || 'Add to cart')
            : (window.theme?.strings?.soldOut || 'Sold out');
        }
      }
      addToCart.disabled = !variant.available;

      // Update data attributes for Globo
      if (variant.id) {
        addToCart.setAttribute('data-variant-id', variant.id);
      } else {
        addToCart.removeAttribute('data-variant-id');
      }
      addToCart.setAttribute('data-product-available', variant.available);
    }

    // Update variant input value
    const variantInput = this.container.querySelector('input[name="id"]');
    if (variantInput && variant.id) {
      variantInput.value = variant.id;
    }

    // Update hidden select for Globo and other apps
    const variantSelect = this.container.querySelector('select[name="id"], [data-product-select]');
    if (variantSelect && variant.id) {
      variantSelect.value = variant.id;
      // Trigger change event for Globo Preorder/Back-in-Stock app
      variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Update form data attributes for Globo
    const form = this.container.querySelector('form[data-product-form]');
    if (form && variant.id) {
      form.setAttribute('data-product-variant-id', variant.id);
    }

    // Trigger Globo Back-in-Stock events with a slight delay
    // This ensures all DOM updates are complete before Globo processes

    // setTimeout(() => this.triggerGloboEvents(variant), 50); => ERROR 

    if(typeof Globo != 'undefined' && typeof Globo.Preorder != 'undefined'){
      Globo.Preorder.initPreorder();
    }

    // Update availability
    this.updateVariantAvailability(variant);

    // Update pickup availability
    const pickup = this.container.querySelector('pickup-availability');
    if (pickup && variant.id) {
      pickup.fetchAvailability(variant.id);
    }
  }

  // Trigger events for Globo Preorder/Back-in-Stock app
  triggerGloboEvents(variant) {
    // Trigger the specific Globo event that the custom script listens for
    document.dispatchEvent(new CustomEvent('globo.preorder.variant.changed', {
      detail: { variant: variant }
    }));

    // Trigger on document level
    document.dispatchEvent(new CustomEvent('globoVariantChanged', {
      detail: { variant: variant }
    }));

    // Trigger on section level
    this.section.dispatchEvent(new CustomEvent('variantChange', {
      detail: { variant: variant }
    }));

    // Also trigger standard Shopify-style events
    const event = new CustomEvent('variant:change', {
      detail: { variant: variant }
    });
    document.dispatchEvent(event);
    this.section.dispatchEvent(event);

    // Try to find and click any hidden variant selector that Globo might use
    const hiddenVariantSelect = this.container.querySelector('select[name="id"], [data-product-select]');
    if (hiddenVariantSelect) {
      hiddenVariantSelect.value = variant.id;
      hiddenVariantSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Also trigger click event on swatch for Globo's listener
    const clickedSwatch = this.variantSelects.querySelector('.modern-variant-swatch.is-selected');
    if (clickedSwatch) {
      // Trigger click event that Globo might be listening for
      clickedSwatch.dispatchEvent(new Event('click', { bubbles: true }));
    }

    // Check if Globo.Preorder is available and call its methods
    if (typeof window.Globo !== 'undefined' && window.Globo.Preorder) {
      // Try various methods that might exist
      const methods = ['initPreorder', 'render', 'renderProductForm', 'renderProductByForm', 'init', 'load'];
      methods.forEach(method => {
        if (typeof window.Globo.Preorder[method] === 'function') {
          try {
            // Call with appropriate arguments
            if (method === 'renderProductForm') {
              const form = this.container.querySelector('form.singleProductPreOrderForm');
              if (form && window.GloboPreorderParams?.product) {
                window.Globo.Preorder[method](window.GloboPreorderParams.product);
              }
            } else if (method === 'renderProductByForm') {
              const form = this.container.querySelector('form.singleProductPreOrderForm');
              if (form) {
                window.Globo.Preorder[method](form);
              }
            } else {
              window.Globo.Preorder[method]();
            }
          } catch (e) {
            // Silently ignore errors for methods that don't match the expected signature
          }
        }
      });
    }
  }

  updateVariantAvailability(variant) {
    const optionWrappers = this.variantSelects.querySelectorAll('.modern-variant-options');

    optionWrappers.forEach((wrapper, index) => {
      const swatches = wrapper.querySelectorAll('.modern-variant-swatch');
      const selectedValue = variant.options[index];

      swatches.forEach(swatch => {
        const value = swatch.dataset.optionValue;

        // Check if this specific option combination is sold out
        // Find the variant that matches ALL selected options with this swatch's value
        const matchingVariant = this.productJSON.variants.find(v => {
          // Check match for all options
          if (v.options[0] !== (index === 0 ? value : variant.options[0])) return false;
          if (v.options.length > 1 && v.options[1] !== (index === 1 ? value : variant.options[1])) return false;
          if (v.options.length > 2 && v.options[2] !== (index === 2 ? value : variant.options[2])) return false;
          return true;
        });

        // Mark as unavailable if variant doesn't exist OR is not available
        const isUnavailable = !matchingVariant || !matchingVariant.available;
        swatch.classList.toggle('is-disabled', isUnavailable);
        swatch.classList.toggle('modern-variant-swatch--sold-out', isUnavailable);

        // Update sold-out cross display
        const soldOutCross = swatch.querySelector('.modern-variant-sold-out-cross');
        if (soldOutCross) {
          soldOutCross.style.display = isUnavailable ? 'block' : 'none';
        }
      });
    });
  }

  // ========== Quantity ==========
  initQuantity() {
    this.quantitySelector = this.container.querySelector('[data-quantity-selector]');
    if (!this.quantitySelector) return;

    this.quantityInput = this.quantitySelector.querySelector('[data-quantity-input]');
    this.minusBtn = this.quantitySelector.querySelector('[data-quantity-minus]');
    this.plusBtn = this.quantitySelector.querySelector('[data-quantity-plus]');

    // Use event delegation on the container for better reliability
    this.quantitySelector.addEventListener('click', (e) => {
      if (e.target.closest('[data-quantity-minus]')) {
        this.updateQuantity(-1);
      } else if (e.target.closest('[data-quantity-plus]')) {
        this.updateQuantity(1);
      }
    });
  }

  updateQuantity(change) {
    let value = parseInt(this.quantityInput.value) || 1;
    const min = parseInt(this.quantityInput.min) || 1;
    const max = parseInt(this.quantityInput.max) || Infinity;

    value = Math.max(min, Math.min(max, value + change));
    this.quantityInput.value = value;

    // Trigger change event for any listeners
    this.quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ========== Add to Cart ==========
  initAddToCart() {
    const form = this.container.querySelector('[data-product-form]');
    if (!form) return;

    form.addEventListener('submit', (e) => this.handleAddToCart(e));
  }

  async handleAddToCart(e) {

    e.preventDefault();

    const form = e.target;
    const addToCartBtn = this.container.querySelector('[data-add-to-cart]');
    const defaultText = addToCartBtn?.querySelector('.modern-add-to-cart__default');
    const addedText = addToCartBtn?.querySelector('.modern-add-to-cart__added');
    const errorText = addToCartBtn?.querySelector('.modern-add-to-cart__error');

    if (!addToCartBtn) return;

    // Reset states
    if (defaultText) defaultText.style.display = '';
    if (addedText) addedText.style.display = 'none';
    if (errorText) errorText.style.display = 'none';

    // Show loading
    addToCartBtn.disabled = true;
    
    try {
      const formData = new FormData(form);
      const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        // Success
        if (defaultText) defaultText.style.display = 'none';
        if (addedText) addedText.style.display = 'flex';

        // Publish event
        this.publishCartEvent();
        if (typeof handleFloCartBtn === 'function') handleFloCartBtn();

        setTimeout(() => {
          if (defaultText) defaultText.style.display = '';
          if (addedText) addedText.style.display = 'none';
        }, 2000);
      } else {
        throw new Error(data.description || 'Error adding to cart');
      }
    } catch (error) {
      if (errorText) {
        errorText.textContent = error.message;
        errorText.style.display = 'block';
      }
    } finally {
      addToCartBtn.disabled = false;
    }
  }

  publishCartEvent() {
    // Trigger cart drawer or cart update
    document.dispatchEvent(new CustomEvent('cart:refresh'));
    document.dispatchEvent(new CustomEvent('ajaxProduct:added'));
  }

  // ========== Pickup Availability ==========
  initPickupAvailability() {
    const pickup = this.container.querySelector('pickup-availability');
    if (!pickup) return;

    // Listen for variant changes
    this.variantSelects?.addEventListener('change', () => {
      const selectedOptions = Array.from(this.variantInputs)
        .filter(input => input.checked)
        .map(input => input.value);

      const variant = this.productJSON.variants.find(v => {
        return selectedOptions.every((option, index) => {
          return v.options[index] === option;
        });
      });

      if (variant) {
        pickup.fetchAvailability(variant.id);
      }
    });
  }

  // ========== Read More & Table Scroll ==========
  initReadMore() {
    const readMoreBtns = this.container.querySelectorAll('.read-more-btn');
    readMoreBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const container = btn.closest('.modern-product__description');
        const shortDesc = container.querySelector('.description-short');
        const fullDesc = container.querySelector('.description-full');

        if (fullDesc && shortDesc) {
          if (fullDesc.style.display === 'none') {
            shortDesc.style.display = 'none';
            fullDesc.style.display = 'block';
            btn.textContent = '...read less';
          } else {
            shortDesc.style.display = '';
            fullDesc.style.display = 'none';
            btn.textContent = '...read more';
          }
        }
      });
    });
  }

  initTableScroll() {
    const descTables = this.container.querySelectorAll('.modern-product__description table');
    descTables.forEach((table) => {
      if (!table.parentElement.classList.contains('modern-table-scroll')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'modern-table-wrapper';

        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'modern-table-scroll';

        table.parentNode.insertBefore(wrapper, table);
        scrollContainer.appendChild(table);
        wrapper.appendChild(scrollContainer);

        // Check scroll state
        const checkScroll = () => {
          if (scrollContainer.scrollWidth > scrollContainer.clientWidth) {
            const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
            const remaining = maxScroll - scrollContainer.scrollLeft;

            if (remaining > 5) {
              wrapper.classList.add('can-scroll-right');
            } else {
              wrapper.classList.remove('can-scroll-right');
            }
          } else {
            wrapper.classList.remove('can-scroll-right');
          }
        };

        scrollContainer.addEventListener('scroll', checkScroll);
        window.addEventListener('resize', checkScroll);

        // Initial check
        setTimeout(checkScroll, 100);
      }
    });
  }

  // ========== Utilities ==========
  formatMoney(cents) {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: window.Shopify?.currency?.active || 'USD'
    });
  }
}

// Initialize on section load
document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.modern-product-section');
  sections.forEach(section => {
    if (!section.modernProduct) {
      section.modernProduct = new ModernProductPage(section);
    }
  });
});

// Section Editor reload
if (Shopify.designMode) {
  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target.querySelector('.modern-product-section');
    if (section && !section.modernProduct) {
      section.modernProduct = new ModernProductPage(section);
    }
  });
}

// Product Form Element
if (!customElements.get('product-form')) {
  class ProductForm extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.form = this.querySelector('form');
      this.form?.addEventListener('submit', this.onSubmitHandler.bind(this));
    }

    onSubmitHandler(e) {
      // Handled by ModernProductPage
    }
  }
  customElements.define('product-form', ProductForm);
}