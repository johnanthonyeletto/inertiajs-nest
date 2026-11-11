<script lang="ts">
  let { message }: { message: string } = $props()
</script>

<svelte:head>
  <title>Home</title>
</svelte:head>

<main>
  <h1>{message}</h1>
</main>
