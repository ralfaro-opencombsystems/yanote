import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ZoomControls } from '../../src/components/ZoomControls';

afterEach(() => { cleanup(); delete (window as any).electronAPI; });

describe('Zoom controls', () => {
  it('shows loading, follows keyboard changes and ignores a stale initial response', async () => {
    let resolve!: (value: number) => void;
    let changed!: (value: number) => void;
    const unsubscribe = vi.fn();
    window.electronAPI = {
      getZoomFactor: () => new Promise<number>((done) => { resolve = done; }),
      onZoomChanged: (callback) => { changed = callback; return unsubscribe; }, zoom: vi.fn(),
    } as any;
    const { unmount } = render(<ZoomControls />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Cargando zoom');
    act(() => changed(1.4));
    await act(async () => resolve(1));
    expect(screen.getByLabelText('Porcentaje de zoom')).toHaveTextContent('140%');
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('offers zoom in, zoom out and reset to 100%, honoring the limits', async () => {
    const zoom = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0.5).mockResolvedValueOnce(1);
    window.electronAPI = { getZoomFactor: async () => 1, zoom } as any;
    render(<ZoomControls />);
    await screen.findByText('100%');
    await act(async () => fireEvent.click(screen.getByLabelText('Acercar (Ctrl + +)')));
    expect(zoom).toHaveBeenLastCalledWith('in');
    expect(screen.getByLabelText('Acercar (Ctrl + +)')).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByLabelText('Alejar (Ctrl + -)')));
    expect(zoom).toHaveBeenLastCalledWith('out');
    expect(screen.getByLabelText('Alejar (Ctrl + -)')).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByTitle('Restablecer zoom (Ctrl + 0)')));
    expect(zoom).toHaveBeenLastCalledWith('reset');
    expect(screen.getByLabelText('Porcentaje de zoom')).toHaveTextContent('100%');
  });

  it('ends loading on failure and allows reset to recover', async () => {
    window.electronAPI = {
      getZoomFactor: vi.fn().mockRejectedValue(new Error('offline')),
      zoom: vi.fn().mockResolvedValue(1),
    } as any;
    render(<ZoomControls />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el zoom');
    expect(screen.queryByLabelText('Cargando zoom')).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByTitle('Restablecer zoom (Ctrl + 0)')));
    expect(screen.getByLabelText('Porcentaje de zoom')).toHaveTextContent('100%');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
