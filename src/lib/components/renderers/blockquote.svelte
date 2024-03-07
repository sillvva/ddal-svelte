<script lang="ts">
	function bq(el: HTMLDetailsElement) {
		const iHTML = el.innerHTML.trim();
		const matches = iHTML.match(/\<(h\d)/);
		const match = (matches && matches[1]) || null;
		if (match && iHTML.startsWith("<" + match)) {
			const header = el.querySelector(match);
			if (header) el.innerHTML = iHTML.replace(/\<h\d/, "<summary").replace(/\<\/h\d/, "</summary");
		}
	}
</script>

<details use:bq><slot /></details>
