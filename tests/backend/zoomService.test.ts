import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
const { createZoomService, zoomAction, normalizeZoom } = require('../../electron/services/zoomService.cjs');

function setup(saved = 1) {
  const contents = Object.assign(new EventEmitter(), {
    setZoomFactor: vi.fn(), send: vi.fn(), isDestroyed: () => false,
  });
  const saveFactor = vi.fn();
  const service = createZoomService({ getSavedFactor: () => saved, saveFactor });
  service.attach(contents);
  return { contents, service, saveFactor };
}

afterEach(() => vi.useRealTimers());

describe('Interface zoom', () => {
  it('recognizes main keyboard and numpad shortcuts, without intercepting ordinary typing', () => {
    const input = { type: 'keyDown', control: true };
    for (const key of ['+', '=', 'Add']) expect(zoomAction({ ...input, key })).toBe('in');
    for (const key of ['-', 'Subtract']) expect(zoomAction({ ...input, key })).toBe('out');
    expect(zoomAction({ ...input, code: 'NumpadAdd' })).toBe('in');
    expect(zoomAction({ ...input, code: 'NumpadSubtract' })).toBe('out');
    expect(zoomAction({ ...input, key: '0' })).toBe('reset');
    expect(zoomAction({ ...input, code: 'Numpad0' })).toBe('reset');
    expect(zoomAction({ ...input, key: '+', shift: true })).toBe('in');
    for (const override of [{ control: false }, { alt: true }, { type: 'keyUp' }, { key: 'a' }]) {
      expect(zoomAction({ ...input, key: '+', ...override })).toBeNull();
    }
  });

  it('restores saved scale, reapplies it after load and consumes shortcuts before the editor', () => {
    vi.useFakeTimers();
    const { contents, service } = setup(1.3);
    expect(contents.setZoomFactor).toHaveBeenCalledWith(1.3);
    contents.emit('did-finish-load');
    expect(contents.send).toHaveBeenLastCalledWith('window:zoomChanged', 1.3);
    const preventDefault = vi.fn();
    contents.emit('before-input-event', { preventDefault }, { type: 'keyDown', control: true, key: '+' });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(service.get(contents)).toBe(1.4);
    expect(contents.setZoomFactor).toHaveBeenLastCalledWith(1.4);
    contents.emit('before-input-event', { preventDefault }, { type: 'keyDown', control: true, key: '0' });
    expect(service.get(contents)).toBe(1);
  });

  it('bounds repeated changes, resets to 100%, and saves the final scale without rounding drift', () => {
    vi.useFakeTimers();
    const { contents, service, saveFactor } = setup();
    for (let i = 0; i < 40; i++) service.change(contents, 'in');
    expect(service.get(contents)).toBe(2);
    for (let i = 0; i < 40; i++) service.change(contents, 'out');
    expect(service.get(contents)).toBe(0.5);
    service.change(contents, 'reset');
    service.change(contents, 'out');
    expect(service.get(contents)).toBe(0.9);
    expect(saveFactor).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(saveFactor).toHaveBeenCalledExactlyOnceWith(0.9);
    service.change(contents, 'reset');
    contents.emit('destroyed');
    expect(saveFactor).toHaveBeenLastCalledWith(1);
    vi.runAllTimers();
    expect(saveFactor).toHaveBeenCalledTimes(2);
  });

  it('validates persisted factors and ignores unknown commands', () => {
    for (const invalid of [null, undefined, '1.5', NaN, Infinity]) expect(normalizeZoom(invalid)).toBe(1);
    expect(normalizeZoom(9)).toBe(2);
    expect(normalizeZoom(-1)).toBe(0.5);
    const { contents, service, saveFactor } = setup();
    expect(service.change(contents, 'invalid')).toBe(1);
    expect(saveFactor).not.toHaveBeenCalled();
  });
});
