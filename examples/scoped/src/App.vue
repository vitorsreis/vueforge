<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <main class="card">
    <h1>{{ title ?? 'Scoped card' }}</h1>
    <p>This component owns its stylesheet.</p>
  </main>
</template>

<style scoped>
.card {
  border: 1px solid var(--card-border-color);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.card h1 {
  color: var(--card-title-color);
}
</style>

<style>
:root {
  --card-border-color: #d4d4d4;
  --card-title-color: #1f2937;
}
</style>
