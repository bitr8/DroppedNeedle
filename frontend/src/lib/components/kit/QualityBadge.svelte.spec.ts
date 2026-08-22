import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QualityBadge from './QualityBadge.svelte';

describe('QualityBadge', () => {
	it('renders bit depth / sample rate for lossless formats', async () => {
		render(QualityBadge, { format: 'FLAC', bitDepth: 24, sampleRate: 96000 });
		await expect.element(page.getByText('FLAC24/96')).toBeVisible();
	});

	it('renders bitrate for lossy formats', async () => {
		render(QualityBadge, { format: 'MP3', bitrate: 320 });
		await expect.element(page.getByText('MP3320')).toBeVisible();
	});

	it('tints lossless formats with the success token', async () => {
		render(QualityBadge, { format: 'FLAC' });
		const badge = page.getByText('FLAC', { exact: true });
		expect(badge.element().className).toContain('text-success');
	});

	it('does not tint lossy formats', async () => {
		render(QualityBadge, { format: 'MP3', bitrate: 320 });
		const badge = page.getByText('MP3320');
		expect(badge.element().className).not.toContain('text-success');
	});
});
