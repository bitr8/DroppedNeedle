<script lang="ts">
	interface Option {
		value: string;
		label: string;
		count?: number;
	}

	interface Props {
		options: Option[];
		value: string;
		ariaLabel: string;
	}

	let { options, value = $bindable(), ariaLabel }: Props = $props();

	let buttons = $state<(HTMLButtonElement | null)[]>([]);

	function select(index: number) {
		value = options[index].value;
		buttons[index]?.focus();
	}

	function onKeydown(e: KeyboardEvent, index: number) {
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			select((index + 1) % options.length);
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			select((index - 1 + options.length) % options.length);
		}
	}
</script>

<div
	role="radiogroup"
	aria-label={ariaLabel}
	class="inline-flex gap-1 rounded-control bg-surface-raised p-1"
>
	{#each options as option, index (option.value)}
		<button
			bind:this={buttons[index]}
			type="button"
			role="radio"
			aria-checked={option.value === value}
			tabindex={option.value === value ? 0 : -1}
			class="rounded-control px-3 py-1.5 text-sm font-semibold whitespace-nowrap {option.value ===
			value
				? 'bg-accent text-accent-fg'
				: 'text-fg-muted hover:bg-surface-hover hover:text-fg'}"
			onclick={() => select(index)}
			onkeydown={(e) => onKeydown(e, index)}
		>
			{option.label}
			{#if option.count !== undefined}
				<span class="ml-1 opacity-70">{option.count}</span>
			{/if}
		</button>
	{/each}
</div>
