class CardSlider extends HTMLElement {
  constructor() {
    super();
    this.currentIndex = 0;
    this.isDragging = false;
    this.startX = 0;
    this.currentTranslate = 0;
    this.prevTranslate = 0;
    this.startTime = 0;
  }

  connectedCallback() {
    this.slider = this.querySelector('[data-slider]');
    if (!this.slider) return;

    this.dots = this.querySelectorAll('[data-dot]');
    this.prevArrow = this.querySelector('[data-arrow-prev]');
    this.nextArrow = this.querySelector('[data-arrow-next]');
    this.totalSlides = parseInt(this.dataset.totalSlides || 1, 10);

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
        this.slideTo(index);
      });
    });

    // Touch events
    this.slider.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    this.slider.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.slider.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    this.slider.addEventListener('touchcancel', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.slider.classList.remove('dragging');
        this.slideTo(this.currentIndex);
      }
    });

    // Mouse events
    this.slider.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Prevent default drag
    this.slider.querySelectorAll('img').forEach((img) => {
      img.addEventListener('dragstart', (e) => e.preventDefault());
      img.style.pointerEvents = 'none';
    });
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

    this.currentIndex = index;
    this.currentTranslate = index * -100;
    this.prevTranslate = this.currentTranslate;
    
    requestAnimationFrame(() => {
        this.slider.style.transform = `translateX(${this.currentTranslate}%)`;
    });
    
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

    this.isDragging = true;
    this.startX = this.getClientX(e);
    this.startTime = Date.now();
    this.prevTranslate = this.currentIndex * -100;
    this.slider.classList.add('dragging');
    this.slider.style.transition = 'none';
  }

  handleTouchMove(e) {
    if (!this.isDragging) return;

    const currentX = this.getClientX(e);
    const diff = currentX - this.startX;
    const movePercent = (diff / this.slider.offsetWidth) * 100;
    this.currentTranslate = this.prevTranslate + movePercent;
    
    requestAnimationFrame(() => {
        this.slider.style.transform = `translateX(${this.currentTranslate}%)`;
    });

    if (Math.abs(diff) > 10 && e.cancelable) {
      e.preventDefault();
    }
  }

  handleTouchEnd(e) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.slider.classList.remove('dragging');
    this.slider.style.transition = 'transform 0.3s ease';

    const endX = this.getClientX(e);
    const diff = endX - this.startX;
    const absDiff = Math.abs(diff);
    const timeDiff = Date.now() - this.startTime;

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
      if (absDiff < 10 && timeDiff < 300) {
         const url = this.slider.getAttribute('data-product-url');
         if (url) window.location.href = url;
      }
    }
  }

  handleMouseDown(e) {
    if (e.target.closest('[data-arrow-prev], [data-arrow-next]')) return;

    e.preventDefault();
    this.isDragging = true;
    this.startX = e.clientX;
    this.startTime = Date.now();
    this.prevTranslate = this.currentIndex * -100;
    this.slider.classList.add('dragging');
    this.slider.style.transition = 'none';

    const handleMouseMove = (e) => {
        if (!this.isDragging) return;
        const currentX = e.clientX;
        const diff = currentX - this.startX;
        const movePercent = (diff / this.slider.offsetWidth) * 100;
        this.currentTranslate = this.prevTranslate + movePercent;

        requestAnimationFrame(() => {
             this.slider.style.transform = `translateX(${this.currentTranslate}%)`;
        });
    }

    const handleMouseUp = (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.slider.classList.remove('dragging');
        this.slider.style.transition = 'transform 0.3s ease';
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        const endX = e.clientX;
        const diff = endX - this.startX;
        const absDiff = Math.abs(diff);
        const timeDiff = Date.now() - this.startTime;

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
            if (absDiff < 10 && timeDiff < 300) {
                const url = this.slider.getAttribute('data-product-url');
                if (url) window.location.href = url;
            }
        }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
}

if (!customElements.get('card-slider')) {
  customElements.define('card-slider', CardSlider);
}
