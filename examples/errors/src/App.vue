<script setup lang="ts">
const props = defineProps<{
  fail?: boolean
}>()

if (props.fail) {
  throw new Error('Example render failure')
}
</script>

<template>
  <h1>Error example is healthy</h1>
</template>
