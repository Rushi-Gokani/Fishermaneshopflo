/**
 * Smart Search - Fuzzy matching with typo correction
 */
(function () {
  'use strict';

  var DEBOUNCE_MS = 150;
  var MIN_QUERY_LENGTH = 2;
  var MAX_SUGGESTIONS = 8;

  function fetchProducts(query, signal) {
    var url = '/search/suggest.json?q=' + encodeURIComponent(query) +
      '&resources[type]=product&resources[limit]=8' +
      '&resources[options][unavailable_products]=last' +
      '&resources[options][fields]=title,body,product_type,tag,variants.title,vendor,variants.sku';
    return fetch(url, { signal: signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function (e) { if (e && e.name === 'AbortError') throw e; return null; });
  }

  function fetchCollections(query, signal) {
    var url = '/search/suggest.json?q=' + encodeURIComponent(query) +
      '&resources[type]=collection&resources[limit]=5';
    return fetch(url, { signal: signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function (e) { if (e && e.name === 'AbortError') throw e; return null; });
  }

  function getCollectionHandle(url) {
    if (!url) return '';
    var parts = url.split('/collections/');
    return parts.length > 1 ? parts[parts.length - 1].split('?')[0] : '';
  }

  function fetchCollectionImage(handle, signal) {
    if (!handle) return Promise.resolve(null);
    return fetch('/collections/' + handle + '.json', { signal: signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.collection && d.collection.image && d.collection.image.src) {
          var src = d.collection.image.src;
          if (src.indexOf('?') === -1) src += '?width=100';
          else src += '&width=100';
          return src;
        }
        return null;
      })
      .catch(function () { return null; });
  }

  function enrichCollectionsWithImages(collections, signal) {
    if (!collections || !collections.length) return Promise.resolve([]);
    var promises = collections.map(function (col) {
      var handle = getCollectionHandle(col.url);
      return fetchCollectionImage(handle, signal).then(function (imgUrl) {
        col._image = imgUrl;
        return col;
      });
    });
    return Promise.all(promises);
  }

  function fetchSuggestions(query, signal) {
    return Promise.all([
      fetchProducts(query, signal),
      fetchCollections(query, signal)
    ]).then(function (res) {
      var products = (res[0] && res[0].resources && res[0].resources.results && res[0].resources.results.products) || [];
      var collections = (res[1] && res[1].resources && res[1].resources.results && res[1].resources.results.collections) || [];
      return enrichCollectionsWithImages(collections, signal).then(function (enrichedCollections) {
        return { products: products, collections: enrichedCollections };
      });
    });
  }

  function getProducts(d) { return (d && d.resources && d.resources.results && d.resources.results.products) || []; }
  function getCollections(d) { return (d && d.resources && d.resources.results && d.resources.results.collections) || []; }

  function generateVariations(q) {
    q = q.toLowerCase();
    var seen = {}, out = [];
    seen[q] = true;
    function add(v) { v = v.toLowerCase(); if (!seen[v] && v.length >= 2) { seen[v] = true; out.push(v); } }

    var vowels = 'aeiou', common = 'rstlnhd';
    for (var i = 1; i < q.length; i++)
      for (var c = 0; c < 5; c++) add(q.slice(0,i) + vowels[c] + q.slice(i));
    for (var i = 1; i < q.length; i++)
      for (var c = 0; c < common.length; c++) add(q.slice(0,i) + common[c] + q.slice(i));
    for (var i = 0; i < q.length; i++)
      for (var c = 0; c < 5; c++) if (q[i] !== vowels[c]) add(q.slice(0,i) + vowels[c] + q.slice(i+1));
    for (var i = 0; i < q.length - 1; i++) add(q.slice(0,i) + q[i+1] + q[i] + q.slice(i+2));
    for (var i = 0; i < q.length; i++) add(q.slice(0,i) + q.slice(i+1));
    add(q.replace(/(.)\1+/g, '$1'));
    [['ph','f'],['f','ph'],['ck','k'],['k','ck'],['ee','ea'],['ea','ee'],['ai','a'],['a','ai']].forEach(function(p) {
      var idx = q.indexOf(p[0]); if (idx !== -1) add(q.slice(0,idx) + p[1] + q.slice(idx + p[0].length));
    });
    if (q.indexOf(' ') === -1 && q.length >= 5)
      for (var i = 2; i < q.length - 1; i++) add(q.slice(0,i) + ' ' + q.slice(i));

    return out;
  }

  function smartSearch(query, signal) {
    query = query.trim();
    if (query.length < MIN_QUERY_LENGTH)
      return Promise.resolve({ products: [], collections: [], correctedQuery: null });

    return fetchSuggestions(query, signal).then(function (data) {
      var products = data.products;
      var collections = data.collections;
      if (products.length > 0) {
        return { products: products.slice(0, MAX_SUGGESTIONS), collections: collections, correctedQuery: null };
      }

      var variations = generateVariations(query).slice(0, 12);
      var promises = variations.map(function (v) {
        return fetchSuggestions(v, signal).then(function (d) {
          return { query: v, products: d.products, collections: d.collections };
        }).catch(function () { return { query: v, products: [], collections: [] }; });
      });

      return Promise.all(promises).then(function (results) {
        var best = null;
        for (var i = 0; i < results.length; i++) {
          if (results[i].products.length > 0 && (!best || results[i].products.length > best.products.length))
            best = results[i];
        }
        if (best) return { products: best.products.slice(0, MAX_SUGGESTIONS), collections: best.collections, correctedQuery: best.query };
        return { products: [], collections: [], correctedQuery: null };
      });
    });
  }

  function escapeHTML(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function highlightMatch(text, query) {
    if (!query) return escapeHTML(text);
    var out = escapeHTML(text);
    query.trim().split(/\s+/).forEach(function (w) {
      if (w) out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')','gi'),
        '<mark style="background:rgba(64,196,255,0.2);color:inherit;padding:0 2px;border-radius:2px;">$1</mark>');
    });
    return out;
  }

  function buildResultsHTML(products, collections, correctedQuery, query) {
    if (!products.length && !collections.length)
      return '<div class="predictive-search-no-results">No products found for "' + escapeHTML(query) + '"</div>';

    var html = '', dq = correctedQuery || query;
    if (correctedQuery)
      html += '<div class="smart-search-correction">Showing results for "<strong>' + escapeHTML(correctedQuery) + '</strong>"</div>';

    var collectionIconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

    if (collections && collections.length > 0) {
      html += '<div class="smart-search-group-title">Collections</div>';
      for (var c = 0; c < Math.min(collections.length, 3); c++) {
        var col = collections[c];
        var colImg = col._image;
        var colImgHtml = colImg
          ? '<img src="' + colImg + '" alt="' + escapeHTML(col.title) + '" style="width:44px;height:44px;object-fit:contain;object-position:center;border-radius:8px;background:#f1f5f9;flex-shrink:0;padding:4px;">'
          : '<div style="width:44px;height:44px;background:linear-gradient(135deg,#e0f2fe,#f1f5f9);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + collectionIconSvg + '</div>';
        html += '<a href="' + col.url + '" class="predictive-search-item">' +
          colImgHtml +
          '<div class="predictive-search-item__info"><span class="predictive-search-item__title">' + highlightMatch(col.title, dq) + '</span><span style="font-size:12px;color:#94a3b8;">Collection</span></div></a>';
      }
    }

    if (products.length > 0) {
      if (collections && collections.length > 0) html += '<div class="smart-search-group-title">Products</div>';
      for (var p = 0; p < products.length; p++) {
        var pr = products[p];
        html += '<a href="' + pr.url + '" class="predictive-search-item">' +
          (pr.image ? '<img src="' + pr.image + '" alt="' + escapeHTML(pr.title) + '">' : '<div style="width:44px;height:44px;background:#f1f5f9;border-radius:8px;flex-shrink:0;"></div>') +
          '<div class="predictive-search-item__info"><span class="predictive-search-item__title">' + highlightMatch(pr.title, dq) + '</span>' +
          '<span class="predictive-search-item__price">' + pr.price + '</span></div></a>';
      }
    }

    html += '<div style="padding:12px 20px;text-align:center;border-top:1px solid #f1f5f9;background:#f8fafc;">' +
      '<a href="/search?q=' + encodeURIComponent(dq) + '&type=product" style="display:inline-block;padding:8px 24px;background:#40c4ff;color:#fff;font-weight:600;font-size:14px;text-decoration:none;border-radius:8px;">View All Results</a></div>';
    return html;
  }

  function init() {
    document.querySelectorAll('.header-search-container').forEach(function (wrapper) {
      var input = wrapper.querySelector('.header-search-input');
      var form = wrapper.querySelector('.header-search-form');
      var dropdown = wrapper.querySelector('.predictive-search-results-inline');
      if (!input || !form || !dropdown) return;

      var ac = null, timer = null, selIdx = -1;

      input.addEventListener('keydown', function (e) {
        if (!dropdown.classList.contains('has-results')) return;
        var items = dropdown.querySelectorAll('.predictive-search-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = selIdx < items.length-1 ? selIdx+1 : 0; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = selIdx > 0 ? selIdx-1 : items.length-1; }
        else if (e.key === 'Enter' && selIdx >= 0) { e.preventDefault(); items[selIdx].click(); return; }
        else if (e.key === 'Escape') { dropdown.classList.remove('has-results'); selIdx = -1; input.blur(); return; }
        else return;
        items.forEach(function(it,i) { it.style.background = i === selIdx ? '#f0f7ff' : ''; });
        items[selIdx].scrollIntoView({ block: 'nearest' });
      });

      input.addEventListener('input', function () {
        var query = input.value.trim();
        clearTimeout(timer);
        if (ac) { ac.abort(); ac = null; }
        if (query.length < MIN_QUERY_LENGTH) { dropdown.innerHTML = ''; dropdown.classList.remove('has-results'); return; }

        timer = setTimeout(function () {
          ac = new AbortController();
          var cur = ac;
          dropdown.innerHTML = '<div class="predictive-search-loading"><span class="smart-search-spinner"></span> Searching...</div>';
          dropdown.classList.add('has-results');

          smartSearch(query, cur.signal).then(function (r) {
            if (cur.signal.aborted) return;
            dropdown.innerHTML = buildResultsHTML(r.products, r.collections, r.correctedQuery, query);
            selIdx = -1;
            dropdown.classList.add('has-results');
          }).catch(function (e) {
            if (e && e.name === 'AbortError') return;
            dropdown.innerHTML = '<div class="predictive-search-no-results">Something went wrong.</div>';
          });
        }, DEBOUNCE_MS);
      });

      document.addEventListener('click', function (e) { if (!wrapper.contains(e.target)) { dropdown.classList.remove('has-results'); selIdx = -1; } });
      input.addEventListener('focus', function () { if (input.value.trim().length >= MIN_QUERY_LENGTH && dropdown.innerHTML.trim()) dropdown.classList.add('has-results'); });
      form.addEventListener('submit', function () {
        var el = dropdown.querySelector('.smart-search-correction strong');
        if (el && dropdown.classList.contains('has-results')) input.value = el.textContent;
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
