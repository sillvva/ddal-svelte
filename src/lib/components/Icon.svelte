<script lang="ts">
	import account from "@iconify/icons-mdi/account";
	import alertCircle from "@iconify/icons-mdi/alert-circle";
	import chevronDown from "@iconify/icons-mdi/chevron-down";
	import chevronLeft from "@iconify/icons-mdi/chevron-left";
	import chevronUp from "@iconify/icons-mdi/chevron-up";
	import dotsHorizontal from "@iconify/icons-mdi/dots-horizontal";
	import formatListText from "@iconify/icons-mdi/format-list-text";
	import github from "@iconify/icons-mdi/github";
	import home from "@iconify/icons-mdi/home";
	import menu from "@iconify/icons-mdi/menu";
	import pencil from "@iconify/icons-mdi/pencil";
	import plus from "@iconify/icons-mdi/plus";
	import trashCan from "@iconify/icons-mdi/trash-can";
	import viewGrid from "@iconify/icons-mdi/view-grid";
	import Icon from "@iconify/svelte";

	let paths = {
		account,
		"alert-circle": alertCircle,
		"chevron-down": chevronDown,
		"chevron-left": chevronLeft,
		"chevron-up": chevronUp,
		"dots-horizontal": dotsHorizontal,
		"format-list-text": formatListText,
		github,
		home,
		menu,
		pencil,
		plus,
		"trash-can": trashCan,
		"view-grid": viewGrid
	};

	export let src: keyof typeof paths;
</script>

<Icon icon={paths[src]} {...$$restProps} width="auto" height="auto" />
