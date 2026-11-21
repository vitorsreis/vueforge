<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <Teleport to="head">
    <title>{{ title ?? 'Vueforge Teleport' }}</title>
    <meta
      name="description"
      :content="description ?? 'Vueforge Teleport example'"
    />
  </Teleport>

  <main>
    <h1>{{ title ?? 'Vueforge Teleport' }}</h1>
  </main>
</template>
