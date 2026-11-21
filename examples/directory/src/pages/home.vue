<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <main>
    <h1>{{ title }}</h1>
    <p>Selected from the template catalog.</p>
  </main>
</template>
