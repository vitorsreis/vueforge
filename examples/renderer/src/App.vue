<script setup>
defineProps({
  title: { type: String, default: 'Vueforge renderer' },
})
</script>

<template>
  <main>
    <h1>{{ title }}</h1>
    <p>Rendered through the framework-neutral Vueforge API.</p>
  </main>
</template>
