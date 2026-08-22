<script lang="ts">
	import { page } from '$app/state';
	import { House, LibraryBig, ListMusic, Search, UserRound } from 'lucide-svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { playerStore } from '$lib/stores/player.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const NAV = [
		{ href: '/', label: 'Home', icon: House },
		{ href: '/search', label: 'Search', icon: Search },
		{ href: '/library', label: 'Library', icon: LibraryBig },
		{ href: '/playlists', label: 'Playlists', icon: ListMusic }
	];

	const path = $derived(page.url.pathname);
	const isActive = (href: string) =>
		href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
</script>

<header
	class="droppedneedle-topbar sticky top-0 z-50 flex items-center gap-3 px-4 md:grid md:grid-cols-[1fr_auto_1fr] md:px-6"
>
	<a
		href="/"
		aria-label="Home"
		class="flex shrink-0 items-center rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring md:justify-self-start"
	>
		<img src="/logo_wide.png" alt="DroppedNeedle" class="hidden h-6 md:block" />
		<img src="/logo_icon.png" alt="DroppedNeedle" class="h-7 md:hidden" />
	</a>
	<nav class="hidden items-center gap-1 self-stretch md:flex" aria-label="Primary navigation">
		{#each NAV as item (item.href)}
			<a
				href={item.href}
				aria-current={isActive(item.href) ? 'page' : undefined}
				class="droppedneedle-topbar__link"
			>
				{item.label}
			</a>
		{/each}
	</nav>
	<a
		href="/profile"
		aria-label="Profile"
		aria-current={isActive('/profile') ? 'page' : undefined}
		class="ml-auto grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-fg-muted ring-1 ring-hairline transition-colors duration-150 ease-standard hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:text-accent aria-[current=page]:ring-accent md:justify-self-end"
	>
		{#if authStore.user?.avatar_url}
			<img src={authStore.user.avatar_url} alt="" class="size-full object-cover" />
		{:else}
			<UserRound class="size-5" aria-hidden="true" />
		{/if}
	</a>
</header>

<div
	class="droppedneedle-main-content flex-1"
	class:droppedneedle-player-visible={playerStore.isPlayerVisible}
>
	{@render children()}
</div>

<nav class="droppedneedle-bottom-nav md:hidden" aria-label="Primary navigation">
	{#each NAV as item (item.href)}
		{@const Icon = item.icon}
		<a
			href={item.href}
			class="droppedneedle-bottom-nav__item"
			class:active={isActive(item.href)}
			aria-current={isActive(item.href) ? 'page' : undefined}
		>
			<Icon aria-hidden="true" />
			<span>{item.label}</span>
		</a>
	{/each}
</nav>
