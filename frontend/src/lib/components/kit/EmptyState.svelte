<script lang="ts">
	import type { ComponentType, Snippet } from 'svelte';
	import { authStore } from '$lib/stores/authStore.svelte';

	interface Props {
		icon: ComponentType;
		title: string;
		description?: string;
		userDescription?: string;
		ctaLabel?: string;
		ctaHref?: string;
		action?: Snippet;
	}

	let { icon, title, description, userDescription, ctaLabel, ctaHref, action }: Props = $props();

	const SvelteComponent = $derived(icon);
	const copy = $derived(!authStore.isAdmin && userDescription ? userDescription : description);
</script>

<div class="mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
	<div
		class="mb-5 grid size-18 place-items-center rounded-card border border-border bg-surface-raised text-fg-muted"
	>
		<SvelteComponent class="size-8" strokeWidth={1.5} />
	</div>
	<h3 class="text-2xl font-bold text-fg">{title}</h3>
	{#if copy}
		<p class="mt-2 max-w-md text-sm leading-relaxed text-fg-muted">{copy}</p>
	{/if}
	{#if action}
		<div class="mt-5">{@render action()}</div>
	{:else if ctaLabel && ctaHref}
		<a
			href={ctaHref}
			class="mt-5 rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
		>
			{ctaLabel}
		</a>
	{/if}
</div>
