<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <article>
    <h1>{{ title ?? 'Card' }}</h1>
  </article>
</template>
