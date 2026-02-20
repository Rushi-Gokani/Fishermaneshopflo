import { Component } from '@theme/component';
import { ThemeEvents, VariantUpdateEvent, ZoomMediaSelectedEvent } from '@theme/events';
import Drift from '@theme/drift-zoom';
import { isDesktopBreakpoint, mediaQueryLarge } from '@theme/utilities';

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const target = this.closest('.shopify-section, dialog');

    target?.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate, { signal });
    this.refs.zoomDialogComponent?.addEventListener(ThemeEvents.zoomMediaSelected, this.#handleZoomMediaSelected, {
      signal,
    });

    this.#setupDrift();
    mediaQueryLarge.addEventListener('change', this.#handleBreakpointChange);
  }

  #controller = new AbortController();
  /** @type {import('@theme/drift-zoom').default[]} */
  #driftInstances = [];

  #handleBreakpointChange = () => {
    this.#setupDrift();
  };

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
    this.#teardownDrift();
    mediaQueryLarge.removeEventListener('change', this.#handleBreakpointChange);
  }

  /**
   * Handles a variant update event by replacing the current media gallery with a new one.
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #handleVariantUpdate = (event) => {
    const source = event.detail.data.html;

    if (!source) return;
    const newMediaGallery = source.querySelector('media-gallery');

    if (!newMediaGallery) return;

    this.replaceWith(newMediaGallery);
  };

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    this.slideshow?.select(event.detail.index, undefined, { animate: false });
  };

  #setupDrift() {
    this.#teardownDrift();

    if (!this.#shouldUseDrift()) return;

    const images = this.#getZoomableImages();
    if (!images.length) return;

    const paneContainer = this.zoomWrapper;
    if (!paneContainer) return;

    const useInlinePane = window.innerWidth < 1024;
    const inlineOffsetY = useInlinePane ? -85 : 0;

    this.#driftInstances = images.map(
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

  #teardownDrift() {
    this.#driftInstances.forEach((instance) => instance.destroy?.());
    this.#driftInstances = [];
  }

  #shouldUseDrift() {
    return this.zoomEnabled && isDesktopBreakpoint();
  }

  #getZoomableImages() {
    return Array.from(this.querySelectorAll('.product-media__image[data-zoom]'));
  }

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }

  get zoomEnabled() {
    return this.dataset.zoomEnabled === 'true';
  }

  get zoomWrapper() {
    const selector = this.dataset.zoomWrapper;

    if (!selector) return null;

    return document.querySelector(selector);
  }
}

if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', MediaGallery);
}
