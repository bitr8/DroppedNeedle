<script lang="ts">
	import { AlertCircle, AlertTriangle, Info, X } from 'lucide-svelte';
	import type { AttentionItem } from '$lib/queries/activity/types';

	interface Props {
		item: AttentionItem;
		ondismiss?: (item: AttentionItem) => void;
	}

	let { item, ondismiss }: Props = $props();

	const valid = $derived(Boolean(item.what && item.why && item.action_label && item.action_href));

	const TONE: Record<AttentionItem['tier'], string> = {
		critical: 'border-l-danger text-danger',
		warning: 'border-l-warning text-warning',
		info: 'border-l-info text-info'
	};
	const ICON = { critical: AlertCircle, warning: AlertTriangle, info: Info };
</script>

{#if valid}
	{@const Icon = ICON[item.tier]}
	<div
		class="flex items-start gap-3 rounded-card border border-border border-l-4 bg-surface-raised px-3 py-2 {TONE[
			item.tier
		]}"
		data-testid="attention-card"
		data-tier={item.tier}
	>
		<Icon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
		<div class="min-w-0 flex-1">
			<p class="truncate font-semibold text-fg">{item.what}</p>
			<p class="mt-0.5 text-sm text-fg-muted">{item.why}</p>
			<a
				href={item.action_href}
				class="mt-1.5 inline-block text-sm font-semibold text-accent hover:underline"
			>
				{item.action_label}
			</a>
		</div>
		{#if item.dismissible}
			<button
				type="button"
				class="shrink-0 rounded-control p-1 text-fg-muted hover:bg-surface-hover hover:text-fg"
				onclick={() => ondismiss?.(item)}
				aria-label="Dismiss {item.what}"
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		{/if}
	</div>
{/if}
