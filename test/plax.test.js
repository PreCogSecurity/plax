'use strict';

/**
 * Tests for js/plax.js.
 *
 * Plax is a browser IIFE, so we load it the way a <script> tag would: evaluate
 * the source in a scope where `jQuery` is defined, against the jsdom DOM
 * provided by jest-environment-jsdom.
 */

const fs = require('fs');
const path = require('path');
const jQuery = require('jquery');

const plaxSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'plax.js'), 'utf8');
const loadPlax = new Function('jQuery', plaxSource);
loadPlax(jQuery);

// jsdom has no layout engine: elements report zero size and no client rects,
// which would make the plugin's viewport guard bail out. Give the test stage
// deterministic geometry instead.
function mockLayout(element, width, height) {
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: height, configurable: true });
  element.getClientRects = () => [
    { top: 0, bottom: height, left: 0, right: width, width, height }
  ];
}

function setupStage() {
  document.body.innerHTML = '';
  const stage = document.createElement('div');
  stage.style.width = '100px';
  stage.style.height = '100px';
  document.body.appendChild(stage);
  mockLayout(stage, 100, 100);
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: 600,
    configurable: true
  });
  return stage;
}

function addLayer(stage, id, attributes) {
  const el = document.createElement('div');
  el.id = id;
  el.style.position = 'absolute';
  el.style.top = '10px';
  el.style.left = '20px';
  Object.entries(attributes || {}).forEach(([name, value]) => {
    el.setAttribute(name, value);
  });
  stage.appendChild(el);
  return el;
}

function moveMouse(target, pageX, pageY) {
  target.trigger(jQuery.Event('mousemove', { pageX, pageY }));
}

// The render loop throttles to maxfps (25fps => 40ms). Let the throttle
// window elapse between simulated mouse moves.
function waitForRender() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

beforeEach(() => {
  // Start every test with a clean slate: no layers, no bound handlers.
  jQuery.plax.disable({ clearLayers: true });
});

describe('$.fn.plaxify', () => {
  test('registers a layer and moves it with the mouse (transform path)', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-a', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-a');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage) });

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();

    // startX = 0 - floor(40/2) = -20; hRatio = 100/100 = 1 => -20 + 40 = 20
    // startY = 0 - floor(20/2) = -10; vRatio = 1 => -10 + 20 = 10
    expect($layer.css('transform')).toBe('translate3d(20px,10px,0px)');
  });

  test('parses data attributes and honors invert', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-b', {
      'data-xrange': '40',
      'data-yrange': '20',
      'data-invert': 'true'
    });
    const $layer = jQuery('#layer-b');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage) });

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();

    // invert => inversionFactor -1: startX = 0 + 20 = 20; newX = 20 - 40 = -20
    expect($layer.css('transform')).toBe('translate3d(-20px,-10px,0px)');
  });

  test('applies explicit params when no data attributes are present', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-c');
    const $layer = jQuery('#layer-c');

    $layer.plaxify({ xRange: 40, yRange: 20 });
    jQuery.plax.enable({ activityTarget: jQuery(stage) });

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();

    expect($layer.css('transform')).toBe('translate3d(20px,10px,0px)');
  });

  test('falls back to left/top positioning when useTransform is disabled', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-d', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-d');

    $layer.plaxify({ useTransform: false });
    jQuery.plax.enable({ activityTarget: jQuery(stage) });

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();

    expect($layer.css('left')).toBe('20px');
    expect($layer.css('top')).toBe('10px');
  });

  test('plaxify() with no arguments is a safe no-op for empty selections', () => {
    const stage = setupStage();
    addLayer(stage, 'layer-k');

    expect(() => {
      jQuery('#layer-k').plaxify();
      jQuery('.does-not-exist').plaxify();
    }).not.toThrow();
  });
});

describe('$.plax.enable / disable', () => {
  test('disable() unbinds mouse handlers so layers stop moving', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-e', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-e');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage) });

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();
    expect($layer.css('transform')).toBe('translate3d(20px,10px,0px)');

    jQuery.plax.disable();

    moveMouse(jQuery(stage), 0, 0);
    await waitForRender();
    // Position must be unchanged after disable.
    expect($layer.css('transform')).toBe('translate3d(20px,10px,0px)');
  });

  test('repeated enable() calls do not stack handlers', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-f', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-f');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage) });
    jQuery.plax.enable({ activityTarget: jQuery(stage) });
    jQuery.plax.disable();

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();

    // A single disable() must have removed every handler.
    expect($layer.css('transform')).toBe('translate3d(0px,0px,0px)');
  });

  test('disable({ restorePositions: true }) restores original positions', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-g', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-g');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage) });

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();
    expect($layer.css('transform')).toBe('translate3d(20px,10px,0px)');

    jQuery.plax.disable({ restorePositions: true });

    expect($layer.css('transform')).toBe('translate3d(0px,0px,0px)');
    expect($layer.css('top')).toBe('0px');
  });

  test('enable() with no registered layers does not throw', () => {
    const stage = setupStage();
    addLayer(stage, 'layer-h', { 'data-xrange': '40', 'data-yrange': '20' });

    jQuery('#layer-h').plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage) });
    jQuery.plax.disable({ clearLayers: true });

    expect(() => {
      moveMouse(jQuery(stage), 100, 100);
    }).not.toThrow();
  });
});

describe('background layers', () => {
  test('background layers with pixel positions animate background-position', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-j', {
      'data-background': 'true',
      'data-xrange': '40',
      'data-yrange': '20'
    });
    const $layer = jQuery('#layer-j');
    $layer.css('background-position', '0px 0px');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage) });

    moveMouse(jQuery(stage), 100, 100);
    await waitForRender();

    expect($layer.css('background-position')).toBe('20px 10px');
  });

  test('background layers with unparseable positions warn and are skipped', () => {
    const stage = setupStage();
    addLayer(stage, 'layer-i', { 'data-background': 'true' });
    const $layer = jQuery('#layer-i');
    $layer.css('background-position', 'center center');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    $layer.plaxify();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    // The layer was not registered: enabling and moving must not throw.
    jQuery.plax.enable({ activityTarget: jQuery(stage) });
    expect(() => moveMouse(jQuery(stage), 100, 100)).not.toThrow();
  });
});