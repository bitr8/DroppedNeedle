import { page } from '@vitest/browser/context';
import { describe, expect, it, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import { Music } from 'lucide-svelte';
import EmptyState from './EmptyState.svelte';
import { authStore } from '$lib/stores/authStore.svelte';

const admin = {
	id: '1',
	display_name: 'Rob',
	role: 'admin' as const,
	email: null,
	avatar_url: null,
	username: null,
	username_display: null,
	providers: []
};

describe('EmptyState', () => {
	afterEach(() => authStore.clear());

	it('shows the admin description by default', async () => {
		authStore.setUser(admin);
		render(EmptyState, {
			icon: Music,
			title: 'No playlists yet',
			description: 'Connect Spotify to import playlists.',
			userDescription: 'Ask Rob to connect Spotify.'
		});
		await expect.element(page.getByText('Connect Spotify to import playlists.')).toBeVisible();
	});

	it('swaps to the user description when not admin', async () => {
		render(EmptyState, {
			icon: Music,
			title: 'No playlists yet',
			description: 'Connect Spotify to import playlists.',
			userDescription: 'Ask Rob to connect Spotify.'
		});
		await expect.element(page.getByText('Ask Rob to connect Spotify.')).toBeVisible();
	});

	it('renders a CTA link when no action snippet is given', async () => {
		render(EmptyState, {
			icon: Music,
			title: 'No playlists yet',
			ctaLabel: 'Connect Spotify',
			ctaHref: '/profile'
		});
		await expect.element(page.getByRole('link', { name: 'Connect Spotify' })).toBeVisible();
	});

	it('prefers a caller-supplied action snippet over the CTA link', async () => {
		render(EmptyState, {
			icon: Music,
			title: 'No playlists yet',
			ctaLabel: 'Connect Spotify',
			ctaHref: '/profile',
			action: createRawSnippet(() => ({ render: () => '<button>Import…</button>' }))
		});
		await expect.element(page.getByRole('button', { name: 'Import…' })).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Connect Spotify' }))
			.not.toBeInTheDocument();
	});
});
