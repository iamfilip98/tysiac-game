import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { loadLang } from './i18n';

describe('App', () => {
  it('renders the home route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Tysiąc' })).toBeInTheDocument();
  });

  it('keeps the title Tysiąc in every language', async () => {
    document.title = 'Tysiąc';
    await loadLang('pl');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Tysiąc' })).toBeInTheDocument();
    expect(document.title).toBe('Tysiąc');
    expect(document.documentElement.lang).toBe('pl');
  });
});
