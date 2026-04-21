/**
 * Smart Search - Fuzzy matching with typo correction
 */
(function () {
  'use strict';

  var DEBOUNCE_MS = 150;
  var MIN_QUERY_LENGTH = 2;
  var MAX_SUGGESTIONS = 8;

  function fetchSuggestions(query, signal) {
    var url = '/search/suggest.json?q=' + encodeURIComponent(query) +
      '&resources[type]=product,collection&resources[limit]=10' +
      '&resources[options][unavailable_products]=last' +
      '&resources[options][fields]=title,body,product_type,tag,variants.title,vendor,variants.sku';
    return fetch(url, { signal: signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function (e) { if (e && e.name === 'AbortError') throw e; return null; });
  }

  function getProducts(d) { return (d && d.resources && d.resources.results && d.resources.results.products) || []; }
  function getCollections(d) { return (d && d.resources && d.resources.results && d.resources.results.collections) || []; }

  function generateVariations(q) {
    q = q.toLowerCase();
    var seen = {}, out = [];
    seen[q] = true;
    function add(v) { v = v.toLowerCase(); if (!seen[v] && v.length >= 2) { seen[v] = true; out.push(v); } }

    var vowels = 'aeiou', common = 'rstlnhd';
    // Insert vowels
    for (var i = 1; i < q.length; i++)
      for (var c = 0; c < 5; c++) add(q.slice(0,i) + vowels[c] + q.slice(i));
    // Insert consonants
    for (var i = 1; i < q.length; i++)
      for (var c = 0; c < common.length; c++) add(q.slice(0,i) + common[c] + q.slice(i));
    // Replace with vowels
    for (var i = 0; i < q.length; i++)
      for (var c = 0; c < 5; c++) if (q[i] !== vowels[c]) add(q.slice(0,i) + vowels[c] + q.slice(i+1));
    // Swaps
    for (var i = 0; i < q.length - 1; i++) add(q.slice(0,i) + q[i+1] + q[i] + q.slice(i+2));
    // Delete each char
    for (var i = 0; i < q.length; i++) add(q.slice(0,i) + q.slice(i+1));
    // Dedup letters
    add(q.replace(/(.)\1+/g, '$1'));
    // Phonetic
    [['ph','f'],['f','ph'],['ck','k'],['k','ck'],['ee','ea'],['ea','ee'],['ai','a'],['a','ai']].forEach(function(p) {
      var idx = q.indexOf(p[0]); if (idx !== -1) add(q.slice(0,idx) + p[1] + q.slice(idx + p[0].length));
    });
    // Word split
    if (q.indexOf(' ') === -1 && q.length >= 5)
      for (var i = 2; i < q.length - 1; i++) add(q.slice(0,i) + ' ' + q.slice(i));

    return out;
  }

  function smartSearch(query, signal) {
    query = query.trim();
    if (query.length < MIN_QUERY_LENGTH)
      return Promise.resolve({ products: [], collections: [], correctedQuery: null });

    // STEP 1: Try original query ALONE (fast path)
    return fetchSuggestions(query, signal).then(function (data) {
      var products = getProducts(data);
      if (products.length > 0) {
        // Found results immediately — no need for variations
        return { products: products.slice(0, MAX_SUGGESTIONS), collections: getCollections(data), correctedQuery: null };
      }

      // STEP 2: No results — fire variations in parallel
      var variations = generateVariations(query).slice(0, 12);
      var promises = variations.map(function (v) {
        return fetchSuggestions(v, signal).then(function (d) {
          return { query: v, products: getProducts(d), collections: getCollections(d) };
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

  // ── Helpers ───────────────────────────────────────────────────────────
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

    if (collections && collections.length > 0) {
      html += '<div class="smart-search-group-title">Collections</div>';
      for (var c = 0; c < Math.min(collections.length, 3); c++) {
        html += '<a href="' + collections[c].url + '" class="predictive-search-item">' +
          '<div style="width:44px;height:44px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg></div>' +
          '<div class="predictive-search-item__info"><span class="predictive-search-item__title">' + highlightMatch(collections[c].title, dq) + '</span><span style="font-size:12px;color:#94a3b8;">Collection</span></div></a>';
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

  // ── Init ──────────────────────────────────────────────────────────────
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
