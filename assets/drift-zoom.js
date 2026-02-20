// @ts-nocheck
function _typeof(obj) {
  "@babel/helpers - typeof";
  return _typeof = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(obj2) {
    return typeof obj2;
  } : function(obj2) {
    return obj2 && typeof Symbol == "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
  }, _typeof(obj);
}
const HAS_DOM = typeof HTMLElement === "object";
function isDOMElement(obj) {
  return HAS_DOM ? obj instanceof HTMLElement : obj && _typeof(obj) === "object" && obj !== null && obj.nodeType === 1 && typeof obj.nodeName === "string";
}
function addClasses(el, classNames) {
  classNames.forEach((className) => {
    el.classList.add(className);
  });
}
function removeClasses(el, classNames) {
  classNames.forEach((className) => {
    el.classList.remove(className);
  });
}
const BASE_RULES = ".drift-bounding-box,.drift-zoom-pane{position:absolute;pointer-events:none}@keyframes noop{0%{zoom:1}}@-webkit-keyframes noop{0%{zoom:1}}.drift-zoom-pane.drift-open{display:block}.drift-zoom-pane.drift-closing,.drift-zoom-pane.drift-opening{animation:noop 1ms;-webkit-animation:noop 1ms}.drift-zoom-pane{overflow:hidden;width:100%;height:100%;top:0;left:0}.drift-zoom-pane-loader{display:none}.drift-zoom-pane img{position:absolute;display:block;max-width:none;max-height:none}";
function injectBaseStylesheet() {
  if (document.querySelector(".drift-base-styles")) {
    return;
  }
  const styleEl = document.createElement("style");
  styleEl.type = "text/css";
  styleEl.classList.add("drift-base-styles");
  styleEl.appendChild(document.createTextNode(BASE_RULES));
  const head = document.head;
  head.insertBefore(styleEl, head.firstChild);
}
function throwIfMissing() {
  throw new Error("Missing parameter");
}
class BoundingBox {
  constructor(options) {
    this.isShowing = false;
    const { namespace = null, zoomFactor = throwIfMissing(), containerEl = throwIfMissing() } = options;
    this.settings = {
      namespace,
      zoomFactor,
      containerEl
    };
    this.openClasses = this._buildClasses("open");
    this._buildElement();
  }
  _buildClasses(suffix) {
    const classes = ["drift-".concat(suffix)];
    const ns = this.settings.namespace;
    if (ns) {
      classes.push("".concat(ns, "-").concat(suffix));
    }
    return classes;
  }
  _buildElement() {
    this.el = document.createElement("div");
    addClasses(this.el, this._buildClasses("bounding-box"));
  }
  show(zoomPaneWidth, zoomPaneHeight) {
    this.isShowing = true;
    this.settings.containerEl.appendChild(this.el);
    const style = this.el.style;
    style.width = "".concat(Math.round(zoomPaneWidth / this.settings.zoomFactor), "px");
    style.height = "".concat(Math.round(zoomPaneHeight / this.settings.zoomFactor), "px");
    addClasses(this.el, this.openClasses);
  }
  hide() {
    if (this.isShowing) {
      this.settings.containerEl.removeChild(this.el);
    }
    this.isShowing = false;
    removeClasses(this.el, this.openClasses);
  }
  setPosition(percentageOffsetX, percentageOffsetY, triggerRect) {
    const pageXOffset = window.pageXOffset;
    const pageYOffset = window.pageYOffset;
    let inlineLeft = triggerRect.left + percentageOffsetX * triggerRect.width - this.el.clientWidth / 2 + pageXOffset;
    let inlineTop = triggerRect.top + percentageOffsetY * triggerRect.height - this.el.clientHeight / 2 + pageYOffset;
    if (inlineLeft < triggerRect.left + pageXOffset) {
      inlineLeft = triggerRect.left + pageXOffset;
    } else if (inlineLeft + this.el.clientWidth > triggerRect.left + triggerRect.width + pageXOffset) {
      inlineLeft = triggerRect.left + triggerRect.width - this.el.clientWidth + pageXOffset;
    }
    if (inlineTop < triggerRect.top + pageYOffset) {
      inlineTop = triggerRect.top + pageYOffset;
    } else if (inlineTop + this.el.clientHeight > triggerRect.top + triggerRect.height + pageYOffset) {
      inlineTop = triggerRect.top + triggerRect.height - this.el.clientHeight + pageYOffset;
    }
    this.el.style.left = "".concat(inlineLeft, "px");
    this.el.style.top = "".concat(inlineTop, "px");
  }
}
class Trigger {
  constructor(options = {}) {
    this._show = this._show.bind(this);
    this._hide = this._hide.bind(this);
    this._handleEntry = this._handleEntry.bind(this);
    this._handleMovement = this._handleMovement.bind(this);
    const {
      el = throwIfMissing(),
      zoomPane = throwIfMissing(),
      sourceAttribute = throwIfMissing(),
      handleTouch = throwIfMissing(),
      onShow = null,
      onHide = null,
      hoverDelay = 0,
      touchDelay = 0,
      hoverBoundingBox = throwIfMissing(),
      touchBoundingBox = throwIfMissing(),
      namespace = null,
      zoomFactor = throwIfMissing(),
      boundingBoxContainer = throwIfMissing(),
      passive = false
    } = options;
    this.settings = {
      el,
      zoomPane,
      sourceAttribute,
      handleTouch,
      onShow,
      onHide,
      hoverDelay,
      touchDelay,
      hoverBoundingBox,
      touchBoundingBox,
      namespace,
      zoomFactor,
      boundingBoxContainer,
      passive
    };
    if (this.settings.hoverBoundingBox || this.settings.touchBoundingBox) {
      this.boundingBox = new BoundingBox({
        namespace: this.settings.namespace,
        zoomFactor: this.settings.zoomFactor,
        containerEl: this.settings.boundingBoxContainer
      });
    }
    this.enabled = true;
    this._bindEvents();
  }
  get isShowing() {
    return this.settings.zoomPane.isShowing;
  }
  _preventDefault(event) {
    event.preventDefault();
  }
  _preventDefaultAllowTouchScroll(event) {
    if (!this.settings.touchDelay || !this._isTouchEvent(event) || this.isShowing) {
      event.preventDefault();
    }
  }
  _isTouchEvent(event) {
    return !!event.touches;
  }
  _bindEvents() {
    this.settings.el.addEventListener("mouseenter", this._handleEntry);
    this.settings.el.addEventListener("mouseleave", this._hide);
    this.settings.el.addEventListener("mousemove", this._handleMovement);
    const isPassive = { passive: this.settings.passive };
    if (this.settings.handleTouch) {
      this.settings.el.addEventListener("touchstart", this._handleEntry, isPassive);
      this.settings.el.addEventListener("touchend", this._hide);
      this.settings.el.addEventListener("touchmove", this._handleMovement, isPassive);
    } else {
      this.settings.el.addEventListener("touchstart", this._preventDefault, isPassive);
      this.settings.el.addEventListener("touchend", this._preventDefault);
      this.settings.el.addEventListener("touchmove", this._preventDefault, isPassive);
    }
  }
  _unbindEvents() {
    this.settings.el.removeEventListener("mouseenter", this._handleEntry);
    this.settings.el.removeEventListener("mouseleave", this._hide);
    this.settings.el.removeEventListener("mousemove", this._handleMovement);
    if (this.settings.handleTouch) {
      this.settings.el.removeEventListener("touchstart", this._handleEntry);
      this.settings.el.removeEventListener("touchend", this._hide);
      this.settings.el.removeEventListener("touchmove", this._handleMovement);
    } else {
      this.settings.el.removeEventListener("touchstart", this._preventDefault);
      this.settings.el.removeEventListener("touchend", this._preventDefault);
      this.settings.el.removeEventListener("touchmove", this._preventDefault);
    }
  }
  _handleEntry(e) {
    this._preventDefaultAllowTouchScroll(e);
    this._lastMovement = e;
    if (e.type === "mouseenter" && this.settings.hoverDelay) {
      this.entryTimeout = setTimeout(this._show, this.settings.hoverDelay);
    } else if (this.settings.touchDelay) {
      this.entryTimeout = setTimeout(this._show, this.settings.touchDelay);
    } else {
      this._show();
    }
  }
  _show() {
    if (!this.enabled) {
      return;
    }
    const { onShow } = this.settings;
    if (onShow && typeof onShow === "function") {
      onShow();
    }
    this.settings.zoomPane.show(
      this.settings.el.getAttribute(this.settings.sourceAttribute),
      this.settings.el.clientWidth,
      this.settings.el.clientHeight
    );
    if (this._lastMovement) {
      const touchActivated = this._lastMovement.touches;
      if (touchActivated && this.settings.touchBoundingBox || !touchActivated && this.settings.hoverBoundingBox) {
        this.boundingBox.show(this.settings.zoomPane.el.clientWidth, this.settings.zoomPane.el.clientHeight);
      }
    }
    this._handleMovement();
  }
  _hide(e) {
    if (e) {
      this._preventDefaultAllowTouchScroll(e);
    }
    this._lastMovement = null;
    if (this.entryTimeout) {
      clearTimeout(this.entryTimeout);
    }
    if (this.boundingBox) {
      this.boundingBox.hide();
    }
    const { onHide } = this.settings;
    if (onHide && typeof onHide === "function") {
      onHide();
    }
    this.settings.zoomPane.hide();
  }
  _handleMovement(e) {
    if (e) {
      this._preventDefaultAllowTouchScroll(e);
      this._lastMovement = e;
    } else if (this._lastMovement) {
      e = this._lastMovement;
    } else {
      return;
    }
    let movementX;
    let movementY;
    if (e.touches) {
      const firstTouch = e.touches[0];
      movementX = firstTouch.clientX;
      movementY = firstTouch.clientY;
    } else {
      movementX = e.clientX;
      movementY = e.clientY;
    }
    const el = this.settings.el;
    const rect = el.getBoundingClientRect();
    const offsetX = movementX - rect.left;
    const offsetY = movementY - rect.top;
    const percentageOffsetX = offsetX / this.settings.el.clientWidth;
    const percentageOffsetY = offsetY / this.settings.el.clientHeight;
    if (this.boundingBox) {
      this.boundingBox.setPosition(percentageOffsetX, percentageOffsetY, rect);
    }
    this.settings.zoomPane.setPosition(percentageOffsetX, percentageOffsetY, rect);
  }
}
class ZoomPane {
  constructor(options = {}) {
    this.HAS_ANIMATION = false;
    if (typeof document !== "undefined") {
      const divStyle = document.createElement("div").style;
      this.HAS_ANIMATION = "animation" in divStyle || "webkitAnimation" in divStyle;
    }
    this._completeShow = this._completeShow.bind(this);
    this._completeHide = this._completeHide.bind(this);
    this._handleLoad = this._handleLoad.bind(this);
    this.isShowing = false;
    const {
      container = null,
      zoomFactor = throwIfMissing(),
      inline = throwIfMissing(),
      namespace = null,
      showWhitespaceAtEdges = throwIfMissing(),
      containInline = throwIfMissing(),
      inlineOffsetX = 0,
      inlineOffsetY = 0,
      inlineContainer = document.body
    } = options;
    this.settings = {
      container,
      zoomFactor,
      inline,
      namespace,
      showWhitespaceAtEdges,
      containInline,
      inlineOffsetX,
      inlineOffsetY,
      inlineContainer
    };
    this.openClasses = this._buildClasses("open");
    this.openingClasses = this._buildClasses("opening");
    this.closingClasses = this._buildClasses("closing");
    this.inlineClasses = this._buildClasses("inline");
    this.loadingClasses = this._buildClasses("loading");
    this._buildElement();
  }
  get _isInline() {
    const inline = this.settings.inline;
    return inline === true || typeof inline === "number" && window.innerWidth <= inline;
  }
  _buildClasses(suffix) {
    const classes = ["drift-".concat(suffix)];
    const ns = this.settings.namespace;
    if (ns) {
      classes.push("".concat(ns, "-").concat(suffix));
    }
    return classes;
  }
  _buildElement() {
    this.el = document.createElement("div");
    addClasses(this.el, this._buildClasses("zoom-pane"));
    const loaderEl = document.createElement("div");
    addClasses(loaderEl, this._buildClasses("zoom-pane-loader"));
    this.el.appendChild(loaderEl);
    this.imgEl = document.createElement("img");
    this.el.appendChild(this.imgEl);
  }
  _setImageURL(imageURL) {
    this.imgEl.setAttribute("src", imageURL);
  }
  _setImageSize(triggerWidth, triggerHeight) {
    this.imgEl.style.width = "".concat(triggerWidth * this.settings.zoomFactor, "px");
    this.imgEl.style.height = "".concat(triggerHeight * this.settings.zoomFactor, "px");
  }
  setPosition(percentageOffsetX, percentageOffsetY, triggerRect) {
    const imgElWidth = this.imgEl.offsetWidth;
    const imgElHeight = this.imgEl.offsetHeight;
    const elWidth = this.el.offsetWidth;
    const elHeight = this.el.offsetHeight;
    const centreOfContainerX = elWidth / 2;
    const centreOfContainerY = elHeight / 2;
    const targetImgXToBeCentre = imgElWidth * percentageOffsetX;
    const targetImgYToBeCentre = imgElHeight * percentageOffsetY;
    let left = centreOfContainerX - targetImgXToBeCentre;
    let top = centreOfContainerY - targetImgYToBeCentre;
    const differenceBetweenContainerWidthAndImgWidth = elWidth - imgElWidth;
    const differenceBetweenContainerHeightAndImgHeight = elHeight - imgElHeight;
    const isContainerLargerThanImgX = differenceBetweenContainerWidthAndImgWidth > 0;
    const isContainerLargerThanImgY = differenceBetweenContainerHeightAndImgHeight > 0;
    const minLeft = isContainerLargerThanImgX ? differenceBetweenContainerWidthAndImgWidth / 2 : 0;
    const minTop = isContainerLargerThanImgY ? differenceBetweenContainerHeightAndImgHeight / 2 : 0;
    const maxLeft = isContainerLargerThanImgX ? differenceBetweenContainerWidthAndImgWidth / 2 : differenceBetweenContainerWidthAndImgWidth;
    const maxTop = isContainerLargerThanImgY ? differenceBetweenContainerHeightAndImgHeight / 2 : differenceBetweenContainerHeightAndImgHeight;
    if (this.el.parentElement === this.settings.inlineContainer) {
      const scrollX = window.pageXOffset;
      const scrollY = window.pageYOffset;
      let inlineLeft = triggerRect.left + percentageOffsetX * triggerRect.width - elWidth / 2 + this.settings.inlineOffsetX + scrollX;
      let inlineTop = triggerRect.top + percentageOffsetY * triggerRect.height - elHeight / 2 + this.settings.inlineOffsetY + scrollY;
      if (this.settings.containInline) {
        if (inlineLeft < triggerRect.left + scrollX) {
          inlineLeft = triggerRect.left + scrollX;
        } else if (inlineLeft + elWidth > triggerRect.left + triggerRect.width + scrollX) {
          inlineLeft = triggerRect.left + triggerRect.width - elWidth + scrollX;
        }
        if (inlineTop < triggerRect.top + scrollY) {
          inlineTop = triggerRect.top + scrollY;
        } else if (inlineTop + elHeight > triggerRect.top + triggerRect.height + scrollY) {
          inlineTop = triggerRect.top + triggerRect.height - elHeight + scrollY;
        }
      }
      this.el.style.left = "".concat(inlineLeft, "px");
      this.el.style.top = "".concat(inlineTop, "px");
    }
    if (!this.settings.showWhitespaceAtEdges) {
      if (left > minLeft) {
        left = minLeft;
      } else if (left < maxLeft) {
        left = maxLeft;
      }
      if (top > minTop) {
        top = minTop;
      } else if (top < maxTop) {
        top = maxTop;
      }
    }
    this.imgEl.style.transform = "translate(".concat(left, "px, ").concat(top, "px)");
    this.imgEl.style.webkitTransform = "translate(".concat(left, "px, ").concat(top, "px)");
  }
  _removeListenersAndResetClasses() {
    this.el.removeEventListener("animationend", this._completeShow);
    this.el.removeEventListener("animationend", this._completeHide);
    this.el.removeEventListener("webkitAnimationEnd", this._completeShow);
    this.el.removeEventListener("webkitAnimationEnd", this._completeHide);
    removeClasses(this.el, this.openClasses);
    removeClasses(this.el, this.closingClasses);
  }
  show(imageURL, triggerWidth, triggerHeight) {
    this._removeListenersAndResetClasses();
    this.isShowing = true;
    addClasses(this.el, this.openClasses);
    if (this.imgEl.getAttribute("src") !== imageURL) {
      addClasses(this.el, this.loadingClasses);
      this.imgEl.addEventListener("load", this._handleLoad);
      this._setImageURL(imageURL);
    }
    this._setImageSize(triggerWidth, triggerHeight);
    if (this._isInline) {
      this._showInline();
    } else {
      this._showInContainer();
    }
    if (this.HAS_ANIMATION) {
      this.el.addEventListener("animationend", this._completeShow);
      this.el.addEventListener("webkitAnimationEnd", this._completeShow);
      addClasses(this.el, this.openingClasses);
    }
  }
  _showInline() {
    this.settings.inlineContainer.appendChild(this.el);
    addClasses(this.el, this.inlineClasses);
  }
  _showInContainer() {
    this.settings.container.appendChild(this.el);
  }
  hide() {
    this._removeListenersAndResetClasses();
    this.isShowing = false;
    if (this.HAS_ANIMATION) {
      this.el.addEventListener("animationend", this._completeHide);
      this.el.addEventListener("webkitAnimationEnd", this._completeHide);
      addClasses(this.el, this.closingClasses);
    } else {
      removeClasses(this.el, this.openClasses);
      removeClasses(this.el, this.inlineClasses);
    }
  }
  _completeShow() {
    this.el.removeEventListener("animationend", this._completeShow);
    this.el.removeEventListener("webkitAnimationEnd", this._completeShow);
    removeClasses(this.el, this.openingClasses);
  }
  _completeHide() {
    this.el.removeEventListener("animationend", this._completeHide);
    this.el.removeEventListener("webkitAnimationEnd", this._completeHide);
    removeClasses(this.el, this.openClasses);
    removeClasses(this.el, this.closingClasses);
    removeClasses(this.el, this.inlineClasses);
    this.el.style.left = "";
    this.el.style.top = "";
    if (this.el.parentElement === this.settings.container) {
      this.settings.container.removeChild(this.el);
    } else if (this.el.parentElement === this.settings.inlineContainer) {
      this.settings.inlineContainer.removeChild(this.el);
    }
  }
  _handleLoad() {
    this.imgEl.removeEventListener("load", this._handleLoad);
    removeClasses(this.el, this.loadingClasses);
  }
}
class Drift {
  constructor(triggerEl, options = {}) {
    this.VERSION = "1.5.1";
    this.triggerEl = triggerEl;
    this.destroy = this.destroy.bind(this);
    if (!isDOMElement(this.triggerEl)) {
      throw new TypeError("`new Drift` requires a DOM element as its first argument.");
    }
    const {
      namespace = null,
      showWhitespaceAtEdges = false,
      containInline = false,
      inlineOffsetX = 0,
      inlineOffsetY = 0,
      inlineContainer = document.body,
      sourceAttribute = "data-zoom",
      zoomFactor = 3,
      paneContainer = document.body,
      inlinePane = 375,
      handleTouch = true,
      onShow = null,
      onHide = null,
      injectBaseStyles = true,
      hoverDelay = 0,
      touchDelay = 0,
      hoverBoundingBox = false,
      touchBoundingBox = false,
      boundingBoxContainer = document.body,
      passive = false
    } = options;
    if (inlinePane !== true && !isDOMElement(paneContainer)) {
      throw new TypeError("`paneContainer` must be a DOM element when `inlinePane !== true`");
    }
    if (!isDOMElement(inlineContainer)) {
      throw new TypeError("`inlineContainer` must be a DOM element");
    }
    this.settings = {
      namespace,
      showWhitespaceAtEdges,
      containInline,
      inlineOffsetX,
      inlineOffsetY,
      inlineContainer,
      sourceAttribute,
      zoomFactor,
      paneContainer,
      inlinePane,
      handleTouch,
      onShow,
      onHide,
      injectBaseStyles,
      hoverDelay,
      touchDelay,
      hoverBoundingBox,
      touchBoundingBox,
      boundingBoxContainer,
      passive
    };
    if (this.settings.injectBaseStyles) {
      injectBaseStylesheet();
    }
    this._buildZoomPane();
    this._buildTrigger();
  }
  get isShowing() {
    return this.zoomPane.isShowing;
  }
  get zoomFactor() {
    return this.settings.zoomFactor;
  }
  set zoomFactor(zf) {
    this.settings.zoomFactor = zf;
    this.zoomPane.settings.zoomFactor = zf;
    this.trigger.settings.zoomFactor = zf;
    if (this.boundingBox) {
      this.boundingBox.settings.zoomFactor = zf;
    }
  }
  _buildZoomPane() {
    this.zoomPane = new ZoomPane({
      container: this.settings.paneContainer,
      zoomFactor: this.settings.zoomFactor,
      showWhitespaceAtEdges: this.settings.showWhitespaceAtEdges,
      containInline: this.settings.containInline,
      inline: this.settings.inlinePane,
      namespace: this.settings.namespace,
      inlineOffsetX: this.settings.inlineOffsetX,
      inlineOffsetY: this.settings.inlineOffsetY,
      inlineContainer: this.settings.inlineContainer
    });
  }
  _buildTrigger() {
    this.trigger = new Trigger({
      el: this.triggerEl,
      zoomPane: this.zoomPane,
      handleTouch: this.settings.handleTouch,
      onShow: this.settings.onShow,
      onHide: this.settings.onHide,
      sourceAttribute: this.settings.sourceAttribute,
      hoverDelay: this.settings.hoverDelay,
      touchDelay: this.settings.touchDelay,
      hoverBoundingBox: this.settings.hoverBoundingBox,
      touchBoundingBox: this.settings.touchBoundingBox,
      namespace: this.settings.namespace,
      zoomFactor: this.settings.zoomFactor,
      boundingBoxContainer: this.settings.boundingBoxContainer,
      passive: this.settings.passive
    });
  }
  setZoomImageURL(imageURL) {
    this.zoomPane._setImageURL(imageURL);
  }
  disable() {
    this.trigger.enabled = false;
  }
  enable() {
    this.trigger.enabled = true;
  }
  destroy() {
    this.trigger._hide();
    this.trigger._unbindEvents();
  }
}
export { Drift };
export default Drift;
