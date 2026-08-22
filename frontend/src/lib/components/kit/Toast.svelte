<script lang="ts">
	import { Check, Info, TriangleAlert, X } from 'lucide-svelte';
	import { toastStore, type Toast } from '$lib/stores/toast';

	let { raised = false }: { raised?: boolean } = $props();

	const ICON = { success: Check, error: X, warning: TriangleAlert, info: Info, neutral: Info };
	const TONE: Record<Toast['type'], string> = {
		success: 'border-l-success text-success',
		error: 'border-l-danger text-danger',
		warning: 'border-l-warning text-warning',
		info: 'border-l-info text-info',
		neutral: 'border-l-border-strong text-fg-muted'
	};
</script>

{#if $toastStore}
	{@const t = $toastStore}
	{@const Icon = ICON[t.type]}
	<div
		class="fixed right-4 bottom-4 z-50 w-[min(100vw-2rem,26rem)] transition-[bottom] duration-200 md:right-6 md:bottom-6"
		class:bottom-24={raised}
		data-testid="toast"
		data-type={t.type}
	>
		<div
			class="flex items-center gap-3 rounded-card border border-border border-l-4 bg-surface-overlay px-4 py-3 text-fg shadow-overlay {TONE[
				t.type
			]}"
			role={t.type === 'error' ? 'alert' : 'status'}
			aria-live={t.type === 'error' ? 'assertive' : 'polite'}
		>
			<Icon class="size-5 shrink-0" aria-hidden="true" />
			<span class="min-w-0 flex-1 text-sm text-fg">{t.message}</span>
			{#if t.action}
				<button
					type="button"
					class="shrink-0 rounded-control px-2 py-1 text-sm font-semibold text-accent hover:bg-accent/10"
					onclick={t.action.onClick}
				>
					{t.action.label}
				</button>
			{/if}
			<button
				type="button"
				class="shrink-0 rounded-control p-1 text-fg-muted hover:bg-surface-hover hover:text-fg"
				onclick={() => toastStore.hide()}
				aria-label="Dismiss"
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>
{/if}
