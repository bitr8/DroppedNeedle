import { page } from '@vitest/browser/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const h = vi.hoisted(() => ({
	loaded: true,
	configured: false,
	isAdmin: false,
	isTrusted: false,
	url: new URL('http://localhost/downloads'),
	gotoCalls: [] as unknown[][],
	calls: {
		queue: 0,
		calendar: 0,
		history: 0,
		freeMusic: 0,
		batches: 0,
		importZone: 0,
		importJobs: 0
	},
	lastHighlight: undefined as string | null | undefined
}));

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => {
		h.gotoCalls.push(args);
	}
}));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return h.url;
		}
	}
}));

vi.mock('$lib/queries/HomeIntegrationStatusQuery.svelte', () => ({
	getIntegrationStatusQuery: () => ({
		get isLoading() {
			return !h.loaded;
		},
		get data() {
			return h.loaded ? { download_client: h.configured } : undefined;
		}
	})
}));

vi.mock('$lib/stores/authStore.svelte', () => ({
	authStore: {
		get isAdmin() {
			return h.isAdmin;
		},
		get isTrusted() {
			return h.isTrusted;
		},
		get user() {
			return { id: 'user-1' };
		}
	}
}));

function stub(key: keyof typeof h.calls, captureProps = false) {
	return () => {
		const Component = function (_anchor: unknown, props: { highlight?: string | null }) {
			h.calls[key] += 1;
			if (captureProps) h.lastHighlight = props?.highlight;
		};
		Component.prototype = {};
		return { default: Component };
	};
}

vi.mock('$lib/components/downloads/DownloadQueue.svelte', stub('queue', true));
vi.mock('$lib/components/downloads/DownloadsCalendarTab.svelte', stub('calendar'));
vi.mock('$lib/components/downloads/DownloadsHistoryTab.svelte', stub('history'));
vi.mock('$lib/components/downloads/FreeMusicQueue.svelte', stub('freeMusic'));
vi.mock('$lib/components/discover/DiscoveryBatchList.svelte', stub('batches'));
vi.mock('$lib/components/import/DropImportZone.svelte', stub('importZone'));
vi.mock('$lib/components/import/DropImportJobList.svelte', stub('importJobs'));

import DownloadsPage from './+page.svelte';

describe('/downloads page - tab shell', () => {
	beforeEach(() => {
		h.loaded = true;
		h.configured = false;
		h.isAdmin = false;
		h.isTrusted = false;
		h.url = new URL('http://localhost/downloads');
		h.gotoCalls = [];
		h.calls = {
			queue: 0,
			calendar: 0,
			history: 0,
			freeMusic: 0,
			batches: 0,
			importZone: 0,
			importJobs: 0
		};
		h.lastHighlight = undefined;
	});

	it('shows the admin setup CTA when the client is not configured', async () => {
		h.isAdmin = true;
		h.isTrusted = true;
		render(DownloadsPage);
		await expect.element(page.getByText('Download client not configured')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Configure Download Client' }))
			.toBeVisible();
	});

	it('shows a non-admin message (no CTA) when not configured', async () => {
		render(DownloadsPage);
		await expect
			.element(page.getByText('Contact your admin to configure the download client.'))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Configure Download Client' }))
			.not.toBeInTheDocument();
	});

	it('shows a loading skeleton before integration status loads', async () => {
		h.loaded = false;
		const { container } = render(DownloadsPage);
		expect(container.querySelector('.animate-pulse')).not.toBeNull();
	});

	it('renders the queue on the default tab once configured', async () => {
		h.configured = true;
		render(DownloadsPage);
		expect(h.calls.queue).toBe(1);
		expect(h.calls.freeMusic).toBe(1);
		expect(h.calls.batches).toBe(1);
	});

	it('always shows Queue/Calendar/History, hides Import for plain users', async () => {
		render(DownloadsPage);
		await expect.element(page.getByRole('tab', { name: /Queue/ })).toBeVisible();
		await expect.element(page.getByRole('tab', { name: /Calendar/ })).toBeVisible();
		await expect.element(page.getByRole('tab', { name: /History/ })).toBeVisible();
		await expect.element(page.getByRole('tab', { name: 'Import' })).not.toBeInTheDocument();
	});

	it('switches to Calendar on click and updates the url', async () => {
		render(DownloadsPage);
		await page.getByRole('tab', { name: /Calendar/ }).click();
		expect(h.calls.calendar).toBe(1);
		expect(h.calls.queue).toBe(0);
		const lastGoto = h.gotoCalls.at(-1);
		expect(String(lastGoto?.[0])).toContain('tab=calendar');
	});

	it('switches to History on click', async () => {
		render(DownloadsPage);
		await page.getByRole('tab', { name: /History/ }).click();
		expect(h.calls.history).toBe(1);
	});

	it('lets a trusted user reach Import and see the drop zone + job list', async () => {
		h.isTrusted = true;
		render(DownloadsPage);
		await page.getByRole('tab', { name: 'Import' }).click();
		expect(h.calls.importZone).toBe(1);
		expect(h.calls.importJobs).toBe(1);
	});

	it('shows the everyone toggle only to admins on the Import tab', async () => {
		h.isTrusted = true;
		h.isAdmin = true;
		render(DownloadsPage);
		await page.getByRole('tab', { name: 'Import' }).click();
		await expect.element(page.getByText("Show everyone's imports")).toBeVisible();
	});

	it('forwards ?highlight= to the queue tab', async () => {
		h.configured = true;
		h.url = new URL('http://localhost/downloads?highlight=task-1');
		render(DownloadsPage);
		expect(h.lastHighlight).toBe('task-1');
	});
});
