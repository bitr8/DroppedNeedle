<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title: string;
		kicker?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		pending?: boolean;
		error?: string | null;
		onconfirm: () => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		kicker,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		pending = false,
		error = null,
		onconfirm,
		children
	}: Props = $props();

	const titleId = $props.id();
	let dialog = $state<HTMLDialogElement>();
	let heading = $state<HTMLHeadingElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			heading?.focus();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
	class="m-auto w-[min(100vw-2rem,28rem)] rounded-card border border-border bg-surface-overlay p-0 text-fg shadow-overlay backdrop:bg-black/60"
>
	<div class="p-6">
		{#if kicker}
			<p
				class="text-xs font-bold uppercase tracking-[0.16em] {danger
					? 'text-danger'
					: 'text-fg-muted'}"
			>
				{kicker}
			</p>
		{/if}
		<h2 bind:this={heading} id={titleId} tabindex="-1" class="mt-1 text-xl font-bold outline-none">
			{title}
		</h2>
		{#if children}
			<div class="mt-4 text-sm leading-relaxed text-fg-muted">{@render children()}</div>
		{/if}
		{#if error}
			<p role="alert" class="mt-4 rounded-control bg-danger/15 px-3 py-2 text-sm text-danger">
				{error}
			</p>
		{/if}
		<div class="mt-6 flex justify-end gap-2">
			<button
				type="button"
				class="rounded-control px-4 py-2 text-sm font-semibold text-fg-muted hover:bg-surface-hover hover:text-fg"
				onclick={() => (open = false)}
			>
				{cancelLabel}
			</button>
			<button
				type="button"
				class="rounded-control px-4 py-2 text-sm font-semibold disabled:opacity-60 {danger
					? 'bg-danger text-accent-fg hover:brightness-110'
					: 'bg-accent text-accent-fg hover:bg-accent-hover'}"
				disabled={pending}
				onclick={onconfirm}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</dialog>
