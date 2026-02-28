// Card Slider - Product Card Image Slider
console.log('[CardSlider JS] File loaded!');

class CardSlider extends HTMLElement {
  constructor() {
    super();
    this.currentIndex = 0;
    this.isDragging = false;
    this.startX = 0;
    this.currentTranslate = 0;
    this.prevTranslate = 0;
    this.startTime = 0;
    console.log('[CardSlider] Constructor called');
  }

  connectedCallback() {
    console.log('[CardSlider] connectedCallback', {
      classList: this.className,
      totalSlides: this.dataset.totalSlides
    });

    this.slider = this.querySelector('[data-slider]');
    if (!this.slider) {
      console.error('[CardSlider] NO SLIDER FOUND');
      return;
    }

    this.dots = this.querySelectorAll('[data-dot]');
    this.prevArrow = this.querySelector('[data-arrow-prev]');
    this.nextArrow = this.querySelector('[data-arrow-next]');
    this.totalSlides = parseInt(this.dataset.totalSlides || 1, 10);

    console.log('[CardSlider] Initialized', {
      slider: !!this.slider,
      dots: this.dots.length,
      totalSlides: this.totalSlides
    });

    this.init();
  }

  init() {
    this.slideTo(0);

    if (this.prevArrow) {
      this.prevArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentIndex > 0) {
          this.slideTo(this.currentIndex - 1);
        }
      });
    }

    if (this.nextArrow) {
      this.nextArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentIndex < this.totalSlides - 1) {
          this.slideTo(this.currentIndex + 1);
        }
      });
    }

    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[CardSlider] Dot clicked', index);
        this.slideTo(index);
      });
    });

    // Touch events - use capture to ensure we get them
    this.slider.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    this.slider.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.slider.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    this.slider.addEventListener('touchcancel', this.handleTouchCancel.bind(this));

    // Also attach to parent element for better touch capture
    this.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true, capture: true });
    this.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false, capture: true });
    this.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true, capture: true });

    // Mouse events
    this.slider.addEventListener('mousedown', this.handleMouseDown.bind(this));

    console.log('[CardSlider] All event listeners attached');
  }

  updateDots(index) {
    this.dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  updateArrows(index) {
    if (this.prevArrow) {
      this.prevArrow.disabled = index === 0;
    }
    if (this.nextArrow) {
      this.nextArrow.disabled = index === this.totalSlides - 1;
    }
  }

  slideTo(index) {
    if (index < 0) index = this.totalSlides - 1;
    if (index >= this.totalSlides) index = 0;

    console.log('[CardSlider] slideTo', { index, totalSlides: this.totalSlides });

    this.currentIndex = index;
    this.currentTranslate = index * -100;
    this.prevTranslate = this.currentTranslate;

    if (this.slider) {
      this.slider.style.transform = `translateX(${this.currentTranslate}%)`;
    }

    this.updateDots(index);
    this.updateArrows(index);
  }

  getClientX(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX || 0;
  }

  handleTouchStart(e) {
    if (e.target.closest('[data-arrow-prev], [data-arrow-next]')) return;

    console.log('[CardSlider] touchStart', { currentIndex: this.currentIndex, totalSlides: this.totalSlides });

    this.isDragging = true;
    this.startX = this.getClientX(e);
    this.startTime = Date.now();
    this.prevTranslate = this.currentIndex * -100;
    if (this.slider) {
      this.slider.classList.add('dragging');
      this.slider.style.transition = 'none';
    }
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;

    const currentX = this.getClientX(e);
    const diff = currentX - this.startX;
    const movePercent = (diff / this.slider.offsetWidth) * 100;
    this.currentTranslate = this.prevTranslate + movePercent;

    if (this.slider) {
      this.slider.style.transform = `translateX(${this.currentTranslate}%)`;
    }

    if (e.cancelable) {
      e.preventDefault();
    }
  }

  handleTouchEnd(e) {
    if (!this.isDragging) return;

    console.log('[CardSlider] touchEnd', { currentIndex: this.currentIndex });

    this.isDragging = false;
    if (this.slider) {
      this.slider.classList.remove('dragging');
      this.slider.style.transition = 'transform 0.3s ease';
    }

    const endX = this.getClientX(e);
    const diff = endX - this.startX;
    const absDiff = Math.abs(diff);
    const timeDiff = Date.now() - this.startTime;

    console.log('[CardSlider] Calculating', { diff, absDiff, timeDiff, totalSlides: this.totalSlides });

    if (absDiff > 30 && timeDiff < 500) {
      if (diff < 0 && this.currentIndex < this.totalSlides - 1) {
        console.log('[CardSlider] Next slide');
        this.slideTo(this.currentIndex + 1);
      } else if (diff > 0 && this.currentIndex > 0) {
        console.log('[CardSlider] Previous slide');
        this.slideTo(this.currentIndex - 1);
      } else {
        this.slideTo(this.currentIndex);
      }
    } else {
      this.slideTo(this.currentIndex);
    }
  }

  handleTouchCancel() {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.slider) {
        this.slider.classList.remove('dragging');
        this.slider.style.transition = 'transform 0.3s ease';
      }
      this.slideTo(this.currentIndex);
    }
  }

  handleMouseDown(e) {
    if (e.target.closest('[data-arrow-prev], [data-arrow-next]')) return;

    console.log('[CardSlider] mousedown');

    e.preventDefault();
    this.isDragging = true;
    this.startX = e.clientX;
    this.startTime = Date.now();
    this.prevTranslate = this.currentIndex * -100;
    if (this.slider) {
      this.slider.classList.add('dragging');
      this.slider.style.transition = 'none';
    }

    const handleMouseMove = (e) => {
      if (!this.isDragging) return;
      const currentX = e.clientX;
      const diff = currentX - this.startX;
      const movePercent = (diff / this.slider.offsetWidth) * 100;
      this.currentTranslate = this.prevTranslate + movePercent;

      if (this.slider) {
        this.slider.style.transform = `translateX(${this.currentTranslate}%)`;
      }
    };

    const handleMouseUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.slider) {
        this.slider.classList.remove('dragging');
        this.slider.style.transition = 'transform 0.3s ease';
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      const endX = e.clientX;
      const diff = endX - this.startX;
      const absDiff = Math.abs(diff);
      const timeDiff = Date.now() - this.startTime;

      console.log('[CardSlider] mouseup', { diff, absDiff });

      if (absDiff > 30 && timeDiff < 500) {
        if (diff < 0 && this.currentIndex < this.totalSlides - 1) {
          this.slideTo(this.currentIndex + 1);
        } else if (diff > 0 && this.currentIndex > 0) {
          this.slideTo(this.currentIndex - 1);
        } else {
          this.slideTo(this.currentIndex);
        }
      } else {
        this.slideTo(this.currentIndex);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
}

// Define the custom element
if (!customElements.get('card-slider')) {
  customElements.define('card-slider', CardSlider);
  console.log('[CardSlider] Custom element DEFINED!');
} else {
  console.log('[CardSlider] Custom element already exists');
}

// Log all card-slider elements found on page
setTimeout(() => {
  const sliders = document.querySelectorAll('card-slider');
  console.log('[CardSlider] Found ' + sliders.length + ' card-slider elements on page');
}, 1000);
