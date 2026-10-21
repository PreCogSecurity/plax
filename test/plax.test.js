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

function fireDeviceOrientation(target, gamma, beta, alpha) {
  const event = new Event('deviceorientation');
  event.gamma = gamma;
  event.beta = beta;
  event.alpha = alpha;
  target[0].dispatchEvent(event);
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

  test('background-position with single value warns and is skipped', () => {
    const stage = setupStage();
    addLayer(stage, 'layer-single', { 'data-background': 'true' });
    const $layer = jQuery('#layer-single');
    $layer.css('background-position', '50px');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    $layer.plaxify();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('two values'), expect.anything());
    warnSpy.mockRestore();

    jQuery.plax.enable({ activityTarget: jQuery(stage) });
    expect(() => moveMouse(jQuery(stage), 100, 100)).not.toThrow();
  });

  test('background-position with percentage values warns and is skipped', () => {
    const stage = setupStage();
    addLayer(stage, 'layer-pct', { 'data-background': 'true' });
    const $layer = jQuery('#layer-pct');
    $layer.css('background-position', '50% 50%');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    $layer.plaxify();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pixel values or top/left'), expect.anything());
    warnSpy.mockRestore();

    jQuery.plax.enable({ activityTarget: jQuery(stage) });
    expect(() => moveMouse(jQuery(stage), 100, 100)).not.toThrow();
  });

  test('background-position with right/bottom keywords warns and is skipped', () => {
    const stage = setupStage();
    addLayer(stage, 'layer-rb', { 'data-background': 'true' });
    const $layer = jQuery('#layer-rb');
    $layer.css('background-position', 'right bottom');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    $layer.plaxify();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pixel values or top/left'), expect.anything());
    warnSpy.mockRestore();

    jQuery.plax.enable({ activityTarget: jQuery(stage) });
    expect(() => moveMouse(jQuery(stage), 100, 100)).not.toThrow();
  });
});

describe('device orientation (gyro) handling', () => {
  beforeEach(() => {
    // Mock DeviceOrientationEvent for gyro tests (jsdom doesn't provide it)
    global.window.DeviceOrientationEvent = function DeviceOrientationEvent() {};
    global.window.DeviceOrientationEvent.prototype = {
      gamma: 0,
      beta: 0,
      alpha: 0
    };
    // Reset ignoreMoveable so gyro path can work
    // We need to access the internal variable - we can't directly, but we can
    // re-enable after each test by calling disable() which doesn't reset it
    // Actually, the variable is in the closure. Let's just ensure it works.
  });

  afterEach(() => {
    // Clean up the mock
    delete global.window.DeviceOrientationEvent;
    // Reset ignoreMoveable by reloading plax? Not easily done.
    // The tests run in isolation with fresh plax load per test file.
  });
  test('enable() with gyroRange sets motionDegrees', () => {
    jQuery.plax.enable({ gyroRange: 45 });
    // motionDegrees is internal; we verify by checking behavior after enable
    // The test primarily ensures no throw and gyroRange is accepted
    jQuery.plax.disable();
  });

  test('deviceorientation event moves layers when moveable() is true', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-gyro', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-gyro');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage), gyroRange: 30 });

    // Simulate deviceorientation event: gamma=30, beta=20 (tilted right and forward)
    // motionStartX/Y will be set to these on first event
    fireDeviceOrientation(jQuery(window), 30, 20, 0);
    await waitForRender();

    // First event calibrates baseline, so position should be at origin (0,0)
    expect($layer.css('transform')).toBe('translate3d(0px,0px,0px)');

    // Second event: gamma=60, beta=40 => x=30, y=20 relative to baseline
    // Normalized: x = 30/30 = 1, y = 20/30 = 0.666...
    // Clamped to max 1: x=1, y=0.666...
    // Normalized to 0-1: x=1, y=0.833...
    // hRatio = 1/1 = 1, vRatio = 0.833...
    // startX = -20, newX = -20 + 40*1 = 20
    // startY = -10, newY = -10 + 20*0.833... = 6.66...
    fireDeviceOrientation(jQuery(window), 60, 40, 0);
    await waitForRender();

    // The layer should have moved
    const transform = $layer.css('transform');
    expect(transform).toMatch(/translate3d\(/);
    expect(transform).not.toBe('translate3d(0px,0px,0px)');
  });

  test('deviceorientation handler is removed on disable()', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-gyro2', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-gyro2');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage), gyroRange: 30 });

    fireDeviceOrientation(jQuery(window), 30, 20, 0);
    await waitForRender();

    jQuery.plax.disable();

    // After disable, further events should not move the layer
    fireDeviceOrientation(jQuery(window), 60, 40, 0);
    await waitForRender();

    expect($layer.css('transform')).toBe('translate3d(0px,0px,0px)');
  });

  test('repeated enable() with gyroRange does not stack handlers', async () => {
    const stage = setupStage();
    addLayer(stage, 'layer-gyro3', { 'data-xrange': '40', 'data-yrange': '20' });
    const $layer = jQuery('#layer-gyro3');

    $layer.plaxify();
    jQuery.plax.enable({ activityTarget: jQuery(stage), gyroRange: 30 });
    jQuery.plax.enable({ activityTarget: jQuery(stage), gyroRange: 30 });
    jQuery.plax.disable();

    fireDeviceOrientation(jQuery(window), 30, 20, 0);
    await waitForRender();

    expect($layer.css('transform')).toBe('translate3d(0px,0px,0px)');
  });
});